"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

interface CrudModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  /** Classe(s) supplémentaire(s) sur la boîte du modal (ex. `min-h-[80vh]` pour l'agrandir en hauteur). */
  contentClassName?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Peut être asynchrone : le bouton se verrouille alors jusqu'à résolution. */
  onSubmit?: () => unknown;
  submitLabel?: string;
  isSubmitting?: boolean;
  /**
   * Fermer la modale au clic sur l'arrière-plan (défaut : false).
   * Par choix produit, un formulaire ne se ferme que via « Annuler » ou la croix.
   */
  closeOnOverlayClick?: boolean;
  /** Fermer la modale avec la touche Échap (défaut : false). */
  closeOnEscape?: boolean;
}

const sizeClasses: Record<NonNullable<CrudModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  "2xl": "max-w-6xl",
};

export function CrudModal({
  isOpen,
  onClose,
  title,
  size = "md",
  contentClassName,
  children,
  footer,
  onSubmit,
  submitLabel = "Enregistrer",
  isSubmitting = false,
  closeOnOverlayClick = false,
  closeOnEscape = false,
}: CrudModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Bloquer le scroll du body
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [isOpen]);

  // Fermer avec Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && closeOnEscape) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, closeOnEscape]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current && closeOnOverlayClick) {
      onClose();
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      // Ancrage HAUT (comme les modales Bootstrap/Laravel) : l'en-tête reste fixe
      // et c'est le bas qui s'allonge/raccourcit quand la hauteur du corps change
      // (ex. bascule d'onglets du wizard contrat), au lieu d'un recentrage vertical.
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={cn(
          "relative flex max-h-[90vh] w-full flex-col rounded-[var(--radius-surface)] bg-white shadow-[var(--elevation-overlay)]",
          sizeClasses[size],
          contentClassName
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <h2
            id="modal-title"
            className="text-lg font-semibold text-gray-900"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-[var(--radius-control)] p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 px-6 py-4">
          {footer !== undefined ? (
            footer
          ) : (
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-[var(--radius-control)] border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Annuler
              </button>
              {/* Bouton partagé : spinner pendant `isSubmitting` et, si `onSubmit`
                  est asynchrone, verrou automatique contre un second clic. */}
              <Button
                onClick={onSubmit}
                loading={isSubmitting}
                className="gap-2 rounded-[var(--radius-control)] px-4 py-2 text-sm font-medium hover:bg-blue-700"
              >
                {submitLabel}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
