"use client";

import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClickBusy } from "./Button";

type IconButtonVariant =
  | "default"
  | "edit"
  | "delete"
  | "view"
  | "info"
  | "secondary"
  | "ghost";

/**
 * Actions de ligne : boutons pleins et carrés ne contenant qu'une icône.
 *
 * Les fonds pleins et saturés d'origine transformaient chaque tableau en damier
 * de pastilles colorées — trois par ligne, sur des dizaines de lignes, la
 * couleur ne signalait plus rien. On passe à des pastilles **teintées** (fond
 * clair, icône à la couleur pleine) qui se densifient au survol : l'intention
 * de chaque action reste lisible, la page respire, et le regard va d'abord à la
 * donnée. `ghost` reste réservé aux affordances discrètes (chevron, fermeture).
 */
const variantClasses: Record<IconButtonVariant, string> = {
  edit: "bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white",
  view: "bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white",
  info: "bg-cyan-50 text-cyan-700 hover:bg-cyan-600 hover:text-white",
  delete: "bg-red-50 text-red-600 hover:bg-red-600 hover:text-white",
  secondary: "bg-gray-100 text-gray-600 hover:bg-gray-600 hover:text-white",
  default: "bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white",
  ghost: "text-gray-400 hover:bg-gray-100 hover:text-gray-700",
};

interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  icon: ReactNode;
  variant?: IconButtonVariant;
  /** Remplace l'icône par un spinner et neutralise le bouton pendant l'action. */
  loading?: boolean;
  /**
   * Handler de clic. Un handler `async` (qui renvoie une promesse) met le bouton
   * en attente jusqu'à résolution, ce qui empêche un second déclenchement.
   */
  onClick?: (event: MouseEvent<HTMLButtonElement>) => unknown;
}

/** Bouton d'action icône seule, au format des boutons de tableau Laravel. */
export function IconButton({
  icon,
  variant = "default",
  loading = false,
  className,
  type = "button",
  disabled,
  onClick,
  ...props
}: IconButtonProps) {
  const { busy, handleClick } = useClickBusy(onClick, loading);

  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy}
      onClick={handleClick}
      className={cn(
        // Pastille carrée de 32px : la même surface de clic qu'avant, mais une
        // empreinte visuelle nettement plus calme dans un tableau dense.
        "inline-flex h-8 w-8 items-center justify-center rounded-lg leading-none",
        "transition-colors duration-[var(--duration-fast)] ease-emphasized",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
        "disabled:cursor-not-allowed disabled:opacity-55",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {busy ? <Loader2 className="h-[.9rem] w-[.9rem] animate-spin" /> : icon}
    </button>
  );
}
