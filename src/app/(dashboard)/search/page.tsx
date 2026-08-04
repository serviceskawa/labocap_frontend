"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { LimitedSelect as ReactSelect } from "@/components/ui/LimitedSelect";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";

import { PageHeader } from "@/components/ui/PageHeader";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { RemoteMultiSelectField } from "@/components/ui/RemoteSelectField";
import { MAX_VISIBLE_OPTIONS } from "@/components/ui/LimitedSelect";
import { DataTable } from "@/components/common/DataTable";
import { formatDate } from "@/lib/utils";
import {
  reportsApi,
  type ReportGlobalSearchRow,
} from "@/lib/api/reports";
import { typeOrdersApi } from "@/lib/api/examens";
import { hospitalsApi } from "@/lib/api/hospitals";
import { patientsApi } from "@/lib/api/patients";
import { contractsApi } from "@/lib/api/contracts";
import { loadDoctorOptions } from "@/lib/api/optionLoaders";

// ---------------------------------------------------------------------------
// Types locaux pour les options react-select
// ---------------------------------------------------------------------------

interface SelectOption {
  value: string;
  label: string;
}

interface PatientOption extends SelectOption {
  code?: string;
  firstname?: string;
  lastname?: string;
}

/**
 * Recherche serveur des patients (13 000+) : le filtre interroge la base, il ne
 * se limite pas aux 6 options affichées.
 */
const loadPatientFilterOptions = (input: string): Promise<PatientOption[]> =>
  patientsApi
    .findAll({ size: MAX_VISIBLE_OPTIONS, search: input || undefined })
    .then((r) =>
      r.data.content.map((p) => ({
        value: p.id,
        label: `${p.code ?? ""} - ${p.firstname ?? ""} ${p.lastname ?? ""}`.trim(),
        code: p.code,
        firstname: p.firstname,
        lastname: p.lastname,
      }))
    );

// ---------------------------------------------------------------------------
// Page principale — Recherche avancée des comptes-rendus
// ---------------------------------------------------------------------------

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 500, 1000];

export default function SearchPage() {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // États des 10 filtres
  const [typeOrderIds, setTypeOrderIds] = useState<string[]>([]);
  const [contratIds, setContratIds] = useState<string[]>([]);
  const [patientIds, setPatientIds] = useState<string[]>([]);
  const [doctorIds, setDoctorIds] = useState<string[]>([]);
  // Patients/médecins choisis : on garde les options entières, elles ne sont
  // plus retrouvables dans une liste préchargée (recherche serveur).
  const [selectedPatients, setSelectedPatients] = useState<PatientOption[]>([]);
  const [selectedDoctors, setSelectedDoctors] = useState<SelectOption[]>([]);
  const [hospitalIds, setHospitalIds] = useState<string[]>([]);
  const [referenceHospital, setReferenceHospital] = useState("");
  const [dateBegin, setDateBegin] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [content, setContent] = useState("");
  // Le backend /reports/search-global n'expose que le filtre `isUrgent`
  // (aucun paramètre "retard"/isLate) : on s'en tient donc à urgent / tous.
  const [urgentFilter, setUrgentFilter] = useState<"" | "urgent">("");

  // Valeurs debouncées (champs texte libres) pour éviter de relancer la
  // requête à chaque frappe — ~350ms après la dernière saisie.
  const [debouncedRefHospital, setDebouncedRefHospital] = useState("");
  const [debouncedContent, setDebouncedContent] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedRefHospital(referenceHospital), 350);
    return () => clearTimeout(t);
  }, [referenceHospital]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedContent(content), 350);
    return () => clearTimeout(t);
  }, [content]);

  // -----------------------------------------------------------------------
  // Chargement des options des selects
  // -----------------------------------------------------------------------
  const { data: typeOrders } = useQuery({
    queryKey: ["type-orders-all"],
    queryFn: () => typeOrdersApi.findAll().then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  const { data: hospitals } = useQuery({
    queryKey: ["hospitals-all"],
    queryFn: () =>
      hospitalsApi.findAll({ size: 1000 }).then((r) => r.data.content),
    staleTime: 5 * 60_000,
  });

  // Patients et médecins : trop nombreux pour être préchargés, leurs filtres
  // cherchent directement en base (voir `RemoteMultiSelectField`).

  const { data: contrats } = useQuery({
    queryKey: ["contracts-all-for-search"],
    queryFn: () =>
      contractsApi.findAll({ size: 1000 }).then((r) => r.data.content),
    staleTime: 5 * 60_000,
  });

  // -----------------------------------------------------------------------
  // Options des react-select
  // -----------------------------------------------------------------------
  const typeOrderOptions = useMemo<SelectOption[]>(
    () =>
      (typeOrders ?? []).map((t) => ({ value: t.id, label: t.title })),
    [typeOrders],
  );

  const contratOptions = useMemo<SelectOption[]>(
    () =>
      (contrats ?? []).map((c) => ({
        value: c.id,
        label: c.name ?? "(sans nom)",
      })),
    [contrats],
  );

  const hospitalOptions = useMemo<SelectOption[]>(
    () => (hospitals ?? []).map((h) => ({ value: h.id, label: h.name })),
    [hospitals],
  );

  // -----------------------------------------------------------------------
  // Requête de recherche
  // -----------------------------------------------------------------------
  // Construit les paramètres de recherche partagés entre la requête paginée
  // et l'export (qui réutilise exactement les mêmes filtres).
  const buildSearchParams = (pageArg: number, sizeArg: number) => ({
    page: pageArg,
    size: sizeArg,
    typeOrderIds: typeOrderIds.length ? typeOrderIds : undefined,
    contratIds: contratIds.length ? contratIds : undefined,
    patientIds: patientIds.length ? patientIds : undefined,
    doctorIds: doctorIds.length ? doctorIds : undefined,
    hospitalIds: hospitalIds.length ? hospitalIds : undefined,
    referenceHospital: debouncedRefHospital || undefined,
    dateBegin: dateBegin || undefined,
    dateEnd: dateEnd || undefined,
    content: debouncedContent || undefined,
    isUrgent: urgentFilter === "urgent" ? true : undefined,
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      "reports-search-global",
      {
        page,
        pageSize,
        typeOrderIds,
        contratIds,
        patientIds,
        doctorIds,
        hospitalIds,
        referenceHospital: debouncedRefHospital,
        dateBegin,
        dateEnd,
        content: debouncedContent,
        urgentFilter,
      },
    ],
    queryFn: () =>
      reportsApi
        .searchGlobal(buildSearchParams(page, pageSize))
        .then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  // -----------------------------------------------------------------------
  // Colonnes du tableau (10 colonnes)
  // -----------------------------------------------------------------------
  const columns: ColumnDef<ReportGlobalSearchRow>[] = [
    {
      header: "Code Rapport",
      accessorKey: "codeReport",
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.original.codeReport ?? "—"}
        </span>
      ),
    },
    {
      header: "Code Examen",
      accessorKey: "codeExamen",
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.original.codeExamen ?? "—"}
        </span>
      ),
    },
    {
      header: "Type d'examen",
      accessorKey: "typeExamen",
      cell: ({ row }) => row.original.typeExamen ?? "—",
    },
    {
      header: "Contrat",
      accessorKey: "contractName",
      cell: ({ row }) => row.original.contractName ?? "—",
    },
    {
      header: "Patient",
      id: "patient",
      cell: ({ row }) => {
        const full = `${row.original.patientFirstname ?? ""} ${
          row.original.patientLastname ?? ""
        }`.trim();
        return full || "—";
      },
    },
    {
      header: "Médecin",
      accessorKey: "doctorName",
      cell: ({ row }) => row.original.doctorName ?? "—",
    },
    {
      header: "Hôpital",
      accessorKey: "hospitalName",
      cell: ({ row }) => row.original.hospitalName ?? "—",
    },
    {
      header: "Réf. hôpital",
      accessorKey: "referenceHospital",
      cell: ({ row }) => row.original.referenceHospital ?? "—",
    },
    {
      header: "Date de création",
      id: "dateCreation",
      cell: ({ row }) =>
        row.original.dateCreation ? formatDate(row.original.dateCreation) : "—",
    },
    {
      header: "Urgent",
      id: "urgent",
      cell: ({ row }) =>
        row.original.isUrgent ? (
          <span className="inline-flex items-center rounded-full bg-red-700 px-2 py-0.5 text-xs font-medium text-white">
            Oui
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
            Non
          </span>
        ),
    },
  ];

  // -----------------------------------------------------------------------
  // Export CSV
  // -----------------------------------------------------------------------
  /**
   * Export du résultat de recherche au format Excel.
   *
   * Laravel renvoie un vrai classeur `.xlsx` (Maatwebsite Excel,
   * `SearchController::export`). L'ancienne version fabriquait un CSV renommé
   * sous un bouton « Exporter Excel » : ni le format ni l'extension ne
   * correspondaient. ExcelJS est chargé dynamiquement pour ne peser sur le
   * bundle que si l'utilisateur exporte réellement.
   */
  const exportToExcel = async () => {
    const total = data?.totalElements ?? 0;
    if (total === 0) {
      toast.error("Aucune donnée à exporter");
      return;
    }

    // On ne se limite pas à la page courante : on relance la recherche avec
    // un `size` couvrant l'ensemble des résultats filtrés avant l'export.
    let rows: ReportGlobalSearchRow[] = [];
    setIsExporting(true);
    try {
      const res = await reportsApi.searchGlobal(buildSearchParams(0, total));
      rows = res.data.content ?? [];
    } catch {
      toast.error("Erreur lors de l'export");
      setIsExporting(false);
      return;
    }

    if (rows.length === 0) {
      setIsExporting(false);
      toast.error("Aucune donnée à exporter");
      return;
    }

    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Rapports");

      sheet.columns = [
        { header: "Code Rapport", key: "codeReport", width: 16 },
        { header: "Code Examen", key: "codeExamen", width: 16 },
        { header: "Type d'examen", key: "typeExamen", width: 20 },
        { header: "Contrat", key: "contrat", width: 26 },
        { header: "Patient", key: "patient", width: 26 },
        { header: "Médecin", key: "medecin", width: 22 },
        { header: "Hôpital", key: "hopital", width: 22 },
        { header: "Réf. hôpital", key: "refHopital", width: 16 },
        { header: "Date de création", key: "dateCreation", width: 18 },
        { header: "Urgent", key: "urgent", width: 10 },
      ];
      sheet.getRow(1).font = { bold: true };

      for (const r of rows) {
        sheet.addRow({
          codeReport: r.codeReport ?? "",
          codeExamen: r.codeExamen ?? "",
          typeExamen: r.typeExamen ?? "",
          contrat: r.contractName ?? "",
          patient: `${r.patientFirstname ?? ""} ${r.patientLastname ?? ""}`.trim(),
          medecin: r.doctorName ?? "",
          hopital: r.hospitalName ?? "",
          refHopital: r.referenceHospital ?? "",
          dateCreation: r.dateCreation ?? "",
          urgent: r.isUrgent ? "Oui" : "Non",
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `recherche-rapports-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`${rows.length} ligne(s) exportée(s)`);
    } catch {
      toast.error("Erreur lors de la génération du fichier Excel");
    } finally {
      setIsExporting(false);
    }
  };

  // -----------------------------------------------------------------------
  // Helper : reset page à 0 quand un filtre change
  // -----------------------------------------------------------------------
  const onFilterChange = <T,>(setter: (v: T) => void) => (v: T) => {
    setPage(0);
    setter(v);
  };

  // -----------------------------------------------------------------------
  // Rendu
  // -----------------------------------------------------------------------
  return (
    <div className="space-y-6">
      <PageHeader title="Recherche générale" />

      {/* Carte des filtres */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            Champs de filtre
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* 1. Type d'examen */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Type d&apos;examen
            </label>
            <ReactSelect<SelectOption, true>
              isMulti
              instanceId="filter-type-order"
              options={typeOrderOptions}
              value={typeOrderOptions.filter((o) =>
                typeOrderIds.includes(o.value),
              )}
              onChange={(opts) =>
                onFilterChange<string[]>(setTypeOrderIds)(
                  opts.map((o) => o.value),
                )
              }
              placeholder="Tous"
              classNamePrefix="react-select"
              noOptionsMessage={() => "Aucune option"}
            />
          </div>

          {/* 2. Contrat */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Contrat
            </label>
            <ReactSelect<SelectOption, true>
              isMulti
              instanceId="filter-contrat"
              options={contratOptions}
              value={contratOptions.filter((o) => contratIds.includes(o.value))}
              onChange={(opts) =>
                onFilterChange<string[]>(setContratIds)(
                  opts.map((o) => o.value),
                )
              }
              placeholder="Tous"
              classNamePrefix="react-select"
              noOptionsMessage={() => "Aucune option"}
            />
          </div>

          {/* 3. Patient — recherche par code / nom / prénom */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Patient
            </label>
            <RemoteMultiSelectField<PatientOption>
              id="filter-patient"
              loadOptions={loadPatientFilterOptions}
              value={selectedPatients}
              onChange={(opts) => {
                setSelectedPatients(opts);
                onFilterChange<string[]>(setPatientIds)(
                  opts.map((o) => o.value),
                );
              }}
              placeholder="Tous"
              formatOptionLabel={(opt) => (
                <span>
                  <span className="font-mono text-xs text-gray-500">
                    {opt.code ?? ""}
                  </span>
                  {" — "}
                  <span>
                    {opt.firstname ?? ""} {opt.lastname ?? ""}
                  </span>
                </span>
              )}
            />
          </div>

          {/* 4. Médecin traitant */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Médecin traitant
            </label>
            <RemoteMultiSelectField<SelectOption>
              id="filter-doctor"
              loadOptions={loadDoctorOptions}
              value={selectedDoctors}
              onChange={(opts) => {
                setSelectedDoctors(opts);
                onFilterChange<string[]>(setDoctorIds)(
                  opts.map((o) => o.value),
                );
              }}
              placeholder="Tous"
            />
          </div>

          {/* 5. Hôpital de provenance */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Hôpital de provenance
            </label>
            <ReactSelect<SelectOption, true>
              isMulti
              instanceId="filter-hospital"
              options={hospitalOptions}
              value={hospitalOptions.filter((o) =>
                hospitalIds.includes(o.value),
              )}
              onChange={(opts) =>
                onFilterChange<string[]>(setHospitalIds)(
                  opts.map((o) => o.value),
                )
              }
              placeholder="Tous"
              classNamePrefix="react-select"
              noOptionsMessage={() => "Aucun hôpital"}
            />
          </div>

          {/* 6. Référence hôpital */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Référence hôpital
            </label>
            <input
              type="text"
              value={referenceHospital}
              onChange={(e) =>
                onFilterChange<string>(setReferenceHospital)(e.target.value)
              }
              placeholder=""
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* 7. Date début */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Date début
            </label>
            <input
              type="date"
              value={dateBegin}
              onChange={(e) =>
                onFilterChange<string>(setDateBegin)(e.target.value)
              }
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* 8. Date fin */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Date fin
            </label>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) =>
                onFilterChange<string>(setDateEnd)(e.target.value)
              }
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* 9. Recherche générale */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Recherche générale
            </label>
            <input
              type="text"
              value={content}
              onChange={(e) =>
                onFilterChange<string>(setContent)(e.target.value)
              }
              placeholder=""
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* 10. Urgent */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Urgent
            </label>
            <NativeSelect
              value={urgentFilter}
              onChange={(e) =>
                onFilterChange<"" | "urgent">(setUrgentFilter)(
                  e.target.value as "" | "urgent",
                )
              }
            >
              <option value="">Tous</option>
              <option value="urgent">Urgent</option>
            </NativeSelect>
          </div>
        </div>
      </div>

      {/* Bouton Export + Tableau */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <label htmlFor="page-size-top" className="text-xs">
              Afficher
            </label>
            <NativeSelect
              id="page-size-top"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(0);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </NativeSelect>
            <span className="text-xs">
              {data?.totalElements != null
                ? `· ${data.totalElements} résultat${
                    data.totalElements > 1 ? "s" : ""
                  }`
                : ""}
            </span>
          </div>

          <button
            type="button"
            onClick={exportToExcel}
            disabled={isExporting}
            className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isExporting ? "Export en cours…" : "Exporter Excel"}
          </button>
        </div>

        <DataTable
          columns={columns}
          data={data?.content ?? []}
          isLoading={isLoading || isFetching}
          pageCount={data?.totalPages ?? 0}
          pageIndex={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(0);
          }}
        />
      </div>
    </div>
  );
}
