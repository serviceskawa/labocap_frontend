import type { Discipline } from "@/types/api";
import type { User } from "@/lib/api/users";
import { PERMISSIONS } from "@/lib/constants/permissions";

/**
 * Ce qui distingue, à l'écran, un lot d'affectation d'anatomie pathologique
 * d'un lot de biologie : routes, libellés, clés de cache et destinataires.
 *
 * Les écrans de lots (liste, détails) sont communs aux deux disciplines ; tout
 * ce qui en dépend passe par ici, pour que l'anatomie pathologique garde
 * exactement ses URL, ses libellés, ses clés de cache et ses requêtes.
 *
 * Le lot lui-même n'a pas de discipline côté serveur : il prend celle des
 * demandes qu'on y range, et le serveur refuse (422) d'y mélanger les deux.
 */
export interface AssignmentDisciplineConfig {
  discipline: Discipline;
  routes: {
    list: string;
    details: (id: string) => string;
    /**
     * Bordereau d'impression — une seule route pour les deux disciplines :
     * c'est la réponse du serveur (`discipline`) qui en fixe l'intitulé.
     */
    print: (id: string) => string;
  };
  labels: {
    listTitle: string;
    /** Destinataire du lot : « Docteur » ou « Biologiste ». */
    assignee: string;
    assigneeCreatePlaceholder: string;
    assigneeEditPlaceholder: string;
    assigneeFilterAll: string;
    assigneeRequired: string;
    /** Précision affichée sous le sélecteur de destinataire, s'il y a lieu. */
    assigneeHint?: string;
    /** « Demande d'examen » / « Demande d'analyses » : filtre et colonne. */
    order: string;
    orderCodeHint: string;
    orderPlaceholder: string;
    orderRequired: string;
    orderAdded: string;
    orderReassigned: string;
    detailsHeading: string;
    detailsEmpty: string;
    /** Suivi du destinataire sur chaque demande. */
    follow: string;
    followUpdated: string;
    reassignTitle: string;
    reassignFallback: string;
  };
  /** Fil d'Ariane racine (Accueil, et Biologie pour la biologie). */
  rootCrumbs: { label: string; href?: string }[];
  /**
   * Clé de cache de la liste des lots. Anatomie pathologique : la clé
   * d'origine ; biologie : la discipline insérée après la racine, pour que les
   * deux listes ne partagent jamais d'entrée tout en restant invalidées par
   * `["assignments"]`.
   */
  listQueryKey: unknown[];
  /** Peut-on confier un lot de cette discipline à cet utilisateur ? */
  isAssignee: (user: User) => boolean;
}

/**
 * Le filtre historique des destinataires d'anatomie pathologique : le NOM du
 * rôle. Conservé tel quel — le changer modifierait la liste des médecins.
 */
function isDoctorRole(name?: string): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return (
    n.includes("docteur") ||
    n.includes("doctor") ||
    n.includes("medecin") ||
    n.includes("médecin") ||
    n.includes("anapath") ||
    n.includes("anatomopath")
  );
}

/**
 * Permissions qui font d'un utilisateur un destinataire possible d'un lot de
 * biologie : saisir les résultats (technicien) ou valider le compte rendu
 * (biologiste).
 *
 * Il n'existe pas de rôle « biologiste » : filtrer par nom de rôle, comme en
 * anatomie pathologique, dépendrait du vocabulaire de chaque laboratoire. Les
 * permissions, elles, sont celles du catalogue — `GET /users` les expose par
 * rôle (`roles[].permissions`) et en direct (`directPermissions`).
 */
const BIOLOGY_ASSIGNEE_PERMISSIONS: readonly string[] = [
  PERMISSIONS.EDIT_BIOLOGY_RESULTS,
  PERMISSIONS.VALIDATE_BIOLOGY_REPORTS,
];

function holdsBiologyPermission(user: User): boolean {
  const slugs = [
    ...(user.roles ?? []).flatMap((r) => r.permissions ?? []),
    ...(user.directPermissions ?? []),
  ].map((p) => p.slug);
  return slugs.some((s) => BIOLOGY_ASSIGNEE_PERMISSIONS.includes(s));
}

export const ASSIGNMENT_DISCIPLINES: Record<Discipline, AssignmentDisciplineConfig> = {
  PATHOLOGY: {
    discipline: "PATHOLOGY",
    routes: {
      list: "/test-orders/assignments",
      details: (id) => `/test-orders/assignments/${id}`,
      print: (id) => `/test-orders/assignments/${id}/print`,
    },
    labels: {
      listTitle: "Affectation des comptes rendu",
      assignee: "Docteur",
      assigneeCreatePlaceholder: "Sélectionner un docteur",
      assigneeEditPlaceholder: "Sélectionner le docteur",
      assigneeFilterAll: "Tous les docteurs",
      assigneeRequired: "Veuillez sélectionner un docteur",
      order: "Demande d'examen",
      orderCodeHint: "[Demande d'examen/Reférence]",
      orderPlaceholder: "Rechercher une demande d'examen (code, patient)",
      orderRequired: "Veuillez sélectionner une demande d'examen",
      orderAdded: "Demande d'examen ajoutée",
      orderReassigned: "Demande d'examen réaffectée",
      detailsHeading: "Liste des demandes d'examens affectées",
      detailsEmpty: "Aucune demande d'examen affectée",
      follow: "Suivi du médecin",
      followUpdated: "Suivi du médecin mis à jour.",
      reassignTitle: "Réaffecter cette demande d'examen",
      reassignFallback: "Cette demande d'examen est déjà affectée à un autre médecin.",
    },
    rootCrumbs: [{ label: "Accueil", href: "/home" }],
    listQueryKey: ["assignments", "all"],
    isAssignee: (u) => (u.roles ?? []).some((r) => isDoctorRole(r.name)),
  },
  BIOLOGY: {
    discipline: "BIOLOGY",
    routes: {
      list: "/biologie/affectations",
      details: (id) => `/biologie/affectations/${id}`,
      print: (id) => `/test-orders/assignments/${id}/print`,
    },
    labels: {
      listTitle: "Affectation des analyses",
      assignee: "Biologiste",
      assigneeCreatePlaceholder: "Sélectionner un biologiste",
      assigneeEditPlaceholder: "Sélectionner le biologiste",
      assigneeFilterAll: "Tous les biologistes",
      assigneeRequired: "Veuillez sélectionner un biologiste",
      assigneeHint:
        "Utilisateurs habilités à saisir les résultats ou à valider les comptes rendus de biologie.",
      order: "Demande d'analyses",
      orderCodeHint: "[Demande d'analyses/Référence]",
      orderPlaceholder: "Rechercher une demande d'analyses (code, patient)",
      orderRequired: "Veuillez sélectionner une demande d'analyses",
      orderAdded: "Demande d'analyses ajoutée",
      orderReassigned: "Demande d'analyses réaffectée",
      detailsHeading: "Liste des demandes d'analyses affectées",
      detailsEmpty: "Aucune demande d'analyses affectée",
      follow: "Suivi du biologiste",
      followUpdated: "Suivi du biologiste mis à jour.",
      reassignTitle: "Réaffecter cette demande d'analyses",
      reassignFallback: "Cette demande d'analyses est déjà affectée à un autre biologiste.",
    },
    rootCrumbs: [{ label: "Accueil", href: "/home" }, { label: "Biologie" }],
    listQueryKey: ["assignments", "BIOLOGY", "all"],
    isAssignee: holdsBiologyPermission,
  },
};
