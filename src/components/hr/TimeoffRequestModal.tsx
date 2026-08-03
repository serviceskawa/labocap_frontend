"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import type { AxiosError } from "axios";

import { CrudModal } from "@/components/common/CrudModal";
import { FormField } from "@/components/ui/FormField";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { LimitedSelect as ReactSelect } from "@/components/ui/LimitedSelect";
import { useUIStore } from "@/stores/ui.store";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { hrApi, type Employee } from "@/lib/api/hr";
import type { ApiError } from "@/types/api";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";


// Calque exact de employee_timeoffs/create2.blade.php (modal global « Ajouter un
// congé »). Le backend Java n'ayant qu'un champ `reason` texte + un statut enum,
// on encode reason = « type — message » et on approuve après coup si « active ».
const schema = z.object({
  employeeId: z.string().min(1, "L'employé est requis"),
  timeoffType: z.string().min(1, "Le type de congé est requis"),
  startDate: z.string().min(1, "La date de début est requise"),
  endDate: z.string().min(1, "La date de fin est requise"),
  status: z.string().min(1, "Le statut est requis"),
  message: z.string().min(1, "Le message est requis"),
});
type FormValues = z.infer<typeof schema>;

/**
 * Modal global de demande de congé, monté dans le layout et ouvrable depuis
 * n'importe quelle page via le bouton « Demande de congé » de la sidebar.
 */
export function TimeoffRequestModal() {
  const { timeoffModalOpen, timeoffPresetEmployeeId, closeTimeoffModal } = useUIStore();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  // Laravel : le statut n'est un select que pour qui peut créer des paies ;
  // sinon champ en lecture seule « Non active » (cf. create2.blade).
  const canSetStatus = can(PERMISSIONS.CREATE_PAYROLL);

  const { data: employeesData } = useQuery({
    queryKey: ["employees"],
    queryFn: () => hrApi.findAll({ size: 200 }).then((r) => r.data),
    enabled: timeoffModalOpen,
  });
  const employees: Employee[] = employeesData?.content ?? [];
  const employeeOptions = employees.map((e) => ({
    value: e.id,
    label: `${e.firstName} ${e.lastName}`,
  }));

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: "",
      timeoffType: "",
      startDate: "",
      endDate: "",
      status: canSetStatus ? "" : "non active",
      message: "",
    },
  });

  // À l'ouverture : réinitialiser, en pré-sélectionnant l'employé s'il est fourni
  // (ex. ouverture depuis une fiche employé).
  useEffect(() => {
    if (timeoffModalOpen) {
      form.reset({
        employeeId: timeoffPresetEmployeeId ?? "",
        timeoffType: "",
        startDate: "",
        endDate: "",
        status: canSetStatus ? "" : "non active",
        message: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeoffModalOpen, timeoffPresetEmployeeId]);

  const createMutation = useMutation({
    mutationFn: async (v: FormValues) => {
      const reason = v.message ? `${v.timeoffType} — ${v.message}` : v.timeoffType;
      const created = await hrApi
        .createTimeOff(v.employeeId, { startDate: v.startDate, endDate: v.endDate, reason })
        .then((r) => r.data);
      if (v.status === "active") {
        await hrApi.updateTimeoffStatus(v.employeeId, created.id, { status: "APPROVED" });
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-timeoffs"] });
      toast.success("Congé ajouté");
      form.reset();
      closeTimeoffModal();
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur lors de l'enregistrement"),
  });

  return (
    <CrudModal
      isOpen={timeoffModalOpen}
      onClose={closeTimeoffModal}
      title="Ajouter un congé"
      contentClassName="max-w-[800px]"
      onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}
      submitLabel="Ajouter un congé"
      isSubmitting={createMutation.isPending}
    >
      <p className="mb-4 text-right">
        <span className="text-red-500">*</span>champs obligatoires
      </p>

      {/* Employé — pleine largeur (col-lg-12) */}
      <div className="mb-4">
        <FormField label="Employé" required error={form.formState.errors.employeeId?.message}>
          <Controller
            name="employeeId"
            control={form.control}
            render={({ field }) => (
              <ReactSelect
                instanceId="timeoff-employee"
                options={employeeOptions}
                value={employeeOptions.find((o) => o.value === field.value) ?? null}
                onChange={(opt) => field.onChange(opt?.value ?? "")}
                placeholder="Selectionner un employé"
                isClearable
                classNamePrefix="react-select"
              />
            )}
          />
        </FormField>
      </div>

      {/* Type de congé | Date de début — puis — Date de fin | status */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Type de congé" required error={form.formState.errors.timeoffType?.message}>
          <input type="text" {...form.register("timeoffType")} className={inputClass} />
        </FormField>
        <FormField label="Date de début" required error={form.formState.errors.startDate?.message}>
          <input type="date" {...form.register("startDate")} className={inputClass} />
        </FormField>
        <FormField label="Date de fin" required error={form.formState.errors.endDate?.message}>
          <input type="date" {...form.register("endDate")} className={inputClass} />
        </FormField>
        <FormField label="status" required error={form.formState.errors.status?.message}>
          {canSetStatus ? (
            <NativeSelect
              value={form.watch("status") ?? ""}
              onChange={(e) =>
                form.setValue("status", e.target.value, { shouldValidate: true })
              }
            >
              <option value="">Selectionner un statut</option>
              <option value="active">Active</option>
              <option value="non active">Non Active</option>
            </NativeSelect>
          ) : (
            <input type="text" readOnly value="Non active" className={inputClass} />
          )}
        </FormField>

        {/* Message — pleine largeur (col-lg-12) */}
        <FormField
          label="Message"
          required
          error={form.formState.errors.message?.message}
          className="sm:col-span-2"
        >
          <textarea rows={3} {...form.register("message")} className={`${inputClass} resize-none`} />
        </FormField>
      </div>
    </CrudModal>
  );
}
