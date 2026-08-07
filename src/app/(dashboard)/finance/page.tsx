"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Calendar, CalendarDays, FileText } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/common/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { formatCFA, formatDate } from "@/lib/utils";
import { invoicesApi, type Invoice, type FinanceStats } from "@/lib/api/invoices";

// ---------------------------------------------------------------------------
// Formatage des montants — sans unité, cf. formatCFA
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function SkeletonKpi() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-gray-200 rounded w-1/2" />
          <div className="h-7 bg-gray-200 rounded w-3/4" />
          <div className="h-3 bg-gray-200 rounded w-1/3" />
        </div>
        <div className="h-10 w-10 bg-gray-200 rounded-lg" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface FinanceKpiProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg: string;
  valueColor?: string;
}

function FinanceKpi({ title, value, subtitle, icon, iconBg, valueColor }: FinanceKpiProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wider text-gray-500">
            {title}
          </p>
          <p className={`mt-1 text-2xl font-bold truncate ${valueColor ?? "text-gray-900"}`}>
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-gray-400">{subtitle}</p>
          )}
        </div>
        <div className={`flex-shrink-0 rounded-lg p-3 ${iconBg}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FinanceDashboardPage() {
  const { can } = usePermissions();

  // Guard permission
  if (!can(PERMISSIONS.VIEW_DASHBORD_FINANCE)) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-sm text-gray-500">
          Accès non autorisé.
        </p>
      </div>
    );
  }

  return <FinanceDashboardContent />;
}

function FinanceDashboardContent() {
  // --- Query : stats finance
  const { data: stats, isLoading: statsLoading } = useQuery<FinanceStats>({
    queryKey: ["finance", "stats"],
    queryFn: () => invoicesApi.getFinanceStats().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  // --- Query : 10 dernières factures
  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: ["finance", "recent-invoices"],
    queryFn: () =>
      invoicesApi
        .findAll({ page: 0, size: 10, sort: "createdAt,desc" })
        .then((r) => r.data),
    staleTime: 2 * 60 * 1000,
  });

  const recentInvoices = recentData?.content ?? [];

  // --- Colonnes du tableau factures récentes
  const columns: ColumnDef<Invoice>[] = [
    {
      header: "Référence",
      id: "ref",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-gray-700">
          {row.original.id.slice(0, 8).toUpperCase()}
        </span>
      ),
    },
    {
      header: "Patient",
      id: "patient",
      cell: ({ row }) => (
        <span className="text-sm text-gray-800">
          {row.original.patientName ?? <span className="text-gray-400 text-xs">—</span>}
        </span>
      ),
    },
    {
      header: "Montant",
      id: "total",
      cell: ({ row }) => (
        <span className="text-sm font-medium text-gray-900">
          {formatCFA(row.original.total)}
        </span>
      ),
    },
    {
      header: "Statut",
      id: "paid",
      cell: ({ row }) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${row.original.paid ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
          {row.original.paid ? "Payé" : "Non payé"}
        </span>
      ),
    },
    {
      header: "Date",
      accessorKey: "createdAt",
      cell: ({ getValue }) => (
        <span className="text-xs text-gray-500">{formatDate(getValue<string>())}</span>
      ),
    },
    {
      header: "Voir",
      id: "actions",
      cell: ({ row }) => (
        <Link
          href={`/invoices/${row.original.id}`}
          className="text-xs font-medium text-blue-600 hover:underline"
        >
          Détail
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Finance"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Finance" },
        ]}
        action={
          <Link
            href="/invoices"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <FileText className="h-4 w-4" />
            Toutes les factures
          </Link>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statsLoading ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonKpi key={i} />)
        ) : (
          <>
            <FinanceKpi
              title="Aujourd'hui"
              value={formatCFA(stats?.totalToday ?? 0)}
              subtitle="Chiffre d'affaires du jour"
              icon={<TrendingUp className="h-5 w-5" />}
              iconBg="bg-blue-50 text-blue-600"
              valueColor="text-blue-700"
            />
            <FinanceKpi
              title="Ce mois"
              value={formatCFA(stats?.totalMonth ?? 0)}
              subtitle="Chiffre d'affaires du mois en cours"
              icon={<Calendar className="h-5 w-5" />}
              iconBg="bg-green-50 text-green-600"
              valueColor="text-green-700"
            />
            <FinanceKpi
              title="Mois dernier"
              value={formatCFA(stats?.totalLastMonth ?? 0)}
              subtitle="Chiffre d'affaires du mois précédent"
              icon={<CalendarDays className="h-5 w-5" />}
              iconBg="bg-purple-50 text-purple-600"
              valueColor="text-purple-700"
            />
          </>
        )}
      </div>

      {/* Tableau factures récentes */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-700">Factures récentes</h2>
          <Link
            href="/invoices"
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            Voir toutes
          </Link>
        </div>
        <div className="p-5">
          <DataTable
            columns={columns}
            data={recentInvoices}
            isLoading={recentLoading}
          />
        </div>
      </div>
    </div>
  );
}
