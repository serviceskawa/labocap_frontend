"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { AlertBox } from "@/components/ui/AlertBox";
import { EmptyState } from "@/components/ui/EmptyState";
import { BiologyKindBadge } from "@/components/biology/BiologyKindBadge";
import { ResultGrid } from "@/components/biology/ResultGrid";
import { CultureEditor } from "@/components/biology/CultureEditor";
import { BiologyReportActions } from "@/components/biology/BiologyReportActions";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api/errorMessages";
import {
  biologyResultsApi,
  biologyResultsKeys,
  type BiologyAnalysis,
  type BiologyAnalysisStatus,
  type BiologyWorksheet,
} from "@/lib/api/biologyResults";
import type { ApiError } from "@/types/api";

interface Props {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ analyse?: string | string[] }>;
}

const STATUS_DOT: Record<BiologyAnalysisStatus, string> = {
  PENDING: "bg-gray-300",
  ENTERED: "bg-amber-500",
  TECH_VALIDATED: "bg-green-600",
};

const STATUS_TEXT: Record<BiologyAnalysisStatus, string> = {
  PENDING: "À saisir",
  ENTERED: "Saisie",
  TECH_VALIDATED: "Validée techniquement",
};

function sexLabel(sex: "M" | "F" | null | undefined, genre: string | null | undefined) {
  if (sex === "M") return "Masculin";
  if (sex === "F") return "Féminin";
  return genre || "Sexe non renseigné";
}

function ageLabel(ws: BiologyWorksheet) {
  const p = ws.patient;
  if (!p || p.age == null) return "Âge non renseigné";
  return p.ageUnit === "MONTHS" ? `${p.age} mois` : `${p.age} an${p.age > 1 ? "s" : ""}`;
}

/**
 * Clé de remontage d'un éditeur : il repart de la feuille du serveur chaque
 * fois que SON analyse change (après un enregistrement, une validation), sans
 * toucher aux saisies en cours des autres analyses.
 */
const analysisKey = (a: BiologyAnalysis) => `${a.id}:${JSON.stringify(a)}`;

/**
 * Feuille de saisie des résultats d'un bon de biologie.
 *
 * Toutes les analyses restent montées (seule l'active est visible) : passer
 * d'un onglet à l'autre ne perd pas une saisie non enregistrée. Chaque
 * écriture renvoie la feuille complète, posée telle quelle dans le cache.
 */
export default function BiologieResultatsFeuillePage({ params, searchParams }: Props) {
  const { orderId } = use(params);
  const { analyse } = use(searchParams);
  const requested = Array.isArray(analyse) ? analyse[0] : analyse;

  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.EDIT_BIOLOGY_RESULTS);
  const canValidate = can(PERMISSIONS.VALIDATE_BIOLOGY_RESULTS);

  const { data: ws, isLoading, error } = useQuery<BiologyWorksheet>({
    queryKey: biologyResultsKeys.order(orderId),
    queryFn: () => biologyResultsApi.worksheet(orderId).then((r) => r.data),
  });

  const [selected, setSelected] = useState<string | null>(requested ?? null);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const activeId =
    ws?.analyses.find((a) => a.labTestId === selected)?.labTestId ?? ws?.analyses[0]?.labTestId ?? null;

  const anyDirty = Object.values(dirty).some(Boolean);
  useEffect(() => {
    if (!anyDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyDirty]);

  const dirtyHandlers = useCallback(
    (labTestId: string) => (d: boolean) =>
      setDirty((prev) => (prev[labTestId] === d ? prev : { ...prev, [labTestId]: d })),
    [],
  );

  /** Pose la feuille renvoyée par une écriture, ou affiche le refus du serveur (422…). */
  const write = async (call: () => Promise<{ data: BiologyWorksheet }>, success: string, fallback: string) => {
    try {
      const res = await call();
      queryClient.setQueryData(biologyResultsKeys.order(orderId), res.data);
      queryClient.invalidateQueries({ queryKey: biologyResultsKeys.worklistRoot });
      toast.success(success);
    } catch (err) {
      toast.error(getApiErrorMessage(err as AxiosError<ApiError>, fallback));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Saisie des résultats" breadcrumbs={crumbs(null)} />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !ws) {
    return (
      <div className="space-y-6">
        <PageHeader title="Saisie des résultats" breadcrumbs={crumbs(null)} />
        <AlertBox
          type="error"
          title="Feuille de saisie indisponible"
          message={getApiErrorMessage(error as AxiosError<ApiError>, "Impossible de charger les résultats de cette demande.")}
        />
      </div>
    );
  }

  const reportLocked = ws.report?.status === "VALIDATED" || ws.report?.status === "DELIVERED";
  const twoStep = ws.settings.validationMode === "TWO_STEP";
  const counts = ws.analyses.reduce(
    (acc, a) => ({ ...acc, [a.status]: acc[a.status] + 1 }),
    { PENDING: 0, ENTERED: 0, TECH_VALIDATED: 0 } as Record<BiologyAnalysisStatus, number>,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saisie des résultats"
        breadcrumbs={crumbs(ws.orderCode)}
        action={
          <Link
            href={`/biologie/demandes/${ws.testOrderId}`}
            className="inline-flex items-center gap-1.5 text-[.875rem] font-medium text-blue-600 hover:text-blue-700"
          >
            Voir la demande <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        }
      />

      {/* ── En-tête patient + carte d'état ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="hyper-card">
          <div className="hyper-card-body">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[1.0625rem] font-semibold text-gray-900" data-testid="patient-name">
                  {ws.patient?.fullName ?? "Patient inconnu"}
                </div>
                <div className="mt-1 text-[.875rem] text-gray-600">
                  {[ws.patient?.code, sexLabel(ws.patient?.sex, ws.patient?.genre), ageLabel(ws)]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {ws.urgent && <Badge variant="danger">Urgent</Badge>}
                <StatusBadge status={ws.report?.status} domain="biologyReport" />
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[.875rem] sm:grid-cols-4">
              <div>
                <dt className="text-xs text-gray-500">Demande</dt>
                <dd className="font-medium text-gray-800">{ws.orderCode ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Prélèvement</dt>
                <dd className="font-medium text-gray-800">
                  {ws.prelevementDate ? formatDate(ws.prelevementDate) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Compte rendu</dt>
                <dd className="font-medium text-gray-800">{ws.report?.code ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Analyses</dt>
                <dd className="font-medium text-gray-800">{ws.analyses.length}</dd>
              </div>
            </dl>
          </div>
        </div>

        <aside className="hyper-card" aria-label="État du compte rendu">
          <div className="hyper-card-body space-y-3">
            <div className="hyper-card-heading">État du compte rendu</div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[.875rem] text-gray-600">{ws.report?.code ?? "Compte rendu"}</span>
              <StatusBadge status={ws.report?.status} domain="biologyReport" />
            </div>
            <ul className="space-y-1.5 text-[.8125rem] text-gray-600">
              {(["PENDING", "ENTERED", "TECH_VALIDATED"] as BiologyAnalysisStatus[])
                .filter((s) => twoStep || s !== "TECH_VALIDATED" || counts[s] > 0)
                .map((s) => (
                  <li key={s} className="flex items-center gap-2">
                    <span aria-hidden className={cn("h-2 w-2 rounded-full", STATUS_DOT[s])} />
                    <span className="flex-1">{STATUS_TEXT[s]}</span>
                    <span className="font-semibold tabular-nums text-gray-800">{counts[s]}</span>
                  </li>
                ))}
            </ul>
            <p className="text-xs text-gray-500">
              {twoStep
                ? "Validation en deux temps : technique par analyse, puis biologique du compte rendu."
                : "Validation par le biologiste seul : une analyse saisie est prête à valider."}
            </p>
            {reportLocked && (
              <p className="text-xs font-medium text-gray-600">
                Compte rendu validé : les résultats ne se modifient plus.
              </p>
            )}
            <BiologyReportActions
              reportId={ws.report?.id ?? null}
              status={ws.report?.status ?? null}
              testOrderId={ws.testOrderId}
              hasUnsavedChanges={anyDirty}
            />
          </div>
        </aside>
      </div>

      {/* ── Onglets d'analyses + éditeur ───────────────────────────── */}
      {ws.analyses.length === 0 ? (
        <div className="hyper-card">
          <EmptyState title="Aucune analyse" description="Cette demande ne porte aucune analyse à saisir." />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <nav aria-label="Analyses de la demande" className="hyper-card self-start">
            <div role="tablist" aria-orientation="vertical" className="flex flex-col p-2">
              {ws.analyses.map((a) => {
                const active = a.labTestId === activeId;
                return (
                  <button
                    key={a.labTestId}
                    type="button"
                    role="tab"
                    id={`tab-${a.labTestId}`}
                    aria-selected={active}
                    aria-controls={`panel-${a.labTestId}`}
                    onClick={() => setSelected(a.labTestId)}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-[var(--radius-control)] px-3 py-2.5 text-left transition-colors",
                      "hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                      "aria-selected:bg-blue-50 aria-selected:text-blue-700",
                    )}
                  >
                    <span
                      aria-hidden
                      title={STATUS_TEXT[a.status]}
                      className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", STATUS_DOT[a.status])}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-[.875rem]", active ? "font-semibold" : "font-medium text-gray-800")}>
                        {a.labTestName}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {STATUS_TEXT[a.status]}
                        {a.expectedValues > 0 ? ` · ${a.enteredValues}/${a.expectedValues}` : ""}
                        {dirty[a.labTestId] ? " · modifiée" : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div>
            {ws.analyses.map((a) => {
              const readOnly = !a.editable || !canEdit;
              const showValidate = twoStep && canValidate && a.status === "ENTERED" && !reportLocked;
              // L'annulation reste offerte dans les deux modes, comme côté API :
              // une analyse validée avant un passage en ONE_STEP doit pouvoir
              // être déverrouillée.
              const showCancel = canValidate && a.status === "TECH_VALIDATED" && !reportLocked;
              return (
                <section
                  key={a.labTestId}
                  role="tabpanel"
                  id={`panel-${a.labTestId}`}
                  aria-labelledby={`tab-${a.labTestId}`}
                  hidden={a.labTestId !== activeId}
                  className="hyper-card"
                >
                  <div className="hyper-card-body space-y-5">
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-[1rem] font-semibold text-gray-900">{a.labTestName}</h2>
                          <BiologyKindBadge kind={a.kind} />
                          <StatusBadge status={a.status} domain="biologyAnalysis" />
                        </div>
                        <div className="text-xs text-gray-500">
                          {[
                            a.labTestCode,
                            a.specimenType,
                            a.enteredAt
                              ? `Saisie ${a.enteredByName ? `par ${a.enteredByName} ` : ""}le ${formatDateTime(a.enteredAt)}`
                              : null,
                            a.techValidatedAt
                              ? `Validée ${a.techValidatedByName ? `par ${a.techValidatedByName} ` : ""}le ${formatDateTime(a.techValidatedAt)}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {showValidate && (
                          <Button
                            icon={<CheckCircle2 className="h-4 w-4" />}
                            disabled={!!dirty[a.labTestId]}
                            title={dirty[a.labTestId] ? "Enregistrez d'abord les modifications" : undefined}
                            onClick={() =>
                              write(
                                () => biologyResultsApi.validateTechnically(ws.testOrderId, a.labTestId),
                                "Analyse validée techniquement",
                                "Erreur lors de la validation technique",
                              )
                            }
                          >
                            Valider techniquement
                          </Button>
                        )}
                        {showCancel && (
                          <Button
                            variant="secondary"
                            icon={<Undo2 className="h-4 w-4" />}
                            onClick={() =>
                              write(
                                () => biologyResultsApi.cancelTechnicalValidation(ws.testOrderId, a.labTestId),
                                "Validation technique annulée",
                                "Erreur lors de l'annulation de la validation technique",
                              )
                            }
                          >
                            Annuler la validation technique
                          </Button>
                        )}
                      </div>
                    </div>

                    {readOnly && (
                      <p className="text-[.8125rem] text-gray-500" data-testid="read-only-note">
                        {!a.editable
                          ? a.status === "TECH_VALIDATED"
                            ? "Analyse validée techniquement : annulez la validation technique pour la modifier."
                            : reportLocked
                              ? "Compte rendu validé : les résultats ne se modifient plus."
                              : "Analyse retirée du catalogue : ses résultats ne se modifient plus."
                          : "Consultation seule : vous n'avez pas le droit de saisir des résultats."}
                      </p>
                    )}

                    {a.kind === "CULTURE" ? (
                      <CultureEditor
                        key={analysisKey(a)}
                        analysis={a}
                        settings={ws.settings}
                        antibiotics={ws.antibiotics}
                        readOnly={readOnly}
                        onDirtyChange={dirtyHandlers(a.labTestId)}
                        onSave={(body) =>
                          write(
                            () => biologyResultsApi.saveCulture(ws.testOrderId, a.labTestId, body),
                            "Culture enregistrée",
                            "Erreur lors de l'enregistrement de la culture",
                          )
                        }
                      />
                    ) : (
                      <ResultGrid
                        key={analysisKey(a)}
                        analysis={a}
                        settings={ws.settings}
                        readOnly={readOnly || a.kind == null}
                        onDirtyChange={dirtyHandlers(a.labTestId)}
                        onSave={(body) =>
                          write(
                            () => biologyResultsApi.savePanel(ws.testOrderId, a.labTestId, body),
                            "Résultats enregistrés",
                            "Erreur lors de l'enregistrement des résultats",
                          )
                        }
                      />
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function crumbs(orderCode: string | null) {
  return [
    { label: "Accueil", href: "/home" },
    { label: "Biologie" },
    { label: "Résultats", href: "/biologie/resultats" },
    ...(orderCode ? [{ label: orderCode }] : []),
  ];
}
