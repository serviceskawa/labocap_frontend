import apiClient from "./client";
import type { PageResponse } from "@/types/api";

/**
 * Signalements (« Problèmes signalés » de Laravel `examens/signals`).
 *
 * Distinct des Tickets de support (`/lib/api/support`) : un signalement cible un
 * bon d'examen précis et un type de problème métier (erreur d'enregistrement /
 * annulation de facture). Backend Java : `/api/v1/signals` (permission
 * `view-tickets`).
 */

/** Types de signal — mêmes valeurs que le select Laravel (`type_signal`). */
export const SIGNAL_TYPES = [
  { value: "erreurSaving", label: "Erreur d'enregistrement" },
  { value: "cancelInvoice", label: "Annulation de facture" },
] as const;

export function signalTypeLabel(value?: string): string {
  return SIGNAL_TYPES.find((t) => t.value === value)?.label ?? "Annulation de facture";
}

export interface Signal {
  id: string;
  testOrderId: string;
  /** Code du bon d'examen signalé (« Code examen »). */
  testOrderCode: string | null;
  typeSignal: string;
  commentaire: string | null;
  status: boolean | null;
  userId: string;
  /** Nom de l'émetteur (« Envoyé par »). */
  userName: string | null;
  branchId: string;
  createdAt: string;
}

export interface SignalRequest {
  /** Identifiant du bon, si on l'a déjà. */
  testOrderId?: string;
  /**
   * Code saisi par l'utilisateur (« 26-0008 »). Le serveur le résout lui-même,
   * comme SignalController::store() en Laravel.
   */
  testOrderCode?: string;
  typeSignal: string;
  commentaire?: string;
}

export const signalsApi = {
  findAll: (params?: { page?: number; size?: number }) =>
    apiClient.get<PageResponse<Signal>>("/signals", { params }),

  create: (data: SignalRequest) => apiClient.post<Signal>("/signals", data),
};
