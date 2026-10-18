/**
 * Import du référentiel des lieux habités `public.geo_places` (plan 3.2 et 3.9) : fonctions pures.
 *
 * Reprend À L'IDENTIQUE les règles de `scripts/geo/prep_geo_places.py` (lot E, 8 octobre) et les
 * contrôles de l'ancien `import_geo_places.ts`, pour que le réimport mensuel (GitHub Actions,
 * `geo-places-monthly.yml`) lise directement les dumps GeoNames sans étape Python :
 * - dumps lus : `cities500.txt` (monde) puis `FR.txt`, `CH.txt`, `IT.txt`, `AT.txt` (tous les lieux
 *   habités) ; une ligne lue plus tard remplace la précédente de même identifiant (comme le `dict`
 *   du script Python) ;
 * - classe `P` seulement, sans les codes PPLX, PPLH, PPLQ, PPLW, PPLCH, PPLCD (quartiers, lieux
 *   détruits, abandonnés, historiques) ;
 * - nature par la population et le code (`kind`, inchangée) ;
 * - altitude déclarée, sinon le modèle de terrain (`dem`, sauf -9999), gardée entre -500 et 9 000 m.
 *
 * GeoNames : CC BY 4.0 (créditée dans les mentions légales).
 */

/** Les dumps lus, dans l'ordre (le dernier lu l'emporte pour un même identifiant). */
export const GEO_PLACES_DUMPS = ['cities500', 'FR', 'CH', 'IT', 'AT'] as const;

const SKIP_CODES: ReadonlySet<string> = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW', 'PPLCH', 'PPLCD']);
const ADMIN_CODES: ReadonlySet<string> = new Set(['PPLA', 'PPLA2', 'PPLA3', 'PPLA4', 'PPLG']);

export type GeoPlaceKind = 'city' | 'town' | 'village' | 'hamlet';

/** Une ligne de `public.geo_places`, telle que l'import l'écrit (sans `updated_at`). */
export interface GeoPlaceImportRow {
  geoname_id: number;
  name: string;
  kind: GeoPlaceKind;
  country_code: string;
  admin1: string | null;
  lat: number;
  lon: number;
  ele_m: number | null;
  population: number;
  timezone: string | null;
}

export type GeoPlaceDropReason = 'malforme' | 'hors_classe' | 'sans_nom' | 'sans_pays';

/** Nature d'un lieu habité (règle du lot E, inchangée). */
export function geoPlaceKind(code: string, population: number): GeoPlaceKind {
  if (code === 'PPLC' || population >= 100_000) return 'city';
  if (population >= 10_000) return 'town';
  if (population >= 200 || ADMIN_CODES.has(code)) return 'village';
  return 'hamlet';
}

const round5 = (v: number) => Math.round(v * 1e5) / 1e5;

function elevation(declared: string, dem: string): number | null {
  const raw = declared !== '' ? declared : dem !== '' && dem !== '-9999' ? dem : '';
  if (raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const m = Math.trunc(n);
  return m > -500 && m < 9000 ? m : null;
}

/**
 * Une ligne d'un dump GeoNames (19 colonnes : geonameid, name, asciiname, alternatenames, latitude,
 * longitude, feature class, feature code, country code, cc2, admin1…4, population, elevation, dem,
 * timezone, modification date) → une ligne de `geo_places`, ou la raison de l'écarter.
 */
export function parseGeoPlaceDumpLine(
  line: string
): { row: GeoPlaceImportRow; drop?: undefined } | { row?: undefined; drop: GeoPlaceDropReason } {
  const c = line.replace(/\r$/, '').split('\t');
  if (c.length < 19) return { drop: 'malforme' };
  if (c[6] !== 'P' || SKIP_CODES.has(c[7])) return { drop: 'hors_classe' };
  const id = Number(c[0]);
  const lat = Number(c[4]);
  const lon = Number(c[5]);
  if (
    !/^\d+$/.test(c[0]) ||
    !(id > 0) ||
    id > 2_147_483_647 ||
    c[4] === '' ||
    c[5] === '' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180 ||
    !/^-?\d*$/.test(c[14])
  )
    return { drop: 'malforme' };
  const population = Math.max(0, Number(c[14] || 0));
  const name = c[1].trim();
  if (!name) return { drop: 'sans_nom' };
  if (!/^[A-Z]{2}$/.test(c[8])) return { drop: 'sans_pays' };
  return {
    row: {
      geoname_id: id,
      name,
      kind: geoPlaceKind(c[7], population),
      country_code: c[8],
      admin1: c[10].slice(0, 20) || null,
      lat: round5(lat),
      lon: round5(lon),
      ele_m: elevation(c[15], c[16]),
      population,
      timezone: c[17].slice(0, 40) || null,
    },
  };
}

const KINDS: ReadonlySet<string> = new Set(['city', 'town', 'village', 'hamlet']);

/**
 * Une ligne du TSV préparé par `prep_geo_places.py` (id, nom, nature, pays, admin1, lat, lon,
 * altitude, population, fuseau) → une ligne de `geo_places` : l'ancien chemin d'import, gardé.
 */
export function parseGeoPlaceTsvLine(
  line: string
): { row: GeoPlaceImportRow; drop?: undefined } | { row?: undefined; drop: GeoPlaceDropReason } {
  const c = line.replace(/\r$/, '').split('\t');
  const id = Number(c[0]);
  const lat = c[5] ? Number(c[5]) : NaN;
  const lon = c[6] ? Number(c[6]) : NaN;
  if (!/^\d+$/.test(c[0] ?? '') || !(id > 0) || !Number.isFinite(lat) || !Number.isFinite(lon))
    return { drop: 'malforme' };
  if (!c[1]) return { drop: 'sans_nom' };
  if (!KINDS.has(c[2] ?? '')) return { drop: 'hors_classe' };
  if ((c[3] ?? '').length !== 2) return { drop: 'sans_pays' };
  const ele = c[7] ? Number(c[7]) : NaN;
  const pop = c[8] ? Number(c[8]) : 0;
  return {
    row: {
      geoname_id: id,
      name: c[1],
      kind: c[2] as GeoPlaceKind,
      country_code: c[3],
      admin1: c[4] || null,
      lat,
      lon,
      ele_m: Number.isFinite(ele) && ele > -500 && ele < 9000 ? Math.round(ele) : null,
      population: Number.isFinite(pop) ? Math.max(0, Math.round(pop)) : 0,
      timezone: c[9] || null,
    },
  };
}

export interface CollectedGeoPlaces {
  rows: GeoPlaceImportRow[];
  dropped: Partial<Record<GeoPlaceDropReason, number>>;
  /** Lignes lues, avant tout filtre. */
  lines: number;
  /** Identifiants lus plus d'une fois (cities500 puis le dump du pays) : le dernier lu l'emporte. */
  replaced: number;
}

/** Lecture ligne à ligne : seules les lignes gardées restent en mémoire, par identifiant. */
export function createGeoPlaceCollector(parse = parseGeoPlaceDumpLine) {
  const byId = new Map<number, GeoPlaceImportRow>();
  const dropped: Partial<Record<GeoPlaceDropReason, number>> = {};
  let lines = 0;
  let replaced = 0;
  return {
    add(line: string): void {
      lines += 1;
      const got = parse(line);
      if (!got.row) {
        dropped[got.drop] = (dropped[got.drop] ?? 0) + 1;
        return;
      }
      if (byId.has(got.row.geoname_id)) replaced += 1;
      byId.set(got.row.geoname_id, got.row);
    },
    result(): CollectedGeoPlaces {
      const rows = [...byId.values()].sort((a, b) => a.geoname_id - b.geoname_id);
      return { rows, dropped: { ...dropped }, lines, replaced };
    },
  };
}
