import apiClient from "./client";
import type { PageResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Types — page [id]/macroscopy (macros anatomopathologiques textuelles)
// ---------------------------------------------------------------------------

export interface PathologyMacro {
  id: string;
  title: string;
  content?: string;
  branchId?: string;
  createdAt?: string;
}

export interface PathologyMacroRequest {
  title: string;
  content?: string;
}

export interface BulkMacroRequest {
  macros: PathologyMacroRequest[];
}

// ---------------------------------------------------------------------------
// Types — page macroscopy globale (historique + pendants)
// ---------------------------------------------------------------------------

export interface MacroListItem {
  id: string;
  testOrderId: string;
  testOrderCode: string;
  employeeId?: string;
  employeeName?: string;
  circulation: boolean;
  embedding: boolean;
  microtomySpreading: boolean;
  staining: boolean;
  mounting: boolean;
  macroDate?: string;
  mountingDate?: string;
  createdAt: string;
}

export interface PendingMacroOrder {
  id: string;
  code: string;
  patientName: string;
  isUrgent: boolean;
  createdAt: string;
  typeOrderTitle: string;
  /**
   * Slug du type de bon (`histologie`, `biopsie`, `cytologie`,
   * `pièce-opératoire`…). C'est lui qui répartit les demandes entre les onglets
   * de la macroscopie, comme les requêtes Laravel `whereIn('slug', …)`.
   */
  typeOrderSlug: string | null;
}

export interface AssignMacroRequest {
  testOrderId: string;
  employeeId: string;
  macroDate: string;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const macroscopyApi = {
  // --- Page [id]/macroscopy ---------------------------------------------------
  findAll: (params?: Record<string, unknown>) =>
    apiClient.get<PageResponse<PathologyMacro>>("/pathology-macros", { params }),

  findById: (id: string) =>
    apiClient.get<PathologyMacro>(`/pathology-macros/${id}`),

  search: (q: string) =>
    apiClient.get<PathologyMacro[]>("/pathology-macros/search", { params: { q } }),

  create: (data: PathologyMacroRequest) =>
    apiClient.post<PathologyMacro>("/pathology-macros", data),

  createBulk: (data: BulkMacroRequest) =>
    apiClient.post<PathologyMacro[]>("/pathology-macros/bulk", data),

  update: (id: string, data: PathologyMacroRequest) =>
    apiClient.put<PathologyMacro>(`/pathology-macros/${id}`, data),

  delete: (id: string) => apiClient.delete(`/pathology-macros/${id}`),

  // --- Page macroscopy globale -----------------------------------------------
  listAll: (params?: Record<string, unknown>) =>
    apiClient.get<MacroListItem[]>("/pathology-macros/list", { params }),

  getPending: () =>
    apiClient.get<PendingMacroOrder[]>("/pathology-macros/pending"),

  assign: (data: AssignMacroRequest) =>
    apiClient.post("/pathology-macros/assign", data),

  updateStep: (id: string, step: string) =>
    apiClient.patch(`/pathology-macros/${id}/step`, { step }),

  searchList: (q: string) =>
    apiClient.get<MacroListItem[]>("/pathology-macros/search", { params: { q } }),
};
