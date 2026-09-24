import apiClient from "./client";
import type { BiologyKind, Discipline, PageResponse } from "@/types/api";
import { DEFAULT_DISCIPLINE, withDiscipline } from "./discipline";

export interface CategoryTest {
  id: string;
  code: string;
  name: string;
  branchId: string;
  /** Renvoyée par le backend depuis le catalogue de biologie (B3). */
  discipline?: Discipline;
}

export interface LabTest {
  id: string;
  name: string;
  price: number;
  categoryTestId: string;
  categoryTestName: string;
  status: string;
  branchId: string;
  code?: string | null;
  discipline?: Discipline;
  /** Biologie uniquement : `null` en anatomie pathologique. */
  biologyKind?: BiologyKind | null;
  /** Biologie uniquement : type d'échantillon attendu (ex. « Sang total »). */
  specimenType?: string | null;
}

/** Charge d'une catégorie. `discipline` n'est lue qu'à la création. */
export interface CategoryTestRequest {
  code?: string | null;
  name: string;
  /** Absente = `PATHOLOGY` côté backend (formulaires d'anapath inchangés). */
  discipline?: Discipline;
}

/**
 * Charge d'une analyse. Les champs de biologie sont refusés par le backend sur
 * une analyse d'anatomie pathologique : les écrans d'anapath ne les envoient pas.
 */
export interface LabTestRequest {
  name: string;
  price: number;
  categoryTestId: string;
  status: string;
  code?: string | null;
  /** Lue à la création seulement ; absente = `PATHOLOGY`. */
  discipline?: Discipline;
  /** Lue à la création seulement (biologie). */
  biologyKind?: BiologyKind;
  specimenType?: string | null;
}

export interface UniteMesure {
  id: string;
  name: string;
  abbreviation?: string;
  branchId: string;
}

export interface TypeOrder {
  id: string;
  title: string;
  branchId: string;
}

export const categoryTestsApi = {
  findAll: (params?: { page?: number; size?: number; discipline?: Discipline }) =>
    apiClient.get<PageResponse<CategoryTest>>("/category-tests", {
      params: withDiscipline(params),
    }),
  create: (data: CategoryTestRequest) =>
    apiClient.post<CategoryTest>("/category-tests", data),
  update: (id: string, data: CategoryTestRequest) =>
    apiClient.put<CategoryTest>(`/category-tests/${id}`, data),
  delete: (id: string) => apiClient.delete(`/category-tests/${id}`),
};

export const labTestsApi = {
  findAll: (params?: {
    page?: number;
    size?: number;
    search?: string;
    status?: string;
    /** `PATHOLOGY` par défaut. */
    discipline?: Discipline;
  }) =>
    apiClient.get<PageResponse<LabTest>>("/lab-tests", {
      params: withDiscipline(params),
    }),
  getById: (id: string) => apiClient.get<LabTest>(`/lab-tests/${id}`),
  create: (data: LabTestRequest) => apiClient.post<LabTest>("/lab-tests", data),
  update: (id: string, data: LabTestRequest) =>
    apiClient.put<LabTest>(`/lab-tests/${id}`, data),
  delete: (id: string) => apiClient.delete(`/lab-tests/${id}`),
  findAllSimple: (discipline: Discipline = DEFAULT_DISCIPLINE) =>
    apiClient.get<LabTest[]>("/lab-tests/all", { params: { discipline } }),
};

export const unitesMesureApi = {
  findAll: () => apiClient.get<UniteMesure[]>("/unit-measurements/all"),
  findPaged: (params?: { page?: number; size?: number }) =>
    apiClient.get<PageResponse<UniteMesure>>("/unit-measurements", { params }),
  create: (data: { name: string; abbreviation?: string }) =>
    apiClient.post<UniteMesure>("/unit-measurements", data),
  update: (id: string, data: { name: string; abbreviation?: string }) =>
    apiClient.put<UniteMesure>(`/unit-measurements/${id}`, data),
  delete: (id: string) => apiClient.delete(`/unit-measurements/${id}`),
};

// Lecture seule : les types d'examen ne sont plus gérables depuis le catalogue
// (page /examens/types supprimée). findAll reste utilisé comme filtre/sélecteur
// dans les demandes d'examen, la recherche, le suivi et la macroscopie.
export const typeOrdersApi = {
  findAll: () => apiClient.get<TypeOrder[]>("/type-orders/all"),
};
