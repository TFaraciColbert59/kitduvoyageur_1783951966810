// src/features/discovery/providers/klook/klookLinks.ts
// Validation stricte des liens sortants Klook / Travelpayouts.

/** Domaines autorisés : Klook officiel + domaine court Travelpayouts. */
export const KLOOK_ALLOWED_HOSTS = ['klook.com', 'klook.tp.st', 'tp.media'] as const;

/**
 * Lien officiel de repli tant qu'aucun lien d'affiliation n'est configuré :
 * racine officielle Klook (aucun chemin inventé, aucun scraping). Non affilié.
 */
export const KLOOK_BRAND_FALLBACK_URL = 'https://www.klook.com/';

export interface ValidatedKlookUrl {
  url: string;
  host: string;
  isAffiliate: boolean;
}

export function isAllowedKlookHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return KLOOK_ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

/**
 * Renvoie `null` pour toute URL non conforme (http, javascript:, data:,
 * identifiants embarqués, host hors allowlist, URL arbitraire). Ne lève jamais.
 */
export function validateKlookUrl(raw: string | null | undefined): ValidatedKlookUrl | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Blocage explicite des schémas dangereux.
  if (/^(javascript|data|vbscript|file|blob):/i.test(trimmed)) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;
  if (!parsed.hostname || !isAllowedKlookHost(parsed.hostname)) return null;

  const host = parsed.hostname.toLowerCase();
  const isAffiliate =
    host === 'klook.tp.st' ||
    host.endsWith('.klook.tp.st') ||
    host === 'tp.media' ||
    host.endsWith('.tp.media');

  return { url: parsed.toString(), host, isAffiliate };
}
