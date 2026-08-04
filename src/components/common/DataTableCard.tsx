"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DataTable, type DataTableProps } from "./DataTable";

interface DataTableCardProps<T> extends DataTableProps<T> {
  /** Barre de filtres affichée au-dessus du tableau, dans la carte. */
  filters?: ReactNode;
  /** Classe additionnelle sur la carte. */
  className?: string;
}

/**
 * Carte standard (bordure + fond blanc + ombre) englobant une barre de filtres
 * optionnelle et un `DataTable`. Évite de répéter le wrapper sur chaque page.
 */
export function DataTableCard<T>({
  filters,
  className,
  ...tableProps
}: DataTableCardProps<T>) {
  return (
    <div
      className={cn(
        "rounded-xl bg-white p-5 shadow-[var(--elevation-flat)]",
        className
      )}
    >
      {filters && (
        <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-gray-100 pb-4">{filters}</div>
      )}
      <DataTable {...tableProps} />
    </div>
  );
}
