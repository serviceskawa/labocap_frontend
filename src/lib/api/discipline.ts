import type { Discipline } from "@/types/api";

/**
 * Discipline envoyée quand l'appelant n'en précise aucune.
 *
 * Le backend retombe déjà sur l'anatomie pathologique quand le paramètre
 * manque ; l'envoyer explicitement rend chaque écran existant indépendant de
 * ce défaut serveur et visible dans l'onglet Réseau.
 */
export const DEFAULT_DISCIPLINE: Discipline = "PATHOLOGY";

/** Ajoute `discipline` aux paramètres de requête, `PATHOLOGY` par défaut. */
export function withDiscipline<P extends object>(
  params?: P & { discipline?: Discipline },
): P & { discipline: Discipline } {
  return {
    ...(params ?? ({} as P)),
    discipline: params?.discipline ?? DEFAULT_DISCIPLINE,
  };
}
