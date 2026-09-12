/**
 * Phase 6 — Store Upstash Redis REST (rate limiting distribué).
 *
 * Implémentation sans dépendance : appels REST `fetch` sur le pipeline Upstash.
 * Fenêtre fixe atomique côté Redis :
 *   1. `INCR key`             — compteur de la fenêtre ;
 *   2. `PEXPIRE key ms NX`    — TTL posé uniquement s'il n'existe pas ;
 *   3. `PTTL key`             — temps restant pour `Retry-After`.
 *
 * `NX` (Redis ≥ 7) évite de prolonger la fenêtre à chaque requête. Toute
 * réponse invalide ou non-2xx lève : l'appelant décide du fail-safe
 * (`failMode` `closed` ou repli mémoire `open`).
 */

/** Configuration Upstash lue dans l'environnement (injectable en test). */
export interface UpstashEnv {
  url?: string;
  token?: string;
}

/** Lit `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`. */
export function readUpstashEnv(): UpstashEnv {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  if (!env) return {};
  return {
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  };
}

/** Vrai si l'URL et le jeton sont tous deux présents (non vides). */
export function isUpstashConfigured(env: UpstashEnv): boolean {
  return hasText(env.url) && hasText(env.token);
}

function hasText(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export interface ConsumeUpstashOptions {
  key: string;
  windowMs: number;
  env: UpstashEnv;
  fetchImpl: typeof fetch;
  timeoutMs: number;
  /** Horloge injectée (alignée sur l'appelant). */
  nowMs: number;
}

export interface UpstashRateLimitResult {
  count: number;
  resetAtMs: number;
}

interface PipelineEntry {
  result?: unknown;
  error?: unknown;
}

function numericResult(entry: PipelineEntry | undefined, label: string): number {
  if (!entry || entry.error != null || typeof entry.result !== 'number') {
    throw new Error(`upstash_reponse_invalide:${label}`);
  }
  return entry.result;
}

/**
 * Incrémente la fenêtre fixe sur Upstash. Lève si le réseau, le statut HTTP ou
 * la forme de la réponse ne permettent pas de statuer (jamais de valeur
 * devinée).
 */
export async function consumeUpstashWindow(
  options: ConsumeUpstashOptions
): Promise<UpstashRateLimitResult> {
  const baseUrl = (options.env.url ?? '').trim().replace(/\/+$/, '');
  const token = (options.env.token ?? '').trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, options.timeoutMs));

  try {
    const response = await options.fetchImpl(`${baseUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', options.key],
        ['PEXPIRE', options.key, options.windowMs, 'NX'],
        ['PTTL', options.key],
      ]),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`upstash_http_${response.status}`);
    }
    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload) || payload.length < 3) {
      throw new Error('upstash_reponse_invalide:forme');
    }
    const entries = payload as PipelineEntry[];
    const count = numericResult(entries[0], 'incr');
    numericResult(entries[1], 'pexpire');
    const pttl = numericResult(entries[2], 'pttl');
    const resetAtMs = options.nowMs + Math.max(0, pttl);
    return { count, resetAtMs };
  } finally {
    clearTimeout(timer);
  }
}
