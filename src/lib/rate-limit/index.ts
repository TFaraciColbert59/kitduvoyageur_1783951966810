/**
 * Phase 6 — Rate limiting distribué (chantier §9.11).
 *
 * Abstraction unique pour toutes les routes sensibles :
 *
 * - **Upstash Redis REST** si `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
 *   sont configurés (compteur partagé entre instances, fenêtre fixe) ;
 * - sinon **Postgres (Supabase)** si `NEXT_PUBLIC_SUPABASE_URL` +
 *   `SUPABASE_SERVICE_ROLE_KEY` sont présents : même fenêtre fixe, partagée,
 *   gratuite (audit du 8 octobre : la mémoire par instance ne limitait rien) ;
 * - **repli mémoire** (fenêtre fixe locale, best-effort) si rien n'est
 *   configuré (tests, développement) ;
 * - **si configuré mais injoignable** : fail-safe explicite, jamais silencieux :
 *   • `failMode: 'closed'` (routes sensibles : génération IA payante) ⇒ refus
 *     `unavailable` (à traduire en 503 par la route) sans laisser passer la
 *     requête ;
 *   • `failMode: 'open'` (lectures publiques, synchronisation de données) ⇒
 *     repli mémoire dégradé, journalisé via `degraded: true` et `detail`.
 *
 * Aucune dépendance externe : Upstash et PostgREST sont appelés via `fetch`.
 */
import { consumeMemoryWindow } from './memoryStore';
import {
  consumePostgresWindow,
  isPostgresConfigured,
  readPostgresEnv,
  type PostgresRateLimitEnv,
} from './postgresStore';
import {
  consumeUpstashWindow,
  isUpstashConfigured,
  readUpstashEnv,
  type UpstashEnv,
} from './upstashStore';

export {
  resetMemoryRateLimits,
  memoryRateLimitSize,
} from './memoryStore';
export { isUpstashConfigured, readUpstashEnv } from './upstashStore';
export type { UpstashEnv } from './upstashStore';
export { isPostgresConfigured, readPostgresEnv } from './postgresStore';
export type { PostgresRateLimitEnv } from './postgresStore';

/** Configuration des backends partagés (Upstash, puis Postgres). */
export type RateLimitEnv = UpstashEnv & PostgresRateLimitEnv;

/** Lit la configuration des deux backends partagés dans l'environnement. */
export function readRateLimitEnv(): RateLimitEnv {
  return { ...readUpstashEnv(), ...readPostgresEnv() };
}

/** Politique en cas d'indisponibilité d'Upstash configuré. */
export type RateLimitFailMode = 'open' | 'closed';

/** Résultat d'une consommation : autorisé, limité, ou backend indisponible. */
export type RateLimitOutcome = 'allowed' | 'limited' | 'unavailable';

/** Backend effectivement utilisé. */
export type RateLimitBackend = 'redis' | 'postgres' | 'memory';

/** Délai par défaut d'un appel Upstash avant bascule fail-safe (ms). */
export const DEFAULT_RATE_LIMIT_TIMEOUT_MS = 750;
/** Délai par défaut d'un appel Postgres (base à Paris, fonctions parfois loin). */
export const DEFAULT_POSTGRES_RATE_LIMIT_TIMEOUT_MS = 1_500;

export interface RateLimitOptions {
  /** Clé logique complète (`scope:identifiant`). */
  key: string;
  /** Nombre maximal de requêtes par fenêtre. */
  limit: number;
  /** Durée de la fenêtre (ms). */
  windowMs: number;
  /** Comportement si le backend partagé est injoignable (défaut `open`). */
  failMode?: RateLimitFailMode;
  /** Horloge injectable (tests). */
  now?: () => number;
  /** `fetch` injectable (tests). */
  fetchImpl?: typeof fetch;
  /** Délai maximal d'un appel au backend partagé (défaut selon le backend). */
  timeoutMs?: number;
  /** Configuration injectable (défaut : variables d'environnement). */
  env?: RateLimitEnv;
}

export interface RateLimitResult {
  outcome: RateLimitOutcome;
  /** Raccourci : vrai uniquement si `outcome === 'allowed'`. */
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Secondes avant réessai (0 si autorisé). */
  retryAfterSeconds: number;
  backend: RateLimitBackend;
  /** Vrai si le résultat provient d'un repli dégradé (backend partagé en échec). */
  degraded: boolean;
  /** Détail technique non sensible (journalisation). */
  detail: string;
}

function positiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.trunc(value);
}

function secondsUntil(resetAtMs: number, nowMs: number): number {
  const delta = resetAtMs - nowMs;
  if (!Number.isFinite(delta) || delta <= 0) return 0;
  return Math.max(1, Math.ceil(delta / 1000));
}

function memoryResult(
  options: Required<Pick<RateLimitOptions, 'key' | 'limit' | 'windowMs'>>,
  nowMs: number,
  degraded: boolean,
  detail: string
): RateLimitResult {
  const { count, resetAtMs } = consumeMemoryWindow(options.key, options.windowMs, nowMs);
  const allowed = count <= options.limit;
  return {
    outcome: allowed ? 'allowed' : 'limited',
    allowed,
    limit: options.limit,
    remaining: Math.max(0, options.limit - count),
    retryAfterSeconds: allowed ? 0 : Math.max(1, secondsUntil(resetAtMs, nowMs)),
    backend: 'memory',
    degraded,
    detail,
  };
}

/**
 * Consomme une unité de quota pour `key`. Ne jette jamais : un backend
 * indisponible devient `unavailable` (fail-closed) ou un repli mémoire dégradé
 * (fail-open), selon `failMode`.
 */
export async function rateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const limit = positiveInt(options.limit, 1);
  const windowMs = positiveInt(options.windowMs, 60_000);
  const failMode: RateLimitFailMode = options.failMode ?? 'open';
  const now = options.now ?? Date.now;
  const nowMs = now();
  const normalized = { key: options.key, limit, windowMs };
  const env = options.env ?? readRateLimitEnv();

  const backend: RateLimitBackend | null = isUpstashConfigured(env)
    ? 'redis'
    : isPostgresConfigured(env)
      ? 'postgres'
      : null;
  if (!backend) {
    return memoryResult(normalized, nowMs, false, 'memoire_locale');
  }

  const fetchImpl = options.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  if (!fetchImpl) {
    return failSafe(options.key, limit, windowMs, failMode, 'fetch_indisponible', nowMs, backend);
  }

  try {
    const { count, resetAtMs } =
      backend === 'redis'
        ? await consumeUpstashWindow({
            key: options.key,
            windowMs,
            env,
            fetchImpl,
            timeoutMs: positiveInt(options.timeoutMs ?? DEFAULT_RATE_LIMIT_TIMEOUT_MS, 750),
            nowMs,
          })
        : await consumePostgresWindow({
            key: options.key,
            windowMs,
            env,
            fetchImpl,
            timeoutMs: positiveInt(
              options.timeoutMs ?? DEFAULT_POSTGRES_RATE_LIMIT_TIMEOUT_MS,
              DEFAULT_POSTGRES_RATE_LIMIT_TIMEOUT_MS
            ),
          });
    const allowed = count <= limit;
    return {
      outcome: allowed ? 'allowed' : 'limited',
      allowed,
      limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: allowed ? 0 : Math.max(1, secondsUntil(resetAtMs, nowMs)),
      backend,
      degraded: false,
      detail: backend === 'redis' ? 'upstash_redis' : 'postgres',
    };
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message
        : backend === 'redis'
          ? 'upstash_indisponible'
          : 'postgres_indisponible';
    return failSafe(options.key, limit, windowMs, failMode, detail, nowMs, backend);
  }
}

function failSafe(
  key: string,
  limit: number,
  windowMs: number,
  failMode: RateLimitFailMode,
  detail: string,
  nowMs: number,
  backend: RateLimitBackend
): RateLimitResult {
  if (failMode === 'closed') {
    return {
      outcome: 'unavailable',
      allowed: false,
      limit,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)),
      backend,
      degraded: true,
      detail: `fail_closed:${detail}`,
    };
  }
  return memoryResult({ key, limit, windowMs }, nowMs, true, `repli_memoire:${detail}`);
}

/** Clé logique stable : `scope:identifiant`. */
export function rateLimitKey(scope: string, identifier: string): string {
  const safeScope = scope.trim().length > 0 ? scope.trim() : 'rate';
  const safeId = identifier.trim().length > 0 ? identifier.trim() : 'inconnu';
  return `${safeScope}:${safeId}`;
}

/**
 * IP cliente à partir des en-têtes de proxy, jamais devinée : premier
 * `x-forwarded-for`, puis `x-real-ip`, sinon `inconnue`.
 */
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get('x-real-ip')?.trim();
  return realIp && realIp.length > 0 ? realIp : 'inconnue';
}

/** En-têtes standards à poser sur une réponse limitée. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
  };
  if (result.retryAfterSeconds > 0) {
    headers['Retry-After'] = String(result.retryAfterSeconds);
  }
  if (result.degraded) {
    headers['X-RateLimit-Degraded'] = '1';
  }
  return headers;
}
