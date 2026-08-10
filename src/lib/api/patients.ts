import apiClient from "./client";
import type { PageResponse } from "@/types/api";

export interface Patient {
  id: string;
  code: string;
  firstname: string;
  lastname: string;
  genre: string;
  langue: string;
  birthday?: string;
  age?: number;
  yearOrMonth?: boolean; // true = Ans, false = Mois
  profession?: string;
  telephone1: string;
  telephone2?: string;
  adresse: string;
  email?: string;
  branchId: string;
  createdAt: string;
  // Totaux financiers renseignés uniquement dans la liste (comme le tableau Laravel)
  totalInvoiced?: number;
  totalPaid?: number;
  totalUnpaid?: number;
}

export interface TestOrderSummary {
  id: string;
  code: string;
  status: string;
  prelevementDate: string;
  createdAt: string;
}

export interface InvoiceSummary {
  id: string;
  total: number;
  status: string;
  dueDate?: string;
  createdAt: string;
}

export interface PatientProfile {
  patient: Patient;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  recentOrders: TestOrderSummary[];
  totalInvoiced: number;
  totalPaid: number;
  totalUnpaid: number;
  recentInvoices: InvoiceSummary[];
}

export interface PatientRequest {
  code: string;
  firstname: string;
  lastname: string;
  genre: string;
  langue: string;
  birthday?: string;
  age?: number;
  yearOrMonth?: boolean;
  profession?: string;
  /**
   * Facultatif : le backend ne porte aucune annotation de validation dessus et
   * la colonne accepte NULL. Le caractère obligatoire n'existait que dans les
   * formulaires, et le client a demandé sa levée.
   */
  telephone1?: string;
  telephone2?: string;
  adresse: string;
  email?: string;
}

export const patientsApi = {
  findAll: (params: { page?: number; size?: number; search?: string }) =>
    apiClient.get<PageResponse<Patient>>("/patients", { params }),
  findById: (id: string) =>
    apiClient.get<PatientProfile>(`/patients/${id}/profile`),
  create: (data: PatientRequest) =>
    apiClient.post<Patient>("/patients", data),
  update: (id: string, data: PatientRequest) =>
    apiClient.put<Patient>(`/patients/${id}`, data),
  delete: (id: string) =>
    apiClient.delete(`/patients/${id}`),
};
