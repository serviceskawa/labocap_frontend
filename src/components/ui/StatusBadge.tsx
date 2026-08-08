"use client";

import { Badge, BadgeVariant } from "./Badge";

interface StatusBadgeProps {
  /**
   * Le statut peut être absent : la reprise Laravel a conservé des lignes sans
   * statut, et le type le disait `string` alors que l'API rend `null`. Un type
   * qui ment sur la donnée déplace simplement l'erreur à l'exécution.
   */
  status: string | null | undefined;
  domain: "invoice" | "report" | "testOrder" | "contract" | "general";
}

interface StatusConfig {
  label: string;
  variant: BadgeVariant;
}

const domainMappings: Record<
  StatusBadgeProps["domain"],
  Record<string, StatusConfig>
> = {
  invoice: {
    paid: { label: "Payé", variant: "success" },
    pending: { label: "En attente", variant: "warning" },
    partial: { label: "Partiel", variant: "info" },
    cancelled: { label: "Annulé", variant: "danger" },
  },
  report: {
    DRAFT: { label: "En attente de relecture", variant: "warning" },
    REVIEWED: { label: "Révisé", variant: "info" },
    SIGNED: { label: "Signé", variant: "primary" },
    VALIDATED: { label: "VALIDER", variant: "success" },
    DELIVERED: { label: "Livré", variant: "success" },
  },
  testOrder: {
    PENDING: { label: "En attente", variant: "warning" },
    VALIDATED: { label: "Validé", variant: "success" },
    DELIVERED: { label: "Livré", variant: "success" },
  },
  contract: {
    ACTIF: { label: "Actif", variant: "success" },
    INACTIF: { label: "Inactif", variant: "secondary" },
    "CLÔTURER": { label: "Clôturé", variant: "danger" },
    CLOTURE: { label: "Clôturé", variant: "danger" },
  },
  general: {
    // « Inactif » en rouge (danger) ; « Actif » conserve le fond gris actuel (secondary).
    ACTIF: { label: "ACTIF", variant: "secondary" },
    INACTIF: { label: "INACTIF", variant: "danger" },
  },
};

function getStatusConfig(
  domain: StatusBadgeProps["domain"],
  status: string | null | undefined
): StatusConfig {
  const mapping = domainMappings[domain];

  // Un statut absent n'est pas une anomalie de code : quatre contrats repris de
  // Laravel en portent un nul ou vide. Sans ce garde-fou, `status.toLowerCase()`
  // faisait tomber la page entière — et seulement à partir de la deuxième, les
  // lignes concernées n'étant pas dans les dix premières.
  if (status == null || status === "") {
    return { label: "—", variant: "secondary" };
  }

  // Lookup exact
  if (mapping[status]) return mapping[status];

  // Lookup insensible à la casse
  const key = Object.keys(mapping).find(
    (k) => k.toLowerCase() === status.toLowerCase()
  );
  if (key) return mapping[key];

  // Fallback générique
  return { label: status, variant: "secondary" };
}

export function StatusBadge({ status, domain }: StatusBadgeProps) {
  const config = getStatusConfig(domain, status);
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
