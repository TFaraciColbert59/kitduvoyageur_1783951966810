import 'server-only';
import { createHash } from 'node:crypto';
import { buildOverpassQuery, distinctPlaces, parseOverpass, type StagePoint } from '../engine/stagePois';
import type { RoutePoi } from '../engine/routePois';
import { cached, coordKey } from './sharedCache';

/**
 * Points utiles autour des étapes, depuis OpenStreetMap (Overpass). Partagés
 * une semaine entre tous (cache Supabase) : un même village n'est demandé
 * qu'une fois au service public. Panne → liste vide, jamais un point inventé.
 */

const TTL_S = 7 * 86_400;
const TIMEOUT_MS = 15_000;
/** Instances publiques, essayées dans l'ordre (la première qui répond). */
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const UA = 'kitduvoyageur/1.0 (Compas, preparation de voyage)';

async function overpass(query: string): Promise<unknown | null> {
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': UA,
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: 'no-store',
      });
      if (!res.ok) {
        console.warn('[compas] points autour', new URL(url).host, res.status);
        continue;
      }
      return await res.json();
    } catch (err) {
      console.warn('[compas] points autour injoignable', new URL(url).host, err instanceof Error ? err.message : 'erreur');
    }
  }
  return null;
}

export async function lookupStagePois(points: readonly StagePoint[]): Promise<RoutePoi[]> {
  const places = distinctPlaces(points);
  if (!places.length) return [];
  const key = createHash('sha256')
    .update(places.map((p) => coordKey(p.lat, p.lon, 3)).join('|'))
    .digest('hex');
  const pois = await cached<RoutePoi[] | null>('place', `pois:v1:${key}`, TTL_S, async () => {
    const payload = await overpass(buildOverpassQuery(places));
    return payload == null ? null : parseOverpass(payload, places);
  });
  return pois ?? [];
}
