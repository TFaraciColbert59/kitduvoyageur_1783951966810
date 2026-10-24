import { z } from 'zod';

/**
 * Rapports de violation de la CSP (plan 2.11), module PUR : lit le corps envoyé par le
 * navigateur et en tire une ligne sans donnée personnelle. Deux formes existent :
 *  - `report-uri` : `{ "csp-report": { "violated-directive", "effective-directive",
 *    "blocked-uri", "document-uri", "disposition", ... } }` (`application/csp-report`) ;
 *  - Reporting API : `[{ "type": "csp-violation", "body": { "effectiveDirective",
 *    "blockedURL", "documentURL", "disposition", ... } }]` (`application/reports+json`).
 *
 * Gardé : la directive, qui est bloquée (le seul HÔTE, ou un mot : inline, eval, data, blob,
 * extension), la première partie du chemin de la page, et si la règle est appliquée ou
 * seulement observée. Jamais gardé : chemin complet, requête, fragment, extrait de code
 * (`script-sample`), agent utilisateur, adresse IP.
 */

/** Une ligne prête pour `app_errors` (scope `csp`, code = directive, message sans espace interne). */
export interface CspViolation {
  directive: string;
  disposition: 'report' | 'enforce';
  blocked: string;
  page: string;
}

export const CSP_SCOPE = 'csp';
/** Taille maximale d'un rapport lu (un rapport réel tient en quelques centaines d'octets). */
export const CSP_MAX_BODY_BYTES = 8_192;

/** Les directives de la CSP (niveaux 2 et 3) : tout autre mot est rangé sous `autre`. */
const DIRECTIVES = new Set([
  'default-src', 'script-src', 'script-src-elem', 'script-src-attr', 'style-src', 'style-src-elem', 'style-src-attr',
  'img-src', 'font-src', 'connect-src', 'media-src', 'object-src', 'frame-src', 'child-src', 'worker-src',
  'manifest-src', 'prefetch-src', 'base-uri', 'form-action', 'frame-ancestors', 'navigate-to', 'sandbox',
  'upgrade-insecure-requests', 'block-all-mixed-content', 'trusted-types', 'require-trusted-types-for',
]);
const EXTENSION_SCHEMES = new Set(['chrome-extension', 'moz-extension', 'safari-extension', 'safari-web-extension', 'ms-browser-extension', 'extension']);

const wide = z.object({
  'violated-directive': z.string().max(300).optional(),
  'effective-directive': z.string().max(300).optional(),
  'blocked-uri': z.string().max(2_048).optional(),
  'document-uri': z.string().max(2_048).optional(),
  disposition: z.string().max(20).optional(),
});
const reporting = z.object({
  effectiveDirective: z.string().max(300).optional(),
  blockedURL: z.string().max(2_048).optional(),
  documentURL: z.string().max(2_048).optional(),
  disposition: z.string().max(20).optional(),
});
const envelope = z.union([
  z.object({ 'csp-report': wide }),
  z.array(z.object({ type: z.string().max(40), body: reporting })).min(1).max(20),
]);

/** `script-src-elem 'self' ...` → `script-src-elem` ; tout ce qui n'est pas un nom de directive → `autre`. */
export function normalizeDirective(raw: string | undefined): string {
  const first = (raw ?? '').trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return DIRECTIVES.has(first) ? first : 'autre';
}

/** L'hôte d'une URL bloquée, ou un mot : jamais le chemin ni la requête. */
export function normalizeBlocked(raw: string | undefined): string {
  const value = (raw ?? '').trim();
  if (value === '' || value === 'inline' || value === 'eval' || value === 'wasm-eval') return value === '' ? 'inline' : value;
  if (value === 'self' || value === 'data' || value === 'blob' || value === 'about' || value === 'filesystem') return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'autre';
  }
  const scheme = url.protocol.replace(/:$/, '').toLowerCase();
  if (EXTENSION_SCHEMES.has(scheme)) return 'extension';
  if (scheme === 'http' || scheme === 'https' || scheme === 'ws' || scheme === 'wss') {
    const host = url.hostname.toLowerCase().replace(/[^a-z0-9.\-:[\]]/g, '');
    return host === '' ? 'autre' : host.slice(0, 120);
  }
  return /^[a-z][a-z0-9+.-]{0,20}$/.test(scheme) ? scheme : 'autre';
}

/** `/hub/mon-slug?x=1` → `/hub` : un identifiant ou un jeton du chemin ne sort jamais. */
export function normalizePage(raw: string | undefined): string {
  try {
    const first = new URL(raw ?? '').pathname.split('/')[1] ?? '';
    return first === '' ? '/' : /^[a-z0-9_-]{1,30}$/i.test(first) ? `/${first.toLowerCase()}` : '/autre';
  } catch {
    return '/autre';
  }
}

/** Les violations lisibles d'un corps, ou une liste vide si la forme n'est celle d'aucun navigateur. */
export function parseCspReports(text: string): CspViolation[] {
  if (text.length === 0 || text.length > CSP_MAX_BODY_BYTES) return [];
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return [];
  }
  const parsed = envelope.safeParse(json);
  if (!parsed.success) return [];
  const data = parsed.data;
  if (Array.isArray(data)) {
    return data
      .filter((r) => r.type === 'csp-violation')
      .map((r) => ({
        directive: normalizeDirective(r.body.effectiveDirective),
        disposition: r.body.disposition === 'enforce' ? ('enforce' as const) : ('report' as const),
        blocked: normalizeBlocked(r.body.blockedURL),
        page: normalizePage(r.body.documentURL),
      }));
  }
  const r = data['csp-report'];
  return [
    {
      directive: normalizeDirective(r['effective-directive'] ?? r['violated-directive']),
      disposition: r.disposition === 'enforce' ? 'enforce' : 'report',
      blocked: normalizeBlocked(r['blocked-uri']),
      page: normalizePage(r['document-uri']),
    },
  ];
}

/** Le texte rangé dans `app_errors.message` : `<report|enforce> <bloqué> <page>`, sans autre espace. */
export function cspMessage(v: CspViolation): string {
  return `${v.disposition} ${v.blocked} ${v.page}`;
}
