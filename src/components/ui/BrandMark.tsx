import { cn } from "@/lib/utils";

/**
 * Marque du produit LaboAnaPath.
 *
 * ## Le motif
 *
 * Une lame de microscope — carré aux angles adoucis — traversée en diagonale
 * par une coupe de tissu, et le prélèvement posé dessus. C'est le geste
 * fondateur de l'anatomie pathologique : on coupe, on monte, on lit.
 *
 * Trois formes, pas une de plus. Le repère est le favicon à 16px : au-delà de
 * trois éléments, une marque s'y réduit à une tache. Les détails figuratifs
 * (objectif de microscope, molécule, caducée) disparaissent à cette taille et
 * ne survivent qu'en impression.
 *
 * La diagonale est orientée vers le haut : lue de gauche à droite, elle monte —
 * détail sans importance sur une lame réelle, mais une marque qui descend se lit
 * comme un déclin.
 *
 * ## Distinction avec le logo du laboratoire
 *
 * Ceci est la marque du **produit**, pas celle du client. Chaque laboratoire
 * peut téléverser la sienne dans les Paramètres, elle prime alors partout
 * ({@link AppLogo}). Cette marque est ce qui s'affiche par défaut, tant qu'aucune
 * n'est configurée — l'application ne doit jamais paraître anonyme.
 *
 * @example Dans le menu latéral (fond sombre)
 * <BrandMark surface="dark" withWordmark />
 *
 * @example Favicon ou pastille compacte
 * <BrandMark className="h-8 w-8" />
 */
export function BrandMark({
  className,
  surface = "light",
  withWordmark = false,
}: {
  className?: string;
  /** Sur fond sombre, la lame passe en clair pour garder le contraste. */
  surface?: "light" | "dark";
  /** Accoler « LaboAnaPath » à droite du symbole. */
  withWordmark?: boolean;
}) {
  // Sur fond sombre, lame et coupe s'inversent : la lame passe en blanc et la
  // coupe en azur, pour garder le contraste sans introduire de troisième teinte.
  const base = surface === "dark" ? "#ffffff" : "#2e4bd8";
  const ink = surface === "dark" ? "#2e4bd8" : "#ffffff";

  // Un `clipPath` porte un identifiant global au document : deux marques sur la
  // même page (menu latéral replié + écran de connexion) partageraient le
  // premier et la seconde serait rognée de travers.
  const clipId = `brandmark-${surface}`;

  const mark = (
    <svg
      viewBox="0 0 32 32"
      className={cn("h-9 w-9 flex-shrink-0", !withWordmark && className)}
      role="img"
      aria-label="LaboAnaPath"
    >
      {/* La lame. Rayon 8 sur 32 = même proportion que --radius-surface sur une
          carte : la marque appartient au même système de formes que l'interface. */}
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="8"
        fill={base}
      />

      <defs>
        <clipPath id={clipId}>
          <rect x="1.5" y="1.5" width="29" height="29" rx="8" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        {/* L'extrémité dépolie — la zone d'étiquetage d'une lame réelle. C'est
            elle qui fait la marque : sans elle, la diagonale seule se lit comme
            un « slash » générique, bon pour n'importe quelle application. Avec
            elle, la tuile devient un objet identifiable. */}
        <path
          d="M 1.5 9.5 L 30.5 9.5 L 30.5 1.5 L 1.5 1.5 Z"
          fill={ink}
          opacity={surface === "dark" ? 0.18 : 0.26}
        />

        {/* La coupe de tissu — ruban à 45° passant par le centre. Débordement
            volontaire du cadre : le `clipPath` le recoupe suivant le rayon,
            plutôt que de calculer les intersections à la main. */}
        <path d="M 29 -2 L 36 -2 L 0 34 L -7 34 Z" fill={ink} opacity={0.96} />

        {/* Le prélèvement, posé sur la coupe. Un seul disque, pas deux
            concentriques : la version cerclée se lisait comme un bouton
            d'alimentation. */}
        <circle cx="14" cy="16.5" r="2.5" fill={base} />
      </g>
    </svg>
  );

  if (!withWordmark) return mark;

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {mark}
      {/* Deux graisses dans un seul mot : « Labo » en poids normal, « AnaPath »
          en semibold. Le mot reste unique — pas d'espace — tout en laissant lire
          sa construction. Interlettrage resserré, comme les titres du système. */}
      <span
        className={cn(
          "text-[1.0625rem] leading-none tracking-[-0.02em]",
          surface === "dark" ? "text-white" : "text-gray-900",
        )}
      >
        Labo<span className="font-semibold">AnaPath</span>
      </span>
    </span>
  );
}
