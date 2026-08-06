"use client";

import { Clock, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/** En deçà, le code est sur le point d'expirer : le décompte passe en alerte. */
const URGENT_THRESHOLD_MS = 60_000;

function format(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Décompte de validité du code de vérification.
 *
 * Le temps restant n'était qu'une phrase parmi d'autres — « Expire dans 4:32 »
 * en gris, sous deux lignes d'explication. Or c'est la seule information de
 * l'écran qui évolue, et la seule dont dépend l'action de l'utilisateur :
 * elle mérite d'être lue d'un coup d'œil, pas cherchée.
 *
 * D'où une barre de progression doublée du temps chiffré. La barre donne
 * l'ordre de grandeur sans être lue, le chiffre donne la précision quand on la
 * regarde. Sous une minute, l'ensemble passe en rouge — le seul moment où
 * l'urgence est réelle, donc le seul où l'alerte est méritée.
 *
 * @param remainingMs temps restant, déjà décompté par l'écran appelant. Ce
 *   composant n'a pas de minuterie propre : la page pilote déjà la sienne pour
 *   rediriger à l'expiration, en ajouter une seconde ferait diverger les deux.
 * @param totalMs durée totale de validité, pour la proportion de la barre.
 */
export function OtpCountdown({
  remainingMs,
  totalMs,
  className,
}: {
  remainingMs: number;
  totalMs: number;
  className?: string;
}) {
  const urgent = remainingMs <= URGENT_THRESHOLD_MS;
  const ratio = Math.max(0, Math.min(1, remainingMs / Math.max(totalMs, 1)));

  return (
    <div
      className={cn(
        "rounded-[var(--radius-control)] px-3 py-2.5 ring-1 ring-inset",
        urgent
          ? "bg-red-50 ring-red-200"
          : "bg-gray-50 ring-gray-200",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-[.8125rem] font-medium",
            urgent ? "text-red-700" : "text-gray-600",
          )}
        >
          {urgent ? (
            <TriangleAlert className="h-3.5 w-3.5" />
          ) : (
            <Clock className="h-3.5 w-3.5" />
          )}
          {urgent ? "Le code expire bientôt" : "Validité du code"}
        </span>

        {/* `tabular-nums` : sans chasse fixe, la largeur du chiffre change à
            chaque seconde et le décompte tressaute.
            `aria-live="off"` : annoncer chaque seconde rendrait un lecteur
            d'écran inutilisable. Le message d'expiration, lui, est annoncé. */}
        <span
          aria-live="off"
          className={cn(
            "font-mono text-[.9375rem] font-semibold tabular-nums",
            urgent ? "text-red-700" : "text-gray-800",
          )}
        >
          {format(remainingMs)}
        </span>
      </div>

      <div
        className="mt-2 h-1 overflow-hidden rounded-full bg-gray-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={Math.round(totalMs / 1000)}
        aria-valuenow={Math.round(remainingMs / 1000)}
        aria-label="Temps restant avant expiration du code"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-[var(--duration-base)] ease-emphasized",
            urgent ? "bg-red-500" : "bg-blue-600",
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
