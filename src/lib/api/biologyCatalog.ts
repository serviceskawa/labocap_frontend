import apiClient from "./client";
import type { CategoryTest } from "./examens";

/**
 * Référentiels du catalogue de biologie clinique (module « biology »).
 *
 * Contrat : backend `feat/biologie-discipline` (B3). Toutes ces routes
 * répondent 404 quand le module Biologie est désactivé côté API
 * (`MODULE_BIOLOGY`). Lecture sous `view-tests` ; écriture sous
 * `manage-biology-parameters`, `manage-antibiotics`, `manage-culture-options`.
 */

// ---------------------------------------------------------------------------
// Antibiotiques
// ---------------------------------------------------------------------------

export interface Antibiotic {
  id: string;
  name: string;
  commercialName: string | null;
  family: string | null;
  code: string | null;
  position: number;
  createdAt: string;
}

export interface AntibioticRequest {
  name: string;
  commercialName?: string | null;
  family?: string | null;
  code?: string | null;
  position?: number;
}

export const antibioticsApi = {
  findAll: () => apiClient.get<Antibiotic[]>("/antibiotics"),
  create: (data: AntibioticRequest) =>
    apiClient.post<Antibiotic>("/antibiotics", data),
  update: (id: string, data: AntibioticRequest) =>
    apiClient.put<Antibiotic>(`/antibiotics/${id}`, data),
  delete: (id: string) => apiClient.delete(`/antibiotics/${id}`),
};

// ---------------------------------------------------------------------------
// Options de culture
// ---------------------------------------------------------------------------

export interface CultureOption {
  id: string;
  name: string;
  /** Valeurs proposées ; vide = saisie libre. */
  choices: string[];
  position: number;
  createdAt: string;
}

export interface CultureOptionRequest {
  name: string;
  choices: string[];
  position?: number;
}

/** Option de culture retenue par une analyse CULTURE. */
export interface LabTestCultureOption {
  /** Identifiant du lien analyse ↔ option. */
  id: string;
  cultureOptionId: string;
  name: string;
  choices: string[];
  position: number;
}

export const cultureOptionsApi = {
  findAll: () => apiClient.get<CultureOption[]>("/culture-options"),
  create: (data: CultureOptionRequest) =>
    apiClient.post<CultureOption>("/culture-options", data),
  update: (id: string, data: CultureOptionRequest) =>
    apiClient.put<CultureOption>(`/culture-options/${id}`, data),
  delete: (id: string) => apiClient.delete(`/culture-options/${id}`),
  /** Options retenues par une analyse CULTURE, dans l'ordre d'affichage. */
  findByLabTest: (labTestId: string) =>
    apiClient.get<LabTestCultureOption[]>(
      `/culture-options/by-lab-test/${labTestId}`,
    ),
  /** Remplace la liste ; l'ordre du tableau fait foi pour les positions. */
  setForLabTest: (labTestId: string, cultureOptionIds: string[]) =>
    apiClient.put<LabTestCultureOption[]>(
      `/culture-options/by-lab-test/${labTestId}`,
      { cultureOptionIds },
    ),
};

// ---------------------------------------------------------------------------
// Fiche de paramètres (analyses PANEL)
// ---------------------------------------------------------------------------

export type ResultType = "NUMERIC" | "TEXT" | "CHOICE";

/** `"M"`, `"F"`, ou `null` pour les deux sexes. */
export type RangeSex = "M" | "F" | null;

export interface BiologyRange {
  id: string;
  sex: RangeSex;
  /** Âge minimal en jours, inclus. */
  ageMinDays: number | null;
  /** Âge maximal en jours, exclu. */
  ageMaxDays: number | null;
  low: number | null;
  high: number | null;
  criticalLow: number | null;
  criticalHigh: number | null;
  label: string | null;
  position: number;
}

export interface BiologyParameter {
  id: string;
  sectionId: string | null;
  code: string | null;
  name: string;
  position: number;
  resultType: ResultType;
  choices: string[] | null;
  decimals: number | null;
  unitMeasurementId: string | null;
  unitMeasurementName: string | null;
  unitMeasurementAbbreviation: string | null;
  referenceText: string | null;
  printable: boolean;
  flaggable: boolean;
  ranges: BiologyRange[];
}

export interface BiologySection {
  id: string;
  title: string;
  position: number;
  parameters: BiologyParameter[];
}

export interface BiologySheet {
  labTestId: string;
  labTestName: string;
  sections: BiologySection[];
  /** Paramètres hors section, affichés après les sections. */
  parameters: BiologyParameter[];
}

/**
 * Plage envoyée au `PUT` : sans `id` = création. Pas de `position` : le rang
 * dans la liste fait foi.
 */
export interface BiologyRangeRequest {
  id?: string | null;
  sex: RangeSex;
  ageMinDays: number | null;
  ageMaxDays: number | null;
  low: number | null;
  high: number | null;
  criticalLow: number | null;
  criticalHigh: number | null;
  label: string | null;
}

export interface BiologyParameterRequest {
  id?: string | null;
  code: string | null;
  name: string;
  resultType: ResultType;
  /** Obligatoires pour CHOICE, ignorés sinon. */
  choices: string[] | null;
  decimals: number | null;
  unitMeasurementId: string | null;
  referenceText: string | null;
  printable: boolean;
  flaggable: boolean;
  /** Réservées aux paramètres NUMERIC. */
  ranges: BiologyRangeRequest[];
}

export interface BiologySectionRequest {
  id?: string | null;
  title: string;
  parameters: BiologyParameterRequest[];
}

/**
 * Fiche complète : le backend la remplace en bloc. Un élément avec `id` est
 * mis à jour, sans `id` créé, et un élément existant absent est supprimé.
 */
export interface BiologySheetRequest {
  sections: BiologySectionRequest[];
  parameters: BiologyParameterRequest[];
}

export const biologySheetApi = {
  get: (labTestId: string) =>
    apiClient.get<BiologySheet>(`/biology-parameters/sheet/${labTestId}`),
  save: (labTestId: string, sheet: BiologySheetRequest) =>
    apiClient.put<BiologySheet>(`/biology-parameters/sheet/${labTestId}`, sheet),
};

// ---------------------------------------------------------------------------
// Catégories de biologie par défaut
// ---------------------------------------------------------------------------

export const biologyCategoriesApi = {
  /**
   * Crée les catégories usuelles absentes (Hématologie, Biochimie…).
   * Idempotent ; renvoie toutes les catégories de biologie de la succursale.
   */
  createDefaults: () =>
    apiClient.post<CategoryTest[]>("/category-tests/biology-defaults"),
};
