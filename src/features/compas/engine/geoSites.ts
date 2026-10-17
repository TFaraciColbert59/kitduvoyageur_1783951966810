/**
 * Référentiel des sites d'escalade et de ski (plan 3.5) : `public.geo_sites`, OpenStreetMap (ODbL),
 * importé hors Vercel par `scripts/geo/import_geo_sites.ts`, tuile par tuile, comme `geo_pois`.
 *
 * But : qu'« escalade à Kalymnos » se pose là où sont les falaises (le groupe de secteurs le plus
 * dense, `densestSite`) et que « Dolomites via ferrata » trouve des via ferrata réelles autour des
 * étapes (`sitesAround`), au lieu du centre de l'île ou du massif. Fonctions pures, partagées par
 * l'import et par la lecture ; rien n'est deviné : nom ou altitude absents d'OSM restent absents.
 *
 * CHOIX DES ÉTIQUETTES OSM (une nature par ligne, la première qui s'applique, dans cet ordre) :
 * - `via_ferrata` : `highway=via_ferrata` (chemin, l'étiquette principale du wiki OSM) ou
 *   `climbing=via_ferrata`. `via_ferrata_scale` seul n'est PAS retenu : il se pose aussi sur un
 *   tronçon de sentier ordinaire, qui n'est pas une via ferrata.
 * - `crag` (falaise, `climbing=crag`) et `climbing_area` (secteur ou zone, `climbing=area`), avec
 *   `sport=climbing` (seul ou dans une liste « climbing;bouldering »). `climbing=route_bottom`,
 *   `route` et `boulder` sont exclus : une ligne par voie ou par bloc, des dizaines de milliers
 *   d'objets dont le Compas n'a pas l'usage (il choisit un lieu d'étape, pas une voie). Une salle
 *   (`leisure=sports_centre|fitness_centre`, `indoor=yes`) est écartée : ce n'est pas un site naturel.
 * - `winter_sports` : `landuse=winter_sports`, le domaine skiable. C'est la seule étiquette OSM
 *   courante qui désigne une « station » au sens du skieur.
 * - `aerialway_station` : `aerialway=station`, une GARE de remontée (téléphérique, télécabine,
 *   télésiège). Nommée ainsi et non « station de ski » : OSM ne dit pas qu'elle sert au ski (beaucoup
 *   servent l'été, souvent l'accès à une via ferrata). Seules les gares nommées sont demandées (les
 *   autres sont innombrables et ne se distinguent pas).
 *
 * Écartés et comptés : privé ou interdit (`access=private|no`), abandonné (`disused`, `abandoned`,
 * `ruins`, `state=proposed`), sans nom (ou nom commun : « Via ferrata », « Falaise », « Bergstation »),
 * sans position, doublon d'identifiant, et tronçons d'un même site (`meme_site` : même nature, même nom
 * normalisé, à moins de 2 km, cas courant des via ferrata découpées en plusieurs chemins OSM).
 */
import { parseElevationM, type BBox } from './geoPois';
import { distanceKm } from './places';
import type { CompasActivity } from './intent';

export type GeoSiteKind =
  'crag' | 'climbing_area' | 'via_ferrata' | 'winter_sports' | 'aerialway_station';

export const GEO_SITE_KINDS: readonly GeoSiteKind[] = [
  'crag',
  'climbing_area',
  'via_ferrata',
  'winter_sports',
  'aerialway_station',
];

/** Une ligne de `public.geo_sites` (ce que l'import écrit et la lecture rend). */
export interface GeoSiteRow {
  /** « n123 » (nœud), « w456 » (chemin), « r789 » (relation). */
  osm_id: string;
  kind: GeoSiteKind;
  /** Toujours un nom propre : un site sans nom n'est pas importé. */
  name: string;
  /** Position du nœud, ou centre de l'objet (`out center`). */
  lat: number;
  lon: number;
  /** Altitude saisie dans OSM (`ele`), null sinon : jamais devinée. */
  ele_m: number | null;
}

/* ---------- Requête Overpass d'une tuile ---------- */

/** UNE requête par tuile : falaises et secteurs, via ferrata, domaines skiables, gares de remontée nommées. */
export function buildGeoSitesQuery(box: BBox, serverTimeoutS = 180): string {
  const [w, s, e, n] = box;
  const bb = `(${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)})`;
  return (
    `[out:json][timeout:${serverTimeoutS}];(` +
    `nwr["sport"~"(^|;)climbing(;|$)"]["climbing"~"^(crag|area)$"]${bb};` +
    `way["highway"="via_ferrata"]${bb};` +
    `nwr["climbing"="via_ferrata"]${bb};` +
    `nwr["landuse"="winter_sports"]${bb};` +
    `nwr["aerialway"="station"]["name"]${bb};` +
    `);out center tags;`
  );
}

/* ---------- Lecture d'une réponse Overpass ---------- */

export type SiteDropReason =
  | 'sans_position'
  | 'sans_nature'
  | 'salle'
  | 'prive'
  | 'abandonne'
  | 'sans_nom'
  | 'doublon'
  | 'meme_site';

export interface ParsedGeoSites {
  rows: GeoSiteRow[];
  dropped: Partial<Record<SiteDropReason, number>>;
  /** Éléments lus dans la réponse, avant tout filtre. */
  elements: number;
}

/** Tronçons d'un même site : même nature, même nom normalisé, centres à moins de cette distance. */
const SAME_SITE_KM = 2;

/** Noms communs qui ne désignent aucun site (plusieurs langues des Alpes), comparés au nom normalisé. */
const GENERIC_SITE_NAME =
  /^(?:via ferrata|ferrata|klettersteig|falaise|falaises|crag|cliff|climbing( area| site| crag)?|escalade|site d escalade|secteur|sector|settore|sektor|klettergebiet|klettergarten|palestra|bloc|boulder|ski area|ski resort|domaine skiable|station de ski|station|skigebiet|comprensorio sciistico|stazione|gare|gare amont|gare aval|gare d arrivee|gare de depart|bergstation|talstation|mittelstation|stazione a monte|stazione a valle|top station|bottom station|valley station|mountain station)(?:\s*\d+)?$/;

/** Nom → clé de comparaison : sans accents, sans ponctuation, en minuscules, espaces simples. */
export function normalizeSiteName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function siteName(tags: Record<string, string>): string | null {
  const n = (tags['name:fr'] || tags.name || tags['name:en'] || '').trim().slice(0, 140);
  if (!n) return null;
  return GENERIC_SITE_NAME.test(normalizeSiteName(n)) ? null : n;
}

const hasValue = (list: string | undefined, value: string) =>
  (list ?? '')
    .split(';')
    .map((v) => v.trim().toLowerCase())
    .includes(value);

function kindOf(tags: Record<string, string>): GeoSiteKind | null {
  if (tags.highway === 'via_ferrata' || tags.climbing === 'via_ferrata') return 'via_ferrata';
  if (hasValue(tags.sport, 'climbing')) {
    if (tags.climbing === 'crag') return 'crag';
    if (tags.climbing === 'area') return 'climbing_area';
  }
  if (tags.landuse === 'winter_sports') return 'winter_sports';
  if (tags.aerialway === 'station') return 'aerialway_station';
  return null;
}

const round5 = (v: number) => Math.round(v * 1e5) / 1e5;
const byOsmId = (a: GeoSiteRow, b: GeoSiteRow) =>
  a.osm_id < b.osm_id ? -1 : a.osm_id > b.osm_id ? 1 : 0;

/** Réponse Overpass → lignes du référentiel. Écarte (et compte) ce qui n'est pas un site utilisable. */
export function parseGeoSites(payload: unknown): ParsedGeoSites {
  const els = (payload as { elements?: unknown[] } | null)?.elements;
  const out: ParsedGeoSites = {
    rows: [],
    dropped: {},
    elements: Array.isArray(els) ? els.length : 0,
  };
  if (!Array.isArray(els)) return out;
  const drop = (r: SiteDropReason) => {
    out.dropped[r] = (out.dropped[r] ?? 0) + 1;
  };
  const seen = new Set<string>();
  const kept: GeoSiteRow[] = [];
  for (const raw of els) {
    const e = raw as {
      type?: string;
      id?: number;
      lat?: number;
      lon?: number;
      center?: { lat?: number; lon?: number };
      tags?: Record<string, string>;
    };
    const tags = e.tags ?? {};
    const lat = Number(e.lat ?? e.center?.lat);
    const lon = Number(e.lon ?? e.center?.lon);
    if (
      e.id == null ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    ) {
      drop('sans_position');
      continue;
    }
    const kind = kindOf(tags);
    if (!kind) {
      drop('sans_nature');
      continue;
    }
    if (
      (kind === 'crag' || kind === 'climbing_area') &&
      (tags.leisure === 'sports_centre' ||
        tags.leisure === 'fitness_centre' ||
        tags.indoor === 'yes')
    ) {
      drop('salle');
      continue;
    }
    if (tags.access === 'private' || tags.access === 'no') {
      drop('prive');
      continue;
    }
    if (
      tags.disused === 'yes' ||
      tags.abandoned === 'yes' ||
      tags.ruins === 'yes' ||
      (tags.state || '').toLowerCase() === 'proposed'
    ) {
      drop('abandonne');
      continue;
    }
    const name = siteName(tags);
    if (!name) {
      drop('sans_nom');
      continue;
    }
    const osmId = `${(e.type ?? 'node')[0]}${e.id}`;
    if (seen.has(osmId)) {
      drop('doublon');
      continue;
    }
    seen.add(osmId);
    kept.push({
      osm_id: osmId,
      kind,
      name,
      lat: round5(lat),
      lon: round5(lon),
      ele_m: parseElevationM(tags.ele),
    });
  }
  // Tronçons d'un même site : on garde le plus petit identifiant (résultat stable d'un import à l'autre).
  kept.sort(byOsmId);
  for (const r of kept) {
    const key = normalizeSiteName(r.name);
    const twin = out.rows.find(
      (o) =>
        o.kind === r.kind && normalizeSiteName(o.name) === key && distanceKm(o, r) < SAME_SITE_KM
    );
    if (twin) {
      drop('meme_site');
      continue;
    }
    out.rows.push(r);
  }
  return out;
}

/* ---------- Lecture et choix par le Compas ---------- */

/** Les natures utiles à une activité du Compas ; null pour une activité sans site dédié. */
export function siteKindsFor(activity: CompasActivity): readonly GeoSiteKind[] | null {
  if (activity === 'climbing') return ['crag', 'climbing_area', 'via_ferrata'];
  if (activity === 'ski') return ['winter_sports', 'aerialway_station'];
  return null;
}

export type GeoSiteNear = GeoSiteRow & { distance_km: number };

/** Les sites à moins de `radiusKm` du point, du plus proche au plus loin (à égalité, par identifiant). */
export function sitesAround(
  rows: readonly GeoSiteRow[],
  point: { lat: number; lon: number },
  radiusKm: number,
  kinds?: readonly GeoSiteKind[]
): GeoSiteNear[] {
  const out: GeoSiteNear[] = [];
  for (const r of rows) {
    if (kinds && !kinds.includes(r.kind)) continue;
    const d = distanceKm(point, r);
    if (d <= radiusKm) out.push({ ...r, distance_km: Math.round(d * 100) / 100 });
  }
  return out.sort((a, b) => a.distance_km - b.distance_km || byOsmId(a, b));
}

/**
 * Le site qui a le plus de voisins (lui compris) à moins de `radiusKm` : le cœur d'une zone
 * d'escalade ou de ski, là où poser les nuits. À égalité, le plus petit identifiant. Null s'il n'y a
 * aucun site de ces natures. Coût quadratique : à appeler sur les lignes d'une zone, pas d'un pays.
 *
 * `tieKinds` (second signal, le ski : les gares de remontée) : à égalité de voisins, le site qui a le
 * plus de voisins de ces natures-là l'emporte (`second`). Ils ne sont jamais le cœur eux-mêmes.
 */
export function densestSite(
  rows: readonly GeoSiteRow[],
  radiusKm: number,
  kinds?: readonly GeoSiteKind[],
  tieKinds?: readonly GeoSiteKind[]
): { site: GeoSiteRow; count: number; second: number } | null {
  const pool = rows.filter((r) => !kinds || kinds.includes(r.kind));
  const tiePool = tieKinds ? rows.filter((r) => tieKinds.includes(r.kind)) : [];
  let best: { site: GeoSiteRow; count: number; second: number } | null = null;
  for (const r of pool) {
    let count = 0;
    for (const o of pool) if (distanceKm(r, o) <= radiusKm) count += 1;
    let second = 0;
    for (const o of tiePool) if (distanceKm(r, o) <= radiusKm) second += 1;
    if (
      !best ||
      count > best.count ||
      (count === best.count &&
        (second > best.second || (second === best.second && r.osm_id < best.site.osm_id)))
    )
      best = { site: r, count, second };
  }
  return best;
}

/**
 * Les sites dont le nom correspond : le nom exact d'abord, puis ceux qui contiennent tous les mots
 * demandés, en mots entiers (« Essai » ne trouve pas « Essaimage »), les plus courts d'abord.
 */
export function findSitesByName(rows: readonly GeoSiteRow[], query: string): GeoSiteRow[] {
  const key = normalizeSiteName(query);
  if (!key) return [];
  const words = key.split(' ');
  const exact: GeoSiteRow[] = [];
  const partial: GeoSiteRow[] = [];
  for (const r of rows) {
    const n = normalizeSiteName(r.name);
    if (n === key) exact.push(r);
    else {
      const have = new Set(n.split(' '));
      if (words.every((w) => have.has(w))) partial.push(r);
    }
  }
  exact.sort(byOsmId);
  partial.sort((a, b) => a.name.length - b.name.length || byOsmId(a, b));
  return [...exact, ...partial];
}
