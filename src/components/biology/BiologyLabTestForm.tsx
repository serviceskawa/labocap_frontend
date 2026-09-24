"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Save } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { TextInput } from "@/components/ui/TextInput";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { categoryTestsApi, type LabTest, type LabTestRequest } from "@/lib/api/examens";
import type { BiologyKind } from "@/types/api";
import { BIOLOGY_KIND_LABELS } from "./BiologyKindBadge";

/**
 * Informations générales d'une analyse de biologie (création et modification).
 *
 * La nature (PANEL / CULTURE) est figée après création par le backend : le
 * champ est verrouillé en modification plutôt que de laisser partir une
 * requête vouée au refus.
 */

export const biologyLabTestSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis"),
  code: z.string().trim().max(50, "50 caractères au maximum"),
  price: z
    .string()
    .min(1, "Le prix est requis")
    .refine((v) => Number(v) > 0, { message: "Veuillez renseigner un prix supérieur à zéro" }),
  categoryTestId: z.string().min(1, "La catégorie est requise"),
  biologyKind: z.enum(["PANEL", "CULTURE"]),
  specimenType: z.string().trim().max(100, "100 caractères au maximum"),
  status: z.enum(["ACTIF", "INACTIF"]),
});
export type BiologyLabTestFormData = z.infer<typeof biologyLabTestSchema>;

export function toBiologyLabTestRequest(v: BiologyLabTestFormData): LabTestRequest {
  return {
    name: v.name.trim(),
    code: v.code.trim() || null,
    price: Number(v.price),
    categoryTestId: v.categoryTestId,
    status: v.status,
    discipline: "BIOLOGY",
    biologyKind: v.biologyKind,
    specimenType: v.specimenType.trim() || null,
  };
}

function fromLabTest(t?: LabTest): BiologyLabTestFormData {
  return {
    name: t?.name ?? "",
    code: t?.code ?? "",
    price: t ? String(t.price ?? "") : "",
    categoryTestId: t?.categoryTestId ?? "",
    biologyKind: (t?.biologyKind ?? "PANEL") as BiologyKind,
    specimenType: t?.specimenType ?? "",
    status: t?.status === "INACTIF" ? "INACTIF" : "ACTIF",
  };
}

/** Types d'échantillon courants, proposés à la saisie (saisie libre possible). */
const SPECIMEN_SUGGESTIONS = [
  "Sang total (EDTA)",
  "Sérum",
  "Plasma",
  "Urines",
  "Selles",
  "LCR",
  "Crachats",
  "Prélèvement vaginal",
  "Pus",
];

export function BiologyLabTestForm({
  labTest,
  onSubmit,
  submitLabel,
  readOnly = false,
}: {
  labTest?: LabTest;
  onSubmit: (values: BiologyLabTestFormData) => Promise<unknown>;
  submitLabel: string;
  readOnly?: boolean;
}) {
  const isEdit = !!labTest;

  const { data: categories } = useQuery({
    queryKey: ["category-tests", "BIOLOGY", "all"],
    queryFn: () =>
      categoryTestsApi
        .findAll({ page: 0, size: 1000, discipline: "BIOLOGY" })
        .then((r) => r.data),
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BiologyLabTestFormData>({
    resolver: zodResolver(biologyLabTestSchema),
    defaultValues: fromLabTest(labTest),
  });

  useEffect(() => {
    if (labTest) reset(fromLabTest(labTest));
  }, [labTest, reset]);

  const categoryOptions = categories?.content ?? [];

  return (
    <form
      noValidate
      onSubmit={(e) => e.preventDefault()}
      className="hyper-card"
    >
      <div className="hyper-card-body flex flex-col gap-4">
        <h2 className="hyper-card-heading">Informations</h2>
        <fieldset disabled={readOnly} className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <FormField label="Nom" required error={errors.name?.message} className="md:col-span-3">
            <TextInput placeholder="ex. : Numération formule sanguine" {...register("name")} error={!!errors.name} />
          </FormField>
          <FormField label="Code" error={errors.code?.message} className="md:col-span-1">
            <TextInput placeholder="ex. : NFS" {...register("code")} error={!!errors.code} />
          </FormField>
          <FormField label="Prix" required error={errors.price?.message} className="md:col-span-2">
            <TextInput type="number" min={0} {...register("price")} error={!!errors.price} />
          </FormField>

          <FormField label="Catégorie" required error={errors.categoryTestId?.message} className="md:col-span-3">
            <Controller
              control={control}
              name="categoryTestId"
              render={({ field }) => (
                <NativeSelect
                  name={field.name}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  disabled={readOnly}
                  placeholder="Sélectionner une catégorie…"
                  error={!!errors.categoryTestId}
                >
                  <option value="">Sélectionner une catégorie…</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            />
            {categories && categoryOptions.length === 0 && (
              <p className="text-xs text-gray-500">
                Aucune catégorie de biologie :{" "}
                <Link href="/biologie/categories" className="text-blue-600 hover:underline">
                  créer les catégories
                </Link>
                .
              </p>
            )}
          </FormField>

          <FormField
            label="Nature"
            required
            hint={isEdit ? "Figée après la création." : "Paramètres : NFS, ionogramme… Culture : ECBU, coproculture…"}
            className="md:col-span-3"
          >
            <Controller
              control={control}
              name="biologyKind"
              render={({ field }) => (
                <NativeSelect
                  name={field.name}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  disabled={readOnly || isEdit}
                >
                  {(Object.keys(BIOLOGY_KIND_LABELS) as BiologyKind[]).map((k) => (
                    <option key={k} value={k}>
                      {k === "PANEL" ? "Fiche de paramètres" : "Culture bactériologique"}
                    </option>
                  ))}
                </NativeSelect>
              )}
            />
          </FormField>

          <FormField label="Type d'échantillon" error={errors.specimenType?.message} className="md:col-span-3">
            <TextInput
              list="biology-specimen-types"
              placeholder="ex. : Sang total (EDTA)"
              {...register("specimenType")}
              error={!!errors.specimenType}
            />
            <datalist id="biology-specimen-types">
              {SPECIMEN_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </FormField>

          <FormField label="Statut" required className="md:col-span-3">
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <NativeSelect
                  name={field.name}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  disabled={readOnly}
                >
                  <option value="ACTIF">Actif</option>
                  <option value="INACTIF">Inactif</option>
                </NativeSelect>
              )}
            />
          </FormField>
        </fieldset>

        {!readOnly && (
          <div className="flex justify-end">
            <Button
              icon={<Save className="h-4 w-4" />}
              onClick={() => handleSubmit(async (v) => {
                await onSubmit(v);
              })()}
            >
              {submitLabel}
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}
