import type {
  BiologyAppliedRange,
  BiologyFlag,
  BiologyParameterRow,
} from "@/lib/api/biologyResults";

/**
 * Indicateurs de résultats de biologie : libellés, indicateurs manuels permis
 * et aperçu du calcul.
 *
 * Le serveur fait autorité (`BiologyFlagCalculator`) : l'aperçu ne sert qu'à
 * signaler une valeur hors normes pendant la frappe, et il est présenté comme
 * tel. Il reprend exactement les mêmes règles — sinon l'écran annoncerait un
 * indicateur que l'enregistrement démentirait.
 */

/**
 * Libellés de repli. Le réglage `bio_flag_labels` ne couvre que L/H/LL/HH ;
 * N et A n'y figurent pas.
 */
const DEFAULT_FLAG_LABELS: Record<BiologyFlag, string> = {
  N: "Normal",
  L: "Bas",
  H: "Haut",
  LL: "Critique bas",
  HH: "Critique haut",
  A: "Anormal",
};

export function flagLabel(flag: BiologyFlag, labels?: Record<string, string> | null): string {
  const custom = labels?.[flag];
  return custom && custom.trim() !== "" ? custom : DEFAULT_FLAG_LABELS[flag];
}

/** Indicateurs manuels admis par le serveur, selon la forme du résultat. */
export function allowedOverrides(row: BiologyParameterRow): BiologyFlag[] {
  if (!row.flaggable) return [];
  return row.resultType === "NUMERIC" ? ["N", "L", "H", "LL", "HH"] : ["A"];
}

/**
 * Lecture d'une valeur chiffrée, comme `BiologyNumbers.lire` : virgule ou point
 * décimal, espaces de milliers ignorés ; refus des deux séparateurs à la fois,
 * de la notation scientifique et des valeurs censurées (« <0,5 »).
 *
 * @returns le nombre, ou `null` si la saisie n'est pas lisible
 */
export function parseBiologyNumber(raw: string): number | null {
  const s0 = raw.trim().replace(/[\s  ]/g, "");
  if (s0 === "" || (s0.includes(",") && s0.includes("."))) return null;
  const s = s0.replace(",", ".");
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(s)) return null;
  return Number(s);
}

/** Arrondi demi vers le haut au nombre de décimales du paramètre (4 sans réglage). */
function roundTo(value: number, decimals: number | null): number {
  const d = decimals == null ? 4 : Math.max(0, Math.min(decimals, 4));
  const f = 10 ** d;
  // Math.round arrondit -x,5 vers le haut : on travaille sur la valeur absolue
  // pour obtenir le demi « loin de zéro » de RoundingMode.HALF_UP.
  return (Math.sign(value) * Math.round(Math.abs(value) * f + Number.EPSILON)) / f;
}

/**
 * Indicateur calculé, comme `BiologyFlagCalculator.calculer` : bornes incluses
 * dans l'intervalle qu'elles ferment — une valeur égale au seuil critique est
 * L/H, pas LL/HH. Aucune plage, ou plage sans borne : pas d'indicateur.
 */
export function computeFlag(value: number, range: BiologyAppliedRange | null): BiologyFlag | null {
  if (!range) return null;
  const { low, high, criticalLow, criticalHigh } = range;
  if (low == null && high == null && criticalLow == null && criticalHigh == null) return null;
  if (criticalLow != null && value < criticalLow) return "LL";
  if (criticalHigh != null && value > criticalHigh) return "HH";
  if (low != null && value < low) return "L";
  if (high != null && value > high) return "H";
  return "N";
}

/**
 * Aperçu de l'indicateur d'une saisie non enregistrée : l'indicateur manuel
 * s'il y en a un, sinon le calcul sur la valeur arrondie (NUMERIC signalable).
 */
export function previewFlag(
  row: BiologyParameterRow,
  raw: string,
  override: BiologyFlag | "",
): BiologyFlag | null {
  if (raw.trim() === "" || !row.flaggable) return null;
  if (override) return override;
  if (row.resultType !== "NUMERIC") return null;
  const n = parseBiologyNumber(raw);
  if (n == null) return null;
  return computeFlag(roundTo(n, row.decimals), row.range);
}

/**
 * Valeur enregistrée telle qu'elle se tape : le serveur stocke « 18.34 » ;
 * le laboratoire saisit à la française.
 */
export function toInputValue(row: BiologyParameterRow): string {
  const v = row.result?.value ?? "";
  return row.resultType === "NUMERIC" ? v.replace(".", ",") : v;
}

/** Valeurs de référence affichées : bornes résolues, sinon texte libre du catalogue. */
export function referenceDisplay(row: BiologyParameterRow): string | null {
  return row.range?.display || row.referenceText || row.result?.referenceSnapshot || null;
}
