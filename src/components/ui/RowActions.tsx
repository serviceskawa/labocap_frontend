"use client";

import Link from "next/link";
import { MoreVertical } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { IconButton, type IconButtonVariant } from "./IconButton";
import { cn } from "@/lib/utils";

/**
 * Une action de ligne de tableau.
 *
 * `label` sert d'infobulle quand l'action est posée à plat, et de libellé
 * lorsqu'elle est repliée dans le menu — une icône seule dans un menu déroulant
 * n'apprend rien.
 */
export interface RowAction {
  label: string;
  icon: ReactNode;
  /** Navigation. Exclusif avec `onClick`. */
  href?: string;
  onClick?: () => void;
  variant?: IconButtonVariant;
  disabled?: boolean;
}

/** Au-delà de ce nombre, les actions se replient dans un menu. */
const SEUIL_REPLI = 2;

/**
 * Actions d'une ligne de tableau — à plat en deçà de trois, dans un menu au-delà.
 *
 * ## Pourquoi un seuil
 *
 * Les colonnes d'actions comptaient jusqu'à huit boutons — voir, modifier,
 * compte rendu, marquer retiré, imprimer, facturer, supprimer. Alignés, ils
 * occupaient plus de largeur que la donnée, et l'œil devait trier huit
 * pictogrammes par ligne, sur des dizaines de lignes, pour retrouver le même
 * geste. Repliés, la colonne redevient étroite et régulière.
 *
 * En deçà de trois, le repli coûterait plus qu'il ne rapporte : masquer une ou
 * deux actions derrière un clic supplémentaire n'économise aucune largeur
 * notable.
 *
 * ## Le décompte se fait par LIGNE
 *
 * La plupart des actions sont conditionnelles — permission, statut de la
 * demande. Un écran peut en déclarer huit et n'en autoriser que deux sur une
 * ligne donnée. Le composant compte ce qu'il reçoit, c'est-à-dire ce qui est
 * réellement permis : une ligne à deux actions les montre, sa voisine à cinq
 * les replie. Compter les actions déclarées par l'écran imposerait un menu à
 * des lignes qui n'ont qu'un bouton.
 *
 * L'appelant construit donc son tableau en filtrant AVANT de le passer.
 *
 * @example
 * <RowActions
 *   actions={[
 *     { label: "Voir", icon: <Eye className="h-3.5 w-3.5" />, href: `/x/${id}` },
 *     ...(peutSupprimer
 *       ? [{ label: "Supprimer", icon: <Trash2 className="h-3.5 w-3.5" />,
 *            variant: "delete" as const, onClick: () => confirmer(id) }]
 *       : []),
 *   ]}
 * />
 */
export function RowActions({
  actions,
  className,
}: {
  actions: RowAction[];
  className?: string;
}) {
  if (actions.length === 0) return null;

  if (actions.length <= SEUIL_REPLI) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        {actions.map((a) => (
          <ActionAPlat key={a.label} action={a} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center", className)}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            // Un nom accessible explicite : « ⋮ » n'est pas un mot, et le
            // libellé doit dire ce qu'on ouvre, pas décrire le pictogramme.
            aria-label={`Actions (${actions.length})`}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-control)]",
              "text-gray-500 transition-colors duration-[var(--duration-fast)] ease-emphasized",
              "hover:bg-gray-100 hover:text-gray-800",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
              "data-[state=open]:bg-gray-100 data-[state=open]:text-gray-800",
            )}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            // Rendu dans un portail : les tableaux vivent dans des conteneurs à
            // `overflow-x-auto`, qui rogneraient un menu ancré dans le flux.
            className={cn(
              "z-50 min-w-[11rem] overflow-hidden rounded-[var(--radius-control)] bg-white p-1",
              "shadow-[var(--elevation-overlay)]",
            )}
          >
            {actions.map((a) => (
              <ActionDansMenu key={a.label} action={a} />
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

function ActionAPlat({ action }: { action: RowAction }) {
  const { label, icon, href, onClick, variant = "default", disabled } = action;

  if (href && !disabled) {
    return (
      <Link
        href={href}
        title={label}
        aria-label={label}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-control)]",
          "transition-colors duration-[var(--duration-fast)] ease-emphasized",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
          variant === "delete"
            ? "bg-red-50 text-red-600 hover:bg-red-600 hover:text-white"
            : "bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white",
        )}
      >
        {icon}
      </Link>
    );
  }

  return (
    <IconButton
      icon={icon}
      variant={variant}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    />
  );
}

function ActionDansMenu({ action }: { action: RowAction }) {
  const { label, icon, href, onClick, variant, disabled } = action;

  const classes = cn(
    "flex w-full cursor-pointer items-center gap-2.5 rounded-[calc(var(--radius-control)-2px)]",
    "px-2.5 py-2 text-[.875rem] outline-none",
    "transition-colors duration-[var(--duration-instant)] ease-emphasized",
    // Radix pose `data-highlighted` au survol comme au parcours clavier : une
    // seule règle couvre les deux, là où `hover:` laisserait le clavier sans
    // retour visuel.
    variant === "delete"
      ? "text-red-700 data-[highlighted]:bg-red-50"
      : "text-gray-700 data-[highlighted]:bg-gray-100",
    disabled && "pointer-events-none opacity-50",
  );

  if (href && !disabled) {
    return (
      <DropdownMenu.Item asChild>
        <Link href={href} className={classes}>
          <span className="flex-shrink-0 text-gray-400">{icon}</span>
          {label}
        </Link>
      </DropdownMenu.Item>
    );
  }

  return (
    <DropdownMenu.Item
      className={classes}
      disabled={disabled}
      onSelect={() => onClick?.()}
    >
      <span className="flex-shrink-0 text-gray-400">{icon}</span>
      {label}
    </DropdownMenu.Item>
  );
}
