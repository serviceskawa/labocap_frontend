"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";

import { DataTable } from "@/components/common/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  inventoryApi,
  type Article,
  type StockMovement,
} from "@/lib/api/inventory";
import type { PageResponse, ApiError } from "@/types/api";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

// ---------------------------------------------------------------------------
// Zod schema — formulaire « Opérations sur le stock » (movements/index.blade.php).
// Laravel n'expose que l'article et la quantité ; le sens (entrée/sortie) est
// porté par le bouton cliqué, pas par un champ.
// ---------------------------------------------------------------------------

const movementSchema = z.object({
  articleId: z.string().min(1, "L'article est obligatoire"),
  // Plage bornée : au-delà, la colonne en base déborde et l'erreur remontée
  // au testeur était indéterminée.
  quantity: z
    .string()
    .min(1, "La quantité est requise")
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 1_000_000, {
      message: "La quantité doit être un entier compris entre 1 et 1 000 000",
    }),
});

type MovementFormData = z.infer<typeof movementSchema>;

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

/**
 * Libellé d'action tel qu'affiché par Laravel (`augmenter` → Entrer,
 * `diminuer` → Sortir, sinon Stock initial). Le schéma actuel n'ayant que
 * IN/OUT/ADJUSTMENT, le « stock initial » migré se reconnaît à sa note.
 */
function movementActionLabel(m: StockMovement): string {
  if (m.type === "OUT") return "Sortir";
  if (m.type === "IN" && m.notes !== "Stock initial") return "Entrer";
  return "Stock initial";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MovementsPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const form = useForm<MovementFormData>({
    resolver: zodResolver(movementSchema),
    defaultValues: { articleId: "", quantity: "" },
  });

  // Laravel affiche l'historique complet, sans pagination ni recherche.
  const { data, isLoading } = useQuery<PageResponse<StockMovement>>({
    queryKey: ["movements"],
    queryFn: () =>
      inventoryApi.listMovements({ size: 1000 }).then((r) => r.data),
  });

  const { data: articlesData } = useQuery<Article[]>({
    queryKey: ["articles-all-for-movements"],
    queryFn: () =>
      inventoryApi.findAll({ size: 1000 }).then((r) => r.data.articles.content),
    staleTime: 5 * 60_000,
  });

  const movements = data?.content ?? [];
  const articles = articlesData ?? [];

  const createMutation = useMutation({
    mutationFn: ({
      values,
      type,
    }: {
      values: MovementFormData;
      type: "IN" | "OUT";
    }) =>
      inventoryApi.addMovement(values.articleId, {
        type,
        quantity: Number(values.quantity),
        movementDate: new Date().toISOString().split("T")[0],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      queryClient.invalidateQueries({ queryKey: ["articles-all-for-movements"] });
      queryClient.invalidateQueries({ queryKey: ["stock-minimum-count"] });
      toast.success("Opération effectuée avec succès ! ");
      form.reset({ articleId: "", quantity: "" });
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Échec de l'enregistrement ! ",
      );
    },
  });

  /** Les deux boutons soumettent le même formulaire, avec un sens différent. */
  function submitWith(type: "IN" | "OUT") {
    return form.handleSubmit((values) => createMutation.mutate({ values, type }));
  }

  const columns: ColumnDef<StockMovement>[] = [
    {
      header: "Article",
      id: "article",
      cell: ({ row }) =>
        row.original.articleName ?? row.original.article?.name ?? "",
    },
    {
      header: "Action",
      accessorKey: "type",
      cell: ({ row }) => movementActionLabel(row.original),
    },
    {
      header: "Date",
      id: "date",
      cell: ({ row }) => {
        const d = row.original.movementDate ?? row.original.createdAt;
        return d ? formatDate(d) : "";
      },
    },
    {
      header: "Quantité",
      accessorKey: "quantity",
      cell: ({ row }) =>
        new Intl.NumberFormat("fr-FR").format(row.original.quantity),
    },
    {
      header: "Utilisateur",
      id: "user",
      cell: ({ row }) => row.original.userFullName ?? "",
    },
  ];

  if (!can(PERMISSIONS.VIEW_MOVEMENTS)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Vous n&apos;êtes pas autorisé</p>
      </div>
    );
  }

  // Laravel masque les lignes dont l'article a disparu.
  const visibleMovements = movements.filter(
    (m) => m.articleName ?? m.article?.name,
  );

  return (
    <div className="space-y-6">
      {/* ══════════ Opérations sur le stock ══════════ */}
      <PageHeader title="Gestion des stocks" />

      {can(PERMISSIONS.CREATE_MOVEMENTS) && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h5 className="text-base font-semibold text-gray-900">
            Opérations sur le stock
          </h5>

          <p className="mt-2 text-right text-sm text-gray-600">
            <span className="text-red-600">*</span>champs obligatoires
          </p>

          <form className="mt-2 grid grid-cols-1 items-end gap-4 sm:grid-cols-12">
            <div className="sm:col-span-5">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Article <span className="text-red-600">*</span>
              </label>
              <NativeSelect
                value={form.watch("articleId") ?? ""}
                onChange={(e) =>
                  form.setValue("articleId", e.target.value, {
                    shouldValidate: true,
                  })
                }
              >
                {articles.length === 0 ? (
                  <option value="">Aucun article existant</option>
                ) : (
                  <>
                    <option value="">Sélectionner l&apos;article</option>
                    {articles.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </>
                )}
              </NativeSelect>
              {form.formState.errors.articleId && (
                <p className="mt-1 text-xs text-red-500">
                  {form.formState.errors.articleId.message}
                </p>
              )}
            </div>

            <div className="sm:col-span-5">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Quantité <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                min={0}
                {...form.register("quantity")}
                placeholder="XX"
                className={inputClass}
              />
              {form.formState.errors.quantity && (
                <p className="mt-1 text-xs text-red-500">
                  {form.formState.errors.quantity.message}
                </p>
              )}
            </div>

            <div className="flex gap-2 sm:col-span-2">
              <Button
                onClick={submitWith("IN")}
                loading={createMutation.isPending}
                className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
              >
                Entrer
              </Button>
              <Button
                variant="danger"
                onClick={submitWith("OUT")}
                loading={createMutation.isPending}
                className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700"
              >
                sortir
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ══════════ Historique des stocks ══════════ */}
      <PageHeader title="Historique des stocks" />

      <DataTable
        title="Historique des stocks"
        columns={columns}
        data={visibleMovements}
        isLoading={isLoading}
      />
    </div>
  );
}
