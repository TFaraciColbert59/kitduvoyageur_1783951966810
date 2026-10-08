/**
 * Référentiel des lieux habités (plan 3.1 et 3.2) : `public.geo_places`,
 * GeoNames `cities500` pour le monde et tous les lieux habités de France,
 * Suisse, Italie et Autriche. Lu d'abord pour la zone d'une préparation ;
 * Photon et Overpass restent le secours, et la seule source des refuges et
 * campings (absents de GeoNames).
 *
 * Fonctions pures : emprise de la requête, lecture d'une ligne, fusion avec
 * les lieux d'une autre carte sans doublon.
 */
import type { AreaPlace, AreaPlaceKind, AreaQuery } from './itinerary';
import { distanceKm } from './places';

/** Pays où le référentiel contient TOUS les lieux habités (hameaux compris). */
export const DETAILED_COUNTRIES: ReadonlySet<string> = new Set(['FR', 'CH', 'IT', 'AT']);

/** Natures que le référentiel connaît (pas les refuges ni les campings). */
export const SETTLEMENT_KINDS: ReadonlySet<AreaPlaceKind> = new Set(['city', 'town', 'village', 'hamlet']);

/**
 * L'emprise [ouest, sud, est, nord] de la zone : celle de la carte quand elle
 * est connue (`extent` est [ouest, nord, est, sud]), sinon le carré du rayon
 * (400 km au plus, comme les autres cartes).
 */
export function areaBox(q: AreaQuery): [number, number, number, number] {
  if (q.extent) {
    const [w, a, e, b] = q.extent;
    return [Math.min(w, e), Math.min(a, b), Math.max(w, e), Math.max(a, b)];
  }
  const r = Math.min(Math.max(q.radiusKm, 1), 400);
  const dLat = r / 111;
  const dLon = r / (111 * Math.max(0.1, Math.cos((q.center.lat * Math.PI) / 180)));
  return [q.center.lon - dLon, q.center.lat - dLat, q.center.lon + dLon, q.center.lat + dLat];
}

export interface GeoPlaceRow {
  geoname_id: number;
  name: string;
  kind: string;
  country_code: string;
  lat: number;
  lon: number;
  ele_m: number | null;
  population: number | null;
}

/** Une ligne du référentiel en lieu de zone ; null si elle est inexploitable. */
export function geoPlaceToArea(row: GeoPlaceRow): AreaPlace | null {
  const kind = row.kind as AreaPlaceKind;
  if (!SETTLEMENT_KINDS.has(kind)) return null;
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  if (!name || !Number.isFinite(row.lat) || !Number.isFinite(row.lon)) return null;
  return {
    id: `g${row.geoname_id}`,
    name,
    lat: row.lat,
    lon: row.lon,
    kind,
    population: row.population && row.population > 0 ? row.population : null,
    eleM: row.ele_m ?? null,
    countryCode: row.country_code || null,
  };
}

/**
 * Le référentiel suffit-il pour la zone ? Dans un pays détaillé, trois lieux
 * disent déjà ce qu'il y a (tous les hameaux y sont). Ailleurs, `cities500`
 * oublie les plus petits lieux : il en faut une douzaine, sinon Photon complète.
 */
export function referentialEnough(places: readonly AreaPlace[]): boolean {
  if (places.length === 0) return false;
  const detailed = places.filter((p) => p.countryCode && DETAILED_COUNTRIES.has(p.countryCode)).length;
  return detailed * 2 >= places.length ? places.length >= 3 : places.length >= 12;
}

const plain = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Le référentiel d'abord, puis les lieux d'une autre carte qui n'y sont pas
 * déjà : même nom à moins de 3 km, ou un autre lieu habité à moins de 300 m,
 * c'est le même endroit. Refuges et campings passent toujours (le référentiel
 * n'en a pas).
 */
export function mergeReferential(ref: readonly AreaPlace[], others: readonly AreaPlace[]): AreaPlace[] {
  const out = [...ref];
  for (const p of others) {
    const settlement = SETTLEMENT_KINDS.has(p.kind);
    const same = out.some((r) => {
      if (r.id === p.id) return true;
      if (!settlement || !SETTLEMENT_KINDS.has(r.kind)) return false;
      const km = distanceKm(r, p);
      return km < 0.3 || (km < 3 && plain(r.name) === plain(p.name));
    });
    if (!same) out.push(p);
  }
  return out;
}
