"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Trash2, Eye } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";
import type { UseFormReturn } from "react-hook-form";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTableCard } from "@/components/common/DataTableCard";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { IconButton } from "@/components/ui/IconButton";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { hrApi, Employee, EmployeeRequest } from "@/lib/api/hr";
import { usersApi, User } from "@/lib/api/users";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";
import { nomComplet } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Zod — calque du formulaire Laravel employees/create (Nom, Prénoms, Email,
// Téléphone, Utilisateur). Pas de salaire/poste ici (édités via la fiche).
// ---------------------------------------------------------------------------

const employeeSchema = z.object({
  firstName: z.string().min(1, "Le nom est requis"),
  lastName: z.string().min(1, "Les prénoms sont requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().optional(),
  userId: z.string().optional(),
});

type EmployeeFormValues = z.infer<typeof employeeSchema>;


function buildPayload(values: EmployeeFormValues): EmployeeRequest {
  return {
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email || undefined,
    phone: values.phone || undefined,
    userId: values.userId || undefined,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EmployeesPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: () => hrApi.findAll({ size: 1000 }).then((r) => r.data),
  });

  const employees: Employee[] = useMemo(
    () => data?.content ?? [],
    [data?.content]
  );

  const { data: usersData } = useQuery({
    queryKey: ["users", "for-employee-select"],
    queryFn: () => usersApi.findAll({ size: 1000 }).then((r) => r.data),
    enabled: createOpen,
  });
  const users: User[] = usersData?.content ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: EmployeeRequest) => hrApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employé créé");
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => hrApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employé supprimé");
      setDeleteOpen(false);
      setSelectedEmployee(null);
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  const createForm = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      userId: "",
    },
  });

  function openDelete(employee: Employee) {
    setSelectedEmployee(employee);
    setDeleteOpen(true);
  }

  function onCreateSubmit(values: EmployeeFormValues) {
    createMutation.mutate(buildPayload(values));
  }

  // ---- Colonnes (calque employees/index Laravel) --------------------------

  const columns: ColumnDef<Employee>[] = [
    {
      header: "#",
      id: "rownum",
      cell: ({ row }) => row.index + 1,
    },
    {
      header: "Nom & Prénoms",
      id: "fullname",
      cell: ({ row }) => (
        <span className="font-medium text-gray-900">
          {row.original.firstName} {row.original.lastName}
        </span>
      ),
    },
    {
      header: "Contacts",
      id: "contacts",
      cell: ({ row }) => (
        <div className="leading-tight">
          <p className="m-0">{row.original.phone ?? "—"}</p>
          <p className="m-0 text-gray-500">{row.original.email ?? "—"}</p>
        </div>
      ),
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Link href={`/hr/employees/${row.original.id}`} title="Voir le profil">
            <IconButton
              variant="view"
              aria-label="Voir le profil"
              icon={<Eye className="h-4 w-4" />}
            />
          </Link>
          <PermissionGate permission={PERMISSIONS.DELETE_EMPLOYEES}>
            <IconButton
              variant="delete"
              title="Supprimer"
              aria-label="Supprimer"
              onClick={() => openDelete(row.original)}
              icon={<Trash2 className="h-4 w-4" />}
            />
          </PermissionGate>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employés"
        action={
          can(PERMISSIONS.CREATE_EMPLOYEES) ? (
            <button
              onClick={() => {
                createForm.reset();
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-[.15rem] bg-blue-600 px-[.9rem] py-[.45rem] text-[.9rem] font-normal text-white transition-[background-color,box-shadow] hover:shadow-[0_2px_6px_0_rgba(114,124,245,0.5)]"
            >
              Ajouter un nouveau employé
            </button>
          ) : undefined
        }
      />

      <DataTableCard columns={columns} data={employees} isLoading={isLoading} />

      {/* ---- Modal création (calque employees/create Laravel) ---- */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Ajouter un nouveau employé"
        size="lg"
        onSubmit={createForm.handleSubmit(onCreateSubmit)}
        submitLabel="Ajouter un nouveau employé"
        isSubmitting={createMutation.isPending}
      >
        <EmployeeForm form={createForm} users={users} />
      </CrudModal>

      {/* ---- Modal confirmation suppression ---- */}
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setSelectedEmployee(null);
        }}
        onConfirm={() => {
          if (selectedEmployee) deleteMutation.mutate(selectedEmployee.id);
        }}
        title="Supprimer cet employé"
        message={`Voulez-vous vraiment supprimer l'employé "${selectedEmployee?.firstName ?? ""} ${selectedEmployee?.lastName ?? ""}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmployeeForm — calque employees/create.blade (Nom, Prénoms, Email,
// Téléphone, Utilisateur). Note obligatoire en tête, comme Laravel.
// ---------------------------------------------------------------------------

interface EmployeeFormProps {
  form: UseFormReturn<EmployeeFormValues>;
  users: User[];
}

function EmployeeForm({ form, users }: EmployeeFormProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="grid grid-cols-1 gap-4">
      <p className="m-0 text-right text-xs text-red-600">*champs obligatoires</p>

      <FormField label="Nom" required error={errors.firstName?.message}>
        <input type="text" {...register("firstName")} className={inputClass} />
      </FormField>

      <FormField label="Prénoms" required error={errors.lastName?.message}>
        <input type="text" {...register("lastName")} className={inputClass} />
      </FormField>

      <FormField label="Email" error={errors.email?.message}>
        <input type="email" {...register("email")} className={inputClass} />
      </FormField>

      <FormField label="Téléphone" error={errors.phone?.message}>
        <input type="tel" {...register("phone")} className={inputClass} />
      </FormField>

      {/* Liste alimentée par la table des utilisateurs : `NativeSelect` la rend
          cherchable, un `<select>` natif obligeait à faire défiler des centaines
          de comptes. */}
      <FormField label="Utilisateur" error={errors.userId?.message}>
        <NativeSelect
          value={form.watch("userId") ?? ""}
          onChange={(e) => form.setValue("userId", e.target.value)}
          placeholder="Associer à un utilisateur"
        >
          <option value="">Associer à un utilisateur</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {nomComplet(u.lastname, u.firstname)}
            </option>
          ))}
        </NativeSelect>
      </FormField>
    </div>
  );
}
