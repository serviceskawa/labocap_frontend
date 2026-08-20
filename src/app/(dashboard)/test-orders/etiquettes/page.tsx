"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { assignmentsApi, type Etiquette } from "@/lib/api/assignments";
import type { ApiError } from "@/types/api";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

const CLE = ["etiquettes-catalogue"];

const message = (e: unknown, repli: string) =>
  (e as AxiosError<ApiError>)?.response?.data?.message ?? repli;

/**
 * Le vocabulaire de marquage du laboratoire.
 *
 * Le catalogue se remplit tout seul à l'usage, mais une faute de frappe versée
 * une fois y restait et se proposait indéfiniment. Cet écran est là pour ça :
 * corriger et retirer.
 *
 * Ce qu'il ne fait pas, délibérément : réécrire les affectations déjà
 * enregistrées. Celles-ci consignent ce qui a été porté sur le contenant ce
 * jour-là ; les corriger après coup falsifierait une trace. D'où le nombre
 * d'usages affiché en regard — c'est ce qu'on laisse derrière soi.
 */
export default function EtiquettesPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const peutAdministrer = can(PERMISSIONS.MANAGE_TEST_ORDER_ASSIGNMENTS);

  const [nouvelle, setNouvelle] = useState("");
  const [enCoursId, setEnCoursId] = useState<string | null>(null);
  const [enCoursTexte, setEnCoursTexte] = useState("");

  const { data: etiquettes, isLoading } = useQuery({
    queryKey: CLE,
    queryFn: () => assignmentsApi.labelCatalogue().then((r) => r.data),
    enabled: peutAdministrer,
  });

  const rafraichir = () => {
    queryClient.invalidateQueries({ queryKey: CLE });
    // Les sélecteurs des écrans d'affectation lisent l'autre route.
    queryClient.invalidateQueries({ queryKey: ["etiquettes-prelevements"] });
  };

  const ajout = useMutation({
    mutationFn: (valeur: string) => assignmentsApi.addLabel(valeur),
    onSuccess: () => {
      setNouvelle("");
      rafraichir();
    },
    onError: (e) => toast.error(message(e, "Ajout impossible.")),
  });

  const renommage = useMutation({
    mutationFn: ({ id, valeur }: { id: string; valeur: string }) =>
      assignmentsApi.renameLabel(id, valeur),
    onSuccess: () => {
      setEnCoursId(null);
      rafraichir();
    },
    onError: (e) => toast.error(message(e, "Renommage impossible.")),
  });

  const retrait = useMutation({
    mutationFn: (id: string) => assignmentsApi.removeLabel(id),
    onSuccess: rafraichir,
    onError: (e) => toast.error(message(e, "Retrait impossible.")),
  });

  if (!peutAdministrer) {
    return (
      <div className="p-6">
        <PageHeader title="Étiquettes de prélèvement" />
        <p className="mt-6 text-sm text-muted-foreground">
          Vous n&apos;avez pas le droit d&apos;administrer le catalogue.
        </p>
      </div>
    );
  }

  const dejaPresente = (valeur: string) =>
    (etiquettes ?? []).some(
      (e) => e.value.toUpperCase() === valeur.trim().toUpperCase(),
    );

  const ajouter = () => {
    const valeur = nouvelle.trim();
    if (!valeur) return;
    if (dejaPresente(valeur)) {
      toast.error(`« ${valeur} » est déjà dans le catalogue.`);
      return;
    }
    ajout.mutate(valeur);
  };

  const retirer = (e: Etiquette) => {
    const suite =
      e.usages > 0
        ? `\n\nElle restera inscrite sur ${e.usages} demande${
            e.usages > 1 ? "s" : ""
          } déjà affectée${e.usages > 1 ? "s" : ""} : ce qui a été porté sur les contenants n'est pas réécrit.`
        : "";
    if (!confirm(`Retirer « ${e.value} » des propositions ?${suite}`)) return;
    retrait.mutate(e.id);
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Étiquettes de prélèvement"
        subtitle="Le vocabulaire proposé lors des affectations"
        breadcrumbs={[
          { label: "Demandes d'examen", href: "/test-orders" },
          { label: "Étiquettes" },
        ]}
      />

      <div className="mt-6 max-w-2xl space-y-6">
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={nouvelle}
            placeholder="Nouvelle étiquette — ex. L5"
            onChange={(ev) => setNouvelle(ev.target.value.toUpperCase())}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") {
                ev.preventDefault();
                ajouter();
              }
            }}
            maxLength={40}
          />
          <button
            type="button"
            onClick={ajouter}
            disabled={!nouvelle.trim() || ajout.isPending}
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {ajout.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Ajouter
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : (etiquettes ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Le catalogue est vide. Les étiquettes saisies lors des affectations
            viendront s&apos;y ajouter d&apos;elles-mêmes.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {(etiquettes ?? []).map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                {enCoursId === e.id ? (
                  <>
                    <input
                      className={`${inputClass} h-9`}
                      value={enCoursTexte}
                      autoFocus
                      maxLength={40}
                      onChange={(ev) =>
                        setEnCoursTexte(ev.target.value.toUpperCase())
                      }
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") {
                          ev.preventDefault();
                          renommage.mutate({ id: e.id, valeur: enCoursTexte });
                        }
                        if (ev.key === "Escape") setEnCoursId(null);
                      }}
                    />
                    <button
                      type="button"
                      aria-label="Valider"
                      onClick={() =>
                        renommage.mutate({ id: e.id, valeur: enCoursTexte })
                      }
                      disabled={!enCoursTexte.trim() || renommage.isPending}
                      className="text-primary disabled:opacity-40"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Annuler"
                      onClick={() => setEnCoursId(null)}
                      className="text-muted-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="font-mono text-sm font-medium">
                      {e.value}
                    </span>
                    <span className="flex-1 text-xs text-muted-foreground">
                      {e.usages === 0
                        ? "jamais employée"
                        : `${e.usages} demande${e.usages > 1 ? "s" : ""}`}
                    </span>
                    <button
                      type="button"
                      aria-label={`Renommer ${e.value}`}
                      onClick={() => {
                        setEnCoursId(e.id);
                        setEnCoursTexte(e.value);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Retirer ${e.value}`}
                      onClick={() => retirer(e)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">
          Renommer ou retirer une étiquette ne modifie que les propositions à
          venir. Les affectations déjà enregistrées gardent le texte qui y a été
          porté : c&apos;est la trace de ce qui était écrit sur le contenant.
        </p>
      </div>
    </div>
  );
}
