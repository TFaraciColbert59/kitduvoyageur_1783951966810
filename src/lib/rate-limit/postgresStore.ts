/**
 * Store Postgres (Supabase) du rate limiting distribué, sans service payant.
 *
 * Audit du 8 octobre : sans Upstash, chaque instance Vercel comptait pour elle
 * seule ; dix instances laissaient passer dix fois la limite. La fenêtre fixe
 * vit désormais dans la base (`rate_limit_consume`, migration
 * `rate_limit_windows`), partagée par toutes les instances.
 *
 * - Appel PostgREST en `fetch` (aucune dépendance, compatible Edge) avec la clé
 *   du rôle de service : la fonction n'est exécutable que par lui.
 * - La clé est hachée avant d'être envoyée : aucune IP ni identifiant lisible
 *   en base. HMAC-SHA-256 avec la clé de service (plan 2.10) : un simple
 *   SHA-256 d'une adresse IPv4 se retrouve en essayant les 2³² adresses.
 * - Toute réponse invalide ou non-2xx lève : l'appelant décide du fail-safe,
 *   comme pour Upstash.
 */

/** Configuration Supabase lue dans l'environnement (injectable en test). */
export interface PostgresRateLimitEnv {
  supabaseUrl?: string;
  serviceRoleKey?: string;
}

/** Lit `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. */
export function readPostgresEnv(): PostgresRateLimitEnv {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  if (!env) return {};
  return {
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

/** Vrai si l'URL du projet et la clé de service sont présentes (non vides). */
export function isPostgresConfigured(env: PostgresRateLimitEnv): boolean {
  return hasText(env.supabaseUrl) && hasText(env.serviceRoleKey);
}

function hasText(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Empreinte hexadécimale de la clé (Web Crypto : Node et Edge) : HMAC-SHA-256
 * avec `secret` (la clé de service, connue du serveur seul), SHA-256 sans lui.
 */
export async function hashRateLimitKey(key: string, secret?: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const digest = secret
    ? await crypto.subtle.sign(
        'HMAC',
        await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
          'sign',
        ]),
        data
      )
    : await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface ConsumePostgresOptions {
  key: string;
  windowMs: number;
  env: PostgresRateLimitEnv;
  fetchImpl: typeof fetch;
  timeoutMs: number;
}

export interface PostgresRateLimitResult {
  count: number;
  resetAtMs: number;
}

/** Bornes acceptées par la fonction SQL (1 s à 24 h). */
const MIN_WINDOW_MS = 1_000;
const MAX_WINDOW_MS = 86_400_000;

/**
 * Incrémente la fenêtre fixe en base. Lève si le réseau, le statut HTTP ou la
 * forme de la réponse ne permettent pas de statuer (jamais de valeur devinée).
 */
export async function consumePostgresWindow(
  options: ConsumePostgresOptions
): Promise<PostgresRateLimitResult> {
  const baseUrl = (options.env.supabaseUrl ?? '').trim().replace(/\/+$/, '');
  const serviceKey = (options.env.serviceRoleKey ?? '').trim();
  const windowMs = Math.min(MAX_WINDOW_MS, Math.max(MIN_WINDOW_MS, options.windowMs));
  const hashedKey = await hashRateLimitKey(options.key, serviceKey || undefined);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, options.timeoutMs));

  try {
    const response = await options.fetchImpl(`${baseUrl}/rest/v1/rpc/rate_limit_consume`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ p_key: hashedKey, p_window_ms: windowMs }),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`postgres_http_${response.status}`);
    }
    const payload = (await response.json()) as unknown;
    const row = (Array.isArray(payload) ? payload[0] : payload) as
      | { current_hits?: unknown; reset_at?: unknown }
      | undefined;
    const count = row?.current_hits;
    const resetAtMs = typeof row?.reset_at === 'string' ? Date.parse(row.reset_at) : NaN;
    if (typeof count !== 'number' || !Number.isFinite(count) || !Number.isFinite(resetAtMs)) {
      throw new Error('postgres_reponse_invalide');
    }
    return { count, resetAtMs };
  } finally {
    clearTimeout(timer);
  }
}
