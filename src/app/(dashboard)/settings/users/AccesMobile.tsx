"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Smartphone, ShieldOff, KeyRound } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { CrudModal } from "@/components/common/CrudModal";
import { API_ORIGIN } from "@/lib/api/client";
import {
  mobileAccessApi,
  type MobileAccessSecrets,
} from "@/lib/api/mobileAccess";
import type { User } from "@/lib/api/users";
import { formatDate } from "@/lib/utils";

interface Props {
  utilisateur: User;
  onClose: () => void;
}

/**
 * Gestion de l'accès d'un utilisateur à l'application mobile.
 *
 * <p>Trois choses étaient nécessaires pour ouvrir un accès — accorder le droit,
 * délivrer un code d'enrôlement, poser un code PIN — et aucune n'était possible
 * depuis l'interface. Le PIN ne l'était même pas depuis l'application : le
 * point d'entrée réclame une session, or ouvrir une session réclame un PIN.</p>
 *
 * <p>Un seul bouton fait désormais les trois, et affiche les deux secrets.</p>
 */
export function AccesMobile({ utilisateur, onClose }: Props) {
  const queryClient = useQueryClient();
  const [secrets, setSecrets] = useState<MobileAccessSecrets | null>(null);
  /** Le PIN ne disparaît de l'écran qu'une fois déclaré noté. */
  const [pinNote, setPinNote] = useState(false);

  const etat = useQuery({
    queryKey: ["acces-mobile", utilisateur.id],
    queryFn: () => mobileAccessApi.getState(utilisateur.id).then((r) => r.data),
  });

  const invalider = () =>
    queryClient.invalidateQueries({ queryKey: ["acces-mobile", utilisateur.id] });

  const ouvrir = useMutation({
    mutationFn: () => mobileAccessApi.open(utilisateur.id).then((r) => r.data),
    onSuccess: (data) => {
      setSecrets(data);
      setPinNote(false);
      invalider();
    },
    onError: () => toast.error("L'accès n'a pas pu être ouvert."),
  });

  const revoquerCode = useMutation({
    mutationFn: () => mobileAccessApi.revokeCode(utilisateur.id),
    onSuccess: () => {
      invalider();
      toast.success("Code d'enrôlement révoqué. Les appareils déjà enrôlés restent actifs.");
    },
    onError: () => toast.error("Le code n'a pas pu être révoqué."),
  });

  const fermer = useMutation({
    mutationFn: () => mobileAccessApi.close(utilisateur.id),
    onSuccess: () => {
      setSecrets(null);
      invalider();
      toast.success("Accès mobile fermé. Les appareils ont été révoqués.");
    },
    onError: () => toast.error("L'accès n'a pas pu être fermé."),
  });

  const revoquer = useMutation({
    mutationFn: (deviceId: string) => mobileAccessApi.revokeDevice(deviceId),
    onSuccess: () => {
      invalider();
      toast.success("Appareil révoqué.");
    },
    onError: () => toast.error("L'appareil n'a pas pu être révoqué."),
  });

  const copier = async (valeur: string, quoi: string) => {
    await navigator.clipboard.writeText(valeur);
    toast.success(`${quoi} copié.`);
  };

  const acces = etat.data?.acces ?? false;
  const appareilsActifs = (etat.data?.appareils ?? []).filter((a) => !a.revokedAt);
  // Celui qui vient d'être délivré prime : l'état en cache date d'avant.
  const codeVivant = secrets?.codeEnrolement ?? etat.data?.codeEnrolement ?? null;

  // Fermer sans avoir noté le PIN le perd définitivement.
  const fermetureBloquee = !!secrets && !pinNote;

  return (
    <CrudModal
      isOpen
      // Tant que le PIN n'est pas déclaré noté, la fenêtre ne se referme pas :
      // c'est le seul secret que rien ne rattrape.
      onClose={() => {
        if (fermetureBloquee) {
          toast.error("Notez le code PIN avant de fermer : il ne sera plus affiché.");
          return;
        }
        onClose();
      }}
      title={`Accès mobile — ${utilisateur.firstname} ${utilisateur.lastname}`}
      size="lg"
    >
      {etat.isLoading ? (
        <p className="py-8 text-center text-sm text-gray-500">Chargement…</p>
      ) : (
        <div className="space-y-6">
          {/*
            Les secrets d'abord : quand ils viennent d'être engendrés, c'est la
            seule chose qui compte à l'écran, et les faire chercher sous une
            liste d'appareils serait le meilleur moyen de les voir disparaître
            à la fermeture de la fenêtre.
          */}
          {/*
            Le PIN, et lui seul, est éphémère : la base n'en garde que
            l'empreinte. Un bandeau ne suffisait pas — on referme une fenêtre
            sans lire —, d'où la case à cocher qui verrouille la sortie.
          */}
          {secrets && !pinNote && (
            <div className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                Code PIN de {secrets.nomComplet} — notez-le maintenant
              </p>
              <p className="mt-1 text-xs text-amber-800">
                Il ne sera plus jamais affiché : seule son empreinte est
                conservée. Le retrouver sera impossible, il faudra en régénérer
                un nouveau. Le QR d&apos;enrôlement, lui, reste consultable
                ci-dessous.
              </p>

              <div className="mt-3">
                <Secret
                  libelle="Code PIN"
                  valeur={secrets.pin}
                  note="À changer par l'agent une fois connecté"
                  onCopier={() => copier(secrets.pin, "Code PIN")}
                />
              </div>

              <label className="mt-3 flex items-center gap-2 text-sm font-medium text-amber-900">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-amber-400"
                  onChange={(e) => setPinNote(e.target.checked)}
                />
                J&apos;ai noté le code PIN
              </label>
            </div>
          )}

          {/*
            Le QR à chaque consultation. Il n'existait qu'à l'instant de sa
            création : refermer la fenêtre coûtait un accès à rouvrir, et donc
            un PIN régénéré pour tout le monde. Le code est désormais conservé
            scellé côté serveur, et se remontre.

            Il ne porte rien de plus que ce qui est affiché en clair juste en
            dessous. Le PIN en est absent : il ouvre les sessions et n'a pas à
            voyager sur un écran qu'on photographie.
          */}
          {acces && codeVivant && (
            <div className="rounded-xl border-2 border-blue-600 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-900">
                Code d&apos;enrôlement — à scanner par{" "}
                {utilisateur.firstname} {utilisateur.lastname}
              </p>
              <p className="mt-1 text-xs text-blue-800">
                Valable jusqu&apos;à sa révocation, pour autant de téléphones
                qu&apos;il en faut.
                {etat.data?.codeCreeLe &&
                  ` Délivré le ${formatDate(etat.data.codeCreeLe)}.`}
              </p>

              <div className="mt-4 flex flex-col items-center rounded-lg bg-white p-4">
                <QRCodeSVG
                  value={JSON.stringify({
                    v: 1,
                    url: API_ORIGIN,
                    email: utilisateur.email,
                    code: codeVivant,
                    // Le nom sert à baptiser l'appareil dans la liste ci-dessous.
                    // L'agent ne le saisit plus : c'est le seul libellé que
                    // l'administrateur cherchait de toute façon en révoquant.
                    nom: `${utilisateur.firstname} ${utilisateur.lastname}`,
                  })}
                  size={196}
                  level="M"
                  marginSize={2}
                />
                <p className="mt-3 text-center text-xs text-blue-900">
                  À scanner depuis l&apos;application, écran de connexion.
                  <br />
                  Le code PIN reste à saisir à la main, à chaque session.
                </p>
              </div>

              <div className="mt-4">
                <Secret
                  libelle="Code d'enrôlement"
                  valeur={codeVivant}
                  note="Pour une saisie à la main, si le scan est impossible"
                  onCopier={() => copier(codeVivant, "Code d'enrôlement")}
                />
              </div>

              <button
                type="button"
                onClick={() => revoquerCode.mutate()}
                disabled={revoquerCode.isPending}
                className="mt-3 w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                Révoquer ce code
              </button>
            </div>
          )}

          {/*
            Un accès ouvert dont le code ne se réaffiche pas : soit il a été
            révoqué, soit il date d'avant sa conservation, soit le serveur n'a
            pas de clé de chiffrement. Le dire, plutôt que de laisser un vide
            qu'on prend pour un bug.
          */}
          {acces && !codeVivant && !secrets && (
            <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
              Aucun code d&apos;enrôlement à afficher. Régénérez-en un
              ci-dessous pour rattacher un nouveau téléphone.
            </p>
          )}

          <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4">
            <div>
              <p className="font-medium text-gray-900">
                {acces ? "Accès ouvert" : "Aucun accès"}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {acces
                  ? etat.data?.pinDefini
                    ? "Cet utilisateur peut employer l'application mobile."
                    : "Le droit est accordé mais aucun code PIN n'est posé."
                  : "Cet utilisateur ne peut pas employer l'application mobile."}
              </p>
            </div>

            {acces ? (
              <button
                type="button"
                onClick={() => fermer.mutate()}
                disabled={fermer.isPending}
                className="shrink-0 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                <ShieldOff className="mr-1.5 inline h-4 w-4" />
                Fermer l&apos;accès
              </button>
            ) : (
              <button
                type="button"
                onClick={() => ouvrir.mutate()}
                disabled={ouvrir.isPending}
                className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                <KeyRound className="mr-1.5 inline h-4 w-4" />
                Ouvrir l&apos;accès
              </button>
            )}
          </div>

          {acces && (
            <button
              type="button"
              onClick={() => ouvrir.mutate()}
              disabled={ouvrir.isPending}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Régénérer le code d&apos;enrôlement et le code PIN
            </button>
          )}
          {acces && (
            // Le dire avant, pas après : régénérer casse le PIN de quelqu'un
            // qui s'en servait, et c'est rarement ce qu'on cherche quand on
            // voulait seulement revoir le QR — lequel s'affiche déjà plus haut.
            <p className="-mt-4 text-xs text-gray-500">
              Régénérer remplace le code PIN en service : l&apos;agent ne
              pourra plus ouvrir de session avec l&apos;ancien.
            </p>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-800">
              Appareils enrôlés
            </h3>

            {(etat.data?.appareils ?? []).length === 0 ? (
              <p className="text-sm text-gray-500">
                Aucun appareil. Il en apparaîtra un dès que l&apos;agent aura
                rattaché son téléphone avec son code d&apos;enrôlement.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {etat.data!.appareils.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 p-3">
                    <Smartphone
                      className={`h-4 w-4 shrink-0 ${
                        a.revokedAt ? "text-gray-300" : "text-gray-500"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm ${
                          a.revokedAt ? "text-gray-400 line-through" : "text-gray-900"
                        }`}
                      >
                        {a.label}
                      </p>
                      <p className="text-xs text-gray-500">
                        Enrôlé le {formatDate(a.enrolledAt)}
                        {a.lastSeenAt && ` · vu le ${formatDate(a.lastSeenAt)}`}
                        {a.revokedAt && ` · révoqué le ${formatDate(a.revokedAt)}`}
                      </p>
                    </div>
                    {!a.revokedAt && (
                      <button
                        type="button"
                        onClick={() => revoquer.mutate(a.id)}
                        disabled={revoquer.isPending}
                        className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                      >
                        Révoquer
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {appareilsActifs.length > 1 && (
              // Plusieurs téléphones actifs pour une même personne : ce n'est pas
              // interdit — on remplace un appareil sans toujours révoquer l'ancien —
              // mais cela mérite d'être vu, chacun pouvant signer.
              <p className="mt-2 text-xs text-amber-700">
                {appareilsActifs.length} appareils actifs pour cette personne.
                Chacun peut ouvrir une session et signer.
              </p>
            )}
          </div>
        </div>
      )}
    </CrudModal>
  );
}

function Secret({
  libelle,
  valeur,
  note,
  onCopier,
}: {
  libelle: string;
  valeur: string;
  note: string;
  onCopier: () => void;
}) {
  return (
    <div className="rounded-lg bg-white p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {libelle}
      </p>
      <div className="mt-1 flex items-center gap-2">
        {/* `select-all` : le code se prend d'un seul geste, même sans presse-papier. */}
        <code className="select-all text-xl font-bold tracking-widest text-gray-900">
          {valeur}
        </code>
        <button
          type="button"
          onClick={onCopier}
          title={`Copier le ${libelle.toLowerCase()}`}
          className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-500">{note}</p>
    </div>
  );
}
