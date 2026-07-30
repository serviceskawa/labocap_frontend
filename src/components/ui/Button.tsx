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

// Thème Hyper : couleurs pleines + ombre portée teintée au survol (comme
// `.btn-primary:hover { box-shadow: 0 2px 6px 0 rgba(114,124,245,.5) }`).
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-600 hover:shadow-[0_2px_6px_0_rgba(114,124,245,0.5)]",
  danger:
    "bg-red-600 text-white hover:bg-red-600 hover:shadow-[0_2px_6px_0_rgba(250,92,124,0.5)]",
  secondary:
    "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
};

// Bootstrap/Hyper exact : `.btn { padding:.45rem .9rem; font-size:.9rem;
// border-radius:.15rem }` et `.btn-sm { padding:.28rem .8rem; font-size:.875rem }`.
const sizeClasses: Record<ButtonSize, string> = {
  sm: "gap-1 rounded-[.15rem] px-[.8rem] py-[.28rem] text-[.875rem]",
  md: "gap-2 rounded-[.15rem] px-[.9rem] py-[.45rem] text-[.9rem]",
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
        // `.btn` : font-weight 400, line-height 1.5 (Bootstrap/Hyper).
        "inline-flex items-center justify-center font-normal leading-normal transition-[background-color,box-shadow] disabled:cursor-not-allowed disabled:opacity-60",
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
