"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTableCard } from "@/components/common/DataTableCard";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { RowActions, type RowAction } from "@/components/ui/RowActions";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { BiologyKindBadge } from "@/components/biology/BiologyKindBadge";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { formatCFA } from "@/lib/utils";
import { labTestsApi, type LabTest } from "@/lib/api/examens";
import { getApiErrorMessage } from "@/lib/api/errorMessages";
import type { ApiError, PageResponse } from "@/types/api";

/**
 * Catalogue des analyses de biologie (discipline BIOLOGY). La liste
 * d'anatomie pathologique (/examens) n'en montre aucune : le backend filtre
 * par discipline, PATHOLOGY par défaut.
 */
export default function BiologieExamensPage() {
  const { can, canAll } = usePermissions();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<LabTest | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useQuery<PageResponse<LabTest>>({
    queryKey: ["lab-tests", "BIOLOGY", { page, size: pageSize, search, status: statusFilter }],
    queryFn: () =>
      labTestsApi
        .findAll({
          page,
          size: pageSize,
          search: search || undefined,
          status: statusFilter || undefined,
          discipline: "BIOLOGY",
        })
        .then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => labTestsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-tests"] });
      toast.success("Examen supprimé avec succès");
      setDeleteConfirm(null);
    },
    onError: (err: AxiosError<ApiError>) =>
      toast.error(getApiErrorMessage(err, "Erreur lors de la suppression")),
  });

  const canEdit = can(PERMISSIONS.EDIT_TESTS);
  const canDelete = canAll(PERMISSIONS.DELETE_TESTS, PERMISSIONS.EDIT_TESTS);

  const columns: ColumnDef<LabTest>[] = [
    { header: "Code", id: "code", cell: ({ row }) => row.original.code || "—" },
    {
      header: "Nom",
      id: "name",
      cell: ({ row }) => (
        <Link
          href={`/biologie/examens/${row.original.id}`}
          className="font-medium text-gray-800 hover:text-blue-600"
        >
          {row.original.name}
        </Link>
      ),
    },
    { header: "Nature", id: "kind", cell: ({ row }) => <BiologyKindBadge kind={row.original.biologyKind} /> },
    { header: "Catégorie", id: "category", cell: ({ row }) => row.original.categoryTestName || "—" },
    { header: "Échantillon", id: "specimen", cell: ({ row }) => row.original.specimenType || "—" },
    { header: "Prix", id: "price", cell: ({ row }) => formatCFA(row.original.price) },
    {
      header: "Statut",
      id: "status",
      cell: ({ row }) => <StatusBadge status={row.original.status} domain="general" />,
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => {
        const actions: RowAction[] = [
          {
            label: canEdit ? "Modifier" : "Consulter",
            icon: <Pencil className="h-4 w-4" />,
            variant: "edit",
            href: `/biologie/examens/${row.original.id}`,
          },
        ];
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
        title="Examens de biologie"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Biologie" },
          { label: "Examens" },
        ]}
        action={
          canAll(PERMISSIONS.CREATE_TESTS, PERMISSIONS.EDIT_TESTS) ? (
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => router.push("/biologie/examens/nouveau")}
            >
              Ajouter un examen
            </Button>
          ) : undefined
        }
      />

      <DataTableCard
        columns={columns}
        data={data?.content ?? []}
        isLoading={isLoading}
        pageCount={data?.totalPages ?? 0}
        pageIndex={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(0);
        }}
        hideToolbarSearch
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
              <option value="">Tous les statuts</option>
              <option value="ACTIF">Actif</option>
              <option value="INACTIF">Inactif</option>
            </NativeSelect>
          </>
        }
      />

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) deleteMutation.mutate(deleteConfirm.id);
        }}
        title="Supprimer cet examen"
        message={
          deleteConfirm
            ? `Voulez-vous vraiment supprimer l'examen « ${deleteConfirm.name} » ? Sa fiche de paramètres sera supprimée avec lui.`
            : ""
        }
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
