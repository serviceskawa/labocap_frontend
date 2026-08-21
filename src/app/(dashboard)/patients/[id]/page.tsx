"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  TableLengthControl,
  TablePaginationFooter,
  useTablePagination,
} from "@/components/common/TablePagination";
import { formatCFA, formatDate, nomComplet } from "@/lib/utils";
import { patientsApi, PatientProfile } from "@/lib/api/patients";

// ---------------------------------------------------------------------------
// Skeleton helpers
// ---------------------------------------------------------------------------

function SkeletonLine({ className }: { className?: string }) {
  return (
    <div
      className={`h-4 animate-pulse rounded bg-gray-200 ${className ?? ""}`}
    />
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PatientProfilePage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const params = use(paramsPromise);
  const id = params.id;

  const { data: profile, isLoading } = useQuery<PatientProfile>({
    queryKey: ["patient", id],
    queryFn: () => patientsApi.findById(id).then((r) => r.data),
    enabled: !!id,
  });

  const patient = profile?.patient;

  // Pagination des deux tableaux de la fiche patient.
  const ordersPagination = useTablePagination(profile?.recentOrders ?? []);
  const invoicesPagination = useTablePagination(profile?.recentInvoices ?? []);

  // Initiales pour l'avatar
  const initials = patient
    ? `${patient.lastname.charAt(0)}${patient.firstname.charAt(0)}`.toUpperCase()
    : "?";

  return (
    <div className="space-y-6">
      {/* `page-title-box` de `patients/profil.blade.php` : titre « Dossier
          Patient » et bouton primaire de retour à droite. */}
      <PageHeader
        title="Dossier Patient"
        action={
          <Button
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => router.push("/patients")}
          >
            Retour à la liste des patients
          </Button>
        }
      />

      {isLoading ? (
        /* ========================================================
           État de chargement
        ======================================================== */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Colonne gauche skeleton */}
          <div className="col-span-1 rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-col items-center gap-3">
              <div className="h-16 w-16 animate-pulse rounded-full bg-gray-200" />
              <SkeletonLine className="w-32" />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonLine key={i} className="w-full" />
            ))}
          </div>

          {/* Colonne droite skeleton */}
          <div className="col-span-2 space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-2"
                >
                  <SkeletonLine className="w-3/4" />
                  <SkeletonLine className="w-1/2 h-6" />
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonLine key={i} className="w-full" />
              ))}
            </div>
          </div>
        </div>
      ) : !profile || !patient ? (
        /* ========================================================
           Patient introuvable
        ======================================================== */
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-gray-500">Patient introuvable.</p>
        </div>
      ) : (
        /* ========================================================
           Contenu
        ======================================================== */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* -------------------------------------------------------
              Colonne gauche — Carte infos personnelles
          ------------------------------------------------------- */}
          <div className="col-span-1 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            {/* Avatar + nom */}
            <div className="flex flex-col items-center gap-3 mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white">
                {initials}
              </div>
              <h4 className="text-base font-semibold text-gray-900 text-center">
                {nomComplet(patient.lastname, patient.firstname)}
              </h4>
            </div>

            {/* Détails */}
            <dl className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <dt className="font-medium text-gray-500 w-24 flex-shrink-0">Code :</dt>
                <dd className="text-gray-800">{patient.code}</dd>
              </div>
              <div className="flex items-start gap-2">
                <dt className="font-medium text-gray-500 w-24 flex-shrink-0">
                  Téléphone :
                </dt>
                <dd className="text-gray-800">{patient.telephone1}</dd>
              </div>
              {patient.telephone2 && (
                <div className="flex items-start gap-2">
                  <dt className="font-medium text-gray-500 w-24 flex-shrink-0">
                    Téléphone 2 :
                  </dt>
                  <dd className="text-gray-800">{patient.telephone2}</dd>
                </div>
              )}
              <div className="flex items-start gap-2">
                <dt className="font-medium text-gray-500 w-24 flex-shrink-0">Âge :</dt>
                <dd className="text-gray-800">
                  {patient.age}{" "}
                  {patient.yearOrMonth === undefined
                    ? ""
                    : patient.yearOrMonth
                    ? "Ans"
                    : "Mois"}
                </dd>
              </div>
              {patient.genre && (
                <div className="flex items-start gap-2">
                  <dt className="font-medium text-gray-500 w-24 flex-shrink-0">
                    Genre :
                  </dt>
                  <dd className="text-gray-800">{patient.genre}</dd>
                </div>
              )}
              {patient.profession && (
                <div className="flex items-start gap-2">
                  <dt className="font-medium text-gray-500 w-24 flex-shrink-0">
                    Profession :
                  </dt>
                  <dd className="text-gray-800">{patient.profession}</dd>
                </div>
              )}
              {patient.email && (
                <div className="flex items-start gap-2">
                  <dt className="font-medium text-gray-500 w-24 flex-shrink-0">
                    Email :
                  </dt>
                  <dd className="text-gray-800">{patient.email}</dd>
                </div>
              )}
              <div className="flex items-start gap-2">
                <dt className="font-medium text-gray-500 w-24 flex-shrink-0">
                  Adresse :
                </dt>
                <dd className="text-gray-800">{patient.adresse}</dd>
              </div>
            </dl>
          </div>

          {/* -------------------------------------------------------
              Colonne droite
          ------------------------------------------------------- */}
          <div className="col-span-2 space-y-6">
            {/* 3 cartes financières */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                  Total
                </p>
                <p className="mt-2 text-xl font-bold text-blue-600">
                  {formatCFA(profile.totalInvoiced)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                  Payé
                </p>
                <p className="mt-2 text-xl font-bold text-green-600">
                  {formatCFA(profile.totalPaid)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                  Non payé
                </p>
                <p className="mt-2 text-xl font-bold text-red-600">
                  {formatCFA(profile.totalUnpaid)}
                </p>
              </div>
            </div>

            {/* Tableau Demandes d'examen */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-700">
                  Demandes d&apos;examen
                </h2>
              </div>
              <div className="px-5 pt-4">
                <TableLengthControl pagination={ordersPagination} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="w-10 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Date prélèvement
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Code
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Statut
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Voir
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {profile.recentOrders.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-6 text-center text-sm text-gray-500"
                        >
                          Aucune demande d&apos;examen
                        </td>
                      </tr>
                    ) : (
                      ordersPagination.pageRows.map((order, idx) => (
                        <tr
                          key={order.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-4 py-3 text-xs text-gray-400">
                            {ordersPagination.offset + idx + 1}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {formatDate(order.prelevementDate)}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {order.code}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge
                              status={order.status}
                              domain="testOrder"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/test-orders/${order.id}/details`}
                              className="inline-flex items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors"
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Voir la demande (nouvel onglet)"
                              aria-label="Voir la demande (nouvel onglet)"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-5 pb-4">
                <TablePaginationFooter pagination={ordersPagination} />
              </div>
            </div>

            {/* Tableau Factures */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-700">
                  Factures
                </h2>
              </div>
              <div className="px-5 pt-4">
                <TableLengthControl pagination={invoicesPagination} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="w-10 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Total
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Échéance
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Statut
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Voir
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {profile.recentInvoices.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-6 text-center text-sm text-gray-500"
                        >
                          Aucune facture
                        </td>
                      </tr>
                    ) : (
                      invoicesPagination.pageRows.map((invoice, idx) => (
                        <tr
                          key={invoice.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-4 py-3 text-xs text-gray-400">
                            {invoicesPagination.offset + idx + 1}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {formatDate(invoice.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {formatCFA(invoice.total)}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge
                              status={invoice.status}
                              domain="invoice"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/invoices/${invoice.id}`}
                              className="inline-flex items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors"
                              title="Voir la facture"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-5 pb-4">
                <TablePaginationFooter pagination={invoicesPagination} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
