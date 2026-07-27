import apiClient from "./client";
import type { PageResponse } from "@/types/api";

export type InvoicePayment =
  | "ESPECES"
  | "MOBILEMONEY"
  | "MOBILEMONEY-MTN"
  | "MOBILEMONEY-MOOV"
  | "CARTEBANCAIRE"
  | "CHEQUES"
  | "VIREMENT"
  | "CREDIT"
  | "AUTRE";

export interface InvoiceDetail {
  id: string;
  labTestId: string;
  testName: string;
  price: number;
  discount: number;
  quantity: number;
  unitPrice: number;
  total: number;
}

/** Remboursement rattaché à une facture d'avoir (statusInvoice = 1). */
export interface InvoiceRefund {
  code?: string;
  reasonDescription?: string;
  montant: number;
  invoiceCode?: string;
}

export interface Invoice {
  id: string;
  code: string;
  testOrderId?: string;
  testOrderCode?: string;
  patientId: string;
  patientName?: string;
  patientCode?: string;
  contratId?: string;
  contratName?: string;
  clientName?: string;
  clientAddress?: string;
  /** « Contact client » du reçu : téléphone(s) du patient lié, sinon vide. */
  clientContact?: string;
  /** Date saisie à la création. Distincte de createdAt : c'est elle qu'affiche Laravel. */
  date?: string;
  subtotal?: number;
  total: number;
  paid: boolean;
  statusInvoice: number; // 0=vente, 1=avoir
  payment?: InvoicePayment;
  /** Code renvoyé par la DGI après normalisation. */
  codeMecef?: string;
  /** Code normalisé saisi par le caissier (24 caractères). Distinct de codeMecef. */
  codeNormalise?: string;
  qrcode?: string;
  /** Code de la facture de vente d'origine, pour un avoir. */
  referenceCode?: string;
  refund?: InvoiceRefund;
  dueDate?: string;
  branchId: string;
  createdAt: string;
  details?: InvoiceDetail[];
}

export interface InvoiceRequest {
  testOrderId: string;
  patientId?: string;
  date?: string;
  dueDate?: string;
  details?: Array<{ labTestId: string; quantity?: number; unitPrice?: number }>;
}

export interface MarkPaidRequest {
  payment: InvoicePayment;
  /** Code de la facture normalisée (24 caractères) saisi par le caissier. */
  code?: string;
}

export interface FinanceStats {
  totalToday?: number;
  totalMonth?: number;
  totalLastMonth?: number;
}

export interface InvoiceSearchResult {
  ca: number;
  avoir: number;
  facture: number;
  encaissement: number;
}

export interface InvoiceMonthlyStats {
  month: number;
  year: number;
  monthName: string;
  facturated: number;
  credits: number;
  turnover: number;
  collections: number;
}

export interface InvoiceSearchParams {
  startDate?: string;
  endDate?: string;
  [key: string]: unknown;
}

export interface InvoiceReport {
  period: string;
  totalSales: number;
  totalCredits: number;
  turnover: number;
  collections: number;
  byContracts: { contractName: string; total: number }[];
}

export interface InvoiceFindAllParams {
  page?: number;
  size?: number;
  search?: string;
  paid?: string | boolean;
  statusInvoice?: number;
  startDate?: string;
  endDate?: string;
  patient?: string;
  [key: string]: unknown;
}

export const invoicesApi = {
  findAll: (params?: InvoiceFindAllParams) =>
    apiClient.get<PageResponse<Invoice>>("/invoices", { params }),

  findById: (id: string) => apiClient.get<Invoice>(`/invoices/${id}`),

  create: (data: InvoiceRequest) => apiClient.post<Invoice>("/invoices", data),

  update: (id: string, data: Partial<InvoiceRequest>) =>
    apiClient.put<Invoice>(`/invoices/${id}`, data),

  delete: (id: string) => apiClient.delete(`/invoices/${id}`),

  markAsPaid: (id: string, data: MarkPaidRequest) =>
    apiClient.patch<Invoice>(`/invoices/${id}/status`, data),

  /**
   * Vérifie qu'un code normalisé n'est pas déjà utilisé, avant encaissement.
   * Réplique la route Laravel `invoices/checkCode` appelée par updateStatus().
   */
  checkCode: (code: string) =>
    apiClient.get<{ exists: boolean }>("/invoices/check-code", {
      params: { code },
    }),

  confirmMecef: (id: string, uid: string) =>
    apiClient.post<Invoice>(`/invoices/${id}/confirm-mecef`, { uid }),

  cancelMecef: (id: string, uid: string) =>
    apiClient.post<Invoice>(`/invoices/${id}/cancel-mecef`, { uid }),

  /** Télécharge le PDF imprimable de la facture (réplique Laravel invoices/print). */
  downloadPdf: (id: string) =>
    apiClient.get(`/invoices/${id}/pdf`, { responseType: "blob" }),

  getFinanceStats: () => apiClient.get<FinanceStats>("/invoices/business"),

  getMonthlyStats: (year?: number) =>
    apiClient.get<InvoiceMonthlyStats[]>("/invoices/monthly-stats", {
      params: year != null ? { year } : undefined,
    }),

  search: (params: InvoiceSearchParams) =>
    apiClient.get<InvoiceSearchResult>("/invoices/search", { params }),

  getTodayStats: () =>
    apiClient.get<{ totalToday: number }>("/invoices/stats/today"),

  getCounts: () =>
    apiClient.get<{ sales: number; credits: number }>("/invoices/counts"),

  /** Badge « Factures » : factures non encore réglées. */
  countUnpaid: () => apiClient.get<{ count: number }>("/invoices/count-unpaid"),

  getReports: (year?: number, month?: number) =>
    apiClient.get<InvoiceReport>("/invoices/reports", {
      params: { year, month },
    }),
};
