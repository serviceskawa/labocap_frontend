"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { useAuthStore } from "@/stores/auth.store";
import { authApi } from "@/lib/api/auth";

/**
 * Validation de session du tableau de bord.
 *
 * La *redirection* des utilisateurs non authentifiés est déjà assurée côté
 * serveur par `proxy.ts` (Proxy Next.js 16, ex-middleware), qui vérifie la
 * présence du cookie `access_token`. AuthGuard ne refait donc PAS cette
 * redirection (sous peine de boucle avec le proxy) : il VALIDE la session au
 * montage via `authApi.me()`, la seule source de vérité de l'identité.
 *
 * IMPORTANT — anti-identité obsolète : le store est *persisté* dans le
 * localStorage (`auth-storage`). Il peut donc contenir l'utilisateur d'une
 * session précédente (ex. un compte de test ensuite supprimé). Afficher son
 * nom ou son « Mon espace » serait faux — critique pour une appli de labo.
 * On NE rend donc PAS le tableau de bord tant que `/auth/me` n'a pas confirmé
 * l'identité réelle du cookie : aucun rendu ne lit le store avant validation.
 *
 *  - succès → (re)peuple le store avec l'utilisateur authentifié, puis rend ;
 *  - échec  → l'intercepteur a déjà tenté un refresh puis redirigé vers
 *             /login ; on purge le store pour ne laisser aucune identité obsolète.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [validated, setValidated] = useState(false);

  useEffect(() => {
    let active = true;
    authApi
      .me()
      .then((res) => {
        if (!active) return;
        setUser(res.data);
        setValidated(true);
      })
      .catch(() => {
        if (active) clearAuth();
      });
    return () => {
      active = false;
    };
    // Validation unique au montage du tableau de bord.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tant que la session n'est pas confirmée, on masque le tableau de bord pour
  // ne jamais peindre une identité persistée non validée.
  if (!validated) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return <>{children}</>;
}
