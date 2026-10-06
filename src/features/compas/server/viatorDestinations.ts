import 'server-only';
import { resolveProviderCredentials } from '@/features/booking/server/providerCredentials';
import { nearestViatorDestination, parseViatorDestinations, type ViatorDestination } from '../engine/viatorDest';
import { cached } from './sharedCache';

/**
 * Les destinations Viator (API partenaire v2, `GET /destinations`), lues une
 * fois et partagées une semaine. Clé absente ou panne → null : l'appelant
 * garde la résolution par nom.
 */

const TTL_S = 7 * 86_400;
const HOSTS = new Set(['api.viator.com', 'api.sandbox.viator.com']);

async function loadDestinations(): Promise<ViatorDestination[] | null> {
  const cred = resolveProviderCredentials('viator', process.env);
  if (cred.reason !== null || !cred.apiKey || !cred.baseUrl) return null;
  let base: URL;
  try {
    base = new URL(cred.baseUrl.replace(/\/+$/, ''));
  } catch {
    return null;
  }
  if (base.protocol !== 'https:' || !HOSTS.has(base.hostname)) return null;
  return cached<ViatorDestination[] | null>('place', `viator:destinations:v1:${cred.slot}`, TTL_S, async () => {
    try {
      const res = await fetch(`${base.toString().replace(/\/+$/, '')}/destinations`, {
        headers: {
          Accept: 'application/json;version=2.0',
          'Accept-Language': 'fr',
          'exp-api-key': cred.apiKey as string,
        },
        signal: AbortSignal.timeout(10_000),
        cache: 'no-store',
        redirect: 'error',
      });
      if (!res.ok) {
        console.warn('[compas] destinations Viator', res.status);
        return null;
      }
      const list = parseViatorDestinations(await res.json());
      return list.length ? list : null;
    } catch (err) {
      console.warn('[compas] destinations Viator injoignables', err instanceof Error ? err.message : 'erreur');
      return null;
    }
  });
}

/** Identifiant Viator le plus proche du lieu, ou null (on garde alors le nom). */
export async function viatorDestinationNear(
  at: { lat: number; lon: number } | null,
  opts: { broad?: boolean } = {}
): Promise<string | null> {
  if (!at) return null;
  const list = await loadDestinations();
  return list ? (nearestViatorDestination(list, at, opts)?.id ?? null) : null;
}
