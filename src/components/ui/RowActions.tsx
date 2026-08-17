"use client";

import Link from "next/link";
import { MoreVertical, SquareArrowOutUpRight } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { createContext, useContext, type ReactNode } from "react";
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
  /**
   * Ouvre dans un nouvel onglet plutôt que dans la page courante.
   *
   * Sert les listes qu'on parcourt en travaillant : ouvrir une demande ne doit
   * pas coûter les filtres, la page et la position de défilement qu'on a mis du
   * temps à poser. Un repère visuel accompagne le lien, et son nom accessible
   * annonce l'ouverture — la surprise est le principal reproche fait à cette
   * pratique.
   */
  newTab?: boolean;
  onClick?: () => void;
  variant?: IconButtonVariant;
  disabled?: boolean;
}

/** Au-delà de ce nombre, les actions se replient dans un menu. */
const SEUIL_REPLI = 2;

/**
 * Repli imposé à toutes les lignes d'un tableau.
 *
 * Une cellule ne connaît que sa propre ligne : elle ne peut pas savoir qu'une
 * voisine dépasse le seuil. Le tableau le déclare une fois pour toutes.
 */
const RowActionsCollapseContext = createContext(false);

/**
 * Impose le repli à toutes les colonnes d'actions qu'il enveloppe.
 *
 * À poser autour d'un tableau dès qu'une de ses lignes peut dépasser deux
 * actions — ce que le développeur sait en lisant le jeu d'actions de l'écran,
 * là où le composant ne verrait qu'une ligne à la fois.
 *
 * Le calculer à l'exécution supposerait de compter les actions de toutes les
 * lignes avant d'en rendre une seule ; les actions dépendant de mutations et de
 * permissions résolues pendant le rendu, la colonne se réagencerait après
 * l'affichage — un saut visible à chaque chargement.
 */
export function RowActionsProvider({
  collapse = true,
  children,
}: {
  collapse?: boolean;
  children: ReactNode;
}) {
  return (
    <RowActionsCollapseContext.Provider value={collapse}>
      {children}
    </RowActionsCollapseContext.Provider>
  );
}

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
 * ## La décision est prise par TABLEAU, pas par ligne
 *
 * Les actions sont conditionnelles — permission, statut de la demande — si bien
 * qu'une ligne peut en autoriser deux là où sa voisine en autorise cinq.
 * Décider ligne par ligne donnerait une colonne où deux icônes, puis un ⋮, puis
 * une icône se succèdent : le même geste changerait de place à chaque ligne, et
 * la colonne perdrait toute régularité.
 *
 * Dès qu'une ligne du tableau dépasse le seuil, **toutes** replient donc.
 * Comme un composant ne voit que sa propre ligne, c'est le tableau qui le lui
 * dit, via {@link RowActionsProvider}.
 *
 * @example Un écran dont certaines lignes dépassent deux actions
 * <RowActionsProvider collapse>
 *   <DataTable … />
 * </RowActionsProvider>
 *
 * @example Le contenu d'une cellule, filtré AVANT d'être passé
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
  collapse,
  className,
}: {
  actions: RowAction[];
  /**
   * Force le repli quelle que soit la longueur. Sert à l'uniformité d'une
   * colonne dont d'autres lignes dépassent le seuil. Omis, la valeur vient de
   * {@link RowActionsProvider}, et à défaut du décompte de cette ligne.
   */
  collapse?: boolean;
  className?: string;
}) {
  const replieParLeTableau = useContext(RowActionsCollapseContext);
  const replier = collapse ?? replieParLeTableau;

  if (actions.length === 0) return null;

  if (!replier && actions.length <= SEUIL_REPLI) {
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
  const { label, icon, href, onClick, variant = "default", disabled, newTab } = action;

  if (href && !disabled) {
    // Le nom accessible porte la mention, faute de place pour un repère visuel
    // sur un bouton de 28 px : l'infobulle et le lecteur d'écran l'annoncent.
    const nom = newTab ? `${label} (nouvel onglet)` : label;
    return (
      <Link
        href={href}
        title={nom}
        aria-label={nom}
        target={newTab ? "_blank" : undefined}
        // `noopener` : sans lui, la page ouverte accède à `window.opener` et
        // peut rediriger l'onglet d'origine.
        rel={newTab ? "noopener noreferrer" : undefined}
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
  const { label, icon, href, onClick, variant, disabled, newTab } = action;

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
        <Link
          href={href}
          className={classes}
          target={newTab ? "_blank" : undefined}
          rel={newTab ? "noopener noreferrer" : undefined}
          aria-label={newTab ? `${label} (nouvel onglet)` : undefined}
        >
          <span className="flex-shrink-0 text-gray-400">{icon}</span>
          {label}
          {/* Repère de sortie, poussé à droite : le menu a la place de le
              montrer, contrairement au bouton à plat. `aria-hidden` — la
              mention est déjà portée par le nom accessible du lien. */}
          {newTab ? (
            <SquareArrowOutUpRight
              aria-hidden="true"
              className="ml-auto h-3 w-3 flex-shrink-0 text-gray-400"
            />
          ) : null}
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
