import type { ReportStatus } from "@/lib/api/reports";

/**
 * Emplacement réservé aux actions du compte-rendu de biologie, dans la carte
 * d'état de la saisie des résultats :
 *
 * - « Validation biologique » (`validate-biology-reports`) — backend B6 ;
 * - « Imprimer » (PDF ouvert en blob dans un nouvel onglet — la CSP interdit
 *   l'iframe) — backend B7.
 *
 * Les deux routes ne sont pas encore livrées côté API : le composant ne rend
 * rien pour l'instant. Il existe pour que F9 partie 2 n'ait qu'à le remplir,
 * sans retoucher la page.
 */
export interface BiologyReportActionsProps {
  reportId: string | null;
  status: ReportStatus | null;
}

export function BiologyReportActions(props: BiologyReportActionsProps) {
  void props;
  return null;
}
