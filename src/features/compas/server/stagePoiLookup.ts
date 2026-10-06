import 'server-only';
import {
  buildOverpassQuery,
  distinctPlaces,
  overpassUsable,
  parseOverpass,
  type StagePoint,
} from '../engine/stagePois';
import type { RoutePoi } from '../engine/routePois';
import { cached, coordKey, writeShared } from './sharedCache';

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

// DIAG TEMPORAIRE (à retirer) : dernier échec, lisible en base, 1 h.
const diag: string[] = [];
async function overpass(query: string): Promise<unknown | null> {
  diag.length = 0;
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
        diag.push(`${new URL(url).host} ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);
        continue;
      }
      return await res.json();
    } catch (err) {
      console.warn('[compas] points autour injoignable', new URL(url).host, err instanceof Error ? err.message : 'erreur');
      diag.push(`${new URL(url).host} ${err instanceof Error ? `${err.name}: ${err.message}` : 'erreur'}`);
    }
  }
  await writeShared('place', 'pois:diag', diag.slice(), 3600).catch(() => undefined);
  return null;
}

/** Points autour d'UN lieu, partagés une semaine (même village, tous les voyages). */
async function poisAround(place: StagePoint): Promise<RoutePoi[] | null> {
  return cached<RoutePoi[] | null>('place', `pois:v2:${coordKey(place.lat, place.lon, 3)}`, TTL_S, async () => {
    const payload = await overpass(buildOverpassQuery(place));
    if (!overpassUsable(payload)) {
      if (payload) {
        console.warn('[compas] points autour : réponse coupée', (payload as { remark?: unknown }).remark);
        await writeShared('place', 'pois:diag', [`remark ${String((payload as { remark?: unknown }).remark).slice(0, 300)}`], 3600).catch(() => undefined);
      }
      return null; // jamais gardé : on réessaiera
    }
    return parseOverpass(payload, [place]);
  });
}

export async function lookupStagePois(points: readonly StagePoint[]): Promise<RoutePoi[]> {
  const places = distinctPlaces(points);
  if (!places.length) return [];
  // Deux à la fois au plus : le service public limite les requêtes simultanées.
  const out: RoutePoi[] = [];
  for (let i = 0; i < places.length; i += 2) {
    const batch = await Promise.all(places.slice(i, i + 2).map((p) => poisAround(p)));
    for (const list of batch) for (const p of list ?? []) if (!out.some((q) => q.id === p.id)) out.push(p);
  }
  return out;
}
