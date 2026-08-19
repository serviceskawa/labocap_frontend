"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { authApi } from "@/lib/api/auth";
import type { TwoFaSetupResponse } from "@/types/auth";

interface Props {
  /** L'utilisateur a-t-il déjà une application enregistrée ? */
  actif: boolean;
  onChangement: () => void;
}

/**
 * Mise en place d'une application d'authentification.
 *
 * <p>Le serveur savait engendrer un secret TOTP, son URI `otpauth://` et son QR
 * depuis longtemps — les trois points d'entrée existaient. Rien ne les appelait :
 * la fonctionnalité était écrite et n'a jamais été proposée à personne.</p>
 *
 * <p>Elle ne remplace pas le code envoyé par courriel, elle s'y ajoute. Les deux
 * sont acceptés à la connexion, ce qui rend l'enfermement impossible : téléphone
 * perdu, on demande un code par courriel ; boîte inaccessible, on lit
 * l'application.</p>
 */
export function AuthentificationParApplication({ actif, onChangement }: Props) {
  const [miseEnPlace, setMiseEnPlace] = useState<TwoFaSetupResponse | null>(null);
  const [code, setCode] = useState("");

  const demarrer = useMutation({
    mutationFn: () => authApi.setupAuthenticator().then((r) => r.data),
    onSuccess: (data) => setMiseEnPlace(data),
    onError: () => toast.error("La mise en place n'a pas pu démarrer."),
  });

  const confirmer = useMutation({
    mutationFn: () => authApi.enableAuthenticator(code.trim()),
    onSuccess: () => {
      toast.success("Application enregistrée. Elle servira à votre prochaine connexion.");
      setMiseEnPlace(null);
      setCode("");
      onChangement();
    },
    onError: () =>
      toast.error("Ce code n'est pas accepté. Vérifiez l'heure de votre téléphone."),
  });

  const retirer = useMutation({
    mutationFn: () => authApi.disableAuthenticator(code.trim()),
    onSuccess: () => {
      toast.success("Application retirée. Vos codes arriveront de nouveau par courriel.");
      setCode("");
      onChangement();
    },
    onError: () => toast.error("Ce code n'est pas accepté."),
  });

  return (
    <div className="hyper-card">
      <div className="hyper-card-body">
        <h5 className="hyper-card-heading">
          <ShieldCheck className="h-[1.1em] w-[1.1em]" />
          Connexion par application
        </h5>

        {/* ── Application déjà en place ────────────────────────────────── */}
        {actif && !miseEnPlace && (
          <div className="space-y-3">
            <p className="flex items-start gap-2 text-sm text-gray-600">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              Votre application engendre vos codes de connexion. Vous ne recevez
              plus de courriel à chaque connexion, mais vous pouvez toujours en
              demander un depuis l&apos;écran du code.
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Pour retirer l&apos;application, saisissez un code en cours
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] tracking-widest shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {/*
                Un code est exigé pour retirer l'application : sans lui, un
                navigateur laissé ouvert suffirait à désarmer le second facteur,
                ce qui reviendrait à ne pas en avoir.
              */}
            </div>
            <Button
              type="button"
              loading={retirer.isPending}
              onClick={() => retirer.mutate()}
              className="hyper-btn hyper-btn-danger"
            >
              Retirer l&apos;application
            </Button>
          </div>
        )}

        {/* ── Aucune application ───────────────────────────────────────── */}
        {!actif && !miseEnPlace && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Recevez vos codes de connexion sur votre téléphone plutôt que par
              courriel. Ils fonctionnent sans réseau — utile quand c&apos;est
              justement la plateforme qu&apos;on n&apos;arrive pas à joindre.
            </p>
            <Button
              type="button"
              loading={demarrer.isPending}
              onClick={() => demarrer.mutate()}
              className="hyper-btn hyper-btn-primary"
            >
              Activer
            </Button>
          </div>
        )}

        {/* ── Mise en place en cours ───────────────────────────────────── */}
        {miseEnPlace && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Ouvrez l&apos;application AnapathLab, menu{" "}
              <strong>Codes de connexion</strong>, et scannez ce QR.
            </p>

            <div className="flex justify-center rounded-lg bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/png;base64,${miseEnPlace.qrCodeBase64}`}
                alt="QR de mise en place"
                className="h-48 w-48"
              />
            </div>

            <details className="text-sm text-gray-600">
              <summary className="cursor-pointer">
                La caméra ne coopère pas ?
              </summary>
              <p className="mt-2">
                Saisissez ce secret à la main dans votre application :
              </p>
              {/* `select-all` : le secret se prend d'un seul geste. */}
              <code className="mt-1 block select-all break-all rounded bg-gray-100 p-2 font-mono text-xs">
                {miseEnPlace.secret}
              </code>
            </details>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Saisissez le code affiché pour confirmer
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] tracking-widest shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Ce code confirme que votre téléphone est à l&apos;heure : un
                décalage de plus d&apos;une minute ferait échouer toutes vos
                connexions.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                loading={confirmer.isPending}
                onClick={() => confirmer.mutate()}
                className="hyper-btn hyper-btn-success"
              >
                Confirmer
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setMiseEnPlace(null);
                  setCode("");
                }}
                className="hyper-btn"
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
