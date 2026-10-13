/**
 * Référentiel des refuges, cabanes, campings et points d'eau (plan 3.4) :
 * `public.geo_pois`, OpenStreetMap (ODbL), importé hors Vercel par
 * `scripts/geo/import_geo_pois.ts` et lu d'abord par le Compas pour les points
 * autour d'une étape (Overpass n'est plus que le secours d'une zone absente).
 *
 * Fonctions pures, partagées par l'import et par la lecture : requête
 * Overpass d'une tuile, lecture d'une réponse (rien d'inventé : un champ absent
 * d'OpenStreetMap reste null), découpage en tuiles, estimation de la place
 * prise en base, passage d'une ligne au point d'étape du Compas.
 */
import { isGenericName } from './itinerary';
import type { RoutePoiCategory } from './routePois';

/** Emprise [ouest, sud, est, nord], comme `geo_places_in_box`. */
export type BBox = [number, number, number, number];

export type GeoPoiSubtype = 'alpine_hut' | 'wilderness_hut' | 'shelter' | 'camp_site' | 'drinking_water' | 'spring';

/** Catégorie du Compas (`RoutePoiCategory`) de chaque nature du référentiel. */
export const GEO_POI_CATEGORY: Readonly<Record<GeoPoiSubtype, RoutePoiCategory>> = {
  alpine_hut: 'refuge',
  wilderness_hut: 'refuge',
  shelter: 'refuge',
  camp_site: 'camping',
  drinking_water: 'water',
  spring: 'water',
};

/** Les catégories que le référentiel sait servir : Overpass ne les redemande pas pour une zone couverte. */
export const GEO_POI_CATEGORIES: ReadonlySet<RoutePoiCategory> = new Set(Object.values(GEO_POI_CATEGORY));

/** Une ligne de `public.geo_pois` (ce que l'import écrit et la lecture rend). */
export interface GeoPoiRow {
  /** Identifiant OpenStreetMap avec son type : « n123 » (nœud), « w456 » (chemin), « r789 » (relation). */
  osm_id: string;
  subtype: GeoPoiSubtype;
  name: string | null;
  lat: number;
  lon: number;
  ele_m: number | null;
  /** Places (`beds` pour un refuge, sinon `capacity`), telles que saisies dans OSM ; null sinon. */
  capacity: number | null;
  /** Eau potable : true si OSM le dit (`drinking_water=yes`) ou pour `amenity=drinking_water` ; null si OSM ne dit rien. Jamais false : l'eau dite non potable n'est pas importée. */
  potable: boolean | null;
}

/* ---------- Requête Overpass d'une tuile ---------- */

/**
 * Formes d'abri que le Compas ne propose pas comme refuge (arrêt de bus,
 * table de pique-nique…) : exclues dès la requête, et refiltrées à la lecture.
 */
const SHELTER_EXCLUDED = 'public_transport|picnic_shelter';

/**
 * UNE requête par tuile (pas de requêtes parallèles) : huttes, campings, points
 * d'eau potable, abris de montagne, sources nommées ou dites potables. Les
 * sources sans nom ni `drinking_water=yes` sont ignorées (des milliers de filets
 * d'eau que rien ne distingue, et dont rien ne dit qu'on peut les boire).
 */
export function buildGeoPoisQuery(box: BBox, serverTimeoutS = 180): string {
  const [w, s, e, n] = box;
  const bb = `(${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)})`;
  return (
    `[out:json][timeout:${serverTimeoutS}];(` +
    `nwr["tourism"~"^(alpine_hut|wilderness_hut|camp_site)$"]${bb};` +
    `nwr["amenity"="drinking_water"]${bb};` +
    `nwr["amenity"="shelter"]["shelter_type"!~"^(${SHELTER_EXCLUDED})$"]${bb};` +
    `nwr["natural"="spring"]["name"]${bb};` +
    `nwr["natural"="spring"]["drinking_water"="yes"]${bb};` +
    `);out center tags;`
  );
}

/* ---------- Lecture d'une réponse Overpass ---------- */

export type DropReason =
  | 'sans_position'
  | 'sans_nature'
  | 'prive'
  | 'abandonne'
  | 'abri_non_montagne'
  | 'eau_non_potable'
  | 'source_sans_nom_ni_potabilite'
  | 'doublon';

export interface ParsedGeoPois {
  rows: GeoPoiRow[];
  /** Éléments lus puis écartés, par raison (rendu visible dans le résumé de l'import). */
  dropped: Partial<Record<DropReason, number>>;
  /** Éléments lus dans la réponse, avant tout filtre. */
  elements: number;
}

/** Formes d'abri de montagne gardées ; un abri sans forme n'est gardé que s'il a une altitude (un nom seul ne suffit pas : arrêts de bus, préaux). */
const SHELTER_KEPT = new Set(['basic_hut', 'lean_to', 'weather_shelter', 'rock_shelter']);

/** Altitude en mètres (« 1 234 » écrit « 1234 », « 3000 ft » converti) ; null si illisible ou hors de la Terre. */
export function parseElevationM(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const m = /^\s*(-?\d+(?:[.,]\d+)?)\s*(m|ft|')?\s*$/i.exec(v);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  const metres = m[2] && m[2].toLowerCase() !== 'm' ? n * 0.3048 : n;
  return Number.isFinite(metres) && metres > -500 && metres < 9000 ? Math.round(metres) : null;
}

/** Entier de 1 à 9 999 écrit tel quel (« 24 ») ; « 24 places » ou « 10-12 » restent illisibles (null), jamais devinés. */
export function parseCount(v: unknown): number | null {
  if (typeof v !== 'string' || !/^\s*\d{1,4}\s*$/.test(v)) return null;
  const n = Number(v);
  return n >= 1 && n <= 9999 ? n : null;
}

/** Nom lisible : français, sinon nom local, sinon anglais ; jamais un nom commun (« Refuge », « shanty »). */
function readableName(tags: Record<string, string>): string | null {
  const n = (tags['name:fr'] || tags.name || tags['name:en'] || '').trim().slice(0, 120);
  return n && !isGenericName(n) ? n : null;
}

function subtypeOf(tags: Record<string, string>): GeoPoiSubtype | null {
  if (tags.tourism === 'alpine_hut' || tags.tourism === 'wilderness_hut' || tags.tourism === 'camp_site') return tags.tourism;
  if (tags.amenity === 'drinking_water') return 'drinking_water';
  if (tags.amenity === 'shelter') return 'shelter';
  if (tags.natural === 'spring') return 'spring';
  return null;
}

function potableOf(subtype: GeoPoiSubtype, tags: Record<string, string>): boolean | null {
  const dw = (tags.drinking_water || '').toLowerCase();
  if (subtype === 'drinking_water') return dw === 'no' || dw === 'not_potable' ? false : true;
  if (subtype === 'spring') return dw === 'yes' ? true : dw === 'no' || dw === 'not_potable' ? false : null;
  return null;
}

/**
 * Réponse Overpass → lignes du référentiel. Écarte (et compte) ce qui est
 * privé, abandonné, sans position, ou hors sujet ; ne devine ni nom, ni
 * altitude, ni capacité. « Gardé » n'est pas importé : OpenStreetMap n'a pas de balise `staffed`
 * (aucune valeur dans l'extrait Alpes de taginfo, aucune sur les 118 refuges et campings d'une tuile du
 * Vercors) ; la nature (`alpine_hut` / `wilderness_hut`) est conservée, le Compas dit « non renseigné ».
 */
export function parseGeoPois(payload: unknown): ParsedGeoPois {
  const els = (payload as { elements?: unknown[] } | null)?.elements;
  const out: ParsedGeoPois = { rows: [], dropped: {}, elements: Array.isArray(els) ? els.length : 0 };
  if (!Array.isArray(els)) return out;
  const drop = (r: DropReason) => {
    out.dropped[r] = (out.dropped[r] ?? 0) + 1;
  };
  const seen = new Set<string>();
  for (const raw of els) {
    const e = raw as {
      type?: string;
      id?: number;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    };
    const tags = e.tags ?? {};
    const lat = Number(e.lat ?? e.center?.lat);
    const lon = Number(e.lon ?? e.center?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || e.id == null) {
      drop('sans_position');
      continue;
    }
    const subtype = subtypeOf(tags);
    if (!subtype) {
      drop('sans_nature');
      continue;
    }
    if (tags.access === 'private' || tags.access === 'no') {
      drop('prive');
      continue;
    }
    if (tags.disused === 'yes' || tags.abandoned === 'yes' || tags.ruins === 'yes') {
      drop('abandonne');
      continue;
    }
    const name = readableName(tags);
    const ele = parseElevationM(tags.ele);
    if (subtype === 'shelter') {
      const kind = (tags.shelter_type || '').toLowerCase();
      const keep = kind ? SHELTER_KEPT.has(kind) : ele != null;
      if (!keep) {
        drop('abri_non_montagne');
        continue;
      }
    }
    const potable = potableOf(subtype, tags);
    // Eau dite non potable : jamais importée. `RoutePoi` n'a pas de drapeau « potable » ; un
    // « point d'eau » proposé à un randonneur doit être buvable ou inconnu, jamais déconseillé.
    if (potable === false) {
      drop('eau_non_potable');
      continue;
    }
    if (subtype === 'spring' && name == null && potable !== true) {
      drop('source_sans_nom_ni_potabilite');
      continue;
    }
    const osmId = `${(e.type ?? 'node')[0]}${e.id}`;
    if (seen.has(osmId)) {
      drop('doublon');
      continue;
    }
    seen.add(osmId);
    out.rows.push({
      osm_id: osmId,
      subtype,
      name,
      lat: Math.round(lat * 1e5) / 1e5,
      lon: Math.round(lon * 1e5) / 1e5,
      ele_m: ele,
      capacity:
        subtype === 'drinking_water' || subtype === 'spring'
          ? null
          : (subtype === 'alpine_hut' || subtype === 'wilderness_hut' ? parseCount(tags.beds) : null) ?? parseCount(tags.capacity),
      potable,
    });
  }
  out.rows.sort((a, b) => (a.osm_id < b.osm_id ? -1 : a.osm_id > b.osm_id ? 1 : 0));
  return out;
}

/** Ce que l'import a trouvé, en chiffres (résumé de `--dry-run`). */
export function summarizeGeoPois(rows: readonly GeoPoiRow[]): {
  bySubtype: Record<string, number>;
  named: number;
  withEle: number;
  withCapacity: number;
  potable: { oui: number; inconnu: number };
} {
  const bySubtype: Record<string, number> = {};
  const potable = { oui: 0, inconnu: 0 };
  let named = 0;
  let withEle = 0;
  let withCapacity = 0;
  for (const r of rows) {
    bySubtype[r.subtype] = (bySubtype[r.subtype] ?? 0) + 1;
    if (r.name) named += 1;
    if (r.ele_m != null) withEle += 1;
    if (r.capacity != null) withCapacity += 1;
    if (r.subtype === 'drinking_water' || r.subtype === 'spring') potable[r.potable ? 'oui' : 'inconnu'] += 1;
  }
  return { bySubtype, named, withEle, withCapacity, potable };
}

/* ---------- Tuiles et zones d'import ---------- */

/** Zones d'import nommées : un massif d'essai, les Alpes, la France. `tile` : pas de la grille (degrés). */
export const GEO_POI_ZONES: Readonly<Record<string, { label: string; box: BBox; tile: number }>> = {
  vercors: { label: 'Vercors (essai)', box: [5.15, 44.6, 5.95, 45.25], tile: 0.5 },
  alpes: { label: 'Alpes (Alpes-Maritimes aux Alpes slovènes)', box: [5.0, 43.5, 17.0, 48.5], tile: 1 },
  france: { label: 'France métropolitaine et Corse', box: [-5.5, 41.3, 9.7, 51.2], tile: 1 },
};

/**
 * Tuiles d'une grille alignée sur des multiples de `step` qui recouvrent
 * l'emprise. Alignées, pour que les tuiles de deux imports (pas de 0,5° puis de
 * 1°) se recouvrent exactement : la lecture « cette étape est-elle couverte ? »
 * ne teste que les coins de sa boîte, ce qui suppose une grille commune.
 */
export function geoPoiTiles(box: BBox, step = 1): BBox[] {
  const [w, s, e, n] = box;
  if (!(step > 0) || !(e > w) || !(n > s)) return [];
  const round = (v: number) => Math.round(v * 1e6) / 1e6;
  const tiles: BBox[] = [];
  for (let lat = Math.floor(s / step) * step; lat < n; lat = round(lat + step)) {
    for (let lon = Math.floor(w / step) * step; lon < e; lon = round(lon + step)) {
      tiles.push([round(lon), round(lat), round(lon + step), round(lat + step)]);
    }
  }
  return tiles;
}

/* ---------- Place prise en base (estimation) ---------- */

/**
 * Octets estimés d'une ligne de `geo_pois`, tableau et index compris.
 *
 * Modèle PostgreSQL : en-tête de ligne 24 octets (32 s'il y a des valeurs
 * nulles), champs de largeur réelle (texte : 1 octet d'en-tête + longueur),
 * alignements moyens de 3 octets, pointeur de ligne 4 octets, ligne arrondie à
 * 8 ; index de la clé (en-tête 8 + texte aligné + pointeur 4, remplissage 90 %)
 * et index GiST du point (28 octets, remplissage 75 %). Multiplié par
 * `ESTIMATE_CALIBRATION` : 1,35, rapport MESURÉ (PostgreSQL local, 72 012 lignes
 * insérées par lots de 1 000 comme l'import : 210 octets par ligne, index compris)
 * à ce même modèle (156). Pour mémoire, `geo_places` en production :
 * 74 Mo pour 367 747 lieux, 211 octets par ligne. Ordre de grandeur à ± 20 %
 * (un `REINDEX` après l'import reprend environ 10 %).
 */
export const ESTIMATE_CALIBRATION = 1.35;

export function estimateRowBytes(row: GeoPoiRow): number {
  const text = (v: string | null) => (v == null ? 0 : 1 + new TextEncoder().encode(v).length);
  const hasNull = row.name == null || row.ele_m == null || row.capacity == null || row.potable == null;
  const header = hasNull ? 32 : 24;
  const data =
    text(row.osm_id) + text(row.subtype) + text(row.name) + 4 + 4 + (row.ele_m == null ? 0 : 2) + (row.capacity == null ? 0 : 2) + (row.potable == null ? 0 : 1) + 4 + 2 + 3;
  const heap = Math.ceil((header + data) / 8) * 8 + 4;
  const keyIndex = (Math.ceil((8 + text(row.osm_id)) / 8) * 8 + 4) / 0.9;
  const gistIndex = 28 / 0.75;
  return Math.round((heap + keyIndex + gistIndex) * ESTIMATE_CALIBRATION);
}

export function estimateTableBytes(rows: readonly GeoPoiRow[]): number {
  let total = 0;
  for (const r of rows) total += estimateRowBytes(r);
  return total;
}

/* ---------- Lecture par le Compas ---------- */

/**
 * Une ligne du référentiel sous la forme d'un élément Overpass : le Compas la
 * passe alors par `parseOverpass`, le même code que pour la réponse d'Overpass
 * (distance à l'étape, plafond par catégorie, doublons de moins de 60 m) ;
 * le rendu est identique quelle que soit la source.
 */
export function geoPoiToElement(row: GeoPoiRow): Record<string, unknown> {
  const tags: Record<string, string> =
    row.subtype === 'drinking_water'
      ? { amenity: 'drinking_water' }
      : row.subtype === 'shelter'
        ? { amenity: 'shelter' }
        : row.subtype === 'spring'
          ? { natural: 'spring' }
          : { tourism: row.subtype };
  if (row.name) tags.name = row.name;
  if (row.ele_m != null) tags.ele = String(row.ele_m);
  return { type: 'node', id: Number(row.osm_id.slice(1)), lat: row.lat, lon: row.lon, tags };
}

/** Le résultat de `geo_pois_around` : la zone est-elle couverte, et ses lignes. */
export interface GeoPoisAround {
  covered: boolean;
  rows: GeoPoiRow[];
}
