"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { FileText, Loader2, Pencil, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";
import type { UseFormReturn } from "react-hook-form";
import { LimitedSelect as ReactSelect } from "@/components/ui/LimitedSelect";

import { PageHeader } from "@/components/ui/PageHeader";
import { RHFSelect } from "@/components/ui/RHFSelect";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { DataTable } from "@/components/common/DataTable";
import {
  RowActions,
  RowActionsProvider,
} from "@/components/ui/RowActions";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { FormField } from "@/components/ui/FormField";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { hrApi, Payroll, PayrollRequest, Employee } from "@/lib/api/hr";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

// ---------------------------------------------------------------------------
// Zod schema — aligné sur EmployeePayrollRequestDto
// month et year sont des entiers, grossSalary est obligatoire
// ---------------------------------------------------------------------------

const payrollSchema = z.object({
  employeeId: z.string().min(1, "L'employé est requis"),
  month: z.string().min(1, "Le mois est requis"),
  year: z.string().min(1, "L'année est requise"),
  grossSalary: z.string().min(1, "Le salaire brut est requis"),
  deductions: z.string().optional(),
  paidAt: z.string().optional(),
});

type PayrollFormValues = z.infer<typeof payrollSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


function formatAmount(amount?: number): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";
}

const MONTHS = [
  { value: "1", label: "Janvier" },
  { value: "2", label: "Février" },
  { value: "3", label: "Mars" },
  { value: "4", label: "Avril" },
  { value: "5", label: "Mai" },
  { value: "6", label: "Juin" },
  { value: "7", label: "Juillet" },
  { value: "8", label: "Août" },
  { value: "9", label: "Septembre" },
  { value: "10", label: "Octobre" },
  { value: "11", label: "Novembre" },
  { value: "12", label: "Décembre" },
];

function monthLabel(month: number): string {
  return MONTHS.find((m) => m.value === String(month))?.label ?? String(month);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PayrollPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);

  // Filtres
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("");
  const [editing, setEditing] = useState<Payroll | null>(null);
  const [deleting, setDeleting] = useState<Payroll | null>(null);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // ---- Queries & Mutations ------------------------------------------------

  const { data: employeesData } = useQuery({
    queryKey: ["employees"],
    queryFn: () => hrApi.findAll({ size: 200 }).then((r) => r.data),
  });

  const employees: Employee[] = employeesData?.content ?? [];

  const employeeOptions = employees.map((e) => ({
    value: e.id,
    label: `${e.firstName} ${e.lastName}`,
  }));

  const { data: payrollData, isLoading } = useQuery({
    queryKey: ["payrolls", selectedEmployeeId],
    queryFn: () =>
      hrApi.getPayrolls(selectedEmployeeId, { size: 200 }).then((r) => r.data),
    enabled: !!selectedEmployeeId,
  });

  const payrolls: Payroll[] = useMemo(
    () => payrollData?.content ?? [],
    [payrollData?.content]
  );

  // Fiches filtrées
  const filtered = useMemo(() => {
    return payrolls.filter((p) => {
      const matchMonth = !filterMonth || String(p.month) === filterMonth;
      const matchYear = !filterYear || String(p.year) === filterYear;
      return matchMonth && matchYear;
    });
  }, [payrolls, filterMonth, filterYear]);

  const generateMutation = useMutation({
    mutationFn: ({
      employeeId,
      payload,
    }: {
      employeeId: string;
      payload: PayrollRequest;
    }) => hrApi.createPayroll(employeeId, payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["payrolls", vars.employeeId] });
      toast.success("Fiche de paie générée");
      setCreateOpen(false);
      createForm.reset();
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  // Correction d'une fiche existante — route Laravel `employee.payroll.update`,
  // qui n'avait pas d'équivalent : une fiche erronée était définitive.
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PayrollRequest }) =>
      hrApi.updatePayroll(selectedEmployeeId, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payrolls", selectedEmployeeId] });
      toast.success("Fiche de paie mise à jour");
      setEditing(null);
    },
    onError: (err: AxiosError) => {
      toast.error(
        (err.response?.data as { message?: string })?.message ??
          "Une erreur est survenue",
      );
    },
  });

  // Suppression — route Laravel `employee.payroll.delete`.
  const deleteMutation = useMutation({
    mutationFn: (id: string) => hrApi.deletePayroll(selectedEmployeeId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payrolls", selectedEmployeeId] });
      toast.success("Fiche de paie supprimée");
      setDeleting(null);
    },
    onError: (err: AxiosError) => {
      toast.error(
        (err.response?.data as { message?: string })?.message ??
          "Une erreur est survenue",
      );
    },
  });

  // ---- Forms ---------------------------------------------------------------

  const createForm = useForm<PayrollFormValues>({
    resolver: zodResolver(payrollSchema),
    defaultValues: {
      employeeId: "",
      month: String(new Date().getMonth() + 1),
      year: String(currentYear),
      grossSalary: "",
      deductions: "",
      paidAt: "",
    },
  });

  const editForm = useForm<PayrollFormValues>({
    resolver: zodResolver(payrollSchema),
    defaultValues: {
      employeeId: "",
      month: "",
      year: "",
      grossSalary: "",
      deductions: "",
      paidAt: "",
    },
  });

  /** Ouvre la modale d'édition pré-remplie avec la fiche choisie. */
  function openEdit(payroll: Payroll) {
    editForm.reset({
      employeeId: selectedEmployeeId,
      month: String(payroll.month),
      year: String(payroll.year),
      grossSalary: String(payroll.grossSalary ?? ""),
      deductions: payroll.deductions != null ? String(payroll.deductions) : "",
      paidAt: payroll.paidAt ? payroll.paidAt.slice(0, 10) : "",
    });
    setEditing(payroll);
  }

  function onEditSubmit(values: PayrollFormValues) {
    if (!editing) return;
    updateMutation.mutate({
      id: editing.id,
      payload: {
        month: Number(values.month),
        year: Number(values.year),
        grossSalary: Number(values.grossSalary),
        deductions:
          values.deductions === "" || values.deductions === undefined
            ? undefined
            : Number(values.deductions),
        paidAt: values.paidAt || undefined,
      },
    });
  }

  // ---- Handlers ------------------------------------------------------------

  // Téléchargement / affichage du PDF de la fiche de paie
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);

  async function handleDownloadPdf(payroll: Payroll) {
    setPdfLoadingId(payroll.id);
    try {
      const res = await hrApi.downloadPayrollPdf(
        selectedEmployeeId,
        payroll.id,
      );
      const blob = new Blob([res.data as BlobPart], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setPdfLoadingId(null);
    }
  }

  function onCreateSubmit(values: PayrollFormValues) {
    generateMutation.mutate({
      employeeId: values.employeeId,
      payload: {
        month: Number(values.month),
        year: Number(values.year),
        grossSalary: Number(values.grossSalary),
        deductions:
          values.deductions === "" || values.deductions === undefined
            ? undefined
            : Number(values.deductions),
        paidAt: values.paidAt || undefined,
      },
    });
  }

  // ---- Columns -------------------------------------------------------------

  const columns: ColumnDef<Payroll>[] = [
    {
      header: "Mois / Année",
      id: "period",
      cell: ({ row }) =>
        `${monthLabel(row.original.month)} ${row.original.year}`,
    },
    {
      header: "Salaire brut",
      accessorKey: "grossSalary",
      cell: ({ row }) => formatAmount(row.original.grossSalary),
    },
    {
      header: "Déductions",
      accessorKey: "deductions",
      cell: ({ row }) => formatAmount(row.original.deductions),
    },
    {
      header: "Salaire net",
      accessorKey: "netSalary",
      cell: ({ row }) => (
        <span className="font-semibold text-gray-900">
          {formatAmount(row.original.netSalary)}
        </span>
      ),
    },
    {
      header: "Date paiement",
      accessorKey: "paidAt",
      cell: ({ row }) =>
        row.original.paidAt
          ? new Date(row.original.paidAt).toLocaleDateString("fr-FR")
          : "—",
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => {
        const fiche = row.original;
        if (!can(PERMISSIONS.MANAGE_PAYROLL)) return null;

        const chargement = pdfLoadingId === fiche.id;
        return (
          <RowActions
            actions={[
              {
                label: "Voir / télécharger la fiche de paie (PDF)",
                icon: chargement ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileText className="h-3.5 w-3.5" />
                ),
                onClick: () => handleDownloadPdf(fiche),
                disabled: chargement,
              },
              {
                label: "Modifier",
                icon: <Pencil className="h-3.5 w-3.5" />,
                variant: "edit",
                onClick: () => openEdit(fiche),
              },
              {
                label: "Supprimer",
                icon: <Trash2 className="h-3.5 w-3.5" />,
                variant: "delete",
                onClick: () => setDeleting(fiche),
              },
            ]}
          />
        );
      },
    },
  ];

  // ---- Render --------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paie"
        action={
          can(PERMISSIONS.MANAGE_PAYROLL) ? (
            <button
              onClick={() => {
                createForm.reset();
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Générer fiche de paie
            </button>
          ) : undefined
        }
      />

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="min-w-[220px]">
          <ReactSelect
            instanceId="payroll-filter-employee"
            options={employeeOptions}
            value={employeeOptions.find((o) => o.value === selectedEmployeeId) ?? null}
            onChange={(opt) => setSelectedEmployeeId(opt?.value ?? "")}
            placeholder="Sélectionner un employé..."
            isClearable
            classNamePrefix="react-select"
          />
        </div>

        <NativeSelect
          className="w-full max-w-[180px]"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
        >
          <option value="">Tous les mois</option>
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </NativeSelect>

        <NativeSelect
          className="w-full max-w-[140px]"
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
        >
          <option value="">Toutes les années</option>
          {yearOptions.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NativeSelect>
      </div>

      {!selectedEmployeeId && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-gray-500">
            Sélectionnez un employé pour afficher ses fiches de paie.
          </p>
        </div>
      )}

      {selectedEmployeeId && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          {/* Trois actions : le tableau replie uniformément. */}
          <RowActionsProvider collapse>
            <DataTable columns={columns} data={filtered} isLoading={isLoading} />
          </RowActionsProvider>
        </div>
      )}

      {/* ---- Modal génération fiche de paie ---- */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Générer une fiche de paie"
        size="lg"
        onSubmit={createForm.handleSubmit(onCreateSubmit)}
        submitLabel="Générer"
        isSubmitting={generateMutation.isPending}
      >
        <PayrollForm
          form={createForm}
          employeeOptions={employeeOptions}
          yearOptions={yearOptions}
        />
      </CrudModal>

      {/* ---- Modal correction d'une fiche de paie ---- */}
      <CrudModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title="Modifier la fiche de paie"
        size="lg"
        onSubmit={editForm.handleSubmit(onEditSubmit)}
        submitLabel="Enregistrer"
        isSubmitting={updateMutation.isPending}
      >
        <PayrollForm
          form={editForm}
          employeeOptions={employeeOptions}
          yearOptions={yearOptions}
          employeeLocked
        />
      </CrudModal>

      {/* ---- Confirmation de suppression ---- */}
      <ConfirmModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        title="Supprimer cette fiche de paie"
        message={
          deleting
            ? `La fiche ${monthLabel(deleting.month)} ${deleting.year} sera définitivement supprimée.`
            : ""
        }
        confirmLabel="Supprimer"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PayrollForm — formulaire génération fiche de paie
// ---------------------------------------------------------------------------

interface EmployeeOption {
  value: string;
  label: string;
}

interface PayrollFormProps {
  form: UseFormReturn<PayrollFormValues>;
  employeeOptions: EmployeeOption[];
  yearOptions: number[];
  /** En correction, la fiche reste attachée à son employé : le champ est figé. */
  employeeLocked?: boolean;
}

function PayrollForm({
  form,
  employeeOptions,
  yearOptions,
  employeeLocked = false,
}: PayrollFormProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <div className="grid grid-cols-1 gap-4">
      <FormField
        label="Employé"
        required
        error={errors.employeeId?.message}
        className="sm:col-span-2"
      >
        <Controller
          name="employeeId"
          control={control}
          render={({ field }) => (
            <ReactSelect
              instanceId="payroll-form-employee"
              options={employeeOptions}
              value={employeeOptions.find((o) => o.value === field.value) ?? null}
              onChange={(opt) => field.onChange(opt?.value ?? "")}
              placeholder="Sélectionner un employé..."
              isClearable={!employeeLocked}
              isDisabled={employeeLocked}
              classNamePrefix="react-select"
            />
          )}
        />
      </FormField>

      <RHFSelect
        control={control}
        name="month"
        label="Mois"
        required
        options={MONTHS}
        placeholder="Sélectionner un mois..."
        error={errors.month?.message}
      />

      <RHFSelect
        control={control}
        name="year"
        label="Année"
        required
        options={yearOptions.map((y) => ({ value: String(y), label: String(y) }))}
        placeholder="Sélectionner une année..."
        error={errors.year?.message}
      />

      <FormField label="Salaire brut (FCFA)" required error={errors.grossSalary?.message}>
        <input
          type="number"
          {...register("grossSalary")}
          placeholder="Ex : 150000"
          min={0}
          className={inputClass}
        />
      </FormField>

      <FormField label="Déductions (FCFA)" error={errors.deductions?.message}>
        <input
          type="number"
          {...register("deductions")}
          placeholder="0"
          min={0}
          className={inputClass}
        />
      </FormField>

      <FormField label="Date de paiement" error={errors.paidAt?.message} className="sm:col-span-2">
        <input
          type="date"
          {...register("paidAt")}
          className={inputClass}
        />
      </FormField>
    </div>
  );
}
