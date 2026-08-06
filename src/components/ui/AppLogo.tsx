"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useBranding, DEFAULT_APP_NAME } from "@/hooks/useBranding";
import { BrandMark } from "./BrandMark";

interface AppLogoProps {
  /**
   * Fond sur lequel le logo est posé. `dark` privilégie `logo_white` (sidebar
   * Hyper #313a46) ; `light` utilise le logo standard (écrans d'authentification).
   */
  surface?: "light" | "dark";
  /** Repli quand aucun logo n'est configuré ou que le fichier est illisible. */
  fallback?: "name" | "initial";
  /** Classes appliquées à l'image. */
  className?: string;
  /** Classes appliquées au repli. */
  fallbackClassName?: string;
}

/**
 * Logo du laboratoire, alimenté par les Paramètres (`setting_apps.logo`).
 *
 * Remplace les `<img src="/logo.png">` figés qui parsemaient les écrans
 * d'authentification : le fichier `public/logo.png` n'était pas modifiable depuis
 * l'application, si bien qu'un labo ayant téléversé son logo dans les Paramètres
 * le voyait dans la sidebar mais pas sur sa page de connexion.
 *
 * Le repli est purement déclaratif (état React) plutôt que piloté par manipulation
 * du DOM dans `onError` — la version précédente masquait l'image puis allait
 * chercher un `<span>` par `document.getElementById`, ce qui suppose des identifiants
 * uniques par page et casse dès que deux logos coexistent.
 */
export function AppLogo({
  surface = "light",
  fallback = "name",
  className,
  fallbackClassName,
}: AppLogoProps) {
  const { appName, logo, logoWhite } = useBranding();
  const [failed, setFailed] = useState(false);

  const src = surface === "dark" ? logoWhite : logo;

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={appName}
        // Les logos issus des Paramètres sont des data-URI : `next/image`
        // n'apporterait rien (rien à optimiser, pas de domaine distant) et
        // ajouterait un optimiseur au runtime.
        className={cn("object-contain", className)}
        onError={() => setFailed(true)}
      />
    );
  }

  // Aucun logo configuré : on montre la marque du produit. Un laboratoire qui
  // n'a pas encore téléversé la sienne voyait jusqu'ici son nom en gras générique
  // ou une initiale dans un carré — l'application paraissait inachevée dès le
  // premier écran. La marque du client, dès qu'elle existe, continue de primer
  // (branche `src` ci-dessus).
  //
  // `initial` correspond aux contextes contraints (menu replié) : la lettrine.
  if (fallback === "initial") {
    return <BrandMark surface={surface} compact className={fallbackClassName} />;
  }

  // Le nom paramétré prime sur celui du produit : un laboratoire qui a saisi sa
  // raison sociale doit la voir, c'est la sienne. La marque AnapathLab ne
  // s'affiche que tant qu'aucun nom propre n'a été renseigné.
  //
  // La comparaison lit la constante et non une chaîne recopiée : `useBranding`
  // retombe sur `DEFAULT_APP_NAME` quand rien n'est configuré, si bien qu'un
  // littéral divergent ici ferait passer le défaut pour un nom saisi — et le
  // laboratoire verrait le nom du produit annoncé comme le sien.
  if (appName && appName !== DEFAULT_APP_NAME) {
    return (
      <span
        className={cn(
          "text-xl font-bold tracking-[-0.02em]",
          surface === "dark" ? "text-white" : "text-gray-900",
          fallbackClassName,
        )}
      >
        {appName}
      </span>
    );
  }

  return (
    <BrandMark
      surface={surface}
      className={cn("text-xl", fallbackClassName)}
    />
  );
}
