"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Eye, FileDown, FileText, Loader2, Trash2 } from "lucide-react";
import type { AxiosError } from "axios";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";

import { DataTable } from "@/components/common/DataTable";
import {
  RowActions,
  RowActionsProvider,
  type RowAction,
} from "@/components/ui/RowActions";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { StatCard } from "@/components/ui/StatCard";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { formatDate } from "@/lib/utils";
import {
  testOrdersApi,
  type TestOrder,
  type MySpaceStats,
} from "@/lib/api/testOrders";
import { reportsApi } from "@/lib/api/reports";
import { typeOrdersApi, type TypeOrder } from "@/lib/api/examens";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { PageResponse, ApiError } from "@/types/api";

// ---------------------------------------------------------------------------
// Classe CSS de ligne (réplique Laravel : urgent rouge / validé-non-livré
// orange / livré vert)
// ---------------------------------------------------------------------------

function rowClass(order: TestOrder): string {
  if (order.isUrgent && !order.reportIsDelivered) return "bg-red-50";
  if (order.reportIsDelivered) return "bg-green-50";
  if (order.reportStatus === "VALIDATED") return "bg-yellow-50";
  return "";
}

// ---------------------------------------------------------------------------
// Boutons d'action par ligne (réplique Laravel myspace)
// ---------------------------------------------------------------------------

function ActionButtons({
  order,
  onDelete,
}: {
  order: TestOrder;
  onDelete: (order: TestOrder) => void;
}) {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [downloading, setDownloading] = useState(false);

  const deliverMutation = useMutation({
    mutationFn: () => testOrdersApi.deliver(order.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myspace-pending"] });
      queryClient.invalidateQueries({ queryKey: ["myspace-done"] });
      queryClient.invalidateQueries({ queryKey: ["myspace-stats"] });
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

  const isValidated =
    order.reportStatus === "VALIDATED" || order.reportStatus === "DELIVERED";

  const actions: RowAction[] = [
    {
      label: "Voir les détails",
      icon: <Eye className="h-3.5 w-3.5" />,
      href: `/test-orders/${order.id}/details`,
      newTab: true,
    },
  ];

  if (can(PERMISSIONS.VIEW_REPORTS)) {
    actions.push({
      label: "Compte rendu",
      icon: <FileText className="h-3.5 w-3.5" />,
      href: order.reportId
        ? `/reports/${order.reportId}`
        : `/test-orders/${order.id}/details`,
    });
  }

  if (
    order.reportStatus === "VALIDATED" &&
    !order.reportIsDelivered &&
    can(PERMISSIONS.EDIT_REPORTS)
  ) {
    actions.push({
      label: "Marquer comme retiré",
      icon: deliverMutation.isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Check className="h-3.5 w-3.5" />
      ),
      onClick: () => deliverMutation.mutate(),
      disabled: deliverMutation.isPending,
    });
  }

  if (order.reportId && isValidated) {
    actions.push({
      label: "Imprimer le compte rendu",
      icon: downloading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <FileDown className="h-3.5 w-3.5" />
      ),
      onClick: handlePrint,
      disabled: downloading,
      variant: "secondary",
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
// Badge "Compte rendu" (réplique Laravel : Valider / En attente / Non enregistré)
// ---------------------------------------------------------------------------

function ReportBadge({ order }: { order: TestOrder }) {
  if (!order.reportId) {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-full bg-gray-300 px-2 py-0.5 text-xs font-medium text-gray-700">
        Non enregistré
      </span>
    );
  }
  const isValidated =
    order.reportStatus === "VALIDATED" || order.reportStatus === "DELIVERED";
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium text-white ${
        isValidated ? "bg-blue-600" : "bg-gray-500"
      }`}
    >
      {isValidated ? "Valider" : "En attente"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Carte de section
// ---------------------------------------------------------------------------

/**
 * Le gabarit Hyper posait ici un trio d'icônes « réactualiser · réduire ·
 * fermer ». Il a été retiré comme sur les autres tableaux de l'application :
 * sans utilité (les listes se rafraîchissent seules), et « fermer » faisait
 * disparaître une section sans moyen de la rétablir autrement qu'en rechargeant
 * la page.
 */
function WidgetCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-gray-800">{title}</h2>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MySpacePage() {
  const { user } = useCurrentUser();

  // ---- Filtres — en attente
  const [pendingTypeOrderId, setPendingTypeOrderId] = useState("");
  const [pendingPriority, setPendingPriority] = useState("");
  const [pendingPage, setPendingPage] = useState(0);
  const [pendingPageSize, setPendingPageSize] = useState(10);

  // ---- Filtres — terminées (terminé = VALIDATED + DELIVERED)
  const [doneTypeOrderId, setDoneTypeOrderId] = useState("");
  // "" = toutes les terminées (rapport validé ou livré) ; "DELIVERED" = livrées uniquement
  const [doneStatus, setDoneStatus] = useState("");
  const [doneFrom, setDoneFrom] = useState("");
  const [doneTo, setDoneTo] = useState("");
  const [donePage, setDonePage] = useState(0);
  const [donePageSize, setDonePageSize] = useState(10);

  const [deleteTarget, setDeleteTarget] = useState<TestOrder | null>(null);
  const queryClient = useQueryClient();

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  const { data: stats, isLoading: statsLoading } = useQuery<MySpaceStats>({
    queryKey: ["myspace-stats"],
    queryFn: () => testOrdersApi.getMySpace().then((r) => r.data),
  });

  const { data: typeOrdersData } = useQuery<TypeOrder[]>({
    queryKey: ["type-orders-all"],
    queryFn: () => typeOrdersApi.findAll().then((r) => r.data),
  });
  const typeOrders: TypeOrder[] = typeOrdersData ?? [];

  const {
    data: pendingData,
    isLoading: pendingLoading,
  } = useQuery<PageResponse<TestOrder>>({
      queryKey: [
        "myspace-pending",
        {
          typeOrderId: pendingTypeOrderId,
          priority: pendingPriority,
          page: pendingPage,
          size: pendingPageSize,
        },
      ],
      queryFn: () =>
        testOrdersApi
          .getMyOrders({
            status: "PENDING",
            typeOrderId: pendingTypeOrderId || undefined,
            priority: pendingPriority || undefined,
            page: pendingPage,
            size: pendingPageSize,
          })
          .then((r) => r.data),
    });

  // "terminées" = rapport terminé. status "VALIDATED" côté API Mon espace renvoie
  // les rapports validés ET livrés ; "DELIVERED" restreint aux livrés.
  const {
    data: doneData,
    isLoading: doneLoading,
  } = useQuery<PageResponse<TestOrder>>({
      queryKey: [
        "myspace-done",
        {
          typeOrderId: doneTypeOrderId,
          status: doneStatus,
          from: doneFrom,
          to: doneTo,
          page: donePage,
          size: donePageSize,
        },
      ],
      queryFn: () =>
        testOrdersApi
          .getMyOrders({
            status: doneStatus === "DELIVERED" ? "DELIVERED" : "VALIDATED",
            typeOrderId: doneTypeOrderId || undefined,
            from: doneFrom || undefined,
            to: doneTo || undefined,
            page: donePage,
            size: donePageSize,
          })
          .then((r) => r.data),
    });

  const pendingOrders: TestOrder[] = pendingData?.content ?? [];
  const doneOrders: TestOrder[] = doneData?.content ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => testOrdersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myspace-pending"] });
      queryClient.invalidateQueries({ queryKey: ["myspace-done"] });
      queryClient.invalidateQueries({ queryKey: ["myspace-stats"] });
      toast.success("Demande supprimée avec succès");
      setDeleteTarget(null);
    },
    onError: (err: AxiosError<ApiError>) =>
      toast.error(err.response?.data?.message ?? "Erreur lors de la suppression"),
  });

  // ---------------------------------------------------------------------------
  // Colonnes DataTable (réplique Laravel myspace)
  // ---------------------------------------------------------------------------

  const buildColumns = (): ColumnDef<TestOrder>[] => [
    {
      header: "Date",
      id: "date",
      cell: ({ row }) =>
        row.original.prelevementDate
          ? formatDate(row.original.prelevementDate)
          : formatDate(row.original.createdAt),
    },
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
    {
      header: "Patient",
      id: "patient",
      cell: ({ row }) =>
        `${row.original.patientFirstname} ${row.original.patientLastname}`,
    },
    {
      header: "Examens",
      id: "examens",
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
    {
      header: "Contrat",
      id: "contrat",
      cell: ({ row }) => row.original.contratName ?? "—",
    },
    {
      header: "Compte rendu",
      id: "report",
      cell: ({ row }) => <ReportBadge order={row.original} />,
    },
    {
      header: "Urgent",
      id: "urgent",
      cell: ({ row }) =>
        row.original.isUrgent ? (
          <span className="inline-flex items-center rounded-full bg-red-700 px-2 py-0.5 text-xs font-medium text-white">
            Oui
          </span>
        ) : (
          <span className="text-gray-400 text-xs">Non</span>
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

  const pendingColumns = buildColumns();
  const doneColumns = buildColumns();

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const fullName = user
    ? `${user.firstname ?? ""} ${user.lastname ?? ""}`.trim()
    : "";

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Mon espace [ ${fullName} ]`}
        breadcrumbs={[{ label: "Mon espace" }]}
      />

      {/* =================================================================
          KPI widgets (réplique Laravel : 6 cartes)
      ================================================================= */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          title="DEMANDES AFFECTÉES"
          value={statsLoading ? "…" : stats?.totalAssigned ?? 0}
        />
        <StatCard
          title="DEMANDES EN ATTENTE"
          value={statsLoading ? "…" : stats?.totalPending ?? 0}
        />
        <StatCard
          title="DEMANDES TERMINÉES"
          value={statsLoading ? "…" : stats?.totalValidated ?? 0}
        />
        <StatCard
          title="IMMUNOS EN ATTENTE"
          value={statsLoading ? "…" : stats?.totalImmunoPending ?? 0}
          valueClassName="text-red-600"
        />
        <StatCard
          title="DEMANDES URGENTES"
          value={statsLoading ? "…" : stats?.totalUrgent ?? 0}
          valueClassName="text-red-600"
        />
        <StatCard
          title="DEMANDES EN RETARD"
          value={statsLoading ? "…" : stats?.totalLate ?? 0}
          valueClassName="text-red-600"
        />
      </div>

      {/* =================================================================
          DataTable 1 — Demandes en attente
      ================================================================= */}
      <WidgetCard title="Liste des demandes en attente">
        <div className="flex flex-wrap gap-3 mb-4">
          <NativeSelect
            value={pendingTypeOrderId}
            onChange={(e) => {
              setPendingTypeOrderId(e.target.value);
              setPendingPage(0);
            }}
          >
            <option value="">Tous les types</option>
            {typeOrders.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </NativeSelect>

          <NativeSelect
            value={pendingPriority}
            onChange={(e) => {
              setPendingPriority(e.target.value);
              setPendingPage(0);
            }}
          >
            <option value="">Toutes priorités</option>
            <option value="urgent">Urgent</option>
            <option value="late">Retard</option>
          </NativeSelect>
        </div>

        {/* Cinq actions déclarées : le tableau replie uniformément. */}
        <RowActionsProvider collapse>
          <DataTable<TestOrder>
            columns={pendingColumns}
            data={pendingOrders}
            isLoading={pendingLoading}
            hideToolbar
            pageCount={pendingData?.totalPages ?? 0}
            pageIndex={pendingPage}
            pageSize={pendingPageSize}
            onPageChange={setPendingPage}
            onPageSizeChange={(size) => {
              setPendingPageSize(size);
              setPendingPage(0);
            }}
            rowClassName={rowClass}
          />
        </RowActionsProvider>
      </WidgetCard>

      {/* =================================================================
          DataTable 2 — Demandes terminées
      ================================================================= */}
      <WidgetCard title="Liste des demandes terminées">
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Type d&apos;examen
            </label>
            <NativeSelect
              value={doneTypeOrderId}
              onChange={(e) => {
                setDoneTypeOrderId(e.target.value);
                setDonePage(0);
              }}
            >
              <option value="">Tous les types</option>
              {typeOrders.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Statut
            </label>
            <NativeSelect
              value={doneStatus}
              onChange={(e) => {
                setDoneStatus(e.target.value);
                setDonePage(0);
              }}
            >
              <option value="">Toutes les terminées</option>
              <option value="DELIVERED">Livrées uniquement</option>
            </NativeSelect>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Date de début
            </label>
            <input
              type="date"
              value={doneFrom}
              onChange={(e) => {
                setDoneFrom(e.target.value);
                setDonePage(0);
              }}
              aria-label="Date de début"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Date de fin
            </label>
            <input
              type="date"
              value={doneTo}
              onChange={(e) => {
                setDoneTo(e.target.value);
                setDonePage(0);
              }}
              aria-label="Date de fin"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <DataTable<TestOrder>
          columns={doneColumns}
          data={doneOrders}
          isLoading={doneLoading}
          hideToolbar
          pageCount={doneData?.totalPages ?? 0}
          pageIndex={donePage}
          pageSize={donePageSize}
          onPageChange={setDonePage}
          onPageSizeChange={(size) => {
            setDonePageSize(size);
            setDonePage(0);
          }}
          rowClassName={rowClass}
        />
      </WidgetCard>

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        title="Supprimer cette demande d'examen"
        message="La suppression d'un examen entraîne la suppression du Rapport. Voulez-vous continuer ?"
        confirmLabel="Oui"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
