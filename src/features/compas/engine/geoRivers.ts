/**
 * Référentiel des rivières navigables (plan 3.6) : `public.geo_rivers`, OpenStreetMap (ODbL),
 * importé hors Vercel par `scripts/geo/import_geo_rivers.ts`.
 *
 * À quoi il sert : la descente en canoë (`engine/river.ts`) part d'une rivière retrouvée sur la carte
 * (`lookupRiver` dans `server/placeLookup.ts`, Photon), qui ne la rend souvent qu'avec son article
 * (« Le Tarn ») ou pas du tout quand la phrase dit « Río Colorado » et la carte « Colorado River ».
 * Le référentiel donne, pour un nom normalisé, le centre et l'emprise de la rivière (l'emprise sert
 * ensuite à `riverQuery`, au format du Compas grâce à `riverExtent`), plus ce qu'OSM dit de la pratique :
 * accès en canoë et difficulté d'eau vive.
 *
 * Choix (à relire avant de brancher) :
 * - Deux sortes de lignes. Les relations `waterway=river` nommées, gardées toutes (la rivière entière,
 *   même sans `canoe=*` : c'est le tracé que suit la descente). Les tronçons (ways) `waterway=river`
 *   seulement s'ils portent `canoe=*` ou `whitewater=*` : ce sont eux qui disent où l'on pagaie.
 * - `canoe` : `yes` et `designated` → « yes », `permissive` et `portage` gardés tels quels, toute autre
 *   valeur → null (inconnu, pas « interdit »). `canoe=no` écarte la ligne : on ne propose pas une
 *   descente là où OSM la dit interdite.
 * - `whitewater_grade` : `whitewater:section_grade`, sinon `rapids`, en chiffres (0 à 6) ou en
 *   romains (I à VI). Une fourchette (« 2-4 ») garde le plus difficile ; un texte libre (« facile ») → null.
 * - `length_km` : JAMAIS tirée de l'emprise (sa diagonale n'est qu'un minimum, une rivière sinueuse
 *   est bien plus longue) ; seulement le tag `distance` quand OSM le donne en kilomètres, sinon null.
 * - Nom affiché : `name` (le nom local, celui de la carte). Nom de recherche `name_plain` : sans accent,
 *   sans article, sans mot générique (« Río », « River », « Fluss », « Fleuve », « Rivière », « Torrente »,
 *   « Gave », « Fiume »), en minuscules. `alt_plain` garde les autres noms (français, anglais…) pour que
 *   « le Rhin » retrouve « Rhein ». Effet connu : « Rio Grande » se range sous « grande » ; la demande
 *   est normalisée de la même façon, et le choix (`pickRiver`) départage par le lieu visé.
 *
 * Fonctions pures, partagées par l'import et par la lecture. Rien n'est deviné.
 */
import type { BBox } from './geoPois';

export type RiverCanoe = 'yes' | 'permissive' | 'portage';

/** Une ligne de `public.geo_rivers`. Centre et emprise de l'objet OSM, en degrés. */
export interface GeoRiverRow {
  /** « r123 » (relation : la rivière entière) ou « w123 » (tronçon portant `canoe=*`/`whitewater=*`). */
  osm_id: string;
  name: string;
  /** Nom de recherche : sans accent, sans article ni mot générique, en minuscules (« tarn », « colorado »). */
  name_plain: string;
  /** Les autres noms OSM (`name:fr`, `name:en`…), normalisés de même, sans répéter `name_plain`. */
  alt_plain: string[];
  canoe: RiverCanoe | null;
  /** Difficulté d'eau vive, 0 à 6 (échelle internationale I à VI), null si OSM ne la donne pas. */
  whitewater_grade: number | null;
  /** Longueur déclarée dans OSM (`distance`, km), jamais estimée ; null le plus souvent. */
  length_km: number | null;
  lat: number;
  lon: number;
  west: number;
  south: number;
  east: number;
  north: number;
}

/**
 * UNE requête par tuile : les relations de rivière, et les tronçons de rivière qui disent quelque chose
 * de la pratique (canoë, eau vive). Centre, emprise et étiquettes, jamais la géométrie.
 */
export function buildGeoRiversQuery(box: BBox, serverTimeoutS = 180): string {
  const [w, s, e, n] = box;
  const bb = `(${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)})`;
  return (
    `[out:json][timeout:${serverTimeoutS}];(` +
    `rel["waterway"="river"]${bb};` +
    `way["waterway"="river"]["canoe"]${bb};` +
    `way["waterway"="river"]["whitewater"]${bb};` +
    `);out center bb tags;`
  );
}

/** Articles en tête d'un nom (« Le Tarn », « The Thames », « El Ebro », « Der Inn »). */
const ARTICLES = new Set([
  'le',
  'la',
  'les',
  'l',
  'the',
  'el',
  'los',
  'las',
  'il',
  'lo',
  'der',
  'die',
  'das',
]);
/** Mots qui disent « rivière » sans la nommer. « Riviera » n'en est pas un (une côte). */
const GENERIC = new Set([
  'rio',
  'river',
  'fluss',
  'fleuve',
  'riviere',
  'torrente',
  'gave',
  'fiume',
]);
/** Mots génériques placés après le nom (« Colorado River », « Rhein Fluss »). */
const GENERIC_SUFFIX = new Set(['river', 'fluss']);
/** Liaisons entre le mot générique et le nom (« Gave de Pau », « Rivière des Prairies », « Río de la Plata »). */
const LINKS = new Set([
  'de',
  'du',
  'des',
  'del',
  'della',
  'dello',
  'di',
  'd',
  'of',
  'the',
  'la',
  'le',
  'les',
  'l',
]);

/**
 * Nom de rivière → clé de recherche. « Le Tarn » et « Tarn » → « tarn » ; « Río Colorado » et
 * « Colorado River » → « colorado ». Null si vide, démesuré ou seulement un mot générique (« la rivière »).
 */
export function normalizeRiverName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const words = raw
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  // On ne retire un mot que s'il en reste un autre : une rivière « Lo » reste « lo ».
  if (words.length > 1 && ARTICLES.has(words[0])) words.shift();
  if (words.length && GENERIC.has(words[0])) {
    if (words.length === 1) return null;
    words.shift();
    while (words.length > 1 && LINKS.has(words[0])) words.shift();
  } else if (words.length > 1 && GENERIC_SUFFIX.has(words[words.length - 1])) {
    words.pop();
  }
  const key = words.join(' ');
  return key.length >= 2 && key.length <= 80 ? key : null;
}

export type RiverDropReason =
  'doublon' | 'sans_nom' | 'sans_emprise' | 'canoe_interdit' | 'sans_pagaie' | 'pas_riviere';

export interface ParsedGeoRivers {
  rows: GeoRiverRow[];
  dropped: Partial<Record<RiverDropReason, number>>;
  /** Éléments lus dans la réponse, avant tout filtre. */
  elements: number;
}

function canoeOf(v: string | undefined): RiverCanoe | null {
  switch ((v ?? '').trim().toLowerCase()) {
    case 'yes':
    case 'designated':
      return 'yes';
    case 'permissive':
      return 'permissive';
    case 'portage':
      return 'portage';
    default:
      return null;
  }
}

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6 };

/** « 3 », « III », « 2-4 », « 3+ » → le degré le plus difficile ; texte libre → null. */
export function whitewaterGrade(v: string | undefined): number | null {
  const parts = (v ?? '')
    .toLowerCase()
    .split(/[^0-9a-z]+/)
    .filter(Boolean);
  if (!parts.length) return null;
  let max = -1;
  for (const p of parts) {
    const g = /^[0-6]$/.test(p) ? Number(p) : ROMAN[p];
    if (g == null) return null;
    max = Math.max(max, g);
  }
  return max;
}

function lengthOf(v: string | undefined): number | null {
  const t = (v ?? '').trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(t)) return null;
  const km = Number(t.replace(',', '.'));
  return km > 0 && km <= 7000 ? Math.round(km * 10) / 10 : null;
}

const ALT_KEYS = [
  'name:fr',
  'name:en',
  'name:de',
  'name:es',
  'name:it',
  'name:pt',
  'official_name',
  'alt_name',
];

function altPlain(tags: Record<string, string>, main: string): string[] {
  const out: string[] = [];
  for (const k of ALT_KEYS) {
    for (const n of (tags[k] ?? '').split(';')) {
      const key = normalizeRiverName(n);
      if (key && key !== main && !out.includes(key)) out.push(key);
    }
  }
  return out.slice(0, 8);
}

const round5 = (v: number) => Math.round(v * 1e5) / 1e5;

/** Réponse Overpass → lignes. Écarte (et compte) ce qui n'est pas une rivière utilisable. */
export function parseGeoRivers(payload: unknown): ParsedGeoRivers {
  const els = (payload as { elements?: unknown[] } | null)?.elements;
  const out: ParsedGeoRivers = {
    rows: [],
    dropped: {},
    elements: Array.isArray(els) ? els.length : 0,
  };
  if (!Array.isArray(els)) return out;
  const drop = (r: RiverDropReason) => {
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
    const isRel = e.type === 'relation';
    if ((!isRel && e.type !== 'way') || tags.waterway !== 'river') {
      drop('pas_riviere');
      continue;
    }
    if ((tags.canoe ?? '').trim().toLowerCase() === 'no') {
      drop('canoe_interdit');
      continue;
    }
    if (!isRel && tags.canoe == null && tags.whitewater == null) {
      drop('sans_pagaie');
      continue;
    }
    const b = e.bounds;
    const w = Number(b?.minlon);
    const s = Number(b?.minlat);
    const ea = Number(b?.maxlon);
    const n = Number(b?.maxlat);
    // `out center bb` : Overpass n'honore qu'un seul des deux ; sans `center`, le milieu de l'emprise en tient lieu.
    const lat = e.center?.lat != null ? Number(e.center.lat) : (s + n) / 2;
    const lon = e.center?.lon != null ? Number(e.center.lon) : (w + ea) / 2;
    const valid =
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
    const name = (tags.name || tags['name:fr'] || tags['name:en'] || '').trim().slice(0, 140);
    const plain = normalizeRiverName(name);
    if (!plain) {
      drop('sans_nom');
      continue;
    }
    const osmId = `${isRel ? 'r' : 'w'}${e.id}`;
    if (seen.has(osmId)) {
      drop('doublon');
      continue;
    }
    seen.add(osmId);
    out.rows.push({
      osm_id: osmId,
      name,
      name_plain: plain,
      alt_plain: altPlain(tags, plain),
      canoe: canoeOf(tags.canoe),
      whitewater_grade: whitewaterGrade(tags['whitewater:section_grade'] ?? tags.rapids),
      length_km: lengthOf(tags.distance),
      lat: round5(lat),
      lon: round5(lon),
      west: round5(w),
      south: round5(s),
      east: round5(ea),
      north: round5(n),
    });
  }
  out.rows.sort((a, b) => (a.osm_id < b.osm_id ? -1 : a.osm_id > b.osm_id ? 1 : 0));
  return out;
}

const spanOf = (r: GeoRiverRow) => (r.east - r.west) * (r.north - r.south);
const contains = (r: GeoRiverRow, p: { lat: number; lon: number }) =>
  p.lat >= r.south && p.lat <= r.north && p.lon >= r.west && p.lon <= r.east;

/**
 * La rivière qui porte exactement ce nom (principal ou autre nom OSM), après normalisation. Départage :
 * d'abord celle dont l'emprise contient `near` (le lieu visé, s'il est connu), puis la rivière entière
 * (relation) plutôt qu'un tronçon, puis la plus étendue, enfin l'identifiant le plus petit (stable).
 * Null si aucune : « Lot » ne retrouve jamais « Lot et Garonne ».
 */
export function pickRiver(
  rows: readonly GeoRiverRow[],
  name: string,
  near?: { lat: number; lon: number } | null
): GeoRiverRow | null {
  const key = normalizeRiverName(name);
  if (!key) return null;
  const score = (r: GeoRiverRow): [number, number, number] => [
    near && contains(r, near) ? 1 : 0,
    r.osm_id.startsWith('r') ? 1 : 0,
    spanOf(r),
  ];
  let best: GeoRiverRow | null = null;
  let bestScore: [number, number, number] = [-1, -1, -1];
  for (const r of rows) {
    if (r.name_plain !== key && !r.alt_plain.includes(key)) continue;
    const s = score(r);
    const cmp = s[0] - bestScore[0] || s[1] - bestScore[1] || s[2] - bestScore[2];
    if (!best || cmp > 0 || (cmp === 0 && r.osm_id < best.osm_id)) {
      best = r;
      bestScore = s;
    }
  }
  return best;
}

/** Emprise d'une ligne dans l'ordre des lieux du Compas (`CompasPlace.extent`, `riverQuery`) : [ouest, nord, est, sud]. */
export function riverExtent(r: GeoRiverRow): [number, number, number, number] {
  return [r.west, r.north, r.east, r.south];
}
