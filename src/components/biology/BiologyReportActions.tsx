"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import { FileCheck2, Printer, RotateCcw, Save } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";
import { formatDateTime } from "@/lib/utils";
import { reportsApi, type ReportDetail, type ReportStatus } from "@/lib/api/reports";
import { biologyReportsApi, openBiologyReportPdf } from "@/lib/api/biologyReports";
import { biologyResultsKeys } from "@/lib/api/biologyResults";
import { getApiErrorMessage } from "@/lib/api/errorMessages";
import type { ApiError } from "@/types/api";

/**
 * Actions du compte rendu de biologie, dans la carte d'état de la saisie des
 * résultats : conclusion, validation biologique, réouverture, impression.
 *
 * La feuille de saisie ne porte que l'identifiant et le statut du compte
 * rendu ; la conclusion (`comment`), la remise et la signature se lisent sur
 * `GET /reports/{id}` (commun aux disciplines, `view-reports`).
 *
 * Pas d'actions de remise ici : l'écran de compte rendu d'anatomie
 * pathologique n'en porte pas non plus — elles vivent sur la liste des
 * demandes (« Marquer comme retiré »), commune aux deux disciplines.
 */
export interface BiologyReportActionsProps {
  reportId: string | null;
  status: ReportStatus | null;
  testOrderId: string;
  /** Une analyse a des saisies non enregistrées : la validation attend. */
  hasUnsavedChanges?: boolean;
}

export function BiologyReportActions({
  reportId,
  status,
  testOrderId,
  hasUnsavedChanges = false,
}: BiologyReportActionsProps) {
  const { can } = usePermissions();
  const canValidate = can(PERMISSIONS.VALIDATE_BIOLOGY_REPORTS);
  const canView = can(PERMISSIONS.VIEW_REPORTS);

  const { data: report } = useQuery<ReportDetail>({
    queryKey: ["report", reportId],
    queryFn: () => reportsApi.findById(reportId!).then((r) => r.data),
    enabled: !!reportId && canView,
  });

  if (!reportId || !status) return null;

  // Remonte le bloc quand le compte rendu change sur le serveur : le brouillon
  // de conclusion repart alors de la valeur enregistrée, sans effet.
  const key = `${status}:${report?.updatedAt ?? ""}:${report?.comment ?? ""}`;
  return (
    <ActionsBody
      key={key}
      reportId={reportId}
      status={status}
      testOrderId={testOrderId}
      report={report}
      canValidate={canValidate}
      canView={canView}
      hasUnsavedChanges={hasUnsavedChanges}
    />
  );
}

function ActionsBody({
  reportId,
  status,
  testOrderId,
  report,
  canValidate,
  canView,
  hasUnsavedChanges,
}: {
  reportId: string;
  status: ReportStatus;
  testOrderId: string;
  report: ReportDetail | undefined;
  canValidate: boolean;
  canView: boolean;
  hasUnsavedChanges: boolean;
}) {
  const queryClient = useQueryClient();
  const saved = report?.comment ?? "";
  const [conclusion, setConclusion] = useState(saved);
  const [confirm, setConfirm] = useState<"validate" | "reopen" | null>(null);

  const locked = status === "VALIDATED" || status === "DELIVERED";
  const delivered = status === "DELIVERED" || !!report?.isDelivered;
  const conclusionDirty = conclusion.trim() !== saved.trim();
  // La conclusion ne s'édite qu'une fois le compte rendu lu : sans lui, un
  // enregistrement effacerait une conclusion existante qu'on n'a pas vue.
  const canEditConclusion = canValidate && !locked && !!report;

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: biologyResultsKeys.order(testOrderId) }),
      queryClient.invalidateQueries({ queryKey: biologyResultsKeys.worklistRoot }),
      queryClient.invalidateQueries({ queryKey: ["report", reportId] }),
      // Liste et détails des demandes de biologie (statut du compte rendu).
      queryClient.invalidateQueries({ queryKey: ["test-orders"] }),
      queryClient.invalidateQueries({ queryKey: ["test-order"] }),
    ]);

  const run = async (call: () => Promise<unknown>, success: string, fallback: string) => {
    try {
      await call();
    } catch (err) {
      toast.error(getApiErrorMessage(err as AxiosError<ApiError>, fallback));
      return false;
    }
    toast.success(success);
    await refresh();
    return true;
  };

  const saveConclusion = () =>
    run(
      () => biologyReportsApi.saveConclusion(reportId, conclusion.trim() || null),
      conclusion.trim() ? "Conclusion enregistrée" : "Conclusion effacée",
      "Erreur lors de l'enregistrement de la conclusion",
    );

  const confirmThen = (call: () => Promise<unknown>, success: string, fallback: string) => async () => {
    if (await run(call, success, fallback)) setConfirm(null);
  };

  const validateBlocker = hasUnsavedChanges
    ? "Enregistrez d'abord les résultats modifiés"
    : conclusionDirty
      ? "Enregistrez d'abord la conclusion"
      : undefined;

  return (
    <div className="space-y-3 border-t border-gray-100 pt-3" data-testid="biology-report-actions">
      {/* Conclusion générale, imprimée en fin de compte rendu */}
      {canEditConclusion ? (
        <div className="space-y-2">
          <label htmlFor="bio-conclusion" className="text-[.8125rem] font-semibold text-gray-700">
            Conclusion
          </label>
          <textarea
            id="bio-conclusion"
            rows={3}
            value={conclusion}
            onChange={(e) => setConclusion(e.target.value)}
            placeholder="Conclusion générale du compte rendu (facultative)"
            className={`${inputClass} resize-y`}
          />
          <Button
            size="sm"
            variant="secondary"
            icon={<Save className="h-3.5 w-3.5" />}
            disabled={!conclusionDirty}
            onClick={saveConclusion}
            className="w-full"
          >
            Enregistrer la conclusion
          </Button>
        </div>
      ) : saved ? (
        <div className="space-y-1">
          <div className="text-[.8125rem] font-semibold text-gray-700">Conclusion</div>
          <p className="whitespace-pre-line text-[.8125rem] text-gray-600" data-testid="bio-conclusion-text">
            {saved}
          </p>
        </div>
      ) : null}

      {locked && report?.signatory1Name && (
        <p className="text-xs text-gray-500">
          Validé par {report.signatory1Name}
          {report.signatureDate ? ` le ${formatDateTime(report.signatureDate)}` : ""}.
        </p>
      )}

      {canValidate && status === "DRAFT" && (
        <p className="text-xs text-gray-500">
          La validation biologique sera possible quand toutes les analyses seront prêtes.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {canValidate && status === "PENDING_REVIEW" && (
          <Button
            icon={<FileCheck2 className="h-4 w-4" />}
            disabled={!!validateBlocker}
            title={validateBlocker}
            onClick={() => setConfirm("validate")}
            className="w-full"
          >
            Valider les résultats
          </Button>
        )}
        {canValidate && status === "VALIDATED" && !delivered && (
          <Button
            variant="secondary"
            icon={<RotateCcw className="h-4 w-4" />}
            onClick={() => setConfirm("reopen")}
            className="w-full"
          >
            Rouvrir
          </Button>
        )}
        {canView && (
          <Button
            variant="secondary"
            icon={<Printer className="h-4 w-4" />}
            onClick={() => openBiologyReportPdf(reportId)}
            className="w-full"
          >
            {locked ? "Imprimer" : "Imprimer (provisoire)"}
          </Button>
        )}
      </div>

      <ConfirmModal
        isOpen={confirm === "validate"}
        onClose={() => setConfirm(null)}
        onConfirm={confirmThen(
          () => biologyReportsApi.validate(reportId),
          "Compte rendu validé",
          "Erreur lors de la validation biologique",
        )}
        title="Valider les résultats"
        message="Le compte rendu sera signé à votre nom et ne se modifiera plus sans être rouvert. Le patient sera prévenu par SMS que ses résultats sont disponibles."
        confirmLabel="Valider"
        confirmVariant="primary"
      />
      <ConfirmModal
        isOpen={confirm === "reopen"}
        onClose={() => setConfirm(null)}
        onConfirm={confirmThen(
          () => biologyReportsApi.reopen(reportId),
          "Compte rendu rouvert",
          "Erreur lors de la réouverture du compte rendu",
        )}
        title="Rouvrir le compte rendu"
        message="La validation et la signature seront annulées, et le compte rendu redeviendra modifiable. Attention : la prochaine validation enverra un nouveau SMS au patient."
        confirmLabel="Rouvrir"
        confirmVariant="danger"
      />
    </div>
  );
}
