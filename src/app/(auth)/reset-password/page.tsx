"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { authApi } from "@/lib/api/auth";
import { Button } from "@/components/ui/Button";

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Le mot de passe doit contenir au moins 8 caractères")
      .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule")
      .regex(/[a-z]/, "Le mot de passe doit contenir au moins une minuscule")
      .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre")
      .regex(
        /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
        "Le mot de passe doit contenir au moins un symbole"
      ),
    passwordConfirmation: z
      .string()
      .min(1, "La confirmation du mot de passe est requise"),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Les mots de passe ne correspondent pas",
    path: ["passwordConfirmation"],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    try {
      await authApi.resetPassword({
        token,
        email,
        password: data.password,
        passwordConfirmation: data.passwordConfirmation,
      });
      toast.success("Mot de passe réinitialisé avec succès. Vous pouvez vous connecter.");
      router.push("/login");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Une erreur est survenue. Veuillez réessayer.";
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
                    "logo-fallback-reset"
                  );
                  if (fallback) fallback.style.display = "block";
                }}
              />
              <span
                id="logo-fallback-reset"
                className="text-xl font-bold text-gray-800 hidden"
              >
                Labo AnaPath
              </span>
            </Link>
          </div>

          {/* Body */}
          <div className="px-8 py-8">
            <h4 className="text-2xl font-bold text-gray-800 mb-2">
              Réinitialiser le mot de passe
            </h4>
            <p className="text-gray-500 mb-6 text-sm">
              Saisissez votre nouveau mot de passe ci-dessous.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              {/* Token caché */}
              <input type="hidden" value={token} readOnly />

              {/* Email (readonly) */}
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
                  value={email}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>

              {/* Nouveau mot de passe */}
              <div className="mb-4">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
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

              {/* Confirmer le mot de passe */}
              <div className="mb-4">
                <label
                  htmlFor="passwordConfirmation"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <input
                    id="passwordConfirmation"
                    type={showConfirmPassword ? "text" : "password"}
                    {...register("passwordConfirmation")}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                    aria-label={
                      showConfirmPassword
                        ? "Masquer la confirmation"
                        : "Afficher la confirmation"
                    }
                  >
                    {showConfirmPassword ? (
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
                {errors.passwordConfirmation && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.passwordConfirmation.message}
                  </p>
                )}
              </div>

              {/* Conseil */}
              <div className="mb-6 p-3 bg-blue-50 rounded-md border border-blue-100">
                <p className="text-xs text-blue-700">
                  <strong>Conseil :</strong> Le mot de passe devrait contenir au
                  moins douze caractères. Pour le rendre plus sûr, utilisez des
                  lettres en majuscules et minuscules, des nombres, et des
                  symboles tels que ! &quot; ? $ % ^ &amp; ).
                </p>
              </div>

              {/* Bouton submit */}
              <Button
                type="submit"
                loading={isLoading}
                className="w-full justify-center rounded py-2 text-sm font-medium hover:bg-blue-700"
              >
                {isLoading ? "Enregistrement..." : "Enregistrer le mot de passe"}
              </Button>

              {/* Lien retour */}
              <p className="text-center mt-4 text-sm text-gray-500">
                Revenir en arrière ?{" "}
                <a
                  href="/login"
                  className="text-blue-600 font-semibold hover:underline"
                >
                  Connexion
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="text-gray-500 text-sm">Chargement...</div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
