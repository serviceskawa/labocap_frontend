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
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Inbox,
  SearchX,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { INPUT_CLASS } from "@/lib/ui/inputClass";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
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
   * Titre de l'état vide, quand la liste n'a jamais rien contenu. Nommer l'objet
   * métier — « Aucun patient » situe mieux que « Aucune donnée ».
   *
   * Sans effet quand une recherche est active : ce cas affiche son propre état,
   * qui reprend le terme cherché.
   */
  emptyTitle?: string;
  /** Phrase sous le titre de l'état vide. Idéalement, ce qui peuplera la liste. */
  emptyDescription?: string;
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
  emptyTitle = "Aucune donnée",
  emptyDescription,
  hideToolbar = false,
}: DataTableProps<T>) {
  const isServerSide = pageCount !== undefined;

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [localSearch, setLocalSearch] = useState("");

  // Terme de recherche effectif, quelle que soit la source : la page pilote le
  // champ (`onSearchChange`) ou le tableau le gère lui-même. Il distingue la
  // liste vide de la recherche infructueuse — deux états à ne pas confondre.
  const activeSearch = (onSearchChange ? searchValue : localSearch)?.trim() ?? "";


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
          <h5 className="mb-0 text-[.9375rem] font-semibold tracking-[-0.006em] text-gray-800">{title}</h5>
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
                className={cn(INPUT_CLASS, "w-auto py-[.28rem]")}
              />
            </label>
          )}
        </TableLengthControl>

        {/* Tableau — grille contenue par un liseré et des coins arrondis, et
            non un bloc de texte flottant. Sans cadre ni séparateurs de colonnes,
            l'œil n'avait aucun repère pour suivre une ligne large jusqu'à la
            colonne Actions, à l'autre bout de l'écran. */}
        <div className="overflow-x-auto overflow-y-hidden rounded-[var(--radius-surface)] ring-1 ring-gray-200">
          <table className="w-full border-collapse text-[.9rem]">
            <thead className="border-b border-gray-300 bg-gray-50">
              <tr>
                {table.getHeaderGroups().flatMap((hg) =>
                  hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className={cn(
                        "px-4 py-2.5 text-left text-[.7rem] font-semibold uppercase tracking-[0.06em] text-gray-600",
                        // Filet vertical entre colonnes, sauf après la dernière.
                        "border-r border-gray-200 last:border-r-0",
                        header.column.getCanSort() &&
                          "cursor-pointer select-none transition-colors hover:bg-gray-100 hover:text-gray-800"
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span className="text-gray-400">
                            {header.column.getIsSorted() === "asc" ? (
                              <ChevronUp className="h-3.5 w-3.5 text-blue-600" strokeWidth={3} />
                            ) : header.column.getIsSorted() === "desc" ? (
                              <ChevronDown className="h-3.5 w-3.5 text-blue-600" strokeWidth={3} />
                            ) : (
                              <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" strokeWidth={2.5} />
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
                      <td
                        key={j}
                        className="border-r border-gray-100 px-4 py-2.5 last:border-r-0"
                      >
                        {/* Filets verticaux repris de main : sans eux la grille
                            se romprait pendant le chargement. Largeurs alternées
                            — des barres identiques se lisent comme une trame
                            décorative, pas comme des données à venir. */}
                        <Skeleton
                          className={cn("h-4", j % 3 === 2 ? "w-1/2" : "w-4/5")}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="p-0">
                    {/* Deux vides distincts, deux réponses distinctes : une
                        recherche infructueuse appelle à élargir le critère, une
                        liste jamais alimentée à créer le premier élément. Le
                        même « Aucune donnée disponible » pour les deux laissait
                        l'utilisateur sans issue. */}
                    {activeSearch ? (
                      <EmptyState
                        icon={SearchX}
                        title="Aucun résultat"
                        description={`Aucun élément ne correspond à « ${activeSearch} ».`}
                      />
                    ) : (
                      <EmptyState
                        icon={Inbox}
                        title={emptyTitle}
                        description={emptyDescription}
                      />
                    )}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => {
                  const custom = rowClassName?.(row.original);
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "transition-colors duration-[var(--duration-instant)] ease-emphasized hover:bg-blue-50/40",
                        custom
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="border-r border-gray-100 px-4 py-2.5 align-middle text-[.875rem] text-gray-700 last:border-r-0">
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
