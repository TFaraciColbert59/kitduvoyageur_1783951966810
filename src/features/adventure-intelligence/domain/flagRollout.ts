/**
 * A11 — Cohortes de rollout des feature flags (audit #33).
 *
 * Attribution stable : `bucket = parseInt(sha256(userId).slice(0, 8), 16) % 100`.
 * La même formule est implémentée côté PostgreSQL (`a11_cohort_bucket`,
 * migration 20260911330000) : un utilisateur garde son bucket quel que soit le
 * runtime (navigateur, Node, SQL).
 *
 * `evaluateUserFlag` est pur : il reçoit le bucket déjà calculé (ou dérivé du
 * hex SHA-256), ce qui le rend testable sans Web Crypto et sans BDD.
 * Ordre de priorité : flag désactivé > allowlist > exclusions > pourcentage.
 */
export interface FlagCohortConfig {
  enabled: boolean;
  percentage: number;
  allowlist: readonly string[];
  exclusions: readonly string[];
}

const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;

/** Pourcentage borné 0..100 (NaN/négatif ⇒ 0, > 100 ⇒ 100). */
export function normalizePercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.trunc(value)));
}

/**
 * Bucket 0..99 dérivé d'une empreinte SHA-256 hex 64 : mêmes 8 premiers
 * caractères hexadécimaux que `a11_cohort_bucket` en SQL. Pure et stable.
 */
export function cohortBucketFromSha256Hex(hex: string): number {
  if (!SHA256_HEX_PATTERN.test(hex)) {
    throw new Error('cohortBucketFromSha256Hex : empreinte SHA-256 hex 64 attendue.');
  }
  return Number.parseInt(hex.slice(0, 8), 16) % 100;
}

async function sha256Hex(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (typeof subtle?.digest !== 'function') {
    throw new Error(
      'cohortBucket : Web Crypto (SHA-256) indisponible — cohorte stable impossible.'
    );
  }
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value));
  let hex = '';
  for (const byte of new Uint8Array(digest)) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

/** Bucket stable 0..99 de l'utilisateur (SHA-256 via Web Crypto). */
export async function cohortBucket(userId: string): Promise<number> {
  if (!userId || userId.trim().length === 0) {
    throw new Error('cohortBucket : userId requis.');
  }
  return cohortBucketFromSha256Hex(await sha256Hex(userId));
}

/**
 * Décision d'exposition d'un flag pour un utilisateur :
 * - flag globalement désactivé ⇒ false, quoi qu'il arrive ;
 * - allowlist ⇒ true (priorité maximale, même exclu par ailleurs) ;
 * - exclusion ⇒ false ;
 * - sinon bucket < pourcentage (0 ⇒ personne hors allowlist, 100 ⇒ tous les
 *   non-exclus).
 */
export function evaluateUserFlag(
  config: FlagCohortConfig,
  userId: string,
  bucket: number
): boolean {
  if (!config.enabled) return false;
  if (!userId || userId.trim().length === 0) return false;
  if (config.allowlist.includes(userId)) return true;
  if (config.exclusions.includes(userId)) return false;

  const percentage = normalizePercentage(config.percentage);
  if (percentage <= 0) return false;
  if (percentage >= 100) return true;
  if (!Number.isFinite(bucket)) return false;
  return bucket >= 0 && bucket < percentage;
}
