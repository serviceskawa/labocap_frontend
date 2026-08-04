"use client";

import { z } from "zod";
import type { UseFormRegister, FieldErrors, Control } from "react-hook-form";

import { FormField } from "@/components/ui/FormField";
import { TextInput } from "@/components/ui/TextInput";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { RHFCreatableSelect } from "@/components/ui/RHFCreatableSelect";
import type { CategoryTest } from "@/lib/api/examens";

// ---------------------------------------------------------------------------
// Schéma + type (colocalisés avec le formulaire, réutilisables par les pages)
// ---------------------------------------------------------------------------

export const labTestSchema = z.object({
  categoryTestId: z.string().min(1, "La catégorie est requise"),
  name: z.string().min(1, "Le nom est requis"),
  // Un examen à 0 F (ou à prix négatif) s'enregistrait sans rien signaler.
  price: z
    .string()
    .min(1, "Le prix est requis")
    .refine((v) => Number(v) > 0, {
      message: "Veuillez renseigner un prix supérieur à zéro",
    }),
  status: z.string().min(1, "Le statut est requis"),
});

export type LabTestFormData = z.infer<typeof labTestSchema>;

// ---------------------------------------------------------------------------
// Champs du formulaire
// ---------------------------------------------------------------------------

interface LabTestFormProps {
  register: UseFormRegister<LabTestFormData>;
  control: Control<LabTestFormData>;
  errors: FieldErrors<LabTestFormData>;
  categories: CategoryTest[];
}

export function LabTestForm({
  register,
  control,
  errors,
  categories,
}: LabTestFormProps) {
  const categoryOptions = categories.map((cat) => ({
    value: cat.id,
    label: cat.name,
  }));

  return (
    <div className="flex flex-col gap-4">
      <RHFCreatableSelect
        control={control}
        name="categoryTestId"
        label="Catégorie parente"
        required
        options={categoryOptions}
        placeholder="Rechercher ou saisir une catégorie…"
        error={errors.categoryTestId?.message}
      />

      <FormField label="Nom" required error={errors.name?.message}>
        <TextInput
          type="text"
          className="w-full rounded-lg"
          {...register("name")}
          error={!!errors.name}
        />
      </FormField>

      <FormField label="Prix" required error={errors.price?.message}>
        <TextInput
          type="number"
          min={0}
          className="w-full rounded-lg"
          {...register("price")}
          error={!!errors.price}
        />
      </FormField>

      <FormField label="Statut" required error={errors.status?.message}>
        <NativeSelect
          selectClassName="rounded-lg border-gray-300 py-2 shadow-none"
          {...register("status")}
          error={!!errors.status}
        >
          <option value="ACTIF">ACTIF</option>
          <option value="INACTIF">INACTIF</option>
        </NativeSelect>
      </FormField>
    </div>
  );
}
