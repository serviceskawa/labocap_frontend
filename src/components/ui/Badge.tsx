"use client";

import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "primary"
  | "secondary";

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

// Pastilles teintées : fond au palier 50, texte au palier 700, liseré au
// palier 200. Le thème d'origine posait la teinte du statut à 18 % d'opacité et
// le texte à la couleur pleine — un vert menthe sur vert menthe pâle, dont le
// contraste tombait sous 3:1 et devenait illisible en petite taille. Le liseré
// détache la pastille du fond de ligne sans ajouter de couleur.
const variantClasses: Record<BadgeVariant, string> = {
  success: "bg-green-50 text-green-800 ring-1 ring-inset ring-green-200",
  warning: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  info: "bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-100",
  primary: "bg-blue-600 text-white ring-1 ring-inset ring-blue-700",
  secondary: "bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200",
};

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5",
        "text-xs font-semibold tracking-[-0.005em]",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
