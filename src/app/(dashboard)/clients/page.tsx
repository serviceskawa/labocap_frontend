"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";
import type { UseFormReturn } from "react-hook-form";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { clientsApi, type Client, type ClientRequest } from "@/lib/api/clients";

// ---------------------------------------------------------------------------
// Zod schema — calque `clients/create.blade.php` : seul le nom est requis.
// ---------------------------------------------------------------------------

/**
 * Numéro de téléphone accepté.
 *
 * Chiffres, espaces, points et tirets, avec un « + » facultatif en tête ; 8 à 15
 * chiffres une fois les séparateurs retirés. Cela refuse la saisie alphabétique
 * (le défaut signalé) tout en gardant modifiables les fiches existantes, qui
 * utilisent des formes légitimes : 97000000, +22997324883, 0022996236464.
 */
function telephoneValide(v?: string): boolean {
  if (!v || v.trim() === "") return true; // champ facultatif
  if (!/^\+?[0-9 .-]+$/.test(v.trim())) return false;
  const chiffres = v.replace(/\D/g, "");
  return chiffres.length >= 8 && chiffres.length <= 15;
}
const TEL_MESSAGE =
  "Numéro invalide : 8 à 15 chiffres, indicatif « + » facultatif (ex. 97000000)";

const clientSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  adress: z.string().optional(),
  contact: z
    .string()
    .optional()
    .refine(telephoneValide, { message: TEL_MESSAGE }),
  ifu: z.string().optional(),
});

type ClientFormValues = z.infer<typeof clientSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500";

const actionBtn =
  "inline-flex h-8 w-9 items-center justify-center rounded-md text-white transition-colors";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ClientsPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // ---- Queries & Mutations ------------------------------------------------

  const { data, isLoading } = useQuery({
    queryKey: ["clients"],
    // Laravel liste tous les clients (`latest()->get()`), recherche et
    // pagination se faisant côté client.
    queryFn: () => clientsApi.findAll({ size: 500 }).then((r) => r.data),
  });

  const clients: Client[] = data?.content ?? [];

  function apiError(err: AxiosError) {
    toast.error(
      (err.response?.data as { message?: string })?.message ??
        "Échec de l'enregistrement ! ",
    );
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  }

  const createMutation = useMutation({
    mutationFn: (payload: ClientRequest) => clientsApi.create(payload),
    onSuccess: () => {
      invalidate();
      toast.success("Un client enregistré ! ");
      setCreateOpen(false);
      createForm.reset();
    },
    onError: apiError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ClientRequest }) =>
      clientsApi.update(id, data),
    onSuccess: () => {
      invalidate();
      toast.success("Un client a été mis à jour ! ");
      setEditOpen(false);
    },
    onError: apiError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientsApi.delete(id),
    onSuccess: () => {
      invalidate();
      toast.success("    Un élement a été supprimé ! ");
      setDeleteOpen(false);
      setSelectedClient(null);
    },
    onError: apiError,
  });

  // ---- Forms --------------------------------------------------------------

  const createForm = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: "", adress: "", contact: "", ifu: "" },
  });

  const editForm = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
  });

  // ---- Handlers -----------------------------------------------------------

  function openEdit(client: Client) {
    setSelectedClient(client);
    editForm.reset({
      name: client.name,
      adress: client.adress ?? "",
      contact: client.contact ?? "",
      ifu: client.ifu ?? "",
    });
    setEditOpen(true);
  }

  function buildPayload(values: ClientFormValues): ClientRequest {
    return {
      name: values.name,
      // Chaîne vide plutôt qu'undefined : le mapper Java ignore les null,
      // un champ vidé par l'utilisateur ne serait donc jamais effacé.
      adress: values.adress ?? "",
      contact: values.contact ?? "",
      // `ifu` reste undefined si vide : la colonne est UNIQUE et plusieurs
      // chaînes vides entreraient en collision, là où plusieurs NULL sont admis.
      ifu: values.ifu || undefined,
    };
  }

  function onCreateSubmit(values: ClientFormValues) {
    createMutation.mutate(buildPayload(values));
  }

  function onEditSubmit(values: ClientFormValues) {
    if (!selectedClient) return;
    updateMutation.mutate({
      id: selectedClient.id,
      data: buildPayload(values),
    });
  }

  // ---- Columns ------------------------------------------------------------

  const columns: ColumnDef<Client>[] = [
    {
      header: "#",
      id: "index",
      enableSorting: false,
      cell: ({ row }) => row.index + 1,
    },
    {
      header: "Nom",
      accessorKey: "name",
    },
    {
      header: "Téléphone",
      accessorKey: "contact",
      cell: ({ row }) => row.original.contact ?? "",
    },
    {
      header: "Adresse",
      accessorKey: "adress",
      cell: ({ row }) => row.original.adress ?? "",
    },
    {
      header: "Numéro IFU",
      accessorKey: "ifu",
      cell: ({ row }) => row.original.ifu ?? "",
    },
    {
      header: "Actions",
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PermissionGate permission={PERMISSIONS.EDIT_CLIENTS}>
            <button
              onClick={() => openEdit(row.original)}
              className={`${actionBtn} bg-blue-600 hover:bg-blue-700`}
              aria-label="Modifier"
              title="Modifier"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.DELETE_CLIENTS}>
            <button
              onClick={() => {
                setSelectedClient(row.original);
                setDeleteOpen(true);
              }}
              className={`${actionBtn} bg-red-500 hover:bg-red-600`}
              aria-label="Supprimer"
              title="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </PermissionGate>
        </div>
      ),
    },
  ];

  // ---- Render -------------------------------------------------------------

  return (
    <PermissionGate permission={PERMISSIONS.VIEW_CLIENTS}>
      <div className="space-y-6">
        <PageHeader
          title="Clients"
          action={
            can(PERMISSIONS.CREATE_CLIENTS) ? (
              <button
                onClick={() => {
                  createForm.reset();
                  setCreateOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Ajouter un nouveau client
              </button>
            ) : undefined
          }
        />

        <DataTable
          title="Liste des clients"
          columns={columns}
          data={clients}
          isLoading={isLoading}
        />

        {/* ---- Modal création ---- */}
        <CrudModal
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          title="Ajouter un nouveau client"
          onSubmit={createForm.handleSubmit(onCreateSubmit)}
          // Libellé fautif du Blade Laravel (copier-coller du module Médecins),
          // conservé tel quel : c'est ce que voient les utilisateurs.
          submitLabel="Ajouter un nouveau médecin"
          isSubmitting={createMutation.isPending}
        >
          <ClientForm form={createForm} />
        </CrudModal>

        {/* ---- Modal édition ---- */}
        <CrudModal
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          title="Modifier les informations du client"
          onSubmit={editForm.handleSubmit(onEditSubmit)}
          submitLabel="Mettre à jour"
          isSubmitting={updateMutation.isPending}
        >
          <ClientForm form={editForm} />
        </CrudModal>

        {/* ---- Confirmation suppression ---- */}
        <ConfirmModal
          isOpen={deleteOpen}
          onClose={() => {
            setDeleteOpen(false);
            setSelectedClient(null);
          }}
          onConfirm={() => {
            if (selectedClient) deleteMutation.mutate(selectedClient.id);
          }}
          title="Voulez-vous supprimer l'élément ?"
          message={`Client : ${selectedClient?.name ?? ""}`}
          confirmLabel="Oui"
          cancelLabel="Non !"
          confirmVariant="danger"
          isLoading={deleteMutation.isPending}
        />
      </div>
    </PermissionGate>
  );
}

// ---------------------------------------------------------------------------
// ClientForm
// ---------------------------------------------------------------------------

function ClientForm({ form }: { form: UseFormReturn<ClientFormValues> }) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-4">
      <p className="text-right text-sm text-gray-600">
        <span className="text-red-600">*</span>champs obligatoires
      </p>

      <FormField label="Nom" required error={errors.name?.message}>
        <input type="text" {...register("name")} className={inputClass} />
      </FormField>

      <FormField label="Adresse" error={errors.adress?.message}>
        <input type="text" {...register("adress")} className={inputClass} />
      </FormField>

      <FormField label="Contact" error={errors.contact?.message}>
        <input type="text" {...register("contact")} className={inputClass} />
      </FormField>

      <FormField label="Numéro IFU" error={errors.ifu?.message}>
        <input type="text" {...register("ifu")} className={inputClass} />
      </FormField>
    </div>
  );
}
