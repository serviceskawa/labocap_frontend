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
  /**
   * Où en est le médecin sur cette demande.
   *
   * `a_traiter` | `pris_en_charge` | `termine`. À ne pas confondre avec le
   * statut du compte rendu, qui dit où en est le document : les deux avancent
   * à des rythmes différents, et prendre « j'ai fini de lire » pour « le compte
   * rendu est validé » ferait disparaître de la file un dossier encore à
   * écrire.
   *
   * Il ne se change qu'ici : sur le téléphone, le médecin lit sa file.
   */
  docteurStatus?: DocteurStatus;
}

/** Les trois états d'une demande dans la file d'un médecin. */
export type DocteurStatus = "a_traiter" | "pris_en_charge" | "termine";

export const LIBELLE_DOCTEUR_STATUS: Record<DocteurStatus, string> = {
  a_traiter: "À traiter",
  pris_en_charge: "Pris en charge",
  termine: "Terminé",
};

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

/** Une étiquette de prélèvement, vue depuis l'écran qui l'administre. */
export interface Etiquette {
  id: string;
  value: string;
  /** Nombre de demandes déjà étiquetées ainsi. */
  usages: number;
}

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

  /**
   * Change où en est le médecin sur une demande.
   *
   * Le seul endroit d'où ce statut bouge. L'application mobile lit cette file
   * sans y toucher : on referme un dossier sur un poste de travail, pas en le
   * consultant entre deux couloirs.
   */
  setDocteurStatus: (detailId: string, statut: DocteurStatus) =>
    apiClient.put(
      `/test-order-assignments/details/${detailId}/statut-medecin`,
      { statut },
    ),

  /**
   * Verse une étiquette au catalogue sans attendre qu'une demande soit
   * affectée.
   *
   * Sans cela, une étiquette saisie puis abandonnée était perdue, et rien ne
   * permettait d'en déclarer une à l'avance. Renvoie le catalogue complet.
   */
  addLabel: (value: string) =>
    apiClient.post<string[]>("/test-order-assignments/labels", { value }),

  /**
   * Le catalogue tel qu'on l'administre.
   *
   * Distinct de `labels()`, qui ne sert que des chaînes aux sélecteurs : ici on
   * a besoin de désigner une ligne — donc son identifiant — et de savoir
   * combien de demandes la portent avant d'y toucher.
   */
  labelCatalogue: () =>
    apiClient.get<Etiquette[]>("/test-order-assignments/labels/catalogue"),

  renameLabel: (id: string, value: string) =>
    apiClient.put<Etiquette>(`/test-order-assignments/labels/${id}`, { value }),

  removeLabel: (id: string) =>
    apiClient.delete<void>(`/test-order-assignments/labels/${id}`),

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
