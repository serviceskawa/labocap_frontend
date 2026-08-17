"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { authApi } from "@/lib/api/auth";
import { AuthCard } from "@/components/ui/AuthCard";
import { Button } from "@/components/ui/Button";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "L'adresse e-mail est requise")
    .email("Format d'e-mail invalide"),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      await authApi.forgotPassword({ email: data.email });
      toast.success(
        "Un e-mail contenant les instructions de réinitialisation a été envoyé."
      );
      reset();
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
    <AuthCard
      title="Mot de passe oublié"
      subtitle="Saisissez votre adresse e-mail : nous vous enverrons un lien de réinitialisation."
      footer={
        <a href="/login" className="font-medium text-blue-600 hover:underline">
          Retour à la connexion
        </a>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* Email */}
        <div className="mb-6">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Adresse e-mail
          </label>
          <input
            id="email"
            type="email"
            placeholder="Entrez votre email"
            {...register("email")}
            className={inputClass}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-600">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Bouton submit */}
        <Button
          type="submit"
          loading={isLoading}
          className="w-full justify-center rounded py-2 text-sm font-medium hover:bg-blue-700"
        >
          {isLoading
            ? "Envoi en cours..."
            : "Réinitialiser le mot de passe"}
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
    </AuthCard>
  );
}