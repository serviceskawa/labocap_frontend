"use client";

import { useMemo, useState } from "react";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { cn } from "@/lib/utils";

/**
 * Pagination des tableaux écrits à la main.
 *
 * Tous les écrans n'utilisent pas `DataTable` : certains tableaux ont une mise
 * en forme propre (récapitulatifs de contrat, historiques de versions, lignes
 * d'une facture…). Ils restaient sans pagination et affichaient d'un bloc des
 * listes potentiellement longues. Ces composants fournissent **exactement** les
 * mêmes contrôles que `DataTable`, qui les utilise lui aussi : il n'existe donc
 * qu'une seule apparence de pagination dans l'application.
 */

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export interface TablePaginationState {
  /** Index de page courant (0-based), déjà borné au nombre de pages. */
  pageIndex: number;
  pageSize: number;
  /** Nombre total de pages (au moins 1, même sans donnée). */
  pageCount: number;
  setPageIndex: (index: number) => void;
  setPageSize: (size: number) => void;
}

/**
 * Découpe une liste en pages. Renvoie les lignes de la page courante et l'état
 * à passer aux deux composants de contrôle.
 *
 * À appeler au niveau du composant (jamais dans une condition) : le tableau
 * paginé peut très bien n'être rendu que dans une modale, l'état de pagination,
 * lui, doit exister à chaque rendu.
 */
export function useTablePagination<T>(
  rows: T[],
  initialPageSize = 10,
): TablePaginationState & { pageRows: T[]; total: number; offset: number } {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  // La liste peut rétrécir (filtre, suppression) alors qu'on est sur la
  // dernière page : sans ce bornage le tableau apparaîtrait vide.
  const safeIndex = Math.min(pageIndex, pageCount - 1);
  const offset = safeIndex * pageSize;

  const pageRows = useMemo(
    () => rows.slice(offset, offset + pageSize),
    [rows, offset, pageSize],
  );

  return {
    pageRows,
    total: rows.length,
    offset,
    pageIndex: safeIndex,
    pageSize,
    pageCount,
    setPageIndex,
    setPageSize: (size: number) => {
      setPageSize(size);
      setPageIndex(0);
    },
  };
}

/**
 * « Afficher [10] enregistrements par page » — à placer au-dessus du tableau.
 * `children` occupe la droite de la ligne (champ « Rechercher: » du `DataTable`).
 */
export function TableLengthControl({
  pagination,
  className,
  children,
}: {
  pagination: Pick<TablePaginationState, "pageSize" | "setPageSize">;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <label className="flex items-center gap-2 text-[.9rem] text-gray-700">
        <span>Afficher</span>
        <NativeSelect
          className="w-auto"
          value={pagination.pageSize}
          onChange={(e) => pagination.setPageSize(Number(e.target.value))}
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </NativeSelect>
        <span>enregistrements par page</span>
      </label>
      {children}
    </div>
  );
}

/** Numéros de page affichés, avec élision au-delà de 7 pages (règle `DataTable`). */
function getPageNumbers(pageIndex: number, pageCount: number): (number | "...")[] {
  const pages: (number | "...")[] = [];
  if (pageCount <= 7) {
    for (let i = 0; i < pageCount; i++) pages.push(i);
    return pages;
  }
  pages.push(0);
  if (pageIndex > 2) pages.push("...");
  const start = Math.max(1, pageIndex - 1);
  const end = Math.min(pageCount - 2, pageIndex + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (pageIndex < pageCount - 3) pages.push("...");
  pages.push(pageCount - 1);
  return pages;
}

/** « Afficher page X sur N » + Précédent / 1 2 3 / Suivant — sous le tableau. */
export function TablePaginationFooter({
  pagination,
  className,
}: {
  pagination: TablePaginationState;
  className?: string;
}) {
  const { pageIndex, pageCount, setPageIndex } = pagination;

  return (
    <div
      className={cn(
        "mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="mb-0 text-[.9rem] text-gray-600">
        Afficher page {pageIndex + 1} sur {Math.max(pageCount, 1)}
      </p>

      <div className="flex items-center gap-[3px]">
        <button
          type="button"
          onClick={() => setPageIndex(pageIndex - 1)}
          disabled={pageIndex === 0}
          className="flex h-8 items-center justify-center rounded-full px-3 text-[.9rem] text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Précédent
        </button>

        {getPageNumbers(pageIndex, pageCount).map((page, idx) =>
          page === "..." ? (
            <span key={`ellipsis-${idx}`} className="px-1 text-gray-400">
              …
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => setPageIndex(page)}
              className={cn(
                "flex h-8 min-w-[2rem] items-center justify-center rounded-full px-2 text-[.9rem] transition-colors",
                pageIndex === page
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100",
              )}
            >
              {page + 1}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => setPageIndex(pageIndex + 1)}
          disabled={pageIndex >= pageCount - 1}
          className="flex h-8 items-center justify-center rounded-full px-3 text-[.9rem] text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Suivant
        </button>
      </div>
    </div>
  );
}
