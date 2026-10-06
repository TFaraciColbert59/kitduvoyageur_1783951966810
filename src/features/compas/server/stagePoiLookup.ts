import 'server-only';
import {
  buildOverpassQuery,
  distinctPlaces,
  overpassUsable,
  parseOverpass,
  type StagePoint,
} from '../engine/stagePois';
import type { RoutePoi } from '../engine/routePois';
import { cached, coordKey } from './sharedCache';

/**
 * Points utiles autour des étapes, depuis OpenStreetMap (Overpass). Partagés
 * une semaine entre tous (cache Supabase) : un même village n'est demandé
 * qu'une fois au service public. Panne → liste vide, jamais un point inventé.
 */

const TTL_S = 7 * 86_400;
const TIMEOUT_MS = 12_000;
/** Une fonction Vercel s'arrête à 60 s : on rend ce qu'on a avant, l'écran redemande la suite. */
const BUDGET_MS = 38_000;
/** Instances publiques, essayées dans l'ordre (la première qui répond). */
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const UA = 'kitduvoyageur/1.0 (Compas, preparation de voyage)';

async function overpass(query: string, deadline: number): Promise<unknown | null> {
  for (const url of ENDPOINTS) {
    const left = deadline - Date.now();
    if (left < 3000) break;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': UA,
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(Math.min(TIMEOUT_MS, left)),
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

/** Points autour d'UN lieu, partagés une semaine (même village, tous les voyages). */
async function poisAround(place: StagePoint, deadline: number): Promise<RoutePoi[] | null> {
  return cached<RoutePoi[] | null>('place', `pois:v2:${coordKey(place.lat, place.lon, 3)}`, TTL_S, async () => {
    const payload = await overpass(buildOverpassQuery(place), deadline);
    if (!overpassUsable(payload)) {
      if (payload) console.warn('[compas] points autour : réponse coupée', (payload as { remark?: unknown }).remark);
      return null; // jamais gardé : on réessaiera
    }
    return parseOverpass(payload, [place]);
  });
}

/**
 * `partial` : des lieux restent à chercher (temps écoulé, ou service muet) ;
 * l'écran redemande, les lieux déjà trouvés reviennent du cache aussitôt.
 */
export async function lookupStagePois(
  points: readonly StagePoint[]
): Promise<{ pois: RoutePoi[]; partial: boolean }> {
  const places = distinctPlaces(points);
  if (!places.length) return { pois: [], partial: false };
  const deadline = Date.now() + BUDGET_MS;
  const out: RoutePoi[] = [];
  let partial = false;
  // Deux à la fois au plus : le service public limite les requêtes simultanées.
  for (let i = 0; i < places.length; i += 2) {
    if (deadline - Date.now() < 4000) {
      partial = true;
      break;
    }
    const batch = await Promise.all(places.slice(i, i + 2).map((p) => poisAround(p, deadline)));
    for (const list of batch) {
      if (list == null) partial = true;
      for (const p of list ?? []) if (!out.some((q) => q.id === p.id)) out.push(p);
    }
  }
  return { pois: out, partial };
}
