export interface SameOriginInput {
  method: string;
  origin: string | null;
  host: string | null;
  allowedHosts?: string[];
}

function hostnameOf(value: string): string | null {
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Vrai si une MUTATION arrive d'un site différent (CSRF probable).
 * - Les méthodes sûres (GET/HEAD/OPTIONS) ne sont jamais bloquées ici.
 * - Absence d'Origin = appel serveur à serveur / webhook signé → laissé passer
 *   (les routes concernées ont leur propre authentification).
 * - Origin illisible → refus par défaut.
 * - La comparaison se fait par nom d'hôte (les ports n'entrent pas dans la
 *   notion de « same site »).
 */
export function isCrossSiteMutation({
  method,
  origin,
  host,
  allowedHosts = [],
}: SameOriginInput): boolean {
  const normalizedMethod = (method || 'GET').toUpperCase();
  if (normalizedMethod === 'GET' || normalizedMethod === 'HEAD' || normalizedMethod === 'OPTIONS') {
    return false;
  }
  if (!origin) return false;

  const originHost = hostnameOf(origin);
  if (!originHost) return true;

  const candidates = [host, ...allowedHosts]
    .filter((value): value is string => Boolean(value))
    .map((value) => hostnameOf(value))
    .filter((value): value is string => Boolean(value));

  return !candidates.includes(originHost);
}

export function allowedHostsFromSiteUrl(
  siteUrl: string | undefined = process.env.NEXT_PUBLIC_SITE_URL
): string[] {
  if (!siteUrl) return [];
  try {
    return [new URL(siteUrl).host];
  } catch {
    return [];
  }
}

export interface SameSiteSignalInput {
  origin: string | null;
  referer: string | null;
  host: string | null;
  allowedHosts?: string[];
}

/**
 * Vrai si la requête porte un signal d'origine SAME-SITE fiable (Origin ou
 * Referer). Utilisé par les routes à effet hors `/api` : un POST de formulaire
 * cross-site envoie un Origin étranger ; une navigation/image cross-site envoie
 * un Referer étranger ; sans aucun des deux (accès direct), on refuse.
 */
export function hasValidSameSiteSignal({
  origin,
  referer,
  host,
  allowedHosts = [],
}: SameSiteSignalInput): boolean {
  const candidates = [host, ...allowedHosts]
    .filter((value): value is string => Boolean(value))
    .map((value) => hostnameOf(value))
    .filter((value): value is string => Boolean(value));

  const matches = (value: string | null): boolean => {
    if (!value) return false;
    const hostname = hostnameOf(value);
    return hostname !== null && candidates.includes(hostname);
  };

  return matches(origin) || matches(referer);
}
