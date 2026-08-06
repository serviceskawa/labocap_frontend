/**
 * Content Security Policy — source unique de vérité de la politique.
 *
 * Construite directive par directive à partir d'un inventaire réel des
 * ressources chargées par l'application (aucun `default-src` permissif, aucun
 * wildcard) :
 *
 * | Origine        | Usage                                   | Directive        |
 * |----------------|-----------------------------------------|------------------|
 * | 'self'         | bundles Next.js, CSS Tailwind compilé,  | script/style/... |
 * |                | polices auto-hébergées par next/font    |                  |
 * | API backend    | appels axios, logo/pièces jointes       | connect-src,     |
 * | (NEXT_PUBLIC_  |                                         | img-src          |
 * |  API_URL)      |                                         |                  |
 * | data:          | QR code base64, signature PNG (canvas)  | img-src, font-src|
 * | blob:          | aperçus PDF/pièces jointes, miniatures  | img-src, media   |
 *
 * Aucun script externe (pas d'analytics, pas de SDK de paiement), aucune police
 * distante : `next/font/google` télécharge Source Serif 4 et IBM Plex Sans AU BUILD et la sert depuis
 * `self` (cf. src/app/layout.tsx). Il n'existe aucun `<script>` inline dans le
 * code applicatif — les seuls scripts inline sont ceux injectés par Next.js
 * lui-même, qui reçoivent automatiquement le nonce de la requête.
 *
 * ── Scripts ────────────────────────────────────────────────────────────────
 * `'nonce-<random>' 'strict-dynamic'` : Next.js relit le nonce depuis l'en-tête
 * CSP de la requête et l'appose sur ses propres balises (runtime React, chunks
 * de page, flight data). `'strict-dynamic'` permet aux scripts ainsi autorisés
 * de charger leurs propres chunks — indispensable au code-splitting Next.
 *
 * ── Styles : pourquoi trois directives ─────────────────────────────────────
 * Le code injecte des styles de trois façons distinctes, qui ne se contrôlent
 * pas avec la même directive :
 *
 *  1. `<style>` créés à l'exécution — Emotion (react-select, 23 écrans) et
 *     sonner. Couverts par `style-src-elem`. Emotion reçoit le nonce via le
 *     `NonceProvider` de react-select (cf. src/components/providers.tsx) ;
 *     sonner injecte un bloc CSS constant, autorisé par son hash SHA-256
 *     ({@link SONNER_STYLE_HASH}) puisque la lib n'expose aucun nonce.
 *  2. Attributs `style="..."` — Radix UI (positionnement des popovers, menus,
 *     tooltips) et recharts en produisent en continu. Un nonce ou un hash ne
 *     peut PAS autoriser un attribut de style : seul `'unsafe-inline'` le peut.
 *     D'où `style-src-attr 'unsafe-inline'`, restreint aux seuls attributs et
 *     donc sans effet sur les balises `<style>`.
 *  3. `style-src` ne sert plus que de repli pour les navigateurs antérieurs à
 *     `style-src-elem`/`-attr` (Safari < 15.4). Les navigateurs modernes
 *     l'ignorent au profit des deux directives ci-dessus.
 *
 * ── En développement ───────────────────────────────────────────────────────
 * `'unsafe-eval'` (React reconstruit les stacks serveur par `eval`) et
 * `'unsafe-inline'` sur les styles (le HMR réinjecte le CSS sans nonce) sont
 * requis. La politique stricte ne vaut donc qu'en production : toute
 * vérification doit se faire sur un build de production (`npm run build && npm
 * run start`), jamais sur `npm run dev`.
 *
 * @see https://csp-evaluator.withgoogle.com pour valider la politique produite.
 */

/**
 * Hash SHA-256 du bloc CSS constant que sonner injecte dans `<head>` au premier
 * import (`__insertCSS` dans sonner/dist/index.mjs). Bloc statique → hash, la
 * librairie n'acceptant pas de nonce.
 *
 * ⚠ Ce hash change à chaque mise à jour de sonner. `npm run csp:hashes` le
 * recalcule depuis node_modules et échoue s'il a dérivé — à lancer après tout
 * `npm update` (cf. scripts/check-csp-hashes.mjs).
 */
export const SONNER_STYLE_HASH =
  "'sha256-CIxDM5jnsGiKqXs2v7NKCY5MzdR9gu6TtiMJrDw29AY='";

/** Chemin du collecteur de violations (route publique, cf. src/proxy.ts). */
export const CSP_REPORT_PATH = "/api/csp-report";

/** Nom du groupe de reporting déclaré dans l'en-tête `Reporting-Endpoints`. */
const REPORT_GROUP = "csp-endpoint";

/**
 * Origine de l'API backend, déduite de `NEXT_PUBLIC_API_URL`.
 *
 * La variable est figée AU BUILD par Next.js (préfixe `NEXT_PUBLIC_`, cf.
 * l'ARG du Dockerfile) : elle doit donc être référencée littéralement pour être
 * remplacée à la compilation. On n'en garde que l'origine — le chemin
 * (`/api/v1`) n'a pas de sens dans une directive CSP, qui raisonne par origine.
 *
 * Renvoie `null` si l'URL est invalide ou déjà de même origine que le front
 * (auquel cas `'self'` suffit).
 */
function apiOrigin(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/**
 * Génère un nonce cryptographiquement aléatoire (128 bits) pour la requête.
 *
 * `crypto.getRandomValues` est disponible dans le runtime Edge du proxy. Le
 * format base64 produit correspond à celui qu'attend Next.js pour extraire le
 * nonce de l'en-tête (`/^'nonce-([A-Za-z0-9+/_-]+={0,2})'$/`).
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Assemble la politique pour une requête donnée.
 *
 * @param nonce nonce unique de la requête, déjà généré par le proxy.
 * @param isDev relâche les contraintes incompatibles avec le serveur de dev.
 */
export function buildCspPolicy(
  nonce: string,
  isDev: boolean = process.env.NODE_ENV === "development",
): string {
  const api = apiOrigin();

  // Scripts : nonce + strict-dynamic. `'self'` ne sert que de repli pour les
  // navigateurs CSP2 qui ignorent `'strict-dynamic'`.
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (isDev) scriptSrc.push("'unsafe-eval'");

  // Balises <style> : nonce (Emotion) + hash (sonner). En dev, le HMR réinjecte
  // le CSS sans nonce — on relâche, la politique stricte se valide sur un build.
  const styleSrcElem = isDev
    ? ["'self'", "'unsafe-inline'"]
    : ["'self'", `'nonce-${nonce}'`, SONNER_STYLE_HASH];

  // Connexions XHR/fetch vers l'API. En dev, le websocket du HMR tourne sur un
  // autre schéma que `'self'` (ws://) et doit être autorisé explicitement.
  const connectSrc = ["'self'"];
  if (api) connectSrc.push(api);
  if (isDev) connectSrc.push("ws:", "wss:");

  // Images : logo et pièces jointes servis par l'API, QR codes en base64
  // (`data:`), miniatures et aperçus récupérés via axios puis exposés en `blob:`.
  const imgSrc = ["'self'", "data:", "blob:"];
  if (api) imgSrc.push(api);

  const directives: Array<[string, string[] | null]> = [
    // Repli explicite : tout ce qui n'est pas couvert ci-dessous est restreint
    // à l'origine du front.
    ["default-src", ["'self'"]],
    ["script-src", scriptSrc],
    ["style-src-elem", styleSrcElem],
    // Attributs style="..." : seul `'unsafe-inline'` peut les autoriser, et
    // Radix UI/recharts en dépendent pour tout positionnement dynamique.
    ["style-src-attr", ["'unsafe-inline'"]],
    // Repli pour navigateurs sans style-src-elem/-attr (Safari < 15.4).
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", imgSrc],
    // next/font auto-héberge les deux fontes ; `data:` couvre les inlinées.
    ["font-src", ["'self'", "data:"]],
    ["connect-src", connectSrc],
    // Aperçus de documents ouverts depuis un blob: (factures, rapports, paie).
    ["media-src", ["'self'", "blob:"]],
    // Aucun <object>/<embed> dans l'application.
    ["object-src", ["'none'"]],
    // Aucune iframe : l'application n'en embarque aucune.
    ["frame-src", ["'none'"]],
    // Anti-clickjacking : l'application ne doit jamais être encadrée.
    ["frame-ancestors", ["'none'"]],
    // Aucun web worker n'est utilisé côté applicatif.
    ["worker-src", ["'self'"]],
    ["manifest-src", ["'self'"]],
    // Empêche la réécriture des URL relatives par un <base> injecté.
    ["base-uri", ["'self'"]],
    // Les formulaires ne postent que vers le front (l'API est appelée en XHR).
    ["form-action", ["'self'"]],
  ];

  const parts = directives.map(([name, values]) =>
    values ? `${name} ${values.join(" ")}` : name,
  );

  // `upgrade-insecure-requests` réécrit tout sous-chargement http:// en https://.
  // À n'activer que si l'API est elle-même en https : sur un déploiement où
  // NEXT_PUBLIC_API_URL reste en http (cf. le défaut du docker-compose), la
  // directive casserait tous les appels API.
  if (!isDev && (!api || api.startsWith("https:"))) {
    parts.push("upgrade-insecure-requests");
  }

  // Collecte des violations : `report-to` (standard actuel, appuyé sur
  // l'en-tête Reporting-Endpoints) et `report-uri` (déprécié mais seul format
  // compris par Safari et les Firefox anciens).
  parts.push(`report-to ${REPORT_GROUP}`);
  parts.push(`report-uri ${CSP_REPORT_PATH}`);

  return parts.join("; ");
}

/**
 * Politique appliquée en mode bloquant ou en simple observation ?
 *
 * Par défaut la politique est posée en `Content-Security-Policy-Report-Only` :
 * les violations sont remontées sans rien casser, le temps d'observer tous les
 * parcours utilisateurs. Basculer en mode bloquant via `CSP_ENFORCE=true`
 * une fois les violations résiduelles nulles ou explicitement acceptées.
 */
export function isEnforced(): boolean {
  return process.env.CSP_ENFORCE === "true";
}

/**
 * Pose la politique et l'en-tête de reporting sur une réponse.
 *
 * @param headers en-têtes de la réponse (ou de la requête, pour que Next.js y
 *   relise le nonce au moment du rendu).
 */
export function applyCspHeaders(headers: Headers, policy: string): void {
  headers.set(
    isEnforced()
      ? "Content-Security-Policy"
      : "Content-Security-Policy-Report-Only",
    policy,
  );
  headers.set(
    "Reporting-Endpoints",
    `${REPORT_GROUP}="${CSP_REPORT_PATH}"`,
  );
}
