"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import apiClient from "@/lib/api/client";
import { authApi } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";

/** Une session s'éteint après ce délai sans activité. */
const INACTIVITE_MAX = 15 * 60 * 1000;

/** Préavis : la fenêtre d'avertissement avant la fermeture. */
const PREAVIS = 60 * 1000;

/**
 * Au-delà de ce délai depuis le dernier rafraîchissement, un geste en déclenche
 * un nouveau.
 *
 * Le jeton d'accès vit cinq minutes. Sans cet appel anticipé, la fenêtre
 * serveur ne glisserait qu'au moment où une requête échoue — et quelqu'un qui
 * lit un compte rendu sans rien demander au serveur verrait sa session fermée
 * jusqu'à cinq minutes trop tôt.
 */
const RAFRAICHIR_APRES = 4 * 60 * 1000;

/** Rythme de la surveillance. Assez fin pour un préavis juste, assez lâche pour ne rien coûter. */
const BATTEMENT = 5 * 1000;

/**
 * Clé partagée entre onglets.
 *
 * Sans elle, un second onglet ouvert et laissé de côté fermerait la session de
 * celui où l'on travaille : chacun ne verrait que sa propre inactivité.
 */
const CLE_ACTIVITE = "derniere-activite";

/** Les gestes qui comptent. `mousemove` est inclus : lire en déplaçant la souris est une activité. */
const GESTES = ["pointerdown", "keydown", "wheel", "touchstart", "mousemove"] as const;

/**
 * Ferme une session laissée sans surveillance.
 *
 * <p>Un poste du comptoir restait utilisable une semaine : le jeton de
 * rafraîchissement vivait sept jours et le navigateur le renouvelait seul. La
 * fenêtre serveur est désormais de quinze minutes ; ce composant fait deux
 * choses que le serveur ne peut pas faire.</p>
 *
 * <p>Il prolonge la session sur l'activité réelle, y compris quand celle-ci ne
 * produit aucune requête — relire un compte rendu, par exemple. Et il annonce
 * la fermeture au lieu de la laisser tomber : un anatomo-pathologiste peut
 * rester une minute sur une lame sans toucher au clavier, et se voir refuser
 * l'enregistrement de ce qu'il vient d'écrire serait la pire façon de
 * l'apprendre.</p>
 */
export function VeilleDeSession() {
  const router = useRouter();
  const clearAuth = useAuthStore((e) => e.clearAuth);
  const isAuthenticated = useAuthStore((e) => e.isAuthenticated);
  const clearBranch = useBranchStore((e) => e.clearBranch);

  const [resteAvantFermeture, setResteAvantFermeture] = useState<number | null>(null);

  const derniereActivite = useRef(Date.now());
  const dernierRafraichissement = useRef(Date.now());
  const fermetureEnCours = useRef(false);

  /** Note l'activité, ici et pour les autres onglets. */
  const marquer = useCallback((quand: number) => {
    derniereActivite.current = quand;
    try {
      localStorage.setItem(CLE_ACTIVITE, String(quand));
    } catch {
      // Navigation privée, stockage refusé : la surveillance reste locale à
      // l'onglet. C'est dégradé, jamais bloquant.
    }
  }, []);

  /** La dernière activité connue, tous onglets confondus. */
  const derniere = useCallback(() => {
    let partagee = 0;
    try {
      partagee = Number(localStorage.getItem(CLE_ACTIVITE)) || 0;
    } catch {
      partagee = 0;
    }
    return Math.max(derniereActivite.current, partagee);
  }, []);

  const fermer = useCallback(async () => {
    if (fermetureEnCours.current) return;
    fermetureEnCours.current = true;
    try {
      await authApi.logout();
    } catch {
      // Le jeton est peut-être déjà expiré côté serveur : la session est close
      // de toute façon, et insister n'apporterait rien.
    } finally {
      try {
        localStorage.removeItem(CLE_ACTIVITE);
      } catch {
        // sans importance
      }
      clearAuth();
      clearBranch();
      router.push("/login?session=expiree");
    }
  }, [clearAuth, clearBranch, router]);

  const rester = useCallback(async () => {
    marquer(Date.now());
    setResteAvantFermeture(null);
    try {
      await apiClient.post("/auth/refresh");
      dernierRafraichissement.current = Date.now();
    } catch {
      // La fenêtre serveur était déjà close : le battement suivant conclura.
    }
  }, [marquer]);

  useEffect(() => {
    if (!isAuthenticated) return;

    marquer(Date.now());

    let dernierEnregistrement = 0;
    const surGeste = () => {
      const maintenant = Date.now();
      // Un `mousemove` tire des dizaines d'événements par seconde ; on n'en
      // retient qu'un par seconde.
      if (maintenant - dernierEnregistrement < 1000) return;
      dernierEnregistrement = maintenant;
      marquer(maintenant);
      setResteAvantFermeture(null);

      if (maintenant - dernierRafraichissement.current > RAFRAICHIR_APRES) {
        dernierRafraichissement.current = maintenant;
        apiClient.post("/auth/refresh").catch(() => {
          // Refusé : la session est close côté serveur, le battement le verra.
        });
      }
    };

    for (const geste of GESTES) {
      window.addEventListener(geste, surGeste, { passive: true });
    }

    const battement = window.setInterval(() => {
      const inactif = Date.now() - derniere();
      if (inactif >= INACTIVITE_MAX) {
        void fermer();
      } else if (inactif >= INACTIVITE_MAX - PREAVIS) {
        setResteAvantFermeture(INACTIVITE_MAX - inactif);
      } else {
        setResteAvantFermeture(null);
      }
    }, BATTEMENT);

    return () => {
      for (const geste of GESTES) window.removeEventListener(geste, surGeste);
      window.clearInterval(battement);
    };
  }, [isAuthenticated, marquer, derniere, fermer]);

  if (resteAvantFermeture === null) return null;

  const secondes = Math.max(0, Math.ceil(resteAvantFermeture / 1000));

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label="Session sur le point d'expirer"
      className="fixed inset-x-0 bottom-6 z-50 mx-auto w-[min(92vw,28rem)] rounded-[var(--radius-surface)] border-2 border-amber-500 bg-amber-50 p-4 shadow-[var(--elevation-base)]"
    >
      <p className="text-sm font-semibold text-amber-900">
        Votre session se ferme dans {secondes}&nbsp;s
      </p>
      <p className="mt-1 text-xs text-amber-800">
        Elle s&apos;interrompt après quinze minutes sans activité. Enregistrez ce
        que vous êtes en train d&apos;écrire, ou prolongez-la.
      </p>
      <button
        type="button"
        onClick={rester}
        className="mt-3 w-full rounded-[var(--radius-control)] bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        Rester connecté
      </button>
    </div>
  );
}
