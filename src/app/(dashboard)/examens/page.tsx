"use client";

import { useEffect, useState } from "react";
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
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { NativeSelect } from "@/components/ui/NativeSelect";
import {
  LabTestForm,
  labTestSchema,
  type LabTestFormData,
} from "@/components/examens/LabTestForm";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { formatCFA } from "@/lib/utils";
import {
  labTestsApi,
  categoryTestsApi,
  type LabTest,
  type CategoryTest,
} from "@/lib/api/examens";
import type { PageResponse, ApiError } from "@/types/api";

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ExamensPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  // --- State
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Filtrage en direct : on déclenche la recherche pendant la frappe,
  // avec un léger debounce pour éviter une requête à chaque caractère.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<LabTest | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<LabTest | null>(null);

  // --- Forms
  const {
    register: registerCreate,
    control: controlCreate,
    handleSubmit: handleSubmitCreate,
    formState: { errors: createErrors },
    reset: resetCreate,
  } = useForm<LabTestFormData>({
    resolver: zodResolver(labTestSchema),
    defaultValues: { categoryTestId: "", name: "", price: "", status: "ACTIF" },
  });

  const {
    register: registerEdit,
    control: controlEdit,
    handleSubmit: handleSubmitEdit,
    formState: { errors: editErrors },
    reset: resetEdit,
  } = useForm<LabTestFormData>({ resolver: zodResolver(labTestSchema) });

  // --- Queries
  const { data, isLoading } = useQuery<PageResponse<LabTest>>({
    queryKey: ["lab-tests", { page, size: pageSize, search, status: statusFilter }],
    queryFn: () =>
      labTestsApi
        .findAll({
          page,
          size: pageSize,
          search: search || undefined,
          status: statusFilter || undefined,
        })
        .then((r) => r.data),
  });

  const { data: categoriesData } = useQuery<PageResponse<CategoryTest>>({
    queryKey: ["category-tests-all"],
    queryFn: () =>
      categoryTestsApi.findAll({ size: 200 }).then((r) => r.data),
  });

  const tests = data?.content ?? [];
  const pageCount = data?.totalPages ?? 0;
  const categories = categoriesData?.content ?? [];

  // --- Mutations
  const createMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      price: number;
      categoryTestId: string;
      status: string;
    }) => labTestsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-tests"] });
      toast.success("Examen créé avec succès");
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
      payload: { name: string; price: number; categoryTestId: string; status: string };
    }) => labTestsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-tests"] });
      toast.success("Examen modifié avec succès");
      setEditOpen(false);
      setSelectedTest(null);
      resetEdit();
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la modification"
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => labTestsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-tests"] });
      toast.success("Examen supprimé avec succès");
      setDeleteConfirm(null);
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la suppression"
      );
    },
  });

  // --- Handlers
  const handleOpenEdit = (test: LabTest) => {
    setSelectedTest(test);
    resetEdit({
      categoryTestId: test.categoryTestId,
      name: test.name,
      price: String(test.price ?? ""),
      status: test.status ?? "ACTIF",
    });
    setEditOpen(true);
  };

  const handleCloseCreate = () => {
    setCreateOpen(false);
    resetCreate();
  };

  const handleCloseEdit = () => {
    setEditOpen(false);
    setSelectedTest(null);
    resetEdit();
  };

  const onCreateSubmit = (formData: LabTestFormData) => {
    createMutation.mutate({
      name: formData.name,
      price: Number(formData.price),
      categoryTestId: formData.categoryTestId,
      status: formData.status,
    });
  };

  const onEditSubmit = (formData: LabTestFormData) => {
    if (!selectedTest) return;
    updateMutation.mutate({
      id: selectedTest.id,
      payload: {
        name: formData.name,
        price: Number(formData.price),
        categoryTestId: formData.categoryTestId,
        status: formData.status,
      },
    });
  };

  // --- Columns
  const columns: ColumnDef<LabTest>[] = [
    {
      header: "Nom",
      accessorKey: "name",
    },
    {
      header: "Catégorie",
      accessorKey: "categoryTestName",
    },
    {
      header: "Prix",
      id: "price",
      cell: ({ row }) => formatCFA(row.original.price),
    },
    {
      header: "Statut",
      id: "status",
      cell: ({ row }) => (
        <StatusBadge status={row.original.status} domain="general" />
      ),
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
        title="Catalogue d'examens"
        sticky
        action={
          can(PERMISSIONS.CREATE_TESTS) ? (
            <Button
              onClick={() => setCreateOpen(true)}
              icon={<Plus className="h-4 w-4" />}
            >
              Ajouter un examen
            </Button>
          ) : undefined
        }
      />

      <DataTableCard
        columns={columns}
        data={tests}
        isLoading={isLoading}
        pageCount={pageCount}
        pageIndex={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(0);
        }}
        filters={
          <>
            <SearchInput
              className="max-w-xs w-full"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <NativeSelect
              className="w-44"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Tous</option>
              <option value="ACTIF">ACTIF</option>
              <option value="INACTIF">INACTIF</option>
            </NativeSelect>
          </>
        }
      />

      {/* Modal Création */}
      <CrudModal
        isOpen={createOpen}
        onClose={handleCloseCreate}
        title="Ajouter un examen"
        onSubmit={handleSubmitCreate(onCreateSubmit)}
        submitLabel="Ajouter un examen"
        isSubmitting={createMutation.isPending}
        closeOnOverlayClick={false}
        closeOnEscape={false}
      >
        <LabTestForm
          register={registerCreate}
          control={controlCreate}
          errors={createErrors}
          categories={categories}
        />
      </CrudModal>

      {/* Modal Édition */}
      <CrudModal
        isOpen={editOpen}
        onClose={handleCloseEdit}
        title="Modifier l'examen"
        onSubmit={handleSubmitEdit(onEditSubmit)}
        submitLabel="Modifier"
        isSubmitting={updateMutation.isPending}
        closeOnOverlayClick={false}
        closeOnEscape={false}
      >
        <LabTestForm
          register={registerEdit}
          control={controlEdit}
          errors={editErrors}
          categories={categories}
        />
      </CrudModal>

      {/* Confirm suppression */}
      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) deleteMutation.mutate(deleteConfirm.id);
        }}
        title="Supprimer cet examen"
        message={
          deleteConfirm
            ? `Voulez-vous vraiment supprimer l'examen "${deleteConfirm.name}" ? Cette action est irréversible.`
            : ""
        }
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
