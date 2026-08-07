"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, FileText, Trash2, Plus, Printer, Check, FileDown, Download, Loader2 } from "lucide-react";
import type { AxiosError } from "axios";
import type { ColumnDef } from "@tanstack/react-table";

import { toast } from "sonner";
import { DataTable } from "@/components/common/DataTable";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { FormSelect } from "@/components/ui/FormSelect";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { formatCFA, formatDate } from "@/lib/utils";
import { testOrdersApi, type TestOrder } from "@/lib/api/testOrders";
import { reportsApi } from "@/lib/api/reports";
import { typeOrdersApi, type TypeOrder } from "@/lib/api/examens";
import { usersApi } from "@/lib/api/users";
import apiClient from "@/lib/api/client";
import { openDocFile } from "@/lib/api/docs";
import type { PageResponse, ApiError } from "@/types/api";

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

interface ContractOption {
  id: string;
  name: string;
}

// Le filtre Docteur référence un utilisateur ayant le rôle docteur — même
// source que `attribuateDoctorId`.
interface DoctorOption {
  id: string;
  name: string;
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
  const queryClient = useQueryClient();
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [downloading, setDownloading] = useState(false);

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

  const deliverMutation = useMutation({
    mutationFn: () => testOrdersApi.deliver(order.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-orders"] });
      // Rafraîchit aussi la page détails éventuellement ouverte (clé ["test-order", id]).
      queryClient.invalidateQueries({ queryKey: ["test-order"] });
      toast.success("Demande marquée comme retirée");
    },
    onError: (err: AxiosError<ApiError>) =>
      toast.error(err.response?.data?.message ?? "Erreur lors du retrait"),
  });

  const handlePrint = async () => {
    if (!order.reportId) return;
    setDownloading(true);
    try {
      const res = await reportsApi.downloadPdf(order.reportId);
      const url = URL.createObjectURL(res.data as Blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {/* Voir les détails — BLEU */}
      <Link
        href={`/test-orders/${order.id}/details`}
        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        title="Voir les détails"
      >
        <Eye className="h-3.5 w-3.5" />
      </Link>

      {/* Modifier — BLEU. Masqué dès que le bon est validé/livré : le backend
          refuse la mise à jour (« Impossible de modifier un bon d'examen déjà
          validé »), le bouton ne menait donc qu'à une erreur. Même condition
          que l'action Supprimer, soumise à la même règle. */}
      {order.status !== "VALIDATED" &&
        order.status !== "DELIVERED" &&
        can(PERMISSIONS.EDIT_TEST_ORDERS) && (
        <Link
          href={`/test-orders/${order.id}/edit`}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          title="Mettre à jour l'examen"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Link>
      )}

      {/* Compte rendu — JAUNE */}
      {order.reportId && can(PERMISSIONS.VIEW_REPORTS) && (
        <Link
          href={`/reports/${order.reportId}`}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-yellow-500 text-white hover:bg-yellow-600 transition-colors"
          title="Compte rendu"
        >
          <FileText className="h-3.5 w-3.5" />
        </Link>
      )}

      {/* Marquer comme retiré — VERT (si validé mais pas encore livré) */}
      {order.reportStatus === "VALIDATED" &&
        !order.reportIsDelivered &&
        can(PERMISSIONS.EDIT_REPORTS) && (
          <button
            type="button"
            onClick={() => deliverMutation.mutate()}
            disabled={deliverMutation.isPending}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
            title="Marquer comme retiré"
          >
            {deliverMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
        )}

      {/* Imprimer le compte rendu — GRIS (si compte rendu validé/livré) */}
      {order.reportId &&
        (order.reportStatus === "VALIDATED" ||
          order.reportStatus === "DELIVERED") && (
          <button
            type="button"
            onClick={handlePrint}
            disabled={downloading}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-gray-600 text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
            title="Imprimer le compte rendu"
          >
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
          </button>
        )}

      {/* Facture — VERT */}
      {order.invoiceId ? (
        <Link
          href={`/invoices/${order.invoiceId}`}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
          title="Voir la facture"
        >
          <Printer className="h-3.5 w-3.5" />
        </Link>
      ) : order.reportStatus === "VALIDATED" ||
        order.reportStatus === "DELIVERED" ? (
        <button
          type="button"
          onClick={handleCreateInvoice}
          disabled={creatingInvoice}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
          title="Créer la facture"
        >
          {creatingInvoice ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
        </button>
      ) : null}

      {/* Supprimer — ROUGE */}
      {order.status !== "VALIDATED" &&
        order.status !== "DELIVERED" &&
        can(PERMISSIONS.DELETE_TEST_ORDERS) && (
          <button
            type="button"
            onClick={() => onDelete(order)}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
            title="Supprimer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function TestOrdersPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Filtres
  const [contratFilter, setContratFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [urgentFilter, setUrgentFilter] = useState("");
  const [docteurFilter, setDocteurFilter] = useState("");
  const [search, setSearch] = useState("");
  const [dateBegin, setDateBegin] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<TestOrder | null>(null);

  // --- Queries données
  const { data, isLoading } = useQuery<PageResponse<TestOrder>>({
    queryKey: [
      "test-orders",
      { page, pageSize, contratFilter, statusFilter, typeFilter, urgentFilter, docteurFilter, search, dateBegin, dateEnd },
    ],
    queryFn: () =>
      testOrdersApi
        .findAll({
          page,
          size: pageSize,
          contratId: contratFilter || undefined,
          reportStatus: statusFilter || undefined,
          typeOrderId: typeFilter || undefined,
          isUrgent: urgentFilter === "1" ? true : undefined,
          attribuateDoctorId: docteurFilter || undefined,
          search: search || undefined,
          from: dateBegin || undefined,
          to: dateEnd || undefined,
        })
        .then((r) => r.data),
  });

  const { data: typeOrdersData } = useQuery<TypeOrder[]>({
    queryKey: ["type-orders"],
    queryFn: () => typeOrdersApi.findAll().then((r) => r.data),
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

  // Stats globales (Livrer / Valider / Cas urgent)
  const { data: statsLivrer } = useQuery({
    queryKey: ["test-orders-stats-livrer"],
    queryFn: () =>
      testOrdersApi
        .findAll({ page: 0, size: 1, status: "DELIVERED" })
        .then((r) => r.data.totalElements),
  });
  const { data: statsValider } = useQuery({
    queryKey: ["test-orders-stats-valider"],
    queryFn: () =>
      testOrdersApi
        .findAll({ page: 0, size: 1, status: "VALIDATED" })
        .then((r) => r.data.totalElements),
  });
  const { data: statsUrgent } = useQuery({
    queryKey: ["test-orders-stats-urgent"],
    queryFn: () =>
      testOrdersApi
        .findAll({ page: 0, size: 1, isUrgent: true })
        .then((r) => r.data.totalElements),
  });

  const orders = data?.content ?? [];
  const pageCount = data?.totalPages ?? 0;
  const typeOrders = typeOrdersData ?? [];
  const contracts = contractsData ?? [];
  const doctors = doctorsData ?? [];

  // Options des filtres (react-select cherchable + limité à ~6 via le CSS global).
  const contratOptions = [
    { value: "", label: "Tous les contrats" },
    ...contracts.map((c) => ({ value: c.id, label: c.name })),
  ];
  const typeFilterOptions = [
    { value: "", label: "Tous" },
    ...typeOrders.map((t) => ({ value: t.id, label: t.title })),
  ];
  const docteurOptions = [
    { value: "", label: "Tous" },
    ...doctors.map((d) => ({ value: d.id, label: d.name })),
  ];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => testOrdersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-orders"] });
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
    // 1. Actions — PREMIÈRE colonne comme Laravel
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <ActionButtons order={row.original} onDelete={setDeleteTarget} />
      ),
    },
    // 2. Date
    {
      header: "Date",
      accessorKey: "createdAt",
      cell: ({ getValue }) => formatDate(getValue<string>()),
    },
    // 3. Code — le code du bon, et sous lui la personne à qui il est affecté.
    //
    // Réunis dans une seule colonne plutôt que séparés : le nom ne se lit que
    // rapporté au bon qu'il concerne, et une colonne de plus dans un tableau
    // déjà large se paie en largeur pour les colonnes voisines.
    {
      header: "Code",
      accessorKey: "code",
      cell: ({ row }) => {
        const affecteA = row.original.assignedUserName?.trim();
        return (
          <div className="min-w-0">
            {row.original.code ?? (
              <span className="whitespace-nowrap text-gray-400 italic text-xs">
                En attente
              </span>
            )}
            {/* Rien n'est affiché quand le bon n'est pas affecté : une mention
                « non affecté » répétée sur la moitié des lignes ferait du bruit
                là où l'absence se lit d'elle-même. */}
            {affecteA ? (
              <div
                className="mt-0.5 truncate text-xs text-gray-500"
                title={`Affecté à ${affecteA}`}
              >
                {affecteA}
              </div>
            ) : null}
          </div>
        );
      },
    },
    // 4. Patient
    {
      header: "Patient",
      id: "patient",
      cell: ({ row }) =>
        `${row.original.patientFirstname} ${row.original.patientLastname}`,
    },
    // 5. Examens — comme Laravel : titre du type d'examen (en gras) suivi des
    // analyses. Le type s'affiche même avant l'ajout d'analyses (juste après la
    // création), pour ne pas laisser la colonne vide.
    {
      header: "Examens",
      id: "tests",
      cell: ({ row }) => {
        const typeTitle =
          row.original.typeOrderTitle ??
          typeOrders.find((t) => t.id === row.original.typeOrderId)?.title ??
          "";
        const details = row.original.details ?? [];
        if (!typeTitle && details.length === 0) {
          return <span className="text-xs text-gray-500">—</span>;
        }
        return (
          <div className="text-xs text-gray-700 max-w-[160px]">
            {typeTitle && (
              <span className="font-semibold">{typeTitle}</span>
            )}
            {details.map((d) => (
              <div key={d.id ?? `${row.original.id}-${d.labTestId}`}>
                {d.testName}
              </div>
            ))}
          </div>
        );
      },
    },
    // 6. Contrat
    {
      header: "Contrat",
      accessorKey: "contratName",
      cell: ({ row }) => row.original.contratName ?? "—",
    },
    // Pièce jointe — comme Laravel : lien vers le fichier (nouvel onglet), sinon « Aucun fichier ».
    {
      header: "Pièce jointe",
      id: "archive",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.archive ? (
          <button
            type="button"
            onClick={() => openDocFile(row.original.archive!)}
            className="inline-flex items-center gap-1 text-blue-600 hover:underline"
          >
            <Download className="h-3.5 w-3.5" />
            Voir
          </button>
        ) : (
          <span className="text-xs text-gray-400">Aucun fichier</span>
        ),
    },
    // 7. Montant
    {
      header: "Montant",
      id: "amount",
      cell: ({ row }) => formatCFA(row.original.total),
    },
    // 8. Compte rendu — 4 statuts (aligné sur la page détails) :
    // Non renseigné (pas de CR) / En attente (brouillon) / Validé / Livré.
    {
      header: "Compte rendu",
      id: "report",
      cell: ({ row }) => {
        const { reportId, reportStatus, reportIsDelivered } = row.original;
        let label = "Non renseigné";
        let cls = "bg-gray-400";
        if (!reportId) {
          label = "Non renseigné";
          cls = "bg-gray-400";
        } else if (reportIsDelivered || reportStatus === "DELIVERED") {
          label = "Livré";
          cls = "bg-green-600";
        } else if (reportStatus === "VALIDATED") {
          label = "Validé";
          cls = "bg-blue-600";
        } else {
          label = "En attente";
          cls = "bg-amber-500";
        }
        return (
          <span
            className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium text-white ${cls}`}
          >
            {label}
          </span>
        );
      },
    },
    // 9. Urgent — badge rouge si urgent
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
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demandes d'examen"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Demandes d'examen" },
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

        {/* Filtres — rangée 1 */}
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Contrat</label>
            <FormSelect
              options={contratOptions}
              value={contratOptions.find((o) => o.value === contratFilter) ?? contratOptions[0]}
              onChange={(opt) => { setContratFilter(opt?.value ?? ""); setPage(0); }}
              placeholder="Tous les contrats"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
            <NativeSelect
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            >
              <option value="">Tous</option>
              <option value="NONE">Non renseigné</option>
              <option value="DRAFT">En attente</option>
              <option value="VALIDATED">Validé</option>
              <option value="DELIVERED">Livré</option>
            </NativeSelect>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Type d&apos;examen</label>
            <FormSelect
              options={typeFilterOptions}
              value={typeFilterOptions.find((o) => o.value === typeFilter) ?? typeFilterOptions[0]}
              onChange={(opt) => { setTypeFilter(opt?.value ?? ""); setPage(0); }}
              placeholder="Tous"
            />
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
            <FormSelect
              options={docteurOptions}
              value={docteurOptions.find((o) => o.value === docteurFilter) ?? docteurOptions[0]}
              onChange={(opt) => { setDocteurFilter(opt?.value ?? ""); setPage(0); }}
              placeholder="Tous"
            />
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

        {/* Barre de statistiques (Livrer / Valider / Cas urgent) */}
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="rounded-full bg-green-100 px-4 py-1.5 text-[.9rem] font-medium text-green-800 ring-1 ring-green-300">
            Livrer : {statsLivrer ?? "…"}
          </div>
          <div className="rounded-full bg-yellow-100 px-4 py-1.5 text-[.9rem] font-medium text-yellow-800 ring-1 ring-yellow-300">
            Valider : {statsValider ?? "…"}
          </div>
          <div className="rounded-full bg-red-100 px-4 py-1.5 text-[.9rem] font-medium text-red-800 ring-1 ring-red-300">
            Cas urgent : {statsUrgent ?? "…"}
          </div>
        </div>

        {/* Tableau */}
        <DataTable
          columns={columns}
          data={orders}
          isLoading={isLoading}
          pageCount={pageCount}
          pageIndex={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
          rowClassName={(row) => {
            if (row.isUrgent && !row.reportIsDelivered) return "bg-red-50";
            if (row.reportIsDelivered) return "bg-green-50";
            if (row.reportStatus === "VALIDATED") return "bg-yellow-50";
            return "";
          }}
        />
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
