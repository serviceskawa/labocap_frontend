"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Search, PlusCircle, Eye } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  cashboxApi,
  type CashboxResponseDto,
  type CashboxOperationResponseDto,
} from "@/lib/api/cashbox";
import { banksApi, type Bank } from "@/lib/api/banks";
import { NativeSelect } from "@/components/ui/NativeSelect";
import type { ApiError } from "@/types/api";
import { applyFieldErrors } from "@/lib/api/errorMessages";

// ---------------------------------------------------------------------------
// Schéma de l'approvisionnement de la caisse
// ---------------------------------------------------------------------------

// Tous les champs sont obligatoires : écart assumé vis-à-vis de
// `cashbox/depense/create.blade.php`, qui n'en marque aucun. Demandé en recette
// pour qu'un approvisionnement soit toujours traçable (banque, chèque, motif).
const supplySchema = z.object({
  bankId: z.string().min(1, "La banque est requise"),
  chequeNumber: z.string().min(1, "Le numéro de chèque est requis"),
  amount: z
    .string()
    .min(1, "Le montant est requis")
    .refine((v) => Number(v) > 0, {
      message: "Veuillez renseigner un montant supérieur à zéro",
    }),
  date: z.string().min(1, "La date est requise"),
  description: z.string().min(1, "La description est requise"),
});

type SupplyFormData = z.infer<typeof supplySchema>;

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";
}

function formatDateTime(value: string): string {
  if (!value) return "—";
  const d = new Date(value);
  return (
    d.toLocaleDateString("fr-FR") +
    " " +
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  );
}

// ---------------------------------------------------------------------------
// Page — Caisse de dépense (réplique Laravel cashbox.depense.index)
// ---------------------------------------------------------------------------

export default function CashboxDepensePage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [supplyOpen, setSupplyOpen] = useState(false);
  // Opération sélectionnée pour le modal détail (lecture seule) — écran Laravel « edit_depense ».
  const [detailOp, setDetailOp] = useState<CashboxOperationResponseDto | null>(null);

  // === Récupérer la caisse de dépense
  const { data: cashboxesData } = useQuery({
    queryKey: ["cashboxes"],
    queryFn: () => cashboxApi.getCashboxes().then((r) => r.data.content),
  });

  // Banques pour le select « Nom de la banque » du formulaire d'approvisionnement.
  const { data: banksData } = useQuery({
    queryKey: ["banks-list"],
    queryFn: () => banksApi.findAll({ size: 200 }).then((r) => r.data.content),
  });
  const banks: Bank[] = banksData ?? [];

  // Comme pour la caisse de vente, des doublons vides peuvent exister (artefacts
  // de migration) : on retient la caisse de type "depense" au solde le plus élevé.
  const depenseCashbox: CashboxResponseDto | undefined = (cashboxesData ?? [])
    .filter((c) => c.type === "depense")
    .reduce<CashboxResponseDto | undefined>(
      (best, c) =>
        !best || Number(c.balance ?? 0) > Number(best.balance ?? 0) ? c : best,
      undefined
    );

  // === Opérations de la caisse de dépense
  const { data: operationsData, isLoading } = useQuery({
    queryKey: ["cashbox-operations", { cashboxId: depenseCashbox?.id, page, pageSize }],
    queryFn: () =>
      cashboxApi
        .getOperations({ cashboxId: depenseCashbox!.id, page, size: pageSize })
        .then((r) => r.data),
    enabled: !!depenseCashbox?.id,
  });

  const allOperations = useMemo(
    () => operationsData?.content ?? [],
    [operationsData?.content]
  );

  const operations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allOperations;
    return allOperations.filter(
      (o) =>
        (o.description ?? "").toLowerCase().includes(q) ||
        String(o.amount).includes(q)
    );
  }, [allOperations, search]);

  const totalElements = operationsData?.totalElements ?? 0;
  const totalPages = operationsData?.totalPages ?? 0;

  // === Approvisionnement de la caisse (dépôt d'espèces dans la caisse de dépense)
  const supplyForm = useForm<SupplyFormData>({
    resolver: zodResolver(supplySchema),
    defaultValues: {
      bankId: "",
      chequeNumber: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      description: "",
    },
  });

  const supplyMutation = useMutation({
    mutationFn: (values: SupplyFormData) =>
      cashboxApi.addOperation({
        cashboxId: depenseCashbox!.id,
        amount: Number(values.amount),
        type: "CREDIT",
        description: values.description || undefined,
        operationDate: values.date,
        bankId: values.bankId || undefined,
        chequeNumber: values.chequeNumber || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashboxes"] });
      queryClient.invalidateQueries({ queryKey: ["cashbox-operations"] });
      toast.success("Caisse approvisionnée");
      setSupplyOpen(false);
      supplyForm.reset({
        bankId: "",
        chequeNumber: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        description: "",
      });
    },
    onError: (err: AxiosError<ApiError>) => {
      if (!applyFieldErrors(err, supplyForm.setError as (n: string, e: { type: string; message: string }) => void)) {
        toast.error(
          err.response?.data?.message ?? "Erreur lors de l'approvisionnement"
        );
      }
    },
  });

  // ---- Columns — alignées sur la vue Laravel « Caisse de dépense » :
  // #, Date, Montant, Utilisateur.
  const columns: ColumnDef<CashboxOperationResponseDto>[] = [
    {
      header: "#",
      id: "rownum",
      cell: ({ row }) => (
        <span className="text-xs text-gray-500">
          {page * pageSize + row.index + 1}
        </span>
      ),
    },
    {
      header: "Date",
      accessorKey: "createdAt",
      enableSorting: true,
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      header: "Montant",
      accessorKey: "amount",
      enableSorting: true,
      cell: ({ row }) => {
        // Sortie de caisse (DEBIT) affichée en négatif, comme la vue Laravel
        // (bank ? amount : -amount).
        const isDebit = row.original.type === "DEBIT";
        return (
          <span
            className={`font-medium ${isDebit ? "text-red-600" : "text-green-700"}`}
          >
            {isDebit ? "-" : ""}
            {formatFCFA(row.original.amount)}
          </span>
        );
      },
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
      header: "Action",
      id: "actions",
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setDetailOp(row.original)}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
          title="Voir le détail"
        >
          <Eye className="h-3.5 w-3.5" />
          Détail
        </button>
      ),
    },
  ];

  if (!can(PERMISSIONS.VIEW_CASHBOXES)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-gray-500">Accès non autorisé</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Caisse de dépense"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Trésorerie" },
          { label: "Caisse de dépense" },
        ]}
        action={
          can(PERMISSIONS.MANAGE_CASHBOX) ? (
            <button
              type="button"
              onClick={() => {
                supplyForm.reset({
                  amount: "",
                  date: new Date().toISOString().split("T")[0],
                  description: "",
                });
                setSupplyOpen(true);
              }}
              disabled={!depenseCashbox}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              title="Approvisionner la caisse"
            >
              <PlusCircle className="h-4 w-4" />
              Approvisionner la caisse
            </button>
          ) : undefined
        }
      />

      {/* === KPI Solde actuel === */}
      {depenseCashbox && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-gray-500">
            Solde actuel
          </p>
          <p className="mt-1 text-3xl font-bold text-green-700">
            {formatFCFA(depenseCashbox.balance)}
          </p>
        </div>
      )}

      {/* === Tableau historique des opérations === */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-800">
            Historique des opérations
          </h2>

          <div className="flex items-center gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <span className="text-sm text-gray-500 whitespace-nowrap">
              {totalElements} opération{totalElements > 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={operations}
          isLoading={isLoading}
          pageCount={totalPages}
          pageIndex={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(0);
          }}
        />
      </div>

      {/* === Modal approvisionnement === */}
      <CrudModal
        isOpen={supplyOpen}
        onClose={() => {
          setSupplyOpen(false);
          supplyForm.reset();
        }}
        title="Approvisionner la caisse"
        size="lg"
        onSubmit={supplyForm.handleSubmit((v) => supplyMutation.mutate(v))}
        submitLabel="Enregistrer"
        isSubmitting={supplyMutation.isPending}
      >
        <div className="grid grid-cols-1 gap-4">
          {/* Nom de la banque + Numéro de chèque (une ligne) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Nom de la banque <span className="text-red-500">*</span>
              </label>
              <NativeSelect
                value={supplyForm.watch("bankId") ?? ""}
                onChange={(e) =>
                  supplyForm.setValue("bankId", e.target.value, {
                    shouldValidate: true,
                  })
                }
              >
                <option value="">Sélectionner une banque</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </NativeSelect>
              {supplyForm.formState.errors.bankId && (
                <p className="text-sm text-red-600">
                  {supplyForm.formState.errors.bankId.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Numéro de chèque <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...supplyForm.register("chequeNumber")}
                className={inputClass}
              />
              {supplyForm.formState.errors.chequeNumber && (
                <p className="text-sm text-red-600">
                  {supplyForm.formState.errors.chequeNumber.message}
                </p>
              )}
            </div>
          </div>

          {/* Montant (pleine largeur) */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Montant <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              step="any"
              {...supplyForm.register("amount")}
              className={inputClass}
            />
            {supplyForm.formState.errors.amount && (
              <p className="text-xs text-red-500">
                {supplyForm.formState.errors.amount.message}
              </p>
            )}
          </div>

          {/* Date + Attachement (une ligne) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                {...supplyForm.register("date")}
                className={inputClass}
              />
              {supplyForm.formState.errors.date && (
                <p className="text-xs text-red-500">
                  {supplyForm.formState.errors.date.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Attachement
              </label>
              {/* Champ présent comme dans Laravel ; la pièce jointe n'est pas
                  persistée par l'approvisionnement (le contrôleur l'ignore). */}
              <input type="file" className={inputClass} />
            </div>
          </div>

          {/* Description (pleine largeur) */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              {...supplyForm.register("description")}
              className={`${inputClass} resize-none`}
            />
            {supplyForm.formState.errors.description && (
              <p className="text-sm text-red-600">
                {supplyForm.formState.errors.description.message}
              </p>
            )}
          </div>
        </div>
      </CrudModal>

      {/* === Modal détail opération (lecture seule) — écran Laravel edit_depense === */}
      {detailOp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">
                {detailOp.type === "DEBIT"
                  ? "Détail dépense"
                  : "Détail approvisionnement"}
              </h2>
              <button
                onClick={() => setDetailOp(null)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 p-6 text-sm">
              <DetailRow label="Date" value={formatDateTime(detailOp.createdAt)} />
              <DetailRow
                label="Montant"
                value={`${detailOp.type === "DEBIT" ? "-" : ""}${formatFCFA(detailOp.amount)}`}
              />
              <DetailRow
                label="Type"
                value={
                  detailOp.type === "DEBIT" ? "Dépense" : "Approvisionnement"
                }
              />
              {detailOp.invoiceCode && (
                <DetailRow label="Facture" value={detailOp.invoiceCode} />
              )}
              <DetailRow label="Description" value={detailOp.description ?? "—"} />
              <DetailRow label="Utilisateur" value={detailOp.userName ?? "—"} />
            </div>
            <div className="flex justify-end border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setDetailOp(null)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-gray-800">{value}</span>
    </div>
  );
}
