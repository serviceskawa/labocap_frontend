"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
import { FormField } from "@/components/ui/FormField";
import { TextInput } from "@/components/ui/TextInput";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  antibioticsApi,
  type Antibiotic,
  type AntibioticRequest,
} from "@/lib/api/biologyCatalog";
import { getApiErrorMessage } from "@/lib/api/errorMessages";
import type { ApiError } from "@/types/api";

/**
 * Référentiel des antibiotiques de l'antibiogramme (module biologie).
 * Lecture sous `view-tests`, écriture sous `manage-antibiotics`.
 */

const schema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(150, "150 caractères au maximum"),
  commercialName: z.string().trim().max(150, "150 caractères au maximum"),
  family: z.string().trim().max(100, "100 caractères au maximum"),
  code: z.string().trim().max(50, "50 caractères au maximum"),
  position: z
    .string()
    .trim()
    .refine((v) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 0), {
      message: "Le rang doit être un entier positif",
    }),
});
type FormData = z.infer<typeof schema>;

const EMPTY: FormData = { name: "", commercialName: "", family: "", code: "", position: "" };

const orNull = (v: string) => (v.trim() === "" ? null : v.trim());

function toRequest(v: FormData): AntibioticRequest {
  return {
    name: v.name.trim(),
    commercialName: orNull(v.commercialName),
    family: orNull(v.family),
    code: orNull(v.code),
    position: v.position === "" ? 0 : Number(v.position),
  };
}

export default function AntibiotiquesPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.MANAGE_ANTIBIOTICS);

  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ mode: "create" | "edit"; item?: Antibiotic } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Antibiotic | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  const { data, isLoading } = useQuery({
    queryKey: ["antibiotics"],
    queryFn: () => antibioticsApi.findAll().then((r) => r.data),
  });

  const q = search.trim().toLowerCase();
  const rows = (data ?? []).filter(
    (a) =>
      !q ||
      [a.name, a.commercialName, a.family, a.code].some((f) =>
        (f ?? "").toLowerCase().includes(q),
      ),
  );

  const onError = (fallback: string) => (err: AxiosError<ApiError>) =>
    toast.error(getApiErrorMessage(err, fallback));

  const saveMutation = useMutation({
    mutationFn: (values: FormData) =>
      modal?.mode === "edit" && modal.item
        ? antibioticsApi.update(modal.item.id, toRequest(values))
        : antibioticsApi.create(toRequest(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["antibiotics"] });
      toast.success(
        modal?.mode === "edit" ? "Antibiotique modifié avec succès" : "Antibiotique créé avec succès",
      );
      setModal(null);
      reset(EMPTY);
    },
    onError: onError("Erreur lors de l'enregistrement"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => antibioticsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["antibiotics"] });
      toast.success("Antibiotique supprimé avec succès");
      setDeleteConfirm(null);
    },
    onError: onError("Erreur lors de la suppression"),
  });

  const openEdit = (a: Antibiotic) => {
    reset({
      name: a.name,
      commercialName: a.commercialName ?? "",
      family: a.family ?? "",
      code: a.code ?? "",
      position: String(a.position ?? 0),
    });
    setModal({ mode: "edit", item: a });
  };

  const columns: ColumnDef<Antibiotic>[] = [
    { header: "Code", id: "code", cell: ({ row }) => row.original.code || "—" },
    { header: "Nom", accessorKey: "name" },
    { header: "Nom commercial", id: "commercialName", cell: ({ row }) => row.original.commercialName || "—" },
    { header: "Famille", id: "family", cell: ({ row }) => row.original.family || "—" },
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
        title="Antibiotiques"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Biologie" },
          { label: "Antibiotiques" },
        ]}
        action={
          <PermissionGate permission={PERMISSIONS.MANAGE_ANTIBIOTICS}>
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => {
                reset(EMPTY);
                setModal({ mode: "create" });
              }}
            >
              Ajouter un antibiotique
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
            placeholder="Rechercher par nom, famille ou code…"
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
        title={modal?.mode === "edit" ? "Modifier l'antibiotique" : "Ajouter un antibiotique"}
        onSubmit={handleSubmit((v) => saveMutation.mutateAsync(v).catch(() => undefined))}
        submitLabel={modal?.mode === "edit" ? "Modifier" : "Ajouter"}
        isSubmitting={saveMutation.isPending}
      >
        <form noValidate className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
          <FormField label="Nom" required error={errors.name?.message}>
            <TextInput placeholder="ex. : Amoxicilline" {...register("name")} error={!!errors.name} />
          </FormField>
          <FormField label="Nom commercial" error={errors.commercialName?.message}>
            <TextInput placeholder="ex. : Clamoxyl" {...register("commercialName")} error={!!errors.commercialName} />
          </FormField>
          <FormField label="Famille" error={errors.family?.message}>
            <TextInput placeholder="ex. : Pénicillines" {...register("family")} error={!!errors.family} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Code" error={errors.code?.message}>
              <TextInput placeholder="ex. : AMX" {...register("code")} error={!!errors.code} />
            </FormField>
            <FormField label="Rang" error={errors.position?.message} hint="Ordre dans l'antibiogramme">
              <TextInput type="number" min={0} {...register("position")} error={!!errors.position} />
            </FormField>
          </div>
        </form>
      </CrudModal>

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) deleteMutation.mutate(deleteConfirm.id);
        }}
        title="Supprimer cet antibiotique"
        message={
          deleteConfirm
            ? `Voulez-vous vraiment supprimer l'antibiotique « ${deleteConfirm.name} » ?`
            : ""
        }
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
