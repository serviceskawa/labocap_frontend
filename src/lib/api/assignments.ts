import apiClient from "./client";
import type { PageResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Assignment {
  id: string;
  code: string;
  userId: string;
  userName: string;
  date?: string;
  note?: string;
  nbrDetails: number;
  /** Codes des bons d'examen contenus dans l'affectation (pour le filtre "Demande d'examen"). */
  detailCodes?: string[];
  branchId: string;
  createdAt: string;
}

export interface AssignmentDetail {
  id: string;
  testOrderId: string;
  testOrderCode: string;
  /**
   * Étiquettes physiques des prélèvements affectés — « L1 », « L2 »…
   *
   * Une demande regroupe parfois plusieurs prélèvements, et ils ne partent pas
   * toujours ensemble. Vides pour les affectations antérieures à leur
   * enregistrement.
   */
  labels?: string[];
  note?: string;
}

export interface AssignmentRequest {
  userId: string;
  date?: string;
  note?: string;
}

export interface AssignmentDetailRequest {
  testOrderId: string;
  labels?: string[];
  note?: string;
  date?: string;
}

export interface AssignmentPrint {
  assignment: Assignment;
  details: AssignmentDetail[];
  branchName?: string;
  branchAddress?: string;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const assignmentsApi = {
  findAll: (params?: { page?: number; size?: number }) =>
    apiClient.get<PageResponse<Assignment>>("/test-order-assignments", {
      params,
    }),

  findAllImmuno: (params?: { page?: number; size?: number }) =>
    apiClient.get<PageResponse<Assignment>>(
      "/test-order-assignments/immuno",
      { params }
    ),

  create: (data: AssignmentRequest) =>
    apiClient.post<Assignment>("/test-order-assignments", data),

  update: (id: string, data: AssignmentRequest) =>
    apiClient.put<Assignment>(`/test-order-assignments/${id}`, data),

  /**
   * Le vocabulaire d'étiquettes déjà employé par la branche.
   *
   * Alimenté par l'usage côté serveur : une étiquette saisie sur un lot est
   * proposée sur les suivants, ici comme sur le mobile. Une liste figée dans le
   * code n'aurait convenu qu'à un seul laboratoire.
   */
  labels: () =>
    apiClient.get<string[]>("/test-order-assignments/labels"),

  addDetail: (assignmentId: string, data: AssignmentDetailRequest) =>
    apiClient.post<AssignmentDetail>(
      `/test-order-assignments/${assignmentId}/details`,
      data
    ),

  deleteDetail: (detailId: string) =>
    apiClient.delete(`/test-order-assignments/details/${detailId}`),

  // Sert aussi à récupérer les détails d'une affectation
  getPrint: (id: string) =>
    apiClient.get<AssignmentPrint>(`/test-order-assignments/${id}/print`),
};
