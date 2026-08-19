import apiClient from "./client";
import {
  LoginRequest,
  LoginResponse,
  TwoFactorRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  TwoFaSetupResponse,
  User,
} from "@/types/auth";

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<LoginResponse>("/auth/login", data),

  twoFactor: (data: TwoFactorRequest) =>
    apiClient.post<LoginResponse>("/auth/2fa/challenge", data),

  logout: () => apiClient.post("/auth/logout"),

  refresh: () => apiClient.post("/auth/refresh"),

  forgotPassword: (data: ForgotPasswordRequest) =>
    apiClient.post("/auth/forgot-password", data),

  resetPassword: (data: ResetPasswordRequest) =>
    apiClient.post("/auth/reset-password", data),

  me: () => apiClient.get<User>("/auth/me"),

  resendTwoFactor: (email: string) =>
    apiClient.post("/auth/resend-2fa", { email }),

  /**
   * Engendre un secret et son QR pour une application d'authentification.
   *
   * Le point d'entrée existait depuis longtemps sans qu'aucun écran l'appelle :
   * le TOTP était écrit côté serveur et n'a jamais été proposé à personne.
   */
  setupAuthenticator: () =>
    apiClient.post<TwoFaSetupResponse>("/auth/2fa/setup"),

  /** Confirme la mise en place par un premier code lu dans l'application. */
  enableAuthenticator: (code: string) =>
    apiClient.post("/auth/2fa/verify", { code }),

  /** Retire l'application. Un code valide est exigé — sinon un navigateur
   *  laissé ouvert suffirait à désarmer le second facteur. */
  disableAuthenticator: (code: string) =>
    apiClient.post("/auth/2fa/disable", { code }),
};
