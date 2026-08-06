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
    // Une violation dont aucun champ n'est reconnu ressort en « {} » : le
    // rapport a bien été reçu, mais son format n'est ni `report-uri` ni
    // `report-to` tels qu'attendus. Les navigateurs et les intermédiaires
    // (Cloudflare, extensions) n'émettent pas tous la même forme, et une charge
    // vide ne dit rien de la violation — donc rien à corriger.
    //
    // Dans ce cas on journalise la charge brute : sans elle, la phase
    // d'observation ne peut pas aboutir.
    const recognised = Object.values(violation).some((v) => v !== undefined);
    if (recognised) {
      console.warn("[csp-violation]", JSON.stringify(violation));
    } else {
      console.warn(
        "[csp-violation] format non reconnu — charge brute :",
        // Tronqué : la route est publique, on ne déverse pas un corps
        // arbitrairement long dans les journaux.
        JSON.stringify(payload).slice(0, 2000),
      );
    }
  }

  // 204 : le navigateur n'attend aucun contenu en retour.
  return new NextResponse(null, { status: 204 });
}
