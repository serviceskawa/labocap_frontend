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
import { NativeSelect } from "@/components/ui/NativeSelect";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  suppliersApi,
  supplierCategoriesApi,
  type Supplier,
  type SupplierCategory,
  type SupplierRequest,
} from "@/lib/api/suppliers";

// ---------------------------------------------------------------------------
// Zod schema — calque `suppliers/create.blade.php` : Nom, Téléphone et
// Catégorie fournisseur sont obligatoires ; Email, Addresse et Note libres.
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

const supplierSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  phone: z
    .string()
    .min(1, "Le téléphone est requis")
    .refine(telephoneValide, { message: TEL_MESSAGE }),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  address: z.string().optional(),
  categoryId: z.string().min(1, "La catégorie fournisseur est requise"),
  information: z.string().optional(),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500";

const actionBtn =
  "inline-flex h-8 w-9 items-center justify-center rounded-md text-white transition-colors";

function buildPayload(values: SupplierFormValues): SupplierRequest {
  return {
    name: values.name,
    phone: values.phone,
    email: values.email || undefined,
    address: values.address || undefined,
    information: values.information || undefined,
    categoryId: values.categoryId,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SuppliersPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // ---- Queries & Mutations --------------------------------------------

  const { data, isLoading } = useQuery({
    queryKey: ["suppliers"],
    // Laravel affiche la liste complète (latest()->get()) : sans `size`, l'API
    // plafonne à 20 et la pagination cliente masquerait le reste.
    queryFn: () => suppliersApi.findAll({ size: 200 }).then((r) => r.data),
  });

  const { data: categories = [] } = useQuery<SupplierCategory[]>({
    queryKey: ["supplier-categories"],
    queryFn: () => supplierCategoriesApi.findAll().then((r) => r.data),
  });

  const suppliers: Supplier[] = data?.content ?? [];

  function apiError(err: AxiosError) {
    toast.error(
      (err.response?.data as { message?: string })?.message ??
        "Échec de l'enregistrement ! ",
    );
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["suppliers"] });
  }

  const createMutation = useMutation({
    mutationFn: (payload: SupplierRequest) => suppliersApi.create(payload),
    onSuccess: () => {
      invalidate();
      toast.success("Un Fournisseur enregistré ! ");
      setCreateOpen(false);
      createForm.reset();
    },
    onError: apiError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SupplierRequest }) =>
      suppliersApi.update(id, data),
    onSuccess: () => {
      invalidate();
      toast.success("Les information d'un fournisseur ont été mis à jour ! ");
      setEditOpen(false);
    },
    onError: apiError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => suppliersApi.delete(id),
    onSuccess: () => {
      invalidate();
      toast.success("    Un élement a été supprimé ! ");
      setDeleteOpen(false);
      setSelectedSupplier(null);
    },
    onError: (err: AxiosError) => {
      toast.error(
        (err.response?.data as { message?: string })?.message ??
          "Impossible de supprimer cet élément !  Celui-ci est lié à d'autres éléments. Pour effectuer cette suppression, vous devez d'abord supprimer ou mettre à jour les éléments liés dans d'autres tables.",
      );
    },
  });

  // ---- Forms --------------------------------------------------------

  const createForm = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      address: "",
      categoryId: "",
      information: "",
    },
  });

  const editForm = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
  });

  function openEdit(supplier: Supplier) {
    setSelectedSupplier(supplier);
    editForm.reset({
      name: supplier.name,
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      address: supplier.address ?? "",
      categoryId: supplier.categoryId ?? "",
      information: supplier.information ?? "",
    });
    setEditOpen(true);
  }

  function onCreateSubmit(values: SupplierFormValues) {
    createMutation.mutate(buildPayload(values));
  }

  function onEditSubmit(values: SupplierFormValues) {
    if (!selectedSupplier) return;
    updateMutation.mutate({
      id: selectedSupplier.id,
      data: buildPayload(values),
    });
  }

  // ---- Columns -------------------------------------------------------

  const columns: ColumnDef<Supplier>[] = [
    {
      header: "Nom",
      accessorKey: "name",
    },
    {
      header: "Email",
      accessorKey: "email",
      cell: ({ row }) => row.original.email ?? "",
    },
    {
      header: "Catégorie fournisseur",
      id: "category",
      cell: ({ row }) => row.original.categoryName ?? "",
    },
    {
      header: "Actions",
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PermissionGate permission={PERMISSIONS.EDIT_SUPPLIERS}>
            <button
              onClick={() => openEdit(row.original)}
              className={`${actionBtn} bg-blue-600 hover:bg-blue-700`}
              aria-label="Modifier"
              title="Modifier"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.DELETE_SUPPLIERS}>
            <button
              onClick={() => {
                setSelectedSupplier(row.original);
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

  // ---- Render --------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fournisseurs"
        action={
          can(PERMISSIONS.CREATE_SUPPLIERS) ? (
            <button
              onClick={() => {
                createForm.reset();
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Ajouter un nouveau fournisseur
            </button>
          ) : undefined
        }
      />

      <DataTable
        title="Liste des fournisseurs"
        columns={columns}
        data={suppliers}
        isLoading={isLoading}
      />

      {/* ---- Modal création ---- */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Ajouter un nouveau fournisseur"
        onSubmit={createForm.handleSubmit(onCreateSubmit)}
        submitLabel="Ajouter un nouveau fournisseur"
        isSubmitting={createMutation.isPending}
      >
        <SupplierForm form={createForm} categories={categories} />
      </CrudModal>

      {/* ---- Modal édition ---- */}
      <CrudModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Modifier les informations du fournisseur"
        onSubmit={editForm.handleSubmit(onEditSubmit)}
        submitLabel="Mettre à jour"
        isSubmitting={updateMutation.isPending}
      >
        <SupplierForm form={editForm} categories={categories} isEdit />
      </CrudModal>

      {/* ---- Confirmation suppression ---- */}
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setSelectedSupplier(null);
        }}
        onConfirm={() => {
          if (selectedSupplier) deleteMutation.mutate(selectedSupplier.id);
        }}
        title="Voulez-vous supprimer l'élément ?"
        message={`Fournisseur : ${selectedSupplier?.name ?? ""}`}
        confirmLabel="Oui"
        cancelLabel="Non !"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SupplierForm
// ---------------------------------------------------------------------------

interface SupplierFormProps {
  form: UseFormReturn<SupplierFormValues>;
  categories: SupplierCategory[];
  isEdit?: boolean;
}

function SupplierForm({ form, categories, isEdit = false }: SupplierFormProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-4">
      <p className="text-right text-sm text-gray-600">
        <span className="text-red-600">*</span>champs obligatoires
      </p>

      {/* Laravel intitule ce champ « Nom & Prénom » en édition seulement. */}
      <FormField
        label={isEdit ? "Nom & Prénom" : "Nom"}
        required
        error={errors.name?.message}
      >
        <input type="text" {...register("name")} className={inputClass} />
      </FormField>

      <FormField label="Téléphone" required error={errors.phone?.message}>
        <input type="tel" {...register("phone")} className={inputClass} />
      </FormField>

      <FormField label="Email" error={errors.email?.message}>
        <input type="email" {...register("email")} className={inputClass} />
      </FormField>

      {/* « Addresse » : orthographe du Blade Laravel, conservée telle quelle. */}
      <FormField label="Addresse" error={errors.address?.message}>
        <input type="text" {...register("address")} className={inputClass} />
      </FormField>

      <FormField
        label="Catégorie fournisseur"
        required
        error={errors.categoryId?.message}
      >
        <NativeSelect {...register("categoryId")}>
          <option value="">Sélectionner une catégorie</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </FormField>

      <FormField label="Note" error={errors.information?.message}>
        <textarea {...register("information")} rows={5} className={inputClass} />
      </FormField>
    </div>
  );
}
