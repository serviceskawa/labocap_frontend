"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { NonceProvider } from "react-select";
import { useState } from "react";

export function Providers({
  children,
  nonce,
}: {
  children: React.ReactNode;
  /**
   * Nonce CSP de la requête, transmis par le layout racine.
   *
   * react-select style ses composants via Emotion, qui insère des balises
   * `<style>` à l'exécution : sans nonce, `style-src-elem` les bloque et les
   * 23 écrans à sélecteurs perdent toute mise en forme. `NonceProvider`
   * construit un cache Emotion qui appose le nonce sur chaque balise injectée.
   */
  nonce?: string;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const tree = (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );

  // Hors nonce (aucun en-tête posé), on laisse Emotion sur son cache par défaut
  // plutôt que d'en créer un avec un nonce vide : le rendu reste identique.
  return nonce ? (
    <NonceProvider nonce={nonce} cacheKey="select">
      {tree}
    </NonceProvider>
  ) : (
    tree
  );
}
