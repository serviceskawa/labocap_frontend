"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ClipboardPen } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTableCard } from "@/components/common/DataTableCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RowActions } from "@/components/ui/RowActions";
import { BiologyKindBadge } from "@/components/biology/BiologyKindBadge";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";
import { formatDate, formatDateTime } from "@/lib/utils";
import { categoryTestsApi, type CategoryTest } from "@/lib/api/examens";
import {
  biologyResultsApi,
  biologyResultsKeys,
  type BiologyAnalysisStatus,
  type BiologyWorklistParams,
  type BiologyWorklistRow,
} from "@/lib/api/biologyResults";
import type { PageResponse } from "@/types/api";

const resultsHref = (row: BiologyWorklistRow) =>
  `/biologie/resultats/${row.testOrderId}?analyse=${row.labTestId}`;

/**
 * Liste de travail de la saisie des résultats de biologie : une ligne par
 * analyse d'un bon validé, urgences d'abord puis les plus anciennes (ordre du
 * serveur). Un clic ouvre la feuille de saisie du bon, sur l'analyse cliquée.
 */
export default function BiologieResultatsPage() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<BiologyAnalysisStatus | "">("");
  const [categoryId, setCategoryId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const params: BiologyWorklistParams = {
    page,
    size: pageSize,
    status: status || undefined,
    categoryId: categoryId || undefined,
    from: from || undefined,
    to: to || undefined,
  };

  const { data, isLoading } = useQuery<PageResponse<BiologyWorklistRow>>({
    queryKey: biologyResultsKeys.worklist(params),
    queryFn: () => biologyResultsApi.worklist(params).then((r) => r.data),
  });

  const { data: categories } = useQuery<PageResponse<CategoryTest>>({
    queryKey: ["category-tests", "BIOLOGY", "all"],
    queryFn: () =>
      categoryTestsApi.findAll({ page: 0, size: 1000, discipline: "BIOLOGY" }).then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  const columns = useMemo<ColumnDef<BiologyWorklistRow>[]>(
    () => [
      {
        header: "Demande",
        id: "order",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap font-medium text-gray-800">{row.original.orderCode ?? "—"}</span>
            {row.original.urgent && <Badge variant="danger">Urgent</Badge>}
          </div>
        ),
      },
      {
        header: "Créée le",
        id: "createdAt",
        cell: ({ row }) => (row.original.orderCreatedAt ? formatDate(row.original.orderCreatedAt) : "—"),
      },
      {
        header: "Patient",
        id: "patient",
        cell: ({ row }) => (
          <div>
            <div className="whitespace-nowrap text-gray-800">{row.original.patientName ?? "—"}</div>
            {row.original.patientCode && <div className="text-xs text-gray-400">{row.original.patientCode}</div>}
          </div>
        ),
      },
      {
        header: "Analyse",
        id: "analysis",
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-gray-800">{row.original.labTestName ?? "—"}</span>
            <BiologyKindBadge kind={row.original.kind} />
          </div>
        ),
      },
      { header: "Catégorie", id: "category", cell: ({ row }) => row.original.categoryName ?? "—" },
      {
        header: "Saisie",
        id: "status",
        cell: ({ row }) => <StatusBadge status={row.original.status} domain="biologyAnalysis" />,
      },
      {
        header: "Compte rendu",
        id: "report",
        cell: ({ row }) => <StatusBadge status={row.original.reportStatus} domain="biologyReport" />,
      },
      {
        header: "Dernière saisie",
        id: "enteredAt",
        cell: ({ row }) => (row.original.enteredAt ? formatDateTime(row.original.enteredAt) : "—"),
      },
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => (
          <RowActions
            actions={[
              {
                label: "Saisir les résultats",
                icon: <ClipboardPen className="h-4 w-4" />,
                variant: "edit",
                href: resultsHref(row.original),
              },
            ]}
          />
        ),
      },
    ],
    [],
  );

  const hasFilters = !!(status || categoryId || from || to);
  const resetPage = () => setPage(0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Résultats de biologie"
        breadcrumbs={[{ label: "Accueil", href: "/home" }, { label: "Biologie" }, { label: "Résultats" }]}
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
          resetPage();
        }}
        onRowClick={(row) => router.push(resultsHref(row))}
        hideToolbarSearch
        emptyTitle="Aucune analyse à afficher"
        emptyDescription={
          hasFilters
            ? "Aucune analyse ne correspond aux filtres."
            : "Les analyses des demandes de biologie validées apparaîtront ici."
        }
        filters={
          <>
            <div className="w-52">
              <label htmlFor="worklist-status" className="mb-1 block text-xs font-medium text-gray-600">
                Saisie
              </label>
              <NativeSelect
                id="worklist-status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as BiologyAnalysisStatus | "");
                  resetPage();
                }}
              >
                <option value="">Tous les états</option>
                <option value="PENDING">À saisir</option>
                <option value="ENTERED">Saisie</option>
                <option value="TECH_VALIDATED">Validée techniquement</option>
              </NativeSelect>
            </div>
            <div className="w-56">
              <label htmlFor="worklist-category" className="mb-1 block text-xs font-medium text-gray-600">
                Catégorie
              </label>
              <NativeSelect
                id="worklist-category"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  resetPage();
                }}
              >
                <option value="">Toutes les catégories</option>
                {(categories?.content ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="w-44">
              <label htmlFor="worklist-from" className="mb-1 block text-xs font-medium text-gray-600">
                Du
              </label>
              <input
                id="worklist-from"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => {
                  setFrom(e.target.value);
                  resetPage();
                }}
                className={inputClass}
              />
            </div>
            <div className="w-44">
              <label htmlFor="worklist-to" className="mb-1 block text-xs font-medium text-gray-600">
                Au
              </label>
              <input
                id="worklist-to"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => {
                  setTo(e.target.value);
                  resetPage();
                }}
                className={inputClass}
              />
            </div>
            {hasFilters && (
              <div className="self-end">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStatus("");
                    setCategoryId("");
                    setFrom("");
                    setTo("");
                    resetPage();
                  }}
                >
                  Réinitialiser
                </Button>
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
