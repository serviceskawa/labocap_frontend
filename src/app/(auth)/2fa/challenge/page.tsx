"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
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
import { AuthCard } from "@/components/ui/AuthCard";
import { OtpCountdown } from "@/components/ui/OtpCountdown";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/auth.store";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

const twoFactorSchema = z.object({
  code: z
    .string()
    .min(1, "Le code est requis")
    .regex(/^\d{6}$/, "Le code doit contenir exactement 6 chiffres"),
});

type TwoFactorFormData = z.infer<typeof twoFactorSchema>;

/**
 * Durée totale de validité du code, pour la proportion de la barre de décompte.
 * Doit rester alignée sur `JwtTokenProvider.TEMP_TOKEN_VALIDITY_MS` côté API
 * (5 minutes) : l'API n'expose pas cette durée dans sa réponse de login.
 */
const OTP_TOTAL_MS = 5 * 60 * 1000;

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

  // Verrou de soumission : `isLoading` étant asynchrone, il ne suffit pas à
  // empêcher un second envoi déclenché dans la même frappe (collage du code,
  // saisie très rapide).
  const submittingRef = useRef(false);

  const onSubmit = async (data: TwoFactorFormData) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsLoading(true);
    try {
      // Pas de token dans le corps : l'API le lit sur son cookie HttpOnly.
      const response = await authApi.twoFactor({ code: data.code });
      const result = response.data;

      if (result.user) {
        clearPending2fa();
        setUser(result.user);
        const next = await resolvePostLoginRoute();
        // Navigation DOCUMENT et non `router.push/replace` : l'état
        // d'authentification vient de changer, et la garde de routes est posée
        // dans `proxy.ts`, côté serveur. Le routeur de Next conserve un cache
        // client des payloads RSC — dont celui obtenu AVANT connexion, qui
        // était la redirection vers /login. Une navigation client réutiliserait
        // cette réponse périmée : l'écran ne bascule pas, et seul un
        // rechargement manuel débloque la situation.
        //
        // `assign` force une requête document : le proxy réévalue les cookies
        // fraîchement posés, et le cache client repart de zéro.
        window.location.assign(next);
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
      submittingRef.current = false;
      setIsLoading(false);
    }
  };

  const codeField = register("code");

  /**
   * Le code fait exactement 6 chiffres : dès que le dernier est saisi, la
   * vérification part d'elle-même (et le bouton passe en attente), sans que
   * l'utilisateur ait à cliquer sur « Confirmer ».
   */
  const handleCodeChange = (event: ChangeEvent<HTMLInputElement>) => {
    void codeField.onChange(event);
    const value = event.target.value.trim();
    if (/^\d{6}$/.test(value)) {
      void onSubmit({ code: value });
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
    <AuthCard
      title="Vérifiez votre e-mail"
      subtitle={
        <>
          Nous avons envoyé un code à 6 chiffres à{" "}
          <strong className="font-semibold text-gray-700">{maskedEmail}</strong>.
        </>
      }
      footer={
        <a
          href="mailto:serviceskawa@gmail.com?subject=Support"
          className="font-medium text-blue-600 hover:underline"
        >
          Contacter le support technique
        </a>
      }
    >
      {/* Le décompte précède le champ : il conditionne l'action, il doit donc
          être lu avant elle. Il était auparavant relégué en fin de paragraphe. */}
      {remainingMs !== null && (
        <OtpCountdown
          remainingMs={remainingMs}
          totalMs={OTP_TOTAL_MS}
          className="mb-5"
        />
      )}

      {/* `handleSubmit` est appelé DANS le gestionnaire (et non au rendu) :
          `onSubmit` lit un ref, que React Compiler interdit de toucher
          pendant le rendu. */}
      <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate>
        <div className="mb-5">
          <label htmlFor="code" className="mb-1.5 block text-[.875rem] font-medium text-gray-700">
            Code de vérification
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="000000"
            {...codeField}
            onChange={handleCodeChange}
            // Chasse fixe et interlettrage large : six chiffres se relisent
            // ainsi caractère par caractère, ce qu'un texte proportionnel
            // rend malaisé.
            className={`${inputClass} text-center font-mono text-[1.375rem] tracking-[0.35em] tabular-nums`}
            maxLength={6}
            aria-invalid={errors.code ? true : undefined}
          />
          {errors.code && (
            <p className="mt-1.5 text-[.8125rem] text-red-600">{errors.code.message}</p>
          )}
        </div>

        <Button type="submit" loading={isLoading} className="w-full justify-center">
          {isLoading ? "Vérification…" : "Confirmer"}
        </Button>

        <p className="mt-4 text-center text-[.875rem] text-gray-500">
          Vous n&apos;avez pas reçu le code ?{" "}
          {/* <button> et non <a href="#"> : ce n'est pas une navigation. Un lien
              vide reste focalisable et annoncé comme tel par un lecteur
              d'écran, alors qu'il déclenche une action. */}
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="rounded-[var(--radius-control)] font-semibold text-blue-600 transition-colors duration-[var(--duration-fast)] ease-emphasized hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
          >
            {isResending ? "Envoi en cours…" : "Renvoyer"}
          </button>
        </p>
      </form>
    </AuthCard>
  );
}
