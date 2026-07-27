/**
 * État « challenge 2FA en cours » côté client — équivalent de la session Laravel
 * « authentifié mais `user_2fa` absent » (voir `RedirectIfAuthenticated` et le
 * middleware `tfauth` de l'app Laravel).
 *
 * Trois cookies coexistent pour un même challenge :
 *  - `pending_2fa` : posé par l'API, **HttpOnly**, porte le token temporaire ;
 *    c'est la source de vérité côté serveur (le code ne peut être validé qu'avec lui) ;
 *  - `pending_2fa_until` : posé ici, **lisible**, horodatage d'expiration en ms —
 *    lu par le proxy Next pour verrouiller /login et n'ouvrir /2fa/challenge que
 *    pendant un challenge, et par la page de saisie pour afficher le décompte ;
 *  - `pending_2fa_email` : posé ici, **lisible**, adresse saisie au login, pour
 *    l'afficher masquée sur l'écran de saisie du code.
 *
 * Le verrou se lève tout seul : les trois cookies ont la durée de vie du code.
 * Aucun n'est nécessaire pour valider le code (l'API lit son cookie HttpOnly),
 * ils ne servent qu'à l'orientation de la navigation et à l'affichage.
 */

export const PENDING_2FA_UNTIL_COOKIE = "pending_2fa_until";
export const PENDING_2FA_EMAIL_COOKIE = "pending_2fa_email";
/** Cookie HttpOnly posé par l'API — non lisible ici, lu par le proxy serveur. */
export const PENDING_2FA_COOKIE = "pending_2fa";

/** Durée de repli si l'API ne renvoie pas `expiresIn` (token temporaire = 5 min). */
const DEFAULT_TTL_SECONDS = 300;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(
    value,
  )}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

/**
 * Ouvre un challenge : identifiants validés, code envoyé par e-mail. Tant qu'il
 * court, l'écran de connexion est inaccessible et l'écran de saisie du code l'est.
 *
 * @param email     adresse saisie au login (affichée masquée sur l'écran de saisie)
 * @param expiresIn durée de validité du code en secondes, telle que renvoyée par l'API
 */
export function beginPending2fa(email: string, expiresIn?: number | null): void {
  const ttl = expiresIn && expiresIn > 0 ? Math.floor(expiresIn) : DEFAULT_TTL_SECONDS;
  writeCookie(PENDING_2FA_UNTIL_COOKIE, String(Date.now() + ttl * 1000), ttl);
  writeCookie(PENDING_2FA_EMAIL_COOKIE, email, ttl);
}

/** Ferme le challenge (code validé, ou expiré côté client). */
export function clearPending2fa(): void {
  deleteCookie(PENDING_2FA_UNTIL_COOKIE);
  deleteCookie(PENDING_2FA_EMAIL_COOKIE);
}

/** Horodatage (ms) d'expiration du challenge en cours, `null` s'il n'y en a pas. */
export function getPending2faExpiry(): number | null {
  const raw = readCookie(PENDING_2FA_UNTIL_COOKIE);
  if (!raw) return null;
  const until = Number(raw);
  return Number.isFinite(until) ? until : null;
}

/** `true` si un challenge est en cours et non expiré. */
export function hasPending2fa(): boolean {
  const until = getPending2faExpiry();
  return until !== null && until > Date.now();
}

/** Adresse e-mail du challenge en cours, `null` si aucun. */
export function getPending2faEmail(): string | null {
  return readCookie(PENDING_2FA_EMAIL_COOKIE);
}
