"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Trash2, Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";

import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { RHFSelect } from "@/components/ui/RHFSelect";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  prestationsApi,
  type Prestation,
  type PrestationRequest,
} from "@/lib/api/prestations";
import type { PageResponse, ApiError } from "@/types/api";
import apiClient from "@/lib/api/client";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

interface PrestationCategory {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const prestationSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  description: z.string().optional(),
  price: z.string().min(1, "Le prix est requis"),
  categoryId: z.string().optional(),
});

type PrestationFormData = z.infer<typeof prestationSchema>;

// ---------------------------------------------------------------------------
// Input style helper
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Composant formulaire partagé
// ---------------------------------------------------------------------------

interface PrestationFormProps {
  form: ReturnType<typeof useForm<PrestationFormData>>;
  categoryOptions: PrestationCategory[];
}

function PrestationForm({ form, categoryOptions }: PrestationFormProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* Nom */}
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className="text-sm font-medium text-gray-700">
          Nom <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          {...register("name")}
          placeholder="Nom de la prestation"
          className={inputClass}
        />
        {errors.name && (
          <p className="text-xs text-red-500">{errors.name.message}</p>
        )}
      </div>

      {/* Catégorie */}
      <RHFSelect
        control={control}
        name="categoryId"
        label="Catégorie"
        options={categoryOptions.map((c) => ({ value: c.id, label: c.name }))}
        placeholder="Rechercher une catégorie..."
        error={errors.categoryId?.message}
        isClearable
      />

      {/* Prix */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Prix (FCFA) <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          min={0}
          step="any"
          {...register("price")}
          placeholder="0"
          className={inputClass}
        />
        {errors.price && (
          <p className="text-xs text-red-500">{errors.price.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className="text-sm font-medium text-gray-700">Description</label>
        <textarea
          rows={3}
          {...register("description")}
          placeholder="Description de la prestation..."
          className={`${inputClass} resize-none`}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function PrestationsPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  // --- Pagination
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");

  // --- Modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Prestation | null>(null);
  const [selectedPrestation, setSelectedPrestation] =
    useState<Prestation | null>(null);

  // --- Formulaires
  const createForm = useForm<PrestationFormData>({
    resolver: zodResolver(prestationSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "",
      categoryId: "",
    },
  });

  const editForm = useForm<PrestationFormData>({
    resolver: zodResolver(prestationSchema),
  });

  // --- Query : liste prestations
  const { data, isLoading } = useQuery<PageResponse<Prestation>>({
    queryKey: ["prestations", { page, size: pageSize, search }],
    queryFn: () =>
      prestationsApi
        .findAll({
          page,
          size: pageSize,
          search: search || undefined,
        })
        .then((r) => r.data),
  });

  // --- Query : catégories de prestation
  const { data: categoriesData } = useQuery<PrestationCategory[]>({
    queryKey: ["prestation-categories"],
    queryFn: () =>
      apiClient
        .get<PageResponse<PrestationCategory>>("/category-prestations", {
          params: { size: 1000 },
        })
        .then((r) => r.data.content),
  });

  const prestations = data?.content ?? [];
  const pageCount = data?.totalPages ?? 0;
  const categoryOptions = categoriesData ?? [];

  // --- Mutations
  const createMutation = useMutation({
    mutationFn: (data: PrestationRequest) => prestationsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prestations"] });
      toast.success("Prestation créée avec succès");
      setCreateOpen(false);
      createForm.reset();
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la création"
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PrestationRequest }) =>
      prestationsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prestations"] });
      toast.success("Prestation modifiée avec succès");
      setEditOpen(false);
      setSelectedPrestation(null);
      editForm.reset();
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la modification"
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => prestationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prestations"] });
      toast.success("Prestation supprimée avec succès");
      setDeleteTarget(null);
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la suppression"
      );
    },
  });

  // --- Handlers
  function openEdit(prestation: Prestation) {
    setSelectedPrestation(prestation);
    editForm.reset({
      name: prestation.name,
      description: prestation.description ?? "",
      price: String(prestation.price),
      categoryId: prestation.categoryId ?? "",
    });
    setEditOpen(true);
  }

  function buildPayload(values: PrestationFormData): PrestationRequest {
    return {
      name: values.name,
      description: values.description || undefined,
      price: Number(values.price),
      categoryId: values.categoryId || undefined,
    };
  }

  function onCreateSubmit(values: PrestationFormData) {
    createMutation.mutate(buildPayload(values));
  }

  function onEditSubmit(values: PrestationFormData) {
    if (!selectedPrestation) return;
    updateMutation.mutate({
      id: selectedPrestation.id,
      data: buildPayload(values),
    });
  }

  // --- Colonnes
  const columns: ColumnDef<Prestation>[] = [
    {
      header: "Nom",
      accessorKey: "name",
    },
    {
      header: "Description",
      accessorKey: "description",
      cell: ({ row }) => {
        const desc = row.original.description;
        if (!desc) return "—";
        return desc.length > 60 ? `${desc.slice(0, 60)}…` : desc;
      },
    },
    {
      header: "Prix",
      accessorKey: "price",
      cell: ({ row }) =>
        `${new Intl.NumberFormat("fr-FR").format(row.original.price)} FCFA`,
    },
    {
      header: "Catégorie",
      id: "category",
      cell: ({ row }) => row.original.category?.name ?? "—",
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PermissionGate permission={PERMISSIONS.EDIT_PRESTATIONS}>
            <button
              type="button"
              onClick={() => openEdit(row.original)}
              className="inline-flex items-center justify-center rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors"
              title="Modifier"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.DELETE_PRESTATIONS}>
            <button
              type="button"
              onClick={() => setDeleteTarget(row.original)}
              className="inline-flex items-center justify-center rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-600 transition-colors"
              title="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </PermissionGate>
        </div>
      ),
    },
  ];

  if (!can(PERMISSIONS.VIEW_PRESTATIONS)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Accès non autorisé</p>
      </div>
    );
  }

  // --- Render
  return (
    <div className="space-y-6">
      <PageHeader
        title="Prestations"
        action={
          can(PERMISSIONS.CREATE_PRESTATIONS) ? (
            <button
              type="button"
              onClick={() => {
                createForm.reset();
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Ajouter une prestation
            </button>
          ) : undefined
        }
      />

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <DataTable
          columns={columns}
          data={prestations}
          isLoading={isLoading}
          pageCount={pageCount}
          pageIndex={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(0);
          }}
          searchValue={search}
          onSearchChange={(val) => {
            setSearch(val);
            setPage(0);
          }}
        />
      </div>

      {/* Modal création */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => {
          setCreateOpen(false);
          createForm.reset();
        }}
        title="Ajouter une prestation"
        size="lg"
        onSubmit={createForm.handleSubmit(onCreateSubmit)}
        submitLabel="Ajouter"
        isSubmitting={createMutation.isPending}
      >
        <PrestationForm form={createForm} categoryOptions={categoryOptions} />
      </CrudModal>

      {/* Modal édition */}
      <CrudModal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelectedPrestation(null);
          editForm.reset();
        }}
        title="Modifier la prestation"
        size="lg"
        onSubmit={editForm.handleSubmit(onEditSubmit)}
        submitLabel="Mettre à jour"
        isSubmitting={updateMutation.isPending}
      >
        <PrestationForm form={editForm} categoryOptions={categoryOptions} />
      </CrudModal>

      {/* Modal confirmation suppression */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        title="Supprimer cette prestation"
        message={
          deleteTarget
            ? `Voulez-vous vraiment supprimer la prestation "${deleteTarget.name}" ? Cette action est irréversible.`
            : ""
        }
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
