import type { Discipline } from "@/types/api";

/**
 * Ce qui distingue, à l'écran, un bon d'anatomie pathologique d'un bon de
 * biologie : routes, libellés et clés de cache.
 *
 * Les écrans de bons (liste, formulaire, détails) sont communs aux deux
 * disciplines ; tout ce qui en dépend passe par ici, pour que l'anatomie
 * pathologique garde exactement ses URL, ses libellés et ses clés.
 */
export interface TestOrderDisciplineConfig {
  discipline: Discipline;
  routes: {
    list: string;
    create: string;
    details: (id: string) => string;
    edit: (id: string) => string;
  };
  labels: {
    /** Titre de la liste et libellé du fil d'Ariane. */
    list: string;
    /** Titre du formulaire de création. */
    createTitle: string;
    /** Lien d'ajout, en tête de la liste. */
    newButton: string;
    /** Bouton de soumission du formulaire de création. */
    createButton: string;
    /** Fil d'Ariane de la page de création. */
    createCrumb: string;
    editTitle: string;
    detailsTitle: string;
    /** En-tête de la section des analyses sur la page détails. */
    testsHeading: string;
    /** Étiquette du sélecteur d'analyse et en-tête de colonne. */
    testLabel: string;
    testPlaceholder: string;
    /** En-tête de la colonne « Examens » de la liste. */
    testsColumn: string;
  };
  /** Fil d'Ariane racine (Accueil, et Biologie pour la biologie). */
  rootCrumbs: { label: string; href?: string }[];
}

export const TEST_ORDER_DISCIPLINES: Record<Discipline, TestOrderDisciplineConfig> = {
  PATHOLOGY: {
    discipline: "PATHOLOGY",
    routes: {
      list: "/test-orders",
      create: "/test-orders/create",
      details: (id) => `/test-orders/${id}/details`,
      edit: (id) => `/test-orders/${id}/edit`,
    },
    labels: {
      list: "Demandes d'examen",
      createTitle: "Ajouter une nouvelle demande d'examen",
      newButton: "Ajouter une nouvelle demande d'examen",
      createButton: "Ajouter une nouvelle demande d'examen",
      createCrumb: "Nouvelle demande",
      editTitle: "Modifier la demande d'examen",
      detailsTitle: "Demande d'examen",
      testsHeading: "Examens demandés",
      testLabel: "Examen",
      testPlaceholder: "Sélectionner un examen...",
      testsColumn: "Examens",
    },
    rootCrumbs: [{ label: "Accueil", href: "/home" }],
  },
  BIOLOGY: {
    discipline: "BIOLOGY",
    routes: {
      list: "/biologie/demandes",
      create: "/biologie/demandes/nouvelle",
      details: (id) => `/biologie/demandes/${id}`,
      edit: (id) => `/biologie/demandes/${id}/modifier`,
    },
    labels: {
      list: "Demandes d'analyses",
      createTitle: "Nouvelle demande d'analyses",
      newButton: "Nouvelle demande d'analyses",
      createButton: "Enregistrer la demande d'analyses",
      createCrumb: "Nouvelle demande",
      editTitle: "Modifier la demande d'analyses",
      detailsTitle: "Demande d'analyses",
      testsHeading: "Analyses & cultures",
      testLabel: "Analyse ou culture",
      testPlaceholder: "Sélectionner une analyse ou une culture...",
      testsColumn: "Analyses",
    },
    rootCrumbs: [{ label: "Accueil", href: "/home" }, { label: "Biologie" }],
  },
};

/**
 * Clé de cache d'une requête de bons.
 *
 * Anatomie pathologique : la clé d'origine, inchangée (`["test-orders", …]`).
 * Biologie : la discipline est insérée juste après la racine
 * (`["test-orders", "BIOLOGY", …]`), pour que les deux listes ne partagent
 * jamais une entrée de cache, tout en restant invalidées par la racine seule.
 */
export function orderQueryKey(
  discipline: Discipline,
  root: string,
  ...rest: unknown[]
): unknown[] {
  return discipline === "PATHOLOGY" ? [root, ...rest] : [root, discipline, ...rest];
}
