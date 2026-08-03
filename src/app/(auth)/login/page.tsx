"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authApi } from "@/lib/api/auth";
import { resolvePostLoginRoute } from "@/lib/auth-flow";
import { beginPending2fa, hasPending2fa } from "@/lib/auth-2fa";
import { AppLogo } from "@/components/ui/AppLogo";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/auth.store";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "L'adresse e-mail est requise")
    .email("Format d'e-mail invalide"),
  password: z.string().min(1, "Le mot de passe est requis"),
  remember: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Un challenge 2FA en cours interdit de revenir sur ce formulaire tant que le
  // code n'a pas expiré (règle Laravel `RedirectIfAuthenticated`). Le proxy le
  // fait déjà côté serveur ; ce garde-fou couvre les navigations client (retour
  // arrière, lien interne) qui ne repassent pas par le serveur.
  useEffect(() => {
    if (hasPending2fa()) {
      router.replace("/2fa/challenge");
    }
  }, [router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      remember: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const response = await authApi.login({
        email: data.email,
        password: data.password,
        remember: data.remember,
      });

      const result = response.data;

      if (result.requires2fa) {
        // Le token temporaire est porté par le cookie HttpOnly `pending_2fa` posé
        // par l'API : rien de sensible à stocker côté navigateur. On mémorise
        // seulement l'e-mail (affichage masqué) et l'échéance du code (décompte
        // + verrouillage de /login jusqu'à expiration).
        beginPending2fa(data.email, result.expiresIn);
        router.replace("/2fa/challenge");
        return;
      }

      if (result.user) {
        setUser(result.user);
        const next = await resolvePostLoginRoute();
        router.push(next);
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Une erreur est survenue lors de la connexion.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Header avec logo */}
          <div className="bg-gray-50 px-8 py-6 text-center border-b">
            <Link href="/">
              <AppLogo className="h-12 mx-auto" />
            </Link>
          </div>

          {/* Body */}
          <div className="px-8 py-8">
            <h4 className="text-2xl font-bold text-gray-800 mb-1">
              Se connecter
            </h4>
            <p className="text-gray-500 mb-6 text-sm">
              Renseignez vos identifiants de connexion.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              {/* Email */}
              <div className="mb-4">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Adresse e-mail
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="julie@exemple.com"
                  {...register("email")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Mot de passe */}
              <div className="mb-4">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mot de passe"
                    {...register("password")}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                    aria-label={
                      showPassword
                        ? "Masquer le mot de passe"
                        : "Afficher le mot de passe"
                    }
                  >
                    {showPassword ? (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Se souvenir de moi */}
              <div className="mb-6 flex items-center">
                <input
                  id="remember"
                  type="checkbox"
                  {...register("remember")}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor="remember"
                  className="ml-2 text-sm text-gray-600"
                >
                  Se souvenir de moi
                </label>
              </div>

              {/* Bouton submit — spinner et libellé centrés, bouton neutralisé
                  pendant l'appel pour empêcher un double envoi. */}
              <Button
                type="submit"
                loading={isLoading}
                className="w-full justify-center rounded py-2 text-sm font-medium hover:bg-blue-700"
              >
                {isLoading ? "Connexion en cours..." : "Connexion"}
              </Button>

              {/* Lien mot de passe oublié */}
              <p className="text-center mt-4 text-sm text-gray-500">
                Mot de passe oublié ?{" "}
                <a
                  href="/forgot-password"
                  className="text-blue-600 font-semibold hover:underline"
                >
                  Réinitialiser
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
