"use client";

import { formatCFA } from "@/lib/utils";

import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CornerUpLeft } from "lucide-react";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { RHFSelect } from "@/components/ui/RHFSelect";
import { RemoteSelectField } from "@/components/ui/RemoteSelectField";
import { MAX_VISIBLE_OPTIONS } from "@/components/ui/LimitedSelect";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { refundsApi, refundReasonsApi, type RefundReason } from "@/lib/api/refunds";
import { invoicesApi, type Invoice } from "@/lib/api/invoices";
import { Button } from "@/components/ui/Button";
import { applyFieldErrors } from "@/lib/api/errorMessages";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

// ---------------------------------------------------------------------------
// Calque `errors_reports/refund/create.blade.php` — page dédiée, pas un modal.
// ---------------------------------------------------------------------------

const schema = z.object({
  refundReasonId: z.string().min(1, "Sélectionner une raison"),
  invoiceId: z.string().min(1, "Sélectionner la facture de référence"),
  montant: z.string().min(1, "Le montant est requis"),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;


function formatAmount(amount: number): string {
  return formatCFA(amount);
}

/**
 * Laravel n'offre que les factures de vente déjà payées
 * (`paid = 1 AND status_invoice = 0`) : jamais un avoir, jamais un impayé.
 */
const loadInvoiceOptions = (input: string) =>
  invoicesApi
    .findAll({
      size: MAX_VISIBLE_OPTIONS,
      search: input || undefined,
      paid: true,
      statusInvoice: 0,
    })
    .then((r) =>
      r.data.content.map((inv: Invoice) => ({
        value: inv.id,
        label: `${inv.code} — ${formatAmount(inv.total)}${
          inv.patientName ? ` (${inv.patientName})` : ""
        }`,
      })),
    );

export default function RefundCreatePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { refundReasonId: "", invoiceId: "", montant: "", note: "" },
  });

  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const { data: reasonsData } = useQuery({
    queryKey: ["refund-reasons"],
    queryFn: () => refundReasonsApi.findAll().then((r) => r.data),
  });
  const reasons: RefundReason[] = Array.isArray(reasonsData) ? reasonsData : [];

  // Facture sélectionnée : sert au pré-remplissage et au plafond de montant.
  const invoiceId = watch("invoiceId");
  const { data: selectedInvoice } = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: () => invoicesApi.findById(invoiceId).then((r) => r.data),
    enabled: !!invoiceId,
  });

  // Laravel pré-remplit montant et description au choix de la facture.
  function onInvoiceChange(id: string | null) {
    setValue("invoiceId", id ?? "", { shouldValidate: true });
    if (!id) return;
    invoicesApi.findById(id).then((r) => {
      const inv = r.data;
      setValue("montant", String(inv.total ?? ""));
      setValue("note", `Une demande de remboursement pour la facture ${inv.code}`);
    });
  }

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      refundsApi.create({
        invoiceId: values.invoiceId,
        refundReasonId: values.refundReasonId,
        montant: Number(values.montant),
        note: values.note || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["refunds"] });
      queryClient.invalidateQueries({ queryKey: ["refund-pending-count"] });
      toast.success("Demande enregistrée avec success");
      router.push("/refunds");
    },
    onError: (err: AxiosError) => {
      if (!applyFieldErrors(err as never, form.setError as (n: string, e: { type: string; message: string }) => void)) {
        toast.error(
          (err.response?.data as { message?: string })?.message ??
            "Un problème est survenu lors de l'enregistrement",
        );
      }
    },
  });

  function onSubmit(values: FormValues) {
    // Laravel refuse un montant supérieur au total de la facture.
    const total = selectedInvoice?.total;
    if (total != null && Number(values.montant) > total) {
      toast.error("Le montant saisi est supérieur total de la facture");
      return;
    }
    createMutation.mutate(values);
  }

  return (
    <PermissionGate permission={PERMISSIONS.CREATE_REFUNDS}>
      <div className="space-y-6">
        <PageHeader
          title="Ajouter une demande de remboursements"
          action={
            <button
              type="button"
              onClick={() => router.push("/refunds")}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <CornerUpLeft className="h-4 w-4" />
              Retour
            </button>
          }
        />

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="rounded-xl border border-gray-200 bg-white shadow-sm"
        >
          <div className="space-y-4 p-5">
            <p className="text-right text-sm text-gray-600">
              <span className="text-red-600">*</span>champs obligatoires
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <RHFSelect
                control={control}
                name="refundReasonId"
                label="Raison de la demande"
                required
                options={reasons.map((r) => ({ value: r.id, label: r.label }))}
                placeholder="Sélectionner une raison"
                error={errors.refundReasonId?.message}
              />

              <Controller
                control={control}
                name="invoiceId"
                render={({ field }) => (
                  <RemoteSelectField
                    label="Facture de référence"
                    required
                    value={field.value}
                    onChange={onInvoiceChange}
                    loadOptions={loadInvoiceOptions}
                    placeholder="Sélectionner la facture"
                    error={errors.invoiceId?.message}
                  />
                )}
              />

              <FormField label="Montant" required error={errors.montant?.message}>
                <input type="number" {...register("montant")} className={inputClass} />
              </FormField>
            </div>

            <FormField label="Description" error={errors.note?.message}>
              <textarea {...register("note")} rows={6} className={inputClass} />
            </FormField>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-4">
            <button
              type="button"
              onClick={() => form.reset()}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Annuler
            </button>
            <Button
              type="submit"
              loading={createMutation.isPending}
              className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
            >
              Demander un remboursement
            </Button>
          </div>
        </form>
      </div>
    </PermissionGate>
  );
}
