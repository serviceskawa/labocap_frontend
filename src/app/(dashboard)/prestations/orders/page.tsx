"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Trash2, Plus } from "lucide-react";
import {
  LimitedSelect as ReactSelect,
  MAX_VISIBLE_OPTIONS,
} from "@/components/ui/LimitedSelect";
import AsyncSelect from "react-select/async";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";

import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { RHFSelect } from "@/components/ui/RHFSelect";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  prestationOrdersApi,
  type PrestationOrder,
  type PrestationOrderRequest,
} from "@/lib/api/prestationOrders";
import { prestationsApi } from "@/lib/api/prestations";
import { patientsApi } from "@/lib/api/patients";
import type { PageResponse, ApiError } from "@/types/api";
import { formatDate } from "@/lib/utils";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

interface SelectOption {
  value: string;
  label: string;
}

interface PrestationOption extends SelectOption {
  price: number;
}

// Statuts (enum côté base : Nouveau / En cours / Terminé)
const STATUS_OPTIONS = ["Nouveau", "En cours", "Terminé"] as const;

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const orderSchema = z.object({
  patientId: z.string().min(1, "Le patient est obligatoire"),
  prestationId: z.string().min(1, "La prestation est obligatoire"),
  status: z.string().optional(),
});

type OrderFormData = z.infer<typeof orderSchema>;

// ---------------------------------------------------------------------------
// Helpers d'affichage
// ---------------------------------------------------------------------------


function formatPrice(value: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Nouveau: "bg-gray-100 text-gray-700",
    "En cours": "bg-blue-100 text-blue-700",
    Terminé: "bg-green-100 text-green-700",
  };
  const cls = styles[status] ?? "bg-gray-100 text-gray-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Formulaire partagé (création / édition)
// ---------------------------------------------------------------------------

interface OrderFormProps {
  form: ReturnType<typeof useForm<OrderFormData>>;
  prestationOptions: PrestationOption[];
  showStatus: boolean;
  initialPatient?: SelectOption | null;
}

function OrderForm({
  form,
  prestationOptions,
  showStatus,
  initialPatient,
}: OrderFormProps) {
  const {
    control,
    watch,
    formState: { errors },
  } = form;

  const [patientOption, setPatientOption] = useState<SelectOption | null>(
    initialPatient ?? null,
  );

  const selectedPrestationId = watch("prestationId");
  const selectedPrestation = prestationOptions.find(
    (o) => o.value === selectedPrestationId,
  );

  // Recherche asynchrone des patients (13k+ enregistrements → pas de préchargement).
  // On n'en affiche que 6, comme les autres selects : au-delà, l'utilisateur
  // affine sa recherche (qui, ici, porte sur toute la base côté serveur).
  const loadPatients = (input: string) =>
    patientsApi
      .findAll({ search: input || undefined, size: MAX_VISIBLE_OPTIONS })
      .then((r) =>
        r.data.content.map((p) => ({
          value: p.id,
          label: `${p.code} - ${p.firstname} ${p.lastname}`.trim(),
        })),
      );

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* Patient */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Patient <span className="text-red-500">*</span>
        </label>
        <Controller
          name="patientId"
          control={control}
          render={({ field }) => (
            <AsyncSelect<SelectOption>
              instanceId="order-patient"
              cacheOptions
              defaultOptions
              loadOptions={loadPatients}
              value={patientOption}
              onChange={(opt) => {
                setPatientOption(opt as SelectOption | null);
                field.onChange(opt ? (opt as SelectOption).value : "");
              }}
              placeholder="Rechercher un patient (code / nom)..."
              noOptionsMessage={() => "Aucun patient"}
              loadingMessage={() => "Recherche..."}
              classNamePrefix="react-select"
            />
          )}
        />
        {errors.patientId && (
          <p className="text-xs text-red-500">{errors.patientId.message}</p>
        )}
      </div>

      {/* Prestation */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Prestation <span className="text-red-500">*</span>
        </label>
        <Controller
          name="prestationId"
          control={control}
          render={({ field }) => (
            <ReactSelect<PrestationOption>
              instanceId="order-prestation"
              options={prestationOptions}
              value={
                prestationOptions.find((o) => o.value === field.value) ?? null
              }
              onChange={(opt) => field.onChange(opt ? opt.value : "")}
              placeholder="Choisir une prestation..."
              noOptionsMessage={() => "Aucune prestation"}
              classNamePrefix="react-select"
            />
          )}
        />
        {errors.prestationId && (
          <p className="text-xs text-red-500">{errors.prestationId.message}</p>
        )}
      </div>

      {/* Prix (lecture seule, dérivé de la prestation) */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Prix</label>
        <input
          type="text"
          readOnly
          value={selectedPrestation ? formatPrice(selectedPrestation.price) : ""}
          placeholder="—"
          className={`${inputClass} bg-gray-50 text-gray-600`}
        />
        <p className="text-xs text-gray-400">
          Le prix est déterminé automatiquement par la prestation.
        </p>
      </div>

      {/* Statut (édition uniquement) */}
      {showStatus && (
        <RHFSelect
          control={control}
          name="status"
          label="Statut"
          required
          options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
          placeholder="Sélectionner un statut..."
          error={errors.status?.message}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function PrestationOrdersPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  // --- Pagination
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // --- Modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PrestationOrder | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<PrestationOrder | null>(
    null,
  );

  // --- Formulaires
  const createForm = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: { patientId: "", prestationId: "", status: "Nouveau" },
  });

  const editForm = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
  });

  // --- Query : liste des commandes
  const { data, isLoading } = useQuery<PageResponse<PrestationOrder>>({
    queryKey: ["prestation-orders", { page, size: pageSize }],
    queryFn: () =>
      prestationOrdersApi
        .findAll({ page, size: pageSize })
        .then((r) => r.data),
  });

  // --- Query : prestations (préchargées pour le select + prix)
  const { data: prestationsData } = useQuery({
    queryKey: ["prestations-all-for-orders"],
    queryFn: () =>
      prestationsApi.findAll({ size: 1000 }).then((r) => r.data.content),
    staleTime: 5 * 60_000,
  });

  const orders = data?.content ?? [];
  const pageCount = data?.totalPages ?? 0;

  const prestationOptions: PrestationOption[] = (prestationsData ?? []).map(
    (p) => ({ value: p.id, label: p.name, price: p.price }),
  );

  // --- Mutations
  const createMutation = useMutation({
    mutationFn: (payload: PrestationOrderRequest) =>
      prestationOrdersApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prestation-orders"] });
      toast.success("Commande de prestation créée avec succès");
      setCreateOpen(false);
      createForm.reset();
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de la création");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PrestationOrderRequest }) =>
      prestationOrdersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prestation-orders"] });
      toast.success("Commande modifiée avec succès");
      setEditOpen(false);
      setSelectedOrder(null);
      editForm.reset();
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la modification",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => prestationOrdersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prestation-orders"] });
      toast.success("Commande supprimée avec succès");
      setDeleteTarget(null);
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la suppression",
      );
    },
  });

  // --- Handlers
  function openCreate() {
    createForm.reset({ patientId: "", prestationId: "", status: "Nouveau" });
    setCreateOpen(true);
  }

  function openEdit(order: PrestationOrder) {
    setSelectedOrder(order);
    editForm.reset({
      patientId: order.patientId,
      prestationId: order.prestationId,
      status: order.status,
    });
    setEditOpen(true);
  }

  function onCreateSubmit(values: OrderFormData) {
    // total + statut initial gérés côté serveur
    createMutation.mutate({
      patientId: values.patientId,
      prestationId: values.prestationId,
    });
  }

  function onEditSubmit(values: OrderFormData) {
    if (!selectedOrder) return;
    updateMutation.mutate({
      id: selectedOrder.id,
      data: {
        patientId: values.patientId,
        prestationId: values.prestationId,
        status: values.status,
      },
    });
  }

  // --- Colonnes
  const columns: ColumnDef<PrestationOrder>[] = [
    {
      header: "Patient",
      accessorKey: "patientName",
      cell: ({ row }) => row.original.patientName || "—",
    },
    {
      header: "Prestation",
      accessorKey: "prestationName",
      cell: ({ row }) => row.original.prestationName || "—",
    },
    {
      header: "Prix",
      accessorKey: "total",
      cell: ({ row }) => formatPrice(row.original.total),
    },
    {
      header: "Statut",
      accessorKey: "status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      header: "Date",
      id: "createdAt",
      cell: ({ row }) =>
        row.original.createdAt ? formatDate(row.original.createdAt) : "—",
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => {
        // Comme dans le Laravel : aucune action sur une commande terminée
        if (row.original.status === "Terminé") {
          return <span className="text-gray-300">—</span>;
        }
        return (
        <div className="flex items-center gap-2">
          <PermissionGate permission={PERMISSIONS.EDIT_PRESTATION_ORDERS}>
            <button
              type="button"
              onClick={() => openEdit(row.original)}
              className="inline-flex items-center justify-center rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors"
              title="Modifier"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.DELETE_PRESTATION_ORDERS}>
            <button
              type="button"
              onClick={() => setDeleteTarget(row.original)}
              className="inline-flex items-center justify-center rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-600 transition-colors"
              title="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </PermissionGate>
        </div>
        );
      },
    },
  ];

  if (!can(PERMISSIONS.VIEW_PRESTATION_ORDERS)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Accès non autorisé</p>
      </div>
    );
  }

  // --- Render
  return (
    <div className="space-y-6">
      <PageHeader
        title="Commandes de prestations"
        action={
          can(PERMISSIONS.CREATE_PRESTATION_ORDERS) ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Nouvelle commande
            </button>
          ) : undefined
        }
      />

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <DataTable
          columns={columns}
          data={orders}
          isLoading={isLoading}
          pageCount={pageCount}
          pageIndex={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(0);
          }}
        />
      </div>

      {/* Modal création */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => {
          setCreateOpen(false);
          createForm.reset();
        }}
        title="Nouvelle commande de prestation"
        size="lg"
        onSubmit={createForm.handleSubmit(onCreateSubmit)}
        submitLabel="Ajouter"
        isSubmitting={createMutation.isPending}
      >
        <OrderForm
          form={createForm}
          prestationOptions={prestationOptions}
          showStatus={false}
        />
      </CrudModal>

      {/* Modal édition */}
      <CrudModal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelectedOrder(null);
          editForm.reset();
        }}
        title="Modifier la commande"
        size="lg"
        onSubmit={editForm.handleSubmit(onEditSubmit)}
        submitLabel="Mettre à jour"
        isSubmitting={updateMutation.isPending}
      >
        <OrderForm
          form={editForm}
          prestationOptions={prestationOptions}
          showStatus
          initialPatient={
            selectedOrder
              ? {
                  value: selectedOrder.patientId,
                  label: selectedOrder.patientName,
                }
              : null
          }
        />
      </CrudModal>

      {/* Modal confirmation suppression */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        title="Supprimer cette commande"
        message={
          deleteTarget
            ? `Voulez-vous vraiment supprimer la commande de "${deleteTarget.patientName}" (${deleteTarget.prestationName}) ? Cette action est irréversible.`
            : ""
        }
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
