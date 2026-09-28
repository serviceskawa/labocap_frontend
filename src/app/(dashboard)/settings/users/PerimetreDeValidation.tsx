"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { CrudModal } from "@/components/common/CrudModal";
import { Button } from "@/components/ui/Button";
import { typeOrdersApi } from "@/lib/api/examens";
import { validationScopeApi } from "@/lib/api/validationScope";
import type { User } from "@/lib/api/users";
import { nomComplet } from "@/lib/utils";

interface Props {
  utilisateur: User;
  onClose: () => void;
}

/** Les rôles dont la validation n'est jamais bornée — mêmes slugs qu'au serveur. */
const METIERS_SANS_BORNE = ["docteur", "super-admin"];

/**
 * Les types d'examen dont ce compte peut valider les comptes rendus.
 *
 * <p>La permission « Valider un compte rendu » dit qu'on peut valider ; cet
 * écran dit quoi. Il est attaché au compte et non au rôle : deux secrétaires
 * n'ont pas la même expérience, et le rôle les confondrait.</p>
 *
 * <p>Les types sont désignés par leur libellé. La base en porte deux lignes par
 * libellé, héritage de la reprise Laravel ; cocher « Cytologie » les accorde
 * toutes les deux, sans quoi une demande sur deux se verrait refusée sans que
 * rien ne l'explique.</p>
 */
export function PerimetreDeValidation({ utilisateur, onClose }: Props) {
  const queryClient = useQueryClient();
  /** Nul tant que rien n'a été coché : on montre alors ce que porte le serveur. */
  const [touche, setTouche] = useState<string[] | null>(null);

  const sansBorne = (utilisateur.roles ?? []).some((r) =>
    METIERS_SANS_BORNE.includes((r.slug ?? "").toLowerCase()),
  );

  const types = useQuery({
    queryKey: ["type-orders-libelles"],
    queryFn: () => typeOrdersApi.findAll().then((r) => r.data),
  });

  const perimetre = useQuery({
    queryKey: ["perimetre-validation", utilisateur.id],
    queryFn: () => validationScopeApi.get(utilisateur.id).then((r) => r.data),
    enabled: !sansBorne,
  });

  /**
   * Les cases montrent ce que porte le serveur, jusqu'à la première coche.
   *
   * <p>Dérivé plutôt que recopié dans un effet : recopier ferait un rendu de
   * plus à chaque arrivée des données, et surtout écraserait une coche faite
   * pendant que la requête revenait.</p>
   */
  const coches = touche ?? perimetre.data ?? [];

  /**
   * Un libellé par type, dédoublonné : la base en porte deux lignes par
   * libellé, et les montrer toutes ferait cocher deux fois la même chose.
   */
  const libelles = useMemo(() => {
    const vus = new Set<string>();
    return (types.data ?? [])
      .map((t) => (t.title ?? "").trim())
      .filter((titre) => {
        const cle = titre.toLowerCase();
        if (!titre || vus.has(cle)) return false;
        vus.add(cle);
        return true;
      })
      .sort((a, b) => a.localeCompare(b, "fr"));
  }, [types.data]);

  const enregistrer = useMutation({
    mutationFn: () => validationScopeApi.set(utilisateur.id, coches),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["perimetre-validation", utilisateur.id],
      });
      toast.success(
        coches.length
          ? "Périmètre de validation enregistré"
          : "Périmètre retiré : ce compte ne valide plus aucun type",
      );
      onClose();
    },
    onError: () => toast.error("Le périmètre n'a pas pu être enregistré."),
  });

  const basculer = (libelle: string) =>
    setTouche(
      coches.includes(libelle)
        ? coches.filter((l) => l !== libelle)
        : [...coches, libelle],
    );

  return (
    <CrudModal
      isOpen
      onClose={onClose}
      title={`Validation — ${nomComplet(utilisateur.lastname, utilisateur.firstname)}`}
      size="lg"
      footer={
        sansBorne ? null : (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button
              onClick={() => enregistrer.mutate()}
              loading={enregistrer.isPending}
            >
              Enregistrer
            </Button>
          </div>
        )
      }
    >
      {sansBorne ? (
        <p className="text-sm text-gray-700">
          Ce compte porte un rôle médical : il valide tous les types d&apos;examen,
          et aucun périmètre ne s&apos;applique. Borner un pathologiste lui
          retirerait l&apos;exercice de son métier.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Sans aucun type coché, ce compte ne valide rien — même s&apos;il
            porte la permission « Valider un compte rendu ». Le compte rendu
            validé portera son nom et son métier, et non une signature médicale.
          </div>

          {types.isLoading || perimetre.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement des types d&apos;examen…
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {libelles.map((libelle) => (
                <li key={libelle}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300"
                      checked={coches.includes(libelle)}
                      onChange={() => basculer(libelle)}
                    />
                    <span className="text-sm text-gray-900">{libelle}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </CrudModal>
  );
}
