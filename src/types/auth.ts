export interface User {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  signature?: string;
  /**
   * L'utilisateur reçoit-il ses codes de connexion depuis une application
   * d'authentification ? Détermine ce que propose le profil : activer ou
   * retirer.
   */
  twoFactorEnabled?: boolean;
  branchId: string;
  roles: Role[];
  permissions: string[];
  isActive?: boolean;
  createdAt?: string;
}

export interface RolePermission {
  id: string;
  name: string;
  slug: string;
}

export interface Role {
  id: string;
  name: string;
  slug?: string;
  permissions: RolePermission[];
}

export interface LoginRequest {
  email: string;
  password: string;
  remember?: boolean;
}

export interface LoginResponse {
  user?: User;
  requires2fa?: boolean;
  /**
   * Canal employé pour ce challenge : « APP » quand l'utilisateur a une
   * application d'authentification, « EMAIL » sinon. Dit ce qui a été fait, non
   * ce qui est exigé — les deux codes restent acceptés à la vérification.
   */
  otpCanal?: string;
  expiresIn?: number;
  tempToken?: string;
}

export interface TwoFactorRequest {
  code: string;
  /**
   * Optionnel : l'API reprend le token temporaire du cookie HttpOnly `pending_2fa`
   * posé au login lorsqu'il n'est pas transmis (le client n'a donc pas à le stocker).
   */
  tempToken?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  email: string;
  password: string;
  passwordConfirmation: string;
}

/**
 * Réponse de la mise en place d'une application d'authentification.
 *
 * @property secret       le secret en base32, pour une saisie manuelle quand la
 *                        caméra du téléphone ne coopère pas
 * @property qrCodeBase64 image PNG du QR, déjà encodée : le serveur la produit,
 *                        le navigateur n'a qu'à l'afficher
 */
export interface TwoFaSetupResponse {
  secret: string;
  qrCodeBase64: string;
}
