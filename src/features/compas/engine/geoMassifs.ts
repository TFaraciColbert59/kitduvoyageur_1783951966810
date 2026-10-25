/**
 * Référentiel des massifs, chaînes et régions naturelles (plan 3.3, classes GeoNames T et L) :
 * `public.geo_massifs`, GeoNames (CC BY 4.0, comme `geo_places`), importé hors Vercel par
 * `scripts/geo/import_geo_massifs.ts` depuis les fichiers du dump (allCountries.txt ou XX.txt).
 *
 * CONCEPTION (décidée ici, rien n'est deviné) :
 * - TABLE À PART, pas `geo_areas`. Une ligne GeoNames est un POINT : aucune emprise. `geo_areas`
 *   exige ouest/sud/est/nord non nuls et un `osm_id` OpenStreetMap ; y loger un massif obligerait
 *   à inventer une emprise ou à modifier une table déjà en base. `geo_massifs` porte ce que
 *   GeoNames donne vraiment : identifiant, nom, code de caractéristique, pays, centre, altitude.
 *   Le lieu rendu au Compas a donc `extent: null` : l'appelant prend alors son rayon par défaut
 *   (`destinationRadiusKm`), jamais une emprise fabriquée.
 * - CODES RETENUS (liste officielle https://www.geonames.org/export/codes.html ; GeoNames n'a pas
 *   de code « massif » ni « range » : une chaîne ou un massif est `MTS`) :
 *   classe T : `MTS` (chaîne, massif), `HLLS` (groupe de collines), `PLAT` (plateau), `UPLD`
 *   (hautes terres), `PEN` (presqu'île), et `MT` (une montagne) SEULEMENT si son nom dit
 *   « massif » (« Massif du Mont-Blanc ») ; classe L : `RGN` (région naturelle).
 *   Écartés : `MT` ordinaire, `PK`, `HLL`, `RDGE`, `VAL` (des centaines de milliers de sommets,
 *   collines et vallées, déjà dans `geo_pois` pour les sommets), `ISL*` (les îles ont leur contour
 *   OSM), `PRK` et `RES*` (les parcs et réserves sont dans `geo_areas`, avec leur emprise), `RGNH`
 *   / `RGNE` (régions historiques ou économiques : pas un terrain).
 * - NOM : la colonne `name` (UTF-8) est affichée ; la clé vient de `name`, sinon de `asciiname`.
 *   `alternatenames` (sans langue dans ce fichier) est ignoré : la langue d'un nom n'y est pas dite.
 *   Clé = `normalizeAreaName` (même clé que `geo_areas`) puis, en plus, une désignation de relief
 *   suivie d'une liaison (« Monts du », « Plateau de », « Sierra de », « Presqu'île de ») et
 *   « Mountains » / « massif » en fin de nom. Un nom générique (« Mountains », « Les Monts ») ou
 *   sans lettre latine n'a pas de clé : écarté (`sans_nom`).
 * - ALTITUDE : la colonne `elevation` seule (déclarée). La colonne `dem` est l'altitude du
 *   MODÈLE au point : pour une chaîne, ce n'est l'altitude de rien. Population ignorée.
 * - DOUBLONS : un même `geoname_id` lu deux fois (allCountries puis un fichier pays) : compté
 *   `doublon`, la première ligne gardée. Deux massifs homonymes distincts restent deux lignes ;
 *   `pickMassif` départage (relief d'abord, puis le plus proche).
 */
import { normalizeAreaName } from './geoAreas';
import { distanceKm, type CompasPlace } from './places';

export type GeoMassifCode = 'MTS' | 'MT' | 'HLLS' | 'PLAT' | 'UPLD' | 'PEN' | 'RGN';

/** Code → classe GeoNames attendue (un code n'appartient qu'à une classe). */
const CODE_CLASS: Record<GeoMassifCode, 'T' | 'L'> = {
  MTS: 'T',
  MT: 'T',
  HLLS: 'T',
  PLAT: 'T',
  UPLD: 'T',
  PEN: 'T',
  RGN: 'L',
};
export const GEO_MASSIF_CODES = Object.keys(CODE_CLASS) as GeoMassifCode[];

/** Codes d'un relief, du plus « massif » au moins : ceux que `lookupMassif` accepte. */
export const RELIEF_CODES: readonly GeoMassifCode[] = ['MTS', 'MT', 'HLLS', 'UPLD', 'PLAT'];

/** Une ligne de `public.geo_massifs`. Un point : GeoNames ne donne pas d'emprise. */
export interface GeoMassifRow {
  geoname_id: number;
  feature_code: GeoMassifCode;
  name: string;
  /** Clé de recherche : `normalizeMassifName(name)`. */
  name_plain: string;
  /** ISO 3166-1 alpha-2, null si GeoNames n'en donne pas (mers, frontières). */
  country_code: string | null;
  lat: number;
  lon: number;
  /** Altitude déclarée par GeoNames (colonne `elevation`), null sinon. */
  elevation_m: number | null;
}

export type MassifDropReason = 'malforme' | 'hors_classe' | 'sans_nom' | 'doublon';

const fold = (v: string) =>
  v
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Désignations de relief retirées en tête, SEULEMENT suivies d'une liaison (« Monts du Cantal »). */
const RELIEF_PREFIXES: string[][] = [
  'presqu ile',
  'presqu',
  'peninsule',
  'montagnes',
  'montagne',
  'monts',
  'monti',
  'plateau',
  'chaine',
  'causse',
  'pays',
  'region',
  'sierra',
  'serra',
  'cordillera',
  'macizo',
  'massiccio',
].map((p) => p.split(' '));
/** Liaisons qui suivent une désignation (celles de `normalizeAreaName`, les plus longues d'abord). */
const LINKS: string[][] = [
  'de la',
  'de l',
  'de los',
  'de las',
  'del',
  'della',
  'des',
  'du',
  'de',
  'd',
  'di',
  'dos',
  'do',
  'da',
].map((p) => p.split(' '));
const RELIEF_SUFFIXES: string[][] = ['mountain range', 'mountains', 'massif'].map((p) =>
  p.split(' ')
);
/** Une clé qui ne nomme rien de particulier. */
const GENERIC = new Set([
  'mountains',
  'mountain',
  'montagnes',
  'montagne',
  'monts',
  'mont',
  'massif',
  'region',
  'plateau',
  'hills',
  'sierra',
  'peninsula',
]);
/** Mots qui disent « massif » dans le nom d'une montagne (`MT`). */
const MASSIF_WORDS = new Set(['massif', 'massiv', 'massiccio', 'macizo', 'macico']);

const startsWith = (words: string[], seq: string[]) =>
  seq.length <= words.length && seq.every((w, i) => words[i] === w);
const endsWith = (words: string[], seq: string[]) =>
  seq.length <= words.length && seq.every((w, i) => words[words.length - seq.length + i] === w);

/**
 * Nom d'un massif ou d'une région naturelle → clé de recherche. La clé de `normalizeAreaName`
 * (« Massif de la Chartreuse » → « chartreuse »), puis une désignation de relief suivie d'une
 * liaison (« Monts du Cantal » → « cantal ») et « Mountains » / « massif » en fin de nom. Un nom
 * propre sans liaison reste entier (« Sierra Nevada », « Montagne Noire »). Null : rien de propre.
 */
export function normalizeMassifName(name: unknown): string | null {
  let key = normalizeAreaName(name);
  for (let guard = 0; key && guard < 6; guard += 1) {
    let words = key.split(' ');
    const before = words.length;
    for (const p of RELIEF_PREFIXES) {
      const link = startsWith(words, p) && LINKS.find((l) => startsWith(words.slice(p.length), l));
      if (link) {
        words = words.slice(p.length + link.length);
        break;
      }
    }
    const suffix = RELIEF_SUFFIXES.find((s) => s.length < words.length && endsWith(words, s));
    if (suffix) words = words.slice(0, words.length - suffix.length);
    if (words.length === before) break;
    key = normalizeAreaName(words.join(' '));
  }
  return key && !GENERIC.has(key) ? key : null;
}

const round5 = (v: number) => Math.round(v * 1e5) / 1e5;

/**
 * Une ligne du dump GeoNames (19 colonnes, tabulations : geonameid, name, asciiname,
 * alternatenames, latitude, longitude, feature class, feature code, country code, cc2, admin1…4,
 * population, elevation, dem, timezone, modification date) → une ligne du référentiel, ou la
 * raison de l'écarter. Les doublons se comptent dans `createGeoMassifCollector`.
 */
export function parseGeonamesLine(
  line: string
): { row: GeoMassifRow; drop?: undefined } | { row?: undefined; drop: MassifDropReason } {
  const c = line.replace(/\r$/, '').split('\t');
  if (c.length < 19) return { drop: 'malforme' };
  const id = Number(c[0]);
  const lat = Number(c[4]);
  const lon = Number(c[5]);
  if (
    !/^\d+$/.test(c[0]) ||
    !(id > 0) ||
    c[4] === '' ||
    c[5] === '' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  )
    return { drop: 'malforme' };
  const code = c[7] as GeoMassifCode;
  if (!Object.prototype.hasOwnProperty.call(CODE_CLASS, code) || CODE_CLASS[code] !== c[6])
    return { drop: 'hors_classe' };
  const name = c[1].trim().slice(0, 140);
  if (
    code === 'MT' &&
    !fold(`${name} ${c[2]}`)
      .split(' ')
      .some((w) => MASSIF_WORDS.has(w))
  )
    return { drop: 'hors_classe' };
  const key = normalizeMassifName(name) ?? normalizeMassifName(c[2]);
  if (!name || !key) return { drop: 'sans_nom' };
  const ele = c[15] === '' ? NaN : Number(c[15]);
  return {
    row: {
      geoname_id: id,
      feature_code: code,
      name,
      name_plain: key,
      country_code: /^[A-Z]{2}$/.test(c[8]) ? c[8] : null,
      lat: round5(lat),
      lon: round5(lon),
      elevation_m: Number.isFinite(ele) && ele > -500 && ele < 9000 ? Math.round(ele) : null,
    },
  };
}

export interface CollectedGeoMassifs {
  rows: GeoMassifRow[];
  dropped: Partial<Record<MassifDropReason, number>>;
  /** Lignes lues, avant tout filtre. */
  lines: number;
}

/** Lecture ligne à ligne (le dump mondial fait 12 millions de lignes) : seules les gardées restent en mémoire. */
export function createGeoMassifCollector() {
  const byId = new Map<number, GeoMassifRow>();
  const dropped: Partial<Record<MassifDropReason, number>> = {};
  let lines = 0;
  const drop = (r: MassifDropReason) => {
    dropped[r] = (dropped[r] ?? 0) + 1;
  };
  return {
    add(line: string): void {
      lines += 1;
      const got = parseGeonamesLine(line);
      if (!got.row) return drop(got.drop);
      if (byId.has(got.row.geoname_id)) return drop('doublon');
      byId.set(got.row.geoname_id, got.row);
    },
    result(): CollectedGeoMassifs {
      const rows = [...byId.values()].sort((a, b) => a.geoname_id - b.geoname_id);
      return { rows, dropped: { ...dropped }, lines };
    },
  };
}

export function collectGeoMassifs(lines: Iterable<string>): CollectedGeoMassifs {
  const c = createGeoMassifCollector();
  for (const l of lines) c.add(l);
  return c.result();
}

/** Au-delà, un homonyme n'est pas le massif du lieu visé (même règle que `lookupMassif`). */
export const MASSIF_MAX_KM = 150;

/**
 * Le relief (`RELIEF_CODES`) dont la clé est celle de ce nom, à moins de `maxKm` de `near` :
 * une chaîne (`MTS`) avant un plateau homonyme, puis le plus proche, puis le plus petit
 * identifiant (résultat stable). Aucun : null.
 */
export function pickMassif(
  rows: readonly GeoMassifRow[],
  name: string,
  near: { lat: number; lon: number },
  maxKm = MASSIF_MAX_KM
): GeoMassifRow | null {
  const key = normalizeMassifName(name);
  if (!key) return null;
  let best: { row: GeoMassifRow; rank: number; km: number } | null = null;
  for (const row of rows) {
    const rank = RELIEF_CODES.indexOf(row.feature_code);
    if (row.name_plain !== key || rank < 0) continue;
    const km = distanceKm(row, near);
    if (km > maxKm) continue;
    if (
      !best ||
      rank < best.rank ||
      (rank === best.rank &&
        (km < best.km || (km === best.km && row.geoname_id < best.row.geoname_id)))
    )
      best = { row, rank, km };
  }
  return best?.row ?? null;
}

const PLACE_KIND: Record<GeoMassifCode, string> = {
  MTS: 'mountain_range',
  MT: 'mountain_range',
  HLLS: 'mountain_range',
  PLAT: 'plateau',
  UPLD: 'plateau',
  PEN: 'peninsula',
  RGN: 'natural_region',
};

/** Une ligne du référentiel en lieu du Compas : un point, sans emprise (GeoNames n'en donne pas). */
export function massifPlace(row: GeoMassifRow): CompasPlace {
  return {
    name: row.name,
    lat: row.lat,
    lon: row.lon,
    countryCode: row.country_code,
    country: null,
    kind: PLACE_KIND[row.feature_code],
    landmark: true,
    extent: null,
  };
}
