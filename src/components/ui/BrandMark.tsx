import { cn } from "@/lib/utils";

/**
 * Marque du produit AnapathLab — lentille d'objectif de microscope vue de face,
 * le point excentré figurant un noyau cellulaire sur la lame, accompagnée du
 * mot-symbole en IBM Plex Sans semi-gras, « Lab » en cyan.
 *
 * ## Ce que cette version renverse
 *
 * La marque précédente était **purement typographique**, et ce fichier
 * argumentait contre tout symbole : quatre pistes figuratives avaient été
 * dessinées puis écartées, au motif qu'à 16 px elles se réduisaient à une
 * tache. La charte v1 tranche dans l'autre sens et livre le tracé. C'est la
 * décision du product owner, et l'argument d'échelle qu'elle contredit reste
 * d'ailleurs reconnu par la charte elle-même, qui impose la marque seule sous
 * 24 px de haut plutôt que le logotype complet — d'où {@link BrandMark.compact}.
 *
 * ## Pourquoi les couleurs sont écrites en dur ici
 *
 * Partout ailleurs, une couleur passe par un jeton. Le logo fait exception, et
 * c'est délibéré : il ne doit pas se déplacer quand la palette d'interface est
 * retouchée. La charte l'écrit (« Ne pas changer les couleurs »), et les deux
 * variantes claire et sombre ont été dessinées ensemble — le cyan du fond
 * sombre est éclairci à la main pour tenir sur l'encre, ce qu'aucune règle
 * automatique ne retrouverait.
 *
 * Valeurs reprises telles quelles des fichiers livrés (`anapathlab-mark.svg`,
 * `anapathlab-mark-dark.svg`).
 *
 * @example En-tête d'application — logotype horizontal
 * <BrandMark className="text-lg" />
 *
 * @example Menu latéral déployé
 * <BrandMark surface="dark" className="text-lg" />
 *
 * @example Menu latéral replié — la marque seule, 32 px
 * <BrandMark compact surface="dark" />
 */

/** Encres du tracé, par fond. Cf. la note sur les couleurs en dur ci-dessus. */
const INK = {
  light: { anneau: "#006786", noyau: "#38a6cf", mot: "#201e1d", lab: "#006786" },
  dark: { anneau: "#62c5ee", noyau: "#99e0ff", mot: "#ffffff", lab: "#62c5ee" },
} as const;

function Lentille({
  surface,
  className,
}: {
  surface: "light" | "dark";
  className?: string;
}) {
  const { anneau, noyau } = INK[surface];
  return (
    // Géométrie reprise du fichier livré : anneau r=22 à 5 d'épaisseur, noyau
    // r=7 décentré en (34, 23). `aria-hidden` — le nom accessible est porté par
    // le conteneur, sans quoi un lecteur d'écran annoncerait la marque deux fois.
    <svg
      viewBox="0 0 56 56"
      fill="none"
      aria-hidden="true"
      className={cn("flex-shrink-0", className)}
    >
      <circle cx="28" cy="28" r="22" stroke={anneau} strokeWidth="5" />
      <circle cx="34" cy="23" r="7" fill={noyau} />
    </svg>
  );
}

export function BrandMark({
  className,
  surface = "light",
  compact = false,
}: {
  /** Porte la taille : le logotype hérite de `font-size` (`text-lg`, `text-2xl`…). */
  className?: string;
  surface?: "light" | "dark";
  /**
   * Marque seule, sans le mot. Réservé aux contextes où le logotype ne tient
   * pas — menu replié, écrans de chargement. La charte y fixe 32 px, valeur
   * par défaut ici ; `className` peut la reprendre.
   */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <span
        role="img"
        aria-label="AnapathLab"
        className={cn("inline-flex", className)}
      >
        <Lentille surface={surface} className="h-8 w-8" />
      </span>
    );
  }

  const { mot, lab } = INK[surface];

  return (
    <span
      role="img"
      aria-label="AnapathLab"
      className={cn(
        "inline-flex items-center gap-[0.4em] whitespace-nowrap",
        className,
      )}
    >
      {/* 1.35em et non 1em : la charte fixe 24 px de haut au minimum pour le
          logotype à l'écran. À 1em, un `text-lg` (18 px) laisserait l'ensemble
          sous ce plancher — la lentille perdrait son anneau à l'affichage. */}
      <Lentille surface={surface} className="h-[1.35em] w-[1.35em]" />
      <span
        // Le mot-symbole seul quitte la fonte d'interface : c'est le seul
        // endroit où la charte appelle IBM Plex Sans.
        //
        // `leading-none` est posé ICI et non sur le conteneur : `tailwind-merge`
        // tient `text-*` pour concurrent de `leading-*`, et le `className` de
        // l'appelant est fusionné après les classes de base. Les trois appels
        // passant tous une taille (`text-lg`, `text-xl`, `text-[1.75rem]`), la
        // remise à zéro de l'interligne était supprimée à chaque usage réel —
        // le mot reprenait l'interligne du corps de texte et désalignait la
        // lentille. Sur ce span interne, l'appelant ne peut plus l'atteindre.
        className="font-marque font-semibold leading-none tracking-[-0.02em]"
      >
        <span style={{ color: mot }}>Anapath</span>
        <span style={{ color: lab }}>Lab</span>
      </span>
    </span>
  );
}
