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
import { extentIsWorldwide, splitLonRange } from './longitude';
import { distanceKm } from './places';
import { matchKey } from './nameKey';

/** Pays où le référentiel contient TOUS les lieux habités (hameaux compris). */
export const DETAILED_COUNTRIES: ReadonlySet<string> = new Set(['FR', 'CH', 'IT', 'AT']);

/** Natures que le référentiel connaît (pas les refuges ni les campings). */
export const SETTLEMENT_KINDS: ReadonlySet<AreaPlaceKind> = new Set(['city', 'town', 'village', 'hamlet']);

/**
 * L'emprise [ouest, sud, est, nord] de la zone : celle de la carte quand elle
 * est connue (`extent` est [ouest, nord, est, sud]), sinon le carré du rayon
 * (400 km au plus, comme les autres cartes). Ouest > est : l'emprise franchit
 * l'antiméridien (voir `areaBoxes`). La boîte d'un globe entier ([-180, 180] :
 * Photon la rend pour Fidji, même pour Taveuni) ne dit rien de la largeur, on
 * prend alors le carré du rayon, resserré sur la hauteur de l'emprise.
 */
export function areaBox(q: AreaQuery): [number, number, number, number] {
  if (q.extent && !extentIsWorldwide(q.extent)) {
    const [w, a, e, b] = q.extent;
    return [w, Math.min(a, b), e, Math.max(a, b)];
  }
  const r = Math.min(Math.max(q.radiusKm, 1), 400);
  const dLat = r / 111;
  const dLon = r / (111 * Math.max(0.1, Math.cos((q.center.lat * Math.PI) / 180)));
  let south = q.center.lat - dLat;
  let north = q.center.lat + dLat;
  if (q.extent) {
    south = Math.max(south, Math.min(q.extent[1], q.extent[3]));
    north = Math.min(north, Math.max(q.extent[1], q.extent[3]));
  }
  return [q.center.lon - dLon, Math.max(-90, south), q.center.lon + dLon, Math.min(90, north)];
}

/**
 * Les boîtes [ouest, sud, est, nord] à lire dans le référentiel : une seule,
 * ou deux quand la zone franchit l'antiméridien (le `box` de Postgres range
 * ses coins et lirait sinon tout ce qui est ENTRE les deux, de l'autre côté du globe).
 */
export function areaBoxes(q: AreaQuery): Array<[number, number, number, number]> {
  const [w, s, e, n] = areaBox(q);
  return splitLonRange(w, e).map(([a, b]) => [a, s, b, n] as [number, number, number, number]);
}

/**
 * Les lignes de plusieurs boîtes en une liste, comme la base la rendrait pour
 * une seule : sans doublon, les plus peuplés d'abord, `limit` au plus.
 */
export function mergeBoxRows(lists: ReadonlyArray<ReadonlyArray<GeoPlaceRow>>, limit: number): GeoPlaceRow[] {
  if (lists.length === 1) return [...lists[0]];
  const seen = new Set<number>();
  const rows: GeoPlaceRow[] = [];
  for (const list of lists)
    for (const r of list)
      if (!seen.has(r.geoname_id)) {
        seen.add(r.geoname_id);
        rows.push(r);
      }
  return rows.sort((a, b) => (b.population ?? 0) - (a.population ?? 0) || a.geoname_id - b.geoname_id).slice(0, Math.max(1, limit));
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

/**
 * Le référentiel d'abord, puis les lieux d'une autre carte qui n'y sont pas
 * déjà : même nom à moins de 3 km (toutes écritures, `matchKey` : deux noms arabes
 * différents ne sont plus « le même »), ou un autre lieu habité à moins de 300 m,
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
      return km < 0.3 || (km < 3 && matchKey(r.name) === matchKey(p.name));
    });
    if (!same) out.push(p);
  }
  return out;
}
