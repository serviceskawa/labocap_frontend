"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
import {
  CategoryForm,
  categorySchema,
  type CategoryFormData,
} from "@/components/examens/CategoryForm";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { categoryTestsApi, type CategoryTest } from "@/lib/api/examens";
import type { PageResponse, ApiError } from "@/types/api";

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CategoriesExamensPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  // --- State
  const [search, setSearch] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryTest | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CategoryTest | null>(null);

  // --- Forms
  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    formState: { errors: createErrors },
    reset: resetCreate,
  } = useForm<CategoryFormData>({ resolver: zodResolver(categorySchema) });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    formState: { errors: editErrors },
    reset: resetEdit,
  } = useForm<CategoryFormData>({ resolver: zodResolver(categorySchema) });

  // --- Query
  // Le back ne gère pas la recherche sur les catégories : on charge tout (elles
  // sont peu nombreuses) et on filtre côté client sur le code et le nom.
  const { data, isLoading } = useQuery<PageResponse<CategoryTest>>({
    queryKey: ["category-tests", "all"],
    queryFn: () =>
      categoryTestsApi.findAll({ page: 0, size: 1000 }).then((r) => r.data),
  });

  const allCategories = data?.content ?? [];

  const categories = allCategories.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.code ?? "").toLowerCase().includes(q)
    );
  });

  // --- Mutations
  const createMutation = useMutation({
    mutationFn: (payload: { code: string; name: string }) =>
      categoryTestsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-tests"] });
      toast.success("Catégorie créée avec succès");
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
      payload: { code: string; name: string };
    }) => categoryTestsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-tests"] });
      toast.success("Catégorie modifiée avec succès");
      setEditOpen(false);
      setSelectedCategory(null);
      resetEdit();
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la modification"
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoryTestsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-tests"] });
      toast.success("Catégorie supprimée avec succès");
      setDeleteConfirm(null);
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la suppression"
      );
    },
  });

  // --- Handlers
  const handleOpenEdit = (category: CategoryTest) => {
    setSelectedCategory(category);
    resetEdit({ code: category.code, name: category.name });
    setEditOpen(true);
  };

  const handleCloseCreate = () => {
    setCreateOpen(false);
    resetCreate();
  };

  const handleCloseEdit = () => {
    setEditOpen(false);
    setSelectedCategory(null);
    resetEdit();
  };

  const onCreateSubmit = (formData: CategoryFormData) => {
    createMutation.mutate(formData);
  };

  const onEditSubmit = (formData: CategoryFormData) => {
    if (!selectedCategory) return;
    updateMutation.mutate({ id: selectedCategory.id, payload: formData });
  };

  // --- Columns
  const columns: ColumnDef<CategoryTest>[] = [
    {
      header: "Code",
      accessorKey: "code",
    },
    {
      header: "Nom de la catégorie",
      accessorKey: "name",
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => {
        const actions: RowAction[] = [];
        if (can(PERMISSIONS.EDIT_TESTS)) {
          actions.push({
            label: "Modifier",
            icon: <Pencil className="h-4 w-4" />,
            variant: "edit",
            onClick: () => handleOpenEdit(row.original),
          });
        }
        if (can(PERMISSIONS.DELETE_TESTS)) {
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
        title="Catégories d'examens"
        sticky
        action={
          can(PERMISSIONS.CREATE_TESTS) ? (
            <Button
              onClick={() => setCreateOpen(true)}
              icon={<Plus className="h-4 w-4" />}
            >
              Ajouter une catégorie
            </Button>
          ) : undefined
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

      {/* Modal Création */}
      <CrudModal
        isOpen={createOpen}
        onClose={handleCloseCreate}
        title="Ajouter une catégorie"
        onSubmit={handleSubmitCreate(onCreateSubmit)}
        submitLabel="Ajouter une catégorie"
        isSubmitting={createMutation.isPending}
        closeOnOverlayClick={false}
        closeOnEscape={false}
      >
        <CategoryForm register={registerCreate} errors={createErrors} />
      </CrudModal>

      {/* Modal Édition */}
      <CrudModal
        isOpen={editOpen}
        onClose={handleCloseEdit}
        title="Modifier la catégorie"
        onSubmit={handleSubmitEdit(onEditSubmit)}
        submitLabel="Modifier"
        isSubmitting={updateMutation.isPending}
        closeOnOverlayClick={false}
        closeOnEscape={false}
      >
        <CategoryForm register={registerEdit} errors={editErrors} />
      </CrudModal>

      {/* Confirm suppression */}
      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) deleteMutation.mutate(deleteConfirm.id);
        }}
        title="Supprimer cette catégorie"
        message={
          deleteConfirm
            ? `Voulez-vous vraiment supprimer la catégorie "${deleteConfirm.name}" ? Cette action est irréversible.`
            : ""
        }
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
