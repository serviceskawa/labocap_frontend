"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Eye, Printer, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";

import { DataTable } from "@/components/common/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { formatDate } from "@/lib/utils";
import {
  assignmentsApi,
  type Assignment,
} from "@/lib/api/assignments";
import { usersApi, type User } from "@/lib/api/users";
import { testOrdersApi } from "@/lib/api/testOrders";
import { RemoteSelectField } from "@/components/ui/RemoteSelectField";
import { MAX_VISIBLE_OPTIONS } from "@/components/ui/LimitedSelect";
import type { SelectOption } from "@/components/ui/FormSelect";
import type { ApiError, PageResponse } from "@/types/api";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

/**
 * Filtre « Demande d'examen » : la liste est filtrée **par code**, et la
 * recherche part au serveur (14 000 demandes en base, pas 500 préchargées).
 */
const loadOrderCodeOptions = (input: string): Promise<SelectOption[]> =>
  testOrdersApi
    .findAll({
      size: MAX_VISIBLE_OPTIONS,
      status: "VALIDATED",
      search: input || undefined,
    })
    .then((r) =>
      r.data.content
        .filter((o) => !!o.code)
        .map((o) => ({
          value: o.code,
          label: `${o.code} — ${o.patientFirstname} ${o.patientLastname}`.trim(),
        }))
    );

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


function isDoctorRole(name?: string): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return (
    n.includes("docteur") ||
    n.includes("doctor") ||
    n.includes("medecin") ||
    n.includes("médecin") ||
    n.includes("anapath") ||
    n.includes("anatomopath")
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AssignmentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  // ---- Filtres (3 filtres comme Laravel : Demande d'examen + Docteur + Rechercher)
  const [testOrderFilter, setTestOrderFilter] = useState("");
  const [testOrderFilterOption, setTestOrderFilterOption] =
    useState<SelectOption | null>(null);
  const [doctorFilter, setDoctorFilter] = useState("");
  const [search, setSearch] = useState("");

  // ---- Formulaire création
  const [newUserId, setNewUserId] = useState("");

  // ---- Queries -------------------------------------------------------------

  // On charge l'ensemble du jeu (les filtres et la pagination sont gérés côté
  // client par le DataTable), car l'API d'affectations n'accepte pas de
  // paramètres de filtrage docteur/recherche/demande.
  const { data, isLoading } = useQuery<PageResponse<Assignment>>({
    queryKey: ["assignments", "all"],
    queryFn: () =>
      assignmentsApi
        .findAll({ size: 1000 })
        .then((r) => r.data),
    enabled: can(PERMISSIONS.VIEW_TEST_ORDER_ASSIGNMENTS),
  });

  // Liste des utilisateurs ayant le rôle docteur — alimente les selects
  const { data: usersData } = useQuery({
    queryKey: ["users-doctors"],
    queryFn: () =>
      usersApi
        .findAll({ size: 500 })
        .then((r) => r.data.content as User[]),
  });

  // Le filtre « Demande d'examen » cherche en base (voir `loadOrderCodeOptions`).

  const doctors = useMemo(() => {
    const list = usersData ?? [];
    return list.filter((u) =>
      (u.roles ?? []).some((r) => isDoctorRole(r.name))
    );
  }, [usersData]);

  // ---- Filtrage local (note / docteur / demande) ---------------------------

  const filteredAssignments = useMemo(() => {
    const list = data?.content ?? [];
    const term = search.trim().toLowerCase();
    return list.filter((a) => {
      if (doctorFilter && a.userId !== doctorFilter) return false;
      if (term && !(a.note ?? "").toLowerCase().includes(term)) return false;
      // Filtre "Demande d'examen" : l'affectation doit contenir le code sélectionné
      if (testOrderFilter && !(a.detailCodes ?? []).includes(testOrderFilter))
        return false;
      return true;
    });
  }, [data, doctorFilter, search, testOrderFilter]);

  // ---- Mutation : créer une nouvelle affectation ---------------------------

  const createMutation = useMutation({
    mutationFn: (userId: string) => assignmentsApi.create({ userId }),
    onSuccess: (res) => {
      toast.success("Affectation créée avec succès");
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      const created = res.data;
      if (created?.id) {
        router.push(`/test-orders/assignments/${created.id}`);
      }
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la création"
      );
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserId) {
      toast.error("Veuillez sélectionner un docteur");
      return;
    }
    createMutation.mutate(newUserId);
  };

  // ---- Colonnes ------------------------------------------------------------

  const columns: ColumnDef<Assignment>[] = [
    {
      header: "Code",
      accessorKey: "code",
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium text-gray-800">
          {row.original.code ?? "—"}
        </span>
      ),
    },
    {
      header: "Docteur",
      accessorKey: "userName",
      cell: ({ row }) => row.original.userName ?? "—",
    },
    {
      header: "Nombre d'affectation",
      id: "nbrDetails",
      cell: ({ row }) => (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
          {row.original.nbrDetails ?? 0}
        </span>
      ),
    },
    {
      header: "Date d'affectation",
      id: "date",
      cell: ({ row }) =>
        formatDate(row.original.date ?? row.original.createdAt),
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => {
        const a = row.original;
        return (
          <div className="flex items-center gap-2">
            <Link
              href={`/test-orders/assignments/${a.id}`}
              className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              title="Voir les détails"
            >
              <Eye className="h-3.5 w-3.5" />
              Voir
            </Link>
            {a.nbrDetails >= 1 && (
              <Link
                href={`/test-orders/assignments/${a.id}/print`}
                className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium bg-yellow-500 text-white hover:bg-yellow-600 transition-colors"
                title="Imprimer"
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimer
              </Link>
            )}
          </div>
        );
      },
    },
  ];

  // ---- Guard permission ----------------------------------------------------

  if (!can(PERMISSIONS.VIEW_TEST_ORDER_ASSIGNMENTS)) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-gray-500">
          Vous n&apos;avez pas la permission de consulter les affectations.
        </p>
      </div>
    );
  }

  // ---- Render --------------------------------------------------------------

  const canManage = can(PERMISSIONS.MANAGE_TEST_ORDER_ASSIGNMENTS);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Affectation des comptes rendu"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Affectations" },
        ]}
      />

      {/* Section 1 : Formulaire création */}
      {canManage && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-800">
            Nouvelle affectation
          </h2>

          <form
            onSubmit={handleCreate}
            className="flex flex-wrap items-end gap-4"
          >
            <div className="flex-1 min-w-[250px]">
              <label
                htmlFor="new-user-id"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Docteur <span className="text-red-500">*</span>
              </label>
              <NativeSelect
                id="new-user-id"
                required
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
              >
                <option value="">Sélectionner un docteur</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.firstname} {d.lastname}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {createMutation.isPending ? "Ajout..." : "Ajouter"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Section 2 + 3 : Filtres + tableau */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-800">
          Liste des affectations
        </h2>

        {/* Filtres (3 filtres comme Laravel) */}
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {/* 1. Demande d'examen */}
          <div>
            <label
              htmlFor="filter-test-order"
              className="mb-1 block text-xs font-medium text-gray-600"
            >
              Demande d&apos;examen
            </label>
            <RemoteSelectField
              id="filter-test-order"
              loadOptions={loadOrderCodeOptions}
              value={testOrderFilter || null}
              onChange={(v, opt) => {
                setTestOrderFilter(v ?? "");
                setTestOrderFilterOption(opt);
              }}
              selectedOption={testOrderFilterOption}
              placeholder="Toutes"
              isClearable
            />
          </div>

          {/* 2. Docteur */}
          <div>
            <label
              htmlFor="filter-doctor"
              className="mb-1 block text-xs font-medium text-gray-600"
            >
              Docteur
            </label>
            <NativeSelect
              id="filter-doctor"
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
            >
              <option value="">Tous les docteurs</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.firstname} {d.lastname}
                </option>
              ))}
            </NativeSelect>
          </div>

          {/* 3. Rechercher */}
          <div>
            <label
              htmlFor="filter-search"
              className="mb-1 block text-xs font-medium text-gray-600"
            >
              Rechercher
            </label>
            <input
              id="filter-search"
              type="text"
              placeholder="Notes des affectations"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Tableau (pagination cliente cohérente avec le jeu filtré) */}
        <DataTable<Assignment>
          columns={columns}
          data={filteredAssignments}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
