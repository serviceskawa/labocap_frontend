"use client";

import { useQuery } from "@tanstack/react-query";
import { brandingApi } from "@/lib/api/branding";
import { useAppSettings } from "@/hooks/useAppSettings";

/** Nom affiché quand aucun `app_name` n'est configuré côté Paramètres. */
export const DEFAULT_APP_NAME = "AnapathLab";

export interface Branding {
  /** Nom du laboratoire (onglet, alt du logo, repli textuel). */
  appName: string;
  /** Logo sur fond clair — vide si aucun logo n'est configuré. */
  logo: string;
  /** Logo sur fond sombre (sidebar Hyper) ; retombe sur `logo` si absent. */
  logoWhite: string;
  /** Icône d'onglet — vide pour laisser `public/favicon.ico` s'appliquer. */
  favicon: string;
}

/**
 * Habillage de l'application, disponible **avant comme après connexion**.
 *
 * Deux sources se superposent, dans cet ordre de priorité :
 *
 *  1. `/setting-apps` (via {@link useAppSettings}) — l'habillage de la branche
 *     active. Nécessite d'être connecté ET de porter la permission `view-settings`.
 *  2. `/public/branding` — route ouverte renvoyant l'habillage de la branche mère,
 *     restreinte à une liste blanche de clés côté backend.
 *
 * La seconde sert de socle : elle garantit que le logo s'affiche sur les écrans
 * d'authentification (aucun JWT) et pour les utilisateurs sans `view-settings`
 * (un technicien, par exemple), qui ne voyaient jusqu'ici que l'initiale de repli.
 */
/**
 * Valeurs sentinelles héritées de l'ancienne application : en production,
 * `setting_apps.logo` et `logo_white` portent littéralement la chaîne « path »,
 * gabarit jamais renseigné. Non filtrées, elles passent pour un logo configuré :
 * l'application demande alors `<img src="path">`, essuie une 404, et ne bascule
 * sur son repli qu'après l'échec.
 *
 * Exporté car tous les écrans ne passent pas par {@link useBranding} — les
 * documents imprimés lisent `setting_apps` directement.
 */
const PLACEHOLDERS = new Set(["path", "null", "undefined", "-", "n/a"]);

export function isPlaceholder(value: string | undefined | null): boolean {
  const v = value?.trim().toLowerCase() ?? "";
  return v === "" || PLACEHOLDERS.has(v);
}

export function useBranding(): Branding {
  const { data: publicBranding } = useQuery({
    queryKey: ["public-branding"],
    queryFn: () => brandingApi.get(),
    // Les logos sont stockés en data-URI et pèsent lourd : on évite de les
    // recharger à chaque navigation. Le backend pose déjà un Cache-Control 5 min.
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });

  const { data: appSettings } = useAppSettings();

  // (filtre partagé, cf. isPlaceholder)
  // Valeurs sentinelles héritées de l'ancienne application : en production,
  // `setting_apps.logo` et `logo_white` portent littéralement la chaîne
  // « path » — un gabarit jamais renseigné. Non filtrées, elles passent pour un
  // logo configuré : l'application demande alors `<img src="path">` à chaque
  // affichage, essuie une 404, et ne bascule sur son repli qu'après l'échec.
  const pick = (key: string) => {
    const value =
      appSettings?.[key]?.trim() || publicBranding?.[key]?.trim() || "";
    return isPlaceholder(value) ? "" : value;
  };

  const logo = pick("logo");
  const logoWhite = pick("logo_white");

  return {
    appName: pick("app_name") || DEFAULT_APP_NAME,
    logo,
    logoWhite: logoWhite || logo,
    favicon: pick("favicon"),
  };
}
