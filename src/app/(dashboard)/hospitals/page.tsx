"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Trash2, Search } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";
import type { UseFormReturn } from "react-hook-form";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { IconButton } from "@/components/ui/IconButton";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { hospitalsApi, Hospital, HospitalRequest } from "@/lib/api/hospitals";
import { cn } from "@/lib/utils";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const hospitalSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  telephone: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  adresse: z.string().optional(),
  commission: z.string().optional(),
});

type HospitalFormValues = z.infer<typeof hospitalSchema>;

// ---------------------------------------------------------------------------
// Input style helper
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HospitalsPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(
    null
  );

  // ---- Pagination + recherche ---------------------------------------------
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // ---- Queries & Mutations ------------------------------------------------

  const { data, isLoading } = useQuery({
    queryKey: ["hospitals", { page, pageSize }],
    queryFn: () =>
      hospitalsApi.findAll({ page, size: pageSize }).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  const allHospitals: Hospital[] = useMemo(
    () => data?.content ?? [],
    [data?.content]
  );

  // Filtrage local (recherche dans la page courante)
  const hospitals = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allHospitals;
    return allHospitals.filter(
      (h) =>
        (h.name ?? "").toLowerCase().includes(q) ||
        (h.telephone ?? "").toLowerCase().includes(q) ||
        (h.email ?? "").toLowerCase().includes(q) ||
        (h.adresse ?? "").toLowerCase().includes(q),
    );
  }, [allHospitals, search]);

  const totalElements = data?.totalElements ?? 0;
  const totalPages = data?.totalPages ?? 0;

  const createMutation = useMutation({
    mutationFn: (payload: HospitalRequest) => hospitalsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospitals"] });
      toast.success("Hôpital créé");
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
    mutationFn: ({ id, data }: { id: string; data: HospitalRequest }) =>
      hospitalsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospitals"] });
      toast.success("Hôpital modifié");
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
    mutationFn: (id: string) => hospitalsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospitals"] });
      toast.success("Hôpital supprimé");
      setDeleteOpen(false);
      setSelectedHospital(null);
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  // ---- Forms ---------------------------------------------------------------

  const createForm = useForm<HospitalFormValues>({
    resolver: zodResolver(hospitalSchema),
    defaultValues: {
      name: "",
      telephone: "",
      email: "",
      adresse: "",
      commission: undefined,
    },
  });

  const editForm = useForm<HospitalFormValues>({
    resolver: zodResolver(hospitalSchema),
  });

  // ---- Handlers ------------------------------------------------------------

  function openEdit(hospital: Hospital) {
    setSelectedHospital(hospital);
    editForm.reset({
      name: hospital.name,
      telephone: hospital.telephone ?? "",
      email: hospital.email ?? "",
      adresse: hospital.adresse ?? "",
      commission: hospital.commission != null ? String(hospital.commission) : "",
    });
    setEditOpen(true);
  }

  function openDelete(hospital: Hospital) {
    setSelectedHospital(hospital);
    setDeleteOpen(true);
  }

  function buildPayload(values: HospitalFormValues): HospitalRequest {
    return {
      name: values.name,
      telephone: values.telephone || undefined,
      email: values.email || undefined,
      adresse: values.adresse || undefined,
      commission:
        values.commission === "" || values.commission === undefined
          ? undefined
          : Number(values.commission),
    };
  }

  function onCreateSubmit(values: HospitalFormValues) {
    createMutation.mutate(buildPayload(values));
  }

  function onEditSubmit(values: HospitalFormValues) {
    if (!selectedHospital) return;
    updateMutation.mutate({ id: selectedHospital.id, data: buildPayload(values) });
  }

  // ---- Columns -------------------------------------------------------------

  const columns: ColumnDef<Hospital>[] = [
    {
      header: "Nom de l'hôpital",
      accessorKey: "name",
      enableSorting: true,
    },
    {
      header: "Téléphone",
      accessorKey: "telephone",
      enableSorting: true,
      cell: ({ row }) => row.original.telephone ?? "—",
    },
    {
      header: "Adresse",
      accessorKey: "adresse",
      enableSorting: true,
      cell: ({ row }) => row.original.adresse ?? "—",
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
          <PermissionGate permission={PERMISSIONS.EDIT_HOSPITALS}>
            <IconButton
              variant="edit"
              title="Modifier"
              aria-label="Modifier"
              onClick={() => openEdit(row.original)}
              icon={<Pencil className="h-4 w-4" />}
            />
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.DELETE_HOSPITALS}>
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
        title="Hôpitaux"
        action={
          can(PERMISSIONS.CREATE_HOSPITALS) ? (
            <button
              onClick={() => {
                createForm.reset();
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Ajouter un hôpital
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
              placeholder="Rechercher (nom, téléphone, email, adresse)..."
              className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="text-sm text-gray-500">
            {totalElements} {totalElements > 1 ? "hôpitaux" : "hôpital"} au total
            {search && ` · ${hospitals.length} affiché${hospitals.length > 1 ? "s" : ""}`}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={hospitals}
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
        title="Ajouter un nouvel hôpital"
        size="md"
        onSubmit={createForm.handleSubmit(onCreateSubmit)}
        submitLabel="Ajouter un nouvel hôpital"
        isSubmitting={createMutation.isPending}
        closeOnOverlayClick={false}
        closeOnEscape={false}
      >
        <HospitalForm form={createForm} />
      </CrudModal>

      {/* ---- Modal édition ---- */}
      <CrudModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Modifier un hôpital"
        size="md"
        onSubmit={editForm.handleSubmit(onEditSubmit)}
        submitLabel="Modifier"
        isSubmitting={updateMutation.isPending}
        closeOnOverlayClick={false}
        closeOnEscape={false}
      >
        <HospitalForm form={editForm} />
      </CrudModal>

      {/* ---- Modal confirmation suppression ---- */}
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setSelectedHospital(null);
        }}
        onConfirm={() => {
          if (selectedHospital) deleteMutation.mutate(selectedHospital.id);
        }}
        title="Supprimer cet hôpital"
        message={`Voulez-vous vraiment supprimer l'hôpital "${selectedHospital?.name ?? ""}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// HospitalForm — formulaire partagé création / édition
// ---------------------------------------------------------------------------

interface HospitalFormProps {
  form: UseFormReturn<HospitalFormValues>;
}

function HospitalForm({ form }: HospitalFormProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-right text-xs text-gray-500">
        <span className="text-red-500">*</span> champs obligatoires
      </p>

      <FormField label="Nom de l'hôpital" required error={errors.name?.message}>
        <input
          type="text"
          {...register("name")}
          placeholder="Nom de l'hôpital"
          className={inputClass}
        />
      </FormField>

      <FormField
        label="Téléphone"
        error={errors.telephone?.message}
        hint="Format: 97000000"
      >
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

      <FormField label="Adresse" error={errors.adresse?.message}>
        <textarea
          {...register("adresse")}
          placeholder="Adresse de l'hôpital"
          rows={3}
          className={cn(inputClass, "min-h-[80px] resize-y")}
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
