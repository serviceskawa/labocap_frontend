import type { Metadata } from "next";
import { Source_Serif_4, IBM_Plex_Sans } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { Providers } from "@/components/providers";

// Source Serif 4 — fonte d'interface ET de documents, comme la charte le pose.
// Remplace Nunito, héritée du thème Hyper du projet Laravel.
//
// Fonte variable : `weight` est omis à dessein. Les quatre graisses employées
// dans l'application (400, 500, 600, 700) tiennent alors dans un seul fichier
// au lieu de quatre, et les valeurs intermédiaires restent disponibles sans
// nouveau téléchargement.
//
// Auto-hébergée au build par next/font : aucune requête vers
// fonts.googleapis.com au chargement, ce qui vaut aussi pour la CSP — un
// `font-src` distant devrait sinon être ouvert.
const serif = Source_Serif_4({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-source-serif",
});

// IBM Plex Sans — réservée au mot-symbole, comme la charte le prescrit
// (« Marque — IBM Plex Sans 600 »). Une seule graisse : elle ne compose rien
// d'autre que le nom du produit, et la charger en famille complète pour un mot
// coûterait plus que ce qu'elle rend.
//
// `display: "block"` et non `swap` : la marque est le seul endroit où un
// remplacement transitoire se verrait — le nom s'afficherait dans la fonte
// d'interface avant de sauter dans la sienne, en pleine tête de page.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["600"],
  display: "block",
  variable: "--font-plex",
});

export const metadata: Metadata = {
  title: "AnapathLab",
  description:
    "Gestion du laboratoire d'anatomopathologie — de la demande d'examen à la notification du résultat au patient.",
  // Renforce l'anti-traduction (Chrome honore ce meta) — voir translate="no".
  other: { google: "notranslate" },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Nonce de la requête, posé par le proxy (cf. src/proxy.ts). Next.js l'appose
  // seul sur ses propres balises ; on ne le relit ici que pour le transmettre à
  // Emotion, qui injecte les styles de react-select à l'exécution.
  //
  // Conséquence assumée : lire `headers()` fait sortir toutes les routes du
  // rendu statique. Sans impact réel ici — l'application est entièrement
  // authentifiée, donc jamais mise en cache par un CDN.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    // translate="no" (+ classe notranslate) : empêche la traduction automatique
    // du navigateur. Sur une appli React en français, la traduction réécrit les
    // nœuds texte et provoque « Cannot read properties of null (reading
    // 'removeChild') ». Standard W3C respecté par Chrome.
    <html
      lang="fr"
      translate="no"
      className={`h-full notranslate ${serif.variable} ${plexSans.variable}`}
    >
      {/* styled-jsx ne lit pas le nonce dans l'en-tête CSP : il le cherche
          exclusivement dans cette balise (`document.querySelector(
          'meta[property="csp-nonce"]')`) avant d'injecter ses `<style>` côté
          client. Sans elle, les styles d'impression de la feuille de route
          (test-orders/assignments/[id]/print) seraient bloqués par
          style-src-elem. React 19 la remonte automatiquement dans <head>. */}
      {nonce ? <meta property="csp-nonce" content={nonce} /> : null}
      {/* `bg-gray-50` vient de main : le fond passe par le token de la palette
          plutôt que par la valeur hexadécimale qu'il portait auparavant. */}
      <body className="h-full bg-gray-50 antialiased font-serif">
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}
