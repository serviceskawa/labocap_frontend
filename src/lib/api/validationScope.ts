import apiClient from "./client";

/**
 * Périmètre de validation d'un compte : les types d'examen dont il peut valider
 * les comptes rendus.
 *
 * Le périmètre est désigné par **libellé** et non par identifiant. La table
 * `type_orders` porte des doublons hérités de la reprise Laravel — deux lignes
 * pour « Cytologie », par exemple — et raisonner par identifiant ferait échouer
 * la moitié des demandes d'un même type sans que rien ne l'explique. Le serveur
 * accorde tous les identifiants partageant le libellé retenu.
 */
export const validationScopeApi = {
  /** Les libellés confiés à ce compte. */
  get: (userId: string) =>
    apiClient.get<string[]>(`/perimetres-de-validation/${userId}`),

  /**
   * Remplace le périmètre. Une liste vide le retire entièrement — c'est ce qui
   * permet à l'écran de cases à cocher de valoir pour l'état entier.
   */
  set: (userId: string, types: string[]) =>
    apiClient.put<string[]>(`/perimetres-de-validation/${userId}`, { types }),

  /**
   * L'historique des décisions prises sur ce compte.
   *
   * Le périmètre courant ne dit rien de ce qui a été accordé puis retiré. Un
   * compte rendu validé six mois plus tôt ne s'explique que par l'état du
   * périmètre à ce moment-là.
   */
  history: (userId: string) =>
    apiClient.get<ValidationScopeHistory[]>(
      `/perimetres-de-validation/${userId}/historique`,
    ),
};

/** Une décision : quand, par qui, et ce qui a changé. */
export interface ValidationScopeHistory {
  quand: string;
  accordePar?: string;
  typesAvant: string;
  typesApres: string;
}
