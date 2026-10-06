import 'server-only';
import { resolveProviderCredentials } from '@/features/booking/server/providerCredentials';
import { nearestViatorDestination, parseViatorDestinations, type ViatorDestination } from '../engine/viatorDest';
import { cached } from './sharedCache';
import { VIATOR_DESTINATION_IDS } from '@/features/discovery/providers/viator/viatorData';
import { distanceKm } from '../engine/places';

/**
 * Les destinations Viator (API partenaire v2, `GET /destinations`), lues une
 * fois et partagées une semaine. Clé absente ou panne → null : l'appelant
 * garde la résolution par nom.
 */

const TTL_S = 7 * 86_400;
/** Dernière raison d'échec (statut HTTP ou type d'erreur), affichable : jamais de clé. */
let lastFailure: string | null = null;
export const viatorDestinationsFailure = () => lastFailure;
const HOSTS = new Set(['api.viator.com', 'api.sandbox.viator.com']);

async function loadDestinations(): Promise<ViatorDestination[] | null> {
  const cred = resolveProviderCredentials('viator', process.env);
  if (cred.reason !== null || !cred.apiKey || !cred.baseUrl) {
    lastFailure = 'clé ou adresse absente';
    return null;
  }
  let base: URL;
  try {
    base = new URL(cred.baseUrl.replace(/\/+$/, ''));
  } catch {
    return null;
  }
  if (base.protocol !== 'https:' || !HOSTS.has(base.hostname)) {
    lastFailure = 'adresse API non reconnue';
    return null;
  }
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
        lastFailure = `destinations ${res.status}`;
        return null;
      }
      const list = parseViatorDestinations(await res.json());
      lastFailure = list.length ? null : 'destinations : réponse vide';
      return list.length ? list : null;
    } catch (err) {
      console.warn('[compas] destinations Viator injoignables', err instanceof Error ? err.message : 'erreur');
      lastFailure = `destinations ${err instanceof Error ? err.name : 'erreur'}`;
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
  if (!list) return null;
  const hit = nearestViatorDestination(list, at, opts);
  if (!hit) {
    // Pour le diagnostic affiché : taille de la liste et types rencontrés (aucune donnée sensible).
    const types = [...new Set(list.map((d) => d.type))].slice(0, 6).join('/');
    lastFailure = `liste ${list.length} (${types}), aucune à moins de 120 km`;
  }
  return hit?.id ?? null;
}

/**
 * Repli quand la carte ne trouve rien : l'identifiant du PAYS (table officielle),
 * sauf pour les pays dont l'entrée est une seule ville (Paris, Tokyo,
 * Reykjavik), retenue seulement à moins de 150 km de cette ville.
 */
const CITY_PILOTS: Record<string, { lat: number; lon: number }> = {
  FR: { lat: 48.8566, lon: 2.3522 },
  JP: { lat: 35.6762, lon: 139.6503 },
  IS: { lat: 64.1466, lon: -21.9426 },
};
export function viatorCountryFallback(
  countryCode: string | null | undefined,
  at: { lat: number; lon: number } | null
): string | null {
  const code = countryCode?.trim().toUpperCase();
  if (!code) return null;
  const id = VIATOR_DESTINATION_IDS[code];
  if (!id || !/^\d+$/.test(id)) return null;
  const pilot = CITY_PILOTS[code];
  if (pilot && (!at || distanceKm(at, pilot) > 150)) return null;
  return id;
}
