"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Loader2 } from "lucide-react";

import { SidePanel } from "@/components/ui/SidePanel";
import { formatDate } from "@/lib/utils";
import { reportsApi, type ReportListItem } from "@/lib/api/reports";


/**
 * Texte lisible tiré du HTML de l'éditeur.
 *
 * Le contenu est rendu en clair et non interprété : un aperçu n'a pas à
 * exécuter le balisage d'un compte rendu, et le texte nu se parcourt mieux
 * qu'une mise en forme réduite au quart d'un écran.
 */
function extrait(html?: string | null): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function Section({ titre, texte }: { titre: string; texte: string }) {
  if (!texte) return null;
  return (
    <div className="mb-4">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {titre}
      </h3>
      {/*
        Le texte entier, sans coupure.

        Il était tronqué à quatre cents caractères, avec « […] » en bout : de
        quoi reconnaître un dossier, pas de quoi lire un résultat. Or c'est
        pour lire qu'on ouvre ce panneau — et un compte rendu coupé au milieu
        d'une phrase oblige à rouvrir l'écran complet, ce que le panneau était
        censé éviter.

        Le corps du panneau défile déjà : la longueur ne le déborde pas.
      */}
      <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
        {texte}
      </p>
    </div>
  );
}

interface Props {
  ligne: ReportListItem | null;
  onClose: () => void;
}

/**
 * Aperçu d'un compte rendu, ouvert au clic sur sa ligne.
 *
 * Sert à trancher vite : est-ce bien ce dossier-là ? Le détail n'est chargé
 * qu'à l'ouverture — la liste ne porte pas le contenu, et le charger pour
 * toutes les lignes coûterait cher pour un besoin qui ne concerne qu'une ligne
 * à la fois.
 */
export function ApercuCompteRendu({ ligne, onClose }: Props) {
  const {
    data: detail,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["report-apercu", ligne?.id],
    queryFn: () => reportsApi.findById(ligne!.id).then((r) => r.data),
    enabled: Boolean(ligne),
  });

  const patient = ligne
    ? `${ligne.patientFirstname ?? ""} ${ligne.patientLastname ?? ""}`.trim()
    : "";

  // Les six parties du compte rendu, chacune suivie de son complément.
  //
  // Deux manquaient — le complément de microscopie et celui du commentaire.
  // Un pathologiste qui y avait écrit ne le retrouvait nulle part dans
  // l'aperçu, et rien ne signalait l'absence : le panneau paraissait complet.
  const sections = [
    { titre: "Macroscopie", texte: extrait(detail?.content) },
    { titre: "Macroscopie — complément", texte: extrait(detail?.descriptionSupplementaire) },
    { titre: "Microscopie", texte: extrait(detail?.contentMicro) },
    { titre: "Microscopie — complément", texte: extrait(detail?.descriptionSupplementaireMicro) },
    { titre: "Commentaire", texte: extrait(detail?.comment) },
    { titre: "Commentaire — complément", texte: extrait(detail?.commentSup) },
  ].filter((s) => s.texte);

  return (
    <SidePanel
      open={Boolean(ligne)}
      onClose={onClose}
      title={patient || "Compte rendu"}
      subtitle={ligne ? `${ligne.testOrderCode} · ${formatDate(ligne.createdAt)}` : undefined}
      footer={
        ligne && (
          <Link
            href={`/reports/${ligne.id}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Consulter le compte rendu
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        )
      }
    >
      {/*
        Chargement explicite, au centre du panneau.

        Une simple ligne de texte se confondait avec le contenu et n'occupait
        pas la place : le panneau paraissait vide plutôt qu'en train de se
        remplir. Le disque tournant est la convention du projet pour une attente
        en cours (cf. Button), ici agrandi et centré parce qu'il occupe une
        surface et non un bouton.

        `role="status"` et `aria-live` annoncent l'attente aux lecteurs d'écran,
        pour qui une icône animée ne dit rien.

        Le libellé n'est pas décoratif : « réduire les animations » fige toute
        rotation après un tour (globals.css impose `animation-iteration-count: 1`).
        Le disque s'immobilise alors, et seul le texte continue de dire ce qui se
        passe.
      */}
      {isLoading && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500"
        >
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm">Chargement de l&apos;aperçu…</p>
        </div>
      )}

      {/*
        Sans ce bloc, un appel en échec laissait le panneau entièrement vide :
        ni disque, ni texte, ni cause. L'utilisateur ne pouvait pas distinguer
        « le chargement a échoué » de « la fonctionnalité est cassée », et
        n'avait aucun moyen de réessayer sans refermer puis rouvrir.
      */}
      {isError && (
        <div role="alert" className="py-12 text-center">
          <p className="text-sm text-gray-700">
            L&apos;aperçu n&apos;a pas pu être chargé.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Réessayer
          </button>
        </div>
      )}

      {!isLoading && !isError && detail && (
        <>
          {detail.titleName && (
            <p className="mb-4 text-sm font-medium text-gray-900">
              {detail.titleName}
            </p>
          )}

          {sections.length > 0 ? (
            sections.map((s) => (
              <Section key={s.titre} titre={s.titre} texte={s.texte} />
            ))
          ) : (
            // Un compte rendu vide est une information en soi : il reste à
            // rédiger. Le dire évite de faire croire à un échec de chargement.
            <p className="text-sm italic text-gray-500">
              Ce compte rendu ne contient encore aucun texte.
            </p>
          )}
        </>
      )}
    </SidePanel>
  );
}
