"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Eye, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/common/DataTable";
import {
  TableLengthControl,
  TablePaginationFooter,
  useTablePagination,
} from "@/components/common/TablePagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconButton } from "@/components/ui/IconButton";
import { RHFSelect } from "@/components/ui/RHFSelect";
import { FormField } from "@/components/ui/FormField";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  cashboxApi,
  type CashboxVoucherResponseDto,
  type CashboxVoucherStatus,
} from "@/lib/api/cashbox";
import { expenseCategoriesApi } from "@/lib/api/expenses";
import { suppliersApi } from "@/lib/api/suppliers";
import type { PageResponse, ApiError } from "@/types/api";
import { Button } from "@/components/ui/Button";
import { applyFieldErrors } from "@/lib/api/errorMessages";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function formatAmount(v?: number) {
  if (v == null) return "—";
  return new Intl.NumberFormat("fr-FR").format(v) + " FCFA";
}

// Badge de statut — réplique exacte de la vue Laravel (en attente / approuve / rejete).
function StatusBadge({ status }: { status: string }) {
  if (status === "en attente")
    return (
      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        En attente
      </span>
    );
  if (status === "approuve")
    return (
      <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        Approuvé
      </span>
    );
  return (
    <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
      Décliné
    </span>
  );
}

// ---------------------------------------------------------------------------
// Schéma du formulaire de création (en-tête du bon)
// ---------------------------------------------------------------------------

const schema = z.object({
  expenseCategoryId: z.string().min(1, "La catégorie est requise"),
  supplierId: z.string().min(1, "Le fournisseur est requis"),
});

type FormData = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Page — Bon de caisse (réplique Laravel cashbox.ticket.index)
// ---------------------------------------------------------------------------

export default function CashboxTicketsPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [detailTicket, setDetailTicket] =
    useState<CashboxVoucherResponseDto | null>(null);

  // Articles du bon affiché dans la modale détail.
  const detailsPagination = useTablePagination(detailTicket?.details ?? []);

  const canProcess = can(PERMISSIONS.VIEW_PROCESS_CASHBOX_TICKETS);
  const canCreate = can(PERMISSIONS.CREATE_CASHBOX_TICKETS);

  // `defaultValues` explicites : sans eux les champs valaient `undefined`, et
  // zod signalait un type manquant (message générique) au lieu du message
  // « La catégorie est requise » / « Le fournisseur est requis ».
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { expenseCategoryId: "", supplierId: "" },
  });

  // ---- Queries -------------------------------------------------------------

  const { data, isLoading } = useQuery<PageResponse<CashboxVoucherResponseDto>>({
    queryKey: ["cashbox-tickets", { page, size: pageSize }],
    queryFn: () =>
      cashboxApi.getVouchers({ page, size: pageSize }).then((r) => r.data),
  });

  const tickets = data?.content ?? [];
  const pageCount = data?.totalPages ?? 0;

  const { data: categoriesData } = useQuery({
    queryKey: ["expense-categories-all"],
    queryFn: () => expenseCategoriesApi.findAll({ size: 200 }).then((r) => r.data),
  });

  const { data: suppliersData } = useQuery({
    queryKey: ["suppliers-all"],
    queryFn: () => suppliersApi.findAll({ size: 200 }).then((r) => r.data),
  });

  const categories = categoriesData?.content ?? [];
  const suppliers = suppliersData?.content ?? [];

  // ---- Mutations -----------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (d: FormData) =>
      cashboxApi
        .addVoucher({
          expenseCategoryId: d.expenseCategoryId,
          supplierId: d.supplierId,
        })
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashbox-tickets"] });
      toast.success("Bon de caisse créé — ajoutez-y les articles");
      form.reset({ expenseCategoryId: "", supplierId: "" });
    },
    onError: (e: AxiosError<ApiError>) => {
      if (!applyFieldErrors(e, form.setError as (n: string, e: { type: string; message: string }) => void)) {
        toast.error(e.response?.data?.message ?? "Erreur lors de la création");
      }
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CashboxVoucherStatus }) =>
      cashboxApi.updateVoucherStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashbox-tickets"] });
      toast.success("Statut mis à jour");
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur lors du changement de statut"),
  });

  function handleStatusChange(id: string, value: string) {
    if (!value) return;
    const labels: Record<string, string> = {
      approuve: "approuver",
      rejete: "décliner",
    };
    if (window.confirm(`Voulez-vous ${labels[value] ?? "modifier"} ce bon de caisse ?`)) {
      statusMutation.mutate({ id, status: value as CashboxVoucherStatus });
    }
  }

  // ---- Columns -------------------------------------------------------------
  // #, Code, Montant, Fournisseur, Description, Status, [Traitement], Actions.
  const columns: ColumnDef<CashboxVoucherResponseDto>[] = [
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
      header: "Code",
      accessorKey: "code",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-gray-600">{row.original.code}</span>
      ),
    },
    {
      header: "Montant",
      accessorKey: "amount",
      cell: ({ row }) => formatAmount(row.original.amount),
    },
    {
      header: "Fournisseur",
      accessorKey: "supplierName",
      cell: ({ row }) => (
        <span className="text-sm text-gray-700">
          {row.original.supplierName ?? "Aucun"}
        </span>
      ),
    },
    {
      header: "Description",
      accessorKey: "description",
      cell: ({ row }) => row.original.description ?? "—",
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    ...(canProcess
      ? [
          {
            header: "Traitement",
            id: "traitement",
            cell: ({ row }: { row: { original: CashboxVoucherResponseDto } }) =>
              row.original.status === "en attente" ? (
                <NativeSelect
                  value=""
                  onChange={(e) =>
                    handleStatusChange(row.original.id, e.target.value)
                  }
                  className="w-36"
                >
                  <option value="">En attente</option>
                  <option value="approuve">Approuvée</option>
                  <option value="rejete">Décliné</option>
                </NativeSelect>
              ) : (
                <span className="text-xs text-gray-400">—</span>
              ),
          },
        ]
      : []),
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <IconButton
            variant="view"
            title="Voir les détails"
            onClick={() => setDetailTicket(row.original)}
            icon={<Eye className="h-4 w-4" />}
          />
          {row.original.status === "en attente" && (
            <Link
              href={`/cashbox/ticket/${row.original.id}`}
              className="inline-flex items-center justify-center rounded-sm bg-gray-600 p-[.4rem] text-white transition-shadow hover:shadow-[0_2px_6px_0_rgba(108,117,125,0.5)]"
              title="Modifier / articles"
            >
              <Pencil className="h-4 w-4" />
            </Link>
          )}
        </div>
      ),
    },
  ];

  // ---- Render --------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bon de caisse"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Trésorerie" },
          { label: "Bon de caisse" },
        ]}
      />

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        {/* Formulaire de création inline (en-tête du bon) */}
        {canCreate && (
          <form
            onSubmit={form.handleSubmit((d) => createMutation.mutate(d))}
            className="mb-6 grid grid-cols-1 gap-3 border-b border-gray-100 pb-6 md:grid-cols-4 md:items-end"
          >
            <FormField label="Type de caisse" required>
              <input
                type="text"
                value="Caisse de dépense"
                readOnly
                className={`${inputClass} bg-gray-50 text-gray-500`}
              />
            </FormField>

            <RHFSelect
              control={form.control}
              name="expenseCategoryId"
              label="Catégorie de dépense"
              required
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Choisir une catégorie..."
              error={form.formState.errors.expenseCategoryId?.message}
            />

            <RHFSelect
              control={form.control}
              name="supplierId"
              label="Fournisseur"
              required
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              placeholder="Choisir un fournisseur..."
              error={form.formState.errors.supplierId?.message}
            />

            <div className="md:col-span-4">
              <Button
                type="submit"
                loading={createMutation.isPending}
                icon={<Plus className="h-4 w-4" />}
                className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
              >
                Ajouter
              </Button>
            </div>
          </form>
        )}

        <h2 className="mb-4 text-base font-semibold text-gray-800">
          Liste des bons de caisse
        </h2>

        <DataTable
          columns={columns}
          data={tickets}
          isLoading={isLoading}
          pageCount={pageCount}
          pageIndex={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(0);
          }}
        />
      </div>

      {/* Modal détail ticket (lecture seule) */}
      {detailTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">
                Détail bon de caisse
              </h2>
              <button
                onClick={() => setDetailTicket(null)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Code</p>
                  <p className="font-medium text-gray-800">{detailTicket.code}</p>
                </div>
                <div>
                  <p className="text-gray-500">Fournisseur</p>
                  <p className="font-medium text-gray-800">
                    {detailTicket.supplierName ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Objet</p>
                  <p className="font-medium text-gray-800">
                    {detailTicket.description ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Montant total</p>
                  <p className="font-medium text-gray-800">
                    {formatAmount(detailTicket.amount)}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-700">
                  Liste des articles
                </h3>
                {detailTicket.details.length === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-500">
                    Aucun article sur ce bon.
                  </p>
                ) : (
                  <>
                    <TableLengthControl pagination={detailsPagination} />
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase text-gray-500">
                          <th className="pb-2 pr-4">#</th>
                          <th className="pb-2 pr-4">Article</th>
                          <th className="pb-2 pr-4 text-right">Prix</th>
                          <th className="pb-2 pr-4 text-right">Quantité</th>
                          <th className="pb-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {detailsPagination.pageRows.map((d, i) => (
                          <tr key={d.id}>
                            <td className="py-2 pr-4 text-gray-500">
                              {detailsPagination.offset + i + 1}
                            </td>
                            <td className="py-2 pr-4 font-medium">{d.itemName}</td>
                            <td className="py-2 pr-4 text-right text-gray-600">
                              {formatAmount(d.unitPrice)}
                            </td>
                            <td className="py-2 pr-4 text-right">{d.quantity}</td>
                            <td className="py-2 text-right font-medium">
                              {formatAmount(d.lineAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <TablePaginationFooter pagination={detailsPagination} />
                  </>
                )}
              </div>
            </div>
            <div className="flex justify-end border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setDetailTicket(null)}
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
