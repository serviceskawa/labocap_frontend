"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/common/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  invoicesApi,
  type InvoiceMonthlyStats,
  type InvoiceSearchResult,
} from "@/lib/api/invoices";

function formatFCFA(amount?: number): string {
  if (amount == null) return "0 FCFA";
  return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";
}

/**
 * Colonnes du tableau « Liste des Factures » — reprise à l'identique du DataTable
 * Laravel (`viewjs/invoice/business.js`) : Mois, Facturés, Avoirs, Chiffre
 * d'affaires, Encaissements, une ligne par mois écoulé de l'année.
 */
const monthlyColumns: ColumnDef<InvoiceMonthlyStats>[] = [
  {
    header: "Mois",
    accessorKey: "monthName",
    cell: ({ row }) => (
      <span className="font-medium text-gray-900">
        {row.original.monthName} {row.original.year}
      </span>
    ),
  },
  {
    header: "Facturés",
    accessorKey: "facturated",
    cell: ({ row }) => formatFCFA(row.original.facturated),
  },
  {
    header: "Avoirs",
    accessorKey: "credits",
    cell: ({ row }) => (
      <span className="text-red-600">{formatFCFA(row.original.credits)}</span>
    ),
  },
  {
    header: "Chiffre d'affaires",
    accessorKey: "turnover",
    cell: ({ row }) => (
      <span className="font-semibold text-green-700">
        {formatFCFA(row.original.turnover)}
      </span>
    ),
  },
  {
    header: "Encaissements",
    accessorKey: "collections",
    cell: ({ row }) => (
      <span className="font-semibold text-blue-700">
        {formatFCFA(row.original.collections)}
      </span>
    ),
  },
];

export default function InvoiceBusinessPage() {
  const { can } = usePermissions();

  // === Tableau mensuel — année en cours uniquement, comme Laravel
  // (getInvoiceforDatatable ne propose aucun choix d'année).
  const { data: monthlyStats, isLoading } = useQuery({
    queryKey: ["invoice-monthly-stats"],
    queryFn: () => invoicesApi.getMonthlyStats().then((r) => r.data),
  });

  // === Recherche par date
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchResult, setSearchResult] = useState<InvoiceSearchResult | null>(
    null,
  );
  const [searchLoading, setSearchLoading] = useState(false);

  const handleSearch = async () => {
    if (!startDate || !endDate) {
      toast.error("Veuillez saisir les deux dates");
      return;
    }
    setSearchLoading(true);
    try {
      const res = await invoicesApi.search({ startDate, endDate });
      setSearchResult(res.data);
    } catch {
      toast.error("Erreur lors de la recherche");
    } finally {
      setSearchLoading(false);
    }
  };

  if (!can(PERMISSIONS.VIEW_INVOICES)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-gray-500">Accès non autorisé</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Factures"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Factures", href: "/invoices" },
          { label: "Rapports" },
        ]}
        action={
          <Link
            href="/invoices"
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la liste des factures
          </Link>
        }
      />

      {/* === Section 1 : Tableau mensuel === */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-800">
          Liste des Factures
        </h2>

        <DataTable
          columns={monthlyColumns}
          data={monthlyStats ?? []}
          isLoading={isLoading}
          hideToolbar
          hideToolbarSearch
        />
      </div>

      {/* === Section 2 : Recherche par date === */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-800">
          Recherche par date
        </h2>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Date Début
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Date Fin
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={handleSearch}
            disabled={searchLoading}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {searchLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {searchLoading ? "Chargement..." : "Afficher"}
          </button>
        </div>

        {/* 4 KPI cards (visible après recherche) */}
        {searchResult && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-red-700">
                Factures
              </p>
              <p className="mt-1 text-2xl font-bold text-red-900">
                {formatFCFA(searchResult.facture)}
              </p>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-green-700">
                Chiffres d&apos;affaires
              </p>
              <p className="mt-1 text-2xl font-bold text-green-900">
                {formatFCFA(searchResult.ca)}
              </p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-red-700">
                Avoir
              </p>
              <p className="mt-1 text-2xl font-bold text-red-900">
                {formatFCFA(searchResult.avoir)}
              </p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-blue-700">
                Encaissement
              </p>
              <p className="mt-1 text-2xl font-bold text-blue-900">
                {formatFCFA(searchResult.encaissement)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
