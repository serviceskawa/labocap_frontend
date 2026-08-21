"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Eye,
  Loader2,
  Printer,
  SquareArrowOutUpRight,
} from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";

import { DataTable } from "@/components/common/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { formatDate, nomComplet } from "@/lib/utils";
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
  /** Code de l'affectation elle-même — « AF26-0004 », lu sur un bordereau. */
  const [codeFilter, setCodeFilter] = useState("");

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
    const code = codeFilter.trim().toLowerCase();
    return list.filter((a) => {
      if (doctorFilter && a.userId !== doctorFilter) return false;
      if (term && !(a.note ?? "").toLowerCase().includes(term)) return false;
      // Sous-chaîne, non égalité : on tape « 0004 » en tenant le bordereau,
      // rarement « AF26-0004 » en entier.
      if (code && !(a.code ?? "").toLowerCase().includes(code)) return false;
      // Filtre "Demande d'examen" : l'affectation doit contenir le code sélectionné
      if (testOrderFilter && !(a.detailCodes ?? []).includes(testOrderFilter))
        return false;
      return true;
    });
  }, [data, doctorFilter, search, testOrderFilter, codeFilter]);

  // ---- Mutation : créer une nouvelle affectation ---------------------------

  /**
   * Onglet réservé à l'ouverture de l'affectation qui va être créée.
   *
   * `window.open` n'est autorisé que pendant l'activation par l'utilisateur —
   * le clic lui-même. Appelé dans le `onSuccess` d'une mutation, il arrive
   * après la réponse du serveur, hors de cette fenêtre, et les navigateurs le
   * bloquent comme une fenêtre surgissante.
   *
   * On ouvre donc l'onglet À VIDE pendant le clic, et on l'amène à destination
   * quand l'identifiant est connu. En cas d'échec, il est refermé — laisser un
   * onglet blanc derrière soi serait pire que de ne pas en ouvrir.
   */
  const ongletAffectation = useRef<Window | null>(null);

  const createMutation = useMutation({
    mutationFn: (userId: string) => assignmentsApi.create({ userId }),
    onSuccess: (res) => {
      toast.success("Affectation créée avec succès");
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      const created = res.data;
      const url = created?.id
        ? `/test-orders/assignments/${created.id}`
        : null;

      if (url && ongletAffectation.current && !ongletAffectation.current.closed) {
        ongletAffectation.current.location.href = url;
      } else if (url) {
        // L'onglet a été bloqué ou refermé : on reste sur la navigation en
        // place plutôt que de laisser l'utilisateur sans rien après sa saisie.
        router.push(url);
      }
      ongletAffectation.current = null;
    },
    onError: (err: AxiosError<ApiError>) => {
      ongletAffectation.current?.close();
      ongletAffectation.current = null;
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
    // Ouvert ICI, dans le gestionnaire de clic, seul moment où le navigateur
    // l'autorise. Même forme que `openDocFile` et l'aperçu des comptes rendus,
    // qui pratiquent déjà l'ouverture à blanc suivie d'une navigation.
    //
    // SANS `noopener` : la spécification impose à `window.open` de renvoyer
    // `null` dès que cette option est demandée. Une première version la passait
    // — l'onglet s'ouvrait, restait vide, et la navigation retombait sur le
    // repli dans l'onglet d'origine.
    //
    // Le lien retour est coupé juste après, en annulant `opener` sur la fenêtre
    // ouverte : on obtient la protection visée sans renoncer à la référence.
    // Possible parce que la destination est de même origine — sur une page
    // tierce, y accéder lèverait une erreur.
    const onglet = window.open("about:blank", "_blank");
    if (onglet) onglet.opener = null;
    ongletAffectation.current = onglet;
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
              target="_blank"
              rel="noopener noreferrer"
              title="Voir les détails (nouvel onglet)"
              aria-label="Voir les détails de l'affectation (nouvel onglet)"
            >
              <Eye className="h-3.5 w-3.5" />
              Voir
              <SquareArrowOutUpRight aria-hidden="true" className="h-3 w-3 opacity-70" />
            </Link>
            {a.nbrDetails >= 1 && (
              <Link
                href={`/test-orders/assignments/${a.id}/print`}
                className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium bg-yellow-500 text-white hover:bg-yellow-600 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
                title="Imprimer (nouvel onglet)"
                aria-label="Imprimer l'affectation (nouvel onglet)"
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimer
                <SquareArrowOutUpRight aria-hidden="true" className="h-3 w-3 opacity-70" />
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
                    {nomComplet(d.lastname, d.firstname)}
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

        {/* Les trois filtres de Laravel, plus le code de l'affectation :
            c'est par là qu'on entre quand on tient un bordereau en main, et
            la recherche libre ne parcourait que les notes. */}
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          {/* 1. Code d'affectation */}
          <div>
            <label
              htmlFor="filter-code"
              className="mb-1 block text-xs font-medium text-gray-600"
            >
              Code d&apos;affectation
            </label>
            <input
              id="filter-code"
              type="text"
              placeholder="ex. AF26-0004"
              value={codeFilter}
              onChange={(e) => setCodeFilter(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* 2. Demande d'examen */}
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

          {/* 3. Docteur */}
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
                  {nomComplet(d.lastname, d.firstname)}
                </option>
              ))}
            </NativeSelect>
          </div>

          {/* 4. Rechercher */}
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
