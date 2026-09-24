"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, FileText, FlaskConical, Folder } from "lucide-react";

import { StatCard } from "@/components/ui/StatCard";
import type {
  CompteursAdmin,
  CompteursExamens,
  CompteursSecretariat,
  ParDiscipline,
} from "@/lib/api/dashboard";

/**
 * Biologie sur le tableau de bord.
 *
 * Quand le module Biologie est actif, le backend ajoute `parDiscipline` aux
 * cartes (`/dashboard/stats`, `/secretariat-stats`, `/doctor/exam-status`) :
 * les mêmes compteurs pour l'anatomie pathologique et pour la biologie. Le
 * réglage `bio_dashboard_mode` décide de la présentation :
 *
 *  - `SEPARATE` (défaut) : les cartes existantes restent celles de l'anatomie
 *    pathologique, et un bloc « Biologie » s'y ajoute ({@link BiologyStatsBlock}) ;
 *  - `COMBINED` : les cartes existantes affichent la somme des deux
 *    disciplines ({@link sumDisciplines}).
 *
 * Sans `parDiscipline` (module inactif côté serveur) ou sans le module côté
 * front, rien ne change : l'écran est celui d'avant la biologie.
 */
export type BioDashboardMode = "SEPARATE" | "COMBINED";

/** Valeur du réglage ; toute autre valeur que `COMBINED` vaut `SEPARATE`. */
export function parseBioDashboardMode(raw?: string | null): BioDashboardMode {
  return raw?.trim().toUpperCase() === "COMBINED" ? "COMBINED" : "SEPARATE";
}

/**
 * Somme d'un compteur sur les deux disciplines, ou `undefined` si la
 * répartition manque — l'appelant garde alors sa valeur de premier niveau.
 */
export function sumDisciplines<T, K extends keyof T>(
  par: ParDiscipline<T> | undefined,
  key: K,
): number | undefined {
  const p = par?.PATHOLOGY;
  const b = par?.BIOLOGY;
  if (!p || !b) return undefined;
  return Number(p[key] ?? 0) + Number(b[key] ?? 0);
}

const fr = (n: number) => n.toLocaleString("fr-FR");

/** Classes écrites en entier : Tailwind ne voit pas les classes composées. */
const XL_COLS: Record<number, string> = {
  2: "xl:grid-cols-2",
  3: "xl:grid-cols-3",
  4: "xl:grid-cols-4",
  5: "xl:grid-cols-5",
};

/** Carte cliquable : l'élévation au survol annonce le lien. */
function LinkedStat({
  href,
  ...props
}: React.ComponentProps<typeof StatCard> & { href: string }) {
  return (
    <Link href={href} className="block rounded-[var(--radius-surface)]">
      <StatCard {...props} interactive />
    </Link>
  );
}

interface BiologyStatsBlockProps {
  /** Part biologie de `/dashboard/stats` — profil administrateur. */
  admin?: CompteursAdmin;
  /** Part biologie de `/dashboard/secretariat-stats`. */
  secretariat?: CompteursSecretariat;
  /** Part biologie de `/dashboard/doctor/exam-status`. */
  exams?: CompteursExamens;
  /** Titre du bloc — « Biologie » par défaut. */
  title?: string;
  /** Identifiant du titre, unique dans la page (le bloc peut y figurer deux fois). */
  headingId?: string;
}

/**
 * Le bloc « Biologie » de la vue séparée : mêmes questions que les cartes
 * d'anatomie pathologique voisines — ce qu'il reste à faire, puis les cumuls —
 * posées aux demandes d'analyses. Une carte n'apparaît que si sa source a
 * répondu avec une répartition.
 */
export function BiologyStatsBlock({
  admin,
  secretariat,
  exams,
  title = "Biologie",
  headingId = "dashboard-biologie",
}: BiologyStatsBlockProps) {
  if (!admin && !secretariat && !exams) return null;
  const late = secretariat?.noFinishWeek ?? 0;
  // Une seule rangée sur grand écran, quel que soit le nombre de cartes
  // (2 à 5 selon le profil) : pas de carte orpheline sur une seconde ligne.
  const count =
    (secretariat ? 3 : 0) + (admin ? 2 : 0) + (exams ? 2 : 0);
  const xlCols = XL_COLS[Math.min(Math.max(count, 2), 5)];

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 id={headingId} className="text-sm font-semibold text-gray-800">
          {title}
        </h2>
        {secretariat && (
          <span className="text-xs font-medium text-gray-500">
            Année {new Date().getFullYear()}
          </span>
        )}
      </div>
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${xlCols}`}>
        {secretariat && (
          <LinkedStat
            href="/biologie/demandes"
            title="Bons sans compte rendu"
            value={fr(secretariat.noSaveTest)}
            icon={<FileText className="h-5 w-5" />}
          />
        )}
        {admin && (
          <LinkedStat
            href="/biologie/resultats"
            title="Comptes rendus à valider"
            value={fr(admin.noFinishTest)}
            icon={<FlaskConical className="h-5 w-5" />}
          />
        )}
        {secretariat && (
          <LinkedStat
            href="/biologie/demandes"
            title="À remettre au client"
            value={fr(secretariat.noFinishTest)}
            icon={<Folder className="h-5 w-5" />}
          />
        )}
        {secretariat && (
          <LinkedStat
            href="/biologie/demandes"
            title="En retard (> 3 semaines)"
            value={fr(late)}
            // Teinté seulement s'il y en a, comme la carte d'anatomie pathologique.
            valueClassName={late > 0 ? "text-red-600" : undefined}
            icon={<AlertTriangle className="h-5 w-5" />}
          />
        )}
        {admin && (
          <StatCard
            title="Demandes d'analyses"
            value={fr(admin.valeurTestOrder)}
            trend={{
              value: Math.round(admin.crTestOrder),
              isPositive: admin.crTestOrder >= 0,
            }}
            icon={<FlaskConical className="h-5 w-5" />}
          />
        )}
        {exams && (
          <StatCard
            title="Analyses terminées"
            value={fr(exams.termine)}
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
        )}
        {exams && (
          <StatCard
            title="Analyses en attente"
            value={fr(exams.enAttente)}
            icon={<Clock className="h-5 w-5" />}
          />
        )}
      </div>
    </section>
  );
}
