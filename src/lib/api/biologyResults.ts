import apiClient from "./client";
import type { ReportStatus } from "./reports";
import type { ResultType } from "./biologyCatalog";
import type { BiologyKind, PageResponse } from "@/types/api";

/**
 * Saisie des résultats de biologie (module « biology »).
 *
 * Contrat : backend `feat/biologie-discipline` (B5, `BiologyResultController`).
 * Lecture sous `view-biology-results`, saisie sous `edit-biology-results`,
 * validation technique sous `validate-biology-results`. Chaque écriture renvoie
 * la feuille de saisie à jour : l'écran la pose directement dans le cache
 * (`setQueryData`) au lieu de la relire.
 *
 * Verrous (422) : analyse validée techniquement, compte-rendu validé ou livré,
 * analyse retirée du catalogue. Le message du serveur est affiché tel quel.
 */

// ---------------------------------------------------------------------------
// Énumérations
// ---------------------------------------------------------------------------

/** État de la saisie d'une analyse. */
export type BiologyAnalysisStatus = "PENDING" | "ENTERED" | "TECH_VALIDATED";

/** Réglage `bio_validation_mode`. */
export type BiologyValidationMode = "TWO_STEP" | "ONE_STEP";

/**
 * Indicateur d'une valeur : N/L/H/LL/HH (chiffré), A (anormal, posé à la main
 * sur un résultat texte ou à choix).
 */
export type BiologyFlag = "N" | "L" | "H" | "LL" | "HH" | "A";

/** Interprétation d'un antibiogramme — stockée S/I/R quel que soit le libellé. */
export type AntibiogramInterpretation = "S" | "I" | "R";

// ---------------------------------------------------------------------------
// Liste de travail
// ---------------------------------------------------------------------------

export interface BiologyWorklistRow {
  analysisResultId: string;
  status: BiologyAnalysisStatus;
  testOrderId: string;
  orderCode: string | null;
  urgent: boolean;
  orderCreatedAt: string | null;
  prelevementDate: string | null;
  patientId: string | null;
  patientCode: string | null;
  /** « NOM Prénoms ». */
  patientName: string | null;
  labTestId: string;
  labTestName: string | null;
  labTestCode: string | null;
  kind: BiologyKind | null;
  categoryId: string | null;
  categoryName: string | null;
  enteredAt: string | null;
  techValidatedAt: string | null;
  reportId: string | null;
  reportStatus: ReportStatus | null;
}

export interface BiologyWorklistParams {
  status?: BiologyAnalysisStatus;
  categoryId?: string;
  /** `yyyy-MM-dd`, inclus. */
  from?: string;
  /** `yyyy-MM-dd`, inclus. */
  to?: string;
  page?: number;
  size?: number;
}

// ---------------------------------------------------------------------------
// Feuille de saisie
// ---------------------------------------------------------------------------

export interface BiologyWorksheetPatient {
  id: string;
  code: string | null;
  firstname: string | null;
  lastname: string | null;
  fullName: string | null;
  /** Sexe tel que saisi sur la fiche. */
  genre: string | null;
  /** Normalisé : `"M"`, `"F"` ou `null`. */
  sex: "M" | "F" | null;
  birthday: string | null;
  age: number | null;
  ageUnit: "YEARS" | "MONTHS" | null;
  /** Âge en jours à la date du prélèvement. */
  ageInDays: number | null;
}

export interface BiologyWorksheetReport {
  id: string;
  code: string | null;
  status: ReportStatus;
}

export interface BiologyWorksheetSettings {
  validationMode: BiologyValidationMode;
  /** Libellés affichés de S/I/R. */
  antibiogramLabels: Record<string, string>;
  /** Libellés affichés de L/H/LL/HH. */
  flagLabels: Record<string, string>;
}

/** Plage de référence résolue pour ce patient. */
export interface BiologyAppliedRange {
  id: string;
  low: number | null;
  high: number | null;
  criticalLow: number | null;
  criticalHigh: number | null;
  label: string | null;
  /** Bornes normales telles qu'imprimées (« 12,0 – 16,0 »), ou `null`. */
  display: string | null;
}

/** Valeur enregistrée, avec unité et références figées à la saisie. */
export interface BiologyParameterValue {
  id: string;
  /** Valeur stockée ; pour un NUMERIC, nombre arrondi au point décimal (« 18.34 »). */
  value: string | null;
  valueNumeric: number | null;
  flag: BiologyFlag | null;
  /** `true` si l'indicateur a été posé à la main — à renvoyer à chaque enregistrement. */
  flagOverridden: boolean;
  unitSnapshot: string | null;
  lowSnapshot: number | null;
  highSnapshot: number | null;
  criticalLowSnapshot: number | null;
  criticalHighSnapshot: number | null;
  referenceSnapshot: string | null;
}

export interface BiologyParameterRow {
  parameterId: string;
  /** `null` pour une valeur de paramètre retiré du catalogue. */
  code: string | null;
  name: string;
  /** `2147483647` pour une valeur de paramètre retiré du catalogue. */
  position: number;
  resultType: ResultType;
  choices: string[] | null;
  decimals: number | null;
  unit: string | null;
  referenceText: string | null;
  printable: boolean;
  flaggable: boolean;
  range: BiologyAppliedRange | null;
  result: BiologyParameterValue | null;
}

export interface BiologyWorksheetSection {
  id: string;
  title: string;
  position: number;
  parameters: BiologyParameterRow[];
}

export interface BiologyCultureOptionRow {
  cultureOptionId: string;
  name: string;
  /** Vide ou `null` : saisie libre. */
  choices: string[] | null;
  /** `2147483647` pour une option qui n'est plus retenue par l'analyse. */
  position: number;
  resultId: string | null;
  value: string | null;
}

export interface BiologyAntibiogramRow {
  id: string;
  antibioticId: string;
  antibioticName: string | null;
  antibioticCode: string | null;
  interpretation: AntibiogramInterpretation | null;
  mic: string | null;
  diameterMm: number | null;
}

export interface BiologyIsolate {
  id: string;
  organism: string;
  quantity: string | null;
  position: number;
  antibiogram: BiologyAntibiogramRow[];
}

export interface BiologyAnalysis {
  /** Ligne de saisie. */
  id: string;
  labTestId: string;
  labTestName: string;
  labTestCode: string | null;
  /** `null` si l'analyse a été retirée du catalogue. */
  kind: BiologyKind | null;
  specimenType: string | null;
  status: BiologyAnalysisStatus;
  comment: string | null;
  enteredBy: string | null;
  enteredByName: string | null;
  enteredAt: string | null;
  techValidatedBy: string | null;
  techValidatedByName: string | null;
  techValidatedAt: string | null;
  /** `false` si validée techniquement, compte-rendu validé/livré, ou analyse retirée. */
  editable: boolean;
  expectedValues: number;
  enteredValues: number;
  sections: BiologyWorksheetSection[];
  /** Paramètres hors section, puis valeurs de paramètres retirés du catalogue. */
  parameters: BiologyParameterRow[];
  cultureOptions: BiologyCultureOptionRow[];
  isolates: BiologyIsolate[];
}

export interface BiologyAntibioticRef {
  id: string;
  name: string;
  code: string | null;
  family: string | null;
  position: number;
}

export interface BiologyWorksheet {
  testOrderId: string;
  orderCode: string | null;
  urgent: boolean;
  prelevementDate: string | null;
  patient: BiologyWorksheetPatient | null;
  report: BiologyWorksheetReport | null;
  settings: BiologyWorksheetSettings;
  analyses: BiologyAnalysis[];
  antibiotics: BiologyAntibioticRef[];
}

// ---------------------------------------------------------------------------
// Requêtes d'écriture
// ---------------------------------------------------------------------------

/**
 * Valeurs d'une analyse PANEL. Paramètre listé avec valeur : enregistré ;
 * listé avec valeur vide : effacé ; absent : laissé tel quel.
 * `flagOverride` n'est pas mémorisé d'un enregistrement à l'autre : il faut le
 * renvoyer tant qu'on veut le garder.
 */
export interface BiologyPanelResultsRequest {
  values: { parameterId: string; value: string; flagOverride?: BiologyFlag }[];
  comment: string | null;
}

export interface BiologyCultureResultsRequest {
  /** Comme les valeurs d'une fiche ; `null` ne touche à rien. */
  options: { cultureOptionId: string; value: string }[] | null;
  /** Liste complète : un germe existant absent est supprimé. */
  isolates:
    | {
        id: string | null;
        organism: string;
        quantity: string | null;
        /** Liste complète, par antibiotique. */
        antibiogram: {
          antibioticId: string;
          interpretation: AntibiogramInterpretation;
          mic: string | null;
          diameterMm: number | null;
        }[];
      }[]
    | null;
  comment: string | null;
}

// ---------------------------------------------------------------------------
// Appels
// ---------------------------------------------------------------------------

const base = "/biology-results";

export const biologyResultsApi = {
  worklist: (params: BiologyWorklistParams) =>
    apiClient.get<PageResponse<BiologyWorklistRow>>(`${base}/worklist`, { params }),
  worksheet: (testOrderId: string) =>
    apiClient.get<BiologyWorksheet>(`${base}/orders/${testOrderId}`),
  savePanel: (testOrderId: string, labTestId: string, body: BiologyPanelResultsRequest) =>
    apiClient.put<BiologyWorksheet>(`${base}/orders/${testOrderId}/analyses/${labTestId}`, body),
  saveCulture: (testOrderId: string, labTestId: string, body: BiologyCultureResultsRequest) =>
    apiClient.put<BiologyWorksheet>(
      `${base}/orders/${testOrderId}/analyses/${labTestId}/culture`,
      body,
    ),
  validateTechnically: (testOrderId: string, labTestId: string) =>
    apiClient.post<BiologyWorksheet>(
      `${base}/orders/${testOrderId}/analyses/${labTestId}/technical-validation`,
    ),
  cancelTechnicalValidation: (testOrderId: string, labTestId: string) =>
    apiClient.delete<BiologyWorksheet>(
      `${base}/orders/${testOrderId}/analyses/${labTestId}/technical-validation`,
    ),
};

/** Clés de cache TanStack Query de la saisie des résultats. */
export const biologyResultsKeys = {
  all: ["biology-results"] as const,
  worklistRoot: ["biology-results", "worklist"] as const,
  worklist: (params: BiologyWorklistParams) => ["biology-results", "worklist", params] as const,
  order: (testOrderId: string) => ["biology-results", "order", testOrderId] as const,
};

/**
 * Rang réservé par le serveur aux valeurs orphelines (paramètre retiré du
 * catalogue, option de culture plus retenue). Ces lignes restent visibles mais
 * ne sont jamais renvoyées : le serveur refuserait un identifiant qui
 * n'appartient plus à l'analyse.
 */
export const ORPHAN_POSITION = 2147483647;
