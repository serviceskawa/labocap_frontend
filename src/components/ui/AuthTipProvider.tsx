"use client";

import { createContext, useContext } from "react";
import type { AuthTip } from "@/lib/auth-tips";

/**
 * Transporte le conseil du jour, choisi **côté serveur**, jusqu'au panneau.
 *
 * Le tirage dépend de la date. S'il était refait dans le navigateur, il
 * divergerait de celui du serveur pendant la seconde qui entoure minuit UTC, et
 * React signalerait une erreur d'hydratation. Le layout `(auth)` est un
 * composant serveur : il tire une fois, et la valeur descend par ce contexte.
 *
 * Un contexte plutôt qu'une prop traversant les cinq pages : celles-ci sont des
 * composants clients rendus par le layout, elles ne peuvent donc pas recevoir
 * de valeur serveur autrement qu'en la transportant à la main d'un écran à
 * l'autre — cinq occasions de l'oublier.
 */
export interface AuthTipOfDay {
  tip: AuthTip;
  /** Rang du conseil dans le jeu — ce que le fil d'indication montre. */
  index: number;
  /** Taille du jeu, donc nombre de pastilles. */
  total: number;
}

const AuthTipContext = createContext<AuthTipOfDay | null>(null);

export function AuthTipProvider({
  value,
  children,
}: {
  value: AuthTipOfDay;
  children: React.ReactNode;
}) {
  return (
    <AuthTipContext.Provider value={value}>{children}</AuthTipContext.Provider>
  );
}

/** Conseil du jour et son rang. `null` hors du layout d'authentification. */
export function useAuthTip(): AuthTipOfDay | null {
  return useContext(AuthTipContext);
}
