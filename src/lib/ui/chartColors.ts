/**
 * Couleurs des graphiques du tableau de bord.
 *
 * Les graphiques recharts reçoivent leurs couleurs en props JavaScript
 * (`stroke`, `fill`) : elles échappent aux classes Tailwind, et donc au remap de
 * `globals.css`. Sans cette source unique, le tableau de bord gardait l'ancienne
 * palette pendant que le reste de l'application changeait — c'est exactement ce
 * qui s'est produit lors du passage à « Ardoise & Azur ».
 *
 * ## Palette catégorielle
 *
 * Ordre **fixe** : la 1re série prend `CHART_CATEGORICAL[0]`, la 2e le suivant,
 * etc. Ne jamais réordonner selon les valeurs — une couleur suit l'entité, pas
 * son rang, sinon un filtre qui change le nombre de séries repeint les
 * survivantes et fausse la lecture d'un graphique à l'autre.
 *
 * L'ordre a été **calculé, pas choisi à l'œil** : il passe les six contrôles du
 * validateur de palette (bande de luminosité, plancher de chroma, séparation
 * sous déficience de vision des couleurs, plancher en vision normale, contraste
 * sur le fond). L'azur et l'émeraude, par exemple, ne sont pas voisins : c'est
 * la paire rouge/vert adjacente qui tombait à ΔE 5,6 en deutéranopie.
 *
 * Toute modification doit être revalidée :
 *
 * ```
 * node scripts/validate_palette.js "#2e4bd8,#d97706,#dc2848,#0284c7,#059669" --mode light
 * ```
 *
 * Au-delà de 5 séries, ne pas générer une teinte supplémentaire : regrouper la
 * queue en « Autres », ou passer en petits multiples.
 */
export const CHART_CATEGORICAL = [
  "#2e4bd8", // azur    — primaire
  "#d97706", // ambre
  "#dc2848", // rose
  "#0284c7", // ciel
  "#059669", // émeraude
] as const;

/**
 * Couleurs d'**état**, réservées : elles disent « ça va » / « ça ne va pas » et
 * ne doivent jamais servir de énième couleur de série. Un graphique dont les
 * segments sont des statuts métier (examen terminé / en attente, facture payée /
 * impayée) les utilise à la place de la palette catégorielle.
 *
 * Elles s'accompagnent toujours d'un libellé : la couleur seule ne porte pas
 * l'information.
 */
export const CHART_STATUS = {
  good: "#059669",
  warning: "#d97706",
  critical: "#dc2848",
  neutral: "#64748b",
} as const;

/** Grille et axes — volontairement discrets (ardoise 200). */
export const CHART_GRID = "#e2e8f0";
