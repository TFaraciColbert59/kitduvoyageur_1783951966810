import 'server-only';
import { LruCache } from '@/lib/explorer/edgeCache';

/**
 * Accès PostgREST côté serveur pour l'Explorer v2.
 *
 * La clé utilisée est la clé publique anon (RLS appliquée) : aucune clé de
 * service n'est nécessaire pour les lectures publiques de l'Explorer, et
 * aucune ne doit fuiter côté client (00_MISSION §7).
 *
 * Un cache LRU in-process + déduplication des requêtes en vol (coalescing)
 * accélère les lectures publiques répétées (de ~800 ms à < 2 ms) sans jamais
 * mettre en cache les requêtes avec en-tête `Authorization` utilisateur ni
 * celles explicitement marquées `revalidate: 0`.
 */

export interface PgRestError extends Error {
  status?: number;
  code?: string;
}

const pgrestCache = new LruCache<unknown>(256, 300_000);
const pgrestInFlight = new Map<string, Promise<unknown>>();

function config(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('[explorer-v2] NEXT_PUBLIC_SUPABASE_URL / ANON_KEY manquants');
  }
  return { url: url.replace(/\/$/, ''), key };
}

function hasCustomAuthHeader(headers: RequestInit['headers']): boolean {
  if (!headers) return false;
  if (headers instanceof Headers) {
    return headers.has('authorization');
  }
  if (Array.isArray(headers)) {
    return headers.some(([k]) => k.toLowerCase() === 'authorization');
  }
  return Object.keys(headers).some((k) => k.toLowerCase() === 'authorization');
}

export async function pgrest<T>(
  path: string,
  init: RequestInit & { revalidate?: number } = {},
): Promise<T> {
  const { url, key } = config();
  const method = (init.method ?? 'GET').toUpperCase();
  const revalidateSec = init.revalidate ?? 300;
  const bodyKey = typeof init.body === 'string' ? init.body : '';
  const isCacheableRead =
    revalidateSec > 0 &&
    (method === 'GET' || (method === 'POST' && path.startsWith('rpc/'))) &&
    !hasCustomAuthHeader(init.headers);

  const cacheKey = isCacheableRead ? `${method}:${path}:${bodyKey}` : null;

  if (cacheKey) {
    const cached = pgrestCache.getEntry(cacheKey);
    if (cached && !cached.isExpired) {
      return cached.value as T;
    }
    const existing = pgrestInFlight.get(cacheKey);
    if (existing) {
      return (await existing) as T;
    }
  }

  const runFetch = async (): Promise<T> => {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
      next: { revalidate: revalidateSec },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const error: PgRestError = new Error(`PostgREST ${res.status} ${path} — ${body.slice(0, 200)}`);
      error.status = res.status;
      throw error;
    }
    const data = (await res.json()) as T;
    if (cacheKey) {
      pgrestCache.set(cacheKey, data, revalidateSec * 1000);
    }
    return data;
  };

  if (!cacheKey) {
    return runFetch();
  }

  const promise = runFetch().catch((err) => {
    const stale = pgrestCache.getStale(cacheKey);
    if (stale && Date.now() - stale.fetchedAt < Math.max(revalidateSec * 4000, 600_000)) {
      return stale.value as T;
    }
    throw err;
  });

  pgrestInFlight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    pgrestInFlight.delete(cacheKey);
  }
}

export async function rpc<T>(
  name: string,
  args: Record<string, unknown>,
  revalidate = 300,
): Promise<T> {
  return pgrest<T>(`rpc/${name}`, {
    method: 'POST',
    body: JSON.stringify(args),
    revalidate,
  });
}
