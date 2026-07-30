import { NextRequest, NextResponse } from "next/server";

/**
 * Point de collecte des violations CSP.
 *
 * Cible de `report-uri` et de `report-to` (cf. src/lib/security/csp.ts). Sert la
 * phase d'observation : tant que `CSP_ENFORCE` n'est pas à `true`, la politique
 * est posée en `Report-Only` et rien n'est bloqué — seules les violations
 * remontent ici. Chaque violation doit être corrigée dans le code plutôt que
 * traitée en élargissant la politique.
 *
 * La route est volontairement exclue de la garde d'authentification (cf.
 * src/proxy.ts) : le navigateur poste ces rapports hors de toute session.
 */

/** Les navigateurs postent en `application/csp-report` (report-uri)… */
type CspReportUriBody = {
  "csp-report"?: Record<string, unknown>;
};

/** …ou en `application/reports+json`, par lots (report-to). */
type ReportToBody = Array<{
  type?: string;
  url?: string;
  body?: Record<string, unknown>;
}>;

/** Champs retenus d'une violation, quel que soit le format d'origine. */
type Violation = {
  directive: unknown;
  blockedURL: unknown;
  documentURL: unknown;
  sourceFile: unknown;
  lineNumber: unknown;
  disposition: unknown;
};

/**
 * Ramène les deux formats à une forme commune. Les deux vocabulaires coexistent :
 * `report-uri` utilise le kebab-case historique (`violated-directive`),
 * `report-to` le camelCase du standard Reporting API (`effectiveDirective`).
 */
function normalize(raw: Record<string, unknown>): Violation {
  return {
    directive:
      raw["effectiveDirective"] ??
      raw["effective-directive"] ??
      raw["violated-directive"],
    blockedURL: raw["blockedURL"] ?? raw["blocked-uri"],
    documentURL: raw["documentURL"] ?? raw["document-uri"],
    sourceFile: raw["sourceFile"] ?? raw["source-file"],
    lineNumber: raw["lineNumber"] ?? raw["line-number"],
    disposition: raw["disposition"],
  };
}

/** Garde-fou : la route est publique, on ne lit pas un corps arbitrairement gros. */
const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: NextRequest) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  let payload: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return new NextResponse(null, { status: 413 });
    }
    payload = JSON.parse(text);
  } catch {
    // Corps illisible : on ne renvoie pas d'erreur exploitable, le navigateur
    // n'en ferait rien de toute façon.
    return new NextResponse(null, { status: 204 });
  }

  const violations: Violation[] = Array.isArray(payload)
    ? (payload as ReportToBody)
        .filter((report) => report?.type === "csp-violation" || report?.body)
        .map((report) => normalize(report.body ?? {}))
    : [normalize((payload as CspReportUriBody)["csp-report"] ?? {})];

  for (const violation of violations) {
    // Un log par violation : suffisant pour la phase d'observation, et
    // directement exploitable par l'agrégateur de logs du serveur.
    console.warn("[csp-violation]", JSON.stringify(violation));
  }

  // 204 : le navigateur n'attend aucun contenu en retour.
  return new NextResponse(null, { status: 204 });
}
