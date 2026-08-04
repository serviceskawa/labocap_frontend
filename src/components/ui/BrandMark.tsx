import { cn } from "@/lib/utils";

/**
 * Marque du produit LaboAnaPath — purement typographique.
 *
 * ## Pourquoi pas de symbole
 *
 * Quatre pistes figuratives ont été dessinées puis écartées (lame, coupe,
 * cellule, objectif) : à 16px elles se réduisaient toutes à une tache, et à
 * grande taille elles se lisaient comme des icônes d'application génériques —
 * la diagonale sur tuile arrondie convient à un VPN comme à une banque.
 *
 * C'est le parti pris de la plupart des logiciels médicaux et d'entreprise
 * (Epic, Cerner, Doctolib) : le nom, posé avec soin, ne peut être confondu avec
 * un pictogramme acheté et ne pose aucun problème d'échelle.
 *
 * ## Ce qui fait la marque
 *
 * Un seul mot, deux graisses. « Labo » en graisse normale et gris moyen,
 * « AnaPath » en gras et gris profond : la construction du nom se lit sans
 * qu'on l'ait coupé en deux par une espace ou une majuscule isolée. Le contraste
 * porte le rythme, aucune couleur d'accent n'est nécessaire — un azur sur le nom
 * entrerait en concurrence avec les éléments actifs de l'interface.
 *
 * L'interlettrage est resserré (-0.025em), comme les titres du système : à ces
 * tailles, l'espacement par défaut de Nunito fait flotter le mot.
 *
 * @example Écran de connexion
 * <BrandMark className="text-2xl" />
 *
 * @example Menu latéral déployé
 * <BrandMark surface="dark" className="text-lg" />
 *
 * @example Menu latéral replié — la lettrine seule
 * <BrandMark compact />
 */
export function BrandMark({
  className,
  surface = "light",
  compact = false,
}: {
  /** Porte la taille : la marque hérite de `font-size` (`text-lg`, `text-2xl`…). */
  className?: string;
  surface?: "light" | "dark";
  /**
   * Lettrine seule, dans une pastille azur. Réservé aux contextes où le mot
   * entier ne tient pas : menu replié, favicon, pastille d'application.
   */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <span
        role="img"
        aria-label="LaboAnaPath"
        className={cn(
          "inline-flex items-center justify-center rounded-[var(--radius-control)]",
          "h-9 w-9 bg-blue-600 font-bold leading-none text-white",
          "text-[1.0625rem] tracking-[-0.03em]",
          className,
        )}
      >
        L
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label="LaboAnaPath"
      className={cn(
        // `items-baseline` et non `items-center` : les deux graisses partagent
        // la même ligne de base, sinon le gras paraît décalé vers le bas.
        "inline-flex items-baseline whitespace-nowrap leading-none tracking-[-0.025em]",
        className,
      )}
    >
      <span className={surface === "dark" ? "text-white/55" : "text-gray-500"}>
        Labo
      </span>
      <span
        className={cn(
          "font-bold",
          surface === "dark" ? "text-white" : "text-gray-900",
        )}
      >
        AnaPath
      </span>
    </span>
  );
}
