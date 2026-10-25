/**
 * A11 — Limiteur de débit en mémoire (best-effort) des lectures publiques.
 *
 * Moteur pur : aucune I/O, aucune horloge implicite (l'instant est injecté).
 * La route `/api/terrain/conditions` l'utilise avec une `Map` module-level
 * (une entrée par IP) pour amortir les rafales sans dépendance externe.
 *
 * Le seau est volontairement best-effort : il ne remplace ni un quota partagé
 * ni un WAF, il protège seulement la lecture PostGIS la plus coûteuse.
 */

/** Seau à jetons : jetons disponibles + dernier instant de calcul. */
export interface TokenBucket {
  tokens: number;
  updatedAtMs: number;
}

export interface ConsumeTokenOptions {
  /** Capacité maximale du seau (défaut `DEFAULT_BUCKET_CAPACITY`). */
  capacity?: number;
  /** Jetons rechargés par seconde (défaut `DEFAULT_REFILL_PER_SECOND`). */
  refillPerSecond?: number;
}

export interface ConsumeTokenResult {
  allowed: boolean;
  /** Seau mis à jour (à réécrire dans la Map ; la fonction reste pure). */
  bucket: TokenBucket;
  /** Secondes à attendre avant un nouveau jeton (0 si autorisé). */
  retryAfterSeconds: number;
}

/** Capacité par défaut d'un seau de lecture publique. */
export const DEFAULT_BUCKET_CAPACITY = 60;
/** Rechargement par défaut (jetons par seconde). */
export const DEFAULT_REFILL_PER_SECOND = 1;

/** Capacité retenue pour `GET /api/terrain/conditions` (rafale). */
export const PUBLIC_READ_BUCKET_CAPACITY = 30;
/** Rechargement retenu pour `GET /api/terrain/conditions` (30 req/min). */
export const PUBLIC_READ_REFILL_PER_SECOND = 0.5;

function safeCapacity(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_BUCKET_CAPACITY;
  return Math.max(1, Math.floor(value));
}

function safeRefill(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_REFILL_PER_SECOND;
  }
  return value;
}

/** Crée un seau plein à `nowMs` (borné à au moins 1 jeton). */
export function createTokenBucket(
  nowMs: number,
  capacity: number = DEFAULT_BUCKET_CAPACITY
): TokenBucket {
  const safe = safeCapacity(capacity);
  const at = Number.isFinite(nowMs) ? nowMs : 0;
  return { tokens: safe, updatedAtMs: at };
}

/**
 * Consomme un jeton si possible.
 *
 * Le seau se recharge linéairement (`refillPerSecond`) entre `updatedAtMs` et
 * l'instant fourni, plafonné à `capacity`. Un instant antérieur (horloge
 * inversée) ne recharge jamais. La fonction ne mute pas l'entrée : le seau
 * retourné doit être persisté par l'appelant.
 */
export function consumeToken(
  bucket: TokenBucket,
  nowMs: number,
  options: ConsumeTokenOptions = {}
): ConsumeTokenResult {
  const capacity = safeCapacity(options.capacity);
  const refillPerSecond = safeRefill(options.refillPerSecond);
  const at = Number.isFinite(nowMs) ? nowMs : bucket.updatedAtMs;
  const safeBucket: TokenBucket = {
    tokens: Math.min(capacity, Math.max(0, bucket.tokens)),
    updatedAtMs: bucket.updatedAtMs,
  };

  const elapsedMs = Math.max(0, at - safeBucket.updatedAtMs);
  const refilled = Math.min(
    capacity,
    safeBucket.tokens + (elapsedMs / 1000) * refillPerSecond
  );

  if (refilled >= 1) {
    return {
      allowed: true,
      bucket: { tokens: Math.min(capacity, refilled - 1), updatedAtMs: at },
      retryAfterSeconds: 0,
    };
  }

  return {
    allowed: false,
    bucket: { tokens: refilled, updatedAtMs: at },
    retryAfterSeconds: Math.max(1, Math.ceil((1 - refilled) / refillPerSecond)),
  };
}
