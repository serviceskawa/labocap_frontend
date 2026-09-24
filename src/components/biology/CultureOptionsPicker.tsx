"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Save, X } from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";

import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cultureOptionsApi, type CultureOption } from "@/lib/api/biologyCatalog";
import { getApiErrorMessage } from "@/lib/api/errorMessages";
import type { ApiError } from "@/types/api";

/**
 * Rubriques d'une analyse CULTURE : choix et ordre des options de culture
 * (`PUT /culture-options/by-lab-test/{id}`). La liste envoyée remplace la
 * précédente et son ordre fait foi.
 */
export function CultureOptionsPicker({
  labTestId,
  readOnly = false,
}: {
  labTestId: string;
  /** Sans `manage-culture-options` : consultation seule. */
  readOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  const linkedKey = ["culture-options", "by-lab-test", labTestId];

  const { data: all = [], isLoading: loadingAll } = useQuery({
    queryKey: ["culture-options"],
    queryFn: () => cultureOptionsApi.findAll().then((r) => r.data),
  });
  const { data: linked, isLoading: loadingLinked } = useQuery({
    queryKey: linkedKey,
    queryFn: () => cultureOptionsApi.findByLabTest(labTestId).then((r) => r.data),
  });

  // Brouillon local : `null` tant que rien n'a été touché, la liste affichée
  // est alors celle du serveur.
  const [draft, setDraft] = useState<string[] | null>(null);
  const [toAdd, setToAdd] = useState("");
  const selected = draft ?? (linked ?? []).map((l) => l.cultureOptionId);
  const dirty = draft !== null;

  const byId = new Map<string, CultureOption>(all.map((o) => [o.id, o]));
  // Une option rattachée mais absente du référentiel chargé reste affichable
  // grâce au libellé renvoyé par le rattachement.
  const labelOf = (id: string) =>
    byId.get(id)?.name ?? linked?.find((l) => l.cultureOptionId === id)?.name ?? id;
  const choicesOf = (id: string) =>
    byId.get(id)?.choices ?? linked?.find((l) => l.cultureOptionId === id)?.choices ?? [];
  const available = all.filter((o) => !selected.includes(o.id));

  const update = (next: string[]) => setDraft(next);
  const move = (from: number, to: number) => {
    const next = [...selected];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    update(next);
  };

  const save = async () => {
    try {
      const res = await cultureOptionsApi.setForLabTest(labTestId, selected);
      queryClient.setQueryData(linkedKey, res.data);
      setDraft(null);
      toast.success("Options de culture de l'analyse enregistrées");
    } catch (err) {
      toast.error(getApiErrorMessage(err as AxiosError<ApiError>, "Erreur lors de l'enregistrement"));
    }
  };

  if (loadingAll || loadingLinked) {
    return (
      <div className="hyper-card hyper-card-body space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="hyper-card">
      <div className="hyper-card-body flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="hyper-card-heading">Options de culture</h2>
            <p className="text-xs text-gray-500">
              Rubriques proposées à la saisie du résultat, dans cet ordre.
              {dirty && !readOnly && " Modifications non enregistrées."}
            </p>
          </div>
          {!readOnly && (
            <Button icon={<Save className="h-4 w-4" />} onClick={save}>
              Enregistrer les options
            </Button>
          )}
        </div>

        {selected.length === 0 ? (
          <EmptyState
            compact
            title="Aucune option retenue"
            description="Ajoutez les rubriques de la culture (aspect, examen direct, identification…)."
          />
        ) : (
          <ol className="flex flex-col gap-2">
            {selected.map((id, i) => (
              <li
                key={id}
                data-culture-option
                className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2"
              >
                <span className="w-6 text-right text-xs font-semibold text-gray-400">{i + 1}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-800">{labelOf(id)}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {choicesOf(id).length === 0 ? (
                      <span className="text-xs text-gray-400">Saisie libre</span>
                    ) : (
                      choicesOf(id).map((c) => (
                        <Badge key={c} variant="secondary">
                          {c}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-1.5">
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
                      disabled={i === selected.length - 1}
                      onClick={() => move(i, i + 1)}
                    />
                    <IconButton
                      variant="delete"
                      title="Retirer"
                      icon={<X className="h-4 w-4" />}
                      onClick={() => update(selected.filter((s) => s !== id))}
                    />
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}

        {!readOnly && (
          <div className="flex flex-wrap items-end gap-2">
            <NativeSelect
              className="min-w-[16rem] flex-1 sm:max-w-md"
              value={toAdd}
              onChange={(e) => setToAdd(e.target.value)}
              placeholder="Choisir une option de culture…"
            >
              <option value="">Choisir une option de culture…</option>
              {available.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </NativeSelect>
            <Button
              variant="secondary"
              icon={<Plus className="h-4 w-4" />}
              disabled={!toAdd}
              onClick={() => {
                update([...selected, toAdd]);
                setToAdd("");
              }}
            >
              Ajouter
            </Button>
            {all.length === 0 && (
              <p className="w-full text-xs text-gray-500">
                Le référentiel est vide :{" "}
                <Link href="/biologie/cultures/options" className="text-blue-600 hover:underline">
                  créer des options de culture
                </Link>
                .
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
