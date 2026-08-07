"use client";

import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "danger" | "secondary";
type ButtonSize = "sm" | "md";

interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icône affichée avant le libellé (dimensionner selon la taille : h-4 w-4 pour md, h-3.5 w-3.5 pour sm). */
  icon?: ReactNode;
  /** Affiche un spinner et désactive le bouton pendant une action asynchrone. */
  loading?: boolean;
  /**
   * Handler de clic. S'il renvoie une promesse (handler `async`), le bouton gère
   * seul son état d'attente : spinner affiché et clics suivants ignorés jusqu'à
   * résolution — inutile de câbler un `loading` à la main.
   */
  onClick?: (event: MouseEvent<HTMLButtonElement>) => unknown;
}

// Le survol assombrit d'un cran et pose une ombre teintée courte. Le thème
// d'origine gardait le même fond et diffusait une ombre à 50 % d'opacité, qui
// bavait sur les surfaces claires sans donner de retour franc au pointeur.
// `secondary` gagne une vraie hiérarchie : bordure au repos, fond au survol.
// Les ombres de survol sont teintées du fond du bouton. Elles étaient écrites
// en hexadécimal converti en rgba, et sont restées sur l'ancienne palette :
// l'azur #2e4bd8 et le rose #dc2848 d'« Ardoise & Azur », alors que les fonds
// eux-mêmes suivaient déjà les jetons. Un bouton cyan diffusait donc une ombre
// bleu-violet. `color-mix` les rattache à la couleur du fond, ce qui règle le
// problème pour de bon plutôt que jusqu'au prochain changement de palette.
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-blue-600 text-white shadow-sm hover:bg-blue-700 " +
    "hover:shadow-[0_4px_10px_-2px_color-mix(in_srgb,var(--color-blue-600)_35%,transparent)] " +
    "focus-visible:ring-blue-500/40",
  danger:
    "bg-red-600 text-white shadow-sm hover:bg-red-700 " +
    "hover:shadow-[0_4px_10px_-2px_color-mix(in_srgb,var(--color-red-600)_35%,transparent)] " +
    "focus-visible:ring-red-500/40",
  secondary:
    "border border-gray-300 bg-white text-gray-700 shadow-sm " +
    "hover:border-gray-400 hover:bg-gray-50 focus-visible:ring-gray-400/40",
};

// Rayon 8px et graisse 500 : à .9rem, un libellé en poids normal sur fond
// coloré paraît délavé. Les angles quasi vifs de Bootstrap (.15rem ≈ 2px)
// dataient l'ensemble plus que n'importe quel autre détail.
const sizeClasses: Record<ButtonSize, string> = {
  sm: "gap-1.5 rounded-[var(--radius-control)] px-3 py-1.5 text-[.8125rem]",
  md: "gap-2 rounded-[var(--radius-control)] px-[.9rem] py-2 text-[.9rem]",
};

const spinnerSize: Record<ButtonSize, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
};

/**
 * Suit l'exécution d'un handler de clic : verrou anti-réentrance (double-clic,
 * touche Entrée maintenue) et état d'attente pour le spinner lorsque le handler
 * est asynchrone.
 *
 * Partagé par {@link Button} et `IconButton` : tout bouton de l'application bâti
 * sur ces primitives est ainsi protégé contre une action déclenchée deux fois.
 */
export function useClickBusy(
  onClick: ((event: MouseEvent<HTMLButtonElement>) => unknown) | undefined,
  externallyBusy: boolean,
) {
  const [autoBusy, setAutoBusy] = useState(false);
  const runningRef = useRef(false);
  const mountedRef = useRef(true);

  // `mountedRef` doit être RÉARMÉ au montage. React remonte le composant après
  // avoir joué le nettoyage (StrictMode, et tout remontage de modale) : sans
  // cette ligne, `mountedRef` restait à false pour toujours, `setAutoBusy(false)`
  // n'était jamais appliqué et le bouton gardait son spinner indéfiniment —
  // typiquement après un envoi refusé par la validation, où l'action se termine
  // sans que la page change.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const busy = externallyBusy || autoBusy;

  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      // Un clic pendant l'action en cours ne relance rien — y compris sur un
      // bouton de formulaire, d'où le preventDefault.
      if (busy || runningRef.current) {
        event.preventDefault();
        return;
      }
      const result = onClick?.(event);
      if (
        typeof (result as Promise<unknown> | undefined)?.then === "function"
      ) {
        runningRef.current = true;
        setAutoBusy(true);
        void Promise.resolve(result).finally(() => {
          runningRef.current = false;
          if (mountedRef.current) setAutoBusy(false);
        });
      }
    },
    [busy, onClick],
  );

  return { busy, handleClick };
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  className,
  children,
  type = "button",
  disabled,
  onClick,
  ...props
}: ButtonProps) {
  const { busy, handleClick } = useClickBusy(onClick, loading);

  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy}
      onClick={handleClick}
      className={cn(
        "inline-flex items-center justify-center font-medium leading-normal",
        "transition-[background-color,border-color,box-shadow] duration-[var(--duration-fast)] ease-emphasized",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {busy ? <Loader2 className={cn(spinnerSize[size], "animate-spin")} /> : icon}
      {children}
    </button>
  );
}
