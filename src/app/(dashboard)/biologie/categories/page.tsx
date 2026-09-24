"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, ListPlus } from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTableCard } from "@/components/common/DataTableCard";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { RowActions, type RowAction } from "@/components/ui/RowActions";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { TextInput } from "@/components/ui/TextInput";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { categoryTestsApi, type CategoryTest } from "@/lib/api/examens";
import { biologyCategoriesApi } from "@/lib/api/biologyCatalog";
import { getApiErrorMessage } from "@/lib/api/errorMessages";
import type { ApiError, PageResponse } from "@/types/api";

/**
 * Catégories d'analyses de biologie (discipline BIOLOGY).
 *
 * Même écran que /examens/categories, restreint à la biologie : le backend
 * refuse de ranger une analyse dans une catégorie d'une autre discipline.
 * Le code est facultatif ici (les catégories par défaut n'en ont pas) — la
 * règle des deux caractères reste propre à l'anatomie pathologique.
 */

const schema = z.object({
  code: z.string().trim().max(10, "Le code ne doit pas dépasser 10 caractères"),
  name: z.string().trim().min(1, "Le nom est requis"),
});
type FormData = z.infer<typeof schema>;

const EMPTY: FormData = { code: "", name: "" };

export default function BiologieCategoriesPage() {
  const { can, canAll } = usePermissions();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ mode: "create" | "edit"; item?: CategoryTest } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CategoryTest | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  // Toutes les écritures du catalogue sont gardées par `edit-tests` côté API ;
  // on exige en plus le droit d'action propre au bouton, comme /examens.
  const canCreate = canAll(PERMISSIONS.CREATE_TESTS, PERMISSIONS.EDIT_TESTS);
  const canEdit = can(PERMISSIONS.EDIT_TESTS);
  const canDelete = canAll(PERMISSIONS.DELETE_TESTS, PERMISSIONS.EDIT_TESTS);

  const { data, isLoading } = useQuery<PageResponse<CategoryTest>>({
    queryKey: ["category-tests", "BIOLOGY", "all"],
    queryFn: () =>
      categoryTestsApi
        .findAll({ page: 0, size: 1000, discipline: "BIOLOGY" })
        .then((r) => r.data),
  });

  const q = search.trim().toLowerCase();
  const categories = (data?.content ?? []).filter(
    (c) =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.code ?? "").toLowerCase().includes(q),
  );

  const onError = (fallback: string) => (err: AxiosError<ApiError>) =>
    toast.error(getApiErrorMessage(err, fallback));

  const saveMutation = useMutation({
    mutationFn: (values: FormData) => {
      const payload = {
        name: values.name,
        code: values.code || null,
        discipline: "BIOLOGY" as const,
      };
      return modal?.mode === "edit" && modal.item
        ? categoryTestsApi.update(modal.item.id, payload)
        : categoryTestsApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-tests"] });
      toast.success(
        modal?.mode === "edit" ? "Catégorie modifiée avec succès" : "Catégorie créée avec succès",
      );
      setModal(null);
      reset(EMPTY);
    },
    onError: onError("Erreur lors de l'enregistrement"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoryTestsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-tests"] });
      toast.success("Catégorie supprimée avec succès");
      setDeleteConfirm(null);
    },
    onError: onError("Erreur lors de la suppression"),
  });

  const defaultsMutation = useMutation({
    mutationFn: () => biologyCategoriesApi.createDefaults(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-tests"] });
      toast.success("Catégories par défaut en place");
    },
    onError: onError("Erreur lors de la création des catégories par défaut"),
  });

  const openCreate = () => {
    reset(EMPTY);
    setModal({ mode: "create" });
  };
  const openEdit = (item: CategoryTest) => {
    reset({ code: item.code ?? "", name: item.name });
    setModal({ mode: "edit", item });
  };
  const closeModal = () => {
    setModal(null);
    reset(EMPTY);
  };

  const columns: ColumnDef<CategoryTest>[] = [
    { header: "Code", id: "code", cell: ({ row }) => row.original.code || "—" },
    { header: "Nom de la catégorie", accessorKey: "name" },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => {
        const actions: RowAction[] = [];
        if (canEdit) {
          actions.push({
            label: "Modifier",
            icon: <Pencil className="h-4 w-4" />,
            variant: "edit",
            onClick: () => openEdit(row.original),
          });
        }
        if (canDelete) {
          actions.push({
            label: "Supprimer",
            icon: <Trash2 className="h-4 w-4" />,
            variant: "delete",
            onClick: () => setDeleteConfirm(row.original),
          });
        }
        return <RowActions actions={actions} />;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catégories de biologie"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Biologie" },
          { label: "Catégories" },
        ]}
        action={
          <div className="flex flex-wrap gap-2">
            {canCreate && (
              <Button
                variant="secondary"
                icon={<ListPlus className="h-4 w-4" />}
                onClick={() => defaultsMutation.mutateAsync().catch(() => undefined)}
              >
                Créer les catégories par défaut
              </Button>
            )}
            {canCreate && (
              <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                Ajouter une catégorie
              </Button>
            )}
          </div>
        }
      />

      <DataTableCard
        columns={columns}
        data={categories}
        isLoading={isLoading}
        hideToolbarSearch
        filters={
          <SearchInput
            className="max-w-xs w-full"
            placeholder="Rechercher par code ou nom…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        }
      />

      <CrudModal
        isOpen={modal !== null}
        onClose={closeModal}
        title={modal?.mode === "edit" ? "Modifier la catégorie" : "Ajouter une catégorie"}
        onSubmit={handleSubmit((v) => saveMutation.mutateAsync(v).catch(() => undefined))}
        submitLabel={modal?.mode === "edit" ? "Modifier" : "Ajouter"}
        isSubmitting={saveMutation.isPending}
      >
        <form noValidate className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
          <FormField label="Code" error={errors.code?.message} hint="Facultatif — ex. : HEM">
            <TextInput maxLength={10} {...register("code")} error={!!errors.code} />
          </FormField>
          <FormField label="Nom" required error={errors.name?.message}>
            <TextInput {...register("name")} error={!!errors.name} />
          </FormField>
        </form>
      </CrudModal>

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) deleteMutation.mutate(deleteConfirm.id);
        }}
        title="Supprimer cette catégorie"
        message={
          deleteConfirm
            ? `Voulez-vous vraiment supprimer la catégorie « ${deleteConfirm.name} » ? Cette action est irréversible.`
            : ""
        }
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
