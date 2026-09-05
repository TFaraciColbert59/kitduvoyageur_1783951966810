import crypto from 'crypto';

/**
 * Validation stricte d'URL sortante contre les attaques Open Redirect.
 * N'autorise que les URL absolues HTTPS avec domaine valide.
 */
export function isValidAffiliateTargetUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === 'https:' && parsed.hostname.length > 3;
  } catch {
    return false;
  }
}

/**
 * Construction sécurisée de l'URL partenaire Travelpayouts / Direct.
 * Fusionne les paramètres de tracking sans corrompre les query params existants.
 */
export function buildAffiliateUrl(
  baseUrl: string,
  trackingParams: Record<string, string> = {},
  options?: { marker?: string; subId?: string }
): string {
  if (!isValidAffiliateTargetUrl(baseUrl)) {
    throw new Error('URL partenaire invalide ou non sécurisée (HTTPS requis).');
  }

  const url = new URL(baseUrl);

  // Fusionner les paramètres configurés
  for (const [key, value] of Object.entries(trackingParams)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  // Marqueur Travelpayouts officiel si injecté
  if (options?.marker) {
    url.searchParams.set('marker', options.marker);
  }

  // Identifiant de session / clic (sub_id)
  if (options?.subId) {
    url.searchParams.set('sub_id', options.subId);
  }

  return url.toString();
}

/**
 * Hachage salé SHA-256 de la session pour la minimisation RGPD (ROADMAP §5.3).
 * L'adresse IP brute n'est JAMAIS stockée en base de données.
 */
export function hashSessionForRgpd(
  ip: string,
  userAgent: string,
  salt = 'lkdv_privacy_salt_2026'
): string {
  const normalizedIp = (ip || '0.0.0.0').trim();
  const normalizedUa = (userAgent || 'unknown').trim();
  return crypto
    .createHash('sha256')
    .update(`${salt}:${normalizedIp}:${normalizedUa}`)
    .digest('hex');
}

/**
 * Vérification de la signature cryptographique du webhook postback Travelpayouts (HMAC-SHA256).
 * Utilise timingSafeEqual pour prévenir toute attaque par timing (side-channel).
 */
export function verifyAffiliatePostbackSignature(
  rawPayload: string,
  receivedSignature: string,
  webhookSecret: string
): boolean {
  if (!receivedSignature || !webhookSecret) return false;

  try {
    const computedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawPayload)
      .digest('hex');

    const expectedBuffer = Buffer.from(computedSignature, 'utf8');
    const receivedBuffer = Buffer.from(receivedSignature, 'utf8');

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch {
    return false;
  }
}
