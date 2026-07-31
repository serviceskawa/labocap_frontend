"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  PaginationState,
  ColumnFiltersState,
} from "@tanstack/react-table";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  TableLengthControl,
  TablePaginationFooter,
} from "@/components/common/TablePagination";

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  // Pagination côté serveur
  pageCount?: number;
  pageIndex?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  // Recherche globale
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  // Options
  isLoading?: boolean;
  rowClassName?: (row: T) => string;
  /** Titre affiché dans la barre d'outils du tableau (optionnel). */
  title?: string;
  /**
   * Masque le champ de recherche intégré à la barre d'outils. À utiliser quand
   * la page fournit sa propre recherche (ex. `SearchInput` dans le slot filtres),
   * pour éviter d'afficher deux champs de recherche.
   */
  hideToolbarSearch?: boolean;
  /**
   * Masque la barre d'outils du tableau (Actualiser · Réduire · Fermer). À utiliser
   * quand la page englobe déjà le tableau dans une carte qui fournit ces actions
   * (ex. `WidgetCard` de « Mon espace »), pour éviter des boutons en double.
   */
  hideToolbar?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  pageCount,
  pageIndex: controlledPageIndex,
  pageSize: controlledPageSize,
  onPageChange,
  onPageSizeChange,
  searchValue,
  onSearchChange,
  isLoading = false,
  rowClassName,
  title,
  hideToolbarSearch = false,
  hideToolbar = false,
}: DataTableProps<T>) {
  const isServerSide = pageCount !== undefined;

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [localSearch, setLocalSearch] = useState("");


  const [localPagination, setLocalPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const pagination: PaginationState = isServerSide
    ? { pageIndex: controlledPageIndex ?? 0, pageSize: controlledPageSize ?? 10 }
    : localPagination;

  const table = useReactTable({
    data,
    columns,
    pageCount: isServerSide ? pageCount : undefined,
    state: {
      sorting,
      columnFilters,
      pagination,
      globalFilter: isServerSide ? undefined : (onSearchChange ? searchValue : localSearch),
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: isServerSide
      ? (updater) => {
          const next =
            typeof updater === "function" ? updater(pagination) : updater;
          if (next.pageIndex !== pagination.pageIndex) {
            onPageChange?.(next.pageIndex);
          }
          if (next.pageSize !== pagination.pageSize) {
            onPageSizeChange?.(next.pageSize);
          }
        }
      : setLocalPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualPagination: isServerSide,
    manualFiltering: isServerSide && !!onSearchChange,
  });

  const currentPageIndex = table.getState().pagination.pageIndex;
  const currentPageSize = table.getState().pagination.pageSize;
  const totalPages = table.getPageCount();

  const handleSearchChange = (value: string) => {
    if (onSearchChange) {
      onSearchChange(value);
    } else {
      setLocalSearch(value);
      table.setGlobalFilter(value);
    }
  };

  // Contrôles partagés avec les tableaux écrits à la main (voir
  // `TablePagination`) : une seule apparence de pagination dans l'application.
  const paginationState = {
    pageIndex: currentPageIndex,
    pageSize: currentPageSize,
    pageCount: totalPages,
    setPageIndex: (index: number) => table.setPageIndex(index),
    setPageSize: (size: number) => {
      if (isServerSide) onPageSizeChange?.(size);
      else table.setPageSize(size);
    },
  };

  const showSearch = !hideToolbarSearch && (onSearchChange !== undefined || !isServerSide);

  return (
    <div className="w-full">
      {/* Titre de la carte. Le trio d'icônes Actualiser · Réduire · Fermer,
          hérité du gabarit Hyper, a été retiré : sans utilité ici, et le bouton
          « Fermer » faisait disparaître un tableau sans moyen de le rétablir
          autrement qu'en rechargeant la page. */}
      {!hideToolbar && title && (
        <div className="relative">
          <h5 className="mb-0 text-[.9375rem] font-semibold text-gray-800">{title}</h5>
        </div>
      )}

      <div className={cn(!hideToolbar && "pt-3")}>
        {/* Contrôles : « Afficher [x] enregistrements par page » (gauche) + « Rechercher: » (droite) */}
        <TableLengthControl pagination={paginationState}>
          {showSearch && (
            <label className="flex items-center gap-2 text-[.9rem] text-gray-700">
              <span>Rechercher:</span>
              <input
                type="text"
                value={onSearchChange ? (searchValue ?? "") : localSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="rounded border border-gray-300 px-3 py-[.28rem] text-[.9rem] shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
          )}
        </TableLengthControl>

        {/* Tableau */}
        <div className="overflow-x-auto">
          <table className="w-full text-[.9rem]">
            <thead className="border-b border-gray-200 bg-gray-100">
              <tr>
                {table.getHeaderGroups().flatMap((hg) =>
                  hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className={cn(
                        "px-[.95rem] py-[.95rem] text-left text-[.9rem] font-bold text-gray-800",
                        header.column.getCanSort() && "cursor-pointer select-none"
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span className="text-gray-600">
                            {header.column.getIsSorted() === "asc" ? (
                              <ChevronUp className="h-4 w-4 text-blue-600" strokeWidth={3} />
                            ) : header.column.getIsSorted() === "desc" ? (
                              <ChevronDown className="h-4 w-4 text-blue-600" strokeWidth={3} />
                            ) : (
                              <ChevronsUpDown className="h-4 w-4 text-gray-600" strokeWidth={2.5} />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                Array.from({ length: currentPageSize }).map((_, i) => (
                  <tr key={i}>
                    {columns.map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-gray-200" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-8 text-center text-sm text-gray-500"
                  >
                    Aucune donnée disponible
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => {
                  const custom = rowClassName?.(row.original);
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "transition-colors hover:bg-gray-50",
                        // `even:` l'emporterait sur la couleur fournie par la page
                        // (classe + pseudo-classe) : on ne raye que les lignes sans couleur propre.
                        // Hyper `.table-striped` : `--bs-table-striped-bg:#f1f3fa`.
                        !custom && "odd:bg-gray-100",
                        custom
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="border-b border-gray-200 px-[.95rem] py-[.95rem] align-middle text-gray-700">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bas : « Afficher page X sur N » (gauche) + pagination « Précédent/Suivant » (droite) */}
        <TablePaginationFooter pagination={paginationState} />
      </div>
    </div>
  );
}
