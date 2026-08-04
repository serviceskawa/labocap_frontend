"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import { Loader2 } from "lucide-react";
import { LimitedSelect as ReactSelect } from "@/components/ui/LimitedSelect";

import { hrApi } from "@/lib/api/hr";
import { macroscopyApi } from "@/lib/api/macroscopy";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectField } from "@/components/ui/SelectField";
import { SELECT_CONTROL_MIN_HEIGHT } from "@/components/ui/selectStyles";

// ---------------------------------------------------------------------------
// Page — Ajouter une macroscopie (réplique exact du formulaire Laravel)
// ---------------------------------------------------------------------------

export default function AddMacroscopyPage() {
  const router = useRouter();

  const today = new Date().toISOString().split("T")[0];

  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(today);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // ---- Employés (laborantins)
  const { data: employeesData } = useQuery({
    queryKey: ["employees-macro"],
    queryFn: () => hrApi.findAll({ size: 200 }).then((r) => r.data),
  });
  const employees = employeesData?.content ?? [];

  // ---- Demandes d'examen disponibles (VALIDATED et sans macro)
  const { data: pendingRaw } = useQuery({
    queryKey: ["macros-pending"],
    queryFn: () =>
      macroscopyApi.getPending().then((r) =>
        Array.isArray(r.data) ? r.data : (r.data as { content?: unknown[] })?.content ?? []
      ),
  });
  const pendingOrders = Array.isArray(pendingRaw) ? pendingRaw : [];

  // ---- Mutation : assigner une macro par bon (boucle comme Laravel)
  const mutation = useMutation({
    mutationFn: async () => {
      if (!employeeId) throw new Error("Sélectionnez un laborantin");
      if (selectedOrderIds.length === 0)
        throw new Error("Sélectionnez au moins une demande d'examen");

      // Comme Laravel : crée une macro par commande
      for (const testOrderId of selectedOrderIds) {
        await macroscopyApi.assign({
          testOrderId,
          employeeId,
          macroDate: date || today,
        });
      }
    },
    onSuccess: () => {
      toast.success("Macroscopie(s) ajoutée(s) avec succès");
      router.push("/test-orders/macroscopy");
    },
    onError: (err: AxiosError<{ message?: string }> | Error) => {
      const msg =
        (err as AxiosError<{ message?: string }>).response?.data?.message ??
        err.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Macroscopie"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Macroscopie", href: "/test-orders/macroscopy" },
          { label: "Ajouter" },
        ]}
      />

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* En-tête carte */}
        <div className="border-b border-gray-200 px-5 py-3">
          <h5 className="font-medium text-gray-800">Ajouter une macroscopie</h5>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 gap-5">

            {/* Laborantins — requis */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Laborantins <span className="text-red-500">*</span>
              </label>
              <SelectField
                options={employees.map((emp) => {
                  // L'API backend renvoie firstName/lastName (camelCase),
                  // mais l'interface TS peut différer — on lit les deux pour robustesse.
                  const e = emp as unknown as {
                    firstName?: string;
                    lastName?: string;
                    firstname?: string;
                    lastname?: string;
                  };
                  const fn = e.firstName ?? e.firstname ?? "";
                  const ln = e.lastName ?? e.lastname ?? "";
                  return { value: emp.id, label: `${fn} ${ln}`.trim() };
                })}
                value={employeeId || null}
                onChange={(v) => setEmployeeId(v ?? "")}
                placeholder="Sélectionner un laborantin"
              />
            </div>

            {/* Date */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Demandes d'examen — multi-select avec recherche (équivalent select2) */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Demandes d&apos;examen <span className="text-red-500">*</span>
              </label>
              {(() => {
                const orders = pendingOrders as Array<{
                  id: string;
                  code: string;
                  patientName: string;
                  isUrgent: boolean;
                }>;
                const orderOptions = orders.map((o) => ({
                  value: o.id,
                  label: o.code ?? "(sans code)",
                  patientName: o.patientName,
                  isUrgent: o.isUrgent,
                }));
                type OrderOption = (typeof orderOptions)[number];
                return (
                  <ReactSelect<OrderOption, true>
                    instanceId="macroscopy-test-orders"
                    isMulti
                    options={orderOptions}
                    value={orderOptions.filter((o) =>
                      selectedOrderIds.includes(o.value)
                    )}
                    onChange={(selected) =>
                      setSelectedOrderIds(selected.map((s) => s.value))
                    }
                    placeholder="Sélectionner les demandes"
                    noOptionsMessage={() =>
                      "Aucune demande disponible (toutes les demandes validées ont déjà une macroscopie)"
                    }
                    classNamePrefix="react-select"
                    formatOptionLabel={(option) => (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{option.label}</span>
                        {option.patientName && (
                          <span className="text-xs text-gray-500">
                            — {option.patientName}
                          </span>
                        )}
                        {option.isUrgent && (
                          <span className="ml-auto text-xs bg-red-700 text-white px-1.5 py-0.5 rounded">
                            Urgent
                          </span>
                        )}
                      </div>
                    )}
                    styles={{
                      control: (base) => ({
                        ...base,
                        borderColor: "#d1d5db",
                        borderRadius: "0.375rem",
                        minHeight: `${SELECT_CONTROL_MIN_HEIGHT}px`,
                        boxShadow: "none",
                        "&:hover": { borderColor: "#d1d5db" },
                      }),
                      menu: (base) => ({ ...base, zIndex: 50 }),
                    }}
                  />
                );
              })()}
            </div>

          </div>
        </div>

        {/* Footer — boutons identiques Laravel */}
        <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
          <button
            type="button"
            onClick={() => router.push("/test-orders/macroscopy")}
            className="inline-flex items-center rounded px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 rounded px-4 py-2 text-sm font-medium bg-yellow-500 text-white hover:bg-yellow-600 transition-colors disabled:opacity-50"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {mutation.isPending ? "Enregistrement..." : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}
