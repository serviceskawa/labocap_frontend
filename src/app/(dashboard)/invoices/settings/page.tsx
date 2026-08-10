"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  settingInvoicesApi,
  type SettingInvoiceRequest,
} from "@/lib/api/settingInvoices";
import type { ApiError } from "@/types/api";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

// ---------------------------------------------------------------------------
// Schéma Zod
// ---------------------------------------------------------------------------

const settingInvoiceSchema = z.object({
  ifu: z.string().min(1, "L'IFU est obligatoire"),
  token: z.string().min(1, "Le token est obligatoire"),
  status: z.boolean(),
});

type SettingInvoiceFormValues = z.infer<typeof settingInvoiceSchema>;


// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InvoiceSettingsPage() {
  const { can } = usePermissions();
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SettingInvoiceFormValues>({
    resolver: zodResolver(settingInvoiceSchema),
    defaultValues: { ifu: "", token: "", status: false },
  });

  // Charger la configuration MECeF de la branche (1er enregistrement)
  const { data: configData, isLoading } = useQuery({
    queryKey: ["setting-invoice"],
    queryFn: () =>
      settingInvoicesApi
        .findAll({ size: 10 })
        .then((r) => r.data.content?.[0] ?? null),
  });

  useEffect(() => {
    if (configData) {
      reset({
        ifu: configData.ifu ?? "",
        token: configData.token ?? "",
        status: configData.status ?? false,
      });
    }
  }, [configData, reset]);

  const updateMutation = useMutation({
    mutationFn: (values: SettingInvoiceRequest) => {
      if (!configData?.id) {
        throw new Error("Aucune configuration existante à mettre à jour");
      }
      return settingInvoicesApi.update(configData.id, values);
    },
    onSuccess: () => {
      toast.success("Paramètres mis à jour");
      qc.invalidateQueries({ queryKey: ["setting-invoice"] });
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de la mise à jour");
    },
  });

  const status = watch("status");

  if (!can(PERMISSIONS.VIEW_SETTING_INVOICE)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-gray-500">Accès non autorisé</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paramètres des Factures"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Factures", href: "/invoices" },
          { label: "Paramètres" },
        ]}
        action={
          <Link
            href="/home"
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Accueil
          </Link>
        }
      />

      {/* Onglet unique "Informations" */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-blue-600">
            Informations
          </h2>
        </div>

        <form
          onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
          className="p-5 space-y-4"
        >
          {isLoading ? (
            <p className="text-center text-sm text-gray-500 py-8">Chargement...</p>
          ) : !configData ? (
            <p className="text-center text-sm text-red-600 py-8">
              Aucune configuration MECeF trouvée pour cette branche. Contactez un
              administrateur.
            </p>
          ) : (
            <>
              {/* IFU */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  IFU <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  {...register("ifu")}
                  className={inputClass}
                  placeholder="Identifiant Fiscal Unique"
                />
                {errors.ifu && (
                  <p className="mt-1 text-xs text-red-600">{errors.ifu.message}</p>
                )}
              </div>

              {/* Token */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Token <span className="text-red-500">*</span>
                </label>
                <textarea
                  {...register("token")}
                  rows={5}
                  className={inputClass}
                  placeholder="Token MECeF e-mercef"
                />
                {errors.token && (
                  <p className="mt-1 text-xs text-red-600">{errors.token.message}</p>
                )}
              </div>

              {/* Status (toggle) */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Activé
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={status}
                    onChange={(e) => setValue("status", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  <span className="ml-3 text-sm font-medium text-gray-700">
                    {status ? "Activé" : "Désactivé"}
                  </span>
                </label>
              </div>

              {/* Bouton submit */}
              <div className="flex justify-end pt-3 border-t border-gray-200">
                <Button type="submit" size="sm" loading={updateMutation.isPending}>
                  {updateMutation.isPending ? "Enregistrement..." : "Mettre à jour"}
                </Button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
