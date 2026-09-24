import { z } from "zod";
import type {
  BiologyParameter,
  BiologyParameterRequest,
  BiologyRange,
  BiologyRangeRequest,
  BiologySheet,
  BiologySheetRequest,
  RangeSex,
  ResultType,
} from "@/lib/api/biologyCatalog";

/**
 * Modèle de formulaire de la fiche de paramètres, et sa conversion vers et
 * depuis le contrat de `PUT /biology-parameters/sheet/{labTestId}`.
 *
 * Le formulaire garde les nombres en texte (saisie libre, virgule acceptée)
 * et les âges dans l'unité choisie ; seule la conversion produit des jours.
 * Les règles reprennent `BiologySheetValidator` côté API pour que l'erreur
 * s'affiche sous le champ plutôt que dans un toast après l'aller-retour.
 */

// ---------------------------------------------------------------------------
// Âges : années / mois / jours ⇄ jours
// ---------------------------------------------------------------------------

export type AgeUnit = "Y" | "M" | "D";

/** Conventions de saisie : 1 an = 365 jours, 1 mois = 30 jours. */
export const DAYS_PER_UNIT: Record<AgeUnit, number> = { Y: 365, M: 30, D: 1 };

export const AGE_UNIT_LABELS: Record<AgeUnit, string> = {
  Y: "ans",
  M: "mois",
  D: "jours",
};

/** Jours → plus grande unité qui tombe juste (0 et vide s'affichent en années). */
export function daysToAge(days: number | null): { value: string; unit: AgeUnit } {
  if (days == null) return { value: "", unit: "Y" };
  if (days % 365 === 0) return { value: String(days / 365), unit: "Y" };
  if (days % 30 === 0) return { value: String(days / 30), unit: "M" };
  return { value: String(days), unit: "D" };
}

/** Valeur saisie + unité → jours ; `null` si vide, `NaN` si invalide. */
export function ageToDays(value: string, unit: AgeUnit): number | null {
  const v = value.trim();
  if (v === "") return null;
  const n = Number(v.replace(",", "."));
  if (!Number.isInteger(n) || n < 0) return NaN;
  return n * DAYS_PER_UNIT[unit];
}

/** « 4,5 » ou « 4.5 » → 4.5 ; vide → `null` ; invalide → `NaN`. */
export function parseDecimal(value: string): number | null {
  const v = value.trim().replace(",", ".");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

// ---------------------------------------------------------------------------
// Schéma
// ---------------------------------------------------------------------------

const numberText = z.string().refine((v) => !Number.isNaN(parseDecimal(v)), {
  message: "Nombre invalide",
});

const ageText = z.string().refine((v) => v.trim() === "" || !Number.isNaN(ageToDays(v, "D")), {
  message: "Entier positif attendu",
});

export const rangeSchema = z
  .object({
    id: z.string().nullable(),
    sex: z.enum(["", "M", "F"]),
    ageMin: ageText,
    ageMinUnit: z.enum(["Y", "M", "D"]),
    ageMax: ageText,
    ageMaxUnit: z.enum(["Y", "M", "D"]),
    low: numberText,
    high: numberText,
    criticalLow: numberText,
    criticalHigh: numberText,
    label: z.string().max(100, "100 caractères au maximum"),
  })
  .superRefine((r, ctx) => {
    const min = ageToDays(r.ageMin, r.ageMinUnit);
    const max = ageToDays(r.ageMax, r.ageMaxUnit);
    if (min != null && max != null && !Number.isNaN(min) && !Number.isNaN(max) && min >= max) {
      ctx.addIssue({
        code: "custom",
        path: ["ageMax"],
        message: "L'âge maximal (exclu) doit dépasser l'âge minimal",
      });
    }
    const low = parseDecimal(r.low);
    const high = parseDecimal(r.high);
    const cl = parseDecimal(r.criticalLow);
    const ch = parseDecimal(r.criticalHigh);
    if ([low, high, cl, ch].some((n) => Number.isNaN(n))) return;
    if (low == null && high == null && cl == null && ch == null) {
      ctx.addIssue({ code: "custom", path: ["low"], message: "Au moins une borne est requise" });
    }
    const order = (a: number | null, b: number | null, path: string, message: string) => {
      if (a != null && b != null && a > b) ctx.addIssue({ code: "custom", path: [path], message });
    };
    order(low, high, "high", "Borne haute < borne basse");
    order(cl, low, "criticalLow", "Critique bas > borne basse");
    order(high, ch, "criticalHigh", "Critique haut < borne haute");
    order(cl, ch, "criticalHigh", "Critique haut < critique bas");
  });

export const parameterSchema = z
  .object({
    id: z.string().nullable(),
    code: z.string().max(50, "50 caractères au maximum"),
    name: z.string().trim().min(1, "Le nom est requis").max(200, "200 caractères au maximum"),
    resultType: z.enum(["NUMERIC", "TEXT", "CHOICE"]),
    choices: z.array(z.object({ value: z.string() })),
    decimals: z
      .string()
      .refine(
        (v) => v.trim() === "" || (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 6),
        { message: "Entre 0 et 6" },
      ),
    unitMeasurementId: z.string(),
    referenceText: z.string(),
    printable: z.boolean(),
    flaggable: z.boolean(),
    ranges: z.array(rangeSchema),
  })
  .superRefine((p, ctx) => {
    if (p.resultType === "CHOICE" && !p.choices.some((c) => c.value.trim() !== "")) {
      ctx.addIssue({
        code: "custom",
        path: ["choices"],
        message: "Un paramètre à choix doit proposer au moins un choix",
      });
    }
    if (p.resultType !== "NUMERIC") return;
    const seen = new Map<string, number>();
    p.ranges.forEach((r, i) => {
      const key = [r.sex, ageToDays(r.ageMin, r.ageMinUnit), ageToDays(r.ageMax, r.ageMaxUnit)].join("|");
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["ranges", i, "sex"],
          message: "Même population (sexe et âge) qu'une autre plage",
        });
      }
      seen.set(key, i);
    });
  });

export const sectionSchema = z.object({
  id: z.string().nullable(),
  title: z.string().trim().min(1, "Le titre est requis").max(200, "200 caractères au maximum"),
  parameters: z.array(parameterSchema),
});

export const sheetSchema = z
  .object({
    sections: z.array(sectionSchema),
    parameters: z.array(parameterSchema),
  })
  .superRefine((sheet, ctx) => {
    // Codes uniques dans toute la fiche, sans tenir compte de la casse.
    const seen = new Set<string>();
    const check = (p: ParameterForm, path: (string | number)[]) => {
      const code = p.code.trim().toLowerCase();
      if (!code) return;
      if (seen.has(code)) {
        ctx.addIssue({ code: "custom", path: [...path, "code"], message: "Code déjà utilisé dans la fiche" });
      }
      seen.add(code);
    };
    sheet.sections.forEach((s, si) =>
      s.parameters.forEach((p, pi) => check(p, ["sections", si, "parameters", pi])),
    );
    sheet.parameters.forEach((p, pi) => check(p, ["parameters", pi]));
  });

export type RangeForm = z.infer<typeof rangeSchema>;
export type ParameterForm = z.infer<typeof parameterSchema>;
export type SectionForm = z.infer<typeof sectionSchema>;
export type SheetForm = z.infer<typeof sheetSchema>;

// ---------------------------------------------------------------------------
// Valeurs vides
// ---------------------------------------------------------------------------

export function emptyRange(): RangeForm {
  return {
    id: null,
    sex: "",
    ageMin: "",
    ageMinUnit: "Y",
    ageMax: "",
    ageMaxUnit: "Y",
    low: "",
    high: "",
    criticalLow: "",
    criticalHigh: "",
    label: "",
  };
}

export function emptyParameter(): ParameterForm {
  return {
    id: null,
    code: "",
    name: "",
    resultType: "NUMERIC",
    choices: [],
    decimals: "",
    unitMeasurementId: "",
    referenceText: "",
    printable: true,
    flaggable: true,
    ranges: [],
  };
}

export function emptySection(): SectionForm {
  return { id: null, title: "", parameters: [] };
}

// ---------------------------------------------------------------------------
// API → formulaire
// ---------------------------------------------------------------------------

const text = (v: string | number | null | undefined) => (v == null ? "" : String(v));

function rangeToForm(r: BiologyRange): RangeForm {
  const min = daysToAge(r.ageMinDays);
  const max = daysToAge(r.ageMaxDays);
  return {
    id: r.id,
    sex: r.sex ?? "",
    ageMin: min.value,
    ageMinUnit: min.unit,
    ageMax: max.value,
    ageMaxUnit: max.unit,
    low: text(r.low),
    high: text(r.high),
    criticalLow: text(r.criticalLow),
    criticalHigh: text(r.criticalHigh),
    label: r.label ?? "",
  };
}

function parameterToForm(p: BiologyParameter): ParameterForm {
  return {
    id: p.id,
    code: p.code ?? "",
    name: p.name,
    resultType: p.resultType,
    choices: (p.choices ?? []).map((value) => ({ value })),
    decimals: text(p.decimals),
    unitMeasurementId: p.unitMeasurementId ?? "",
    referenceText: p.referenceText ?? "",
    printable: p.printable,
    flaggable: p.flaggable,
    ranges: p.ranges.map(rangeToForm),
  };
}

export function sheetToForm(sheet: BiologySheet): SheetForm {
  return {
    sections: sheet.sections.map((s) => ({
      id: s.id,
      title: s.title,
      parameters: s.parameters.map(parameterToForm),
    })),
    parameters: sheet.parameters.map(parameterToForm),
  };
}

// ---------------------------------------------------------------------------
// Formulaire → API (après validation zod : les nombres sont sûrs)
// ---------------------------------------------------------------------------

const orNull = (v: string) => (v.trim() === "" ? null : v.trim());

function rangeToRequest(r: RangeForm): BiologyRangeRequest {
  return {
    id: r.id,
    sex: (r.sex || null) as RangeSex,
    ageMinDays: ageToDays(r.ageMin, r.ageMinUnit),
    ageMaxDays: ageToDays(r.ageMax, r.ageMaxUnit),
    low: parseDecimal(r.low),
    high: parseDecimal(r.high),
    criticalLow: parseDecimal(r.criticalLow),
    criticalHigh: parseDecimal(r.criticalHigh),
    label: orNull(r.label),
  };
}

function parameterToRequest(p: ParameterForm): BiologyParameterRequest {
  const type: ResultType = p.resultType;
  return {
    id: p.id,
    code: orNull(p.code),
    name: p.name.trim(),
    resultType: type,
    choices:
      type === "CHOICE"
        ? p.choices.map((c) => c.value.trim()).filter((c) => c !== "")
        : null,
    decimals: p.decimals.trim() === "" ? null : Number(p.decimals),
    unitMeasurementId: p.unitMeasurementId || null,
    referenceText: orNull(p.referenceText),
    printable: p.printable,
    flaggable: p.flaggable,
    // Le backend n'accepte de plages chiffrées que sur un paramètre NUMERIC.
    ranges: type === "NUMERIC" ? p.ranges.map(rangeToRequest) : [],
  };
}

/** L'ordre des tableaux fait foi : le backend en tire les positions. */
export function formToSheetRequest(form: SheetForm): BiologySheetRequest {
  return {
    sections: form.sections.map((s) => ({
      id: s.id,
      title: s.title.trim(),
      parameters: s.parameters.map(parameterToRequest),
    })),
    parameters: form.parameters.map(parameterToRequest),
  };
}
