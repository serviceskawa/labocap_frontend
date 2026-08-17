"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, FileText, Trash2, Plus, Printer, Check, FileDown, Loader2 } from "lucide-react";
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
import { FormSelect } from "@/components/ui/FormSelect";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { formatCFA, formatDate } from "@/lib/utils";
import { testOrdersApi, type TestOrder } from "@/lib/api/testOrders";
import { reportsApi } from "@/lib/api/reports";
import { typeOrdersApi, type TypeOrder } from "@/lib/api/examens";
import { usersApi } from "@/lib/api/users";
import apiClient from "@/lib/api/client";
import { getApiErrorMessageFromBlob } from "@/lib/api/errorMessages";
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
    // L'onglet s'ouvre AVANT l'appel : après un `await`, le navigateur a perdu
    // l'activation transitoire née du clic et bloque `window.open`. C'est le
    // défaut constaté sur les affectations — l'onglet s'ouvrait vide et la
    // navigation retombait dans la page courante.
    const onglet = window.open("", "_blank");
    // Passer « noopener » en option ferait renvoyer `null` par `window.open`,
    // par spécification : on coupe le lien vers la page d'origine après coup.
    if (onglet) onglet.opener = null;

    setCreatingInvoice(true);
    try {
      const res = await apiClient.post<{ id: string }>(
        `/invoices/from-order/${order.id}`
      );
      const url = `/invoices/${res.data.id}`;
      // Repli si un bloqueur a refusé l'onglet : mieux vaut naviguer sur place
      // que laisser l'utilisateur devant une facture créée qu'il ne voit pas.
      if (onglet) onglet.location.href = url;
      else router.push(url);
    } catch {
      onglet?.close();
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
    } catch (err) {
      toast.error(
        await getApiErrorMessageFromBlob(
          err,
          "Erreur lors de la génération du PDF",
        ),
      );
    } finally {
      setDownloading(false);
    }
  };

  // Les actions sont assemblées puis passées à `RowActions`, qui décide seul de
  // les poser à plat ou de les replier — le décompte se fait sur ce qui est
  // RÉELLEMENT permis pour cette ligne, pas sur les huit que l'écran déclare.
  //
  // Les fonds pleins et saturés d'origine (bleu, jaune, vert, gris, rouge)
  // disparaissent : huit pastilles vives par ligne faisaient de la colonne un
  // damier où la couleur ne signalait plus rien.
  const actions: RowAction[] = [
    {
      label: "Voir les détails",
      icon: <Eye className="h-3.5 w-3.5" />,
      href: `/test-orders/${order.id}/details`,
      newTab: true,
    },
  ];

  // Modifier — masqué dès que le bon est validé/livré : le backend refuse la
  // mise à jour, le bouton ne menait qu'à une erreur. Même règle que Supprimer.
  const modifiable =
    order.status !== "VALIDATED" && order.status !== "DELIVERED";

  if (modifiable && can(PERMISSIONS.EDIT_TEST_ORDERS)) {
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
      newTab: true,
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

  if (
    order.reportId &&
    (order.reportStatus === "VALIDATED" || order.reportStatus === "DELIVERED")
  ) {
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

  if (order.invoiceId) {
    actions.push({
      label: "Voir la facture",
      icon: <Printer className="h-3.5 w-3.5" />,
      href: `/invoices/${order.invoiceId}`,
      newTab: true,
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

  if (modifiable && can(PERMISSIONS.DELETE_TEST_ORDERS)) {
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

  // Compteurs — sur le statut du RAPPORT, comme le menu « Status » et la
  // pastille de la colonne Compte rendu. Ils interrogeaient le statut du BON,
  // un troisième axe qui affichait « Livrer : 0 » à côté de lignes « Livré ».
  const { data: statsLivre } = useQuery({
    queryKey: ["test-orders-stats-livre"],
    queryFn: () =>
      testOrdersApi
        .findAll({ page: 0, size: 1, reportStatus: "DELIVERED" })
        .then((r) => r.data.totalElements),
  });
  const { data: statsValide } = useQuery({
    queryKey: ["test-orders-stats-valide"],
    queryFn: () =>
      testOrdersApi
        .findAll({ page: 0, size: 1, reportStatus: "VALIDATED" })
        .then((r) => r.data.totalElements),
  });
  const { data: statsUrgent } = useQuery({
    queryKey: ["test-orders-stats-urgent"],
    queryFn: () =>
      testOrdersApi
        .findAll({ page: 0, size: 1, isUrgent: true })
        .then((r) => r.data.totalElements),
  });

  /** Applique le statut, ou le retire si le compteur cliqué est déjà actif. */
  const basculerStatut = (statut: string) => {
    setStatusFilter(statusFilter === statut ? "" : statut);
    setPage(0);
  };

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
    // 1. Date
    {
      header: "Date",
      accessorKey: "createdAt",
      cell: ({ getValue }) => formatDate(getValue<string>()),
    },
    // 2. Code — le code du bon, et sous lui la personne à qui il est affecté.
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
    // 3. Patient
    {
      header: "Patient",
      id: "patient",
      cell: ({ row }) =>
        `${row.original.patientFirstname} ${row.original.patientLastname}`,
    },
    // 4. Examens — comme Laravel : titre du type d'examen (en gras) suivi des
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
    // 5. Contrat
    {
      header: "Contrat",
      accessorKey: "contratName",
      cell: ({ row }) => row.original.contratName ?? "—",
    },
    // 6. Montant
    {
      header: "Montant",
      id: "amount",
      cell: ({ row }) => formatCFA(row.original.total),
    },
    // 7. Compte rendu — 4 statuts (aligné sur la page détails) :
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
    // Actions — DERNIÈRE colonne. Elle était en tête, héritage de Laravel.
    // Une colonne d'actions ouvre la ligne sur des commandes avant d'avoir dit
    // de quoi il s'agit : on choisit avant de lire. Elle ferme désormais la
    // ligne, comme sur les 35 autres écrans de l'application.
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

        {/* ── Compteurs, qui filtrent ────────────────────────────────────
            Ils comptent désormais sur le MÊME critère que le menu « Status »
            et que la pastille de la colonne Compte rendu : le statut du
            rapport. Ils interrogeaient jusqu'ici le statut du BON, un troisième
            axe — d'où « Livrer : 0 » affiché à côté de lignes marquées
            « Livré ». Le chiffre correspond maintenant toujours à ce que la
            liste montre une fois le filtre appliqué.

            Les libellés passent à l'indicatif : « Livrer » se lisait comme une
            consigne — les demandes À livrer — alors qu'il s'agit de celles qui
            l'ont été. */}
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
        {/* Cet écran déclare huit actions : certaines lignes dépassent le
            seuil, donc TOUTES replient. Une colonne qui alterne deux icônes,
            un menu, puis une icône déplacerait le même geste à chaque ligne. */}
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
            rowClassName={(row) => {
              if (row.isUrgent && !row.reportIsDelivered) return "bg-red-50";
              if (row.reportIsDelivered) return "bg-green-50";
              if (row.reportStatus === "VALIDATED") return "bg-yellow-50";
              return "";
            }}
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
