/**
 * Référentiel des parcs et espaces protégés (plan 3.3) : `public.geo_areas`, OpenStreetMap (ODbL),
 * importé hors Vercel par `scripts/geo/import_geo_areas.ts`, tuile par tuile, comme `geo_trails`.
 *
 * Ce que la carte (Photon, `placeLookup.ts`) rend aujourd'hui pour « Vanoise » ou « Calanques » :
 * un lieu `landmark`, étiqueté `boundary=national_park` / `boundary=protected_area` /
 * `leisure=nature_reserve`, avec une emprise rectangulaire et un centre. Une ligne d'ici porte
 * exactement cela (nature, nom, centre, emprise), jamais le contour : quelques centaines d'octets.
 *
 * Choix (documentés pour ne rien deviner) :
 * - Nature = l'étiquette OSM telle quelle. `boundary=national_park` → `national_park` ;
 *   `boundary=protected_area` avec `protect_class` 1 à 6 (classes UICN, 1a et 1b comprises) →
 *   `protected_area` (un parc naturel régional français est de classe 5) ; sinon
 *   `leisure=nature_reserve` nommée → `nature_reserve`. Une aire protégée d'une autre classe
 *   (Natura 2000 = 97, protection de l'eau = 12…) n'est pas un lieu de voyage : écartée.
 *   Aucune classe n'est déduite : `protect_class` reste null quand OSM ne la donne pas.
 * - Emprise : celle d'Overpass (`out bb`). Une emprise de moins de 1 km² (une mare) ou de plus de
 *   200 000 km² (un territoire entier, ou une coupure de l'antiméridien) est écartée.
 * - `area_km2` : l'aire du RECTANGLE sur la sphère, un majorant de la surface réelle. Donnée
 *   seulement si l'emprise tient dans 3° × 3° : au-delà, les parties dispersées (îles, exclaves,
 *   cœur et aire d'adhésion éloignés) rendent le rectangle sans rapport avec le parc → null.
 * - `name_plain` : la clé de recherche (`normalizeAreaName`), sans accents ni désignation :
 *   « Parc national de la Vanoise » et « Vanoise » se rejoignent. Un nom sans lettre latine n'a
 *   pas de clé : on essaie `name:fr`, `name`, puis `name:en`, sinon la ligne est écartée.
 *
 * Reste à faire (hors de ce lot) : les massifs et régions naturelles de GeoNames (classes T et L),
 * qui viennent d'un import de fichiers, pas d'Overpass.
 */
import type { BBox } from './geoPois';

export type GeoAreaKind = 'national_park' | 'protected_area' | 'nature_reserve';

/** Une ligne de `public.geo_areas`. Centre et emprise de l'espace entier, en degrés. */
export interface GeoAreaRow {
  /** « r123 » (relation) ou « w123 » (chemin fermé) : l'identifiant OSM. */
  osm_id: string;
  kind: GeoAreaKind;
  /** Nom affichable (français d'abord). */
  name: string;
  /** Clé de recherche : `normalizeAreaName(name)`. */
  name_plain: string;
  /** Classe UICN lue dans OSM (« 1a », « 1b », « 2 »…« 6 »), null si OSM ne la donne pas. */
  protect_class: string | null;
  lat: number;
  lon: number;
  west: number;
  south: number;
  east: number;
  north: number;
  /** Aire du rectangle d'emprise (majorant), null quand elle ne dirait rien (voir plus haut). */
  area_km2: number | null;
}

/** Classes UICN gardées pour `boundary=protected_area` (et lues pour les autres). */
const PROTECT_CLASS = /^(?:1a|1b|[1-6])$/;
/** En dessous : une mare, un bosquet. Au-dessus : un territoire entier ou une emprise cassée. */
export const MIN_AREA_KM2 = 1;
export const MAX_AREA_KM2 = 200_000;
/** Écart (en degrés) au-delà duquel l'aire du rectangle n'est plus donnée. */
const RELIABLE_SPAN_DEG = 3;

/** UNE requête par tuile : parcs nationaux, aires protégées de classe 1 à 6, réserves nommées. */
export function buildGeoAreasQuery(box: BBox, serverTimeoutS = 180): string {
  const [w, s, e, n] = box;
  const bb = `(${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)})`;
  return (
    `[out:json][timeout:${serverTimeoutS}];(` +
    `rel["boundary"="national_park"]${bb};` +
    `rel["boundary"="protected_area"]["protect_class"~"^(1a|1b|[1-6])$"]${bb};` +
    `wr["leisure"="nature_reserve"]["name"]${bb};` +
    `);out center bb tags;`
  );
}

/** Désignations retirées en tête du nom (en mots simples, sans accents), les plus longues d'abord. */
const PREFIXES: string[][] = [
  'reserve biologique integrale',
  'reserve naturelle nationale',
  'reserve naturelle regionale',
  'parc naturel regional',
  'parc naturel marin',
  'parco naturale regionale',
  'riserva naturale statale',
  'riserva naturale regionale',
  'riserva naturale orientata',
  'reserve naturelle',
  'reserve biologique',
  'reserve nationale',
  'reserve integrale',
  'parc national',
  'parc naturel',
  'parc regional',
  'parc natural',
  'parco nazionale',
  'parco naturale',
  'parco regionale',
  'riserva naturale',
  'parque nacional',
  'parque natural',
  'parque regional',
  'reserva natural',
  'reserva nacional',
  'national park',
  'nature reserve',
  'nationaal park',
  'nationalpark',
  'naturpark',
  'naturschutzgebiet',
].map((p) => p.split(' '));

/** Désignations retirées en fin de nom (« Yosemite National Park »). */
const SUFFIXES: string[][] = [
  'national park',
  'nature reserve',
  'natural park',
  'regional park',
  'nationalpark',
  'naturpark',
  'naturreservat',
].map((p) => p.split(' '));

/** Articles et liaisons retirés en tête, après une désignation (« de la », « des », « del »…). */
const CONNECTORS: string[][] = [
  'de la',
  'de l',
  'de los',
  'de las',
  'of the',
  'del',
  'della',
  'dello',
  'delle',
  'dei',
  'degli',
  'des',
  'du',
  'de',
  'd',
  'di',
  'of',
  'the',
  'la',
  'le',
  'les',
  'l',
  'el',
  'los',
  'las',
].map((p) => p.split(' '));

const startsWith = (words: string[], seq: string[]) =>
  seq.length <= words.length && seq.every((w, i) => words[i] === w);
const endsWith = (words: string[], seq: string[]) =>
  seq.length <= words.length && seq.every((w, i) => words[words.length - seq.length + i] === w);

/**
 * Nom d'un espace naturel → clé de recherche : minuscules, sans accents ni ponctuation, sans la
 * désignation (« Parc national de la », « Parco Nazionale del », « Nationalpark », « … National
 * Park ») ni l'article de tête. « massif » n'est retiré que suivi d'une liaison (« Massif de la
 * Chartreuse » → « chartreuse ») : « Massif central » est un nom propre et reste entier.
 * Null si rien ne reste (« Parc national » seul) ou si le nom n'a aucune lettre latine.
 */
export function normalizeAreaName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  let words = name
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  for (let guard = 0; guard < 12; guard += 1) {
    const before = words.length;
    const prefix = PREFIXES.find((p) => startsWith(words, p));
    if (prefix) words = words.slice(prefix.length);
    const suffix = SUFFIXES.find((p) => endsWith(words, p));
    if (suffix) words = words.slice(0, words.length - suffix.length);
    if (words[0] === 'massif' && CONNECTORS.some((c) => startsWith(words.slice(1), c)))
      words = words.slice(1);
    const connector = CONNECTORS.find((c) => startsWith(words, c));
    if (connector) words = words.slice(connector.length);
    if (words.length === before) break;
  }
  const key = words.join(' ');
  return key.length >= 2 ? key : null;
}

const EARTH_RADIUS_KM = 6371.0088;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Aire (km²) du rectangle ouest/sud/est/nord sur la sphère terrestre. */
export function bboxAreaKm2(west: number, south: number, east: number, north: number): number {
  return (
    EARTH_RADIUS_KM ** 2 *
    Math.abs(rad(east - west)) *
    Math.abs(Math.sin(rad(north)) - Math.sin(rad(south)))
  );
}

export type AreaDropReason =
  'doublon' | 'sans_nom' | 'sans_emprise' | 'trop_petit' | 'demesure' | 'hors_classe' | 'abandonne';

export interface ParsedGeoAreas {
  rows: GeoAreaRow[];
  dropped: Partial<Record<AreaDropReason, number>>;
  /** Éléments lus dans la réponse, avant tout filtre. */
  elements: number;
}

function areaKind(tags: Record<string, string>, protectClass: string | null): GeoAreaKind | null {
  if (tags.boundary === 'national_park') return 'national_park';
  if (tags.boundary === 'protected_area' && protectClass) return 'protected_area';
  if (tags.leisure === 'nature_reserve') return 'nature_reserve';
  return null;
}

/** Le premier nom (français, local, anglais) qui donne une clé de recherche. */
function areaName(tags: Record<string, string>): { name: string; key: string } | null {
  for (const raw of [tags['name:fr'], tags.name, tags['name:en']]) {
    const name = (raw ?? '').trim().slice(0, 140);
    const key = normalizeAreaName(name);
    if (name && key) return { name, key };
  }
  return null;
}

const round5 = (v: number) => Math.round(v * 1e5) / 1e5;

/** Réponse Overpass → lignes. Écarte (et compte) ce qui n'est pas un espace utilisable. */
export function parseGeoAreas(payload: unknown): ParsedGeoAreas {
  const els = (payload as { elements?: unknown[] } | null)?.elements;
  const out: ParsedGeoAreas = {
    rows: [],
    dropped: {},
    elements: Array.isArray(els) ? els.length : 0,
  };
  if (!Array.isArray(els)) return out;
  const drop = (r: AreaDropReason) => {
    out.dropped[r] = (out.dropped[r] ?? 0) + 1;
  };
  const seen = new Set<string>();
  for (const raw of els) {
    const e = raw as {
      type?: string;
      id?: number;
      tags?: Record<string, string>;
      bounds?: { minlat?: number; minlon?: number; maxlat?: number; maxlon?: number };
      center?: { lat?: number; lon?: number };
    };
    const tags = e.tags ?? {};
    const pc = (tags.protect_class ?? '').trim().toLowerCase();
    const protectClass = PROTECT_CLASS.test(pc) ? pc : null;
    const kind = areaKind(tags, protectClass);
    if (!kind) {
      drop('hors_classe');
      continue;
    }
    if (
      tags.disused === 'yes' ||
      tags.abandoned === 'yes' ||
      (tags.state || '').toLowerCase() === 'proposed'
    ) {
      drop('abandonne');
      continue;
    }
    const prefix = e.type === 'relation' ? 'r' : e.type === 'way' ? 'w' : null;
    const b = e.bounds;
    const w = Number(b?.minlon);
    const s = Number(b?.minlat);
    const ea = Number(b?.maxlon);
    const n = Number(b?.maxlat);
    const lat = Number(e.center?.lat);
    const lon = Number(e.center?.lon);
    const valid =
      prefix != null &&
      e.id != null &&
      [w, s, ea, n, lat, lon].every(Number.isFinite) &&
      s >= -90 &&
      n <= 90 &&
      s <= n &&
      w >= -180 &&
      ea <= 180 &&
      w <= ea;
    if (!valid) {
      drop('sans_emprise');
      continue;
    }
    const rectKm2 = bboxAreaKm2(w, s, ea, n);
    if (rectKm2 < MIN_AREA_KM2) {
      drop('trop_petit');
      continue;
    }
    if (rectKm2 > MAX_AREA_KM2) {
      drop('demesure');
      continue;
    }
    const named = areaName(tags);
    if (!named) {
      drop('sans_nom');
      continue;
    }
    const osmId = `${prefix}${e.id}`;
    if (seen.has(osmId)) {
      drop('doublon');
      continue;
    }
    seen.add(osmId);
    const reliable = ea - w <= RELIABLE_SPAN_DEG && n - s <= RELIABLE_SPAN_DEG;
    out.rows.push({
      osm_id: osmId,
      kind,
      name: named.name,
      name_plain: named.key,
      protect_class: protectClass,
      lat: round5(lat),
      lon: round5(lon),
      west: round5(w),
      south: round5(s),
      east: round5(ea),
      north: round5(n),
      area_km2: reliable ? Math.round(rectKm2 * 10) / 10 : null,
    });
  }
  out.rows.sort((a, b) => (a.osm_id < b.osm_id ? -1 : a.osm_id > b.osm_id ? 1 : 0));
  return out;
}

const spanOf = (r: GeoAreaRow) => bboxAreaKm2(r.west, r.south, r.east, r.north);

/**
 * Parmi les lignes dont la clé est exactement celle de ce nom, la plus étendue (le parc national
 * plutôt que la réserve homonyme qu'il contient) ; à égalité, l'identifiant le plus petit (résultat
 * stable). Null s'il n'y en a aucune : « Chartreuse » ne retrouve jamais « Hauts de Chartreuse ».
 */
export function pickArea(rows: readonly GeoAreaRow[], name: string): GeoAreaRow | null {
  const key = normalizeAreaName(name);
  if (!key) return null;
  let best: GeoAreaRow | null = null;
  for (const r of rows) {
    if (r.name_plain !== key) continue;
    if (!best || spanOf(r) > spanOf(best) || (spanOf(r) === spanOf(best) && r.osm_id < best.osm_id))
      best = r;
  }
  return best;
}
