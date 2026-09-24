"use client";

import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { TextInput } from "@/components/ui/TextInput";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { INPUT_CLASS } from "@/lib/ui/inputClass";
import {
  ORPHAN_POSITION,
  type AntibiogramInterpretation,
  type BiologyAnalysis,
  type BiologyAntibioticRef,
  type BiologyCultureResultsRequest,
  type BiologyWorksheetSettings,
} from "@/lib/api/biologyResults";
import { parseBiologyNumber } from "./resultFlags";

/**
 * Saisie d'une analyse CULTURE : options de culture, germes isolés et, par
 * germe, antibiogramme.
 *
 * ## Ce que l'enregistrement envoie (décision)
 *
 * - `options` : une entrée par option retenue par l'analyse, telle qu'affichée
 *   (vide = effacée) ; les options qui ne sont plus retenues restent visibles,
 *   en lecture seule, et ne sont pas envoyées.
 * - `isolates` : la **liste complète** attendue par le serveur — un germe avec
 *   `id` est mis à jour, sans `id` créé, un germe retiré de l'écran supprimé
 *   avec son antibiogramme. L'ordre affiché fait foi.
 * - `antibiogram` : liste complète par germe. L'interprétation part toujours
 *   en S/I/R ; seul le libellé affiché vient du réglage `bio_antibiogram_labels`.
 *
 * Remonté par le parent après chaque enregistrement (clé dérivée de
 * l'analyse) : l'écran repart de ce que le serveur a retenu.
 */

interface AntibiogramForm {
  key: string;
  antibioticId: string;
  interpretation: AntibiogramInterpretation | "";
  mic: string;
  diameter: string;
}

interface IsolateForm {
  key: string;
  id: string | null;
  organism: string;
  quantity: string;
  antibiogram: AntibiogramForm[];
}

interface CultureForm {
  options: Record<string, string>;
  isolates: IsolateForm[];
  comment: string;
}

interface CultureEditorProps {
  analysis: BiologyAnalysis;
  settings: BiologyWorksheetSettings;
  antibiotics: BiologyAntibioticRef[];
  readOnly: boolean;
  onSave: (body: BiologyCultureResultsRequest) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
}

const INTERPRETATIONS: AntibiogramInterpretation[] = ["S", "I", "R"];
const DEFAULT_SIR: Record<AntibiogramInterpretation, string> = {
  S: "Sensible",
  I: "Intermédiaire",
  R: "Résistant",
};
const SIR_VARIANT: Record<AntibiogramInterpretation, BadgeVariant> = {
  S: "success",
  I: "warning",
  R: "danger",
};

function sirLabel(i: AntibiogramInterpretation, labels: Record<string, string> | null | undefined) {
  const custom = labels?.[i];
  return custom && custom.trim() !== "" ? custom : DEFAULT_SIR[i];
}

// Clés React des lignes ajoutées à l'écran — jamais envoyées au serveur.
let keySeq = 0;
const nextKey = () => `k${++keySeq}`;

const numberToInput = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));

function toForm(analysis: BiologyAnalysis): CultureForm {
  const options: Record<string, string> = {};
  for (const o of analysis.cultureOptions) {
    if (o.position !== ORPHAN_POSITION) options[o.cultureOptionId] = o.value ?? "";
  }
  return {
    options,
    isolates: analysis.isolates.map((g) => ({
      key: nextKey(),
      id: g.id,
      organism: g.organism ?? "",
      quantity: g.quantity ?? "",
      antibiogram: g.antibiogram.map((a) => ({
        key: nextKey(),
        antibioticId: a.antibioticId,
        interpretation: a.interpretation ?? "",
        mic: a.mic ?? "",
        diameter: numberToInput(a.diameterMm),
      })),
    })),
    comment: analysis.comment ?? "",
  };
}

/** Forme comparable d'un formulaire : sans les clés React. */
function signature(f: CultureForm): string {
  return JSON.stringify({
    o: f.options,
    c: f.comment,
    i: f.isolates.map(({ id, organism, quantity, antibiogram }) => ({
      id,
      organism,
      quantity,
      a: antibiogram.map(({ antibioticId, interpretation, mic, diameter }) => ({
        antibioticId,
        interpretation,
        mic,
        diameter,
      })),
    })),
  });
}

export function CultureEditor({
  analysis,
  settings,
  antibiotics,
  readOnly,
  onSave,
  onDirtyChange,
}: CultureEditorProps) {
  const [form, setForm] = useState<CultureForm>(() => toForm(analysis));
  const [initialSignature] = useState(() => signature(form));
  const dirty = signature(form) !== initialSignature;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const antibioticName = (id: string) => antibiotics.find((a) => a.id === id)?.name ?? "Antibiotique inconnu";

  const updateIsolate = (key: string, patch: Partial<IsolateForm>) =>
    setForm((f) => ({
      ...f,
      isolates: f.isolates.map((g) => (g.key === key ? { ...g, ...patch } : g)),
    }));

  const updateAntibiogram = (isoKey: string, rowKey: string, patch: Partial<AntibiogramForm>) =>
    setForm((f) => ({
      ...f,
      isolates: f.isolates.map((g) =>
        g.key !== isoKey
          ? g
          : { ...g, antibiogram: g.antibiogram.map((a) => (a.key === rowKey ? { ...a, ...patch } : a)) },
      ),
    }));

  const addIsolate = () =>
    setForm((f) => ({
      ...f,
      isolates: [...f.isolates, { key: nextKey(), id: null, organism: "", quantity: "", antibiogram: [] }],
    }));

  const removeIsolate = (key: string) =>
    setForm((f) => ({ ...f, isolates: f.isolates.filter((g) => g.key !== key) }));

  const addAntibiogram = (isoKey: string) =>
    setForm((f) => ({
      ...f,
      isolates: f.isolates.map((g) =>
        g.key !== isoKey
          ? g
          : {
              ...g,
              antibiogram: [
                ...g.antibiogram,
                { key: nextKey(), antibioticId: "", interpretation: "", mic: "", diameter: "" },
              ],
            },
      ),
    }));

  const removeAntibiogram = (isoKey: string, rowKey: string) =>
    setForm((f) => ({
      ...f,
      isolates: f.isolates.map((g) =>
        g.key !== isoKey ? g : { ...g, antibiogram: g.antibiogram.filter((a) => a.key !== rowKey) },
      ),
    }));

  /** Construit la requête, ou renvoie le message de la première erreur de saisie. */
  const buildRequest = (): BiologyCultureResultsRequest | string => {
    const isolates: NonNullable<BiologyCultureResultsRequest["isolates"]> = [];
    for (const [i, g] of form.isolates.entries()) {
      const organism = g.organism.trim();
      if (!organism) return `Germe n° ${i + 1} : le germe isolé est obligatoire.`;
      const seen = new Set<string>();
      const antibiogram: (typeof isolates)[number]["antibiogram"] = [];
      for (const a of g.antibiogram) {
        if (!a.antibioticId) return `« ${organism} » : choisissez l'antibiotique de chaque ligne d'antibiogramme.`;
        const name = antibioticName(a.antibioticId);
        if (seen.has(a.antibioticId)) return `« ${organism} » : ${name} figure deux fois dans l'antibiogramme.`;
        seen.add(a.antibioticId);
        if (!a.interpretation) return `« ${organism} » : interprétation (S, I ou R) manquante pour ${name}.`;
        let diameterMm: number | null = null;
        if (a.diameter.trim() !== "") {
          diameterMm = parseBiologyNumber(a.diameter);
          if (diameterMm == null || diameterMm < 0 || diameterMm > 9999.9) {
            return `« ${organism} » : diamètre de ${name} invalide (« ${a.diameter.trim()} »).`;
          }
        }
        antibiogram.push({
          antibioticId: a.antibioticId,
          interpretation: a.interpretation,
          mic: a.mic.trim() === "" ? null : a.mic.trim(),
          diameterMm,
        });
      }
      isolates.push({
        id: g.id,
        organism,
        quantity: g.quantity.trim() === "" ? null : g.quantity.trim(),
        antibiogram,
      });
    }
    return {
      options: Object.entries(form.options).map(([cultureOptionId, value]) => ({
        cultureOptionId,
        value: value.trim(),
      })),
      isolates,
      comment: form.comment.trim() === "" ? null : form.comment,
    };
  };

  const handleSave = async () => {
    const req = buildRequest();
    if (typeof req === "string") {
      toast.error(req);
      return;
    }
    await onSave(req);
  };

  const cultureOptions = analysis.cultureOptions;

  return (
    <div className="space-y-6">
      {/* ── Options de culture ───────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-[.9375rem] font-semibold text-gray-800">Culture</h3>
        {cultureOptions.length === 0 ? (
          <p className="text-[.875rem] text-gray-500">Aucune option de culture n&apos;est retenue par cette analyse.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cultureOptions.map((o) => {
              const orphan = o.position === ORPHAN_POSITION;
              const value = orphan ? (o.value ?? "") : (form.options[o.cultureOptionId] ?? "");
              const choices = o.choices ?? [];
              const fieldId = `culture-option-${analysis.id}-${o.cultureOptionId}`;
              return (
                <div key={o.cultureOptionId} data-culture-option={o.name}>
                  <label htmlFor={fieldId} className="mb-1.5 block text-[.8125rem] font-semibold text-gray-700">
                    {o.name}
                    {orphan && <span className="ml-1 font-normal text-gray-400">(option plus retenue)</span>}
                  </label>
                  {readOnly || orphan ? (
                    <p className="text-[.9rem] font-medium text-gray-800">{value || "—"}</p>
                  ) : choices.length > 0 ? (
                    <NativeSelect
                      id={fieldId}
                      value={value}
                      placeholder="—"
                      onChange={(e) =>
                        setForm((f) => ({ ...f, options: { ...f.options, [o.cultureOptionId]: e.target.value } }))
                      }
                    >
                      <option value="">—</option>
                      {value !== "" && !choices.includes(value) && <option value={value}>{value}</option>}
                      {choices.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </NativeSelect>
                  ) : (
                    <TextInput
                      id={fieldId}
                      value={value}
                      maxLength={2000}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, options: { ...f.options, [o.cultureOptionId]: e.target.value } }))
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Germes et antibiogrammes ─────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[.9375rem] font-semibold text-gray-800">Germes isolés</h3>
          {!readOnly && (
            <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={addIsolate}>
              Ajouter un germe
            </Button>
          )}
        </div>

        {form.isolates.length === 0 && (
          <p className="text-[.875rem] text-gray-500">Aucun germe isolé.</p>
        )}

        {form.isolates.map((g, gi) => {
          const used = new Set(g.antibiogram.map((a) => a.antibioticId));
          return (
            <div key={g.key} data-isolate={gi} className="rounded-lg p-4 ring-1 ring-gray-200">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[14rem] flex-[2]">
                  <label htmlFor={`${g.key}-organism`} className="mb-1.5 block text-[.8125rem] font-semibold text-gray-700">
                    Germe n° {gi + 1}
                  </label>
                  {readOnly ? (
                    <p className="text-[.9rem] font-semibold italic text-gray-800">{g.organism}</p>
                  ) : (
                    <TextInput
                      id={`${g.key}-organism`}
                      value={g.organism}
                      maxLength={200}
                      placeholder="Escherichia coli"
                      onChange={(e) => updateIsolate(g.key, { organism: e.target.value })}
                    />
                  )}
                </div>
                <div className="min-w-[10rem] flex-1">
                  <label htmlFor={`${g.key}-quantity`} className="mb-1.5 block text-[.8125rem] font-semibold text-gray-700">
                    Quantité
                  </label>
                  {readOnly ? (
                    <p className="text-[.9rem] text-gray-800">{g.quantity || "—"}</p>
                  ) : (
                    <TextInput
                      id={`${g.key}-quantity`}
                      value={g.quantity}
                      maxLength={100}
                      placeholder="10^5 UFC/mL"
                      onChange={(e) => updateIsolate(g.key, { quantity: e.target.value })}
                    />
                  )}
                </div>
                {!readOnly && (
                  <IconButton
                    variant="delete"
                    title="Retirer ce germe"
                    icon={<Trash2 className="h-4 w-4" />}
                    onClick={() => removeIsolate(g.key)}
                  />
                )}
              </div>

              <div className="mt-4">
                <div className="mb-2 text-[.8125rem] font-semibold text-gray-700">Antibiogramme</div>
                {g.antibiogram.length === 0 ? (
                  <p className="text-[.8125rem] text-gray-500">Aucun antibiotique testé.</p>
                ) : (
                  <div role="table" aria-label={`Antibiogramme — germe n° ${gi + 1}`} className="rounded-lg ring-1 ring-gray-200">
                    <div
                      role="row"
                      className="grid grid-cols-[minmax(12rem,2fr)_minmax(10rem,1.2fr)_minmax(6rem,0.7fr)_minmax(6rem,0.7fr)_2.5rem] gap-x-3 border-b border-gray-300 bg-gray-50 px-3 py-2 text-[.7rem] font-semibold uppercase tracking-[0.06em] text-gray-600"
                    >
                      <div role="columnheader">Antibiotique</div>
                      <div role="columnheader">Interprétation</div>
                      <div role="columnheader">CMI</div>
                      <div role="columnheader">Diamètre (mm)</div>
                      <div role="columnheader" className="sr-only">Actions</div>
                    </div>
                    {g.antibiogram.map((a) => (
                      <div
                        key={a.key}
                        role="row"
                        className="grid grid-cols-[minmax(12rem,2fr)_minmax(10rem,1.2fr)_minmax(6rem,0.7fr)_minmax(6rem,0.7fr)_2.5rem] items-center gap-x-3 border-b border-gray-100 px-3 py-2 last:border-b-0"
                      >
                        <div role="cell">
                          {readOnly ? (
                            <span className="text-[.875rem] text-gray-800">{antibioticName(a.antibioticId)}</span>
                          ) : (
                            <NativeSelect
                              aria-label="Antibiotique"
                              value={a.antibioticId}
                              placeholder="Antibiotique..."
                              onChange={(e) => updateAntibiogram(g.key, a.key, { antibioticId: e.target.value })}
                            >
                              <option value="">Antibiotique...</option>
                              {antibiotics.map((ab) => (
                                <option
                                  key={ab.id}
                                  value={ab.id}
                                  disabled={ab.id !== a.antibioticId && used.has(ab.id)}
                                >
                                  {ab.code ? `${ab.name} (${ab.code})` : ab.name}
                                </option>
                              ))}
                            </NativeSelect>
                          )}
                        </div>
                        <div role="cell">
                          {readOnly ? (
                            a.interpretation ? (
                              <Badge variant={SIR_VARIANT[a.interpretation]}>
                                {sirLabel(a.interpretation, settings.antibiogramLabels)}
                              </Badge>
                            ) : (
                              "—"
                            )
                          ) : (
                            <NativeSelect
                              aria-label="Interprétation"
                              value={a.interpretation}
                              placeholder="S / I / R"
                              onChange={(e) =>
                                updateAntibiogram(g.key, a.key, {
                                  interpretation: e.target.value as AntibiogramInterpretation | "",
                                })
                              }
                            >
                              <option value="">S / I / R</option>
                              {INTERPRETATIONS.map((i) => (
                                <option key={i} value={i}>
                                  {`${sirLabel(i, settings.antibiogramLabels)} (${i})`}
                                </option>
                              ))}
                            </NativeSelect>
                          )}
                        </div>
                        <div role="cell">
                          {readOnly ? (
                            <span className="text-[.875rem] text-gray-700">{a.mic || "—"}</span>
                          ) : (
                            <TextInput
                              aria-label="CMI"
                              value={a.mic}
                              maxLength={20}
                              onChange={(e) => updateAntibiogram(g.key, a.key, { mic: e.target.value })}
                            />
                          )}
                        </div>
                        <div role="cell">
                          {readOnly ? (
                            <span className="text-[.875rem] text-gray-700 tabular-nums">{a.diameter || "—"}</span>
                          ) : (
                            <TextInput
                              aria-label="Diamètre (mm)"
                              inputMode="decimal"
                              value={a.diameter}
                              className="text-right tabular-nums"
                              onChange={(e) => updateAntibiogram(g.key, a.key, { diameter: e.target.value })}
                            />
                          )}
                        </div>
                        <div role="cell">
                          {!readOnly && (
                            <IconButton
                              variant="delete"
                              title="Retirer cet antibiotique"
                              icon={<Trash2 className="h-4 w-4" />}
                              onClick={() => removeAntibiogram(g.key, a.key)}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!readOnly && (
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Plus className="h-3.5 w-3.5" />}
                      onClick={() => addAntibiogram(g.key)}
                      disabled={antibiotics.length === 0}
                      title={antibiotics.length === 0 ? "Aucun antibiotique dans le référentiel" : undefined}
                    >
                      Ajouter un antibiotique
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Commentaire et enregistrement ────────────────────────── */}
      <div>
        <label htmlFor={`comment-${analysis.id}`} className="mb-1.5 block text-[.8125rem] font-semibold text-gray-700">
          Commentaire
        </label>
        {readOnly ? (
          <p className="whitespace-pre-wrap text-[.9rem] text-gray-700">{analysis.comment || "—"}</p>
        ) : (
          <textarea
            id={`comment-${analysis.id}`}
            rows={3}
            maxLength={5000}
            value={form.comment}
            onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
            className={INPUT_CLASS}
          />
        )}
      </div>

      {!readOnly && (
        <div className="flex items-center justify-end gap-3">
          {dirty && <span className="text-xs text-gray-500">Modifications non enregistrées</span>}
          <Button icon={<Save className="h-4 w-4" />} onClick={handleSave} disabled={!dirty}>
            Enregistrer la culture
          </Button>
        </div>
      )}
    </div>
  );
}
