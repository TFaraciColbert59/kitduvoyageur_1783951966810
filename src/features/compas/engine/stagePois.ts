/**
 * Compas — points utiles autour des étapes (fonctions pures, testées).
 *
 * Source : OpenStreetMap (ODbL) via Overpass, pour TOUT itinéraire (pas
 * seulement les parcours du catalogue) : où manger, faire ses courses, se
 * soigner, boire, dormir, prendre un bus. Un point sans nom garde sa
 * catégorie pour nom, jamais un nom inventé.
 */

import { distanceKm } from './places';
import type { RoutePoi, RoutePoiCategory } from './routePois';

/** Rayon de recherche autour d'une étape (le village et ses abords). */
export const STAGE_POI_RADIUS_M = 1500;
/** Étapes cherchées au plus (une requête, sans abuser du service public). */
export const STAGE_POI_MAX_PLACES = 8;
/** Points gardés au plus par catégorie et par étape, les plus proches d'abord. */
export const STAGE_POI_PER_CATEGORY = 6;

/** Filtres OpenStreetMap par catégorie (clé=valeurs). */
const FILTERS: Array<{ category: RoutePoiCategory; key: string; values: string }> = [
  { category: 'resto', key: 'amenity', values: 'restaurant|cafe|fast_food|pub|bar|food_court' },
  { category: 'commerce', key: 'shop', values: 'supermarket|convenience|bakery|outdoor|sports|greengrocer|butcher|deli' },
  { category: 'sante', key: 'amenity', values: 'pharmacy|hospital|clinic|doctors' },
  { category: 'water', key: 'amenity', values: 'drinking_water|water_point' },
  { category: 'water', key: 'natural', values: 'spring' },
  { category: 'hebergement', key: 'tourism', values: 'hotel|guest_house|hostel|motel|chalet|apartment' },
  { category: 'refuge', key: 'tourism', values: 'alpine_hut|wilderness_hut' },
  { category: 'refuge', key: 'amenity', values: 'shelter' },
  { category: 'camping', key: 'tourism', values: 'camp_site|caravan_site' },
  { category: 'transport', key: 'railway', values: 'station|halt' },
  { category: 'transport', key: 'amenity', values: 'bus_station|ferry_terminal' },
  { category: 'toilets', key: 'amenity', values: 'toilets' },
  { category: 'viewpoint', key: 'tourism', values: 'viewpoint' },
  { category: 'peak', key: 'natural', values: 'peak' },
  { category: 'parking', key: 'amenity', values: 'parking' },
];

export interface StagePoint {
  lat: number;
  lon: number;
}

/** Les lieux d'étape distincts (deux soirs au même village : un seul lieu). */
export function distinctPlaces(points: readonly StagePoint[], minKm = 2): StagePoint[] {
  const out: StagePoint[] = [];
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
    if (Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) continue;
    if (out.some((q) => distanceKm(p, q) < minKm)) continue;
    out.push({ lat: Math.round(p.lat * 1e5) / 1e5, lon: Math.round(p.lon * 1e5) / 1e5 });
    if (out.length >= STAGE_POI_MAX_PLACES) break;
  }
  return out;
}

/** Requête Overpass : chaque catégorie autour de chaque lieu, en une fois. */
export function buildOverpassQuery(places: readonly StagePoint[], radiusM = STAGE_POI_RADIUS_M): string {
  const parts: string[] = [];
  for (const p of places)
    for (const f of FILTERS)
      parts.push(`nwr["${f.key}"~"^(${f.values})$"](around:${radiusM},${p.lat},${p.lon});`);
  return `[out:json][timeout:20];(${parts.join('')});out center tags 1500;`;
}

/** Catégorie d'un objet OpenStreetMap (null : rien d'utile pour le Compas). */
export function poiCategoryOf(tags: Record<string, unknown>): RoutePoiCategory | null {
  for (const f of FILTERS) {
    const v = tags[f.key];
    if (typeof v === 'string' && new RegExp(`^(${f.values})$`).test(v)) return f.category;
  }
  return null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/**
 * Réponse Overpass → points rangés : catégorie connue, position valide, au
 * plus `perCategory` par catégorie et par lieu (les plus proches), distance à
 * l'étape la plus proche, doublons (même nom, même catégorie, < 60 m) retirés.
 */
export function parseOverpass(
  payload: unknown,
  places: readonly StagePoint[],
  perCategory = STAGE_POI_PER_CATEGORY
): RoutePoi[] {
  const elements =
    payload && typeof payload === 'object' && Array.isArray((payload as { elements?: unknown }).elements)
      ? ((payload as { elements: unknown[] }).elements as Array<Record<string, unknown>>)
      : [];
  if (!places.length) return [];
  const found: Array<RoutePoi & { place: number }> = [];
  for (const el of elements) {
    const tags = (el.tags && typeof el.tags === 'object' ? el.tags : {}) as Record<string, unknown>;
    const category = poiCategoryOf(tags);
    if (!category) continue;
    const center = (el.center && typeof el.center === 'object' ? el.center : {}) as Record<string, unknown>;
    const lat = num(el.lat) ?? num(center.lat);
    const lon = num(el.lon) ?? num(center.lon);
    const id = num(el.id);
    if (lat == null || lon == null || id == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    let place = 0;
    let best = Infinity;
    places.forEach((p, i) => {
      const d = distanceKm(p, { lat, lon });
      if (d < best) {
        best = d;
        place = i;
      }
    });
    const rawName = typeof tags.name === 'string' ? tags.name.trim() : '';
    const ele = num(tags.ele);
    found.push({
      id,
      name: rawName ? rawName.slice(0, 80) : null,
      category,
      lat,
      lon,
      distanceM: Math.round(best * 1000),
      elevationM: ele != null ? Math.round(ele) : null,
      place,
    });
  }
  found.sort((a, b) => a.distanceM - b.distanceM);
  const out: RoutePoi[] = [];
  const perKey = new Map<string, number>();
  for (const p of found) {
    if (
      out.some(
        (q) =>
          q.id === p.id ||
          (q.category === p.category && p.name != null && q.name === p.name && distanceKm(q, p) < 0.06)
      )
    )
      continue;
    const key = `${p.place}:${p.category}`;
    const n = perKey.get(key) ?? 0;
    if (n >= perCategory) continue;
    perKey.set(key, n + 1);
    const { place: _place, ...poi } = p;
    void _place;
    out.push(poi);
  }
  return out;
}

/**
 * Ajoute les points autour des étapes à ceux du tracé, sans doublon (même
 * catégorie à moins de 60 m), et en fait des points de carte (`o-…`).
 */
export function mergeStagePois<
  P extends { id: string; lat: number; lon: number; label: string; category: string | null; kind: 'step' | 'poi' },
>(
  routePois: readonly RoutePoi[],
  points: readonly P[],
  stagePois: readonly RoutePoi[],
  label: (p: RoutePoi) => string
): { routePois: RoutePoi[]; points: Array<P | { id: string; lat: number; lon: number; label: string; category: string; kind: 'poi' }> } {
  const extra = stagePois.filter(
    (p) => !routePois.some((q) => q.category === p.category && distanceKm(p, q) < 0.06)
  );
  return {
    routePois: [...routePois, ...extra],
    points: [
      ...points,
      ...extra.map((p) => ({
        id: `o-${p.id}`,
        lat: p.lat,
        lon: p.lon,
        label: label(p),
        category: p.category,
        kind: 'poi' as const,
      })),
    ],
  };
}
