"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Ligne secondaire sous le titre — code, patient, date… */
  subtitle?: string;
  /** Contenu bas, séparé : boutons d'action. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Panneau glissant depuis la droite, pour consulter sans quitter la liste.
 *
 * <p>Répond à un besoin précis : juger d'un coup d'œil si la ligne qu'on vient
 * de cliquer est bien celle qu'on cherche. Ouvrir la page complète pour s'en
 * apercevoir, puis revenir, coûte deux navigations et fait perdre sa place dans
 * la liste.</p>
 *
 * <p>Largeur : le quart de la fenêtre au-delà de 1024 px, sans descendre sous
 * 26 rem — en deçà, un extrait de compte rendu devient illisible. Entre 640 et
 * 1024 px, cette même largeur fixe : un quart de 800 px ne montrerait que
 * quelques mots par ligne. En dessous, toute la largeur.</p>
 */
export function SidePanel({
  open,
  onClose,
  title,
  subtitle,
  footer,
  children,
}: SidePanelProps) {
  const panneau = useRef<HTMLElement>(null);

  // `onClose` est presque toujours une lambda écrite dans le JSX du parent, donc
  // une référence neuve à chaque rendu. En dépendance d'effet, elle rejouait tout
  // le montage à chaque re-rendu de la page — or celle-ci se re-rend pendant que
  // le panneau est ouvert, ne serait-ce qu'à l'arrivée du détail. Le focus était
  // alors ramené de force sur le panneau, et `origine` finissait par désigner le
  // panneau lui-même : la fermeture ne rendait plus la main à la ligne cliquée.
  const fermer = useRef(onClose);
  useEffect(() => {
    fermer.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    // Le tableau de bord ne fait pas défiler `body` : il est en `h-screen
    // overflow-hidden`, et c'est `main` qui porte le défilement. Figer `body`,
    // comme on le fait d'ordinaire, ne bloquait donc rien — la liste continuait
    // de défiler derrière le panneau ouvert. On fige le conteneur réel, et
    // `body` en second pour les écrans qui, eux, défilent normalement.
    const defilants = [document.querySelector("main"), document.body].filter(
      (el): el is HTMLElement => el !== null,
    );
    const valeursInitiales = defilants.map((el) => el.style.overflow);
    defilants.forEach((el) => (el.style.overflow = "hidden"));

    // Le focus entre dans le panneau et y reste : `aria-modal` promet qu'il n'y
    // a rien d'autre à atteindre, or sans piège la tabulation repartait dans la
    // liste, sous le voile. À la fermeture on rend le focus à la ligne cliquée,
    // pour ne pas renvoyer l'utilisateur en haut du document.
    const origine = document.activeElement as HTMLElement | null;
    panneau.current?.focus();

    const focusables = () =>
      Array.from(
        panneau.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        fermer.current();
        return;
      }
      if (e.key !== "Tab") return;
      const cibles = focusables();
      if (cibles.length === 0) return;
      const premier = cibles[0];
      const dernier = cibles[cibles.length - 1];
      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault();
        premier.focus();
      }
    };

    document.addEventListener("keydown", auClavier);
    return () => {
      document.removeEventListener("keydown", auClavier);
      defilants.forEach((el, i) => (el.style.overflow = valeursInitiales[i]));
      origine?.focus?.();
    };
  }, [open]);

  // Fermé, rien n'est posé dans le document.
  //
  // La version précédente laissait le tiroir en place et le repoussait hors
  // champ par `translate-x-full`. C'était fragile : sous 1024 px il occupe toute
  // la largeur, si bien que la moindre défaillance de la transformation le
  // laissait couvrir l'application entière — écran blanc, titre de repli, corps
  // vide, plus rien de cliquable. Un panneau fermé ne doit pas dépendre d'un
  // déplacement pour être invisible.
  //
  // Le démontage règle du même coup l'accessibilité que `inert` rattrapait :
  // ni cible de tabulation, ni boîte de dialogue annoncée en permanence.
  if (!open) return null;

  return (
    <>
      {/* Voile : ferme au clic et détache l'œil de la liste, sans la masquer. */}
      <div onClick={onClose} className="fixed inset-0 z-40 bg-gray-900/20" />

      {/*
        `fixed` est voulu : c'est un tiroir, ancré au bord droit de la fenêtre.
        Il ne défile pas avec le tableau — on garde la liste sous les yeux
        pendant qu'on lit l'aperçu, et le panneau reste à portée de pouce.
      */}
      <aside
        ref={panneau}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // Reçoit le focus à l'ouverture sans devenir une étape de tabulation.
        tabIndex={-1}
        className={cn(
          "focus:outline-none",
          "fixed inset-y-0 right-0 z-50 flex flex-col bg-white shadow-2xl",
          // Largeur en `vw` et non en pourcentage : pour un élément `fixed`, un
          // pourcentage se résout contre le bloc conteneur — qui cesse d'être la
          // fenêtre dès qu'un ancêtre porte un `transform`, un `filter` ou un
          // `will-change`. Le `vw` vise toujours la fenêtre.
          //
          // Le quart n'arrive qu'en grand écran. En dessous de 640 px il occupe
          // toute la largeur ; entre les deux, une largeur fixe confortable — un
          // quart de 800 px ne montrerait que quelques mots par ligne.
          "w-full sm:w-[26rem] lg:w-[25vw] lg:min-w-[26rem]",
          "animate-tiroir",
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-gray-900">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 truncate text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le panneau"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer className="border-t border-gray-200 px-5 py-4">{footer}</footer>
        )}
      </aside>
    </>
  );
}
