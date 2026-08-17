import apiClient from "./client";

/**
 * Appareil enrôlé pour l'application mobile.
 */
export interface MobileDevice {
  id: string;
  userId: string;
  label: string;
  enrolledAt: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
}

/**
 * État de l'accès mobile d'un utilisateur.
 */
export interface MobileAccessState {
  userId: string;
  acces: boolean;
  pinDefini: boolean;
  appareils: MobileDevice[];
}

/**
 * Secrets délivrés à l'ouverture d'un accès.
 *
 * Le code d'enrôlement et le code PIN ne sont renvoyés **qu'ici**, une seule
 * fois : la base n'en garde que les empreintes. Ils ne se retrouvent pas — il
 * faut rouvrir l'accès pour en régénérer, ce qui invalide les précédents.
 */
export interface MobileAccessSecrets {
  userId: string;
  nomComplet: string;
  codeEnrolement: string;
  codeExpireLe: string;
  pin: string;
}

export const mobileAccessApi = {
  /** Droit, PIN posé, appareils enrôlés. */
  getState: (userId: string) =>
    apiClient.get<MobileAccessState>(`/mobile/access/${userId}`),

  /**
   * Ouvre l'accès : accorde le droit, engendre le PIN et le code d'enrôlement.
   *
   * Rappelée sur un accès déjà ouvert, elle régénère les deux codes — c'est le
   * moyen prévu de dépanner quelqu'un qui a perdu les siens.
   */
  open: (userId: string) =>
    apiClient.post<MobileAccessSecrets>(`/mobile/access/${userId}`),

  /** Retire le droit, efface le PIN et révoque tous les appareils. */
  close: (userId: string) => apiClient.delete(`/mobile/access/${userId}`),

  /** Coupe un seul appareil, sans toucher au droit ni au PIN. */
  revokeDevice: (deviceId: string) =>
    apiClient.post(`/mobile/devices/${deviceId}/revoke`),
};
