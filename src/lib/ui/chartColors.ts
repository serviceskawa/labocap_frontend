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
 * L'ordre est **calculé, pas choisi à l'œil** : il passe les six contrôles du
 * validateur de palette (bande de luminosité, plancher de chroma, séparation en
 * vision normale, séparation sous les trois déficiences de vision des couleurs,
 * contraste sur le fond, voisinage).
 *
 * Toute modification doit être revalidée :
 *
 * ```
 * node scripts/validate_palette.mjs "#006786,#c26e12,#5a9c80,#ac2f3b,#c480d4" --mode light
 * ```
 *
 * ## Pourquoi ces cinq teintes
 *
 * Le cyan est imposé : c'est le primaire de la charte. Les quatre autres ont
 * été cherchées par descente locale sous les seuils du validateur.
 *
 * L'ancienne palette n'y survivait pas. Le validateur qu'elle invoquait
 * n'existait pas dans le dépôt — la consigne était invérifiable depuis qu'elle
 * était écrite. Une fois le script réellement implémenté, elle échouait à trois
 * contrôles, dont `#0284c7` / `#059669` à **ΔE 1,6 en tritanopie** : deux séries
 * strictement confondues. Le rôle « info » bleu ciel a donc disparu, aliasé sur
 * le primaire.
 *
 * Le vert est volontairement **plus clair** que le cyan. Sous tritanopie le
 * bleu et le vert se confondent : leur séparation ne peut plus venir de la
 * teinte, elle doit venir de la clarté. C'est l'optimisation qui l'a trouvé.
 *
 * Au-delà de 5 séries, ne pas générer une teinte supplémentaire : regrouper la
 * queue en « Autres », ou passer en petits multiples.
 */
export const CHART_CATEGORICAL = [
  "#006786", // cyan profond — primaire de la charte
  "#c26e12", // ambre brûlé
  "#5a9c80", // vert sauge — plus clair que le cyan, cf. tritanopie
  "#ac2f3b", // brique
  "#c480d4", // prune
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
  good: "#3a8366",
  warning: "#ab5300",
  critical: "#ac2f3b",
  neutral: "#777473",
} as const;

/**
 * Urgence métier — le magenta de la charte, « accent rare réservé aux alertes ».
 *
 * Distinct de {@link CHART_STATUS}.critical, qui dit l'erreur : celui-ci dit le
 * résultat critique et le délai dépassé. La charte interdit de faire cohabiter
 * les deux dans un même composant.
 */
export const CHART_URGENT = "#d6006c";

/** Grille et axes — volontairement discrets (neutre 200). */
export const CHART_GRID = "#d8d5d5";
