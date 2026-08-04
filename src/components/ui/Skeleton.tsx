import { cn } from "@/lib/utils";

/**
 * Bloc de chargement.
 *
 * Remplace le `animate-pulse` posé à la main dans les écrans : le clignotement
 * d'opacité fait battre le vide et attire l'œil dessus, alors qu'un balayage
 * horizontal suggère un contenu en cours d'arrivée. Sur un tableau entier de
 * squelettes, la différence de fatigue visuelle est nette.
 *
 * Le dégradé s'appuie sur les gris du système (`--color-gray-*`) et l'animation
 * sur le token `--animate-skeleton` ; « réduire les animations » la neutralise
 * automatiquement (cf. globals.css), le bloc reste alors gris uni.
 *
 * @example Ligne de texte
 * <Skeleton className="h-4 w-40" />
 *
 * @example Pastille
 * <Skeleton variant="circle" className="h-9 w-9" />
 */
export function Skeleton({
  className,
  variant = "block",
}: {
  className?: string;
  /** `block` suit `--radius-control` ; `circle` pour un avatar ou une pastille. */
  variant?: "block" | "circle";
}) {
  return (
    <div
      // aria-hidden : le squelette est une doublure visuelle. C'est le conteneur
      // qui porte l'état de chargement (aria-busy), sinon le lecteur d'écran
      // annonce autant d'éléments vides qu'il y a de blocs.
      aria-hidden="true"
      className={cn(
        "animate-skeleton bg-[length:200%_100%]",
        "bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100",
        variant === "circle" ? "rounded-full" : "rounded-[var(--radius-control)]",
        className,
      )}
    />
  );
}

/**
 * Groupe de lignes de texte de largeurs décroissantes.
 *
 * Les largeurs sont volontairement inégales : des barres strictement identiques
 * se lisent comme un motif décoratif, pas comme du texte à venir.
 */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}
