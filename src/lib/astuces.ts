"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Préfixe des clés, pour les distinguer du reste du stockage local. */
const PREFIXE = "astuce-vue";

/** Émis après écriture : `storage` ne notifie que les AUTRES onglets. */
const EVENEMENT = "astuce-vue-changee";

function lire(cle: string): boolean {
  try {
    return window.localStorage.getItem(cle) === "1";
  } catch {
    // Stockage indisponible (navigation privée stricte, quota) : l'astuce
    // s'affiche. Mieux vaut la revoir que d'en être privé.
    return false;
  }
}

function souscrire(rappel: () => void) {
  window.addEventListener("storage", rappel);
  window.addEventListener(EVENEMENT, rappel);
  return () => {
    window.removeEventListener("storage", rappel);
    window.removeEventListener(EVENEMENT, rappel);
  };
}

/**
 * « Cette astuce a-t-elle déjà été vue ? », et de quoi la marquer.
 *
 * ## Pourquoi la clé porte l'utilisateur
 *
 * Sur un poste partagé — la règle en laboratoire — mémoriser pour le navigateur
 * priverait de la découverte le collègue qui n'a rien vu.
 *
 * ## Pourquoi le stockage local et non le serveur
 *
 * Perdre cette information est sans conséquence : au pire l'astuce reparaît une
 * fois. Cela ne justifie ni colonne en base, ni route, ni migration.
 *
 * ## Pourquoi `useSyncExternalStore`
 *
 * Le stockage local est extérieur à React et illisible au rendu serveur. Le lire
 * dans un effet pour appeler `setState` provoque un rendu en cascade — ce que la
 * règle `react-hooks/set-state-in-effect` refuse à juste titre. Ce crochet donne
 * une valeur au serveur, une autre au navigateur, et suit les écritures.
 */
export function useAstuceVue(cle: string, identifiantUtilisateur?: string) {
  const cleComplete = `${PREFIXE}:${cle}:${identifiantUtilisateur ?? "anonyme"}`;

  const vue = useSyncExternalStore(
    souscrire,
    useCallback(() => lire(cleComplete), [cleComplete]),
    // Au rendu serveur, l'astuce est tenue pour vue : rien n'est émis, et le
    // navigateur l'affichera après hydratation s'il y a lieu. L'inverse ferait
    // apparaître puis disparaître le bandeau à chaque chargement.
    () => true,
  );

  const marquerVue = useCallback(() => {
    try {
      window.localStorage.setItem(cleComplete, "1");
    } catch {
      // Sans mémoire, l'astuce reparaîtra. Sans gravité.
    }
    window.dispatchEvent(new Event(EVENEMENT));
  }, [cleComplete]);

  return { vue, marquerVue };
}
