import { AuthTipProvider } from "@/components/ui/AuthTipProvider";
import { tipOfTheDay, tipIndexForDay, AUTH_TIPS } from "@/lib/auth-tips";

/**
 * Layout des écrans d'authentification.
 *
 * Composant **serveur**, et c'est tout son intérêt ici. Le conseil affiché dans
 * le panneau dépend du jour ; le tirer dans le navigateur le ferait diverger du
 * rendu serveur pendant la seconde qui entoure minuit UTC, ce que React
 * signale comme une erreur d'hydratation. On tire donc une fois, ici, et la
 * valeur descend par contexte.
 *
 * Le rendu est déjà dynamique pour toutes les routes — le layout racine lit
 * `headers()` pour le nonce CSP. Cette date est donc évaluée à chaque requête,
 * jamais figée au build.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const maintenant = new Date();

  return (
    <AuthTipProvider
      value={{
        tip: tipOfTheDay(maintenant),
        index: tipIndexForDay(maintenant),
        total: AUTH_TIPS.length,
      }}
    >
      {children}
    </AuthTipProvider>
  );
}
