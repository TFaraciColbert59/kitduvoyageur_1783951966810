import crypto from 'crypto';

export const ALLOWED_AFFILIATE_DOMAINS = [
  'booking.com',
  'tp.media',
  'travelpayouts.com',
  'aviasales.com',
  'getyourguide.com',
  'chapkassurances.com',
  'airalo.com',
  'sncf-connect.com',
  'alltrails.com',
  'komoot.com',
  'tiqets.com',
];

export function isAllowedAffiliateDomain(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_AFFILIATE_DOMAINS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );
}

/**
 * Validation stricte d'URL sortante contre les attaques Open Redirect (L6).
 * N'autorise que les URL absolues HTTPS et optionnellement vérifie le domaine partenaire.
 */
export function isValidAffiliateTargetUrl(urlStr: string, enforceAllowlist = false): boolean {
  try {
    const parsed = new URL(urlStr);
    const isHttps = parsed.protocol === 'https:' && parsed.hostname.length > 3;
    if (!isHttps) return false;
    if (enforceAllowlist && !isAllowedAffiliateDomain(parsed.hostname)) {
      return false;
    }
    return true;
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

/**
 * Masque les numéros sensibles (passeports, CNI, permis) pour l'affichage et les logs.
 * Préserve uniquement les 4 derniers caractères.
 * Ex: '21AA12345' -> '•••••2345'
 */
export function maskSensitiveIdentityNumber(idNumber: string): string {
  if (!idNumber) return '';
  const trimmed = idNumber.trim();
  if (trimmed.length <= 4) {
    return '•'.repeat(trimmed.length);
  }
  const maskedCount = trimmed.length - 4;
  const visible = trimmed.slice(-4);
  return '•'.repeat(maskedCount) + visible;
}

const DEFAULT_DOC_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || 'lkdv-doc-secret-2026';

/**
 * Génère une URL signée HMAC à durée limitée pour accéder à un document sensible
 */
export function generateSignedDocumentUrl(
  filePath: string,
  expiresInSeconds = 900, // 15 minutes par défaut
  secret = DEFAULT_DOC_SECRET
): string {
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const dataToSign = `${filePath}|${expires}`;
  const signature = crypto.createHmac('sha256', secret).update(dataToSign).digest('hex');
  const encodedPath = encodeURIComponent(filePath);
  return `/api/documents/secure?file=${encodedPath}&expires=${expires}&sig=${signature}`;
}

export interface VerifySignedDocResult {
  isValid: boolean;
  filePath?: string;
  error?: 'EXPIRED' | 'INVALID_SIGNATURE' | 'MALFORMED';
}

/**
 * Vérifie l'authenticité et l'expiration d'une URL signée pour un document sensible
 */
export function verifySignedDocumentUrl(
  signedUrl: string,
  secret = DEFAULT_DOC_SECRET
): VerifySignedDocResult {
  try {
    const url = new URL(signedUrl, 'https://lekitduvoyageur.fr');
    const file = url.searchParams.get('file');
    const expiresStr = url.searchParams.get('expires');
    const sig = url.searchParams.get('sig');

    if (!file || !expiresStr || !sig) {
      return { isValid: false, error: 'MALFORMED' };
    }

    const expires = parseInt(expiresStr, 10);
    const nowSec = Math.floor(Date.now() / 1000);

    if (nowSec > expires) {
      return { isValid: false, error: 'EXPIRED' };
    }

    const dataToSign = `${file}|${expires}`;
    const expectedSig = crypto.createHmac('sha256', secret).update(dataToSign).digest('hex');

    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    const receivedBuf = Buffer.from(sig, 'utf8');

    if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
      return { isValid: false, error: 'INVALID_SIGNATURE' };
    }

    return { isValid: true, filePath: file };
  } catch {
    return { isValid: false, error: 'MALFORMED' };
  }
}
