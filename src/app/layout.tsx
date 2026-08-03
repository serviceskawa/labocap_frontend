import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

// Police Nunito — identique au thème Hyper du projet Laravel. Auto-hébergée au
// build par next/font : pas de requête vers fonts.googleapis.com au chargement.
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "Labo AnaPath",
  description: "Laboratoire d'Anatomie Pathologique",
  // Renforce l'anti-traduction (Chrome honore ce meta) — voir translate="no".
  other: { google: "notranslate" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // translate="no" (+ classe notranslate) : empêche la traduction automatique
    // du navigateur. Sur une appli React en français, la traduction réécrit les
    // nœuds texte et provoque « Cannot read properties of null (reading
    // 'removeChild') ». Standard W3C respecté par Chrome.
    <html
      lang="fr"
      translate="no"
      className={`h-full notranslate ${nunito.variable}`}
    >
      <body className="h-full bg-gray-50 antialiased font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
