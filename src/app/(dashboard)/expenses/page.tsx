"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, Paperclip } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { FormField } from "@/components/ui/FormField";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  expensesApi,
  type Expense,
  type ExpenseCreateRequest,
  type PaymentMethod,
} from "@/lib/api/expenses";
import { downloadDocFile } from "@/lib/api/docs";
import { suppliersApi } from "@/lib/api/suppliers";
import { expenseCategoriesApi, type ExpenseCategory } from "@/lib/api/expenses";
import { Button } from "@/components/ui/Button";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "ESPECES", label: "Espèces" },
  { value: "CHEQUES", label: "Chèque" },
  { value: "MOBILEMONEY", label: "Mobile Money" },
  { value: "VIREMENT", label: "Virement" },
];

function paymentLabel(payment?: string): string {
  return PAYMENT_OPTIONS.find((p) => p.value === payment)?.label ?? payment ?? "";
}

function formatAmount(amount: number): string {
  // FCFA n'a pas de sous-unité : on affiche des entiers, jamais de décimales.
  return (
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
      Math.round(amount),
    ) + " FCFA"
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500";

// Formulaire de création en ligne : « Catégorie de dépense », « Fournisseur »,
// « Objet ». Le montant est saisi ensuite sur la page détail.
const createSchema = z.object({
  expenseCategorieId: z.string().min(1, { message: "La catégorie est requise" }),
  supplierName: z.string().optional(),
  description: z.string().optional(),
});

type CreateFormValues = z.infer<typeof createSchema>;

// Transition de statut demandée depuis la colonne « Traitement ».
type StatusChange = { expense: Expense; target: 1 | 2 };

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ExpensesPage() {
  const { can } = usePermissions();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [categoryFilter, setCategoryFilter] = useState("");
  const [paidFilter, setPaidFilter] = useState("");
  const [statusChange, setStatusChange] = useState<StatusChange | null>(null);

  // ---- Queries -------------------------------------------------------------

  const params: Record<string, unknown> = { size: 200 };
  if (categoryFilter) params.expenseCategorieId = categoryFilter;
  if (paidFilter !== "") params.paid = paidFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["expenses", params],
    queryFn: () => expensesApi.findAll(params).then((r) => r.data),
  });

  const expenses: Expense[] = data?.content ?? [];

  const { data: categoriesData } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: () => expenseCategoriesApi.findAll({ size: 200 }).then((r) => r.data),
  });

  const categories: ExpenseCategory[] = categoriesData?.content ?? [];

  const { data: suppliersData } = useQuery({
    queryKey: ["suppliers-select"],
    queryFn: () => suppliersApi.findAll({ size: 200 }).then((r) => r.data),
  });

  const suppliers = suppliersData?.content ?? [];

  function supplierName(id?: string): string {
    if (!id) return "—";
    return suppliers.find((s) => s.id === id)?.name ?? "—";
  }

  // ---- Mutations -----------------------------------------------------------

  function apiMessage(err: AxiosError): string {
    return (
      (err.response?.data as { message?: string })?.message ??
      "Une erreur est survenue"
    );
  }

  // Comme dans Laravel, la création redirige vers la page détail pour y saisir
  // le montant, la date et les lignes d'articles.
  const createMutation = useMutation({
    mutationFn: (payload: ExpenseCreateRequest) => expensesApi.create(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers-select"] });
      toast.success("Opération effectuée avec succès !");
      createForm.reset();
      router.push(`/expenses/${res.data.id}`);
    },
    onError: (err: AxiosError) => toast.error(apiMessage(err)),
  });

  const payMutation = useMutation({
    mutationFn: (id: string) => expensesApi.pay(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Dépense marquée comme payée");
      setStatusChange(null);
    },
    onError: (err: AxiosError) => {
      toast.error(apiMessage(err));
      setStatusChange(null);
    },
  });

  const stockMutation = useMutation({
    mutationFn: (id: string) => expensesApi.updateStock(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Stock mis à jour");
      setStatusChange(null);
    },
    onError: (err: AxiosError) => {
      toast.error(apiMessage(err));
      setStatusChange(null);
    },
  });

  // ---- Formulaire de création ---------------------------------------------

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { expenseCategorieId: "", supplierName: "", description: "" },
  });

  function onCreateSubmit(values: CreateFormValues) {
    const typed = values.supplierName?.trim();
    // Un nom déjà connu est réutilisé tel quel ; sinon le back crée le fournisseur.
    const known = suppliers.find(
      (s) => s.name.toLowerCase() === (typed ?? "").toLowerCase()
    );
    createMutation.mutate({
      expenseCategorieId: values.expenseCategorieId,
      description: values.description || undefined,
      supplierId: known?.id,
      supplierName: known ? undefined : typed || undefined,
    });
  }

  // ---- Colonnes ------------------------------------------------------------

  const canProcess = can(PERMISSIONS.VIEW_PROCESS_CASHBOX_TICKETS);

  const columns: ColumnDef<Expense>[] = [
    {
      header: "#",
      id: "rownum",
      cell: ({ row }) => <span className="text-sm text-gray-500">{row.index + 1}</span>,
    },
    {
      header: "Date",
      accessorKey: "date",
      cell: ({ row }) =>
        row.original.date
          ? new Date(row.original.date).toLocaleDateString("fr-FR")
          : "—",
    },
    {
      header: "Fournisseur",
      id: "supplier",
      cell: ({ row }) => supplierName(row.original.supplierId),
    },
    {
      header: "Objet de la dépense",
      accessorKey: "description",
      cell: ({ row }) => row.original.description ?? "—",
    },
    {
      header: "Montant",
      accessorKey: "amount",
      cell: ({ row }) => (
        <div className="leading-tight">
          <div className="font-medium text-gray-900">
            {formatAmount(row.original.amount)}
          </div>
          <div className="text-xs text-gray-500">
            {paymentLabel(row.original.payment)}
          </div>
        </div>
      ),
    },
    {
      header: "Piece jointe",
      id: "attachment",
      cell: ({ row }) => {
        const { invoiceNumber, receipt } = row.original;
        if (!invoiceNumber && !receipt) return <span className="text-gray-400">—</span>;
        return (
          <div className="flex flex-col gap-1">
            {invoiceNumber && (
              <span className="text-sm text-gray-700">Re: {invoiceNumber}</span>
            )}
            {receipt && (
              <button
                type="button"
                onClick={() => downloadDocFile(receipt)}
                className="inline-flex w-fit items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
              >
                <Paperclip className="h-3.5 w-3.5" />
                Reçu
              </button>
            )}
          </div>
        );
      },
    },
    // « Traitement » : select de changement de statut, remplacé par un badge figé
    // une fois la dépense livrée. Réservé à view-process-cashbox-tickets.
    ...(canProcess
      ? [
          {
            header: "Traitement",
            id: "process",
            cell: ({ row }) => {
              const expense = row.original;
              if (expense.paid === 2) {
                return (
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset bg-green-50 text-green-700 ring-green-600/20">
                    Marquée comme livrée
                  </span>
                );
              }
              return (
                <NativeSelect
                  value={String(expense.paid)}
                  onChange={(e) => {
                    const target = Number(e.target.value);
                    if (target === 1 || target === 2) {
                      setStatusChange({ expense, target });
                    }
                  }}
                  className="w-[250px]"
                >
                  <option value="0">Non payée</option>
                  <option value="1">Payée non livrée</option>
                  <option value="2">Payée et livrée</option>
                </NativeSelect>
              );
            },
          } as ColumnDef<Expense>,
        ]
      : []),
    {
      header: "Action",
      id: "actions",
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => router.push(`/expenses/${row.original.id}`)}
          className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700"
          aria-label="Voir le détail"
          title="Voir le détail"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  // ---- Guard ---------------------------------------------------------------

  if (!can(PERMISSIONS.VIEW_EXPENSES)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-gray-500">Accès non autorisé</p>
      </div>
    );
  }

  // ---- Render --------------------------------------------------------------

  const confirmMessage =
    statusChange?.target === 1
      ? "Voulez-vous marquer cette dépense comme payée non livrée ?"
      : "Voulez-vous marquer cette dépense comme payée et livrée ?";

  return (
    <div className="space-y-6">
      <PageHeader title="Dépenses" />

      {/* Création en ligne — reprend le formulaire en tête de la liste Laravel */}
      {can(PERMISSIONS.CREATE_EXPENSES) && (
        <form
          onSubmit={createForm.handleSubmit(onCreateSubmit)}
          autoComplete="off"
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              label="Catégorie de dépense*"
              error={createForm.formState.errors.expenseCategorieId?.message}
            >
              <NativeSelect {...createForm.register("expenseCategorieId")}>
                <option value="">Sélectionner une catégorie</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>

            <FormField label="Fournisseur*">
              <input
                type="text"
                list="expense-suppliers"
                className={inputClass}
                {...createForm.register("supplierName")}
              />
              <datalist id="expense-suppliers">
                {suppliers.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </FormField>

            <FormField label="Objet*">
              <input type="text" className={inputClass} {...createForm.register("description")} />
            </FormField>

            <div>
              <Button
                type="submit"
                loading={createMutation.isPending}
                className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
              >
                Ajouter
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* Filtres serveur (catégorie / statut) */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NativeSelect
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">Toutes les catégories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect value={paidFilter} onChange={(e) => setPaidFilter(e.target.value)}>
            <option value="">Tous les statuts</option>
            <option value="0">Non payée</option>
            <option value="1">Payée non livrée</option>
            <option value="2">Payée et livrée</option>
          </NativeSelect>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <DataTable columns={columns} data={expenses} isLoading={isLoading} />
      </div>

      <ConfirmModal
        isOpen={statusChange !== null}
        onClose={() => setStatusChange(null)}
        onConfirm={() => {
          if (!statusChange) return;
          if (statusChange.target === 1) payMutation.mutate(statusChange.expense.id);
          else stockMutation.mutate(statusChange.expense.id);
        }}
        title="Confirmation"
        message={confirmMessage}
        confirmLabel="Confirmer"
        isLoading={payMutation.isPending || stockMutation.isPending}
      />
    </div>
  );
}
