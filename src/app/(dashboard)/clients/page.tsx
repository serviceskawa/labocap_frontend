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
import type { UseFormRegisterReturn, UseFormReturn } from "react-hook-form";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { clientsApi, type Client, type ClientRequest } from "@/lib/api/clients";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

// ---------------------------------------------------------------------------
// Zod schema — calque `clients/create.blade.php` : seul le nom est requis.
// ---------------------------------------------------------------------------

/**
 * Formats imposés en recette :
 * - contact : obligatoire, 8 à 15 chiffres (ex. 0197000000) ;
 * - IFU : facultatif, exactement 13 chiffres (ex. 1234567890123).
 *
 * Les deux champs n'acceptent que des chiffres — la saisie alphabétique est
 * d'ailleurs bloquée à la frappe (voir `chiffresSeulement`).
 */
const TEL_MESSAGE =
  "Le contact doit contenir entre 8 et 15 chiffres (ex. 0197000000)";
const IFU_MESSAGE =
  "Le numéro IFU doit contenir exactement 13 chiffres (ex. 1234567890123)";

const clientSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  adress: z.string().optional(),
  contact: z
    .string()
    .trim()
    .min(1, "Le contact est requis")
    .regex(/^\d{8,15}$/, TEL_MESSAGE),
  ifu: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^\d{13}$/.test(v), { message: IFU_MESSAGE }),
});

/**
 * Enrobe l'enregistrement react-hook-form d'un champ pour n'y laisser passer
 * que des chiffres, dans la limite de `maxLength`. Le filtrage est appliqué à
 * la valeur du DOM *avant* que react-hook-form ne la lise, sinon une lettre
 * collée resterait dans l'état du formulaire.
 *
 * `inputMode="numeric"` sort le pavé numérique sur mobile. Un
 * `<input type="number">` ne conviendrait pas : il accepte « e », « + » et les
 * décimales, et masque la longueur réelle saisie.
 */
function chiffresSeulement(
  field: UseFormRegisterReturn,
  maxLength: number,
): UseFormRegisterReturn & {
  inputMode: "numeric";
  maxLength: number;
} {
  return {
    ...field,
    inputMode: "numeric",
    maxLength,
    onChange: (event: { target: HTMLInputElement; type?: unknown }) => {
      event.target.value = event.target.value
        .replace(/\D/g, "")
        .slice(0, maxLength);
      return field.onChange(event);
    },
  };
}

type ClientFormValues = z.infer<typeof clientSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


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

      <FormField
        label="Contact"
        required
        hint="8 à 15 chiffres — ex. 0197000000"
        error={errors.contact?.message}
      >
        <input
          type="text"
          placeholder="0197000000"
          {...chiffresSeulement(register("contact"), 15)}
          className={inputClass}
        />
      </FormField>

      <FormField
        label="Numéro IFU"
        hint="Facultatif — 13 chiffres — ex. 1234567890123"
        error={errors.ifu?.message}
      >
        <input
          type="text"
          placeholder="1234567890123"
          {...chiffresSeulement(register("ifu"), 13)}
          className={inputClass}
        />
      </FormField>
    </div>
  );
}
