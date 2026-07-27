"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authApi } from "@/lib/api/auth";
import { resolvePostLoginRoute } from "@/lib/auth-flow";
import {
  clearPending2fa,
  getPending2faEmail,
  getPending2faExpiry,
} from "@/lib/auth-2fa";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/auth.store";

const twoFactorSchema = z.object({
  code: z
    .string()
    .min(1, "Le code est requis")
    .regex(/^\d{6}$/, "Le code doit contenir exactement 6 chiffres"),
});

type TwoFactorFormData = z.infer<typeof twoFactorSchema>;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const masked =
    local.length <= 2
      ? local[0] + "***"
      : local[0] + "***" + local[local.length - 1];
  return `${masked}@${domain}`;
}

/** « 4:07 » — temps restant avant expiration du code. */
function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function TwoFactorChallengePage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  const storedEmail = remainingMs !== null ? getPending2faEmail() : null;
  const maskedEmail = storedEmail
    ? maskEmail(storedEmail)
    : "votre adresse e-mail";

  /** Fin du challenge : verrou levé, retour à l'écran de connexion. */
  const backToLogin = useCallback(
    (message?: string) => {
      clearPending2fa();
      if (message) toast.error(message);
      router.replace("/login");
    },
    [router],
  );

  // Décompte de validité du code. Aucun challenge en cours (route saisie à la
  // main, code expiré) → retour au login : cet écran n'existe que dans le
  // prolongement d'une saisie d'identifiants (règle Laravel `/confirm-login`).
  useEffect(() => {
    const tick = () => {
      const until = getPending2faExpiry();
      if (until === null) {
        backToLogin();
        return;
      }
      const left = until - Date.now();
      if (left <= 0) {
        backToLogin("Le code a expiré, veuillez vous reconnecter.");
        return;
      }
      setRemainingMs(left);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [backToLogin]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TwoFactorFormData>({
    resolver: zodResolver(twoFactorSchema),
  });

  const onSubmit = async (data: TwoFactorFormData) => {
    setIsLoading(true);
    try {
      // Pas de token dans le corps : l'API le lit sur son cookie HttpOnly.
      const response = await authApi.twoFactor({ code: data.code });
      const result = response.data;

      if (result.user) {
        clearPending2fa();
        setUser(result.user);
        const next = await resolvePostLoginRoute();
        router.replace(next);
      }
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Le code saisi est incorrect";
      // 401 = token temporaire absent/expiré : le challenge est terminé, on
      // rouvre l'écran de connexion au lieu de laisser l'utilisateur bloqué.
      if (status === 401) {
        backToLogin(message);
        return;
      }
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    const email = getPending2faEmail();
    if (!email) {
      backToLogin("Session expirée, veuillez vous reconnecter.");
      return;
    }
    setIsResending(true);
    try {
      await authApi.resendTwoFactor(email);
      toast.success("Code renvoyé");
    } catch {
      toast.error("Impossible de renvoyer le code, veuillez réessayer.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Header avec logo */}
          <div className="bg-gray-50 px-8 py-6 text-center border-b">
            <Link href="/">
              {/* Logo statique servi depuis /public : next/image n'apporte rien
                  ici et ajouterait un optimiseur au runtime. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Logo"
                className="h-12 mx-auto"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const fallback = document.getElementById(
                    "logo-fallback-2fa"
                  );
                  if (fallback) fallback.style.display = "block";
                }}
              />
              <span
                id="logo-fallback-2fa"
                className="text-xl font-bold text-gray-800 hidden"
              >
                Labo AnaPath
              </span>
            </Link>
          </div>

          {/* Body */}
          <div className="px-8 py-8">
            <h4 className="text-2xl font-bold text-gray-800 mb-2">
              Vérifiez votre e-mail pour un code
            </h4>
            <p className="text-gray-500 mb-6 text-sm">
              Nous avons envoyé un code à 6 caractères à{" "}
              <strong>{maskedEmail}</strong>. Le code expire sous peu, veuillez
              donc le saisir rapidement.
              {remainingMs !== null && (
                <>
                  {" "}
                  <span className="font-semibold text-gray-700">
                    Expire dans {formatRemaining(remainingMs)}.
                  </span>
                </>
              )}
            </p>

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              {/* Code */}
              <div className="mb-6">
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  placeholder="Entrer le code"
                  {...register("code")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg tracking-widest"
                  maxLength={6}
                />
                {errors.code && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.code.message}
                  </p>
                )}
              </div>

              {/* Bouton submit — spinner et libellé centrés, bouton neutralisé
                  pendant la vérification pour empêcher un double envoi. */}
              <Button
                type="submit"
                loading={isLoading}
                className="w-full justify-center rounded py-2 text-sm font-medium hover:bg-blue-700"
              >
                {isLoading ? "Vérification..." : "Confirmer"}
              </Button>

              {/* Lien renvoyer */}
              <p className="text-center mt-4 text-sm text-gray-500">
                Vous n&apos;aviez pas reçu le code ?{" "}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (!isResending) handleResend();
                  }}
                  aria-disabled={isResending}
                  className={`font-semibold ${isResending ? "text-gray-400 cursor-not-allowed" : "text-blue-600 hover:underline"}`}
                >
                  {isResending ? "Envoi en cours…" : "Renvoyer"}
                </a>
              </p>
            </form>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center mt-4 text-sm text-gray-500">
          <a
            href="mailto:serviceskawa@gmail.com?subject=Support"
            className="text-blue-600 hover:underline"
          >
            Cliquez ici pour contacter le Support Technique
          </a>
        </p>
      </div>
    </div>
  );
}
