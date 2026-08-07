"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, FileText, Trash2, Plus, Printer, Loader2 } from "lucide-react";
import type { AxiosError } from "axios";
import type { ColumnDef } from "@tanstack/react-table";

import { toast } from "sonner";
import { DataTable } from "@/components/common/DataTable";
import { CompteurFiltre } from "@/components/ui/CompteurFiltre";
import {
  RowActions,
  RowActionsProvider,
  type RowAction,
} from "@/components/ui/RowActions";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { formatCFA, formatDate } from "@/lib/utils";
import { testOrdersApi, type TestOrder } from "@/lib/api/testOrders";
import { usersApi } from "@/lib/api/users";
import apiClient from "@/lib/api/client";
import type { PageResponse, ApiError } from "@/types/api";

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

interface ContractOption {
  id: string;
  name: string;
}

// Le dropdown "Affecter à" (et le filtre Docteur) référencent un utilisateur
// ayant le rôle docteur — même source que `attribuateDoctorId`.
interface DoctorOption {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Composant : dropdown "Affecter à" inline dans le tableau
// ---------------------------------------------------------------------------

function AttribuateSelect({
  order,
  doctors,
}: {
  order: TestOrder;
  doctors: DoctorOption[];
}) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState<string>(order.attribuateDoctorId ?? "");

  const mutation = useMutation({
    mutationFn: (doctorId: string) =>
      testOrdersApi.assignDoctor(order.id, doctorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-orders-immuno"] });
      toast.success("Médecin affecté");
    },
    onError: () => toast.error("Erreur lors de l'affectation"),
  });

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const doctorId = e.target.value;
    setValue(doctorId);
    if (doctorId) mutation.mutate(doctorId);
  };

  return (
    <NativeSelect
      value={value}
      onChange={handleChange}
      disabled={mutation.isPending}
      className="min-w-[140px]"
      selectClassName="text-xs"
    >
      <option value="">Sélectionner un docteur</option>
      {doctors.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </NativeSelect>
  );
}

// ---------------------------------------------------------------------------
// Composant : boutons d'action par ligne
// ---------------------------------------------------------------------------

function ActionButtons({
  order,
  onDelete,
}: {
  order: TestOrder;
  onDelete: (order: TestOrder) => void;
}) {
  const { can } = usePermissions();
  const router = useRouter();
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  const handleCreateInvoice = async () => {
    setCreatingInvoice(true);
    try {
      const res = await apiClient.post<{ id: string }>(
        `/invoices/from-order/${order.id}`
      );
      router.push(`/invoices/${res.data.id}`);
    } catch {
      toast.error("Erreur lors de la création de la facture");
    } finally {
      setCreatingInvoice(false);
    }
  };

  // Assemblées puis confiées à `RowActions`. Les fonds pleins et saturés
  // d'origine cèdent aux variantes du système.
  const actions: RowAction[] = [
    {
      label: "Voir les détails",
      icon: <Eye className="h-3.5 w-3.5" />,
      href: `/test-orders/${order.id}/details`,
      newTab: true,
    },
  ];

  if (can(PERMISSIONS.EDIT_TEST_ORDERS)) {
    actions.push({
      label: "Mettre à jour l'examen",
      icon: <Pencil className="h-3.5 w-3.5" />,
      href: `/test-orders/${order.id}/edit`,
      newTab: true,
    });
  }

  if (order.reportId && can(PERMISSIONS.VIEW_REPORTS)) {
    actions.push({
      label: "Compte rendu",
      icon: <FileText className="h-3.5 w-3.5" />,
      href: `/reports/${order.reportId}`,
    });
  }

  if (order.invoiceId) {
    actions.push({
      label: "Voir la facture",
      icon: <Printer className="h-3.5 w-3.5" />,
      href: `/invoices/${order.invoiceId}`,
    });
  } else if (
    order.reportStatus === "VALIDATED" ||
    order.reportStatus === "DELIVERED"
  ) {
    actions.push({
      label: "Créer la facture",
      icon: creatingInvoice ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Printer className="h-3.5 w-3.5" />
      ),
      onClick: handleCreateInvoice,
      disabled: creatingInvoice,
    });
  }

  if (
    order.status !== "VALIDATED" &&
    order.status !== "DELIVERED" &&
    can(PERMISSIONS.DELETE_TEST_ORDERS)
  ) {
    actions.push({
      label: "Supprimer",
      icon: <Trash2 className="h-3.5 w-3.5" />,
      onClick: () => onDelete(order),
      variant: "delete",
    });
  }

  return <RowActions actions={actions} />;
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function TestOrdersImmunoPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Filtres (sans typeOrderId — implicite immuno)
  const [contratFilter, setContratFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [urgentFilter, setUrgentFilter] = useState("");
  const [docteurFilter, setDocteurFilter] = useState("");
  const [search, setSearch] = useState("");
  const [dateBegin, setDateBegin] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<TestOrder | null>(null);

  // --- Queries données
  const { data, isLoading } = useQuery<PageResponse<TestOrder>>({
    queryKey: [
      "test-orders-immuno",
      { page, pageSize, contratFilter, statusFilter, urgentFilter, docteurFilter, search, dateBegin, dateEnd },
    ],
    queryFn: () =>
      testOrdersApi
        .findAllImmuno({
          page,
          size: pageSize,
          contratId: contratFilter || undefined,
          status: statusFilter || undefined,
          isUrgent: urgentFilter === "1" ? true : undefined,
          attribuateDoctorId: docteurFilter || undefined,
          search: search || undefined,
          from: dateBegin || undefined,
          to: dateEnd || undefined,
        })
        .then((r) => r.data),
  });

  const { data: contractsData } = useQuery<ContractOption[]>({
    queryKey: ["contracts-filter"],
    queryFn: async () => {
      const res = await apiClient.get<PageResponse<ContractOption>>(
        "/contracts",
        { params: { size: 1000 } }
      );
      return res.data.content;
    },
  });

  // Utilisateurs ayant le rôle « Docteur » — source cohérente avec attribuateDoctorId.
  // NB : l'API /users ne filtre pas par rôle (paramètre ignoré côté backend) ; on
  // filtre donc côté client sur le nom de rôle, sinon TOUS les utilisateurs (caissiers,
  // secrétaires, comptes système…) apparaîtraient dans le sélecteur.
  const { data: doctorsData } = useQuery<DoctorOption[]>({
    queryKey: ["users-doctors"],
    queryFn: () =>
      usersApi
        .findAll({ size: 500 })
        .then((r) =>
          r.data.content
            .filter((u) =>
              (u.roles ?? []).some((role) =>
                (role.name ?? "").toLowerCase().includes("docteur")
              )
            )
            .map((u) => ({
              id: u.id,
              name: `${u.firstname} ${u.lastname}`.trim(),
            }))
        ),
  });

  // Compteurs — sur le statut du BON, comme le menu « Status » de cet écran.
  // Ils restaient à zéro sur « Livré » tant que l'historique migré de Laravel
  // n'avait pas été repris ; cf. migration V62 côté backend.
  const { data: statsLivre } = useQuery({
    queryKey: ["test-orders-immuno-stats-livre"],
    queryFn: () =>
      testOrdersApi
        .findAllImmuno({ page: 0, size: 1, status: "DELIVERED" })
        .then((r) => r.data.totalElements),
  });
  const { data: statsValide } = useQuery({
    queryKey: ["test-orders-immuno-stats-valide"],
    queryFn: () =>
      testOrdersApi
        .findAllImmuno({ page: 0, size: 1, status: "VALIDATED" })
        .then((r) => r.data.totalElements),
  });
  const { data: statsUrgent } = useQuery({
    queryKey: ["test-orders-immuno-stats-urgent"],
    queryFn: () =>
      testOrdersApi
        .findAllImmuno({ page: 0, size: 1, isUrgent: true })
        .then((r) => r.data.totalElements),
  });

  /** Applique le statut, ou le retire si le compteur cliqué est déjà actif. */
  const basculerStatut = (statut: string) => {
    setStatusFilter(statusFilter === statut ? "" : statut);
    setPage(0);
  };

  const orders = data?.content ?? [];
  const pageCount = data?.totalPages ?? 0;
  const contracts = contractsData ?? [];
  const doctors = doctorsData ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => testOrdersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-orders-immuno"] });
      toast.success("Demande supprimée avec succès");
      setDeleteTarget(null);
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la suppression"
      );
    },
  });

  // --- Colonnes (ordre exact index2.blade.php)
  const columns: ColumnDef<TestOrder>[] = [
    // 2. Date
    {
      header: "Date",
      accessorKey: "createdAt",
      cell: ({ getValue }) => formatDate(getValue<string>()),
    },
    // 3. Code
    {
      header: "Code",
      accessorKey: "code",
      cell: ({ row }) =>
        row.original.code ?? (
          <span className="whitespace-nowrap text-gray-400 italic text-xs">
            En attente
          </span>
        ),
    },
    // 4. Affecter à — dropdown docteur
    {
      header: "Affecter à",
      id: "affecter",
      cell: ({ row }) => (
        <AttribuateSelect order={row.original} doctors={doctors} />
      ),
    },
    // 5. Patient
    {
      header: "Patient",
      id: "patient",
      cell: ({ row }) =>
        `${row.original.patientFirstname} ${row.original.patientLastname}`,
    },
    // 6. Examens
    {
      header: "Examens",
      id: "tests",
      cell: ({ row }) => (
        <div className="text-xs text-gray-700 max-w-[160px]">
          {row.original.details?.length
            ? row.original.details.map((d) => (
                <div key={d.id ?? `${row.original.id}-${d.labTestId}`}>
                  {d.testName}
                </div>
              ))
            : "—"}
        </div>
      ),
    },
    // 7. Contrat
    {
      header: "Contrat",
      accessorKey: "contratName",
      cell: ({ row }) => row.original.contratName ?? "—",
    },
    // 8. Montant
    {
      header: "Montant",
      id: "amount",
      cell: ({ row }) => formatCFA(row.original.total),
    },
    // 9. Compte rendu — badge bleu "Valider" / gris "En attente"
    {
      header: "Compte rendu",
      id: "report",
      cell: ({ row }) => {
        const status = row.original.reportStatus;
        const isValidated =
          status === "VALIDATED" || status === "DELIVERED";
        return (
          <span
            className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium text-white ${
              isValidated ? "bg-blue-600" : "bg-gray-500"
            }`}
          >
            {isValidated ? "Valider" : "En attente"}
          </span>
        );
      },
    },
    // 10. Urgent — badge rouge si urgent
    {
      header: "Urgent",
      id: "urgent",
      cell: ({ row }) =>
        row.original.isUrgent ? (
          <span className="inline-flex items-center rounded-full bg-red-700 px-2 py-0.5 text-xs font-medium text-white">
            Urgent
          </span>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        ),
    },
    // Actions — DERNIÈRE colonne, comme sur les autres écrans.
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <ActionButtons order={row.original} onDelete={setDeleteTarget} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demandes d'examen IMMUNO"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Demandes d'examen IMMUNO" },
        ]}
        action={
          can(PERMISSIONS.CREATE_TEST_ORDERS) ? (
            <Link
              href="/test-orders/create"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Ajouter une nouvelle demande d&apos;examen
            </Link>
          ) : undefined
        }
      />

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

        {/* Filtres — rangée 1 (sans Type d'examen) */}
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Contrat</label>
            <NativeSelect
              value={contratFilter}
              onChange={(e) => { setContratFilter(e.target.value); setPage(0); }}
            >
              <option value="">Tous les contrats</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </NativeSelect>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
            <NativeSelect
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            >
              <option value="">Tous</option>
              <option value="VALIDATED">Validé</option>
              <option value="PENDING">En attente</option>
              <option value="DELIVERED">Livré</option>
              <option value="CANCELLED">Annulé</option>
            </NativeSelect>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Urgent</label>
            <NativeSelect
              value={urgentFilter}
              onChange={(e) => { setUrgentFilter(e.target.value); setPage(0); }}
            >
              <option value="">Tous</option>
              <option value="1">Urgent</option>
            </NativeSelect>
          </div>
        </div>

        {/* Filtres — rangée 2 */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Docteur</label>
            <NativeSelect
              value={docteurFilter}
              onChange={(e) => { setDocteurFilter(e.target.value); setPage(0); }}
            >
              <option value="">Tous</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </NativeSelect>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Rechercher</label>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Code, patient..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Date Début</label>
            <input
              type="date"
              value={dateBegin}
              onChange={(e) => { setDateBegin(e.target.value); setPage(0); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Date fin</label>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => { setDateEnd(e.target.value); setPage(0); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Compteurs cliquables. Sur cet écran ils portent sur le statut du
            BON — c'est aussi ce que filtre le menu « Status » juste au-dessus,
            contrairement à la liste générale qui, elle, filtre le rapport. Le
            chiffre correspond donc à ce que la liste montre une fois filtrée. */}
        <div className="mb-4 flex flex-wrap gap-3">
          <CompteurFiltre
            libelle="Livré"
            valeur={statsLivre}
            actif={statusFilter === "DELIVERED"}
            onClick={() => basculerStatut("DELIVERED")}
            couleur="green"
          />
          <CompteurFiltre
            libelle="Validé"
            valeur={statsValide}
            actif={statusFilter === "VALIDATED"}
            onClick={() => basculerStatut("VALIDATED")}
            couleur="yellow"
          />
          <CompteurFiltre
            libelle="Cas urgent"
            valeur={statsUrgent}
            actif={urgentFilter === "1"}
            onClick={() => {
              setUrgentFilter(urgentFilter === "1" ? "" : "1");
              setPage(0);
            }}
            couleur="red"
          />
        </div>

        {/* Tableau */}
        {/* Six actions déclarées : le tableau replie uniformément. */}
        <RowActionsProvider collapse>
          <DataTable
            columns={columns}
            data={orders}
            isLoading={isLoading}
            pageCount={pageCount}
            pageIndex={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
            rowClassName={(row) => (row.isUrgent ? "bg-red-50" : "")}
          />
        </RowActionsProvider>
      </div>

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
        title="Supprimer cette demande d'examen"
        message="La suppression d'un examen entraîne la suppression du Rapport. Voulez-vous continuer ?"
        confirmLabel="Oui"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
