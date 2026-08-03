"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Eye, Plus, Printer, Lock } from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  cashboxApi,
  CashboxDailyResponseDto,
  CashboxResponseDto,
} from "@/lib/api/cashbox";
import type { ApiError } from "@/types/api";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFCFA(amount: number | null | undefined) {
  if (amount === undefined || amount === null) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Date + heure — utilisé pour l'en-tête du récap (calque du titre Laravel details).
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(status: number) {
  // Convention backend (CashboxDailyServiceImpl) : 1 = Ouverte, 0 = Clôturée.
  if (status === 1) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Ouverte
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
      Clôturée
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page — Ouverture et fermeture (réplique Laravel cashbox_daily.index)
// ---------------------------------------------------------------------------

export default function CashboxDailyPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [dateFilter, setDateFilter] = useState("");
  const [openModalOpen, setOpenModalOpen] = useState(false);
  const [openingBalance, setOpeningBalance] = useState("");
  const [cashboxId, setCashboxId] = useState("");
  const [detail, setDetail] = useState<CashboxDailyResponseDto | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["cashbox-dailies", pageIndex, pageSize, dateFilter],
    queryFn: () =>
      cashboxApi
        .getDailies({
          page: pageIndex,
          size: pageSize,
          ...(dateFilter ? { date: dateFilter } : {}),
        })
        .then((r) => r.data),
  });

  const sessions: CashboxDailyResponseDto[] = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;

  // Caisses disponibles — sert à la fois au statut Ouvert/Fermé et au choix de la
  // caisse dans la modale d'ouverture.
  const { data: cashboxes } = useQuery<CashboxResponseDto[]>({
    queryKey: ["cashboxes"],
    queryFn: () => cashboxApi.getCashboxes().then((r) => r.data.content),
  });

  // Caisse de vente « principale » — même heuristique que la page vente : parmi les
  // caisses de type "vente" (doublons possibles hérités de la migration), retenir
  // celle au solde le plus élevé (la caisse réellement active).
  const venteCashbox = (cashboxes ?? [])
    .filter((c) => c.type === "vente")
    .reduce<CashboxResponseDto | undefined>(
      (best, c) =>
        !best || Number(c.balance ?? 0) > Number(best.balance ?? 0) ? c : best,
      undefined,
    );

  // Statut = calque exact de Laravel (cashbox_daily/index.blade.php :
  // `@if ($cashboxtest->statut == 0) Ouvrir @elseif == 1 Fermer`). La source de
  // vérité est la colonne `statut` de la caisse de vente, pas les sessions.
  const isOpen = venteCashbox?.statut === 1;

  // Session à clôturer — Laravel : CashboxDaily::where('status',1)
  // ->orderBy('updated_at','desc')->first(). Sert de cible au bouton « Fermer ».
  const openSession = sessions
    .filter((d) => d.status === 1)
    .sort((a, b) =>
      (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt),
    )[0];

  const openMutation = useMutation({
    mutationFn: () =>
      cashboxApi.openDaily({
        soldeOuverture: Number(openingBalance) || 0,
        cashboxId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashbox-dailies"] });
      queryClient.invalidateQueries({ queryKey: ["cashboxes"] });
      toast.success("Caisse ouverte");
      setOpenModalOpen(false);
      setOpeningBalance("");
      setCashboxId("");
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur lors de l'ouverture"),
  });

  const handleOpenSubmit = () => {
    if (!cashboxId) {
      toast.error("Veuillez sélectionner une caisse");
      return;
    }
    openMutation.mutate();
  };

  // ---- Colonnes — ordre Laravel : Actions, ID, Code, Date d'ouverture,
  // Solde d'ouverture, Date de fermeture, Solde de fermeture, Utilisateur,
  // Écart, Statut.
  const columns: ColumnDef<CashboxDailyResponseDto>[] = [
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDetail(row.original)}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
            title="Voir le récapitulatif"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <Link
            href={`/cashbox/cashbox-daily/print/${row.original.id}`}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
            title="Imprimer"
          >
            <Printer className="h-3.5 w-3.5" />
          </Link>
        </div>
      ),
    },
    {
      header: "ID",
      id: "rownum",
      cell: ({ row }) => (
        <span className="text-xs text-gray-500">
          {pageIndex * pageSize + row.index + 1}
        </span>
      ),
    },
    {
      header: "Code",
      accessorKey: "code",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-gray-700">
          {row.original.code}
        </span>
      ),
    },
    {
      header: "Date d'ouverture",
      accessorKey: "createdAt",
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      header: "Solde d'ouverture",
      accessorKey: "openingBalance",
      cell: ({ row }) => formatFCFA(row.original.openingBalance),
    },
    {
      header: "Date de fermeture",
      id: "closedAt",
      cell: ({ row }) =>
        row.original.status === 1 || !row.original.updatedAt ? (
          <span className="text-xs text-gray-400">Non disponible</span>
        ) : (
          formatDate(row.original.updatedAt)
        ),
    },
    {
      header: "Solde de fermeture",
      accessorKey: "closingBalance",
      cell: ({ row }) => formatFCFA(row.original.closingBalance),
    },
    {
      header: "Utilisateur",
      accessorKey: "userName",
      cell: ({ row }) => (
        <span className="text-sm text-gray-700">
          {row.original.userName ?? "—"}
        </span>
      ),
    },
    {
      header: "Écart",
      accessorKey: "totalEcart",
      cell: ({ row }) => {
        const ecart = row.original.totalEcart;
        if (ecart === null || ecart === undefined)
          return <span className="text-gray-400">—</span>;
        return (
          <span
            className={ecart < 0 ? "font-medium text-red-600" : "text-gray-700"}
          >
            {formatFCFA(ecart)}
          </span>
        );
      },
    },
    {
      header: "Statut",
      accessorKey: "status",
      cell: ({ row }) => statusBadge(row.original.status),
    },
  ];

  // ---- Render ----
  return (
    <PermissionGate
      permission={PERMISSIONS.VIEW_CASHBOX_DAILIES}
      fallback={
        <div className="flex h-64 items-center justify-center text-sm text-gray-500">
          Vous n&apos;avez pas accès à l&apos;historique des sessions.
        </div>
      }
    >
      <div className="space-y-6">
        <PageHeader
          title="Ouverture et fermeture (Caisse de vente)"
          subtitle="Historique des ouvertures et fermetures de caisse"
          breadcrumbs={[
            { label: "Trésorerie" },
            { label: "Caisse de vente", href: "/cashbox/vente" },
            { label: "Ouverture et fermeture" },
          ]}
          action={
            isOpen && openSession ? (
              <PermissionGate permission={PERMISSIONS.EDIT_CASHBOX_DAILIES}>
                <Link
                  href={`/cashbox/cashbox-daily/fermeture/${openSession.id}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
                >
                  <Lock className="h-4 w-4" />
                  Fermer la caisse
                </Link>
              </PermissionGate>
            ) : can(PERMISSIONS.CREATE_CASHBOX_DAILIES) ? (
              <button
                type="button"
                onClick={() => setOpenModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Ouvrir la caisse
              </button>
            ) : undefined
          }
        />

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          {/* Filtre date */}
          <div className="mb-4 flex items-center gap-3">
            <label
              htmlFor="date-filter"
              className="text-sm font-medium text-gray-700"
            >
              Filtrer par date :
            </label>
            <input
              id="date-filter"
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPageIndex(0);
              }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-[.9rem] shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {dateFilter && (
              <button
                onClick={() => {
                  setDateFilter("");
                  setPageIndex(0);
                }}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Réinitialiser
              </button>
            )}
          </div>

          <DataTable
            columns={columns}
            data={sessions}
            isLoading={isLoading}
            pageCount={totalPages}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPageChange={setPageIndex}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPageIndex(0);
            }}
          />
        </div>

        {/* Modal ouverture de session */}
        <CrudModal
          isOpen={openModalOpen}
          onClose={() => setOpenModalOpen(false)}
          title="Ouverture de la caisse de vente"
          onSubmit={handleOpenSubmit}
          submitLabel="Valider"
          isSubmitting={openMutation.isPending}
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-500">
              Veuillez entrer le montant du fond de caisse.
            </p>
            <FormField label="Caisse" required>
              <NativeSelect
                value={cashboxId}
                onChange={(e) => setCashboxId(e.target.value)}
              >
                <option value="">Sélectionner une caisse…</option>
                {(cashboxes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name?.trim() ||
                      (c.type === "vente"
                        ? "Caisse de vente"
                        : c.type === "depense"
                          ? "Caisse de dépense"
                          : "Caisse")}
                  </option>
                ))}
              </NativeSelect>
            </FormField>

            <FormField label="Fond de caisse (Espèces)">
              <input
                type="number"
                min={0}
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0.0 Francs CFA"
                className={inputClass}
              />
            </FormField>
          </div>
        </CrudModal>

        {/* Modal récapitulatif (lecture seule) — écran Laravel details */}
        {detail && (
          <RecapModal daily={detail} onClose={() => setDetail(null)} />
        )}
      </div>
    </PermissionGate>
  );
}

// ---------------------------------------------------------------------------
// Modal récapitulatif — 6 colonnes (réplique cashbox_daily.details)
// ---------------------------------------------------------------------------

function RecapModal({
  daily,
  onClose,
}: {
  daily: CashboxDailyResponseDto;
  onClose: () => void;
}) {
  const opening = daily.openingBalance ?? 0;
  const cashCalc = daily.cashCalculated ?? 0;
  const soldeEspeces = opening + cashCalc;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            {daily.code} — {formatDateTime(daily.createdAt)}
            {daily.updatedAt ? ` → ${formatDateTime(daily.updatedAt)}` : ""}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-4">Mode de paiement</th>
                  <th className="py-2 pr-4 text-right">Fond initial</th>
                  <th className="py-2 pr-4 text-right">Vente</th>
                  <th className="py-2 pr-4 text-right">Solde</th>
                  <th className="py-2 pr-4 text-right">Comptage</th>
                  <th className="py-2 text-right">Écart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <RecapRow
                  label="Espèces"
                  fond={formatFCFA(opening)}
                  vente={formatFCFA(cashCalc)}
                  solde={formatFCFA(soldeEspeces)}
                  comptage={formatFCFA(daily.cashConfirmation)}
                  ecart={daily.cashEcart}
                />
                <RecapRow
                  label="Mobile Money"
                  fond="-"
                  vente={formatFCFA(daily.mobileMoneyCalculated)}
                  solde="-"
                  comptage={formatFCFA(daily.moneyMoneyConfirmation)}
                  ecart={daily.mobileMoneyEcart}
                />
                <RecapRow
                  label="Chèque"
                  fond="-"
                  vente={formatFCFA(daily.chequeCalculated)}
                  solde="-"
                  comptage={formatFCFA(daily.chequeConfirmation)}
                  ecart={daily.chequeEcart}
                />
                <RecapRow
                  label="Virement"
                  fond="-"
                  vente={formatFCFA(daily.virementCalculated)}
                  solde="-"
                  comptage={formatFCFA(daily.virementConfirmation)}
                  ecart={daily.virementEcart}
                />
                <tr className="border-t-2 border-gray-300 font-semibold">
                  <td className="py-2 pr-4 text-gray-800">Total</td>
                  <td className="py-2 pr-4 text-right text-gray-800">
                    {formatFCFA(opening)}
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-800">
                    {formatFCFA(daily.totalCalculated)}
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-800">
                    {formatFCFA(soldeEspeces)}
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-800">
                    {formatFCFA(daily.totalConfirmation)}
                  </td>
                  <td
                    className={`py-2 text-right ${
                      (daily.totalEcart ?? 0) !== 0
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    {formatFCFA(daily.totalEcart)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Commentaire de clôture (calque details.blade). */}
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-gray-600">
              Commentaire
            </label>
            <input
              value={daily.description ?? ""}
              readOnly
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <p className="mt-6 text-right text-lg font-bold text-gray-900">
            SOLDE DE FERMETURE : {formatFCFA(daily.closingBalance)}
          </p>
        </div>
        <div className="flex justify-end border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function RecapRow({
  label,
  fond,
  vente,
  solde,
  comptage,
  ecart,
}: {
  label: string;
  fond: string;
  vente: string;
  solde: string;
  comptage: string;
  ecart: number | null;
}) {
  return (
    <tr>
      <td className="py-2 pr-4 text-gray-700">{label}</td>
      <td className="py-2 pr-4 text-right text-gray-700">{fond}</td>
      <td className="py-2 pr-4 text-right text-gray-700">{vente}</td>
      <td className="py-2 pr-4 text-right text-gray-700">{solde}</td>
      <td className="py-2 pr-4 text-right text-gray-700">{comptage}</td>
      <td
        className={`py-2 text-right font-medium ${
          (ecart ?? 0) !== 0 ? "text-red-600" : "text-green-600"
        }`}
      >
        {formatFCFA(ecart)}
      </td>
    </tr>
  );
}
