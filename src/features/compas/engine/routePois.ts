/**
 * Compas — points le long du parcours (lecture défensive, fonctions pures).
 *
 * Source : trail_pois (OpenStreetMap, ODbL) via `compas_route_pois`. Un point
 * sans nom reste sans nom : on affiche sa catégorie, jamais un nom inventé.
 */

export type RoutePoiCategory =
  | 'water'
  | 'refuge'
  | 'camping'
  | 'viewpoint'
  | 'peak'
  | 'parking'
  // Autour des étapes (OpenStreetMap via Overpass) : vivre sur place.
  | 'resto'
  | 'commerce'
  | 'sante'
  | 'hebergement'
  | 'transport'
  | 'toilets';

export interface RoutePoi {
  id: number;
  name: string | null;
  category: RoutePoiCategory;
  lat: number;
  lon: number;
  distanceM: number;
  elevationM: number | null;
}

export const ROUTE_POI_LABEL: Record<RoutePoiCategory, string> = {
  water: 'Point d’eau',
  refuge: 'Refuge ou abri',
  camping: 'Camping',
  viewpoint: 'Point de vue',
  peak: 'Sommet',
  parking: 'Parking',
  resto: 'Restaurant ou café',
  commerce: 'Commerce',
  sante: 'Pharmacie ou soins',
  hebergement: 'Hébergement',
  transport: 'Gare ou bus',
  toilets: 'Toilettes',
};

const CATEGORIES = new Set<string>(Object.keys(ROUTE_POI_LABEL));

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

export function parseRoutePois(rows: unknown): RoutePoi[] {
  if (!Array.isArray(rows)) return [];
  const out: RoutePoi[] = [];
  for (const row of rows as Array<Record<string, unknown>>) {
    const id = num(row?.id);
    const lat = num(row?.lat);
    const lon = num(row?.lon);
    const category = typeof row?.category === 'string' ? row.category : '';
    if (id == null || lat == null || lon == null || !CATEGORIES.has(category)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    const name = typeof row.name === 'string' && row.name.trim() ? row.name.trim() : null;
    out.push({
      id,
      name,
      category: category as RoutePoiCategory,
      lat,
      lon,
      distanceM: Math.round(num(row.distance_m) ?? 0),
      elevationM: num(row.elevation_m) != null ? Math.round(num(row.elevation_m) as number) : null,
    });
  }
  return out;
}

export function countByCategory(pois: RoutePoi[]): Record<RoutePoiCategory, number> {
  const counts = Object.fromEntries(
    (Object.keys(ROUTE_POI_LABEL) as RoutePoiCategory[]).map((c) => [c, 0])
  ) as Record<RoutePoiCategory, number>;
  for (const p of pois) counts[p.category] += 1;
  return counts;
}

export const poiLabel = (p: RoutePoi) => p.name ?? ROUTE_POI_LABEL[p.category];
