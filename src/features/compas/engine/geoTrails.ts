/**
 * Référentiel des grands itinéraires de randonnée (plan 3.7) : `public.geo_trails`,
 * OpenStreetMap (ODbL), importé hors Vercel par `scripts/geo/import_geo_trails.ts`.
 *
 * Il remplace la liste écrite à la main de `FAMOUS_TRAILS` (« GR34 » → Bretagne) : une
 * référence lue dans la phrase (`trailRefIn`) est cherchée dans le référentiel, qui rend
 * l'emprise et le centre du tracé ; la région se déduit alors d'un lieu réel, pas d'une table.
 *
 * Fonctions pures, partagées par l'import et par la lecture. Rien n'est deviné : une
 * référence ou un nom absent d'OpenStreetMap reste null, un nom commun n'est pas un nom.
 */
import type { BBox } from './geoPois';

/** Une ligne de `public.geo_trails`. Emprise et centre du tracé entier (une relation OSM), en degrés. */
export interface GeoTrailRow {
  /** « r123 » : une relation OSM (un itinéraire est toujours une relation). */
  osm_id: string;
  /** Référence normalisée (« GR34 », « E5 », « TMB »), null si OSM n'en donne pas. */
  ref: string | null;
  name: string | null;
  /** `iwn` (international) ou `nwn` (national) : les réseaux importés. */
  network: 'iwn' | 'nwn';
  lat: number;
  lon: number;
  west: number;
  south: number;
  east: number;
  north: number;
}

/** UNE requête par tuile : les relations de randonnée des réseaux international et national, emprise et centre compris. */
export function buildGeoTrailsQuery(box: BBox, serverTimeoutS = 180): string {
  const [w, s, e, n] = box;
  const bb = `(${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)})`;
  return `[out:json][timeout:${serverTimeoutS}];rel["route"="hiking"]["network"~"^(iwn|nwn)$"]${bb};out center bb tags;`;
}

/** Référence → clé commune : « GR 34 », « gr-34 » et « GR®34 » sont la même. Null si vide ou démesurée. */
export function normalizeTrailRef(ref: unknown): string | null {
  if (typeof ref !== 'string') return null;
  const key = ref
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .toUpperCase();
  return key.length >= 1 && key.length <= 12 ? key : null;
}

/**
 * Code de sentier lu dans une phrase : « GR34 », « gr 20 », « GR 5A », « HRP ».
 * Un préfixe (lettres) suivi d'un numéro, ou un sigle connu de tous (HRP, TMB) ; jamais un mot ordinaire.
 */
const TRAIL_CODE =
  /(?:^|[^\p{L}\p{N}])((?:gr|grp|e|pr|sl|gtl)\s?-?\s?\d{1,3}[a-z]?|hrp|tmb)(?![\p{L}\p{N}])/iu;

export function trailRefIn(text: string): string | null {
  const m = TRAIL_CODE.exec(text.normalize('NFC'));
  return m ? normalizeTrailRef(m[1]) : null;
}

export type TrailDropReason =
  'doublon' | 'sans_reference_ni_nom' | 'abandonne' | 'sans_emprise' | 'hors_reseau' | 'pas_rando';

export interface ParsedGeoTrails {
  rows: GeoTrailRow[];
  dropped: Partial<Record<TrailDropReason, number>>;
  /** Éléments lus dans la réponse, avant tout filtre. */
  elements: number;
}

/** Noms communs qui ne désignent aucun sentier. */
const GENERIC_TRAIL_NAME =
  /^(?:sentier|chemin|path|trail|weg|wanderweg|sendero|sentiero|route|itin[ée]raire|randonn[ée]e)s?$/i;

function trailName(tags: Record<string, string>): string | null {
  const n = (tags['name:fr'] || tags.name || tags['name:en'] || '').trim().slice(0, 140);
  return n && !GENERIC_TRAIL_NAME.test(n) ? n : null;
}

const round5 = (v: number) => Math.round(v * 1e5) / 1e5;

/** Réponse Overpass → lignes. Écarte (et compte) ce qui n'est pas un itinéraire utilisable. */
export function parseGeoTrails(payload: unknown): ParsedGeoTrails {
  const els = (payload as { elements?: unknown[] } | null)?.elements;
  const out: ParsedGeoTrails = {
    rows: [],
    dropped: {},
    elements: Array.isArray(els) ? els.length : 0,
  };
  if (!Array.isArray(els)) return out;
  const drop = (r: TrailDropReason) => {
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
    if (tags.route !== 'hiking') {
      drop('pas_rando');
      continue;
    }
    if (tags.network !== 'iwn' && tags.network !== 'nwn') {
      drop('hors_reseau');
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
    const ref = normalizeTrailRef(tags.ref);
    const name = trailName(tags);
    if (!ref && !name) {
      drop('sans_reference_ni_nom');
      continue;
    }
    const osmId = `r${e.id}`;
    if (seen.has(osmId)) {
      drop('doublon');
      continue;
    }
    seen.add(osmId);
    out.rows.push({
      osm_id: osmId,
      ref,
      name,
      network: tags.network,
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

/** Surface de l'emprise (degrés carrés) : sert seulement à comparer des variantes d'un même sentier. */
const spanOf = (r: GeoTrailRow) => (r.east - r.west) * (r.north - r.south);

/**
 * Parmi les lignes qui portent exactement cette référence, la plus étendue (le tracé entier plutôt qu'une
 * variante ou une boucle) ; à égalité, l'identifiant le plus petit (résultat stable). Null s'il n'y en a aucune :
 * « GR5 » ne retrouve jamais « GR50 ».
 */
export function pickTrail(rows: readonly GeoTrailRow[], ref: string): GeoTrailRow | null {
  const key = normalizeTrailRef(ref);
  if (!key) return null;
  let best: GeoTrailRow | null = null;
  for (const r of rows) {
    if (r.ref !== key) continue;
    if (!best || spanOf(r) > spanOf(best) || (spanOf(r) === spanOf(best) && r.osm_id < best.osm_id))
      best = r;
  }
  return best;
}
