"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Lightbulb, X } from "lucide-react";

import { useCurrentUser } from "@/hooks/useCurrentUser";

/** Préfixe des clés de mémorisation, pour les distinguer du reste du stockage. */
const PREFIXE = "astuce-vue";

/** Émis après écriture : `storage` ne notifie que les AUTRES onglets. */
const EVENEMENT = "astuce-vue-changee";

function lireVue(cle: string): boolean {
  try {
    return window.localStorage.getItem(cle) === "1";
  } catch {
    // Stockage indisponible (navigation privée stricte, quota) : l'astuce
    // s'affiche. Mieux vaut la revoir que d'en être privé.
    return false;
  }
}

function marquerVue(cle: string) {
  try {
    window.localStorage.setItem(cle, "1");
  } catch {
    // Sans mémoire, l'astuce reparaîtra à la prochaine visite. Sans gravité.
  }
  window.dispatchEvent(new Event(EVENEMENT));
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
 * Astuce de découverte, montrée une fois puis oubliée.
 *
 * ## Pourquoi une seule fois
 *
 * Une fonction qui ne se voit pas — un panneau qui s'ouvre au clic sur une
 * ligne — n'existe pas pour qui ne l'a jamais essayée. Mais un bandeau
 * permanent devient invisible en trois jours et vole de la place à ce qu'on est
 * venu lire. L'astuce se montre donc à la première visite, puis disparaît dès
 * qu'elle a été lue ou refusée.
 *
 * ## Pourquoi la clé porte l'utilisateur
 *
 * Sur un poste partagé — ce qui est la règle dans un laboratoire — mémoriser
 * l'astuce pour le navigateur la ferait disparaître pour le collègue qui n'a
 * rien vu. La clé porte donc l'identifiant de l'utilisateur.
 *
 * ## Pourquoi le stockage local et non le serveur
 *
 * Perdre cette information est sans conséquence : au pire l'astuce reparaît une
 * fois. Cela ne justifie ni colonne en base, ni route, ni migration.
 *
 * ## Pourquoi `useSyncExternalStore` et non un effet
 *
 * Le stockage local est une source extérieure à React, illisible pendant le
 * rendu serveur. Le lire dans un effet pour appeler `setState` provoque un
 * rendu en cascade — que la règle `react-hooks/set-state-in-effect` signale à
 * juste titre. Ce crochet est fait pour cela : il fournit une valeur au serveur
 * (astuce considérée comme vue, donc rien n'est rendu), une autre au
 * navigateur, et réagit aux écritures — y compris celles d'un autre onglet.
 */
export function AstuceDecouverte({
  cle,
  titre,
  children,
}: {
  /** Identifie l'astuce ; changer sa valeur la remontre à tout le monde. */
  cle: string;
  titre: string;
  children: React.ReactNode;
}) {
  const { user } = useCurrentUser();
  const cleComplete = `${PREFIXE}:${cle}:${user?.id ?? "anonyme"}`;

  const vue = useSyncExternalStore(
    souscrire,
    useCallback(() => lireVue(cleComplete), [cleComplete]),
    // Au rendu serveur, l'astuce est tenue pour vue : rien n'est émis, et le
    // navigateur l'affichera après hydratation s'il y a lieu. L'inverse ferait
    // apparaître puis disparaître le bandeau à chaque chargement.
    () => true,
  );

  if (vue) return null;

  return (
    <div
      role="note"
      className="mb-4 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3"
    >
      <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-blue-900">{titre}</p>
        <div className="mt-0.5 text-sm text-blue-800">{children}</div>
        <button
          type="button"
          onClick={() => marquerVue(cleComplete)}
          className="mt-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
        >
          J&apos;ai compris
        </button>
      </div>
      <button
        type="button"
        onClick={() => marquerVue(cleComplete)}
        aria-label="Masquer cette astuce"
        className="rounded-md p-1 text-blue-400 transition-colors hover:bg-blue-100 hover:text-blue-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
