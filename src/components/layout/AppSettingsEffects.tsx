"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { DEFAULT_APP_NAME, useBranding } from "@/hooks/useBranding";

/**
 * Applique les réglages « Général » qui n'étaient enregistrés mais jamais utilisés :
 *  - `favicon` → icône de l'onglet du navigateur (`<link rel="icon">`).
 *  - `app_name` → titre du document (onglet).
 *
 * Rendu invisible ; à placer dans le layout du dashboard (post-authentification).
 */
export function AppSettingsEffects() {
  // Via useBranding : la route publique `/public/branding` prend le relais quand
  // `/setting-apps` est refusé (permission `view-settings` absente), de sorte que
  // l'icône et le titre d'onglet soient corrects pour tous les profils.
  const branding = useBranding();
  const favicon = branding.favicon;
  // DEFAULT_APP_NAME est déjà le titre statique du layout racine : inutile de le
  // réécrire à chaque navigation tant qu'aucun nom n'a été configuré.
  const appName =
    branding.appName === DEFAULT_APP_NAME ? undefined : branding.appName;
  // Next réécrit le <title> à chaque navigation ; on ré-applique après chaque
  // changement de route pour que le nom du labo reste dans l'onglet.
  const pathname = usePathname();

  useEffect(() => {
    const head = document.head;
    // Le fichier d'icône par défaut vit dans `public/favicon.ico` (et NON dans
    // `app/`) : Next n'injecte donc aucun <link rel="icon"> concurrent. Sans cela
    // il en déclarait un en `sizes="256x256"`, que le navigateur retenait en
    // priorité — l'icône choisie dans les Paramètres n'était jamais appliquée.
    // Le navigateur récupère l'icône par défaut tout seul sur /favicon.ico ; dès
    // qu'une déclaration explicite existe, c'est elle qui l'emporte.
    const previous = head.querySelectorAll<HTMLLinkElement>(
      "link[data-app-favicon]"
    );
    // On remplace le <link> au lieu d'en modifier le href : Chrome ne relit pas
    // toujours une icône dont seul l'attribut change, alors qu'un nœud fraîchement
    // inséré est systématiquement pris en compte (favicon mis à jour sans F5).
    previous.forEach((el) => el.remove());
    if (!favicon) return; // favicon vidée dans les Paramètres → retour au défaut

    const mime = /^data:([^;,]+)[;,]/.exec(favicon)?.[1];
    // `shortcut icon` en plus de `icon` : certains navigateurs (et l'onglet
    // épinglé) ne regardent que l'une des deux déclarations.
    for (const rel of ["icon", "shortcut icon"]) {
      const link = document.createElement("link");
      link.rel = rel;
      link.setAttribute("data-app-favicon", "");
      // `sizes="any"` + type explicite : l'icône configurée prime sur le
      // /favicon.ico implicite, quelle que soit la taille demandée par l'onglet.
      link.sizes.value = "any";
      if (mime) link.type = mime;
      link.href = favicon;
      head.appendChild(link);
    }
  }, [favicon]);

  useEffect(() => {
    if (!appName) return;
    document.title = appName;
    // Ré-applique juste après le rendu de Next (qui vient d'écraser le titre).
    const id = window.setTimeout(() => {
      document.title = appName;
    }, 0);
    return () => window.clearTimeout(id);
  }, [appName, pathname]);

  return null;
}
