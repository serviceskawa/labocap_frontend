"use client";

import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  TableLengthControl,
  TablePaginationFooter,
  useTablePagination,
} from "@/components/common/TablePagination";

/**
 * Répartition chiffrée assortie d'une barre de proportion.
 *
 * Extraite du tableau de bord pour servir aussi la page Statistiques : les deux
 * écrans montrent les mêmes répartitions, il n'y a pas lieu d'en tenir deux
 * versions.
 */
interface ProgressTableProps {
  headers: [string, string];
  data: Array<{ label: string; value: number }>;
  color?: string;
}

export function ProgressTable({
  headers,
  data,
  color = "bg-blue-500",
}: ProgressTableProps) {
  const max = data.length > 0 ? Math.max(...data.map((d) => d.value)) : 1;
  // La barre reste proportionnelle au maximum de TOUTE la série, pas seulement
  // de la page affichée : sinon l'échelle changerait d'une page à l'autre.
  const pagination = useTablePagination(data);

  // Ces trois répartitions sont affichées côte à côte dans une carte imbriquée,
  // et tiennent presque toujours sur une page. Poser systématiquement le sélecteur
  // « Afficher 10 enregistrements par page » ET le pied de pagination donnait
  // trois sélecteurs et trois paginateurs pour trois tableaux d'une poignée de
  // lignes — soit plus de chrome que de donnée, et un « page 1 sur 1 » répété
  // trois fois. On ne les montre que lorsqu'il y a réellement plusieurs pages.
  const isPaginated = pagination.pageCount > 1;

  // Sans donnée, le corps du tableau ne rendait rien : on voyait une ligne
  // d'en-tête suivie d'un vide, puis le paginateur. L'écran paraissait cassé
  // plutôt que vide.
  if (data.length === 0) {
    return (
      <EmptyState
        compact
        icon={Inbox}
        title="Aucune donnée"
        description={`Aucun résultat par ${headers[0].toLocaleLowerCase("fr")} ce mois-ci.`}
      />
    );
  }

  return (
    <>
      {isPaginated && <TableLengthControl pagination={pagination} className="px-6" />}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-[.7rem] font-semibold uppercase tracking-[0.06em] text-gray-500">
                {headers[0]}
              </th>
              <th className="px-3 py-2 text-right text-[.7rem] font-semibold uppercase tracking-[0.06em] text-gray-500">
                {headers[1]}
              </th>
              <th className="w-32 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pagination.pageRows.map((item, i) => {
              const ratio = Math.round((item.value / (max || 1)) * 100);
              return (
                <tr
                  key={i}
                  // Même survol que `DataTable` : le gris était une troisième
                  // teinte de survol dans une application qui en a déjà une.
                  className="transition-colors duration-[var(--duration-instant)] ease-emphasized hover:bg-blue-50/40"
                >
                  <td className="px-3 py-2 text-gray-700">{item.label}</td>
                  <td className="px-3 py-2 text-right font-semibold text-gray-900">
                    {item.value}
                  </td>
                  <td className="px-3 py-2">
                    <div className="h-[3px] rounded-full bg-gray-100">
                      <div
                        className={`h-[3px] rounded-full ${color}`}
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {isPaginated && <TablePaginationFooter pagination={pagination} className="px-6 pb-5" />}
    </>
  );
}
