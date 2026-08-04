"use client";

import { z } from "zod";
import type { UseFormRegister, FieldErrors } from "react-hook-form";

import { FormField } from "@/components/ui/FormField";
import { TextInput } from "@/components/ui/TextInput";

// ---------------------------------------------------------------------------
// Schéma + type
// ---------------------------------------------------------------------------

export const categorySchema = z.object({
  code: z.string().length(2, "Le code doit faire exactement 2 caractères"),
  name: z.string().min(1, "Le nom est requis"),
});

export type CategoryFormData = z.infer<typeof categorySchema>;

// ---------------------------------------------------------------------------
// Champs du formulaire
// ---------------------------------------------------------------------------

interface CategoryFormProps {
  register: UseFormRegister<CategoryFormData>;
  errors: FieldErrors<CategoryFormData>;
}

export function CategoryForm({ register, errors }: CategoryFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <FormField label="Code" required error={errors.code?.message}>
        <TextInput
          type="text"
          maxLength={2}
          placeholder="ex : CF"
          className="w-full rounded-[var(--radius-control)]"
          {...register("code")}
          error={!!errors.code}
        />
      </FormField>

      <FormField label="Nom" required error={errors.name?.message}>
        <TextInput
          type="text"
          className="w-full rounded-[var(--radius-control)]"
          {...register("name")}
          error={!!errors.name}
        />
      </FormField>
    </div>
  );
}
