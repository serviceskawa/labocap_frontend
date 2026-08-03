"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  supplierCategoriesApi,
  type SupplierCategory,
} from "@/lib/api/suppliers";
import type { ApiError } from "@/types/api";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

// Calque `suppliers/category/create.blade.php` : nom requis, description libre.
const schema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;


const actionBtn =
  "inline-flex h-8 w-9 items-center justify-center rounded-md text-white transition-colors";

function FormFields({
  register,
  errors,
}: {
  register: ReturnType<typeof useForm<FormData>>["register"];
  errors: ReturnType<typeof useForm<FormData>>["formState"]["errors"];
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-right text-sm text-gray-600">
        <span className="text-red-600">*</span>champs obligatoires
      </p>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Nom de la catégorie <span className="text-red-500">*</span>
        </label>
        <input type="text" {...register("name")} className={inputClass} />
        {errors.name && (
          <p className="text-xs text-red-500">{errors.name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Description</label>
        <textarea rows={5} {...register("description")} className={inputClass} />
      </div>
    </div>
  );
}

export default function SupplierCategoriesPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<SupplierCategory | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<SupplierCategory | null>(
    null,
  );

  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    formState: { errors: createErrors },
    reset: resetCreate,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    formState: { errors: editErrors },
    reset: resetEdit,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const { data: categories = [], isLoading } = useQuery<SupplierCategory[]>({
    queryKey: ["supplier-categories"],
    queryFn: () => supplierCategoriesApi.findAll().then((r) => r.data),
  });

  function apiError(err: AxiosError<ApiError>) {
    toast.error(err.response?.data?.message ?? "Erreur d'enrégistrement");
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["supplier-categories"] });
  }

  const createMutation = useMutation({
    mutationFn: (payload: FormData) =>
      supplierCategoriesApi.create({
        name: payload.name,
        description: payload.description || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success(" Opération effectuée avec succès  ! ");
      setCreateOpen(false);
      resetCreate();
    },
    onError: apiError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: FormData }) =>
      supplierCategoriesApi.update(id, {
        name: payload.name,
        description: payload.description || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success(" Mise à jour effectuée avec succès  ! ");
      setEditOpen(false);
      setSelected(null);
      resetEdit();
    },
    onError: apiError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => supplierCategoriesApi.delete(id),
    onSuccess: () => {
      invalidate();
      toast.success("    Un élement a été supprimé ! ");
      setDeleteConfirm(null);
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ??
          "Impossible de supprimer cet élément !  Celui-ci est lié à d'autres éléments. Pour effectuer cette suppression, vous devez d'abord supprimer ou mettre à jour les éléments liés dans d'autres tables.",
      );
    },
  });

  function openEdit(category: SupplierCategory) {
    setSelected(category);
    resetEdit({
      name: category.name,
      description: category.description ?? "",
    });
    setEditOpen(true);
  }

  const columns: ColumnDef<SupplierCategory>[] = [
    {
      header: "#",
      id: "index",
      enableSorting: false,
      cell: ({ row }) => row.index + 1,
    },
    {
      header: "Nom de la catégorie",
      accessorKey: "name",
    },
    {
      header: "Description",
      accessorKey: "description",
      cell: ({ row }) => row.original.description ?? "",
    },
    {
      header: "Actions",
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PermissionGate permission={PERMISSIONS.EDIT_SUPPLIER_CATEGORIES}>
            <button
              type="button"
              onClick={() => openEdit(row.original)}
              className={`${actionBtn} bg-blue-600 hover:bg-blue-700`}
              title="Modifier"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.DELETE_SUPPLIER_CATEGORIES}>
            <button
              type="button"
              onClick={() => setDeleteConfirm(row.original)}
              className={`${actionBtn} bg-red-500 hover:bg-red-600`}
              title="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </PermissionGate>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catégories de fournisseur"
        action={
          can(PERMISSIONS.CREATE_SUPPLIER_CATEGORIES) ? (
            <button
              type="button"
              onClick={() => {
                resetCreate();
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Ajouter une nouvelle catégorie
            </button>
          ) : undefined
        }
      />

      <DataTable
        title="Liste des catégories de fournisseurs"
        columns={columns}
        data={categories}
        isLoading={isLoading}
      />

      {/* Modal création */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => {
          setCreateOpen(false);
          resetCreate();
        }}
        title="Ajouter une nouvelle catégorie"
        onSubmit={handleSubmitCreate((d) => createMutation.mutate(d))}
        submitLabel="Ajouter une nouvelle catégorie"
        isSubmitting={createMutation.isPending}
      >
        <FormFields register={registerCreate} errors={createErrors} />
      </CrudModal>

      {/* Modal édition — le titre reprend celui du Blade Laravel. */}
      <CrudModal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelected(null);
          resetEdit();
        }}
        title="Modifier la catégorie d'examen"
        onSubmit={handleSubmitEdit((d) => {
          if (selected) updateMutation.mutate({ id: selected.id, payload: d });
        })}
        submitLabel="Mettre à jour"
        isSubmitting={updateMutation.isPending}
      >
        <FormFields register={registerEdit} errors={editErrors} />
      </CrudModal>

      {/* Confirmation suppression */}
      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) deleteMutation.mutate(deleteConfirm.id);
        }}
        title="Voulez-vous supprimer l'élément ?"
        message={`Catégorie : ${deleteConfirm?.name ?? ""}`}
        confirmLabel="Oui"
        cancelLabel="Non !"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
