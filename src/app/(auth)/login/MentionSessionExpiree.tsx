"use client";

import { useSearchParams } from "next/navigation";

/**
 * Dit pourquoi on est revenu à la page de connexion.
 *
 * Sans cette mention, une session fermée pour inactivité se lit comme une
 * panne : l'agent ressaisit ses identifiants en croyant s'être trompé.
 *
 * Composant à part, et non trois lignes dans la page : `useSearchParams`
 * impose une frontière `<Suspense>` au rendu statique. La poser autour de la
 * page entière lui ferait perdre son pré-rendu pour une phrase.
 */
export function MentionSessionExpiree() {
  if (useSearchParams().get("session") !== "expiree") return null;

  return (
    <div className="mb-4 rounded-[var(--radius-control)] border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      Votre session s&apos;est fermée après quinze minutes sans activité.
      Reconnectez-vous pour reprendre.
    </div>
  );
}
