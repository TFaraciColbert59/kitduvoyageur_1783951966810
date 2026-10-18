import 'server-only';
import { createHash } from 'node:crypto';
import {
  buildOverpassQuery,
  distinctPlaces,
  overpassUsable,
  parseOverpass,
  STAGE_POI_PER_CATEGORY,
  type StagePoint,
} from '../engine/stagePois';
import type { RoutePoi } from '../engine/routePois';
import { geoapifyArea, geoapifyAvailable } from './geoapify';
import { referentialAreaPlaces } from './geoPlaces';
import { referentialPoisAround } from './geoPois';
import { geoSitesEnabled, referentialSitesAround } from './geoSites';
import { GEO_POI_CATEGORIES } from '../engine/geoPois';
import { photonSlot } from '@/lib/siteSlot';
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
import { chainRiver, parseRiverWays, riverNamePattern, riverQuery } from '../engine/river';
import { simplifyLine, type LngLat } from '../engine/track';
import { appUserAgent } from '@/lib/userAgent';
import { OVERPASS_ENDPOINTS, overpassPost, serializeOverpass } from '@/lib/overpass';
import { getRequestLocale } from '@/lib/i18n/serverLocale';
import { languageCacheKey, photonLang } from './mapLanguage';

/**
 * Points utiles autour des étapes, depuis OpenStreetMap (Overpass). Partagés
 * une semaine entre tous (cache Supabase) : un même village n'est demandé
 * qu'une fois au service public. Panne → liste vide, jamais un point inventé.
 */

const TTL_S = 7 * 86_400;
const TIMEOUT_MS = 12_000;
/** Un appel ne cherche jamais plus de ~30 s : l'écran attend la réponse. */
const BUDGET_MS = 28_000;
/**
 * Un seul serveur Overpass, une requête à la fois : la règle est celle du site
 * entier (`@/lib/overpass` : private.coffee, le seul qui autorise l'usage
 * commercial ; file unique de l'instance), partagée avec « Partir librement »,
 * l'explorateur OSM et les points d'eau des voyages. Ré-exporté ici pour le
 * garde `overpassEndpoints.test.ts`.
 */
export { OVERPASS_ENDPOINTS };
const UA = appUserAgent('Compas, preparation de voyage');

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
 * Tous les appels Overpass de cette instance passent un par un par la file du
 * site (`serializeOverpass`) : `lookupStagePois` cherche deux lieux en même
 * temps, et le délai de chaque requête ne court qu'à son tour.
 */
function overpass(query: string, deadline: number, timeoutMs = TIMEOUT_MS): Promise<unknown | null> {
  return serializeOverpass(() => overpassNow(query, deadline, timeoutMs)).catch(() => null);
}

async function overpassNow(query: string, deadline: number, timeoutMs: number): Promise<unknown | null> {
  const left = deadline - Date.now();
  if (left < 3000) return null;
  const host = new URL(OVERPASS_ENDPOINTS[0]).host;
  try {
    const res = await overpassPost(query, { userAgent: UA, signal: AbortSignal.timeout(Math.min(timeoutMs, left)) });
    if (!res.ok) {
      console.warn('[compas] points autour', host, res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn('[compas] points autour injoignable', host, err instanceof Error ? err.message : 'erreur');
    return null;
  }
}

const keyOf = (place: StagePoint) => `pois:v2:${coordKey(place.lat, place.lon, 3)}`;

/**
 * Points autour d'UN lieu, partagés une semaine (même village, tous les voyages).
 * `complete` faux : Overpass n'a pas répondu ; `pois` garde alors ce que le référentiel
 * a déjà donné (rien n'est mis en cache, l'appel suivant redemande le reste).
 */
async function poisAround(place: StagePoint, deadline: number): Promise<{ pois: RoutePoi[] | null; complete: boolean }> {
  let fallback: RoutePoi[] | null = null;
  const pois = await cached<RoutePoi[] | null>('place', keyOf(place), TTL_S, async () => {
    // Refuges, campings et points d'eau : le référentiel d'abord (plan 3.4, interrupteur
    // `COMPAS_GEO_POIS`, éteint par défaut). Null = éteint, base muette ou zone non importée :
    // Overpass donne alors tout, comme avant.
    const ref = await referentialPoisAround(place);
    const payload = await overpass(buildOverpassQuery(place, undefined, undefined, ref ? GEO_POI_CATEGORIES : undefined), deadline);
    if (!overpassUsable(payload)) {
      if (payload) console.warn('[compas] points autour : réponse coupée', (payload as { remark?: unknown }).remark);
      // Panne d'Overpass : le référentiel reste montré (constat Codex, PR #93), jamais gardé : on réessaiera.
      fallback = ref;
      return null;
    }
    const found = parseOverpass(payload, [place]);
    if (!ref) return found;
    const refIds = new Set(ref.map((p) => p.id));
    return [...ref, ...found.filter((p) => !GEO_POI_CATEGORIES.has(p.category) && !refIds.has(p.id))];
  });
  return pois ? { pois, complete: true } : { pois: fallback, complete: false };
}

/** Rayon des via ferrata autour d'une étape : l'accès d'une journée depuis la base (une remontée, une route). */
export const VIA_FERRATA_RADIUS_M = 10_000;
/** Rayon des gares de remontée autour d'une étape de ski : celles qu'on rejoint à pied ou en navette. */
export const AERIALWAY_STATION_RADIUS_M = 5_000;

/**
 * Sites du référentiel `geo_sites` autour des étapes (plan 3.5), une nature par activité : via ferrata
 * pour un voyage d'escalade (« Dolomites via ferrata », la demande est rangée sous l'escalade), gares
 * de remontée nommées pour un voyage de ski (raquettes comprises). Lus à chaque appel, hors du cache
 * partagé des points (il ne dépend pas de l'activité). Interrupteur éteint, base muette, zone non
 * couverte : aucun (les points d'avant, exactement). Altitude absente d'OSM : laissée absente.
 */
async function sitePoisAround(
  places: readonly StagePoint[],
  kind: 'via_ferrata' | 'aerialway_station',
  radiusM: number
): Promise<RoutePoi[]> {
  if (!geoSitesEnabled()) return [];
  const lists = await Promise.all(
    places.map((p) => referentialSitesAround(p, radiusM, [kind]).catch(() => null))
  );
  const out: RoutePoi[] = [];
  for (const list of lists)
    for (const s of (list ?? []).slice(0, STAGE_POI_PER_CATEGORY)) {
      const id = Number(s.osm_id.slice(1));
      if (!Number.isFinite(id) || out.some((q) => q.id === id && q.category === kind)) continue;
      out.push({
        id,
        name: s.name,
        category: kind,
        lat: s.lat,
        lon: s.lon,
        distanceM: Math.round(s.distance_km * 1000),
        elevationM: s.ele_m != null ? Math.round(s.ele_m) : null,
      });
    }
  return out;
}

/** Lieux cherchés sur le réseau par appel : chaque appel reste court, l'écran enchaîne. */
const FRESH_PER_CALL = 2;

/**
 * Lieux déjà connus : servis du cache aussitôt. Lieux nouveaux : deux au plus
 * par appel (l'écran attend la réponse). `partial` : il en reste,
 * l'écran redemande et les points s'ajoutent au fil des appels.
 */
export async function lookupStagePois(
  points: readonly StagePoint[],
  /** L'activité du voyage : l'escalade ajoute les via ferrata du référentiel, le ski les gares de remontée (plan 3.5). */
  opts?: { activity?: string | null }
): Promise<{ pois: RoutePoi[]; partial: boolean }> {
  const places = distinctPlaces(points);
  if (!places.length) return { pois: [], partial: false };
  const known = await Promise.all(places.map((p) => readShared<RoutePoi[] | null>('place', keyOf(p))));
  const fresh = places.filter((_, i) => known[i] == null);
  const now = fresh.slice(0, FRESH_PER_CALL);
  const deadline = Date.now() + BUDGET_MS;
  const found = await Promise.all(now.map((p) => poisAround(p, deadline)));
  const out: RoutePoi[] = [];
  for (const list of [...known, ...found.map((f) => f.pois)])
    for (const p of list ?? []) if (!out.some((q) => q.id === p.id)) out.push(p);
  const sites =
    opts?.activity === 'climbing'
      ? await sitePoisAround(places, 'via_ferrata', VIA_FERRATA_RADIUS_M)
      : opts?.activity === 'ski'
        ? await sitePoisAround(places, 'aerialway_station', AERIALWAY_STATION_RADIUS_M)
        : [];
  for (const p of sites) if (!out.some((q) => q.id === p.id && q.category === p.category)) out.push(p);
  return { pois: out, partial: fresh.length > now.length || found.some((f) => !f.complete) };
}

/**
 * Points autour des étapes DÉJÀ connus (cache partagé), sans aucune requête au service
 * public : pour dire ce que la zone montre (gare, gare routière…) sans rien attendre.
 * `complete` : tous les lieux d'étape (huit au plus) ont été lus.
 */
export async function readCachedStagePois(points: readonly StagePoint[]): Promise<{ pois: RoutePoi[]; complete: boolean }> {
  const places = distinctPlaces(points);
  if (!places.length) return { pois: [], complete: false };
  const known = await Promise.all(places.map((p) => readShared<RoutePoi[] | null>('place', keyOf(p))));
  return { pois: known.flatMap((l) => l ?? []), complete: known.every((l) => l != null) };
}

/** Photon : lieux d'une emprise par catégorie, sans quota strict (OpenStreetMap). */
async function photonArea(
  bbox: [number, number, number, number],
  include: string,
  signal: AbortSignal,
  lang: string
): Promise<AreaPlace[]> {
  // Créneau du site (plan 1.3) : les tuiles d'une zone partent en parallèle,
  // mais jamais plus de trois requêtes Photon par seconde pour tout le site.
  if (!(await photonSlot())) throw new Error('photon créneau plein');
  const url = `https://photon.komoot.io/api/?limit=50&lang=${photonLang(lang)}&include=${include}&bbox=${bbox.map((v) => v.toFixed(4)).join(',')}`;
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA }, signal, cache: 'no-store' });
  if (!res.ok) throw new Error(`photon ${res.status}`);
  return parsePhotonArea(await res.json());
}

/**
 * Toutes les tuiles de la zone (lieux habités) + abris à part (moins connus,
 * sinon noyés). `sheltersOnly` : les abris seulement (le référentiel a déjà
 * les lieux habités).
 */
async function photonAreaPlaces(q: AreaQuery, timeoutMs: number, lang: string, sheltersOnly = false): Promise<AreaPlace[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { places, shelters } = photonIncludes(areaKinds(q));
    const tiles = areaTiles(q.center, Math.min(q.radiusKm, 400));
    const jobs = sheltersOnly || !places ? [] : tiles.map((t) => photonArea(t, places, controller.signal, lang));
    if (shelters) jobs.push(...areaTiles(q.center, Math.min(q.radiusKm, 60)).map((t) => photonArea(t, shelters, controller.signal, lang)));
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
  const query = riverQuery(pattern, extent);
  if (!query) return null;
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
  // Noms dans la langue de l'interface (PLAN-100 6.4) : clé française d'avant, à l'identique.
  const lang = await getRequestLocale();
  const key = languageCacheKey(`area:v3:${createHash('sha256').update(query).digest('hex').slice(0, 32)}`, lang);
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
        const shelters = await photonAreaPlaces(q, Math.min(8000, left()), lang, true);
        say(shelters ? `Photon (abris) ${shelters.length}` : 'Photon (abris) muet');
        return withRef(shelters);
      }
      if (left() < 4000) {
        say('plus de temps');
        return fromRef;
      }
      const fromPhoton = await photonAreaPlaces(q, Math.min(10_000, left()), lang);
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
        geoapifyArea(q, Math.min(10_000, budget), lang),
      ]);
      const places = payload ? parseAreaPlaces(payload, lang) : [];
      say(payload ? `Overpass ${places.length}` : 'Overpass muet');
      say(!geoapifyAvailable() ? 'Geoapify sans clé' : fromGeoapify ? `Geoapify ${fromGeoapify.length}` : 'Geoapify muet');
      if (places.length) return withRef(places);
      return withRef(fromGeoapify && fromGeoapify.length > (fromPhoton?.length ?? 0) ? fromGeoapify : fromPhoton);
    },
    (v) => Array.isArray(v) && v.length > 0
  );
}
