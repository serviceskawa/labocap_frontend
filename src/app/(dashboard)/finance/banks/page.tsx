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
import { banksApi, type Bank } from "@/lib/api/banks";
import type { PageResponse, ApiError } from "@/types/api";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

const schema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  accountNumber: z.string().optional(),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function FormFields({
  register,
  errors,
}: {
  register: ReturnType<typeof useForm<FormData>>["register"];
  errors: ReturnType<typeof useForm<FormData>>["formState"]["errors"];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Nom de la banque <span className="text-red-500">*</span>
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
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Numéro de compte</label>
        <input
          type="text"
          {...register("accountNumber")}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Description</label>
        <textarea
          rows={2}
          {...register("description")}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}

export default function BanksPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<Bank | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Bank | null>(null);

  const createForm = useForm<FormData>({ resolver: zodResolver(schema) });
  const editForm = useForm<FormData>({ resolver: zodResolver(schema) });

  const { data, isLoading } = useQuery<PageResponse<Bank>>({
    queryKey: ["banks", { page, size: pageSize }],
    queryFn: () => banksApi.findAll({ page, size: pageSize }).then((r) => r.data),
  });

  const items = data?.content ?? [];
  const pageCount = data?.totalPages ?? 0;

  const createMutation = useMutation({
    mutationFn: (d: FormData) => banksApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banks"] });
      toast.success("Banque créée");
      setCreateOpen(false);
      createForm.reset();
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur lors de la création"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: FormData }) =>
      banksApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banks"] });
      toast.success("Banque modifiée");
      setEditOpen(false);
      setSelected(null);
      editForm.reset();
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur lors de la modification"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => banksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banks"] });
      toast.success("Banque supprimée");
      setDeleteConfirm(null);
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur lors de la suppression"),
  });

  const handleOpenEdit = (item: Bank) => {
    setSelected(item);
    editForm.reset({
      name: item.name,
      accountNumber: item.accountNumber ?? "",
      description: item.description ?? "",
    });
    setEditOpen(true);
  };

  const columns: ColumnDef<Bank>[] = [
    { header: "Nom", accessorKey: "name" },
    {
      header: "Numéro de compte",
      accessorKey: "accountNumber",
      cell: ({ row }) => row.original.accountNumber ?? "—",
    },
    {
      header: "Description",
      accessorKey: "description",
      cell: ({ row }) => row.original.description ?? "—",
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PermissionGate permission={PERMISSIONS.MANAGE_FINANCE}>
            <button
              type="button"
              onClick={() => handleOpenEdit(row.original)}
              className="inline-flex items-center justify-center rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors"
              title="Modifier"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.MANAGE_FINANCE}>
            <button
              type="button"
              onClick={() => setDeleteConfirm(row.original)}
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comptes bancaires"
        action={
          can(PERMISSIONS.MANAGE_FINANCE) ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Ajouter une banque
            </button>
          ) : undefined
        }
      />

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <DataTable
          columns={columns}
          data={items}
          isLoading={isLoading}
          pageCount={pageCount}
          pageIndex={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
        />
      </div>

      <CrudModal
        isOpen={createOpen}
        onClose={() => { setCreateOpen(false); createForm.reset(); }}
        title="Ajouter une banque"
        onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d))}
        submitLabel="Ajouter"
        isSubmitting={createMutation.isPending}
      >
        <FormFields register={createForm.register} errors={createForm.formState.errors} />
      </CrudModal>

      <CrudModal
        isOpen={editOpen}
        onClose={() => { setEditOpen(false); setSelected(null); editForm.reset(); }}
        title="Modifier la banque"
        onSubmit={editForm.handleSubmit((d) => {
          if (selected) updateMutation.mutate({ id: selected.id, payload: d });
        })}
        submitLabel="Modifier"
        isSubmitting={updateMutation.isPending}
      >
        <FormFields register={editForm.register} errors={editForm.formState.errors} />
      </CrudModal>

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => { if (deleteConfirm) deleteMutation.mutate(deleteConfirm.id); }}
        title="Supprimer cette banque"
        message={deleteConfirm ? `Voulez-vous supprimer "${deleteConfirm.name}" ?` : ""}
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
