"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { SelectField } from "@/components/ui/SelectField";
import { RemoteSelectField } from "@/components/ui/RemoteSelectField";
import {
  loadTestOrderOptions,
  type TestOrderOption,
} from "@/lib/api/optionLoaders";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { IconButton } from "@/components/ui/IconButton";
import { formatDate } from "@/lib/utils";
import {
  macroscopyApi,
  type MacroListItem,
  type PendingMacroOrder,
} from "@/lib/api/macroscopy";
import { hrApi, type Employee } from "@/lib/api/hr";
import { typeOrdersApi } from "@/lib/api/examens";
import type { ApiError } from "@/types/api";

/** Recherche serveur des demandes d'examen pour le filtre. */
const loadOrderOptions = loadTestOrderOptions();

// ---------------------------------------------------------------------------
// Styles communs
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500";

// ---------------------------------------------------------------------------
// Composant : badges d'étapes
// ---------------------------------------------------------------------------

function StepBadges({ macro }: { macro: MacroListItem }) {
  const steps = [
    { key: "circulation", label: "Circulation", done: macro.circulation },
    { key: "embedding", label: "Enrobage", done: macro.embedding },
    {
      key: "microtomySpreading",
      label: "Microtomie",
      done: macro.microtomySpreading,
    },
    { key: "staining", label: "Coloration", done: macro.staining },
    { key: "mounting", label: "Montage", done: macro.mounting },
  ];
  return (
    <div className="flex flex-wrap gap-1">
      {steps.map((s) => (
        <span
          key={s.key}
          className={`text-xs px-1.5 py-0.5 rounded font-medium ${
            s.done
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {s.label}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composant : select inline d'étape (historique)
// ---------------------------------------------------------------------------

function StepSelect({ onUpdate }: { onUpdate: (step: string) => void }) {
  const steps = [
    // Les valeurs envoyées au backend sont en snake_case (enum étape).
    { value: "circulation", label: "Circulation" },
    { value: "embedding", label: "Enrobage" },
    { value: "microtomy_spreading", label: "Microtomie et étalement" },
    { value: "staining", label: "Coloration" },
    { value: "mounting", label: "Montage" },
  ];

  return (
    <NativeSelect
      selectClassName="text-xs"
      defaultValue=""
      onChange={(e) => {
        if (e.target.value) onUpdate(e.target.value);
      }}
    >
      <option value="">Compléter étape…</option>
      {steps.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </NativeSelect>
  );
}

// ---------------------------------------------------------------------------
// Composant : select assignation (demandes urgentes)
// ---------------------------------------------------------------------------

function AssignSelect({
  order,
  employees,
  onAssign,
}: {
  order: PendingMacroOrder;
  employees: Employee[];
  onAssign: (testOrderId: string, employeeId: string) => void;
}) {
  const [value, setValue] = useState("");

  return (
    <SelectField
      options={employees.map((emp) => ({
        value: emp.id,
        label: `${emp.firstName} ${emp.lastName}`,
      }))}
      value={value || null}
      onChange={(v) => {
        const empId = v ?? "";
        setValue(empId);
        if (empId) {
          onAssign(order.id, empId);
        }
      }}
      placeholder="— Assigner un laborantin —"
      menuPortal
    />
  );
}

// ---------------------------------------------------------------------------
// Composant : tableau des demandes par type (onglets)
// ---------------------------------------------------------------------------

function PendingByTypeTable({
  orders,
  employees,
  onAssign,
}: {
  orders: PendingMacroOrder[];
  employees: Employee[];
  onAssign: (testOrderId: string, employeeId: string) => void;
}) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Reset à la page 0 si le nombre d'éléments change (filtres)
  const total = orders.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * pageSize;
  const pageOrders = orders.slice(start, start + pageSize);

  if (orders.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-400">
        Aucune demande en attente.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm [&_th]:border-r [&_th]:border-gray-300 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-gray-200 [&_td:last-child]:border-r-0">
          <thead>
            <tr className="border-b-2 border-gray-300 bg-gray-200">
              <th className="w-8 px-3 py-2 text-left">
                <input type="checkbox" className="rounded border-gray-300" />
              </th>
              <th className="px-3 py-2 text-left font-bold text-gray-800">
                Date limite
              </th>
              <th className="px-3 py-2 text-left font-bold text-gray-800">
                Code
              </th>
              <th className="px-3 py-2 text-left font-bold text-gray-800">
                Macro réalisé par
              </th>
            </tr>
          </thead>
          <tbody>
            {pageOrders.map((order) => {
              const deadline = new Date(
                new Date(order.createdAt).getTime() + 9 * 24 * 60 * 60 * 1000
              );
              const isLate = deadline < new Date();
              return (
                <tr
                  key={order.id}
                  className={`border-b border-gray-200 hover:bg-gray-50 ${
                    order.isUrgent ? "bg-red-50" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <input type="checkbox" className="rounded border-gray-300" />
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        isLate ? "font-medium text-red-600" : "text-gray-700"
                      }
                    >
                      {formatDate(deadline)}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {order.code}
                  </td>
                  <td className="px-3 py-2 min-w-[200px]">
                    <AssignSelect
                      order={order}
                      employees={employees}
                      onAssign={onAssign}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <span>Afficher</span>
          <NativeSelect
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
          >
            {[5, 10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </NativeSelect>
          <span>par page</span>
        </div>

        <div className="text-gray-600">
          {total === 0
            ? "Aucun résultat"
            : `${start + 1} – ${Math.min(start + pageSize, total)} sur ${total}`}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage(0)}
            disabled={safePage === 0}
            className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            « Premier
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ‹ Précédent
          </button>
          <span className="px-2 text-xs font-medium text-gray-700">
            {safePage + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Suivant ›
          </button>
          <button
            type="button"
            onClick={() => setPage(totalPages - 1)}
            disabled={safePage >= totalPages - 1}
            className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Dernier »
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

/**
 * Onglets de la file d'attente macroscopie.
 *
 * Chaque onglet porte les slugs de types de bon que Laravel regroupe dans la
 * requête correspondante (`TestPathologyMacroController` :
 * `whereIn('slug', [...])`). L'onglet « Histologie-Biopsie » en couvre deux —
 * c'est pour cela qu'un filtre sur le seul titre ne peut pas marcher.
 */
const TAB_TYPES = [
  { key: "Histologie-Biopsie", label: "Histologie-Biopsie", slugs: ["histologie", "biopsie"] },
  { key: "Pièce opératoire", label: "Pièce opératoire", slugs: ["pièce-opératoire"] },
  { key: "Cytologie", label: "Cytologie", slugs: ["cytologie"] },
];

/**
 * Ramène un slug de type de bon à sa forme de base en retirant le suffixe
 * numérique des doublons issus de la migration (`biopsie-1` → `biopsie`).
 * Laravel compare le slug brut et laisse donc de côté les bons portant un type
 * dupliqué ; on les rattache à leur onglet plutôt que de les rendre invisibles.
 */
function baseSlug(slug: string | null | undefined): string {
  return (slug ?? "").toLowerCase().replace(/-\d+$/, "");
}

export default function MacroscopyGlobalPage() {
  const queryClient = useQueryClient();

  // --- Filtres historique ---
  const [filterOrderId, setFilterOrderId] = useState("");
  const [filterOrderOption, setFilterOrderOption] =
    useState<TestOrderOption | null>(null);
  const [filterDate, setFilterDate] = useState("");
  const [filterEmployeeId, setFilterEmployeeId] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  // --- Filtre urgents ---
  const [filterTypeId, setFilterTypeId] = useState("");

  // --- Onglet actif ---
  const [activeTab, setActiveTab] = useState<string>("Histologie-Biopsie");

  // --- Modal suppression ---
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState<MacroListItem | null>(null);

  // ---- Queries ---------------------------------------------------------------

  const { data: macrosRaw, isLoading: macrosLoading } = useQuery({
    queryKey: ["macros-list"],
    queryFn: () => macroscopyApi.listAll().then((r) =>
      Array.isArray(r.data) ? r.data : (r.data as { content?: MacroListItem[] })?.content ?? []
    ),
  });

  const { data: pendingRaw, isLoading: pendingLoading } = useQuery({
    queryKey: ["macros-pending"],
    queryFn: () => macroscopyApi.getPending().then((r) =>
      Array.isArray(r.data) ? r.data : (r.data as { content?: PendingMacroOrder[] })?.content ?? []
    ),
  });

  const { data: employeesData } = useQuery({
    queryKey: ["employees-all"],
    queryFn: () => hrApi.findAll({ size: 200 }).then((r) => r.data),
  });
  const employees: Employee[] = employeesData?.content ?? [];

  // Le filtre « Demande d'examen » cherche en base (14 000 demandes) au lieu de
  // précharger une page ; voir `RemoteSelectField`.

  const { data: typeOrders = [] } = useQuery({
    queryKey: ["type-orders"],
    queryFn: () => typeOrdersApi.findAll().then((r) => r.data),
  });

  // ---- Mutations -------------------------------------------------------------

  const deleteMutation = useMutation({
    mutationFn: (id: string) => macroscopyApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["macros-list"] });
      toast.success("Macroscopie supprimée");
      setDeleteOpen(false);
      setToDelete(null);
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de la suppression");
    },
  });

  const stepMutation = useMutation({
    mutationFn: ({ id, step }: { id: string; step: string }) =>
      macroscopyApi.updateStep(id, step),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["macros-list"] });
      toast.success("Étape mise à jour");
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de la mise à jour");
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({
      testOrderId,
      employeeId,
    }: {
      testOrderId: string;
      employeeId: string;
    }) =>
      macroscopyApi.assign({
        testOrderId,
        employeeId,
        macroDate: new Date().toISOString().slice(0, 10),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["macros-pending"] });
      queryClient.invalidateQueries({ queryKey: ["macros-list"] });
      toast.success("Laborantin assigné");
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de l'assignation");
    },
  });

  // ---- Filtrage local --------------------------------------------------------

  const macrosArray: MacroListItem[] = Array.isArray(macrosRaw) ? macrosRaw : [];
  const pendingArray: PendingMacroOrder[] = Array.isArray(pendingRaw) ? pendingRaw : [];

  /**
   * Laborantins proposés au filtre : uniquement ceux qui apparaissent
   * réellement dans la colonne « Macro réalisé par ».
   *
   * Le filtre listait auparavant tout l'annuaire des employés (200 premiers),
   * si bien qu'un laborantin ayant réalisé des macros pouvait figurer dans la
   * colonne sans être proposé au filtre — et que des employés n'en ayant jamais
   * réalisé encombraient la liste.
   */
  const laborantinOptions = Array.from(
    new Map(
      macrosArray
        .filter((m) => m.employeeId && m.employeeName)
        .map((m) => [m.employeeId as string, m.employeeName as string]),
    ),
  )
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));

  const macros: MacroListItem[] = macrosArray.filter((m) => {
    if (filterOrderId && m.testOrderId !== filterOrderId) return false;
    if (filterDate && m.macroDate && !m.macroDate.startsWith(filterDate))
      return false;
    if (filterEmployeeId && m.employeeId !== filterEmployeeId) return false;
    if (
      filterSearch &&
      !m.testOrderCode?.toLowerCase().includes(filterSearch.toLowerCase())
    )
      return false;
    return true;
  });

  const urgentPending: PendingMacroOrder[] = pendingArray.filter((o) => {
    if (!o.isUrgent) return false;
    if (filterTypeId) {
      const typeOrder = typeOrders.find((t) => t.id === filterTypeId);
      if (typeOrder && o.typeOrderTitle !== typeOrder.title) return false;
    }
    return true;
  });

  // Répartition par slug de type de bon, comme les trois requêtes Laravel.
  // L'ancien filtre testait « le titre contient le premier mot de l'onglet » :
  // les bons de type Biopsie (plusieurs milliers) n'apparaissaient dans aucun
  // onglet, et un titre voisin pouvait atterrir dans le mauvais.
  const tabPending = (tab: string): PendingMacroOrder[] => {
    const slugs = TAB_TYPES.find((t) => t.key === tab)?.slugs ?? [];
    return pendingArray.filter(
      (o) => !o.isUrgent && slugs.includes(baseSlug(o.typeOrderSlug)),
    );
  };

  // ---- Handlers ---------------------------------------------------------------

  function handleAssign(testOrderId: string, employeeId: string) {
    assignMutation.mutate({ testOrderId, employeeId });
  }

  function handleStepUpdate(id: string, step: string) {
    stepMutation.mutate({ id, step });
  }

  function openDelete(macro: MacroListItem) {
    setToDelete(macro);
    setDeleteOpen(true);
  }

  // ---- Render ----------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <PageHeader
        title="Macroscopie"
        breadcrumbs={[
          { label: "Demandes d'examen", href: "/test-orders" },
          { label: "Macroscopie" },
        ]}
        action={
          <Link
            href="/test-orders/macroscopy/create"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Ajouter une macroscopie
          </Link>
        }
      />

      {/* ------------------------------------------------------------------ */}
      {/* Section 1 : Historique de traitement                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-800">
            Historique de traitement des demandes
          </h2>
        </div>

        <div className="p-5">
          {/* Filtres — 4 colonnes */}
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-800">
                Demande d&apos;examen
              </label>
              <RemoteSelectField<TestOrderOption>
                loadOptions={loadOrderOptions}
                value={filterOrderId || null}
                onChange={(v, opt) => {
                  setFilterOrderId(v ?? "");
                  setFilterOrderOption(opt);
                }}
                selectedOption={filterOrderOption}
                placeholder="Toutes les demandes"
                isClearable
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-800">
                Date
              </label>
              <input
                type="date"
                className={inputClass}
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-800">
                Réalisé par
              </label>
              <SelectField
                options={laborantinOptions}
                value={filterEmployeeId || null}
                onChange={(v) => setFilterEmployeeId(v ?? "")}
                placeholder="Tous les laborantins"
                isClearable
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-800">
                Rechercher
              </label>
              <input
                type="text"
                className={inputClass}
                placeholder="Recherche sur code…"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Tableau historique */}
          <div className="overflow-x-auto">
            {macrosLoading ? (
              <div className="space-y-2 py-4">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-8 animate-pulse rounded bg-gray-100"
                  />
                ))}
              </div>
            ) : macros.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">
                Aucune macroscopie enregistrée.
              </p>
            ) : (
              <table className="w-full text-sm [&_th]:border-r [&_th]:border-gray-300 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-gray-200 [&_td:last-child]:border-r-0">
                <thead>
                  <tr className="border-b-2 border-gray-300 bg-gray-200">
                    <th className="w-8 px-3 py-2 text-left">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-3 py-2 text-left font-bold text-gray-800">
                      Code
                    </th>
                    <th className="px-3 py-2 text-left font-bold text-gray-800">
                      Macro Réalisée par
                    </th>
                    <th className="px-3 py-2 text-left font-bold text-gray-800">
                      Date Macro
                    </th>
                    <th className="px-3 py-2 text-left font-bold text-gray-800">
                      Date Montage
                    </th>
                    <th className="px-3 py-2 text-left font-bold text-gray-800">
                      Etapes
                    </th>
                    <th className="px-3 py-2 text-left font-bold text-gray-800">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {macros.map((macro) => (
                    <tr
                      key={macro.id}
                      className="border-b border-gray-200 hover:bg-gray-50"
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900">
                        {macro.testOrderCode}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {macro.employeeName ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {macro.macroDate ? formatDate(macro.macroDate) : "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {macro.mountingDate
                          ? formatDate(macro.mountingDate)
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="space-y-1">
                          <StepBadges macro={macro} />
                          <StepSelect
                            onUpdate={(step) =>
                              handleStepUpdate(macro.id, step)
                            }
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <IconButton
                          variant="delete"
                          title="Supprimer"
                          aria-label="Supprimer"
                          onClick={() => openDelete(macro)}
                          icon={<Trash2 className="h-4 w-4" />}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2 : Demandes urgentes                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-800">
            Demandes d&apos;examens urgent à traiter
          </h2>
        </div>
        <div className="p-5">
          {/* Badge urgent */}
          <div className="mb-3 inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
            Cas urgent : {urgentPending.length}
          </div>

          {/* Filtre type examen */}
          <div className="mb-4 max-w-xs">
            <label className="mb-1 block text-xs font-bold text-gray-800">
              Type d&apos;examen
            </label>
            <SelectField
              options={typeOrders.map((t) => ({ value: t.id, label: t.title }))}
              value={filterTypeId || null}
              onChange={(v) => setFilterTypeId(v ?? "")}
              placeholder="Tous"
              isClearable
            />
          </div>

          {pendingLoading ? (
            <div className="space-y-2 py-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />
              ))}
            </div>
          ) : (
            <PendingByTypeTable
              orders={urgentPending}
              employees={employees}
              onAssign={handleAssign}
            />
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3 : Onglets par type                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-800">
            Demandes d&apos;examens{" "}
            <span className="text-green-600">{activeTab}</span> à traiter
          </h2>
        </div>
        <div className="p-5">
          {/* Onglets */}
          <div className="mb-4 flex flex-wrap gap-2">
            {TAB_TYPES.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-full px-4 py-1.5 text-[.9rem] font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tableau de l'onglet actif */}
          {pendingLoading ? (
            <div className="space-y-2 py-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />
              ))}
            </div>
          ) : (
            <PendingByTypeTable
              orders={tabPending(activeTab)}
              employees={employees}
              onAssign={handleAssign}
            />
          )}
        </div>
      </div>

      {/* Modal suppression */}
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setToDelete(null);
        }}
        onConfirm={() => {
          if (toDelete) deleteMutation.mutate(toDelete.id);
        }}
        title="Supprimer cette macroscopie"
        message={`Voulez-vous vraiment supprimer la macroscopie pour la demande "${
          toDelete?.testOrderCode ?? ""
        }" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
