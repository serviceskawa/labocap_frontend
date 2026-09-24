"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Controller,
  get,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type FieldPath,
  type UseFormRegister,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";

import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { FormField } from "@/components/ui/FormField";
import { TextInput } from "@/components/ui/TextInput";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { biologySheetApi } from "@/lib/api/biologyCatalog";
import { unitesMesureApi, type UniteMesure } from "@/lib/api/examens";
import { getApiErrorMessage } from "@/lib/api/errorMessages";
import type { ApiError } from "@/types/api";
import {
  AGE_UNIT_LABELS,
  emptyParameter,
  emptyRange,
  emptySection,
  formToSheetRequest,
  sheetSchema,
  sheetToForm,
  type SheetForm,
} from "./sheetForm";

/**
 * Éditeur de la fiche de paramètres d'une analyse de biologie PANEL :
 * sections → paramètres → valeurs de référence.
 *
 * La fiche s'enregistre en bloc (`PUT /biology-parameters/sheet/{id}`) : ce
 * qui n'est plus dans le formulaire est supprimé côté serveur, et l'ordre
 * affiché devient l'ordre d'impression. D'où un seul bouton « Enregistrer la
 * fiche » plutôt qu'une sauvegarde par ligne.
 */

type ParamListPath = "parameters" | `sections.${number}.parameters`;
type ParamPath = `${ParamListPath}.${number}`;

const RESULT_TYPE_LABELS = {
  NUMERIC: "Numérique",
  TEXT: "Texte",
  CHOICE: "Choix",
} as const;

interface Ctx {
  control: Control<SheetForm>;
  register: UseFormRegister<SheetForm>;
  errors: FieldErrors<SheetForm>;
  units: UniteMesure[];
  readOnly: boolean;
}

const errorOf = (errors: FieldErrors<SheetForm>, path: string): string | undefined =>
  (get(errors, path) as { message?: string } | undefined)?.message;

/** `NativeSelect` piloté par react-hook-form. */
function SelectCtl({
  ctx,
  name,
  children,
  className,
  placeholder,
}: {
  ctx: Ctx;
  name: FieldPath<SheetForm>;
  children: React.ReactNode;
  className?: string;
  placeholder?: string;
}) {
  return (
    <Controller
      control={ctx.control}
      name={name}
      render={({ field }) => (
        <NativeSelect
          className={className}
          name={field.name}
          value={String(field.value ?? "")}
          onChange={(e) => field.onChange(e.target.value)}
          disabled={ctx.readOnly}
          placeholder={placeholder}
          error={!!errorOf(ctx.errors, name)}
        >
          {children}
        </NativeSelect>
      )}
    />
  );
}

/** Trois boutons d'ordre / retrait, icônes seules. */
function OrderButtons({
  index,
  count,
  onMove,
  onRemove,
  what,
}: {
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
  what: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <IconButton
        variant="secondary"
        title={`Monter ${what}`}
        icon={<ArrowUp className="h-4 w-4" />}
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
      />
      <IconButton
        variant="secondary"
        title={`Descendre ${what}`}
        icon={<ArrowDown className="h-4 w-4" />}
        disabled={index === count - 1}
        onClick={() => onMove(index, index + 1)}
      />
      <IconButton
        variant="delete"
        title={`Supprimer ${what}`}
        icon={<Trash2 className="h-4 w-4" />}
        onClick={onRemove}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Choix d'un paramètre CHOICE
// ---------------------------------------------------------------------------

function ChoicesEditor({ ctx, path }: { ctx: Ctx; path: ParamPath }) {
  const { fields, append, remove } = useFieldArray({
    control: ctx.control,
    name: `${path}.choices`,
  });
  const listError = errorOf(ctx.errors, `${path}.choices`);

  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[.8125rem] font-semibold text-gray-700">Choix proposés</span>
        {!ctx.readOnly && (
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => append({ value: "" })}
          >
            Ajouter un choix
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {fields.map((f, i) => (
          <div key={f.id} className="flex items-center gap-1">
            <TextInput
              className="w-44"
              placeholder={`Choix ${i + 1}`}
              {...ctx.register(`${path}.choices.${i}.value`)}
            />
            {!ctx.readOnly && (
              <IconButton
                variant="ghost"
                title="Retirer ce choix"
                icon={<X className="h-4 w-4" />}
                onClick={() => remove(i)}
              />
            )}
          </div>
        ))}
      </div>
      {listError && (
        <p className="mt-2 text-xs font-medium text-red-600" role="alert">
          {listError}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Valeurs de référence d'un paramètre NUMERIC
// ---------------------------------------------------------------------------

function AgeInput({
  ctx,
  base,
  which,
  label,
}: {
  ctx: Ctx;
  base: `${ParamPath}.ranges.${number}`;
  which: "ageMin" | "ageMax";
  label: string;
}) {
  const error = errorOf(ctx.errors, `${base}.${which}`);
  return (
    <FormField label={label} error={error} className="w-[13.5rem]">
      <div className="flex gap-1.5">
        <TextInput
          type="number"
          min={0}
          placeholder="—"
          className="w-20 shrink-0"
          {...ctx.register(`${base}.${which}`)}
          error={!!error}
        />
        <SelectCtl ctx={ctx} name={`${base}.${which}Unit`} className="flex-1">
          {(Object.keys(AGE_UNIT_LABELS) as (keyof typeof AGE_UNIT_LABELS)[]).map((u) => (
            <option key={u} value={u}>
              {AGE_UNIT_LABELS[u]}
            </option>
          ))}
        </SelectCtl>
      </div>
    </FormField>
  );
}

function RangesEditor({ ctx, path }: { ctx: Ctx; path: ParamPath }) {
  const { fields, append, remove } = useFieldArray({
    control: ctx.control,
    name: `${path}.ranges`,
  });

  const num = (base: `${ParamPath}.ranges.${number}`, field: "low" | "high" | "criticalLow" | "criticalHigh", label: string) => {
    const error = errorOf(ctx.errors, `${base}.${field}`);
    return (
      <FormField label={label} error={error} className="w-28">
        <TextInput inputMode="decimal" placeholder="—" {...ctx.register(`${base}.${field}`)} error={!!error} />
      </FormField>
    );
  };

  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <span className="text-[.8125rem] font-semibold text-gray-700">Valeurs de référence</span>
          <p className="text-xs text-gray-500">
            Âge minimal inclus, âge maximal exclu (1 an = 365 j, 1 mois = 30 j). Vide = sans limite.
          </p>
        </div>
        {!ctx.readOnly && (
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => append(emptyRange())}
          >
            Ajouter une plage
          </Button>
        )}
      </div>

      {fields.length === 0 ? (
        <p className="text-xs text-gray-500">
          Aucune plage chiffrée : seul le texte de référence sera affiché, sans indicateur.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {fields.map((f, i) => {
            const base = `${path}.ranges.${i}` as const;
            const sexError = errorOf(ctx.errors, `${base}.sex`);
            return (
              <li
                key={f.id}
                data-range-row
                className="flex flex-wrap items-start gap-3 rounded-lg border border-gray-200 bg-white p-3"
              >
                <FormField label="Sexe" error={sexError} className="w-40">
                  <SelectCtl ctx={ctx} name={`${base}.sex`}>
                    <option value="">Les deux</option>
                    <option value="M">Masculin</option>
                    <option value="F">Féminin</option>
                  </SelectCtl>
                </FormField>
                <AgeInput ctx={ctx} base={base} which="ageMin" label="Âge min." />
                <AgeInput ctx={ctx} base={base} which="ageMax" label="Âge max." />
                {num(base, "low", "Bas")}
                {num(base, "high", "Haut")}
                {num(base, "criticalLow", "Crit. bas")}
                {num(base, "criticalHigh", "Crit. haut")}
                <div className="flex min-w-[14rem] flex-1 items-end gap-2">
                  <FormField label="Population" error={errorOf(ctx.errors, `${base}.label`)} className="flex-1">
                    <TextInput placeholder="ex. : Nouveau-né" {...ctx.register(`${base}.label`)} />
                  </FormField>
                  {!ctx.readOnly && (
                    <IconButton
                      variant="delete"
                      title="Supprimer cette plage"
                      icon={<Trash2 className="h-4 w-4" />}
                      onClick={() => remove(i)}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paramètre
// ---------------------------------------------------------------------------

function ParameterRow({
  ctx,
  path,
  index,
  count,
  onMove,
  onRemove,
}: {
  ctx: Ctx;
  path: ParamPath;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
}) {
  const resultType = useWatch({ control: ctx.control, name: `${path}.resultType` });
  const e = (field: string) => errorOf(ctx.errors, `${path}.${field}`);

  return (
    <div data-parameter-row className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-start gap-3">
        <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-6 xl:grid-cols-12">
          <FormField label="Code" error={e("code")} className="xl:col-span-2">
            <TextInput placeholder="ex. : HB" {...ctx.register(`${path}.code`)} error={!!e("code")} />
          </FormField>
          <FormField label="Nom" required error={e("name")} className="md:col-span-4 xl:col-span-4">
            <TextInput placeholder="ex. : Hémoglobine" {...ctx.register(`${path}.name`)} error={!!e("name")} />
          </FormField>
          <FormField label="Type de résultat" required className="md:col-span-2 xl:col-span-2">
            <SelectCtl ctx={ctx} name={`${path}.resultType`}>
              {(Object.keys(RESULT_TYPE_LABELS) as (keyof typeof RESULT_TYPE_LABELS)[]).map((t) => (
                <option key={t} value={t}>
                  {RESULT_TYPE_LABELS[t]}
                </option>
              ))}
            </SelectCtl>
          </FormField>
          <FormField label="Décimales" error={e("decimals")} className="xl:col-span-1">
            <TextInput
              type="number"
              min={0}
              max={6}
              disabled={ctx.readOnly || resultType !== "NUMERIC"}
              {...ctx.register(`${path}.decimals`)}
              error={!!e("decimals")}
            />
          </FormField>
          <FormField label="Unité" className="md:col-span-2 xl:col-span-3">
            <SelectCtl ctx={ctx} name={`${path}.unitMeasurementId`} placeholder="Aucune">
              <option value="">Aucune</option>
              {ctx.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.abbreviation ? `${u.name} (${u.abbreviation})` : u.name}
                </option>
              ))}
            </SelectCtl>
          </FormField>
          <FormField
            label="Valeurs de référence (texte)"
            hint="Imprimé tel quel ; utilisé quand aucune plage chiffrée ne s'applique."
            className="col-span-2 md:col-span-4 xl:col-span-8"
          >
            <TextInput placeholder="ex. : 13 – 17 g/dL" {...ctx.register(`${path}.referenceText`)} />
          </FormField>
          <div className="col-span-2 flex flex-wrap items-center gap-4 pt-6 xl:col-span-4">
            <Checkbox label="Imprimé" {...ctx.register(`${path}.printable`)} />
            <Checkbox
              label="Indicateurs (L/H)"
              disabled={ctx.readOnly || resultType !== "NUMERIC"}
              {...ctx.register(`${path}.flaggable`)}
            />
          </div>
        </div>
        {!ctx.readOnly && (
          <div className="pt-6">
            <OrderButtons index={index} count={count} onMove={onMove} onRemove={onRemove} what="ce paramètre" />
          </div>
        )}
      </div>

      {resultType === "CHOICE" && <ChoicesEditor ctx={ctx} path={path} />}
      {resultType === "NUMERIC" && <RangesEditor ctx={ctx} path={path} />}
    </div>
  );
}

function ParameterList({ ctx, name }: { ctx: Ctx; name: ParamListPath }) {
  const { fields, append, remove, move } = useFieldArray({ control: ctx.control, name });

  return (
    <div className="flex flex-col gap-3">
      {fields.length === 0 && (
        <p className="text-sm text-gray-500">Aucun paramètre dans cette section.</p>
      )}
      {fields.map((f, i) => (
        <ParameterRow
          key={f.id}
          ctx={ctx}
          path={`${name}.${i}`}
          index={i}
          count={fields.length}
          onMove={move}
          onRemove={() => remove(i)}
        />
      ))}
      {!ctx.readOnly && (
        <div>
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => append(emptyParameter())}
          >
            Ajouter un paramètre
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Éditeur
// ---------------------------------------------------------------------------

interface ParameterSheetEditorProps {
  labTestId: string;
  /** Sans `manage-biology-parameters` : consultation seule. */
  readOnly?: boolean;
}

export function ParameterSheetEditor({ labTestId, readOnly = false }: ParameterSheetEditorProps) {
  const queryClient = useQueryClient();

  const { data: sheet, isLoading } = useQuery({
    queryKey: ["biology-sheet", labTestId],
    queryFn: () => biologySheetApi.get(labTestId).then((r) => r.data),
  });

  const { data: units = [] } = useQuery<UniteMesure[]>({
    queryKey: ["units"],
    queryFn: () => unitesMesureApi.findAll().then((r) => r.data),
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SheetForm>({
    resolver: zodResolver(sheetSchema),
    defaultValues: { sections: [], parameters: [] },
  });

  useEffect(() => {
    if (sheet) reset(sheetToForm(sheet));
  }, [sheet, reset]);

  const sections = useFieldArray({ control, name: "sections" });
  const looseParameters = useWatch({ control, name: "parameters" });

  const ctx: Ctx = { control, register, errors, units, readOnly };

  const save = handleSubmit(
    async (values) => {
      try {
        const res = await biologySheetApi.save(labTestId, formToSheetRequest(values));
        queryClient.setQueryData(["biology-sheet", labTestId], res.data);
        reset(sheetToForm(res.data));
        toast.success("Fiche de paramètres enregistrée");
      } catch (err) {
        toast.error(getApiErrorMessage(err as AxiosError<ApiError>, "Erreur lors de l'enregistrement de la fiche"));
      }
    },
    () => {
      toast.error("La fiche contient des erreurs : corrigez les champs signalés.");
    },
  );

  if (isLoading) {
    return (
      <div className="hyper-card hyper-card-body space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="hyper-card">
      <div className="hyper-card-body flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="hyper-card-heading">Fiche de paramètres</h2>
            <p className="text-xs text-gray-500">
              L&apos;ordre affiché est l&apos;ordre de saisie et d&apos;impression.
              {isDirty && !readOnly && " Modifications non enregistrées."}
            </p>
          </div>
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => sections.append(emptySection())}
              >
                Ajouter une section
              </Button>
              <Button icon={<Save className="h-4 w-4" />} onClick={() => save()}>
                Enregistrer la fiche
              </Button>
            </div>
          )}
        </div>

        <fieldset disabled={readOnly} className="flex flex-col gap-4">
          {sections.fields.length === 0 && (looseParameters?.length ?? 0) === 0 && (
            <EmptyState
              compact
              title="Fiche vide"
              description="Ajoutez une section (ex. : « Hémogramme »), puis ses paramètres."
            />
          )}

          {sections.fields.map((s, si) => {
            const titleError = errorOf(errors, `sections.${si}.title`);
            return (
              <section
                key={s.id}
                data-section
                className="flex flex-col gap-3 rounded-[var(--radius-surface)] border border-gray-200 bg-gray-50/60 p-4"
              >
                <div className="flex items-start gap-3">
                  <FormField label={`Section ${si + 1}`} required error={titleError} className="flex-1">
                    <TextInput
                      placeholder="Titre de la section, ex. : Hémogramme"
                      {...register(`sections.${si}.title`)}
                      error={!!titleError}
                    />
                  </FormField>
                  {!readOnly && (
                    <div className="pt-6">
                      <OrderButtons
                        index={si}
                        count={sections.fields.length}
                        onMove={sections.move}
                        onRemove={() => sections.remove(si)}
                        what="cette section"
                      />
                    </div>
                  )}
                </div>
                <ParameterList ctx={ctx} name={`sections.${si}.parameters`} />
              </section>
            );
          })}

          {(looseParameters?.length ?? 0) > 0 && (
            <section className="flex flex-col gap-3 rounded-[var(--radius-surface)] border border-dashed border-gray-300 p-4">
              <h3 className="text-[.875rem] font-semibold text-gray-700">Paramètres hors section</h3>
              <ParameterList ctx={ctx} name="parameters" />
            </section>
          )}
        </fieldset>
      </div>
    </div>
  );
}
