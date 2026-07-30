import type { AxiosError } from "axios";
import type { ApiError } from "@/types/api";

/**
 * Traductions des codes d'erreur métier renvoyés par le backend (BusinessException).
 * Le backend renvoie un code en MAJUSCULES_SNAKE dans `message` ; on l'affiche en
 * français lisible plutôt que le code brut.
 */
const API_ERROR_MESSAGES: Record<string, string> = {
  CONTRACT_INVOICE_ALREADY_PAID:
    "La facture groupée de ce contrat est déjà payée. Ouvrez une nouvelle facture pour ce contrat avant de valider d'autres examens.",
  CONTRACT_NO_INVOICE:
    "Aucune facture ouverte pour ce contrat. Créez une facture avant de valider l'examen.",
  TEST_ORDER_NO_CONTRACT:
    "Cette demande n'a pas de contrat associé.",
  CODE_GENERATION_CONFLICT:
    "Conflit lors de la génération du code (deux validations simultanées). Réessayez.",
  INVOICE_ALREADY_PAID: "Cette facture est déjà payée.",
  CONTRACT_ALREADY_ACTIVE: "Ce contrat est déjà actif.",
  CATEGORY_DETAIL_ALREADY_EXISTS:
    "Cet examen existe déjà dans cette catégorie.",
  MECEF_DISABLED: "La normalisation MECEF/DGI est désactivée.",
  PATIENT_HAS_ORDERS:
    "Ce patient a des demandes d'examen : suppression impossible.",
  PAYMENT_ALREADY_SUCCESS: "Ce paiement a déjà été effectué avec succès.",
  REFUND_ALREADY_EXISTS: "Un remboursement existe déjà pour cette facture.",
  REFUND_AMOUNT_EXCEEDS_INVOICE:
    "Le montant du remboursement dépasse le total de la facture.",
  TOKEN_PAYMENT_NOT_CONFIGURED: "Le paiement par jeton n'est pas configuré.",
};

/**
 * Traduit un code d'erreur métier en message français. Si la chaîne n'est pas un
 * code connu, elle est renvoyée telle quelle (déjà un message lisible).
 */
export function translateApiError(message?: string | null): string | undefined {
  if (!message) return undefined;
  return API_ERROR_MESSAGES[message] ?? message;
}

/**
 * Extrait et traduit le message d'une erreur Axios, avec repli sur un message
 * générique fourni par l'appelant.
 *
 * Accepte aussi une `Error` simple : certaines mutations rejettent côté client
 * avant tout appel réseau (garde-fous de saisie). Sans ce cas, `err.response`
 * est absent et le message précis est remplacé par le repli générique.
 */
export function getApiErrorMessage(
  err: AxiosError<ApiError> | Error,
  fallback = "Une erreur est survenue"
): string {
  const axiosErr = err as AxiosError<ApiError>;
  const apiMessage = translateApiError(axiosErr.response?.data?.message);
  if (apiMessage) return apiMessage;
  // Erreur non-Axios : son `message` est écrit par nous, donc déjà lisible.
  // Sur une vraie erreur Axios on garde le repli, car `err.message` vaudrait
  // « Request failed with status code 500 ».
  if (!axiosErr.isAxiosError) return err.message || fallback;
  return fallback;
}
