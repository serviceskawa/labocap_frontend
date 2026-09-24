import { toast } from "sonner";
import apiClient from "./client";
import type { Report } from "./reports";
import { getApiErrorMessageFromBlob } from "./errorMessages";

/**
 * Compte rendu de biologie : validation biologique, réouverture, conclusion et
 * PDF (module « biology »).
 *
 * Contrat : backend `feat/biologie-discipline` (B6/B7, `BiologyReportController`).
 * Validation, réouverture et conclusion sous `validate-biology-reports` ; PDF
 * sous `view-reports`. Remise, appel, SMS et signature du récupérateur restent
 * ceux de `/reports/{id}/…`, communs aux disciplines (`reportsApi`).
 *
 * - `validate` : seulement en `PENDING_REVIEW`. Le corps (preuve d'appareil,
 *   `ValidationSigneeDto`) est réservé à l'application mobile : le web n'envoie
 *   rien, exactement comme `POST /reports/{id}/validate` en anatomie
 *   pathologique.
 * - `reopen` : `VALIDATED` non remis → `DRAFT`, puis recalcul (un bon toujours
 *   prêt revient en `PENDING_REVIEW`). La signature est effacée ; une nouvelle
 *   validation renverra un SMS au patient.
 * - `conclusion` : refusée (422) une fois le compte rendu validé. Vide = effacée.
 * - `pdf` : un compte rendu non validé ne s'imprime que si `bio_print_provisional`
 *   le permet (bandeau « RÉSULTATS PROVISOIRES »), sinon 422.
 */

const base = "/biology-reports";

export const biologyReportsApi = {
  validate: (reportId: string) => apiClient.post<Report>(`${base}/${reportId}/validate`),
  reopen: (reportId: string) => apiClient.post<Report>(`${base}/${reportId}/reopen`),
  saveConclusion: (reportId: string, conclusion: string | null) =>
    apiClient.put<Report>(`${base}/${reportId}/conclusion`, { conclusion }),
  pdf: (reportId: string) =>
    apiClient.get<Blob>(`${base}/${reportId}/pdf`, { responseType: "blob" }),
};

/**
 * Ouvre le PDF du compte rendu de biologie dans un nouvel onglet.
 *
 * L'onglet est ouvert AVANT l'appel : après un `await`, le navigateur a perdu
 * l'activation née du clic et bloquerait `window.open`. Le PDF y est posé en
 * blob — jamais en iframe, la CSP (`frame-src 'none'`) l'interdit. En cas de
 * refus (422 : impression provisoire désactivée), l'onglet est refermé et le
 * message du serveur affiché — il arrive en Blob à cause du `responseType`.
 */
export async function openBiologyReportPdf(reportId: string): Promise<void> {
  const tab = window.open("about:blank", "_blank");
  try {
    const res = await biologyReportsApi.pdf(reportId);
    const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    tab?.close();
    toast.error(await getApiErrorMessageFromBlob(err, "Erreur lors de la génération du PDF"));
  }
}

// ---------------------------------------------------------------------------
// Réglages de biologie (`setting_apps`, par succursale — amorcés par V98)
// ---------------------------------------------------------------------------

/** Clés `setting_apps` de la biologie. */
export const BIOLOGY_SETTING_KEYS = {
  validationMode: "bio_validation_mode",
  dashboardMode: "bio_dashboard_mode",
  printProvisional: "bio_print_provisional",
  antibiogramLabels: "bio_antibiogram_labels",
  flagLabels: "bio_flag_labels",
  smsResult: "sms_resultat_biologie_body",
} as const;

/** Libellés par défaut, identiques au backend (`ReglagesDeBiologie`). */
export const DEFAULT_ANTIBIOGRAM_LABELS = { S: "Sensible", I: "Intermédiaire", R: "Résistant" };
export const DEFAULT_FLAG_LABELS = { L: "Bas", H: "Haut", LL: "Critique bas", HH: "Critique haut" };

/**
 * Lit un réglage de libellés (JSON `{"S":"…"}`). Valeur absente, illisible ou
 * libellé vide : défaut du backend, qui fait de même — l'écran montre donc ce
 * que la paillasse et le PDF affichent réellement.
 */
export function parseLabels<K extends string>(
  raw: string | null | undefined,
  defaults: Record<K, string>,
): Record<K, string> {
  const result = { ...defaults };
  if (!raw || !raw.trim()) return result;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        const key = k.trim().toUpperCase() as K;
        if (key in defaults && typeof v === "string" && v.trim()) result[key] = v.trim();
      }
    }
  } catch {
    // Illisible : défauts, comme le backend.
  }
  return result;
}

/**
 * Sérialise les libellés dans l'ordre des défauts. Un libellé laissé vide
 * reprend son défaut : le backend l'ignorerait de toute façon, autant que la
 * valeur enregistrée dise ce qui sera affiché.
 */
export function serializeLabels<K extends string>(
  labels: Record<K, string>,
  defaults: Record<K, string>,
): string {
  const out: Record<string, string> = {};
  for (const k of Object.keys(defaults) as K[]) out[k] = labels[k]?.trim() || defaults[k];
  return JSON.stringify(out);
}
