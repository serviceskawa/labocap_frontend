import apiClient from "./client";
import type { Discipline, PageResponse } from "@/types/api";
import { DEFAULT_DISCIPLINE, withDiscipline } from "./discipline";

export interface CategoryTest {
  id: string;
  code: string;
  name: string;
  branchId: string;
}

export interface LabTest {
  id: string;
  name: string;
  price: number;
  categoryTestId: string;
  categoryTestName: string;
  status: string;
  branchId: string;
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
  create: (data: { code: string; name: string }) =>
    apiClient.post<CategoryTest>("/category-tests", data),
  update: (id: string, data: { code: string; name: string }) =>
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
  create: (data: {
    name: string;
    price: number;
    categoryTestId: string;
    status: string;
  }) => apiClient.post<LabTest>("/lab-tests", data),
  update: (
    id: string,
    data: { name: string; price: number; categoryTestId: string; status: string }
  ) => apiClient.put<LabTest>(`/lab-tests/${id}`, data),
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
