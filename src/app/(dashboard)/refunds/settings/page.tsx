"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { refundReasonsApi, type RefundReason } from "@/lib/api/refunds";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const actionBtn =
  "inline-flex h-8 w-9 items-center justify-center rounded-md text-white transition-colors";

// Le textarea Laravel ne porte pas `required`, mais l'API rejette un libellé
// vide (`@NotBlank` sur RefundReasonRequestDto) : sans garde-fou ici, un envoi
// à vide repartait en 400 et l'utilisateur ne voyait qu'un toast « Erreur de
// validation », sans savoir quel champ corriger.
const reasonSchema = z.object({
  label: z.string().trim().min(1, "Veuillez renseigner la description de la raison"),
});

type ReasonFormValues = z.infer<typeof reasonSchema>;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RefundReasonsSettingsPage() {
  return (
    <PermissionGate permission={PERMISSIONS.VIEW_REFUNDS}>
      <RefundReasonsContent />
    </PermissionGate>
  );
}

function RefundReasonsContent() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<RefundReason | null>(null);
  const [deleteReason, setDeleteReason] = useState<RefundReason | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["refund-reasons"],
    queryFn: () => refundReasonsApi.findAll().then((r) => r.data),
  });

  const reasons: RefundReason[] = Array.isArray(data) ? data : [];

  const createForm = useForm<ReasonFormValues>({
    resolver: zodResolver(reasonSchema),
    defaultValues: { label: "" },
  });

  const editForm = useForm<ReasonFormValues>({
    resolver: zodResolver(reasonSchema),
  });

  function apiError(err: AxiosError) {
    toast.error(
      (err.response?.data as { message?: string })?.message ??
        "Erreur d'enrégistrement",
    );
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["refund-reasons"] });
  }

  const createMutation = useMutation({
    mutationFn: (values: ReasonFormValues) => refundReasonsApi.create(values),
    onSuccess: () => {
      invalidate();
      toast.success("Raison enregistrée avec success");
      setCreateOpen(false);
      createForm.reset();
    },
    onError: apiError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: ReasonFormValues }) =>
      refundReasonsApi.update(id, values),
    onSuccess: () => {
      invalidate();
      toast.success("Mis à jour éffectué avec success");
      setEditOpen(false);
      setSelected(null);
    },
    onError: apiError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => refundReasonsApi.delete(id),
    onSuccess: () => {
      invalidate();
      toast.success("Suppression éffectuée avec success");
      setDeleteReason(null);
    },
    onError: apiError,
  });

  function openEdit(reason: RefundReason) {
    setSelected(reason);
    editForm.reset({ label: reason.label });
    setEditOpen(true);
  }

  const columns: ColumnDef<RefundReason>[] = [
    {
      header: "#",
      id: "index",
      enableSorting: false,
      cell: ({ row }) => row.index + 1,
    },
    {
      // La colonne du Blade s'intitule « Description » (champ `label` en base).
      header: "Description",
      accessorKey: "label",
    },
    {
      header: "Actions",
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PermissionGate permission={PERMISSIONS.EDIT_REFUND_REASONS}>
            <button
              onClick={() => openEdit(row.original)}
              className={`${actionBtn} bg-blue-600 hover:bg-blue-700`}
              aria-label="Modifier"
              title="Modifier"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.DELETE_REFUND_REASONS}>
            <button
              onClick={() => setDeleteReason(row.original)}
              className={`${actionBtn} bg-red-500 hover:bg-red-600`}
              aria-label="Supprimer"
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
        title="Paramètre de remboursement"
        action={
          can(PERMISSIONS.CREATE_REFUND_REASONS) ? (
            <button
              onClick={() => {
                createForm.reset();
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Ajouter une nouvelle raison
            </button>
          ) : undefined
        }
      />

      <DataTable
        title="Liste des raisons"
        columns={columns}
        data={reasons}
        isLoading={isLoading}
      />

      {/* Modal création */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Ajouter une nouvelle raison"
        onSubmit={createForm.handleSubmit((v) => createMutation.mutate(v))}
        submitLabel="Ajouter une nouvelle raison"
        isSubmitting={createMutation.isPending}
      >
        <ReasonForm form={createForm} />
      </CrudModal>

      {/* Modal édition */}
      <CrudModal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelected(null);
        }}
        title="Modifier la raison"
        onSubmit={editForm.handleSubmit((v) => {
          if (selected) updateMutation.mutate({ id: selected.id, values: v });
        })}
        submitLabel="Mettre à jour"
        isSubmitting={updateMutation.isPending}
      >
        <ReasonForm form={editForm} />
      </CrudModal>

      {/* Confirmation suppression */}
      <ConfirmModal
        isOpen={deleteReason !== null}
        onClose={() => setDeleteReason(null)}
        onConfirm={() => {
          if (deleteReason) deleteMutation.mutate(deleteReason.id);
        }}
        title="Voulez-vous supprimer l'élément ?"
        message={`Raison : ${deleteReason?.label ?? ""}`}
        confirmLabel="Oui"
        cancelLabel="Non !"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

function ReasonForm({
  form,
}: {
  form: ReturnType<typeof useForm<ReasonFormValues>>;
}) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-4">
      <p className="text-right text-sm text-gray-600">
        <span className="text-red-600">*</span>champs obligatoires
      </p>
      <FormField label="Description de la raison" required error={errors.label?.message}>
        <textarea {...register("label")} rows={5} className={inputClass} />
      </FormField>
    </div>
  );
}
