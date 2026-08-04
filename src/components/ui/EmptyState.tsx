import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * État vide d'une liste, d'un tableau ou d'un panneau.
 *
 * Remplace le « Aucune donnée disponible » en gris posé au centre d'une cellule.
 * Un tableau vide n'est pas une anomalie mais un moment de l'usage : soit rien
 * n'a encore été créé, soit un filtre ne renvoie rien. Ces deux cas appellent
 * des réponses différentes — proposer de créer dans le premier, de réinitialiser
 * la recherche dans le second — d'où le slot `action`.
 *
 * L'icône est volontairement discrète (gris clair, cerclée) : elle situe le
 * propos sans devenir le centre de gravité d'un écran par ailleurs vide.
 *
 * @example Liste jamais alimentée
 * <EmptyState
 *   icon={Users}
 *   title="Aucun patient"
 *   description="Les patients enregistrés apparaîtront ici."
 *   action={<Button onClick={openCreate}>Ajouter un patient</Button>}
 * />
 *
 * @example Recherche sans résultat
 * <EmptyState
 *   icon={SearchX}
 *   title="Aucun résultat"
 *   description={`Aucun patient ne correspond à « ${search} ».`}
 *   action={<Button variant="secondary" onClick={reset}>Effacer la recherche</Button>}
 * />
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Bouton ou lien orientant vers la suite. Omis, rien ne s'affiche. */
  action?: React.ReactNode;
  className?: string;
  /** Marges réduites, pour un panneau latéral ou une carte courte. */
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
        className,
      )}
    >
      {Icon ? (
        <span
          aria-hidden="true"
          className={cn(
            "mb-4 flex items-center justify-center rounded-full",
            "bg-gray-50 text-gray-400 ring-1 ring-gray-100",
            compact ? "h-10 w-10" : "h-12 w-12",
          )}
        >
          <Icon className={compact ? "h-5 w-5" : "h-6 w-6"} strokeWidth={1.75} />
        </span>
      ) : null}

      {/* Pas de <h*> : l'état vide s'insère dans des contextes de niveaux de
          titre variés (cellule de tableau, carte, panneau). Un niveau figé y
          casserait la hiérarchie du document. */}
      <p className="text-[.9375rem] font-semibold text-gray-700">{title}</p>

      {description ? (
        <p className="mt-1.5 max-w-sm text-[.875rem] leading-relaxed text-gray-500">
          {description}
        </p>
      ) : null}

      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
