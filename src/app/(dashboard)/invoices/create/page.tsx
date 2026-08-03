"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { FormField } from "@/components/ui/FormField";
import { RemoteSelectField } from "@/components/ui/RemoteSelectField";
import { invoicesApi } from "@/lib/api/invoices";
import { type TestOrder } from "@/lib/api/testOrders";
import {
  loadTestOrderOptions,
  testOrderToOption,
  type TestOrderOption,
} from "@/lib/api/optionLoaders";
import type { ApiError } from "@/types/api";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const createInvoiceSchema = z.object({
  testOrderId: z.string().min(1, "La demande d'examen est requise"),
  date: z.string().min(1, "La date est requise"),
});

type CreateInvoiceFormValues = z.infer<typeof createInvoiceSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


const loadPendingOrders = loadTestOrderOptions({ status: "PENDING" });
const loadValidatedOrders = loadTestOrderOptions({ status: "VALIDATED" });

/**
 * Demandes facturables : en attente **ou** validées. La recherche part au
 * serveur pour chacun des deux statuts (l'API n'en accepte qu'un à la fois),
 * donc elle couvre les 14 000 demandes et pas une page préchargée.
 */
const loadInvoiceableOrders = (input: string): Promise<TestOrderOption[]> =>
  Promise.all([loadPendingOrders(input), loadValidatedOrders(input)]).then(
    ([pending, validated]) => [...pending, ...validated]
  );

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InvoiceCreatePage() {
  const router = useRouter();

  const [selectedOrder, setSelectedOrder] = useState<TestOrder | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const {
    handleSubmit,
    control,
    register,
    formState: { errors },
  } = useForm<CreateInvoiceFormValues>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: {
      testOrderId: "",
      date: today,
    },
  });

  // --- Mutation création
  const createMutation = useMutation({
    mutationFn: (data: CreateInvoiceFormValues) =>
      invoicesApi.create({
        testOrderId: data.testOrderId,
        patientId: selectedOrder!.patientId,
        date: data.date,
      }),
    onSuccess: () => {
      toast.success("Opération effectuée avec succès !");
      router.push("/invoices");
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la création de la facture"
      );
    },
  });

  const onSubmit = (data: CreateInvoiceFormValues) => {
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nouvelle facture"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Factures", href: "/invoices" },
          { label: "Nouvelle facture" },
        ]}
      />

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {/* 1. Demande d'examen */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Demande d&apos;examen <span className="text-red-500">*</span>
              </label>
              <Controller
                name="testOrderId"
                control={control}
                render={({ field }) => (
                  <RemoteSelectField<TestOrderOption>
                    id="testOrderId"
                    loadOptions={loadInvoiceableOrders}
                    value={field.value || null}
                    onChange={(v, opt) => {
                      field.onChange(v ?? "");
                      setSelectedOrder(opt?.order ?? null);
                    }}
                    selectedOption={
                      selectedOrder ? testOrderToOption(selectedOrder) : null
                    }
                    placeholder="Rechercher une demande (code, patient)…"
                    isClearable
                  />
                )}
              />
              {errors.testOrderId && (
                <p className="text-xs text-red-500">
                  {errors.testOrderId.message}
                </p>
              )}

              {/* Info patient dérivé */}
              {selectedOrder && (
                <p className="mt-1 text-sm text-gray-500">
                  Patient :{" "}
                  <span className="font-medium text-gray-700">
                    {selectedOrder.patientFirstname} {selectedOrder.patientLastname}
                  </span>
                </p>
              )}
            </div>

            {/* 2. Date */}
            <div className="flex flex-col gap-1">
              <FormField
                label="Date"
                required
                error={errors.date?.message}
              >
                <input
                  type="date"
                  {...register("date")}
                  className={inputClass}
                />
              </FormField>
            </div>
          </div>

          {/* Boutons */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Créer une nouvelle facture
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
