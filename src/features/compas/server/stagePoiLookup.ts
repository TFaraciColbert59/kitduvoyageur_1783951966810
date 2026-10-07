import 'server-only';
import { createHash } from 'node:crypto';
import {
  buildOverpassQuery,
  distinctPlaces,
  overpassUsable,
  parseOverpass,
  type StagePoint,
} from '../engine/stagePois';
import type { RoutePoi } from '../engine/routePois';
import { buildAreaQuery, parseAreaPlaces, type AreaPlace, type AreaQuery } from '../engine/itinerary';
import { cached, coordKey, readShared } from './sharedCache';

/**
 * Points utiles autour des étapes, depuis OpenStreetMap (Overpass). Partagés
 * une semaine entre tous (cache Supabase) : un même village n'est demandé
 * qu'une fois au service public. Panne → liste vide, jamais un point inventé.
 */

const TTL_S = 7 * 86_400;
const TIMEOUT_MS = 12_000;
/** Une fonction Vercel s'arrête à 60 s : un appel ne cherche jamais plus de ~30 s. */
const BUDGET_MS = 28_000;
/** Instances publiques, essayées dans l'ordre (la première qui répond). */
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const UA = 'kitduvoyageur/1.0 (Compas, preparation de voyage)';

async function overpass(query: string, deadline: number, timeoutMs = TIMEOUT_MS): Promise<unknown | null> {
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
        signal: AbortSignal.timeout(Math.min(timeoutMs, left)),
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

const keyOf = (place: StagePoint) => `pois:v2:${coordKey(place.lat, place.lon, 3)}`;

/** Points autour d'UN lieu, partagés une semaine (même village, tous les voyages). */
async function poisAround(place: StagePoint, deadline: number): Promise<RoutePoi[] | null> {
  return cached<RoutePoi[] | null>('place', keyOf(place), TTL_S, async () => {
    const payload = await overpass(buildOverpassQuery(place), deadline);
    if (!overpassUsable(payload)) {
      if (payload) console.warn('[compas] points autour : réponse coupée', (payload as { remark?: unknown }).remark);
      return null; // jamais gardé : on réessaiera
    }
    return parseOverpass(payload, [place]);
  });
}

/** Lieux cherchés sur le réseau par appel : chaque appel reste court, l'écran enchaîne. */
const FRESH_PER_CALL = 2;

/**
 * Lieux déjà connus : servis du cache aussitôt. Lieux nouveaux : deux au plus
 * par appel (une fonction Vercel s'arrête à 60 s). `partial` : il en reste,
 * l'écran redemande et les points s'ajoutent au fil des appels.
 */
export async function lookupStagePois(
  points: readonly StagePoint[]
): Promise<{ pois: RoutePoi[]; partial: boolean }> {
  const places = distinctPlaces(points);
  if (!places.length) return { pois: [], partial: false };
  const known = await Promise.all(places.map((p) => readShared<RoutePoi[] | null>('place', keyOf(p))));
  const fresh = places.filter((_, i) => known[i] == null);
  const now = fresh.slice(0, FRESH_PER_CALL);
  const deadline = Date.now() + BUDGET_MS;
  const found = await Promise.all(now.map((p) => poisAround(p, deadline)));
  const out: RoutePoi[] = [];
  for (const list of [...known, ...found])
    for (const p of list ?? []) if (!out.some((q) => q.id === p.id)) out.push(p);
  return { pois: out, partial: fresh.length > now.length || found.some((l) => l == null) };
}

/**
 * Lieux réels où l'on peut dormir dans une zone (villes, villages, hameaux,
 * refuges), pour l'itinéraire déterministe. Partagés un mois (une zone ne
 * change pas). Liste vide ou réponse coupée : jamais gardée, null.
 */
export async function lookupAreaPlaces(q: AreaQuery, deadline: number): Promise<AreaPlace[] | null> {
  const query = buildAreaQuery(q);
  const key = `area:v1:${createHash('sha256').update(query).digest('hex').slice(0, 32)}`;
  return cached<AreaPlace[] | null>(
    'place',
    key,
    30 * 86_400,
    async () => {
      // Requête de zone plus lourde qu'un point : 20 s par instance.
      const payload = await overpass(query, deadline, 20_000);
      if (!overpassUsable(payload)) {
        console.warn('[compas] lieux de la zone indisponibles', q.activity, q.radiusKm, payload ? 'réponse coupée' : 'injoignable');
        return null;
      }
      const places = parseAreaPlaces(payload);
      return places.length ? places : null;
    },
    (v) => Array.isArray(v) && v.length > 0
  );
}
