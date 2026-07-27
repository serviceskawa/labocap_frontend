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
 * Style Laravel/Hyper : les actions de ligne sont des boutons pleins et carrés
 * ne contenant qu'une icône (`<button class="btn btn-primary"><i class="mdi …">`).
 * `ghost` reste disponible pour les affordances discrètes (chevrons, fermeture).
 */
const variantClasses: Record<IconButtonVariant, string> = {
  edit: "bg-blue-600 text-white hover:shadow-[0_2px_6px_0_rgba(114,124,245,0.5)]",
  view: "bg-blue-600 text-white hover:shadow-[0_2px_6px_0_rgba(114,124,245,0.5)]",
  info: "bg-cyan-500 text-white hover:shadow-[0_2px_6px_0_rgba(57,175,209,0.5)]",
  delete: "bg-red-600 text-white hover:shadow-[0_2px_6px_0_rgba(250,92,124,0.5)]",
  secondary:
    "bg-gray-600 text-white hover:shadow-[0_2px_6px_0_rgba(108,117,125,0.5)]",
  default: "bg-blue-600 text-white hover:shadow-[0_2px_6px_0_rgba(114,124,245,0.5)]",
  ghost: "text-gray-500 hover:bg-gray-100 hover:text-gray-700",
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
        // Boutons d'action Laravel = `.btn` pleine taille avec une icône seule :
        // padding .45rem .9rem, radius .15rem, ligne 1.5 (icône ~.9rem ≈ 14px).
        "inline-flex items-center justify-center rounded-[.15rem] px-[.9rem] py-[.45rem] leading-none transition-[background-color,box-shadow] disabled:cursor-not-allowed disabled:opacity-60",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {busy ? <Loader2 className="h-[.9rem] w-[.9rem] animate-spin" /> : icon}
    </button>
  );
}
