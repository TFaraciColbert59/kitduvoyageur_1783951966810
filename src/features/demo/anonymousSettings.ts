import 'server-only';

/**
 * Les connexions anonymes sont-elles allumées dans Supabase Auth ? Lu sur
 * `/auth/v1/settings` (public : `external.anonymous_users`), gardé 5 minutes.
 * Un échec de lecture vaut « non » : le site garde alors son comportement
 * d'avant (jamais un bouton qui mène à une erreur).
 */

const TTL_MS = 5 * 60_000;
const TIMEOUT_MS = 3_000;
let memo: { value: boolean; at: number } | null = null;

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export async function anonymousSignInsEnabled(
  fetchImpl: FetchLike = fetch,
  now: () => number = Date.now
): Promise<boolean> {
  if (memo && now() - memo.at < TTL_MS) return memo.value;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, '');
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let value = false;
  try {
    const res = await fetchImpl(`${url}/auth/v1/settings`, {
      headers: { apikey: key, Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (res.ok) {
      const body = (await res.json()) as { external?: { anonymous_users?: unknown } };
      value = body.external?.anonymous_users === true;
    }
  } catch {
    value = false;
  } finally {
    clearTimeout(timer);
  }
  memo = { value, at: now() };
  return value;
}

/** Tests : oublie la valeur gardée. */
export function resetAnonymousSettingsMemo(): void {
  memo = null;
}
