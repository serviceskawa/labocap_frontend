"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";
import type { UseFormReturn } from "react-hook-form";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTableCard } from "@/components/common/DataTableCard";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { IconButton } from "@/components/ui/IconButton";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { usersApi, Role, Permission, RoleRequest } from "@/lib/api/users";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

// ---------------------------------------------------------------------------
// Helpers matrice de permissions (opération / ressource depuis le slug)
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

const roleSchema = z.object({
  name: z.string().min(1, "Le nom du rôle est requis"),
  permissionIds: z.array(z.string()).optional(),
});
type RoleFormValues = z.infer<typeof roleSchema>;


// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RolesPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const { data: rolesData, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => usersApi.getRoles().then((r) => r.data),
  });

  const { data: permissionsData } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => usersApi.getAllPermissions().then((r) => r.data),
  });

  const roles: Role[] = rolesData?.content ?? [];
  const permissions: Permission[] = permissionsData ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: RoleRequest) => usersApi.createRole(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Rôle créé");
      setCreateOpen(false);
      createForm.reset();
    },
    onError: (err: AxiosError) =>
      toast.error((err.response?.data as { message?: string })?.message ?? "Une erreur est survenue"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RoleRequest }) => usersApi.updateRole(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Rôle modifié");
      setEditOpen(false);
    },
    onError: (err: AxiosError) =>
      toast.error((err.response?.data as { message?: string })?.message ?? "Une erreur est survenue"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Rôle supprimé");
      setDeleteOpen(false);
      setSelectedRole(null);
    },
    onError: (err: AxiosError) =>
      toast.error((err.response?.data as { message?: string })?.message ?? "Une erreur est survenue"),
  });

  const createForm = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: "", permissionIds: [] },
  });
  const editForm = useForm<RoleFormValues>({ resolver: zodResolver(roleSchema) });

  function openEdit(role: Role) {
    setSelectedRole(role);
    editForm.reset({
      name: role.name,
      permissionIds: (role.permissions ?? []).map((p) => p.id),
    });
    setEditOpen(true);
  }
  function openDelete(role: Role) {
    setSelectedRole(role);
    setDeleteOpen(true);
  }
  function onCreateSubmit(v: RoleFormValues) {
    createMutation.mutate({ name: v.name, permissionIds: v.permissionIds ?? [] });
  }
  function onEditSubmit(v: RoleFormValues) {
    if (!selectedRole) return;
    updateMutation.mutate({ id: selectedRole.id, data: { name: v.name, permissionIds: v.permissionIds ?? [] } });
  }

  // ---- Colonnes (calque users/roles/index Laravel : Nom, Slug, Créé par, Actions) ----

  const columns: ColumnDef<Role>[] = [
    {
      header: "Nom",
      accessorKey: "name",
      cell: ({ row }) => <span className="font-medium text-gray-900">{row.original.name}</span>,
    },
    {
      header: "Slug",
      accessorKey: "slug",
      cell: ({ row }) => <span className="text-gray-600">{row.original.slug ?? "—"}</span>,
    },
    {
      header: "Créé par",
      id: "createdBy",
      cell: ({ row }) => row.original.createdByName ?? "—",
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PermissionGate permission={PERMISSIONS.EDIT_ROLES}>
            <IconButton
              variant="view"
              title="Voir / modifier"
              aria-label="Voir / modifier"
              onClick={() => openEdit(row.original)}
              icon={<Eye className="h-4 w-4" />}
            />
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.EDIT_ROLES}>
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
        title="Rôles"
        action={
          can(PERMISSIONS.EDIT_ROLES) ? (
            <button
              onClick={() => {
                createForm.reset();
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-[.15rem] bg-blue-600 px-[.9rem] py-[.45rem] text-[.9rem] font-normal text-white transition-[background-color,box-shadow] hover:shadow-[0_2px_6px_0_rgba(114,124,245,0.5)]"
            >
              Ajouter un nouveau rôle
            </button>
          ) : undefined
        }
      />

      <DataTableCard title="Liste des rôles" columns={columns} data={roles} isLoading={isLoading} />

      {/* ---- Modal création ---- */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Ajouter un nouveau rôle"
        size="2xl"
        onSubmit={createForm.handleSubmit(onCreateSubmit)}
        submitLabel="Ajouter un nouveau rôle"
        isSubmitting={createMutation.isPending}
      >
        <RoleForm form={createForm} permissions={permissions} />
      </CrudModal>

      {/* ---- Modal édition ---- */}
      <CrudModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Mettre à jour le role ${selectedRole?.name ?? ""}`}
        size="2xl"
        onSubmit={editForm.handleSubmit(onEditSubmit)}
        submitLabel="Mettre à jour"
        isSubmitting={updateMutation.isPending}
      >
        <RoleForm form={editForm} permissions={permissions} />
      </CrudModal>

      {/* ---- Modal confirmation suppression ---- */}
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setSelectedRole(null);
        }}
        onConfirm={() => {
          if (selectedRole) deleteMutation.mutate(selectedRole.id);
        }}
        title="Supprimer ce rôle"
        message={`Voulez-vous vraiment supprimer le rôle "${selectedRole?.name ?? ""}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// RoleForm — Nom + matrice de permissions (calque roles/create & roles/show)
// ---------------------------------------------------------------------------

function RoleForm({
  form,
  permissions,
}: {
  form: UseFormReturn<RoleFormValues>;
  permissions: Permission[];
}) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-4">
      <FormField label="Nom" required error={errors.name?.message}>
        <input type="text" {...register("name")} className={inputClass} />
      </FormField>

      <Controller
        name="permissionIds"
        control={control}
        render={({ field }) => (
          <PermissionMatrix
            permissions={permissions}
            value={field.value ?? []}
            onChange={field.onChange}
          />
        )}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PermissionMatrix — tableau ressources × opérations avec cases à cocher
// (calque du tableau de permissions des rôles Laravel).
// ---------------------------------------------------------------------------

function PermissionMatrix({
  permissions,
  value,
  onChange,
}: {
  permissions: Permission[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { operations, resources, lookup } = useMemo(() => {
    const opsPresent = new Set<string>();
    const resSet = new Set<string>();
    const map = new Map<string, Map<string, string>>(); // resource -> op -> permissionId
    for (const p of permissions) {
      const op = extractOperation(p.slug);
      const res = extractResource(p.slug);
      opsPresent.add(op);
      resSet.add(res);
      if (!map.has(res)) map.set(res, new Map());
      map.get(res)!.set(op, p.id);
    }
    const operations = OPERATIONS.filter((o) => opsPresent.has(o));
    const resources = Array.from(resSet).sort();
    return { operations, resources, lookup: map };
  }, [permissions]);

  const selected = new Set(value);
  const allIds = permissions.map((p) => p.id);
  const allChecked = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggle(id: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    onChange(Array.from(next));
  }
  function toggleAll(checked: boolean) {
    onChange(checked ? [...allIds] : []);
  }

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">Permissions</label>
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                  Tous les droits
                </label>
              </th>
              {operations.map((op) => (
                <th key={op} className="px-3 py-2 text-center font-semibold uppercase text-gray-600">
                  {op}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resources.map((res) => (
              <tr key={res} className="border-b border-gray-100 last:border-0">
                <td className="px-3 py-2 font-medium text-gray-800">{res.replace(/-/g, " ")}</td>
                {operations.map((op) => {
                  const id = lookup.get(res)?.get(op);
                  return (
                    <td key={op} className="px-3 py-2 text-center">
                      {id ? (
                        <input
                          type="checkbox"
                          checked={selected.has(id)}
                          onChange={(e) => toggle(id, e.target.checked)}
                        />
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
