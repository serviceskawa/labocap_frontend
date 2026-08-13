"use client";

import { useCallback, useEffect, useState } from "react";
import { MousePointerClick, X } from "lucide-react";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAstuceVue } from "@/lib/astuces";

/** Marge autour de la zone éclairée, pour qu'elle respire. */
const HALO = 8;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  /** Sélecteur CSS de l'élément à éclairer. */
  cible: string;
  /** Identifie l'astuce ; changer sa valeur la remontre à tout le monde. */
  cle: string;
  titre: string;
  texte: string;
  /** Libellé du bouton qui exécute la démonstration. */
  actionLabel: string;
  /** Exécute la démonstration — idéalement, déclenche vraiment la fonction. */
  onAction: () => void;
  /** Le guide attend que l'écran soit prêt (données chargées, cible présente). */
  actif: boolean;
}

/**
 * Guide en projecteur : éteint la page sauf l'élément à découvrir.
 *
 * ## Pourquoi pas un bandeau
 *
 * Un bandeau d'information au-dessus d'un tableau se lit une fois sur dix. La
 * cécité aux bannières est un fait mesuré : l'œil apprend à sauter les zones
 * colorées en marge du contenu. Une fonction qui ne se devine pas — un panneau
 * qui s'ouvre au clic sur une ligne — n'a alors aucune chance d'être trouvée.
 *
 * ## Pourquoi montrer plutôt que dire
 *
 * Le bouton d'action n'explique pas la fonction : il l'exécute. L'utilisateur
 * voit le panneau s'ouvrir sur une vraie ligne, avec un vrai contenu. On retient
 * ce qu'on a vu se produire, rarement ce qu'on a lu.
 *
 * ## Ce qui le rend impossible à manquer, sans le rendre odieux
 *
 * Il assombrit la page — donc il interrompt — mais il ne paraît qu'une fois, il
 * se ferme d'un clic n'importe où, par Échap, et il ne s'affiche jamais sur un
 * écran vide où il n'aurait rien à désigner.
 */
export function GuideProjecteur({
  cible,
  cle,
  titre,
  texte,
  actionLabel,
  onAction,
  actif,
}: Props) {
  const { user } = useCurrentUser();
  const { vue, marquerVue } = useAstuceVue(cle, user?.id);
  const [zone, setZone] = useState<Rect | null>(null);

  const doitMesurer = actif && !vue;

  // Position de la cible, suivie tant que le guide est affiché : la page peut
  // défiler, la fenêtre changer de taille, le tableau finir de se peindre.
  useEffect(() => {
    // Pas de remise à zéro ici : ce serait un `setState` synchrone dans le corps
    // d'un effet, et le rendu est déjà gardé par `doitMesurer`. La mesure sera
    // refaite si le guide redevient actif.
    if (!doitMesurer) return;

    let annule = false;
    const mesurer = () => {
      if (annule) return;
      const el = document.querySelector(cible);
      if (!el) {
        setZone(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setZone({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    // Première mesure au tour suivant : la cible peut n'être peinte qu'après ce
    // rendu, et un rectangle nul placerait le projecteur en haut à gauche.
    const minuteur = window.setTimeout(mesurer, 60);
    window.addEventListener("resize", mesurer);
    window.addEventListener("scroll", mesurer, true);
    return () => {
      annule = true;
      window.clearTimeout(minuteur);
      window.removeEventListener("resize", mesurer);
      window.removeEventListener("scroll", mesurer, true);
    };
  }, [doitMesurer, cible]);

  const fermer = useCallback(() => marquerVue(), [marquerVue]);

  useEffect(() => {
    if (!doitMesurer || !zone) return;
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer();
    };
    document.addEventListener("keydown", auClavier);
    return () => document.removeEventListener("keydown", auClavier);
  }, [doitMesurer, zone, fermer]);

  // Rien à éclairer — tableau vide, données en cours de chargement — donc rien
  // à montrer. L'astuce n'est PAS marquée vue : elle attendra un écran qui a
  // quelque chose à désigner.
  if (!doitMesurer || !zone) return null;

  const enBas = zone.top < 220;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={titre}>
      {/*
        Le voile est porté par l'ombre de la zone éclairée : une ombre de
        9999 px couvre tout l'écran sauf ce rectangle. Cela évite de découper un
        masque, et la zone reste cliquable puisque rien ne la recouvre.
      */}
      <div
        onClick={fermer}
        className="absolute rounded-lg ring-2 ring-blue-400 transition-all duration-[var(--duration-base)]"
        style={{
          top: zone.top - HALO,
          left: zone.left - HALO,
          width: zone.width + HALO * 2,
          height: zone.height + HALO * 2,
          boxShadow: "0 0 0 9999px rgba(17, 24, 39, 0.55)",
        }}
      />

      {/* Anneau qui bat, pour que l'œil aille là et nulle part ailleurs. */}
      <div
        aria-hidden
        className="pointer-events-none absolute animate-ping rounded-lg ring-2 ring-blue-300"
        style={{
          top: zone.top - HALO,
          left: zone.left - HALO,
          width: zone.width + HALO * 2,
          height: zone.height + HALO * 2,
        }}
      />

      <div
        className="absolute w-[min(24rem,calc(100vw-2rem))] rounded-xl bg-white p-4 shadow-2xl"
        style={{
          top: enBas ? zone.top + zone.height + HALO + 14 : zone.top - HALO - 14,
          transform: enBas ? undefined : "translateY(-100%)",
          left: Math.max(16, Math.min(zone.left, window.innerWidth - 400)),
        }}
      >
        <div className="flex items-start gap-3">
          <MousePointerClick className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">{titre}</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">{texte}</p>
          </div>
          <button
            type="button"
            onClick={fermer}
            aria-label="Fermer le guide"
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={fermer}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
          >
            Plus tard
          </button>
          <button
            type="button"
            onClick={() => {
              // Marquer AVANT d'agir : la démonstration ouvre un panneau
              // par-dessus, et le guide ne doit pas reparaître derrière lui.
              marquerVue();
              onAction();
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
