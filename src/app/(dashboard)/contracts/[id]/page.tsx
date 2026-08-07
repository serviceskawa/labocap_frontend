"use client";

import { formatCFA } from "@/lib/utils";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Pencil,
  Trash2,
  ArrowLeft,
  FileText,
  ClipboardList,
  CalendarDays,
  Receipt,
  Tag,
  Ban,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import type { AxiosError } from "axios";

import { NativeSelect } from "@/components/ui/NativeSelect";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import {
  TableLengthControl,
  TablePaginationFooter,
  useTablePagination,
} from "@/components/common/TablePagination";
import { FormField } from "@/components/ui/FormField";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { contractsApi, type ContractDetail } from "@/lib/api/contracts";
import { labTestsApi } from "@/lib/api/examens";
import type { ApiError } from "@/types/api";
import { getApiErrorMessage } from "@/lib/api/errorMessages";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(s?: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-FR");
}

function formatAmount(v?: number | null) {
  if (v == null) return "—";
  return formatCFA(v);
}


// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ContractDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = use(paramsPromise);
  const contractId = params.id;

  const router = useRouter();
  const queryClient = useQueryClient();

  // Formulaire « Ajouter des examens » (inline, comme dans la vue Laravel)
  const [testId, setTestId] = useState("");
  const [remise, setRemise] = useState("");

  const [deleteDetail, setDeleteDetail] = useState<ContractDetail | null>(null);
  const [editDetail, setEditDetail] = useState<ContractDetail | null>(null);
  const [editRemise, setEditRemise] = useState("");

  // ---- Queries -------------------------------------------------------------

  const { data: contract, isLoading } = useQuery({
    queryKey: ["contract", contractId],
    queryFn: () => contractsApi.findById(contractId).then((r) => r.data),
  });

  const { data: examensData } = useQuery({
    queryKey: ["examens-all"],
    // 279 examens en base : on charge tout (l'API n'expose pas de recherche
    // serveur ici), sinon les derniers seraient introuvables.
    queryFn: () => labTestsApi.findAll({ size: 1000 }).then((r) => r.data),
  });

  const examens = examensData?.content ?? [];

  // Prix dérivé de l'examen sélectionné (auto-remplissage, comme dans Laravel).
  const price = examens.find((e) => e.id === testId)?.price ?? 0;

  const remiseNum = Number(remise) || 0;
  const total = price - remiseNum;

  const editRemiseNum = Number(editRemise) || 0;
  const editTotal = (editDetail?.price ?? 0) - editRemiseNum;

  // ---- Mutations -----------------------------------------------------------

  const addTestMutation = useMutation({
    mutationFn: () =>
      contractsApi.addTestDetail(contractId, {
        testId,
        amountRemise: remiseNum,
        amountAfterRemise: total,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      toast.success("Donnée ajoutée avec succès");
      setTestId("");
      setRemise("");
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(getApiErrorMessage(e, "Erreur")),
  });

  const updateDetailMutation = useMutation({
    mutationFn: () =>
      contractsApi.updateTestDetail(contractId, editDetail!.id, {
        amountRemise: editRemiseNum,
        amountAfterRemise: editTotal,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      toast.success("Ligne mise à jour");
      setEditDetail(null);
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(getApiErrorMessage(e, "Erreur")),
  });

  const deleteDetailMutation = useMutation({
    mutationFn: (detailId: string) =>
      contractsApi.deleteDetail(contractId, detailId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      toast.success("Ligne supprimée");
      setDeleteDetail(null);
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(getApiErrorMessage(e, "Erreur")),
  });

  const activateMutation = useMutation({
    mutationFn: () => contractsApi.activate(contractId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      toast.success("Contrat activé");
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(getApiErrorMessage(e, "Erreur")),
  });

  const closeMutation = useMutation({
    mutationFn: () => contractsApi.close(contractId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      toast.success("Contrat clôturé");
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(getApiErrorMessage(e, "Erreur")),
  });

  // « Sauvegarder » = mise à jour du statut à ACTIF puis retour à la liste
  // (équivalent Laravel contrat_details.update-status).
  const saveMutation = useMutation({
    mutationFn: () => contractsApi.activate(contractId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      toast.success("Statut mis à jour !");
      router.push("/contracts");
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(getApiErrorMessage(e, "Erreur")),
  });

  // Pagination du tableau « Examens prises en compte ». Appelée avant les
  // retours anticipés ci-dessous : un hook ne peut pas être conditionnel.
  const detailsPagination = useTablePagination(contract?.details ?? []);

  // ---- Render --------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Contrat introuvable</p>
      </div>
    );
  }

  const details = contract.details ?? [];
  const isClose = contract.isClose === true;
  const used = contract.usedTestsCount ?? 0;
  const invoice = contract.invoice ?? null;
  const showInvoiceCard = contract.invoiceUnique === true && invoice != null;

  const totalPrice = details.reduce((s, d) => s + (d.price ?? 0), 0);
  const totalRemise = details.reduce((s, d) => s + (d.amountRemise ?? 0), 0);
  const totalAfter = details.reduce((s, d) => s + (d.amountAfterRemise ?? 0), 0);

  const statusMeta = isClose
    ? {
        label: "Clôturé",
        badge: "bg-gray-100 text-gray-700 ring-gray-500/30",
        dot: "bg-gray-400",
      }
    : contract.status === "ACTIF"
    ? {
        label: "Actif",
        badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/30",
        dot: "bg-emerald-500",
      }
    : {
        label: "Inactif",
        badge: "bg-amber-50 text-amber-700 ring-amber-600/30",
        dot: "bg-amber-500",
      };

  const examensLabel =
    contract.nbrTests === -1 ? `${used} / Illimité` : `${used} / ${contract.nbrTests}`;

  return (
    <div className="space-y-6">
      {/* Fil d'Ariane + retour */}
      <Link
        href="/contracts"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à la liste des contrats
      </Link>

      {/* ============ En-tête du contrat ============ */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-sm">
        <div className="flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/20">
              <FileText className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-blue-100">
                Contrat
              </p>
              <h1 className="truncate text-xl font-bold text-white sm:text-2xl">
                {contract.name ?? "—"}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-blue-100">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusMeta.badge}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
                  {isClose
                    ? `Clôturé le ${formatDate(contract.updatedAt)}`
                    : statusMeta.label}
                </span>
                {contract.clientName && (
                  <span className="inline-flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" />
                    {contract.clientName}
                  </span>
                )}
              </div>
            </div>
          </div>

          <PermissionGate permission={PERMISSIONS.EDIT_CONTRACTS}>
            <div className="flex flex-shrink-0 items-center gap-2">
              {contract.status === "ACTIF" && !isClose && (
                <button
                  type="button"
                  onClick={() => closeMutation.mutate()}
                  disabled={closeMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-[.9rem] font-medium text-white ring-1 ring-inset ring-white/25 transition-colors hover:bg-white/25 disabled:opacity-50"
                >
                  {closeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                  Clôturer
                </button>
              )}
              {contract.status === "INACTIF" && !isClose && (
                <button
                  type="button"
                  onClick={() => activateMutation.mutate()}
                  disabled={activateMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[.9rem] font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50"
                >
                  {activateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Activer
                </button>
              )}
            </div>
          </PermissionGate>
        </div>
      </div>

      {/* ============ Tuiles récapitulatives ============ */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={<ClipboardList className="h-5 w-5" />}
          tint="text-blue-600 bg-blue-50"
          label="Nombre d'examens"
          value={examensLabel}
        />
        <StatTile
          icon={<Tag className="h-5 w-5" />}
          tint="text-violet-600 bg-violet-50"
          label="Type"
          value={contract.type ?? "—"}
        />
        <StatTile
          icon={
            <span className={`h-2.5 w-2.5 rounded-full ${statusMeta.dot}`} />
          }
          tint="text-gray-600 bg-gray-100"
          label="Statut"
          value={statusMeta.label}
        />
        <StatTile
          icon={<CalendarDays className="h-5 w-5" />}
          tint="text-emerald-600 bg-emerald-50"
          label="Date de création"
          value={formatDate(contract.createdAt)}
        />
      </div>

      {/* ============ Détails / Facture ============ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* --- Informations du contrat --- */}
        <div className={`rounded-xl border border-gray-200 bg-white shadow-sm ${showInvoiceCard ? "lg:col-span-2" : "lg:col-span-3"}`}>
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
            <FileText className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">
              Informations du contrat
            </h2>
          </div>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 px-5 py-5 sm:grid-cols-2">
            <InfoRow label="Nom du contrat" value={contract.name ?? "—"} />
            <InfoRow label="Type" value={contract.type ?? "—"} />
            <InfoRow label="Client" value={contract.clientName ?? "—"} />
            <InfoRow label="Nombre d'examens" value={examensLabel} />
            <InfoRow label="Date de création" value={formatDate(contract.createdAt)} />
            <InfoRow
              label="Statut"
              value={
                isClose
                  ? `Clôturé le ${formatDate(contract.updatedAt)}`
                  : statusMeta.label
              }
            />
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Description
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                {contract.description || "—"}
              </dd>
            </div>
          </dl>
        </div>

        {/* --- Carte Facture (facturation unique + facture existante) --- */}
        {showInvoiceCard && (
          <div className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900">Facture</h2>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                  invoice!.isPaid
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-600/30"
                    : "bg-amber-50 text-amber-700 ring-amber-600/30"
                }`}
              >
                {invoice!.isPaid ? "Payé" : "Non payé"}
              </span>
            </div>

            <div className="flex-1 space-y-4 px-5 py-5">
              {invoice!.code && (
                <InfoRow label="Code" value={invoice!.code} />
              )}
              <InfoRow label="Client" value={contract.clientName ?? "—"} />
              <InfoRow
                label="Statut de paiement"
                value={
                  invoice!.isPaid
                    ? `Payé le ${formatDate(invoice!.paidAt)}`
                    : "Non payé"
                }
              />
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Total
                </dt>
                <dd className="mt-1 text-lg font-bold text-gray-900">
                  {formatAmount(invoice!.total)}
                </dd>
              </div>
            </div>

            <div className="border-t border-gray-100 px-5 py-4">
              <Link
                href={`/invoices/${invoice!.id}`}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-[.9rem] font-medium text-white transition-colors hover:bg-gray-800"
              >
                Voir la facture
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ============ Ajouter des examens (formulaire inline) ============ */}
      {!isClose && (
        <PermissionGate permission={PERMISSIONS.EDIT_CONTRACTS}>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-gray-900">
              Ajouter des examens
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!testId) {
                  toast.error("Veuillez sélectionner un examen");
                  return;
                }
                addTestMutation.mutate();
              }}
              autoComplete="off"
              className="grid grid-cols-1 items-end gap-4 md:grid-cols-12"
            >
              <div className="md:col-span-4">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Examen
                </label>
                <NativeSelect
                  value={testId}
                  onChange={(e) => setTestId(e.target.value)}
                  required
                >
                  <option value="">Sélectionner l&apos;examen</option>
                  {examens.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Prix
                </label>
                <input
                  type="text"
                  value={price}
                  readOnly
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Remise
                </label>
                <input
                  type="number"
                  value={remise}
                  onChange={(e) => setRemise(e.target.value)}
                  min={0}
                  required
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Total
                </label>
                <input
                  type="text"
                  value={total}
                  readOnly
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={addTestMutation.isPending}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {addTestMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </PermissionGate>
      )}

      {/* ============ Examens prises en compte ============ */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            Examens prises en compte
          </h2>
        </div>

        <div className="px-5 pt-4">
          <TableLengthControl pagination={detailsPagination} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Nom examen
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Prix
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Réduction
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Total
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {details.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    Aucun examen pris en compte
                  </td>
                </tr>
              ) : (
                detailsPagination.pageRows.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-900">
                      {d.labTestName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {formatAmount(d.price)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {formatAmount(d.amountRemise)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatAmount(d.amountAfterRemise)}
                    </td>
                    <td className="px-4 py-3">
                      <PermissionGate permission={PERMISSIONS.EDIT_CONTRACTS}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditDetail(d);
                              setEditRemise(String(d.amountRemise ?? ""));
                            }}
                            className="inline-flex items-center justify-center rounded p-1.5 text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Modifier la réduction"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteDetail(d)}
                            className="inline-flex items-center justify-center rounded p-1.5 text-red-600 hover:bg-red-50 transition-colors"
                            title="Supprimer cette ligne"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </PermissionGate>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {details.length > 0 && (
              <tfoot className="border-t-2 border-gray-100 bg-gray-50">
                <tr className="text-sm font-semibold text-gray-900">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right">{formatAmount(totalPrice)}</td>
                  <td className="px-4 py-3 text-right">{formatAmount(totalRemise)}</td>
                  <td className="px-4 py-3 text-right">{formatAmount(totalAfter)}</td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="px-5 pb-4">
          <TablePaginationFooter pagination={detailsPagination} />
        </div>

        {!isClose && (
          <PermissionGate permission={PERMISSIONS.EDIT_CONTRACTS}>
            <div className="px-5 py-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={details.length === 0 || saveMutation.isPending}
                className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Sauvegarder
              </button>
            </div>
          </PermissionGate>
        )}
      </div>

      {/* ============ Modales ============ */}

      {/* Modifier la réduction d'une ligne */}
      <CrudModal
        isOpen={editDetail !== null}
        onClose={() => setEditDetail(null)}
        title="Modifier la réduction"
        onSubmit={() => updateDetailMutation.mutate()}
        submitLabel="Enregistrer"
        isSubmitting={updateDetailMutation.isPending}
      >
        <div className="flex flex-col gap-4">
          <FormField label="Examen">
            <input
              type="text"
              value={editDetail?.labTestName ?? ""}
              readOnly
              className={inputClass}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Prix">
              <input
                type="text"
                value={editDetail?.price ?? 0}
                readOnly
                className={inputClass}
              />
            </FormField>
            <FormField label="Total">
              <input
                type="text"
                value={editTotal}
                readOnly
                className={inputClass}
              />
            </FormField>
          </div>
          <FormField label="Réduction" required>
            <input
              type="number"
              value={editRemise}
              onChange={(e) => setEditRemise(e.target.value)}
              min={0}
              className={inputClass}
            />
          </FormField>
        </div>
      </CrudModal>

      {/* Confirmation suppression */}
      <ConfirmModal
        isOpen={deleteDetail !== null}
        onClose={() => setDeleteDetail(null)}
        onConfirm={() => {
          if (deleteDetail) deleteDetailMutation.mutate(deleteDetail.id);
        }}
        title="Supprimer cette ligne"
        message={`Supprimer "${deleteDetail?.labTestName ?? "cette ligne"}" du contrat ?`}
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteDetailMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sous-composants d'affichage
// ---------------------------------------------------------------------------

function StatTile({
  icon,
  tint,
  label,
  value,
}: {
  icon: React.ReactNode;
  tint: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${tint}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-gray-400">
            {label}
          </p>
          <p className="truncate text-sm font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-gray-900">{value}</dd>
    </div>
  );
}
