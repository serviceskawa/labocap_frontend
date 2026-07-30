"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  FileText,
  Trash2,
  Printer,
  Eye,
  Folder,
  BarChart2,
  CalendarIcon,
  ArrowRight,
  ArrowUp,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { IconButton } from "@/components/ui/IconButton";

import { usePermissions } from "@/hooks/usePermissions";
import { useAuthStore } from "@/stores/auth.store";
import { formatCFA, formatDate } from "@/lib/utils";
import {
  dashboardApi,
  ReportToday,
  DoctorStat,
  RevenueData,
  AppointmentItem,
  DoctorOrder,
} from "@/lib/api/dashboard";
import { PERMISSIONS } from "@/lib/constants/permissions";
import apiClient from "@/lib/api/client";
import { reportsApi } from "@/lib/api/reports";
import { Button } from "@/components/ui/Button";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function CardHeader({ title }: { title: string }) {
  return (
    <div className="px-5 py-4 border-b border-gray-100">
      <h2 className="text-base font-semibold text-gray-800">{title}</h2>
    </div>
  );
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, j) => (
        <td key={j} className="py-2 px-3">
          <div className="h-3 animate-pulse rounded bg-gray-200" />
        </td>
      ))}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// ActionButtons — boutons actions pour la table des comptes rendu
// ---------------------------------------------------------------------------

interface ActionButtonsProps {
  report: ReportToday;
  onDeleted: () => void;
}

function ActionButtons({ report, onDeleted }: ActionButtonsProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await apiClient.delete(`/reports/${report.id}`);
      onDeleted();
    } finally {
      setIsDeleting(false);
      setConfirmOpen(false);
    }
  };

  /**
   * Ouvre le PDF du compte rendu — équivalent de la route Laravel `report.pdf`.
   *
   * L'ancien lien pointait sur `/reports/{id}/print`, une route qui n'existe pas
   * dans `src/app` : le bouton renvoyait une 404.
   */
  const handlePrintReport = async () => {
    setIsPrinting(true);
    try {
      const res = await reportsApi.downloadPdf(report.id);
      const url = URL.createObjectURL(res.data as Blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setIsPrinting(false);
    }
  };

  const handleCreateInvoice = async () => {
    try {
      const res = await apiClient.post<{ id: string }>(
        `/invoices/from-order/${report.id}`
      );
      router.push(`/invoices/${res.data.id}`);
    } catch {
      // handled globally
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {report.status !== 1 && (
        <>
          <Link
            href={`/test-orders/${report.testOrderId}/details`}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Compte rendu
          </Link>
          <IconButton
            variant="delete"
            title="Supprimer"
            aria-label="Supprimer"
            onClick={() => setConfirmOpen(true)}
            icon={<Trash2 className="h-4 w-4" />}
          />
        </>
      )}

      {report.status === 1 && (
        <>
          <Link
            href={`/reports/${report.id}`}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            CR terminé
          </Link>
          <Button
            onClick={handlePrintReport}
            disabled={isPrinting}
            className="gap-1 rounded bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800 hover:bg-yellow-200 hover:shadow-none"
          >
            <Printer className="h-3.5 w-3.5" />
            {isPrinting ? "Génération…" : "Imprimer"}
          </Button>
        </>
      )}

      {report.invoiceId ? (
        <Link
          href={`/invoices/${report.invoiceId}`}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
        >
          <Eye className="h-3.5 w-3.5" />
          Voir Facture
        </Link>
      ) : (
        <Button
          onClick={handleCreateInvoice}
          className="gap-1 rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200 hover:shadow-none"
        >
          Créer Facture
        </Button>
      )}

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Supprimer ce compte rendu"
        message="Cette action est irréversible. Voulez-vous vraiment supprimer ce compte rendu ?"
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProgressTable
// ---------------------------------------------------------------------------

interface ProgressTableProps {
  headers: [string, string];
  data: Array<{ label: string; value: number }>;
  color?: string;
}

function ProgressTable({
  headers,
  data,
  color = "bg-blue-500",
}: ProgressTableProps) {
  const max = data.length > 0 ? Math.max(...data.map((d) => d.value)) : 1;
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50">
        <tr>
          <th className="py-2 px-3 text-left text-[.875rem] font-semibold text-gray-700">
            {headers[0]}
          </th>
          <th className="py-2 px-3 text-right text-[.875rem] font-semibold text-gray-700">
            {headers[1]}
          </th>
          <th className="py-2 px-3 w-32" />
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {data.map((item, i) => {
          const ratio = Math.round((item.value / (max || 1)) * 100);
          return (
            <tr key={i} className="hover:bg-gray-50">
              <td className="py-2 px-3 text-gray-700">{item.label}</td>
              <td className="py-2 px-3 text-right font-semibold text-gray-900">
                {item.value}
              </td>
              <td className="py-2 px-3">
                <div className="h-[3px] bg-gray-100 rounded">
                  <div
                    className={`h-[3px] rounded ${color}`}
                    style={{ width: `${ratio}%` }}
                  />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// DonutChart — générique
// ---------------------------------------------------------------------------

interface DonutSegment {
  name: string;
  value: number;
  color: string;
}

/**
 * Donut générique.
 *
 * Une part non nulle mais minuscule (3 factures d'avoir sur 12 418, soit
 * 0,02 %) trace un arc de 0,09° : invisible à l'écran. La légende annonce
 * alors quatre couleurs alors que le donut n'en montre que deux, ce qui se lit
 * comme un bug de couleurs. On dessine donc chaque part non nulle avec un arc
 * plancher (`minSlicePercent` du total), tout en gardant la valeur réelle pour
 * l'infobulle et pour la légende.
 *
 * L'anneau est plein : ni `paddingAngle` ni contour blanc entre les parts. Le
 * seul blanc visible est le trou central du donut ; tout le reste de la
 * couronne appartient à une couleur de la légende.
 */
function DonutChart({
  segments,
  minSlicePercent = 3,
}: {
  segments: DonutSegment[];
  minSlicePercent?: number;
}) {
  const filtered = segments.filter((s) => s.value > 0);
  if (filtered.length === 0) {
    return (
      <p className="text-center text-gray-400 text-sm py-4">Aucune donnée</p>
    );
  }
  const total = filtered.reduce((sum, s) => sum + s.value, 0);
  const floor = (total * minSlicePercent) / 100;
  const data = filtered.map((s) => ({ ...s, arc: Math.max(s.value, floor) }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          dataKey="arc"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={80}
          paddingAngle={0}
        >
          {data.map((entry, i) => (
            // Contour de la couleur de la part : sans lui, recharts trace un
            // liseré blanc par défaut entre deux secteurs adjacents.
            <Cell
              key={i}
              fill={entry.color}
              stroke={entry.color}
              strokeWidth={1}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name, item) => {
            const real = (item?.payload as DonutSegment | undefined)?.value;
            return [real ?? value, name];
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// RevenueLineChart
// ---------------------------------------------------------------------------

const WEEK_DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/**
 * Courbe du chiffre d'affaires, calquée sur le `#revenue-chart` de Laravel :
 * deux séries lissées (semaine actuelle / précédente) sur les jours Lun→Dim,
 * axe des ordonnées en milliers, légende masquée (les deux libellés sont déjà
 * affichés au-dessus du graphique).
 *
 * Les points sont placés d'après la DATE renvoyée par l'API et non d'après leur
 * rang : une série incomplète ne peut donc pas décaler la courbe.
 */
function RevenueLineChart({ data }: { data: RevenueData }) {
  /** Total du jour de la semaine (0 = lundi) pour une série. */
  const byWeekday = (serie: RevenueData["currentWeekByDay"]) => {
    const totals = Array<number>(7).fill(0);
    for (const point of serie ?? []) {
      // `date` est un jour ISO (YYYY-MM-DD) : on le lit en UTC pour que le
      // fuseau local ne fasse pas basculer le point sur la veille.
      const day = new Date(`${point.date}T00:00:00Z`).getUTCDay();
      totals[(day + 6) % 7] = point.total ?? 0; // dimanche (0) → index 6
    }
    return totals;
  };

  const current = byWeekday(data.currentWeekByDay);
  const previous = byWeekday(data.lastWeekByDay);
  const chartData = WEEK_DAYS.map((day, i) => ({
    name: day,
    actuelle: current[i],
    precedente: previous[i],
  }));

  // Semaine sans encaissement : sans échelle imposée, l'axe afficherait cinq
  // graduations « 0k » identiques. On lui donne alors une amplitude par défaut.
  const maxValue = Math.max(...current, ...previous, 0);

  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f3fa" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={48}
          domain={[0, maxValue > 0 ? "auto" : 4000]}
          // Format « k » comme Laravel, avec une décimale au besoin : sans elle,
          // une échelle courte afficherait deux graduations « 2k » identiques.
          tickFormatter={(v) =>
            `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
              Number(v) / 1000,
            )}k`
          }
        />
        <Tooltip formatter={(v) => formatCFA(Number(v))} />
        <Line
          type="monotone"
          dataKey="actuelle"
          stroke="#727cf5"
          strokeWidth={4}
          dot={false}
          name="Semaine actuelle"
        />
        <Line
          type="monotone"
          dataKey="precedente"
          stroke="#0acf97"
          strokeWidth={4}
          dot={false}
          name="Semaine précédente"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// SimpleCalendar
// ---------------------------------------------------------------------------

function SimpleCalendar() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0=dim
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
  ];
  const dayNames = ["Di", "Lu", "Ma", "Me", "Je", "Ve", "Sa"];

  // Build grid cells (leading empty + day numbers)
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="text-sm">
      <p className="text-center font-semibold text-gray-700 mb-2">
        {monthNames[month]} {year}
      </p>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {dayNames.map((d) => (
          <div
            key={d}
            className="text-xs font-semibold text-gray-400 py-1"
          >
            {d}
          </div>
        ))}
        {cells.map((cell, i) => (
          <div
            key={i}
            className={`text-xs py-1 rounded ${
              cell === null
                ? ""
                : cell === today.getDate()
                  ? "bg-blue-500 text-white font-bold"
                  : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {cell ?? ""}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function HomePage() {
  const { can } = usePermissions();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const isAdmin = can(PERMISSIONS.VIEW_ADMIN_DASHBOARD);
  const isFinance = can(PERMISSIONS.VIEW_DASHBORD_FINANCE);
  const isSecretary = can(PERMISSIONS.VIEW_SECRETARIAT_DASHBOARD);
  const isPathologist = can(PERMISSIONS.VIEW_PATHOLOGIST_DASHBOARD);

  // -- Admin stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => dashboardApi.getStats().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled: isAdmin,
  });

  // -- Reports today
  const { data: reportsToday = [], isLoading: reportsTodayLoading } = useQuery({
    queryKey: ["dashboard", "reports-today"],
    queryFn: () => dashboardApi.getReportsToday().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled: isSecretary || isAdmin,
  });

  const reportsDelivered = useMemo(
    () => reportsToday.filter((r) => r.isDeliver),
    [reportsToday]
  );

  // -- Top examens
  const { data: topExamens = [], isLoading: topExamensLoading } = useQuery({
    queryKey: ["dashboard", "top-examens"],
    queryFn: () => dashboardApi.getTopExamens().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled: isAdmin,
  });

  // -- Monthly stats
  const { data: monthlyStats, isLoading: monthlyLoading } = useQuery({
    queryKey: ["dashboard", "monthly-stats"],
    queryFn: () => dashboardApi.getMonthlyStats().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled: isAdmin,
  });

  // -- Admin exam status pie (pour la section admin)
  const adminPieData = [
    { name: "Terminé", value: stats?.finishTest ?? 0, color: "#0acf97" },
    { name: "En attente", value: stats?.noFinishTest ?? 0, color: "#E52D4F" },
  ];

  // -- Finance
  const { data: revenueData } = useQuery({
    queryKey: ["dashboard", "revenue"],
    queryFn: () => dashboardApi.getRevenueData().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled: isFinance,
  });

  const { data: invoiceStatus } = useQuery({
    queryKey: ["dashboard", "invoice-status"],
    queryFn: () => dashboardApi.getInvoiceStatus().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled: isFinance,
  });

  // Segments du donut FACTURES — source unique du donut et de sa légende, dans
  // l'ordre et les couleurs du `data-colors` de dashboardPlus.blade.php.
  const invoiceSegments: DonutSegment[] = [
    {
      name: "Factures de vente payées",
      value: invoiceStatus?.invoicePaid ?? 0,
      color: "#727cf5",
    },
    {
      name: "Factures de vente non payées",
      value: invoiceStatus?.invoiceNoPaid ?? 0,
      color: "#0acf97",
    },
    {
      name: "Factures d'avoir payées",
      value: invoiceStatus?.refundPaid ?? 0,
      color: "#fa5c7c",
    },
    {
      name: "Factures d'avoir non payées",
      value: invoiceStatus?.refundNoPaid ?? 0,
      color: "#ffbc00",
    },
  ];
  const invoiceSegmentsTotal = invoiceSegments.reduce((s, x) => s + x.value, 0);

  /** Part d'un segment, sans jamais afficher « 0,0 % » pour un compteur non nul. */
  const invoiceShare = (value: number) => {
    if (invoiceSegmentsTotal === 0) return "—";
    const pct = (value / invoiceSegmentsTotal) * 100;
    if (value > 0 && pct < 0.1) return "< 0,1 %";
    return `${pct.toFixed(1).replace(".", ",")} %`;
  };

  // -- Doctor stats
  const { data: doctorStats = [], isLoading: doctorStatsLoading } = useQuery({
    queryKey: ["dashboard", "doctor-stats"],
    queryFn: () => dashboardApi.getDoctorStats().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled: isAdmin || isFinance,
  });

  // -- Connected users
  const { data: connectedUsers = [], isLoading: connectedLoading } = useQuery({
    queryKey: ["dashboard", "connected-users"],
    queryFn: () => dashboardApi.getConnectedUsers().then((r) => r.data),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    enabled: isAdmin || isFinance,
  });

  // -- Pathologist
  const { data: doctorExamStatus } = useQuery({
    queryKey: ["dashboard", "doctor-exam-status"],
    queryFn: () => dashboardApi.getDoctorExamStatus().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled: isPathologist,
  });

  const { data: doctorOrders = [], isLoading: doctorOrdersLoading } = useQuery(
    {
      queryKey: ["dashboard", "doctor-orders"],
      queryFn: () => dashboardApi.getDoctorOrders().then((r) => r.data),
      staleTime: 5 * 60 * 1000,
      refetchInterval: 5 * 60 * 1000,
      enabled: isPathologist,
    }
  );

  const { data: doctorOrdersToday = [], isLoading: doctorOrdersTodayLoading } =
    useQuery({
      queryKey: ["dashboard", "doctor-orders-today"],
      queryFn: () => dashboardApi.getDoctorOrdersToday().then((r) => r.data),
      staleTime: 5 * 60 * 1000,
      refetchInterval: 5 * 60 * 1000,
      enabled: isPathologist,
    });

  const { data: doctorAppointments = [] } = useQuery({
    queryKey: ["dashboard", "doctor-appointments"],
    queryFn: () => dashboardApi.getDoctorAppointments().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled: isPathologist,
  });

  // ExamStatusChart ne renvoie que deux compteurs (termine / enAttente) :
  // on alimente le donut avec ces deux valeurs réelles, sans segment factice.
  const doctorPieData = [
    {
      name: "Terminé",
      value: doctorExamStatus?.termine ?? 0,
      color: "#0acf97",
    },
    {
      name: "En attente",
      value: doctorExamStatus?.enAttente ?? 0,
      color: "#fa5c7c",
    },
  ];

  const doctorOrdersTermine = doctorOrders.filter(
    (o) => o.reportStatus === 1
  ).length;
  const doctorOrdersTotal = doctorOrders.length;

  // Productivité = taux d'examens terminés sur le total affecté au pathologiste.
  // Calculée à partir des compteurs réels déjà chargés (doctorExamStatus) ;
  // affiche "—" si aucune donnée n'est disponible (plutôt qu'un "0 ↑" trompeur).
  const doctorExamsTotal =
    (doctorExamStatus?.termine ?? 0) + (doctorExamStatus?.enAttente ?? 0);
  const doctorProductivite =
    doctorExamsTotal > 0
      ? Math.round(((doctorExamStatus?.termine ?? 0) / doctorExamsTotal) * 100)
      : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader title="Tableau de bord" />

      {/* ==================================================================
          SECTION ADMIN
      ================================================================== */}
      {isAdmin && (
        <>
          {/* LIGNE 1 : 4 KPI cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statsLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 animate-pulse"
                  >
                    <div className="h-3 bg-gray-200 rounded w-1/2 mb-3" />
                    <div className="h-8 bg-gray-200 rounded w-3/4" />
                  </div>
                ))
              : [
                  {
                    title: "PATIENTS",
                    value: stats?.valeurPatient ?? 0,
                    trend: stats?.crPatient,
                  },
                  {
                    title: "CLIENTS PRO.",
                    value: stats?.valeurClient ?? 0,
                    trend: stats?.crClient,
                  },
                  {
                    title: "DEMANDE D'EXAMEN",
                    value: stats?.valeurTestOrder ?? 0,
                    trend: stats?.crTestOrder,
                  },
                  {
                    title: "CHIFFRE D'AFFAIRES",
                    value: formatCFA(stats?.valeurInvoice ?? 0),
                    trend: stats?.crInvoice,
                  },
                ].map((kpi) => (
                  <Card key={kpi.title} className="p-5">
                    {/* Pas d'icône dans la carte : seuls le libellé, la valeur et
                        l'évolution mensuelle sont affichés. */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Tailles reprises de Laravel : titre h5 .9rem en graisse
                            normale, valeur h3 1.42rem — le texte tient ainsi dans la
                            carte (le 30px précédent débordait sur le chiffre d'affaires). */}
                        <p className="text-[.9rem] text-gray-500 font-normal mt-0">
                          {kpi.title}
                        </p>
                        <p className="text-[1.42rem] font-bold mt-3 mb-3 text-gray-900">
                          {kpi.value}
                        </p>
                        {kpi.trend !== undefined && (
                          <p
                            className={`text-[.9rem] font-medium ${kpi.trend >= 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            {kpi.trend >= 0 ? "↑" : "↓"} {kpi.trend}%{" "}
                            <span className="text-gray-400 font-normal">
                              Depuis le mois passé
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
          </div>

          {/* LIGNE 2 : EXAMENS LES PLUS DEMANDÉS + STATUT D'EXAMENS */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Gauche 50% : EXAMENS LES PLUS DEMANDÉS */}
            <div className="flex-1">
              <Card>
                <CardHeader title="EXAMENS LES PLUS DEMANDÉS" />
                <div className="overflow-x-auto">
                  {/* Comme dans Laravel (dashboardPlus.blade.php) : le tableau des
                      examens les plus demandés n'a pas de ligne d'en-tête. */}
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      {topExamensLoading
                        ? Array.from({ length: 5 }).map((_, i) => (
                            <SkeletonRow key={i} cols={3} />
                          ))
                        : topExamens.slice(0, 7).map((ex, idx) => (
                            <tr
                              key={idx}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <td className="py-2 px-3 text-gray-500 text-sm w-10">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-3 text-gray-700">
                                {ex.testName}
                              </td>
                              <td className="py-2 px-3 text-gray-700">
                                {ex.totalDemandes}
                              </td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Droite 50% : STATUT D'EXAMENS */}
            <div className="flex-1">
              <Card>
                <CardHeader title="STATUT D'EXAMENS" />
                <div className="p-5">
                  <DonutChart segments={adminPieData} />
                  <div className="flex justify-around mt-3">
                    <div className="text-center">
                      <p className="text-green-600 font-semibold text-lg">
                        ↑ {stats?.finishTest ?? 0}
                      </p>
                      <p className="text-xs text-gray-500">Terminé</p>
                    </div>
                    <div className="text-center">
                      <p className="text-red-600 font-semibold text-lg">
                        ↓ {stats?.noFinishTest ?? 0}
                      </p>
                      <p className="text-xs text-gray-500">En attente</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* LIGNE 3 : STATISTIQUE MENSUELLE (full width) */}
          <Card>
            <CardHeader title="STATISTIQUE MENSUELLE" />
            <div className="p-5 space-y-6">
              {/* Carte imbriquée EXAMENS DEMANDES */}
              <div className="border border-gray-100 rounded-lg p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  EXAMENS DEMANDES
                </p>
                {monthlyLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-16 animate-pulse rounded bg-gray-200"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 text-center">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total d&apos;examens
                      </p>
                      <p className="text-3xl font-semibold mt-3 mb-3 text-gray-900">
                        {monthlyStats?.nombreTests ?? 0}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 text-center">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Chiffre d&apos;affaire
                      </p>
                      <p className="text-3xl font-semibold mt-3 mb-3 text-gray-900">
                        {formatCFA(monthlyStats?.caTests ?? 0)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 text-center">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Patients
                      </p>
                      <p className="text-3xl font-semibold mt-3 mb-3 text-gray-900">
                        {monthlyStats?.totalPatientTest ?? 0}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Carte imbriquée STATISTIQUE PATIENTS */}
              <div className="border border-gray-100 rounded-lg p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  STATISTIQUE PATIENTS
                </p>
                {monthlyLoading ? (
                  <div className="h-20 animate-pulse rounded bg-gray-200" />
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Hôpitaux */}
                    <div>
                      <ProgressTable
                        headers={["Hôpital", "Patients"]}
                        data={(monthlyStats?.byHopital ?? []).map((h) => ({
                          label: h.nom,
                          value: h.totalPatients,
                        }))}
                        color="bg-blue-500"
                      />
                    </div>
                    {/* Médecin traitant */}
                    <div>
                      <ProgressTable
                        headers={["Médécin", "Patients"]}
                        data={(monthlyStats?.byMedecin ?? []).map((h) => ({
                          label: h.nom,
                          value: h.totalPatients,
                        }))}
                        color="bg-blue-500"
                      />
                    </div>
                    {/* Type de demande */}
                    <div>
                      <ProgressTable
                        headers={["Type", "Patients"]}
                        data={(monthlyStats?.byType ?? []).map((h) => ({
                          label: h.nom,
                          value: h.totalPatients,
                        }))}
                        color="bg-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </>
      )}

      {/* ==================================================================
          SECTION FINANCE
      ================================================================== */}
      {isFinance && (
        <>
          {/* LIGNE 4 : CHIFFRE D'AFFAIRES + FACTURES */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Gauche col-8 : CHIFFRE D'AFFAIRES */}
            <div className="lg:flex-[2]">
              <Card>
                <CardHeader title="CHIFFRE D'AFFAIRES" />
                <div className="p-5">
                  {/* Bandeau des deux totaux hebdomadaires — calque du bloc
                      `chart-content-bg` de Laravel : libellé au-dessus, montant en
                      gros précédé d'une puce de la couleur de la série. */}
                  <div className="rounded bg-gray-50 py-3">
                    <div className="grid grid-cols-1 text-center sm:grid-cols-2">
                      <div>
                        <p className="mb-0 mt-3 text-sm text-gray-500">
                          Semaine actuelle
                        </p>
                        <p className="mb-3 text-2xl font-normal text-gray-900">
                          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#727cf5] align-middle" />
                          {formatCFA(revenueData?.totalCurrentWeek ?? 0)}
                        </p>
                      </div>
                      <div>
                        <p className="mb-0 mt-3 text-sm text-gray-500">
                          Semaine précédente
                        </p>
                        <p className="mb-3 text-2xl font-normal text-gray-900">
                          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#0acf97] align-middle" />
                          {formatCFA(revenueData?.totalLastWeek ?? 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                  {/* Total du jour + accès aux relevés (bouton Laravel
                      « View Statements », classe btn-outline-primary). */}
                  <div className="mt-4 mb-4">
                    <h5 className="mb-2 text-base font-semibold text-gray-800">
                      Aujourd&apos;hui: {formatCFA(revenueData?.totalToday ?? 0)}
                    </h5>
                    <Link
                      href="/invoices/business"
                      className="inline-flex items-center gap-2 rounded-[.15rem] border border-blue-600 px-[.9rem] py-[.45rem] text-[.9rem] text-blue-600 transition-colors hover:bg-blue-600 hover:text-white"
                    >
                      View Statements
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                  {/* Graphique ligne */}
                  {revenueData ? (
                    <RevenueLineChart data={revenueData} />
                  ) : (
                    <div className="h-[220px] animate-pulse rounded bg-gray-100" />
                  )}
                </div>
              </Card>
            </div>

            {/* Droite col-4 : FACTURES */}
            <div className="lg:flex-[1]">
              <Card>
                <CardHeader title="FACTURES" />
                <div className="p-5">
                  {invoiceStatus ? (
                    <>
                      <DonutChart segments={invoiceSegments} />
                      {/* Légende — mêmes couleurs et même ordre que les segments
                          du donut, la part exacte compensant l'arc plancher. */}
                      <div className="space-y-2 mt-3">
                        {invoiceSegments.map((segment) => (
                          <div
                            key={segment.name}
                            className="flex items-center gap-2 text-xs text-gray-600"
                          >
                            <span
                              className="h-3 w-3 rounded-sm inline-block shrink-0"
                              style={{ backgroundColor: segment.color }}
                            />
                            <span className="flex-1 leading-tight">
                              {segment.name}
                            </span>
                            <span className="text-gray-400 whitespace-nowrap">
                              {invoiceShare(segment.value)}
                            </span>
                            <span className="font-semibold text-gray-800 w-12 text-right">
                              {segment.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="h-[200px] animate-pulse rounded bg-gray-100" />
                  )}
                </div>
              </Card>
            </div>
          </div>

          {/* LIGNE 5 : Statistique par docteurs + Utilisateurs connectés */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Gauche 50% : Statistique par docteurs */}
            <div className="flex-1">
              <Card>
                <CardHeader title="Statistique par docteurs" />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-2 px-3 text-left text-[.875rem] font-semibold text-gray-700">
                          Docteurs
                        </th>
                        <th className="py-2 px-3 text-left text-[.875rem] font-semibold text-gray-700">
                          Demandes Affectées
                        </th>
                        <th className="py-2 px-3 text-left text-[.875rem] font-semibold text-gray-700">
                          Demandes Traitées
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {doctorStatsLoading
                        ? Array.from({ length: 4 }).map((_, i) => (
                            <SkeletonRow key={i} cols={3} />
                          ))
                        : doctorStats.map((ds: DoctorStat, i) => (
                            <tr
                              key={i}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <td className="py-2 px-3 text-gray-700">
                                {ds.doctor}
                              </td>
                              <td className="py-2 px-3 text-gray-700">
                                {ds.assigne}
                              </td>
                              <td className="py-2 px-3 text-gray-700">
                                {ds.traite}
                              </td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Droite 50% : Utilisateurs connectés */}
            <div className="flex-1">
              <Card>
                <CardHeader title="Utilisateurs connectés" />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-2 px-3 text-left text-[.875rem] font-semibold text-gray-700 w-8">
                          #
                        </th>
                        <th className="py-2 px-3 text-left text-[.875rem] font-semibold text-gray-700">
                          Nom
                        </th>
                        <th className="py-2 px-3 text-left text-[.875rem] font-semibold text-gray-700">
                          Email
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {connectedLoading
                        ? Array.from({ length: 3 }).map((_, i) => (
                            <SkeletonRow key={i} cols={3} />
                          ))
                        : connectedUsers.map((u, idx) => (
                            <tr
                              key={u.id}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <td className="py-2 px-3 text-gray-400 text-xs">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-3 text-gray-700">
                                {u.lastname} {u.firstname}
                                {u.id === user?.id && (
                                  <span className="ml-1 text-xs text-gray-400">
                                    (Vous)
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-gray-600">
                                {u.email}
                              </td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* ==================================================================
          SECTION SECRÉTARIAT
      ================================================================== */}
      {isSecretary && (
        <>
          {/* LIGNE 6 : Comptes rendu dsponible aujourd'hui (full width) */}
          <Card>
            <CardHeader title="Comptes rendu dsponible aujourd'hui" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-2 px-3 text-left text-[.875rem] font-semibold text-gray-700">
                      Date
                    </th>
                    <th className="py-2 px-3 text-left text-[.875rem] font-semibold text-gray-700">
                      Code
                    </th>
                    <th className="py-2 px-3 text-left text-[.875rem] font-semibold text-gray-700">
                      Patiens
                    </th>
                    <th className="py-2 px-3 text-left text-[.875rem] font-semibold text-gray-700">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reportsTodayLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <SkeletonRow key={i} cols={4} />
                    ))
                  ) : reportsDelivered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-4 px-3 text-center text-gray-400 text-sm"
                      >
                        Aucun compte rendu disponible aujourd&apos;hui
                      </td>
                    </tr>
                  ) : (
                    reportsDelivered.map((report: ReportToday) => (
                      <tr
                        key={report.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-2 px-3 text-gray-600">
                          {formatDate(report.createdAt)}
                        </td>
                        <td className="py-2 px-3 text-gray-700">
                          {report.code}
                        </td>
                        <td className="py-2 px-3 text-gray-700">
                          {report.patientLastname} {report.patientFirstname}
                        </td>
                        <td className="py-2 px-3">
                          <ActionButtons
                            report={report}
                            onDeleted={() =>
                              queryClient.invalidateQueries({
                                queryKey: ["dashboard", "reports-today"],
                              })
                            }
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ==================================================================
          SECTION PATHOLOGISTE
      ================================================================== */}
      {isPathologist && (
        <>
          {/* LIGNE 7 : widget-inline (total demandes + productivité) */}
          <Card>
            {/* Calque du `card widget-inline` de Laravel : deux colonnes de même
                largeur, contenu centré, icône discrète au-dessus de la valeur et
                filet de séparation entre les deux. */}
            <div className="grid grid-cols-1 sm:grid-cols-2">
              <div className="p-5 text-center">
                <Folder className="mx-auto h-6 w-6 text-gray-400" />
                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  {doctorOrdersTotal}
                </p>
                <p className="mb-0 text-[15px] text-gray-500">
                  Total de demandes d&apos;examen affectées
                </p>
              </div>
              <div className="border-t border-gray-200 p-5 text-center sm:border-l sm:border-t-0">
                <BarChart2 className="mx-auto h-6 w-6 text-gray-400" />
                <p className="mt-2 inline-flex items-center gap-1 text-3xl font-semibold text-gray-900">
                  {doctorProductivite ?? 0}
                  {doctorProductivite !== null && "%"}
                  <ArrowUp className="h-5 w-5 text-green-500" />
                </p>
                <p className="mb-0 text-[15px] text-gray-500">Productivité</p>
              </div>
            </div>
          </Card>

          {/* LIGNE 8 : Status d'examens + Demande affectées */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Gauche col-4 : Status d'examens */}
            <div className="lg:w-5/12">
              <Card>
                <CardHeader title="Status d'examens" />
                <div className="p-5">
                  <DonutChart segments={doctorPieData} />
                  <div className="flex justify-around mt-3">
                    <div className="text-center">
                      <p className="text-green-600 font-semibold text-lg">
                        ↑ {doctorExamStatus?.termine ?? 0}
                      </p>
                      <p className="text-xs text-gray-500">Terminé</p>
                    </div>
                    <div className="text-center">
                      <p className="text-red-600 font-semibold text-lg">
                        ↓ {doctorExamStatus?.enAttente ?? 0}
                      </p>
                      <p className="text-xs text-gray-500">En attente</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Droite col-8 : Demande affectées */}
            <div className="lg:flex-1">
              <Card>
                <CardHeader title="Demande affectées" />
                <div className="px-5 pt-3 pb-1">
                  <p className="text-sm text-gray-600 mb-3">
                    <strong>{doctorOrdersTermine}</strong> Demandes d&apos;examen terminées sur{" "}
                    {doctorOrdersTotal}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-2 px-3 text-left text-[.875rem] font-semibold text-gray-700">
                          Date
                        </th>
                        <th className="py-2 px-3 text-left text-[.875rem] font-semibold text-gray-700">
                          Code
                        </th>
                        <th className="py-2 px-3 text-left text-[.875rem] font-semibold text-gray-700">
                          Patient
                        </th>
                        <th className="py-2 px-3 text-left text-[.875rem] font-semibold text-gray-700">
                          Compte rendu
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {doctorOrdersLoading
                        ? Array.from({ length: 4 }).map((_, i) => (
                            <SkeletonRow key={i} cols={4} />
                          ))
                        : doctorOrders.map((order: DoctorOrder) => (
                            <tr
                              key={order.id}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <td className="py-2 px-3 text-gray-600">
                                {formatDate(order.createdAt)}
                              </td>
                              <td className="py-2 px-3">
                                <Link
                                  href={`/test-orders/${order.id}/details`}
                                  className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  {order.code}
                                </Link>
                              </td>
                              <td className="py-2 px-3 text-gray-700">
                                {order.patientLastname} {order.patientFirstname}
                              </td>
                              <td className="py-2 px-3">
                                {order.reportStatus === 1 ? (
                                  <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                                    Terminé
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700">
                                    En attente
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>

          {/* LIGNE 9 : Activités récentes + Calendrier */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Gauche col-6 : Activités récentes */}
            <div className="flex-1">
              <Card>
                <CardHeader title="Activités récentes" />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-2 px-3 text-left text-[.875rem] font-semibold text-gray-700">
                          Date
                        </th>
                        <th className="py-2 px-3 text-left text-[.875rem] font-semibold text-gray-700">
                          Code
                        </th>
                        <th className="py-2 px-3 text-left text-[.875rem] font-semibold text-gray-700">
                          Patient
                        </th>
                        <th className="py-2 px-3 text-left text-[.875rem] font-semibold text-gray-700">
                          Compte rendu
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {doctorOrdersTodayLoading
                        ? Array.from({ length: 4 }).map((_, i) => (
                            <SkeletonRow key={i} cols={4} />
                          ))
                        : doctorOrdersToday.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="py-4 px-3 text-center text-gray-400 text-sm"
                            >
                              Aucune activité aujourd&apos;hui
                            </td>
                          </tr>
                        ) : (
                          doctorOrdersToday.map((order: DoctorOrder) => (
                            <tr
                              key={order.id}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <td className="py-2 px-3 text-gray-600">
                                {formatDate(order.createdAt)}
                              </td>
                              <td className="py-2 px-3">
                                <Link
                                  href={`/test-orders/${order.id}/details`}
                                  className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  {order.code}
                                </Link>
                              </td>
                              <td className="py-2 px-3 text-gray-700">
                                {order.patientLastname}{" "}
                                {order.patientFirstname}
                              </td>
                              <td className="py-2 px-3">
                                {order.reportStatus === 1 ? (
                                  <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                                    Terminé
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700">
                                    En attente
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Droite col-6 : Calendrier */}
            <div className="flex-1">
              <Card>
                <CardHeader title="Calendrier" />
                <div className="p-5">
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Gauche 7/12 : calendrier */}
                    <div className="sm:w-7/12">
                      <SimpleCalendar />
                    </div>
                    {/* Droite 5/12 : liste rendez-vous */}
                    <div className="sm:w-5/12 space-y-3">
                      {doctorAppointments.length === 0 ? (
                        <p className="text-sm text-gray-400">
                          Aucun rendez-vous
                        </p>
                      ) : (
                        doctorAppointments.map(
                          (appt: AppointmentItem) => (
                            <div
                              key={appt.id}
                              className="border border-gray-100 rounded p-3 space-y-1"
                            >
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <CalendarIcon className="h-3.5 w-3.5" />
                                <span>
                                  {new Date(appt.date).toLocaleDateString(
                                    "fr-FR"
                                  )}
                                </span>
                              </div>
                              <p className="text-xs text-gray-700">
                                Patient : {appt.patientName}
                              </p>
                              <div className="flex items-center gap-1 text-xs">
                                <span className="text-gray-600">
                                  Priorité:{" "}
                                </span>
                                <span
                                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
                                    appt.priority === "Normal"
                                      ? "bg-gray-100 text-gray-600"
                                      : appt.priority === "Urgent"
                                        ? "bg-orange-100 text-orange-700"
                                        : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {appt.priority}
                                </span>
                              </div>
                            </div>
                          )
                        )
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
