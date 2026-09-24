"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { EmptyState } from "@/components/ui/EmptyState";
import { INPUT_CLASS } from "@/lib/ui/inputClass";
import { cn } from "@/lib/utils";
import {
  ORPHAN_POSITION,
  type BiologyAnalysis,
  type BiologyFlag,
  type BiologyPanelResultsRequest,
  type BiologyParameterRow,
  type BiologyWorksheetSettings,
} from "@/lib/api/biologyResults";
import { FlagBadge } from "./FlagBadge";
import {
  allowedOverrides,
  flagLabel,
  parseBiologyNumber,
  previewFlag,
  referenceDisplay,
  toInputValue,
} from "./resultFlags";

/**
 * Saisie d'une analyse PANEL : sections, paramètres, valeurs, indicateurs.
 *
 * ## Ce que l'enregistrement envoie (décision)
 *
 * Le `PUT` traite chaque paramètre listé — valeur renseignée : enregistrée ;
 * valeur vide : effacée — et laisse les absents tels quels. L'écran envoie donc
 * **exactement ce que la grille montre** : une entrée par paramètre du
 * catalogue, vide comprise. Une valeur effacée à l'écran est effacée en base ;
 * un paramètre jamais saisi, envoyé vide, reste sans valeur (le serveur n'a
 * rien à supprimer). N'envoyer que les lignes modifiées aurait obligé à
 * distinguer « vidé » de « jamais saisi » pour rien, avec le même effet.
 *
 * Les valeurs de paramètres retirés du catalogue restent affichées, en lecture
 * seule, et ne sont jamais envoyées : le serveur refuserait un paramètre qui
 * n'appartient plus à l'analyse.
 *
 * ## Indicateur manuel
 *
 * Le serveur ne le mémorise pas d'un enregistrement à l'autre : il répond
 * `flagOverridden`, et c'est à l'écran de le renvoyer tant qu'il doit tenir.
 * Il vit donc dans l'état du formulaire (initialisé depuis `flagOverridden`) et
 * part avec **chaque** enregistrement, pour toute ligne qui en porte un.
 *
 * Le composant est remonté par le parent quand la feuille du serveur change
 * (clé dérivée de l'analyse) : après un enregistrement, la grille repart des
 * valeurs et indicateurs du serveur, qui font foi.
 */

interface RowState {
  value: string;
  override: BiologyFlag | "";
}

interface ResultGridProps {
  analysis: BiologyAnalysis;
  settings: BiologyWorksheetSettings;
  readOnly: boolean;
  onSave: (body: BiologyPanelResultsRequest) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
}

const isOrphan = (row: BiologyParameterRow) => row.position === ORPHAN_POSITION;

function initialRows(analysis: BiologyAnalysis): Record<string, RowState> {
  const out: Record<string, RowState> = {};
  const all = [...analysis.sections.flatMap((s) => s.parameters), ...analysis.parameters];
  for (const row of all) {
    if (isOrphan(row)) continue;
    const r = row.result;
    out[row.parameterId] = {
      value: toInputValue(row),
      override: r?.flagOverridden && r.flag ? r.flag : "",
    };
  }
  return out;
}

// Colonnes : paramètre · résultat · unité · références · indicateur · manuel.
const GRID =
  "grid grid-cols-[minmax(10rem,2fr)_minmax(8rem,1.3fr)_minmax(3.5rem,0.6fr)_minmax(7rem,1fr)_minmax(6.5rem,0.8fr)_minmax(8rem,1fr)] items-center gap-x-3";

export function ResultGrid({ analysis, settings, readOnly, onSave, onDirtyChange }: ResultGridProps) {
  const [initial] = useState(() => initialRows(analysis));
  const [rows, setRows] = useState(initial);
  const [initialComment] = useState(analysis.comment ?? "");
  const [comment, setComment] = useState(initialComment);

  const editable = useMemo(
    () => [
      ...analysis.sections.flatMap((s) => s.parameters),
      ...analysis.parameters,
    ].filter((r) => !isOrphan(r)),
    [analysis],
  );
  const orphans = analysis.parameters.filter(isOrphan);

  const rowDirty = (id: string) =>
    rows[id].value !== initial[id].value || rows[id].override !== initial[id].override;
  const dirty = comment !== initialComment || editable.some((r) => rowDirty(r.parameterId));

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const setRow = (id: string, patch: Partial<RowState>) =>
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const handleSave = async () => {
    // Même contrôle que le serveur, pour nommer le paramètre fautif avant l'aller-retour.
    for (const r of editable) {
      const v = rows[r.parameterId].value.trim();
      if (r.resultType === "NUMERIC" && v !== "" && parseBiologyNumber(v) == null) {
        toast.error(`« ${r.name} » : « ${v} » n'est pas un nombre.`);
        return;
      }
    }
    const body: BiologyPanelResultsRequest = {
      values: editable.map((r) => {
        const { value, override } = rows[r.parameterId];
        const v = value.trim();
        return v !== "" && override
          ? { parameterId: r.parameterId, value: v, flagOverride: override }
          : { parameterId: r.parameterId, value: v };
      }),
      comment: comment.trim() === "" ? null : comment,
    };
    await onSave(body);
  };

  // Entrée passe au résultat suivant : la saisie se fait au clavier, ligne après ligne.
  const focusNext = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const inputs = Array.from(
      e.currentTarget.closest("[data-result-grid]")?.querySelectorAll<HTMLInputElement>(
        "input[data-result-input]",
      ) ?? [],
    );
    inputs[inputs.indexOf(e.currentTarget) + 1]?.focus();
  };

  if (editable.length === 0 && orphans.length === 0) {
    return (
      <EmptyState
        compact
        title="Fiche de paramètres vide"
        description="Cette analyse n'a aucun paramètre dans le catalogue de biologie."
      />
    );
  }

  const renderRow = (row: BiologyParameterRow) => {
    const orphan = isOrphan(row);
    const state = orphan ? null : rows[row.parameterId];
    const changed = state ? rowDirty(row.parameterId) : false;
    const overrides = allowedOverrides(row);
    const reference = referenceDisplay(row);
    const invalid =
      !!state &&
      row.resultType === "NUMERIC" &&
      state.value.trim() !== "" &&
      parseBiologyNumber(state.value) == null;

    let flagCell = null;
    if (state && changed) {
      const p = previewFlag(row, state.value, state.override);
      if (p) flagCell = <FlagBadge flag={p} labels={settings.flagLabels} overridden={!!state.override} preview />;
    } else if (row.result?.flag) {
      flagCell = (
        <FlagBadge
          flag={row.result.flag}
          labels={settings.flagLabels}
          overridden={row.result.flagOverridden}
        />
      );
    }

    let input;
    if (orphan || readOnly || !state) {
      input = (
        <span className="text-[.9rem] font-medium text-gray-800 tabular-nums">
          {(row.resultType === "NUMERIC" ? row.result?.value?.replace(".", ",") : row.result?.value) || "—"}
        </span>
      );
    } else if (row.resultType === "CHOICE") {
      const choices = row.choices ?? [];
      const current = state.value;
      input = (
        <NativeSelect
          aria-label={`Résultat — ${row.name}`}
          value={current}
          placeholder="—"
          onChange={(e) => setRow(row.parameterId, { value: e.target.value })}
        >
          <option value="">—</option>
          {current !== "" && !choices.includes(current) && <option value={current}>{current}</option>}
          {choices.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
      );
    } else {
      input = (
        <TextInput
          data-result-input
          aria-label={`Résultat — ${row.name}`}
          inputMode={row.resultType === "NUMERIC" ? "decimal" : undefined}
          autoComplete="off"
          value={state.value}
          error={invalid}
          title={invalid ? "Valeur non numérique" : undefined}
          className={cn(row.resultType === "NUMERIC" && "text-right tabular-nums")}
          onChange={(e) => setRow(row.parameterId, { value: e.target.value })}
          onKeyDown={focusNext}
        />
      );
    }

    return (
      <div
        key={row.parameterId}
        role="row"
        data-parameter-id={row.parameterId}
        className={cn(GRID, "border-b border-gray-100 px-3 py-2 last:border-b-0", changed && "bg-blue-50/40")}
      >
        <div role="cell" className="min-w-0">
          <div className={cn("text-[.875rem] font-medium", orphan ? "italic text-gray-500" : "text-gray-800")}>
            {row.name}
          </div>
          {row.code && <div className="text-xs text-gray-400">{row.code}</div>}
        </div>
        <div role="cell">{input}</div>
        <div role="cell" className="text-[.8125rem] text-gray-600">
          {row.unit ?? row.result?.unitSnapshot ?? ""}
        </div>
        <div role="cell" className="text-[.8125rem] text-gray-600 tabular-nums" title={row.range?.label ?? undefined}>
          {reference ?? <span className="text-gray-400">—</span>}
        </div>
        <div role="cell" className="min-w-0">{flagCell}</div>
        <div role="cell">
          {state && !readOnly && overrides.length > 0 && (
            <NativeSelect
              aria-label={`Indicateur manuel — ${row.name}`}
              value={state.override}
              placeholder={row.resultType === "NUMERIC" ? "Calculé" : "Aucun"}
              onChange={(e) => setRow(row.parameterId, { override: e.target.value as BiologyFlag | "" })}
            >
              <option value="">{row.resultType === "NUMERIC" ? "Calculé" : "Aucun"}</option>
              {overrides.map((f) => (
                <option key={f} value={f}>
                  {flagLabel(f, settings.flagLabels)}
                </option>
              ))}
            </NativeSelect>
          )}
        </div>
      </div>
    );
  };

  const topLevel = analysis.parameters.filter((r) => !isOrphan(r));
  const hasManualFlag =
    editable.some((r) => rows[r.parameterId].override !== "" || r.result?.flagOverridden) ||
    orphans.some((r) => r.result?.flagOverridden);

  return (
    <div className="space-y-5" data-result-grid>
      <div className="overflow-x-auto rounded-lg ring-1 ring-gray-200">
        <div role="table" aria-label={`Résultats — ${analysis.labTestName}`} className="min-w-[48rem]">
          <div
            role="row"
            className={cn(
              GRID,
              "border-b border-gray-300 bg-gray-50 px-3 py-2 text-[.7rem] font-semibold uppercase tracking-[0.06em] text-gray-600",
            )}
          >
            <div role="columnheader">Paramètre</div>
            <div role="columnheader">Résultat</div>
            <div role="columnheader">Unité</div>
            <div role="columnheader">Valeurs de référence</div>
            <div role="columnheader">Indicateur</div>
            <div role="columnheader">Indicateur manuel</div>
          </div>
          {analysis.sections.map((section) => (
            <div key={section.id} role="rowgroup">
              <div role="row" className="border-b border-gray-200 bg-gray-50/60 px-3 py-1.5">
                <div role="cell" className="text-[.8125rem] font-semibold text-gray-700">
                  {section.title}
                </div>
              </div>
              {section.parameters.map(renderRow)}
            </div>
          ))}
          {topLevel.length > 0 && analysis.sections.length > 0 && (
            <div role="row" className="border-b border-gray-200 bg-gray-50/60 px-3 py-1.5">
              <div role="cell" className="text-[.8125rem] font-semibold text-gray-700">
                Autres paramètres
              </div>
            </div>
          )}
          {topLevel.map(renderRow)}
          {orphans.length > 0 && (
            <>
              <div role="row" className="border-b border-gray-200 bg-gray-50/60 px-3 py-1.5">
                <div role="cell" className="text-[.8125rem] font-semibold text-gray-500">
                  Valeurs de paramètres retirés du catalogue (lecture seule)
                </div>
              </div>
              {orphans.map(renderRow)}
            </>
          )}
        </div>
      </div>

      {hasManualFlag && (
        <p className="-mt-3 text-xs text-gray-500">* indicateur posé manuellement</p>
      )}

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
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className={INPUT_CLASS}
          />
        )}
      </div>

      {!readOnly && (
        <div className="flex items-center justify-end gap-3">
          {dirty && <span className="text-xs text-gray-500">Modifications non enregistrées</span>}
          <Button icon={<Save className="h-4 w-4" />} onClick={handleSave} disabled={!dirty}>
            Enregistrer les résultats
          </Button>
        </div>
      )}
    </div>
  );
}
