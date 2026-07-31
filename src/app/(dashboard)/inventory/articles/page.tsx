"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, Pencil, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";
import type { UseFormReturn } from "react-hook-form";

import { PageHeader } from "@/components/ui/PageHeader";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  inventoryApi,
  type Article,
  type ArticleRequest,
  type StockMovement,
} from "@/lib/api/inventory";
import { unitesMesureApi, type UniteMesure } from "@/lib/api/examens";

// ---------------------------------------------------------------------------
// Zod schema — calque `articles/create.blade.php` : 5 champs, 4 obligatoires.
// ---------------------------------------------------------------------------

const articleSchema = z.object({
  name: z.string().min(1, "Le nom de l'article est requis"),
  initialQuantity: z
    .string()
    .min(1, "La quantité en stock est requise")
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1, {
      message: "La quantité en stock doit être un entier supérieur ou égal à 1",
    }),
  unit: z.string().min(1, "L'unité de mesure est requise"),
  minimumStock: z
    .string()
    .min(1, "Le seuil d'alerte est requis")
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1, {
      message: "Le seuil d'alerte doit être un entier supérieur ou égal à 1",
    }),
  expirationDate: z.string().optional(),
});

type ArticleFormValues = z.infer<typeof articleSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500";

/** Boutons d'action : carrés pleins colorés, comme les `btn` du thème Laravel. */
const actionBtn =
  "inline-flex h-8 w-9 items-center justify-center rounded-md text-white transition-colors";

/** Statut de stock d'un article, au sens des compteurs Laravel. */
function stockStatus(article: Article): "rupture" | "atteint" | "" {
  const min = article.minimumStock;
  if (article.quantity === 0) return "rupture";
  if (min != null && article.quantity <= min) return "atteint";
  return "";
}

/**
 * Libellé d'action d'un mouvement, tel qu'affiché par Laravel
 * (`augmenter` → Entrer, `diminuer` → Sortir, sinon Stock initial).
 * Le schéma actuel n'a que IN/OUT/ADJUSTMENT : le « stock initial » migré est
 * un IN portant la note « Stock initial », d'où la distinction sur les notes.
 */
function movementActionLabel(m: StockMovement): string {
  if (m.type === "OUT") return "Sortir";
  if (m.type === "IN" && m.notes !== "Stock initial") return "Entrer";
  return "Stock initial";
}

function buildArticlePayload(
  values: ArticleFormValues,
  includeInitialQuantity = true,
): ArticleRequest {
  const payload: ArticleRequest = {
    name: values.name,
    initialQuantity: Number(values.initialQuantity),
    unit: values.unit,
    minimumStock: Number(values.minimumStock),
    expirationDate: values.expirationDate || undefined,
  };
  // En édition, la quantité est en lecture seule (Laravel : `readonly`) et le
  // backend ne la modifie pas : elle ne transite que via les mouvements.
  if (!includeInitialQuantity) {
    delete (payload as Partial<ArticleRequest>).initialQuantity;
  }
  return payload;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ArticlesPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [detailArticle, setDetailArticle] = useState<Article | null>(null);

  // Filtre porté par l'en-tête de la colonne « Qté en stock » (article.js).
  const [stockFilter, setStockFilter] = useState("");

  // ---- Queries -------------------------------------------------------

  const { data, isLoading } = useQuery({
    queryKey: ["articles"],
    // Laravel affiche tout le stock (`latest()->get()`), sans pagination serveur.
    queryFn: () => inventoryApi.findAll({ size: 1000 }).then((r) => r.data),
  });

  const { data: units = [] } = useQuery<UniteMesure[]>({
    queryKey: ["unit-measurements-all"],
    queryFn: () => unitesMesureApi.findAll().then((r) => r.data),
  });

  const articles: Article[] = useMemo(
    // DataTables trie la colonne 0 (Nom de l'article) en décroissant.
    () =>
      [...(data?.articles.content ?? [])].sort((a, b) =>
        b.name.localeCompare(a.name, "fr"),
      ),
    [data],
  );

  const outOfStockCount = data?.outOfStockCount ?? 0;
  const lowStockCount = data?.lowStockCount ?? 0;

  const { data: movementsData, isLoading: movementsLoading } = useQuery({
    queryKey: ["article-movements", detailArticle?.id],
    queryFn: () => inventoryApi.getMovements(detailArticle!.id).then((r) => r.data),
    enabled: !!detailArticle,
  });

  const filteredArticles = useMemo(
    () =>
      stockFilter === ""
        ? articles
        : articles.filter((a) => stockStatus(a) === stockFilter),
    [articles, stockFilter],
  );

  // ---- Mutations -----------------------------------------------------

  function apiError(err: AxiosError) {
    toast.error(
      (err.response?.data as { message?: string })?.message ??
        "Échec de l'enregistrement ! ",
    );
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["articles"] });
    queryClient.invalidateQueries({ queryKey: ["stock-minimum-count"] });
  }

  const createMutation = useMutation({
    mutationFn: (payload: ArticleRequest) => inventoryApi.create(payload),
    onSuccess: () => {
      invalidate();
      toast.success("Un article enregistré ! ");
      setCreateOpen(false);
      createForm.reset();
    },
    onError: apiError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ArticleRequest> }) =>
      inventoryApi.update(id, data as ArticleRequest),
    onSuccess: () => {
      invalidate();
      toast.success("Un article a été mis à jour ! ");
      setEditOpen(false);
    },
    onError: apiError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.delete(id),
    onSuccess: () => {
      invalidate();
      toast.success("    Un élement a été supprimé ! ");
      setDeleteOpen(false);
      setSelectedArticle(null);
    },
    onError: apiError,
  });

  // ---- Forms --------------------------------------------------------

  const createForm = useForm<ArticleFormValues>({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      name: "",
      initialQuantity: "",
      unit: "",
      minimumStock: "",
      expirationDate: "",
    },
  });

  const editForm = useForm<ArticleFormValues>({
    resolver: zodResolver(articleSchema),
  });

  // ---- Handlers ------------------------------------------------------

  function openEdit(article: Article) {
    setSelectedArticle(article);
    editForm.reset({
      name: article.name,
      initialQuantity: String(article.quantity),
      unit: article.unit ?? "",
      minimumStock: article.minimumStock != null ? String(article.minimumStock) : "",
      expirationDate: article.expirationDate ?? "",
    });
    setEditOpen(true);
  }

  function onCreateSubmit(values: ArticleFormValues) {
    createMutation.mutate(buildArticlePayload(values));
  }

  function onEditSubmit(values: ArticleFormValues) {
    if (!selectedArticle) return;
    updateMutation.mutate({
      id: selectedArticle.id,
      data: buildArticlePayload(values, false),
    });
  }

  // ---- Columns -------------------------------------------------------

  // Historique des mouvements affiché dans la modale « Détail ».
  const movementColumns: ColumnDef<StockMovement>[] = [
    {
      header: "Action",
      id: "action",
      accessorFn: (m) => movementActionLabel(m),
    },
    {
      header: "Quantité",
      accessorKey: "quantity",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.quantity}</span>
      ),
    },
    {
      header: "Date",
      id: "date",
      accessorFn: (m) =>
        m.movementDate
          ? new Date(m.movementDate).toLocaleDateString("fr-FR")
          : "",
    },
    {
      header: "Fait par",
      id: "user",
      accessorFn: (m) => m.userFullName ?? "",
    },
    {
      header: "Description",
      id: "notes",
      accessorFn: (m) => m.notes ?? "",
    },
  ];

  const columns: ColumnDef<Article>[] = [
    {
      header: "Nom de l'article",
      accessorKey: "name",
    },
    {
      // L'en-tête porte le select de filtre (`#qt` dans article.js).
      id: "quantity",
      enableSorting: false,
      header: () => (
        <NativeSelect
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
          aria-label="Filtrer par état du stock"
        >
          <option value="">Qté en stock</option>
          <option value="atteint">Seuil d&apos;alerte atteint</option>
          <option value="rupture">Rupture de stock</option>
        </NativeSelect>
      ),
      cell: ({ row }) => {
        const { quantity, unit } = row.original;
        return `${quantity}${unit ? ` ${unit}` : ""}`;
      },
    },
    {
      header: "Actions",
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDetailArticle(row.original)}
            className={`${actionBtn} bg-blue-600 hover:bg-blue-700`}
            aria-label="Détail"
            title="Détail"
          >
            <Eye className="h-4 w-4" />
          </button>
          <PermissionGate permission={PERMISSIONS.EDIT_ARTICLES}>
            <button
              onClick={() => openEdit(row.original)}
              className={`${actionBtn} bg-sky-500 hover:bg-sky-600`}
              aria-label="Modifier"
              title="Modifier"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </PermissionGate>
          {/* Laravel ne propose la suppression que si le stock est à zéro. */}
          {row.original.quantity === 0 && (
            <PermissionGate permission={PERMISSIONS.DELETE_ARTICLES}>
              <button
                onClick={() => {
                  setSelectedArticle(row.original);
                  setDeleteOpen(true);
                }}
                className={`${actionBtn} bg-red-500 hover:bg-red-600`}
                aria-label="Supprimer"
                title="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </PermissionGate>
          )}
        </div>
      ),
    },
  ];

  // ---- Render --------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title="Articles"
        action={
          can(PERMISSIONS.CREATE_ARTICLES) ? (
            <button
              onClick={() => {
                createForm.reset();
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Ajouter un nouvel article
            </button>
          ) : undefined
        }
      />

      {/* ---- Compteurs (toujours affichés, comme Laravel) ---- */}
      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-4 py-1.5 text-[.9rem] font-medium text-red-700">
          Rupture de stock : {outOfStockCount}
        </span>
        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-[.9rem] font-medium text-amber-700">
          Seuil d&apos;alerte attenint : {lowStockCount}
        </span>
      </div>

      <DataTable
        title="Liste des articles"
        columns={columns}
        data={filteredArticles}
        isLoading={isLoading}
        rowClassName={(a) =>
          a.quantity === 0
            ? "bg-red-50"
            : stockStatus(a) === "atteint"
              ? "bg-amber-50"
              : ""
        }
      />

      {/* ---- Modal création ---- */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Ajouter un nouvel article"
        size="lg"
        onSubmit={createForm.handleSubmit(onCreateSubmit)}
        submitLabel="Ajouter un nouvel article"
        isSubmitting={createMutation.isPending}
      >
        <ArticleForm form={createForm} units={units} />
      </CrudModal>

      {/* ---- Modal édition ---- */}
      <CrudModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Modifier l'article"
        size="lg"
        onSubmit={editForm.handleSubmit(onEditSubmit)}
        submitLabel="Mettre à jour"
        isSubmitting={updateMutation.isPending}
      >
        <ArticleForm form={editForm} units={units} isEdit />
      </CrudModal>

      {/* ---- Confirmation suppression ---- */}
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setSelectedArticle(null);
        }}
        onConfirm={() => {
          if (selectedArticle) deleteMutation.mutate(selectedArticle.id);
        }}
        title="Voulez-vous supprimer l'élément ?"
        message={`Article : ${selectedArticle?.name ?? ""}`}
        confirmLabel="Oui"
        cancelLabel="Non !"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* ---- Modal détail (mouvements de l'article) ---- */}
      {detailArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Détail</h2>
              <button
                onClick={() => setDetailArticle(null)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
            {/* `DataTable` : même pagination et même recherche que les autres
                tableaux de l'application — l'historique d'un article peut
                compter des centaines de mouvements. */}
            <div className="max-h-[70vh] overflow-y-auto p-6">
              <DataTable<StockMovement>
                columns={movementColumns}
                data={movementsData?.content ?? []}
                isLoading={movementsLoading}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ArticleForm
// ---------------------------------------------------------------------------

interface ArticleFormProps {
  form: UseFormReturn<ArticleFormValues>;
  units: UniteMesure[];
  /** En édition, la quantité est en lecture seule (`readonly` côté Laravel). */
  isEdit?: boolean;
}

function ArticleForm({ form, units, isEdit = false }: ArticleFormProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-4">
      <p className="text-right text-sm text-gray-600">
        <span className="text-red-500">*</span>
        {isEdit ? "Champs obligatoires" : "champs obligatoires"}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Nom de l'article" required error={errors.name?.message}>
          <input type="text" {...register("name")} className={inputClass} />
        </FormField>

        <FormField
          label="Quantité en stock"
          required
          error={errors.initialQuantity?.message}
        >
          <input
            type="number"
            {...register("initialQuantity")}
            readOnly={isEdit}
            className={inputClass}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Unité de mesure" required error={errors.unit?.message}>
          {/* Laravel stocke une FK ; le schéma actuel porte un libellé texte
              (`articles.unit`) : on alimente le select avec les mêmes options. */}
          <NativeSelect
            value={form.watch("unit") ?? ""}
            onChange={(e) =>
              form.setValue("unit", e.target.value, { shouldValidate: true })
            }
          >
            <option value="">Sélectionner l&apos;unité de mesure de la quantité</option>
            {units.map((u) => (
              <option key={u.id} value={u.name}>
                {u.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>

        <FormField
          label="Seuil d'alerte"
          required
          error={errors.minimumStock?.message}
        >
          <input type="number" {...register("minimumStock")} className={inputClass} />
        </FormField>

        <FormField label="Date d'expiration" error={errors.expirationDate?.message}>
          <input type="date" {...register("expirationDate")} className={inputClass} />
        </FormField>
      </div>
    </div>
  );
}
