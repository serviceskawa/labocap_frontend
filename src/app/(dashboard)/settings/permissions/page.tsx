"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import type { ColumnDef } from "@tanstack/react-table";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTableCard } from "@/components/common/DataTableCard";
import { PermissionGate } from "@/components/common/PermissionGate";
import { IconButton } from "@/components/ui/IconButton";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { FormField } from "@/components/ui/FormField";
import { usersApi, Permission } from "@/lib/api/users";
import { PERMISSIONS } from "@/lib/constants/permissions";
import type { ApiError } from "@/types/api";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

// ---------------------------------------------------------------------------
// Helpers opération / ressource depuis le slug
// ---------------------------------------------------------------------------

const OPERATIONS = ["view", "create", "edit", "delete", "manage"] as const;

function extractOperation(slug: string): string {
  for (const op of OPERATIONS) if (slug.startsWith(op + "-") || slug === op) return op;
  return slug.split("-")[0];
}
function extractResource(slug: string): string {
  const op = extractOperation(slug);
  return slug.startsWith(op + "-") ? slug.slice(op.length + 1) : slug;
}
function slugifyResource(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}


interface FormState {
  name: string;
  operation: string;
  resource: string;
}
const EMPTY_FORM: FormState = { name: "", operation: "view", resource: "" };

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PermissionsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Permission | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => usersApi.getAllPermissions().then((r) => r.data),
  });

  // Ressources existantes (dérivées des slugs) pour alimenter le select.
  const resourceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of permissions as Permission[]) set.add(extractResource(p.slug));
    return Array.from(set).sort();
  }, [permissions]);

  const computedSlug = useMemo(() => {
    const res = slugifyResource(form.resource);
    return res ? `${form.operation}-${res}` : "";
  }, [form.operation, form.resource]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["permissions"] });
  const errorHandler = (err: AxiosError<ApiError>) =>
    toast.error(err.response?.data?.message ?? "Une erreur est survenue");

  const createMutation = useMutation({
    mutationFn: (data: { name: string; slug: string }) => usersApi.createPermission(data),
    onSuccess: () => {
      toast.success("Permission créée avec succès");
      invalidate();
      resetForm();
    },
    onError: errorHandler,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string; slug: string } }) =>
      usersApi.updatePermission(id, data),
    onSuccess: () => {
      toast.success("Permission mise à jour");
      invalidate();
      resetForm();
    },
    onError: errorHandler,
  });

  function resetForm() {
    setEditing(null);
    setForm(EMPTY_FORM);
  }
  function openEdit(p: Permission) {
    setEditing(p);
    setForm({ name: p.name, operation: extractOperation(p.slug), resource: extractResource(p.slug) });
  }
  function submit() {
    if (!form.name.trim()) return toast.error("Le nom est obligatoire");
    if (!computedSlug) return toast.error("La ressource est obligatoire");
    const data = { name: form.name.trim(), slug: computedSlug };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // ---- Tableau (calque users/permissions Laravel : Nom, Slug, Date, Actions) ----

  const columns: ColumnDef<Permission>[] = [
    { header: "Nom", accessorKey: "name" },
    {
      header: "Slug",
      accessorKey: "slug",
      cell: ({ row }) => <span className="text-gray-600">{row.original.slug}</span>,
    },
    {
      header: "Date",
      id: "date",
      cell: ({ row }) =>
        row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString("fr-FR") : "—",
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <PermissionGate permission={PERMISSIONS.EDIT_PERMISSIONS}>
          <IconButton
            variant="view"
            title="Modifier"
            aria-label="Modifier"
            onClick={() => openEdit(row.original)}
            icon={<Pencil className="h-4 w-4" />}
          />
        </PermissionGate>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Permissions" />

      {/* Formulaire de création / édition (calque permissions/create Laravel) */}
      <PermissionGate permission={PERMISSIONS.CREATE_PERMISSIONS}>
        <div className="rounded border border-gray-200 bg-white p-6">
          <h5 className="mb-4 text-[15px] font-semibold text-gray-900">
            {editing ? "Modifier la permission" : "Ajouter une nouvelle permission"}
          </h5>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Nom" required>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex. : Voir les patients"
                className={inputClass}
              />
            </FormField>
            <FormField label="Ressource" required>
              <NativeSelect
                value={form.resource}
                onChange={(e) => setForm({ ...form, resource: e.target.value })}
              >
                <option value="">Sélectionner une ressource</option>
                {resourceOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Opération" required>
              <NativeSelect
                value={form.operation}
                onChange={(e) => setForm({ ...form, operation: e.target.value })}
              >
                <option value="view">view</option>
                <option value="create">create</option>
                <option value="edit">edit</option>
                <option value="delete">delete</option>
                <option value="manage">manage</option>
              </NativeSelect>
            </FormField>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Slug généré : <span className="font-mono font-semibold text-gray-800">{computedSlug || "—"}</span>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-[.15rem] bg-blue-600 px-[.9rem] py-[.45rem] text-[.9rem] font-normal text-white transition-[background-color,box-shadow] hover:shadow-[0_2px_6px_0_rgba(114,124,245,0.5)] disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Mettre à jour" : "Ajouter une nouvelle permission"}
            </button>
            {editing && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-[.15rem] border border-gray-300 bg-white px-[.9rem] py-[.45rem] text-[.9rem] text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
            )}
          </div>
        </div>
      </PermissionGate>

      {/* Liste des permissions */}
      <DataTableCard title="Liste des permissions" columns={columns} data={permissions as Permission[]} isLoading={isLoading} />
    </div>
  );
}
