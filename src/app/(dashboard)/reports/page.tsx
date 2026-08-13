"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Eye, ClipboardList } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/common/DataTable";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { formatDate } from "@/lib/utils";
import {
  reportsApi,
  type ReportListItem,
  type ReportPerformance,
} from "@/lib/api/reports";
import { usersApi, type User } from "@/lib/api/users";
import { AstuceDecouverte } from "@/components/ui/AstuceDecouverte";
import { ApercuCompteRendu } from "./ApercuCompteRendu";
import type { PageResponse } from "@/types/api";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

// Filtre statut : En attente (DRAFT) / Validé (VALIDATED) / Livré (DELIVERED).
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Tous" },
  { value: "DRAFT", label: "En attente" },
  { value: "VALIDATED", label: "Validé" },
  { value: "DELIVERED", label: "Livré" },
];

const MONTHS: { value: number; label: string }[] = [
  { value: 1, label: "Janvier" },
  { value: 2, label: "Février" },
  { value: 3, label: "Mars" },
  { value: 4, label: "Avril" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Juin" },
  { value: 7, label: "Juillet" },
  { value: 8, label: "Août" },
  { value: 9, label: "Septembre" },
  { value: 10, label: "Octobre" },
  { value: 11, label: "Novembre" },
  { value: 12, label: "Décembre" },
];

const CURRENT_YEAR = new Date().getFullYear();
// Année courante + 5 ans en arrière
const YEAR_OPTIONS: number[] = Array.from(
  { length: 6 },
  (_, i) => CURRENT_YEAR - i,
);

// Classe partagée pour les inputs/selects (style Laravel form-control adapté Tailwind)

const labelClass = "mb-1 block text-sm font-medium text-gray-700";

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const { can } = usePermissions();

  // --- État : filtres tableau (section 1)
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateBegin, setDateBegin] = useState<string>("");
  const [dateEnd, setDateEnd] = useState<string>("");

  // --- État : pagination
  // Ligne dont l'aperçu est ouvert. `null` = panneau fermé.
  const [apercu, setApercu] = useState<ReportListItem | null>(null);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // --- État : filtres statistiques (section 2)
  // Valeurs "draftées" dans les inputs vs valeurs "appliquées" (après clic sur "Filtrer")
  const [yearDraft, setYearDraft] = useState<string>(String(CURRENT_YEAR));
  const [monthDraft, setMonthDraft] = useState<string>(
    String(new Date().getMonth() + 1),
  );
  const [doctorDraft, setDoctorDraft] = useState<string>("");

  const [perfFilters, setPerfFilters] = useState<{
    year: string;
    month: string;
    doctorId: string;
  }>({
    year: String(CURRENT_YEAR),
    month: String(new Date().getMonth() + 1),
    doctorId: "",
  });

  // -------------------------------------------------------------------------
  // Query : liste paginée des comptes-rendu
  // -------------------------------------------------------------------------
  const listQuery = useQuery<PageResponse<ReportListItem>>({
    queryKey: [
      "reports-list",
      { page, pageSize, search, statusFilter, dateBegin, dateEnd },
    ],
    queryFn: () =>
      reportsApi
        .getList({
          page,
          size: pageSize,
          search: search || undefined,
          status: statusFilter || undefined,
          dateBegin: dateBegin || undefined,
          dateEnd: dateEnd || undefined,
        })
        .then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  // -------------------------------------------------------------------------
  // Query : liste des docteurs (pour le select "Docteur")
  // -------------------------------------------------------------------------
  const doctorsQuery = useQuery<User[]>({
    queryKey: ["users-doctors"],
    queryFn: () =>
      usersApi.findAll({ size: 500 }).then((r) =>
        (r.data?.content ?? []).filter((u) =>
          (u.roles ?? []).some((role) =>
            role.name.toLowerCase().includes("docteur"),
          ),
        ),
      ),
    staleTime: 5 * 60 * 1000,
  });

  // -------------------------------------------------------------------------
  // Query : performance (section 2)
  // -------------------------------------------------------------------------
  const perfQuery = useQuery<ReportPerformance>({
    queryKey: ["reports-performance", perfFilters],
    queryFn: () =>
      reportsApi
        .getPerformanceStats({
          doctorId: perfFilters.doctorId || undefined,
          month: perfFilters.month ? Number(perfFilters.month) : undefined,
          year: perfFilters.year ? Number(perfFilters.year) : undefined,
        })
        .then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  const reports: ReportListItem[] = listQuery.data?.content ?? [];
  const pageCount = listQuery.data?.totalPages ?? 0;

  // -------------------------------------------------------------------------
  // Colonnes du tableau "Liste des comptes rendu"
  // -------------------------------------------------------------------------
  const columns: ColumnDef<ReportListItem>[] = useMemo(
    () => [
      {
        header: "Code",
        id: "code",
        accessorFn: (row) => row.testOrderCode ?? "",
        enableSorting: true,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-gray-800">
            {row.original.testOrderCode || "—"}
          </span>
        ),
      },
      {
        header: "Code patient",
        id: "patientCode",
        accessorFn: (row) => row.patientCode ?? "",
        enableSorting: true,
        cell: ({ row }) => row.original.patientCode || "—",
      },
      {
        header: "Nom Patient",
        id: "patientName",
        accessorFn: (row) => `${row.patientLastname ?? ""} ${row.patientFirstname ?? ""}`.trim(),
        enableSorting: true,
        cell: ({ row }) => {
          const r = row.original;
          const full = `${r.patientFirstname ?? ""} ${r.patientLastname ?? ""}`.trim();
          return full || "—";
        },
      },
      {
        header: "Telephone",
        id: "phone",
        accessorFn: (row) => row.patientPhone ?? "",
        enableSorting: true,
        cell: ({ row }) => row.original.patientPhone || "—",
      },
      {
        header: "Date",
        accessorKey: "createdAt",
        enableSorting: true,
        cell: ({ getValue }) => formatDate(getValue<string>()),
      },
      {
        header: "Statut",
        id: "status",
        accessorFn: (row) => row.status ?? "",
        enableSorting: true,
        cell: ({ row }) => {
          const s = row.original.status;
          const isDelivered = s === "DELIVERED";
          const isValidated = s === "VALIDATED" || isDelivered;
          return (
            <span
              className={
                isValidated
                  ? "inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700"
                  : "inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
              }
            >
              {isDelivered ? "Livré" : isValidated ? "Valider" : "Attente"}
            </span>
          );
        },
      },
      {
        header: "Actions",
        id: "actions",
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex items-center gap-2">
              <Link
                href={`/reports/${r.id}`}
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-2 py-1.5 text-white transition-colors hover:bg-blue-700"
                title="Voir"
              >
                <Eye className="h-4 w-4" />
              </Link>
              <Link
                href={`/test-orders/${r.testOrderId}/details`}
                className="inline-flex items-center justify-center rounded-md bg-yellow-500 px-2 py-1.5 text-white transition-colors hover:bg-yellow-600"
                target="_blank"
                rel="noopener noreferrer"
                title="Détails (nouvel onglet)"
                aria-label="Détails de la demande (nouvel onglet)"
              >
                <ClipboardList className="h-4 w-4" />
              </Link>
            </div>
          );
        },
      },
    ],
    [],
  );

  // -------------------------------------------------------------------------
  // Permission gate
  // -------------------------------------------------------------------------
  if (!can(PERMISSIONS.VIEW_REPORTS)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-gray-500">Accès non autorisé</p>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Période affichée dans la ligne du tableau stats
  // -------------------------------------------------------------------------
  const monthLabel = MONTHS.find(
    (m) => m.value === Number(perfFilters.month),
  )?.label;
  const periodLabel = monthLabel
    ? `${monthLabel} ${perfFilters.year}`
    : perfFilters.year || "—";

  const perf = perfQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comptes rendu"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Comptes rendu" },
        ]}
      />

      {/* ===================================================================
          SECTION 1 — Liste des comptes rendu
          =================================================================== */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-800">
          Liste des comptes rendu
        </h2>

        {/* Filtres (4 champs) */}
        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={labelClass} htmlFor="filter-search">
              Rechercher
            </label>
            {/* Le champ interroge aussi le texte du compte rendu : sans cette
                mention, personne ne songe à y chercher un terme de diagnostic. */}
            <input
              id="filter-search"
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Nom, téléphone, code ou mot du compte rendu…"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="filter-status">
              Statut
            </label>
            <NativeSelect
              id="filter-status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div>
            <label className={labelClass} htmlFor="filter-date-begin">
              Date Début
            </label>
            <input
              id="filter-date-begin"
              type="date"
              value={dateBegin}
              onChange={(e) => {
                setDateBegin(e.target.value);
                setPage(0);
              }}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="filter-date-end">
              Date Fin
            </label>
            <input
              id="filter-date-end"
              type="date"
              value={dateEnd}
              onChange={(e) => {
                setDateEnd(e.target.value);
                setPage(0);
              }}
              className={inputClass}
            />
          </div>
        </div>

        {/*
          Astuce de découverte, au-dessus du tableau et non ailleurs : elle doit
          se lire juste avant le geste qu'elle décrit. Elle disparaît dès qu'elle
          a été lue, et ne revient plus pour cet utilisateur.
        */}
        <AstuceDecouverte cle="apercu-compte-rendu" titre="Aperçu rapide">
          Cliquez sur une ligne pour ouvrir un aperçu du compte rendu sur la
          droite, sans quitter la liste. Vous y verrez les premières lignes de
          chaque section, et pourrez l&apos;ouvrir en entier si c&apos;est bien
          celui que vous cherchez.
        </AstuceDecouverte>

        {/* Tableau */}
        <DataTable
          columns={columns}
          data={reports}
          isLoading={listQuery.isLoading}
          pageCount={pageCount}
          pageIndex={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(0);
          }}
          onRowClick={setApercu}
        />

        <ApercuCompteRendu ligne={apercu} onClose={() => setApercu(null)} />
      </div>

      {/* ===================================================================
          SECTION 2 — Statistiques "Rapports"
          =================================================================== */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-800">Rapports</h2>

        {/* Filtres + bouton Filtrer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPerfFilters({
              year: yearDraft,
              month: monthDraft,
              doctorId: doctorDraft,
            });
          }}
          className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
        >
          <div>
            <label className={labelClass} htmlFor="perf-year">
              Année
            </label>
            <NativeSelect
              id="perf-year"
              value={yearDraft}
              onChange={(e) => setYearDraft(e.target.value)}
            >
              <option value="">Tous</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div>
            <label className={labelClass} htmlFor="perf-month">
              Mois
            </label>
            <NativeSelect
              id="perf-month"
              value={monthDraft}
              onChange={(e) => setMonthDraft(e.target.value)}
            >
              <option value="">Tous</option>
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div>
            <label className={labelClass} htmlFor="perf-doctor">
              Docteur
            </label>
            <NativeSelect
              id="perf-doctor"
              value={doctorDraft}
              onChange={(e) => setDoctorDraft(e.target.value)}
              disabled={doctorsQuery.isLoading}
            >
              <option value="">Tous</option>
              {(doctorsQuery.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.lastname} {d.firstname}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="flex items-end">
            <Button type="submit" className="w-full" loading={perfQuery.isFetching}>
              Filtrer
            </Button>
          </div>
        </form>

        {/* Tableau statistique */}
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm [&_th]:border-r [&_th]:border-gray-300 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-gray-200 [&_td:last-child]:border-r-0">
              <thead className="border-b-2 border-gray-300 bg-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-800">
                    Période
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-800">
                    Comptes sortis
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-800">
                    Délai respecté
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-800">
                    Hors Délai
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-3 text-gray-800">{periodLabel}</td>
                  <td className="px-4 py-3 text-gray-800">
                    {perfQuery.isLoading ? "…" : (perf?.totalReports ?? 0)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-green-600">
                    {perfQuery.isLoading
                      ? "…"
                      : `${perf?.percentageInDeadline ?? 0} %`}
                  </td>
                  <td className="px-4 py-3 font-semibold text-red-600">
                    {perfQuery.isLoading
                      ? "…"
                      : `${perf?.percentageOverDeadline ?? 0} %`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
