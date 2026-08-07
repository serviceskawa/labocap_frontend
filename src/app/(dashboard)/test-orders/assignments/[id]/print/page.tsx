"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";

import {
  assignmentsApi,
  type AssignmentPrint,
} from "@/lib/api/assignments";
import { formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { DocumentHeader } from "@/components/ui/DocumentHeader";

// ---------------------------------------------------------------------------
// Page d'impression
// ---------------------------------------------------------------------------

export default function AssignmentPrintPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { can } = usePermissions();

  const { data, isLoading } = useQuery<AssignmentPrint>({
    queryKey: ["assignment-print", id],
    queryFn: () => assignmentsApi.getPrint(id as string).then((r) => r.data),
    enabled: !!id,
  });

  // ---- Guard --------------------------------------------------------------

  if (!can(PERMISSIONS.VIEW_TEST_ORDER_ASSIGNMENTS)) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-gray-500">
          Vous n&apos;avez pas la permission de consulter les affectations.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-gray-500">Chargement...</p>
      </div>
    );
  }

  if (!data?.assignment) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-gray-500">Affectation introuvable.</p>
      </div>
    );
  }

  const { assignment, details, branchName, branchAddress } = data;

  return (
    <>
      {/* Styles d'impression */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          @page {
            margin: 10mm 10mm 0 10mm;
          }
          body {
            margin: 0;
            background: #fff !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-4xl space-y-6 bg-white p-8 print:p-0 print:shadow-none">
        {/* Bouton imprimer */}
        <div className="no-print flex items-center justify-end">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-md bg-yellow-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-yellow-600"
          >
            <Printer className="h-4 w-4" />
            Imprimer
          </button>
        </div>

        {/* En-tête labo — même composant que la feuille de caisse, pour que
            deux documents sortis du même laboratoire s'identifient pareil. */}
        <DocumentHeader
          name={branchName ?? "Laboratoire"}
          subtitle={branchAddress || undefined}
          align="left"
        />

        {/* Titre */}
        <h2 className="text-xl font-bold text-gray-900">
          Affectation N° {assignment.code}
        </h2>

        {/* Infos */}
        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div>
            <span className="font-semibold text-gray-800">Docteur :</span>{" "}
            <span className="text-gray-700">
              {assignment.userName ?? "—"}
            </span>
          </div>
          <div>
            <span className="font-semibold text-gray-800">Date :</span>{" "}
            <span className="text-gray-700">
              {formatDate(assignment.date ?? assignment.createdAt)}
            </span>
          </div>
        </div>

        {/* Tableau détails */}
        <div className="overflow-hidden rounded-lg border border-gray-200 print:rounded-none print:border-gray-400">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 print:bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Note
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {details.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-6 text-center text-sm text-gray-500"
                  >
                    Aucune demande d&apos;examen affectée
                  </td>
                </tr>
              ) : (
                details.map((d, idx) => (
                  <tr key={d.id}>
                    <td className="px-4 py-3 text-gray-700">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-gray-800">
                        {d.testOrderCode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {d.note ?? ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Note de l'affectation */}
        {assignment.note && (
          <div className="rounded-lg border border-gray-200 p-4 text-sm print:border-gray-400">
            <p className="font-semibold text-gray-800">Note :</p>
            <p className="mt-1 whitespace-pre-wrap text-gray-700">
              {assignment.note}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
