"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Trash2, Search } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { IconButton } from "@/components/ui/IconButton";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { doctorsApi, Doctor, DoctorRequest } from "@/lib/api/doctors";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const doctorSchema = z.object({
  name: z.string().min(1, "Le nom complet est requis"),
  telephone: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  commission: z
    .string()
    .optional()
    .refine((v) => v === undefined || v === "" || Number(v) >= 0, {
      message: "La commission ne peut pas être négative",
    }),
});

type DoctorFormValues = z.infer<typeof doctorSchema>;

// ---------------------------------------------------------------------------
// Input style helper
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DoctorsPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);

  // ---- Pagination + recherche
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // ---- Queries & Mutations ------------------------------------------------

  const { data, isLoading } = useQuery({
    queryKey: ["doctors", { page, pageSize }],
    queryFn: () =>
      doctorsApi.findAll({ page, size: pageSize }).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  const allDoctors: Doctor[] = useMemo(
    () => data?.content ?? [],
    [data?.content]
  );

  // Filtrage local (recherche dans la page courante)
  const doctors = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allDoctors;
    return allDoctors.filter(
      (d) =>
        (d.name ?? "").toLowerCase().includes(q) ||
        (d.telephone ?? "").toLowerCase().includes(q) ||
        (d.email ?? "").toLowerCase().includes(q) ||
        (d.role ?? "").toLowerCase().includes(q),
    );
  }, [allDoctors, search]);

  const totalElements = data?.totalElements ?? 0;
  const totalPages = data?.totalPages ?? 0;

  const createMutation = useMutation({
    mutationFn: (payload: DoctorRequest) => doctorsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      toast.success("Médecin créé");
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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: DoctorRequest }) =>
      doctorsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      toast.success("Médecin modifié");
      setEditOpen(false);
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => doctorsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      toast.success("Médecin supprimé");
      setDeleteOpen(false);
      setSelectedDoctor(null);
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  // ---- Forms ---------------------------------------------------------------

  const createForm = useForm<DoctorFormValues>({
    resolver: zodResolver(doctorSchema),
    defaultValues: {
      name: "",
      telephone: "",
      email: "",
      commission: undefined,
    },
  });

  const editForm = useForm<DoctorFormValues>({
    resolver: zodResolver(doctorSchema),
  });

  // ---- Handlers ------------------------------------------------------------

  function openEdit(doctor: Doctor) {
    setSelectedDoctor(doctor);
    editForm.reset({
      name: doctor.name,
      telephone: doctor.telephone ?? "",
      email: doctor.email ?? "",
      commission: doctor.commission != null ? String(doctor.commission) : "",
    });
    setEditOpen(true);
  }

  function openDelete(doctor: Doctor) {
    setSelectedDoctor(doctor);
    setDeleteOpen(true);
  }

  function onCreateSubmit(values: DoctorFormValues) {
    const payload: DoctorRequest = {
      name: values.name,
      telephone: values.telephone || undefined,
      email: values.email || undefined,
      commission:
        values.commission === "" || values.commission === undefined
          ? undefined
          : Number(values.commission),
    };
    createMutation.mutate(payload);
  }

  function onEditSubmit(values: DoctorFormValues) {
    if (!selectedDoctor) return;
    const payload: DoctorRequest = {
      name: values.name,
      telephone: values.telephone || undefined,
      email: values.email || undefined,
      commission:
        values.commission === "" || values.commission === undefined
          ? undefined
          : Number(values.commission),
    };
    updateMutation.mutate({ id: selectedDoctor.id, data: payload });
  }

  // ---- Columns -------------------------------------------------------------

  const columns: ColumnDef<Doctor>[] = [
    {
      header: "Nom & Prénoms",
      accessorKey: "name",
      enableSorting: true,
      cell: ({ row }) => row.original.name,
    },
    {
      header: "Téléphone",
      accessorKey: "telephone",
      enableSorting: true,
      cell: ({ row }) => row.original.telephone ?? "—",
    },
    {
      header: "Commission",
      accessorKey: "commission",
      enableSorting: true,
      cell: ({ row }) =>
        row.original.commission != null ? `${row.original.commission}%` : "—",
    },
    {
      header: "Actions",
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PermissionGate permission={PERMISSIONS.EDIT_DOCTORS}>
            <IconButton
              variant="edit"
              title="Modifier"
              aria-label="Modifier"
              onClick={() => openEdit(row.original)}
              icon={<Pencil className="h-4 w-4" />}
            />
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.DELETE_DOCTORS}>
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

  // ---- Render --------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title="Médecins traitants"
        action={
          can(PERMISSIONS.CREATE_DOCTORS) ? (
            <button
              onClick={() => {
                createForm.reset();
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Ajouter un médecin
            </button>
          ) : undefined
        }
      />

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        {/* Barre de recherche + compteur */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (nom, téléphone, email, rôle)..."
              className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="text-sm text-gray-500">
            {totalElements} médecin{totalElements > 1 ? "s" : ""} au total
            {search && ` · ${doctors.length} affiché${doctors.length > 1 ? "s" : ""}`}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={doctors}
          isLoading={isLoading}
          pageCount={totalPages}
          pageIndex={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
        />
      </div>

      {/* ---- Modal création ---- */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Ajouter un médecin"
        size="lg"
        onSubmit={createForm.handleSubmit(onCreateSubmit)}
        submitLabel="Ajouter un médecin"
        isSubmitting={createMutation.isPending}
      >
        <DoctorForm form={createForm} />
      </CrudModal>

      {/* ---- Modal édition ---- */}
      <CrudModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Modifier un médecin"
        size="lg"
        onSubmit={editForm.handleSubmit(onEditSubmit)}
        submitLabel="Modifier"
        isSubmitting={updateMutation.isPending}
      >
        <DoctorForm form={editForm} />
      </CrudModal>

      {/* ---- Modal confirmation suppression ---- */}
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setSelectedDoctor(null);
        }}
        onConfirm={() => {
          if (selectedDoctor) deleteMutation.mutate(selectedDoctor.id);
        }}
        title="Supprimer ce médecin"
        message={`Voulez-vous vraiment supprimer le Dr ${selectedDoctor?.name ?? ""} ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// DoctorForm — formulaire partagé création / édition
// ---------------------------------------------------------------------------

interface DoctorFormProps {
  form: UseFormReturn<DoctorFormValues>;
}

function DoctorForm({ form }: DoctorFormProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="grid grid-cols-1 gap-4">
      <FormField label="Nom & Prénom" required error={errors.name?.message}>
        <input
          type="text"
          {...register("name")}
          placeholder="Entrer le nom complet"
          className={inputClass}
        />
      </FormField>

      <FormField label="Téléphone" error={errors.telephone?.message} hint="Format : 97000000">
        <input
          type="tel"
          {...register("telephone")}
          placeholder="97000000"
          className={inputClass}
        />
      </FormField>

      <FormField label="Email" error={errors.email?.message}>
        <input
          type="email"
          {...register("email")}
          placeholder="exemple@domaine.com"
          className={inputClass}
        />
      </FormField>

      <FormField label="Commission (en pourcentage)" error={errors.commission?.message}>
        <input
          type="number"
          {...register("commission")}
          min={0}
          max={100}
          placeholder="0"
          className={inputClass}
        />
      </FormField>
    </div>
  );
}
