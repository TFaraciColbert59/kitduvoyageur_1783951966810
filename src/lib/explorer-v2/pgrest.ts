import 'server-only';

/**
 * Accès PostgREST côté serveur pour l'Explorer v2.
 *
 * La clé utilisée est la clé publique anon (RLS appliquée) : aucune clé de
 * service n'est nécessaire pour les lectures publiques de l'Explorer, et
 * aucune ne doit fuiter côté client (00_MISSION §7).
 */

export interface PgRestError extends Error {
  status?: number;
  code?: string;
}

function config(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('[explorer-v2] NEXT_PUBLIC_SUPABASE_URL / ANON_KEY manquants');
  }
  return { url: url.replace(/\/$/, ''), key };
}

export async function pgrest<T>(
  path: string,
  init: RequestInit & { revalidate?: number } = {},
): Promise<T> {
  const { url, key } = config();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    next: { revalidate: init.revalidate ?? 300 },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const error: PgRestError = new Error(`PostgREST ${res.status} ${path} — ${body.slice(0, 200)}`);
    error.status = res.status;
    throw error;
  }
  return (await res.json()) as T;
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
