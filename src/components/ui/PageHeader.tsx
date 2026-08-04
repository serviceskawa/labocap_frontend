"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
  className?: string;
  /** Rend l'en-tête collant en haut lors du défilement de la page (défaut : true). */
  sticky?: boolean;
}

export function PageHeader({
  title,
  subtitle,
  action,
  breadcrumbs,
  className,
  sticky = true,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6",
        sticky &&
          // Le `main` a un padding haut de 24px (p-6). Avec `top-0`, l'en-tête
          // collant se fixe SOUS ce padding : au scroll, le contenu défile dans
          // les 24px entre la barre du haut et l'en-tête et reste visible.
          // `-top-6` (= -1.5rem) le colle exactement sous la barre du haut, et
          // `-mt-6/-mx-6` + `px-6/pt-6` couvrent le padding haut ET latéral, pour
          // qu'aucun texte ne passe dans cet espace. Le fond est à 95 % + flou
          // d'arrière-plan : le contenu qui défile dessous reste illisible, tout
          // en laissant deviner le mouvement — un aplat opaque donnait un bandeau
          // mort. Ne pas descendre sous 95 % sans le flou.
          "sticky -top-6 z-20 -mx-6 -mt-6 border-b border-gray-200/70 bg-gray-50/95 px-6 pb-4 pt-6 backdrop-blur-sm",
        className
      )}
    >
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Fil d'Ariane" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-gray-400">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <li key={index} className="flex items-center gap-1">
                  {index > 0 && (
                    <ChevronRight className="h-3 w-3 flex-shrink-0 text-gray-400" />
                  )}
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="transition-colors hover:text-blue-600 hover:underline"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      className={cn(isLast && "font-medium text-gray-600")}
                    >
                      {crumb.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      {/* Title row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {/* 20px et interlettrage légèrement resserré : à 18px/normal, le titre
              se distinguait mal des en-têtes de carte juste en dessous. */}
          <h1 className="truncate text-[1.25rem] font-semibold leading-tight tracking-[-0.015em] text-gray-900">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}
