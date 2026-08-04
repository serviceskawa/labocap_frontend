"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Trash2, CheckCircle, XCircle, Eye, Loader2 } from "lucide-react";
import Link from "next/link";
import { LimitedSelect as Select } from "@/components/ui/LimitedSelect";
import { translateApiError } from "@/lib/api/errorMessages";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";
import type { UseFormReturn } from "react-hook-form";
import type { SingleValue } from "react-select";

import { PageHeader } from "@/components/ui/PageHeader";
import { RHFSelect } from "@/components/ui/RHFSelect";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { IconButton } from "@/components/ui/IconButton";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  contractsApi,
  Contract,
  ContractRequest,
  ContractStatus,
} from "@/lib/api/contracts";
import { clientsApi } from "@/lib/api/clients";
import { SELECT_CONTROL_MIN_HEIGHT } from "@/components/ui/selectStyles";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

// Statuts proposés au filtre de la liste (calque Laravel : Tous / ACTIF / INACTIF / CLÔTURER).
const CONTRACT_STATUSES: { value: ContractStatus; label: string }[] = [
  { value: "ACTIF", label: "Actif" },
  { value: "INACTIF", label: "Inactif" },
  { value: "CLOTURE", label: "Clôturé" },
];

// Statuts modifiables depuis le formulaire d'édition (calque Laravel : Actif / Inactif).
const EDIT_STATUSES = [
  { value: "ACTIF", label: "Actif" },
  { value: "INACTIF", label: "Inactif" },
];

// Types de contrat — valeurs identiques à l'app Laravel (contrats/create.blade.php).
const CONTRACT_TYPES = [
  { value: "ORDINAIRE", label: "Ordinaire" },
  { value: "ASSURANCE", label: "Assurance" },
  { value: "CAMPAGNE", label: "Campagne" },
];

// ---------------------------------------------------------------------------
// Zod schema — calque le formulaire Laravel (contrats/create.blade.php) :
// name, type, nbr_examen et description obligatoires ; le client n'est requis
// que lorsque la facturation groupée est activée (la facture unique s'appuie
// sur le client du contrat).
// ---------------------------------------------------------------------------

const contractSchema = z
  .object({
    name: z.string().min(1, { message: "Le nom du contrat est requis" }),
    type: z.string().min(1, { message: "Le type est requis" }),
    description: z.string().min(1, { message: "La description est requise" }),
    clientId: z.string().optional(),
    // -1 = illimité (convention Laravel, 135 des 146 contrats l'utilisent).
    // On refuse 0 et les autres négatifs, qui n'ont aucun sens métier.
    nbrTests: z
      .string()
      .min(1, { message: "Le nombre d'examens est requis" })
      .refine((v) => {
        const n = Number(v);
        return Number.isInteger(n) && (n === -1 || n >= 1);
      }, { message: "Saisissez un nombre entier supérieur ou égal à 1, ou -1 pour illimité" }),
    status: z.enum(["ACTIF", "INACTIF", "CLOTURE"] as const).optional(),
    invoiceUnique: z.boolean().optional(),
  })
  .refine((v) => !v.invoiceUnique || !!v.clientId, {
    message: "Sélectionnez le client du contrat pour la facturation groupée",
    path: ["clientId"],
  });

type ContractFormValues = z.infer<typeof contractSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


// La `startDate` n'existe pas dans le formulaire Laravel : on la renseigne
// automatiquement (date du jour à la création, valeur existante à l'édition)
// pour satisfaire le contrat de l'API sans l'exposer à l'utilisateur.
// Le client n'est transmis que si la facturation groupée est active.
function buildPayload(
  values: ContractFormValues,
  startDate: string
): ContractRequest {
  return {
    name: values.name,
    type: values.type,
    description: values.description,
    clientId: values.invoiceUnique ? values.clientId || undefined : undefined,
    startDate,
    nbrTests:
      values.nbrTests === "" || values.nbrTests === undefined
        ? undefined
        : Number(values.nbrTests),
    status: values.status,
    invoiceUnique: values.invoiceUnique,
  };
}

// Date du jour au format ISO (YYYY-MM-DD) pour la `startDate` implicite.
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ContractsPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Contract | null>(null);

  // Filtres
  const [statusFilter, setStatusFilter] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [nameSearch, setNameSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // ---- Queries -------------------------------------------------------------

  const params: Record<string, unknown> = {};
  if (statusFilter) params.status = statusFilter;
  if (clientSearch) params.clientSearch = clientSearch;
  if (nameSearch) params.search = nameSearch;
  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo) params.dateTo = dateTo;

  const { data, isLoading } = useQuery({
    queryKey: ["contracts", params],
    queryFn: () => contractsApi.findAll(params).then((r) => r.data),
  });

  const contracts: Contract[] = data?.content ?? [];

  // Clients pour le React Select (live search)
  const [clientInputValue, setClientInputValue] = useState("");

  const { data: clientsData } = useQuery({
    queryKey: ["clients-search", clientInputValue],
    queryFn: () =>
      clientsApi
        .findAll({ size: 50, ...(clientInputValue ? { search: clientInputValue } : {}) })
        .then((r) => r.data),
  });

  const clientOptions =
    clientsData?.content?.map((c) => ({ value: c.id, label: c.name })) ?? [];

  // ---- Mutations -----------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (payload: ContractRequest) => contractsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Contrat créé");
      setCreateOpen(false);
      createForm.reset();
    },
    onError: (err: AxiosError) => {
      const msg =
        translateApiError((err.response?.data as { message?: string })?.message) ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ContractRequest }) =>
      contractsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Contrat modifié");
      setEditOpen(false);
    },
    onError: (err: AxiosError) => {
      const msg =
        translateApiError((err.response?.data as { message?: string })?.message) ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contractsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Contrat supprimé");
      setDeleteOpen(false);
      setSelected(null);
    },
    onError: (err: AxiosError) => {
      const msg =
        translateApiError((err.response?.data as { message?: string })?.message) ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => contractsApi.activate(id),
    onSuccess: () => {
      toast.success("Contrat activé");
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
    onError: (err: AxiosError) =>
      toast.error(
        translateApiError((err.response?.data as { message?: string })?.message) ??
          "Erreur lors de l'activation"
      ),
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => contractsApi.close(id),
    onSuccess: () => {
      toast.success("Contrat clôturé");
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
    onError: (err: AxiosError) =>
      toast.error(
        translateApiError((err.response?.data as { message?: string })?.message) ??
          "Erreur lors de la clôture"
      ),
  });

  // ---- Forms ---------------------------------------------------------------

  const createForm = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      name: "",
      type: "",
      description: "",
      clientId: "",
      nbrTests: "-1",
      status: "INACTIF",
      invoiceUnique: false,
    },
  });

  const editForm = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema),
  });

  // ---- Handlers ------------------------------------------------------------

  function openEdit(contract: Contract) {
    setSelected(contract);
    editForm.reset({
      name: contract.name ?? "",
      type: contract.type ?? "",
      description: contract.description ?? "",
      clientId: contract.clientId ?? "",
      nbrTests: contract.nbrTests != null ? String(contract.nbrTests) : "-1",
      status: contract.status,
      invoiceUnique: contract.invoiceUnique ?? false,
    });
    setEditOpen(true);
  }

  function openDelete(contract: Contract) {
    setSelected(contract);
    setDeleteOpen(true);
  }

  function onCreateSubmit(values: ContractFormValues) {
    createMutation.mutate(buildPayload(values, today()));
  }

  function onEditSubmit(values: ContractFormValues) {
    if (!selected) return;
    updateMutation.mutate({
      id: selected.id,
      data: buildPayload(values, selected.startDate ?? today()),
    });
  }

  // ---- Columns -------------------------------------------------------------

  // Colonnes alignées sur la vue Laravel « contrats/index » :
  // Date, Contrat, Nombre d'examens, Statut, Actions.
  const columns: ColumnDef<Contract>[] = [
    {
      header: "Date",
      accessorKey: "createdAt",
      cell: ({ row }) =>
        row.original.createdAt
          ? new Date(row.original.createdAt).toLocaleDateString("fr-FR")
          : "—",
    },
    {
      header: "Contrat",
      accessorKey: "name",
      cell: ({ row }) => (
        <span className="font-medium text-gray-900">
          {row.original.name ?? "—"}
        </span>
      ),
    },
    {
      header: "Nombre d'examens",
      id: "usedTestsCount",
      cell: ({ row }) => (
        <span className="text-sm text-gray-700">
          {row.original.usedTestsCount ?? 0}
        </span>
      ),
    },
    {
      header: "Statut",
      accessorKey: "status",
      cell: ({ row }) => (
        <StatusBadge status={row.original.status} domain="contract" />
      ),
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/contracts/${row.original.id}`}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
            Détail
          </Link>
          <PermissionGate permission={PERMISSIONS.EDIT_CONTRACTS}>
            <IconButton
              variant="edit"
              title="Modifier"
              aria-label="Modifier"
              onClick={() => openEdit(row.original)}
              icon={<Pencil className="h-4 w-4" />}
            />
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.EDIT_CONTRACTS}>
            {row.original.status === "INACTIF" && (
              <button
                onClick={() => activateMutation.mutate(row.original.id)}
                disabled={activateMutation.isPending}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                aria-label="Activer"
              >
                {activateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                Activer
              </button>
            )}
            {row.original.status === "ACTIF" && (
              <button
                onClick={() => closeMutation.mutate(row.original.id)}
                disabled={closeMutation.isPending}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-gray-600 text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
                aria-label="Clôturer"
              >
                {closeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                Clôturer
              </button>
            )}
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.DELETE_CONTRACTS}>
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

  // ---- Guard ---------------------------------------------------------------

  if (!can(PERMISSIONS.VIEW_CONTRACTS)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Accès non autorisé</p>
      </div>
    );
  }

  // ---- Render --------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contrats"
        action={
          can(PERMISSIONS.CREATE_CONTRACTS) ? (
            <button
              onClick={() => {
                createForm.reset();
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Ajouter un nouveau contrat
            </button>
          ) : undefined
        }
      />

      {/* Filtres */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NativeSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Tous les statuts</option>
            {CONTRACT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </NativeSelect>
          <input
            type="text"
            placeholder="Rechercher par nom de contrat..."
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            className={inputClass}
          />
          <input
            type="text"
            placeholder="Rechercher par client..."
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            className={inputClass}
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={inputClass}
            title="Date début"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={inputClass}
            title="Date fin"
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        <DataTable columns={columns} data={contracts} isLoading={isLoading} />
      </div>

      {/* Modal création */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Ajouter un nouveau contrat"
        size="lg"
        onSubmit={createForm.handleSubmit(onCreateSubmit)}
        submitLabel="Ajouter un nouveau contrat"
        isSubmitting={createMutation.isPending}
      >
        <ContractForm
          form={createForm}
          clientOptions={clientOptions}
          onClientInputChange={setClientInputValue}
        />
      </CrudModal>

      {/* Modal édition */}
      <CrudModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Modifier les informations du contrat"
        size="lg"
        onSubmit={editForm.handleSubmit(onEditSubmit)}
        submitLabel="Mettre à jour"
        isSubmitting={updateMutation.isPending}
      >
        <ContractForm
          form={editForm}
          clientOptions={clientOptions}
          onClientInputChange={setClientInputValue}
          isEdit
        />
      </CrudModal>

      {/* Modal suppression */}
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setSelected(null);
        }}
        onConfirm={() => {
          if (selected) deleteMutation.mutate(selected.id);
        }}
        title="Supprimer ce contrat"
        message={`Voulez-vous vraiment supprimer le contrat "${selected?.name ?? ""}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContractForm
// ---------------------------------------------------------------------------

interface SelectOption {
  value: string;
  label: string;
}

interface ContractFormProps {
  form: UseFormReturn<ContractFormValues>;
  clientOptions: SelectOption[];
  onClientInputChange: (value: string) => void;
  /** Le formulaire d'édition ajoute le champ Statut (calque Laravel edit.blade). */
  isEdit?: boolean;
}

// Formulaire calqué sur l'app Laravel (contrats/create.blade.php & edit.blade.php) :
// Nom*, Type*, [Statut* en édition], Nombre d'examens*, Facturation groupée
// (révèle le Client), Description*.
function ContractForm({
  form,
  clientOptions,
  onClientInputChange,
  isEdit = false,
}: ContractFormProps) {
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const invoiceUnique = watch("invoiceUnique");

  return (
    <div className="grid grid-cols-1 gap-4">
      <p className="text-right text-xs text-gray-500">
        <span className="text-red-500">*</span> champs obligatoires
      </p>

      <FormField label="Nom du contrat" required error={errors.name?.message}>
        <input
          type="text"
          {...register("name")}
          placeholder="Nom du contrat"
          className={inputClass}
        />
      </FormField>

      <RHFSelect
        control={control}
        name="type"
        label="Type"
        required
        options={CONTRACT_TYPES}
        placeholder="Sélectionner le type de contrat"
        error={errors.type?.message}
      />

      {isEdit && (
        <RHFSelect
          control={control}
          name="status"
          label="Statut"
          required
          options={EDIT_STATUSES}
          placeholder="Sélectionner le statut"
          error={errors.status?.message}
        />
      )}

      <FormField
        label="Nombre d'examens"
        required
        error={errors.nbrTests?.message}
        hint="-1 pour un nombre illimité"
      >
        <input
          type="number"
          {...register("nbrTests")}
          min={-1}
          className={inputClass}
        />
      </FormField>

      <FormField label="Facturation groupée" error={errors.invoiceUnique?.message}>
        <NativeSelect
          value={invoiceUnique ? "oui" : "non"}
          onChange={(e) => setValue("invoiceUnique", e.target.value === "oui")}
        >
          <option value="non">Non</option>
          <option value="oui">Oui</option>
        </NativeSelect>
      </FormField>

      {/* Le client n'apparaît que lorsque la facturation groupée est active
          (calque Laravel : le bloc #show-client est masqué par défaut). */}
      {invoiceUnique && (
        <FormField label="Client" required error={errors.clientId?.message}>
          <Controller
            name="clientId"
            control={control}
            render={({ field }) => (
              <Select<SelectOption>
                instanceId="contract-client"
                inputId="clientId"
                options={clientOptions}
                value={
                  clientOptions.find((o) => o.value === field.value) ?? null
                }
                onChange={(option: SingleValue<SelectOption>) =>
                  field.onChange(option?.value ?? "")
                }
                onInputChange={onClientInputChange}
                placeholder="Sélectionner le client du contrat"
                isClearable
                noOptionsMessage={() => "Aucun client trouvé"}
                classNamePrefix="react-select"
                styles={{
                  control: (base, state) => ({
                    ...base,
                    minHeight: `${SELECT_CONTROL_MIN_HEIGHT}px`,
                    borderRadius: "0.375rem",
                    borderColor: errors.clientId
                      ? "#fca5a5"
                      : state.isFocused
                      ? "#3b82f6"
                      : "#d1d5db",
                    boxShadow: state.isFocused ? "0 0 0 1px #3b82f6" : "none",
                    fontSize: "0.875rem",
                  }),
                  option: (base, state) => ({
                    ...base,
                    fontSize: "0.875rem",
                    backgroundColor: state.isSelected
                      ? "#2563eb"
                      : state.isFocused
                      ? "#eff6ff"
                      : "white",
                    color: state.isSelected ? "white" : "#374151",
                  }),
                  placeholder: (base) => ({
                    ...base,
                    color: "#9ca3af",
                    fontSize: "0.875rem",
                  }),
                  singleValue: (base) => ({ ...base, fontSize: "0.875rem" }),
                  menu: (base) => ({ ...base, zIndex: 50 }),
                }}
              />
            )}
          />
        </FormField>
      )}

      <FormField label="Description" required error={errors.description?.message}>
        <textarea
          {...register("description")}
          placeholder="Brève description du contrat"
          rows={3}
          className={inputClass}
        />
      </FormField>
    </div>
  );
}
