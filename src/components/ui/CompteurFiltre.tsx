"use client";

import { cn } from "@/lib/utils";

/**
 * Pastille de comptage qui filtre la liste au clic, et la défiltre au second.
 *
 * Ces pastilles n'étaient qu'un affichage : on lisait « 106 cas urgents » sans
 * pouvoir les atteindre, et il fallait retrouver le même critère dans le menu
 * des filtres. Le chiffre et le filtre disant la même chose, autant que l'un
 * mène à l'autre.
 *
 * L'état actif se voit au fond plein — un contour seul se confondrait avec le
 * repos sur une pastille déjà cerclée.
 */
export function CompteurFiltre({
  libelle,
  valeur,
  actif,
  onClick,
  couleur,
}: {
  libelle: string;
  valeur?: number;
  actif: boolean;
  onClick: () => void;
  couleur: "green" | "yellow" | "red";
}) {
  const repos = {
    green: "bg-green-100 text-green-800 ring-green-300 hover:bg-green-200",
    yellow: "bg-yellow-100 text-yellow-800 ring-yellow-300 hover:bg-yellow-200",
    red: "bg-red-100 text-red-800 ring-red-300 hover:bg-red-200",
  }[couleur];
  const selectionne = {
    green: "bg-green-600 text-white ring-green-600",
    yellow: "bg-yellow-600 text-white ring-yellow-600",
    red: "bg-red-600 text-white ring-red-600",
  }[couleur];

  return (
    <button
      type="button"
      onClick={onClick}
      // `aria-pressed` : un bouton qui bascule un filtre n'est pas un lien.
      // Sans lui, un lecteur d'écran annonce l'action mais jamais son état.
      aria-pressed={actif}
      className={cn(
        "rounded-full px-4 py-1.5 text-[.9rem] font-medium ring-1",
        "transition-colors duration-[var(--duration-fast)] ease-emphasized",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
        actif ? selectionne : repos,
      )}
    >
      {libelle} : {valeur ?? "…"}
    </button>
  );
}
