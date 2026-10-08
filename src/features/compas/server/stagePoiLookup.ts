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
import { geoapifyArea, geoapifyAvailable } from './geoapify';
import { referentialAreaPlaces } from './geoPlaces';
import { mergeReferential, referentialEnough } from '../engine/geoPlaces';
import {
  areaKinds,
  areaTiles,
  buildAreaQuery,
  mergeAreaPlaces,
  parseAreaPlaces,
  parsePhotonArea,
  photonIncludes,
  type AreaPlace,
  type AreaQuery,
} from '../engine/itinerary';
import { cached, coordKey, readShared } from './sharedCache';
import { chainRiver, parseRiverWays, riverNamePattern } from '../engine/river';
import { simplifyLine, type LngLat } from '../engine/track';

/**
 * Points utiles autour des étapes, depuis OpenStreetMap (Overpass). Partagés
 * une semaine entre tous (cache Supabase) : un même village n'est demandé
 * qu'une fois au service public. Panne → liste vide, jamais un point inventé.
 */

const TTL_S = 7 * 86_400;
const TIMEOUT_MS = 12_000;
/** Une fonction Vercel s'arrête à 60 s : un appel ne cherche jamais plus de ~30 s. */
const BUDGET_MS = 28_000;
/**
 * Un seul serveur Overpass : private.coffee, le seul qui autorise l'usage
 * commercial (« including commercial use », vérifié le 8 octobre,
 * `docs/compas/SERVICES-GRATUITS.md`). overpass-api.de et ses miroirs renvoient
 * les usages commerciaux vers leurs propres serveurs. L'opérateur demande
 * d'éviter les requêtes simultanées : une à la fois, jamais en course.
 */
export const OVERPASS_ENDPOINTS = ['https://overpass.private.coffee/api/interpreter'] as const;
const UA = 'kitduvoyageur/1.0 (Compas, preparation de voyage; koosmoweb.fr)';

/** Lieux d'une zone : le même serveur, une requête, une seule réponse attendue. Rien → null. */
async function overpassArea(query: string, timeoutMs: number): Promise<unknown | null> {
  const payload = await overpass(query, Date.now() + timeoutMs, timeoutMs);
  if (payload && !overpassUsable(payload)) {
    console.warn('[compas] lieux de la zone : réponse coupée');
    return null;
  }
  if (!payload) console.warn('[compas] lieux de la zone : Overpass sans réponse');
  return payload;
}

/**
 * File d'attente unique : tous les appels Overpass de cette instance passent
 * un par un (l'opérateur de private.coffee demande d'éviter les requêtes
 * simultanées ; `lookupStagePois` cherchait deux lieux en même temps).
 */
let overpassChain: Promise<unknown> = Promise.resolve();

function overpass(query: string, deadline: number, timeoutMs = TIMEOUT_MS): Promise<unknown | null> {
  const run = overpassChain.then(() => overpassNow(query, deadline, timeoutMs));
  overpassChain = run.catch(() => null);
  return run;
}

async function overpassNow(query: string, deadline: number, timeoutMs: number): Promise<unknown | null> {
  for (const url of OVERPASS_ENDPOINTS) {
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

/** Photon : lieux d'une emprise par catégorie, sans quota strict (OpenStreetMap). */
async function photonArea(bbox: [number, number, number, number], include: string, signal: AbortSignal): Promise<AreaPlace[]> {
  const url = `https://photon.komoot.io/api/?limit=50&lang=fr&include=${include}&bbox=${bbox.map((v) => v.toFixed(4)).join(',')}`;
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA }, signal, cache: 'no-store' });
  if (!res.ok) throw new Error(`photon ${res.status}`);
  return parsePhotonArea(await res.json());
}

/**
 * Toutes les tuiles de la zone (lieux habités) + abris à part (moins connus,
 * sinon noyés). `sheltersOnly` : les abris seulement (le référentiel a déjà
 * les lieux habités).
 */
async function photonAreaPlaces(q: AreaQuery, timeoutMs: number, sheltersOnly = false): Promise<AreaPlace[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { places, shelters } = photonIncludes(areaKinds(q));
    const tiles = areaTiles(q.center, Math.min(q.radiusKm, 400));
    const jobs = sheltersOnly || !places ? [] : tiles.map((t) => photonArea(t, places, controller.signal));
    if (shelters) jobs.push(...areaTiles(q.center, Math.min(q.radiusKm, 60)).map((t) => photonArea(t, shelters, controller.signal)));
    const lists = await Promise.all(jobs);
    const merged = mergeAreaPlaces(lists);
    return merged.length ? merged : null;
  } catch (err) {
    console.warn('[compas] lieux de la zone (Photon)', err instanceof Error ? err.message : 'erreur');
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tracé d'une rivière (tronçons OSM bout à bout, de l'amont vers l'aval) dans
 * son emprise, pour une descente en canoë. Partagé un mois ; rien → null.
 */
export async function lookupRiverLine(
  name: string,
  extent: [number, number, number, number],
  deadline: number
): Promise<LngLat[] | null> {
  // Avec ou sans article : OSM écrit « La Dordogne », la demande « Dordogne »
  // (le nom exact ne trouvait rien : Périgueux et Sarlat, loin de l'eau, 8 oct.).
  const pattern = riverNamePattern(name);
  if (!pattern) return null;
  const [w, north, e, south] = extent;
  const bbox = `${Math.min(south, north).toFixed(3)},${Math.min(w, e).toFixed(3)},${Math.max(south, north).toFixed(3)},${Math.max(w, e).toFixed(3)}`;
  const query = `[out:json][timeout:25];(way["waterway"="river"]["name"~"${pattern}",i](${bbox});way["waterway"="river"]["name:fr"~"${pattern}",i](${bbox}););out geom;`;
  const key = `river:v1:${createHash('sha256').update(query).digest('hex').slice(0, 32)}`;
  return cached<LngLat[] | null>(
    'place',
    key,
    30 * 86_400,
    async () => {
      const left = deadline - Date.now();
      if (left < 5000) return null;
      const payload = await overpassArea(query, Math.min(20_000, left));
      const line = payload ? chainRiver(parseRiverWays(payload)) : [];
      // ~1 point par 300 m sur une grande rivière : assez fin pour placer les soirs.
      return line.length >= 2 ? simplifyLine(line, 1500) : null;
    },
    (v) => Array.isArray(v) && v.length >= 2
  );
}

/**
 * Lieux réels où l'on peut dormir dans une zone (villes, villages, hameaux,
 * refuges), pour l'itinéraire déterministe. Le référentiel d'abord (plan 3.2,
 * `geo_places`, sans carte en ligne) ; Photon n'est alors demandé que pour les
 * refuges et campings. Référentiel trop maigre : Photon, puis Overpass et
 * Geoapify en secours, complétés par le référentiel. Partagés un mois (une
 * zone ne change pas). Rien trouvé : jamais gardé, null.
 */
export async function lookupAreaPlaces(
  q: AreaQuery,
  deadline: number,
  /** Ce que chaque carte a répondu (écrit dans la note d'un repli, pour le diagnostic). */
  diag?: string[]
): Promise<AreaPlace[] | null> {
  const query = buildAreaQuery(q);
  // « v3 » : le référentiel d'abord (les zones déjà gardées venaient de Photon seul).
  const key = `area:v3:${createHash('sha256').update(query).digest('hex').slice(0, 32)}`;
  const say = (s: string) => diag?.push(s);
  return cached<AreaPlace[] | null>(
    'place',
    key,
    30 * 86_400,
    async () => {
      const left = () => deadline - Date.now();
      if (left() < 4000) {
        say('plus de temps');
        return null;
      }
      const fromRef = await referentialAreaPlaces(q);
      say(fromRef ? `Référentiel ${fromRef.length}` : 'Référentiel vide');
      const withRef = (list: AreaPlace[] | null) => (fromRef ? mergeReferential(fromRef, list ?? []) : list);
      if (fromRef && referentialEnough(fromRef)) {
        const wantsShelters = areaKinds(q).some((k) => k === 'hut' || k === 'camp');
        if (!wantsShelters || left() < 4000) return fromRef;
        // Refuges et campings : absents de GeoNames, seuls demandés à la carte en ligne.
        const shelters = await photonAreaPlaces(q, Math.min(8000, left()), true);
        say(shelters ? `Photon (abris) ${shelters.length}` : 'Photon (abris) muet');
        return withRef(shelters);
      }
      if (left() < 4000) {
        say('plus de temps');
        return fromRef;
      }
      const fromPhoton = await photonAreaPlaces(q, Math.min(10_000, left()));
      say(fromPhoton ? `Photon ${fromPhoton.length}` : 'Photon muet');
      if (fromPhoton && fromPhoton.length >= 3) return withRef(fromPhoton);
      if (left() < 4000) {
        say('plus de temps');
        return withRef(fromPhoton);
      }
      // Photon trop maigre : Overpass et Geoapify en même temps (Overpass est
      // souvent muet depuis Vercel ; l'attendre d'abord privait Geoapify de temps).
      const budget = Math.min(15_000, left());
      const [payload, fromGeoapify] = await Promise.all([
        overpassArea(query, budget),
        geoapifyArea(q, Math.min(10_000, budget)),
      ]);
      const places = payload ? parseAreaPlaces(payload) : [];
      say(payload ? `Overpass ${places.length}` : 'Overpass muet');
      say(!geoapifyAvailable() ? 'Geoapify sans clé' : fromGeoapify ? `Geoapify ${fromGeoapify.length}` : 'Geoapify muet');
      if (places.length) return withRef(places);
      return withRef(fromGeoapify && fromGeoapify.length > (fromPhoton?.length ?? 0) ? fromGeoapify : fromPhoton);
    },
    (v) => Array.isArray(v) && v.length > 0
  );
}
