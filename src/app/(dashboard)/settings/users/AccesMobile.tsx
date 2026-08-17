"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Smartphone, ShieldOff, KeyRound } from "lucide-react";

import { CrudModal } from "@/components/common/CrudModal";
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
      invalider();
    },
    onError: () => toast.error("L'accès n'a pas pu être ouvert."),
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

  return (
    <CrudModal
      isOpen
      onClose={onClose}
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
          {secrets && (
            <div className="rounded-xl border-2 border-blue-600 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-900">
                À transmettre maintenant à {secrets.nomComplet}
              </p>
              <p className="mt-1 text-xs text-blue-800">
                Ces deux codes ne seront plus jamais affichés — seules leurs
                empreintes sont conservées. Les régénérer invalidera ceux-ci.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Secret
                  libelle="Code d'enrôlement"
                  valeur={secrets.codeEnrolement}
                  note={`Valable jusqu'au ${formatDate(secrets.codeExpireLe)}, une seule fois`}
                  onCopier={() => copier(secrets.codeEnrolement, "Code d'enrôlement")}
                />
                <Secret
                  libelle="Code PIN"
                  valeur={secrets.pin}
                  note="À changer par l'agent une fois connecté"
                  onCopier={() => copier(secrets.pin, "Code PIN")}
                />
              </div>
            </div>
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
