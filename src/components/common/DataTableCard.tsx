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
 * Carte standard englobant une barre de filtres optionnelle et un `DataTable`.
 * Évite de répéter le wrapper sur chaque page.
 *
 * Porte `.hyper-card` — donc le rayon `--radius-surface` (0.75rem) et
 * l'élévation en deux couches du système. Auparavant : `rounded` (0.25rem) et
 * une bordure grise franche, hérités du thème Hyper abandonné. Comme ce
 * composant enveloppe *toutes* les listes de l'application, l'écart se lisait
 * partout : des angles plus vifs et un cerne plus dur que sur les autres
 * surfaces, sans le relief qui détache la carte du fond.
 */
export function DataTableCard<T>({
  filters,
  className,
  ...tableProps
}: DataTableCardProps<T>) {
  return (
    <div className={cn("hyper-card hyper-card-body", className)}>
      {filters && (
        <div className="mb-4 flex flex-wrap items-center gap-3">{filters}</div>
      )}
      <DataTable {...tableProps} />
    </div>
  );
}
