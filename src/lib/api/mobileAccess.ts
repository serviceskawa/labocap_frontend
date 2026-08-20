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
  /**
   * Le code d'enrôlement vivant, pour réafficher le QR à volonté.
   *
   * Nul quand il n'y en a pas, quand le serveur n'a pas de clé de chiffrement
   * configurée, ou pour un code délivré avant que la base ne le conserve : il
   * enrôle encore, mais ne se réaffiche pas. Nul aussi pour qui n'a pas le
   * droit d'en créer.
   */
  codeEnrolement: string | null;
  codeCreeLe: string | null;
}

/**
 * Secrets délivrés à l'ouverture d'un accès.
 *
 * Le **code PIN** n'est renvoyé qu'ici, une seule fois : la base n'en garde que
 * l'empreinte, et rien ne le retrouve. Le code d'enrôlement, lui, se réaffiche
 * — voir `MobileAccessState.codeEnrolement`.
 */
export interface MobileAccessSecrets {
  userId: string;
  nomComplet: string;
  codeEnrolement: string;
  /** Nul : la validité tient désormais à la révocation, plus au temps. */
  codeExpireLe: string | null;
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

  /**
   * Éteint le code d'enrôlement : le QR cesse de rattacher des téléphones.
   *
   * Les appareils déjà enrôlés continuent de fonctionner — c'est la porte qu'on
   * ferme, pas les clés déjà remises.
   */
  revokeCode: (userId: string) =>
    apiClient.delete(`/mobile/enrollment-codes/${userId}`),
};
