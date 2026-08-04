"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { typeConsultationsApi, type TypeConsultation } from "@/lib/api/consultations";
import type { PageResponse, ApiError } from "@/types/api";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const typeConsultationSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
});

type TypeConsultationFormData = z.infer<typeof typeConsultationSchema>;

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

interface TypeConsultationFormFieldsProps {
  register: ReturnType<typeof useForm<TypeConsultationFormData>>["register"];
  errors: ReturnType<typeof useForm<TypeConsultationFormData>>["formState"]["errors"];
}

function TypeConsultationFormFields({ register, errors }: TypeConsultationFormFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Nom */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Nom <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          {...register("name")}
          className={inputClass}
        />
        {errors.name && (
          <p className="text-xs text-red-500">{errors.name.message}</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TypesConsultationPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  // --- State
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<TypeConsultation | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TypeConsultation | null>(null);

  // --- Forms
  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    formState: { errors: createErrors },
    reset: resetCreate,
  } = useForm<TypeConsultationFormData>({ resolver: zodResolver(typeConsultationSchema) });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    formState: { errors: editErrors },
    reset: resetEdit,
  } = useForm<TypeConsultationFormData>({ resolver: zodResolver(typeConsultationSchema) });

  // --- Query
  const { data, isLoading } = useQuery<PageResponse<TypeConsultation>>({
    queryKey: ["type-consultations", { page, size: pageSize }],
    queryFn: () =>
      typeConsultationsApi.findAll({ page, size: pageSize }).then((r) => r.data),
  });

  const types = data?.content ?? [];
  const pageCount = data?.totalPages ?? 0;

  // --- Mutations
  const createMutation = useMutation({
    mutationFn: (payload: TypeConsultationFormData) =>
      typeConsultationsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["type-consultations"] });
      toast.success("Type de consultation créé avec succès");
      setCreateOpen(false);
      resetCreate();
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de la création");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: TypeConsultationFormData;
    }) => typeConsultationsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["type-consultations"] });
      toast.success("Type de consultation modifié avec succès");
      setEditOpen(false);
      setSelectedType(null);
      resetEdit();
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la modification"
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => typeConsultationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["type-consultations"] });
      toast.success("Type de consultation supprimé avec succès");
      setDeleteConfirm(null);
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la suppression"
      );
    },
  });

  // --- Handlers
  const handleOpenEdit = (type: TypeConsultation) => {
    setSelectedType(type);
    resetEdit({ name: type.name });
    setEditOpen(true);
  };

  const handleCloseCreate = () => {
    setCreateOpen(false);
    resetCreate();
  };

  const handleCloseEdit = () => {
    setEditOpen(false);
    setSelectedType(null);
    resetEdit();
  };

  const onCreateSubmit = (formData: TypeConsultationFormData) => {
    createMutation.mutate(formData);
  };

  const onEditSubmit = (formData: TypeConsultationFormData) => {
    if (!selectedType) return;
    updateMutation.mutate({ id: selectedType.id, payload: formData });
  };

  // --- Columns
  const columns: ColumnDef<TypeConsultation>[] = [
    {
      header: "Nom",
      accessorKey: "name",
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => {
        const type = row.original;
        return (
          <div className="flex items-center gap-2">
            <PermissionGate permission={PERMISSIONS.MANAGE_SETTINGS}>
              <button
                type="button"
                onClick={() => handleOpenEdit(type)}
                className="inline-flex items-center justify-center rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors"
                title="Modifier"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </PermissionGate>

            <PermissionGate permission={PERMISSIONS.MANAGE_SETTINGS}>
              <button
                type="button"
                onClick={() => setDeleteConfirm(type)}
                className="inline-flex items-center justify-center rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-600 transition-colors"
                title="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </PermissionGate>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Types de consultation"
        action={
          can(PERMISSIONS.MANAGE_SETTINGS) ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Ajouter un type
            </button>
          ) : undefined
        }
      />

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <DataTable
          columns={columns}
          data={types}
          isLoading={isLoading}
          pageCount={pageCount}
          pageIndex={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(0);
          }}
        />
      </div>

      {/* Modal Création */}
      <CrudModal
        isOpen={createOpen}
        onClose={handleCloseCreate}
        title="Ajouter un type de consultation"
        onSubmit={handleSubmitCreate(onCreateSubmit)}
        submitLabel="Ajouter"
        isSubmitting={createMutation.isPending}
      >
        <TypeConsultationFormFields register={registerCreate} errors={createErrors} />
      </CrudModal>

      {/* Modal Édition */}
      <CrudModal
        isOpen={editOpen}
        onClose={handleCloseEdit}
        title="Modifier le type de consultation"
        onSubmit={handleSubmitEdit(onEditSubmit)}
        submitLabel="Modifier"
        isSubmitting={updateMutation.isPending}
      >
        <TypeConsultationFormFields register={registerEdit} errors={editErrors} />
      </CrudModal>

      {/* Confirm suppression */}
      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) deleteMutation.mutate(deleteConfirm.id);
        }}
        title="Supprimer ce type de consultation"
        message={
          deleteConfirm
            ? `Voulez-vous vraiment supprimer le type "${deleteConfirm.name}" ? Cette action est irréversible.`
            : ""
        }
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
