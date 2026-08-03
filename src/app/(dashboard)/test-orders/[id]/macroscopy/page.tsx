"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Trash2, BookText } from "lucide-react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";
import type { UseFormReturn } from "react-hook-form";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { IconButton } from "@/components/ui/IconButton";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { testOrdersApi } from "@/lib/api/testOrders";
import { macroscopyApi, PathologyMacro, PathologyMacroRequest } from "@/lib/api/macroscopy";
import type { ApiError } from "@/types/api";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

// ---------------------------------------------------------------------------
// Zod schema — aligné sur TestPathologyMacroRequestDto (title obligatoire)
// ---------------------------------------------------------------------------

const macroSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  content: z.string().optional(),
});

type MacroFormValues = z.infer<typeof macroSchema>;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function MacroscopyPage({ params }: PageProps) {
  const { id: orderId } = use(params);
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<PathologyMacro | null>(null);
  const [search, setSearch] = useState("");

  const canWrite = can(PERMISSIONS.CREATE_MACRO) || can(PERMISSIONS.EDIT_MACRO);

  // ---- Queries ---------------------------------------------------------------

  const { data: order, isLoading: orderLoading } = useQuery({
    queryKey: ["test-order", orderId],
    queryFn: () => testOrdersApi.findById(orderId).then((r) => r.data),
    enabled: !!orderId,
  });

  const { data: macrosData, isLoading: macrosLoading } = useQuery({
    queryKey: ["pathology-macros"],
    queryFn: () => macroscopyApi.findAll({ size: 200 }).then((r) => r.data),
  });

  const macros: PathologyMacro[] = macrosData?.content ?? [];

  const filtered = macros.filter(
    (m) =>
      !search ||
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      (m.content ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // ---- Mutations -------------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (data: PathologyMacroRequest) => macroscopyApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pathology-macros"] });
      toast.success("Macro créée");
      setCreateOpen(false);
      createForm.reset();
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de la création");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PathologyMacroRequest }) =>
      macroscopyApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pathology-macros"] });
      toast.success("Macro mise à jour");
      setEditOpen(false);
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de la mise à jour");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => macroscopyApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pathology-macros"] });
      toast.success("Macro supprimée");
      setDeleteOpen(false);
      setSelected(null);
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de la suppression");
    },
  });

  // ---- Forms ------------------------------------------------------------------

  const createForm = useForm<MacroFormValues>({
    resolver: zodResolver(macroSchema),
    defaultValues: { title: "", content: "" },
  });

  const editForm = useForm<MacroFormValues>({
    resolver: zodResolver(macroSchema),
  });

  // ---- Handlers ---------------------------------------------------------------

  function openEdit(macro: PathologyMacro) {
    setSelected(macro);
    editForm.reset({
      title: macro.title,
      content: macro.content ?? "",
    });
    setEditOpen(true);
  }

  function openDelete(macro: PathologyMacro) {
    setSelected(macro);
    setDeleteOpen(true);
  }

  function onCreateSubmit(values: MacroFormValues) {
    createMutation.mutate({
      title: values.title,
      content: values.content || undefined,
    });
  }

  function onEditSubmit(values: MacroFormValues) {
    if (!selected) return;
    updateMutation.mutate({
      id: selected.id,
      data: { title: values.title, content: values.content || undefined },
    });
  }

  // ---- Columns ----------------------------------------------------------------

  const columns: ColumnDef<PathologyMacro>[] = [
    {
      header: "Titre",
      accessorKey: "title",
      cell: ({ row }) => (
        <span className="font-medium text-gray-900">{row.original.title}</span>
      ),
    },
    {
      header: "Contenu",
      accessorKey: "content",
      cell: ({ row }) => {
        const content = row.original.content ?? "";
        return (
          <span className="text-gray-600 text-xs line-clamp-2">
            {content.length > 120 ? content.slice(0, 120) + "…" : content || "—"}
          </span>
        );
      },
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PermissionGate permission={PERMISSIONS.EDIT_MACRO}>
            <IconButton
              variant="edit"
              title="Modifier"
              aria-label="Modifier"
              onClick={() => openEdit(row.original)}
              icon={<Pencil className="h-4 w-4" />}
            />
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.EDIT_MACRO}>
            <IconButton
              variant="delete"
              title="Supprimer"
              aria-label="Supprimer"
              onClick={() => openDelete(row.original)}
              icon={<Trash2 className="h-4 w-4" />}
            />
          </PermissionGate>
        </div>
      ),
    },
  ];

  // ---- Loading / not found ---------------------------------------------------

  const isLoading = orderLoading || macrosLoading;

  if (orderLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-72 animate-pulse rounded bg-gray-200" />
        <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-gray-500">Demande introuvable.</p>
        <Link
          href="/test-orders"
          className="mt-4 inline-block text-sm text-blue-600 hover:underline"
        >
          Retour aux demandes
        </Link>
      </div>
    );
  }

  if (!can(PERMISSIONS.VIEW_REPORTS)) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-gray-500">
          Vous n&apos;avez pas la permission de consulter les macros anatomopathologiques.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Macros anatomopathologiques — ${order.code ?? "En attente de validation"}`}
        breadcrumbs={[
          { label: "Demandes d'examen", href: "/test-orders" },
          { label: order.code ?? "Sans code", href: `/test-orders/${orderId}/details` },
          { label: "Macros" },
        ]}
        action={
          canWrite ? (
            <button
              onClick={() => {
                createForm.reset();
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <BookText className="h-4 w-4" />
              Nouvelle macro
            </button>
          ) : undefined
        }
      />

      {/* Recherche */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <input
          type="text"
          placeholder="Rechercher une macro par titre ou contenu..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={inputClass + " max-w-md"}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        <DataTable columns={columns} data={filtered} isLoading={isLoading} />
      </div>

      {/* Modal création */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nouvelle macro anatomopathologique"
        size="lg"
        onSubmit={createForm.handleSubmit(onCreateSubmit)}
        submitLabel="Créer"
        isSubmitting={createMutation.isPending}
      >
        <MacroForm form={createForm} />
      </CrudModal>

      {/* Modal édition */}
      <CrudModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Modifier la macro"
        size="lg"
        onSubmit={editForm.handleSubmit(onEditSubmit)}
        submitLabel="Modifier"
        isSubmitting={updateMutation.isPending}
      >
        <MacroForm form={editForm} />
      </CrudModal>

      {/* Modal suppression */}
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setSelected(null);
        }}
        onConfirm={() => {
          if (selected) deleteMutation.mutate(selected.id);
        }}
        title="Supprimer cette macro"
        message={`Voulez-vous vraiment supprimer la macro "${selected?.title ?? ""}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// MacroForm
// ---------------------------------------------------------------------------

interface MacroFormProps {
  form: UseFormReturn<MacroFormValues>;
}

function MacroForm({ form }: MacroFormProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-4">
      <FormField label="Titre" required error={errors.title?.message}>
        <input
          type="text"
          {...register("title")}
          placeholder="Ex : Carcinome épidermoïde"
          className={inputClass}
        />
      </FormField>

      <FormField label="Contenu" error={errors.content?.message}>
        <textarea
          {...register("content")}
          rows={8}
          placeholder="Texte de la macro anatomopathologique..."
          className={`${inputClass} resize-y`}
        />
      </FormField>
    </div>
  );
}
