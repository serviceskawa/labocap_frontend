"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number | React.ReactNode;
  icon?: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  className?: string;
  valueClassName?: string;
  /**
   * La carte mène-t-elle quelque part ? Elle prend alors le relief au survol —
   * l'élévation n'est pas un ornement, elle annonce qu'on peut cliquer. Laisser
   * `false` pour un indicateur purement informatif : une carte inerte qui se
   * soulève promet une action qui n'existe pas.
   */
  interactive?: boolean;
}

/**
 * Indicateur chiffré (KPI).
 *
 * Aligné sur la forme du système : rayon `--radius-surface` et élévation en
 * deux couches, comme `.hyper-card`. La version précédente posait un `rounded`
 * (0.25rem) et une bordure grise franche — deux marqueurs du thème Hyper
 * abandonné, qui juraient à côté des cartes du reste de l'application.
 *
 * Remplace aussi `components/dashboard/KpiCard`, quasi identique et inutilisé.
 */
export function StatCard({
  title,
  value,
  icon,
  trend,
  className,
  valueClassName,
  interactive = false,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-surface)] bg-white p-6",
        "shadow-[var(--elevation-flat)]",
        interactive && [
          "cursor-pointer",
          "transition-[box-shadow,transform] duration-[var(--duration-base)] ease-emphasized",
          "hover:-translate-y-0.5 hover:shadow-[var(--elevation-raised)]",
        ],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Casse normale : les en-têtes en majuscules à fort interlettrage
              sont un marqueur Bootstrap explicitement abandonné par le système,
              et ils dégradent la lisibilité des libellés longs. */}
          <p className="truncate text-[.8125rem] font-medium text-gray-500">
            {title}
          </p>
          <p
            className={cn(
              // Interlettrage resserré : à cette taille, l'espacement par défaut
              // fait flotter les chiffres. Semibold plutôt que bold — le poids
              // du système, suffisant pour porter la hiérarchie.
              "mt-1.5 truncate text-[1.75rem] font-semibold leading-none tracking-[-0.02em]",
              valueClassName ?? "text-gray-900",
            )}
          >
            {value}
          </p>
          {trend !== undefined && (
            <div
              className={cn(
                "mt-2.5 inline-flex items-center gap-1 rounded-[var(--radius-control)] px-1.5 py-0.5 text-xs font-medium",
                // Pastille teintée plutôt que texte coloré nu : la tendance se
                // repère alors d'un coup d'œil dans une rangée d'indicateurs.
                trend.isPositive
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700",
              )}
            >
              {trend.isPositive ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              <span>
                {trend.isPositive ? "+" : ""}
                {trend.value}%
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 rounded-[var(--radius-control)] bg-blue-50 p-3 text-blue-600">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
