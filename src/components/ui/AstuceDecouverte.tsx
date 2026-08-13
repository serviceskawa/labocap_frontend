"use client";

import { useEffect, useState } from "react";
import { Lightbulb, X } from "lucide-react";

import { useCurrentUser } from "@/hooks/useCurrentUser";

/**
 * Préfixe des clés de mémorisation, pour les distinguer du reste du stockage.
 */
const PREFIXE = "astuce-vue";

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
  // Masquée au premier rendu : le stockage n'est lisible que côté navigateur, et
  // afficher puis retirer produirait un clignotement à chaque chargement.
  const [visible, setVisible] = useState(false);

  const cleComplete = `${PREFIXE}:${cle}:${user?.id ?? "anonyme"}`;

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(cleComplete) !== "1");
    } catch {
      // Stockage indisponible (navigation privée stricte, quota) : on montre
      // l'astuce. Mieux vaut la revoir que de priver l'utilisateur de la
      // découverte.
      setVisible(true);
    }
  }, [cleComplete]);

  const masquer = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(cleComplete, "1");
    } catch {
      // Sans mémoire, l'astuce reparaîtra à la prochaine visite. Sans gravité.
    }
  };

  if (!visible) return null;

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
          onClick={masquer}
          className="mt-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
        >
          J&apos;ai compris
        </button>
      </div>
      <button
        type="button"
        onClick={masquer}
        aria-label="Masquer cette astuce"
        className="rounded-md p-1 text-blue-400 transition-colors hover:bg-blue-100 hover:text-blue-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
