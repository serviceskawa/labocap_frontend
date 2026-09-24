"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, X } from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTableCard } from "@/components/common/DataTableCard";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { RowActions, type RowAction } from "@/components/ui/RowActions";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Badge } from "@/components/ui/Badge";
import { FormField } from "@/components/ui/FormField";
import { TextInput } from "@/components/ui/TextInput";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { cultureOptionsApi, type CultureOption } from "@/lib/api/biologyCatalog";
import { getApiErrorMessage } from "@/lib/api/errorMessages";
import type { ApiError } from "@/types/api";

/**
 * Options de culture : rubriques d'une analyse CULTURE (aspect, examen
 * direct, identification…), chacune avec ses valeurs proposées. Une option
 * sans valeur est une saisie libre. Écriture sous `manage-culture-options`.
 */

const schema = z
  .object({
    name: z.string().trim().min(1, "Le nom est requis").max(150, "150 caractères au maximum"),
    position: z
      .string()
      .trim()
      .refine((v) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 0), {
        message: "Le rang doit être un entier positif",
      }),
    choices: z.array(z.object({ value: z.string() })),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    v.choices.forEach((c, i) => {
      const key = c.value.trim().toLowerCase();
      if (!key) return;
      if (seen.has(key)) {
        ctx.addIssue({ code: "custom", path: ["choices", i, "value"], message: "Valeur en double" });
      }
      seen.add(key);
    });
  });
type FormData = z.infer<typeof schema>;

const EMPTY: FormData = { name: "", position: "", choices: [] };

export default function OptionsDeCulturePage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.MANAGE_CULTURE_OPTIONS);

  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ mode: "create" | "edit"; item?: CultureOption } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CultureOption | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const { fields, append, remove, move } = useFieldArray({ control, name: "choices" });

  const { data, isLoading } = useQuery({
    queryKey: ["culture-options"],
    queryFn: () => cultureOptionsApi.findAll().then((r) => r.data),
  });

  const q = search.trim().toLowerCase();
  const rows = (data ?? []).filter(
    (o) =>
      !q ||
      o.name.toLowerCase().includes(q) ||
      o.choices.some((c) => c.toLowerCase().includes(q)),
  );

  const onError = (fallback: string) => (err: AxiosError<ApiError>) =>
    toast.error(getApiErrorMessage(err, fallback));

  const saveMutation = useMutation({
    mutationFn: (v: FormData) => {
      const payload = {
        name: v.name.trim(),
        position: v.position === "" ? 0 : Number(v.position),
        choices: v.choices.map((c) => c.value.trim()).filter(Boolean),
      };
      return modal?.mode === "edit" && modal.item
        ? cultureOptionsApi.update(modal.item.id, payload)
        : cultureOptionsApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["culture-options"] });
      toast.success(
        modal?.mode === "edit"
          ? "Option de culture modifiée avec succès"
          : "Option de culture créée avec succès",
      );
      setModal(null);
      reset(EMPTY);
    },
    onError: onError("Erreur lors de l'enregistrement"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => cultureOptionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["culture-options"] });
      toast.success("Option de culture supprimée avec succès");
      setDeleteConfirm(null);
    },
    onError: onError("Erreur lors de la suppression"),
  });

  const openEdit = (o: CultureOption) => {
    reset({
      name: o.name,
      position: String(o.position ?? 0),
      choices: o.choices.map((value) => ({ value })),
    });
    setModal({ mode: "edit", item: o });
  };

  const columns: ColumnDef<CultureOption>[] = [
    { header: "Nom", accessorKey: "name" },
    {
      header: "Valeurs proposées",
      id: "choices",
      cell: ({ row }) =>
        row.original.choices.length === 0 ? (
          <span className="text-gray-400">Saisie libre</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {row.original.choices.map((c) => (
              <Badge key={c} variant="secondary">
                {c}
              </Badge>
            ))}
          </div>
        ),
    },
    { header: "Rang", accessorKey: "position" },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => {
        if (!canManage) return null;
        const actions: RowAction[] = [
          {
            label: "Modifier",
            icon: <Pencil className="h-4 w-4" />,
            variant: "edit",
            onClick: () => openEdit(row.original),
          },
          {
            label: "Supprimer",
            icon: <Trash2 className="h-4 w-4" />,
            variant: "delete",
            onClick: () => setDeleteConfirm(row.original),
          },
        ];
        return <RowActions actions={actions} />;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Options de culture"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Biologie" },
          { label: "Options de culture" },
        ]}
        action={
          <PermissionGate permission={PERMISSIONS.MANAGE_CULTURE_OPTIONS}>
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => {
                reset(EMPTY);
                setModal({ mode: "create" });
              }}
            >
              Ajouter une option
            </Button>
          </PermissionGate>
        }
      />

      <DataTableCard
        columns={columns}
        data={rows}
        isLoading={isLoading}
        hideToolbarSearch
        filters={
          <SearchInput
            className="max-w-xs w-full"
            placeholder="Rechercher une option ou une valeur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        }
      />

      <CrudModal
        isOpen={modal !== null}
        onClose={() => {
          setModal(null);
          reset(EMPTY);
        }}
        size="lg"
        title={modal?.mode === "edit" ? "Modifier l'option de culture" : "Ajouter une option de culture"}
        onSubmit={handleSubmit((v) => saveMutation.mutateAsync(v).catch(() => undefined))}
        submitLabel={modal?.mode === "edit" ? "Modifier" : "Ajouter"}
        isSubmitting={saveMutation.isPending}
      >
        <form noValidate className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <FormField label="Nom" required error={errors.name?.message} className="sm:col-span-3">
              <TextInput placeholder="ex. : Aspect macroscopique" {...register("name")} error={!!errors.name} />
            </FormField>
            <FormField label="Rang" error={errors.position?.message}>
              <TextInput type="number" min={0} {...register("position")} error={!!errors.position} />
            </FormField>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Valeurs proposées</span>
              <Button
                size="sm"
                variant="secondary"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => append({ value: "" })}
              >
                Ajouter une valeur
              </Button>
            </div>
            {fields.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center text-sm text-gray-500">
                Aucune valeur : la rubrique sera une saisie libre.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {fields.map((field, i) => (
                  <li key={field.id} className="flex items-start gap-2">
                    <div className="flex-1">
                      <TextInput
                        placeholder={`Valeur ${i + 1}`}
                        {...register(`choices.${i}.value`)}
                        error={!!errors.choices?.[i]?.value}
                      />
                      {errors.choices?.[i]?.value?.message && (
                        <p className="mt-1 text-xs text-red-600">{errors.choices[i]?.value?.message}</p>
                      )}
                    </div>
                    <IconButton
                      variant="secondary"
                      title="Monter"
                      icon={<ArrowUp className="h-4 w-4" />}
                      disabled={i === 0}
                      onClick={() => move(i, i - 1)}
                    />
                    <IconButton
                      variant="secondary"
                      title="Descendre"
                      icon={<ArrowDown className="h-4 w-4" />}
                      disabled={i === fields.length - 1}
                      onClick={() => move(i, i + 1)}
                    />
                    <IconButton
                      variant="delete"
                      title="Retirer"
                      icon={<X className="h-4 w-4" />}
                      onClick={() => remove(i)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </form>
      </CrudModal>

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) deleteMutation.mutate(deleteConfirm.id);
        }}
        title="Supprimer cette option de culture"
        message={
          deleteConfirm
            ? `Voulez-vous vraiment supprimer l'option « ${deleteConfirm.name} » ? Elle sera retirée des analyses qui l'utilisent.`
            : ""
        }
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
