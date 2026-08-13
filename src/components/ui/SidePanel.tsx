"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Ligne secondaire sous le titre — code, patient, date… */
  subtitle?: string;
  /** Contenu bas, séparé : boutons d'action. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Panneau glissant depuis la droite, pour consulter sans quitter la liste.
 *
 * <p>Répond à un besoin précis : juger d'un coup d'œil si la ligne qu'on vient
 * de cliquer est bien celle qu'on cherche. Ouvrir la page complète pour s'en
 * apercevoir, puis revenir, coûte deux navigations et fait perdre sa place dans
 * la liste.</p>
 *
 * <p>Largeur : le quart de l'écran sur grand format, mais jamais moins de
 * 380 px — en deçà, un extrait de compte rendu devient illisible. En dessous de
 * 1024 px il occupe toute la largeur : sur un écran étroit, un quart ne montre
 * rien d'utile.</p>
 */
export function SidePanel({
  open,
  onClose,
  title,
  subtitle,
  footer,
  children,
}: SidePanelProps) {
  // Échap ferme le panneau, et le corps cesse de défiler derrière lui.
  useEffect(() => {
    if (!open) return;
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", auClavier);
    const debordementInitial = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", auClavier);
      document.body.style.overflow = debordementInitial;
    };
  }, [open, onClose]);

  return (
    <>
      {/* Voile : ferme au clic et détache l'œil de la liste, sans la masquer. */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-gray-900/20 transition-opacity duration-[var(--duration-quick)]",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-full flex-col bg-white shadow-2xl",
          "lg:w-1/4 lg:min-w-[380px]",
          "transition-transform duration-[var(--duration-quick)] ease-emphasized",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-gray-900">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 truncate text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le panneau"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer className="border-t border-gray-200 px-5 py-4">{footer}</footer>
        )}
      </aside>
    </>
  );
}
