"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useState } from "react";
// Effet de bord : bascule les messages de validation zod en français. Chargé
// ici (composant client) et non depuis le layout serveur, pour que la locale
// soit aussi appliquée dans le bundle navigateur, là où les formulaires
// s'exécutent.
import "@/lib/zod-locale";

export function Providers({ children }: { children: React.ReactNode }) {
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

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}
