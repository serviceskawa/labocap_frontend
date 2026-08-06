/**
 * Périodes prédéfinies pour les filtres de date.
 *
 * Les rapports se demandent presque toujours sur les mêmes découpes — le mois
 * en cours, le trimestre, l'exercice. Les composer à la main revient à saisir
 * deux dates dont l'une, la fin du mois, demande de savoir si le mois compte 28,
 * 30 ou 31 jours. Les raccourcis suppriment ce calcul ; les champs restent là
 * pour tout le reste.
 */

/** Date au format `AAAA-MM-JJ`, celui qu'attendent `<input type="date">` et l'API. */
export type IsoDate = string;

export interface Periode {
  debut: IsoDate;
  fin: IsoDate;
}

/**
 * Formate en `AAAA-MM-JJ` **en heure locale**.
 *
 * `toISOString()` convertit d'abord en UTC : au Bénin (UTC+1), le 1er août à
 * 00:00 y devient le 31 juillet à 23:00, et le raccourci « ce mois » partirait
 * du mois précédent. On lit donc les composantes locales.
 */
export function versIso(d: Date): IsoDate {
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mois}-${jour}`;
}

/**
 * Dernier jour du mois de `d`.
 *
 * Le jour 0 du mois suivant est le dernier du mois courant — la seule
 * formulation qui traite février et les années bissextiles sans les nommer.
 */
function finDuMois(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export interface RaccourciPeriode {
  cle: string;
  libelle: string;
  calculer: (aujourdhui: Date) => Periode;
}

export const RACCOURCIS_PERIODE: readonly RaccourciPeriode[] = [
  {
    cle: "mois",
    libelle: "Ce mois",
    calculer: (a) => ({
      debut: versIso(new Date(a.getFullYear(), a.getMonth(), 1)),
      fin: versIso(finDuMois(a)),
    }),
  },
  {
    cle: "mois-precedent",
    libelle: "Mois dernier",
    calculer: (a) => {
      const precedent = new Date(a.getFullYear(), a.getMonth() - 1, 1);
      return { debut: versIso(precedent), fin: versIso(finDuMois(precedent)) };
    },
  },
  {
    cle: "trimestre",
    libelle: "Ce trimestre",
    calculer: (a) => {
      const debutTrimestre = new Date(
        a.getFullYear(),
        Math.floor(a.getMonth() / 3) * 3,
        1,
      );
      const dernierMois = new Date(
        debutTrimestre.getFullYear(),
        debutTrimestre.getMonth() + 2,
        1,
      );
      return { debut: versIso(debutTrimestre), fin: versIso(finDuMois(dernierMois)) };
    },
  },
  {
    cle: "annee",
    libelle: "Cette année",
    calculer: (a) => ({
      debut: versIso(new Date(a.getFullYear(), 0, 1)),
      fin: versIso(new Date(a.getFullYear(), 11, 31)),
    }),
  },
  {
    cle: "douze-mois",
    libelle: "12 derniers mois",
    calculer: (a) => ({
      // Onze mois en arrière, pas douze : en comptant le mois courant, la
      // période couvre bien douze mois civils. Reculer de douze en rendrait
      // treize, dont un incomplet.
      debut: versIso(new Date(a.getFullYear(), a.getMonth() - 11, 1)),
      fin: versIso(finDuMois(a)),
    }),
  },
] as const;

/** Raccourci dont la période correspond exactement à `p`, s'il en existe un. */
export function raccourciCorrespondant(
  p: Periode,
  aujourdhui: Date,
): string | null {
  const trouve = RACCOURCIS_PERIODE.find((r) => {
    const calc = r.calculer(aujourdhui);
    return calc.debut === p.debut && calc.fin === p.fin;
  });
  return trouve?.cle ?? null;
}

/** Nombre de mois civils couverts — sert à décider d'afficher la ventilation. */
export function moisCouverts(p: Periode): number {
  const [ad, md] = p.debut.split("-").map(Number);
  const [af, mf] = p.fin.split("-").map(Number);
  return (af - ad) * 12 + (mf - md) + 1;
}
