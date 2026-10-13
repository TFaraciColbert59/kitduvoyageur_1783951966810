/**
 * Compas — grandes îles à pied (PLAN-100 4.5). Module PUR : aucune I/O, même
 * entrée → même zone.
 *
 * Une grande île (Sardaigne, Corse, Crète, Sicile…) n'est ni un massif ni un
 * pays : à pied, on ne la traverse pas en voiture d'étape en étape, et son
 * centre géométrique n'est presque jamais là où l'on randonne (Sicile : une
 * plaine près d'Enna). On cherche donc LE massif de l'île, à partir des seuls
 * lieux habités que la carte ou le référentiel ont rendus avec leur altitude :
 * la zone est celle où les lieux sont, ensemble, les plus au-dessus du niveau
 * ordinaire de l'île. Aucun nom de massif n'est écrit ici ni deviné : sans
 * altitudes, sans lieu dit par la personne, on ne choisit rien (null).
 *
 * Une île n'est pas un cercle. Près du continent du même pays (Eubée, Sicile et la
 * Calabre), la boîte de la carte et le cercle autour de son centre englobent des
 * lieux du continent, parfois plus hauts : ils emporteraient le score et sortiraient
 * l'itinéraire de l'île. Chaque lieu (et le lieu dit) est donc validé contre le
 * CONTOUR de l'île (`IslandContour`, polygone OpenStreetMap) ; sans contour, rien
 * n'est choisi : jamais un lieu du continent.
 */
import { lonDelta, wrapLon } from './longitude';
import { planningZoneKm, type AreaPlace } from './itinerary';
import { distanceKm } from './places';

/** Natures OSM d'une île (`place=island`) qu'une destination peut porter. */
const ISLAND_KINDS: ReadonlySet<string> = new Set(['island', 'islet']);
const ISLAND_TAG = /^place=(island|islet)$/;

/**
 * La destination est-elle une île ? Par sa nature (Nominatim et Geoapify rendent
 * « island »), ou par son étiquette OSM gardée avec l'ancre (Photon range une
 * île sous « other » : l'étiquette `place=island` est alors la seule trace).
 */
export function isIslandAnchor(anchor: { kind?: string | null; osmTag?: string | null }): boolean {
  return ISLAND_KINDS.has(anchor.kind ?? '') || ISLAND_TAG.test(anchor.osmTag ?? '');
}

/**
 * Altitudes connues qu'il faut au moins pour parler du relief d'une île :
 * la même borne que `keepHighlands` (en dessous, la médiane ne veut rien dire).
 */
export const ISLAND_MIN_RELIEF_PLACES = 10;

/** Natures de lieux habités qui disent où est le massif (ni refuge, ni camping). */
const SETTLEMENT = new Set<AreaPlace['kind']>(['city', 'town', 'village', 'hamlet']);

/**
 * Contour d'une île : un ou plusieurs polygones, chacun un anneau extérieur puis ses trous, sommets
 * `[longitude, latitude]` (GeoJSON `Polygon` ou `MultiPolygon`, tel que Nominatim le rend).
 */
export interface IslandContour {
  polygons: ReadonlyArray<ReadonlyArray<ReadonlyArray<readonly [number, number]>>>;
}

/** Au-delà, un contour est écarté (un polygone de cette taille n'est pas celui d'une île simplifiée). */
const MAX_CONTOUR_VERTICES = 60_000;
/**
 * Un lieu côtier à moins de cette distance (km) du trait de côte reste « sur l'île » : le contour est
 * simplifié par la carte (quelques centaines de mètres). Assez court pour qu'un lieu de l'autre rive d'un
 * détroit large ne s'y glisse pas.
 */
export const COAST_TOLERANCE_KM = 0.5;

const validPoint = (c: unknown): c is [number, number] =>
  Array.isArray(c) &&
  c.length >= 2 &&
  typeof c[0] === 'number' &&
  typeof c[1] === 'number' &&
  Number.isFinite(c[0]) &&
  Number.isFinite(c[1]) &&
  Math.abs(c[0]) <= 180 &&
  Math.abs(c[1]) <= 90;

/** Un anneau GeoJSON lisible (4 sommets valides au moins), arrondi à ~10 m, ou null. */
function parseRing(ring: unknown): Array<readonly [number, number]> | null {
  if (!Array.isArray(ring) || ring.length < 4 || !ring.every(validPoint)) return null;
  return (ring as Array<[number, number]>).map(([lon, lat]) => [Math.round(lon * 1e4) / 1e4, Math.round(lat * 1e4) / 1e4] as const);
}

/**
 * Le contour d'une île d'après la géométrie GeoJSON que la carte rend (`Polygon`, `MultiPolygon`), ou null
 * quand elle n'en est pas une, est illisible ou démesurée : l'appelant ne choisit alors rien.
 */
export function parseIslandContour(geometry: unknown): IslandContour | null {
  if (!geometry || typeof geometry !== 'object') return null;
  const g = geometry as { type?: unknown; coordinates?: unknown };
  const raw: unknown[] =
    g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' && Array.isArray(g.coordinates) ? g.coordinates : [];
  const polygons: Array<Array<Array<readonly [number, number]>>> = [];
  let vertices = 0;
  for (const poly of raw) {
    if (!Array.isArray(poly) || poly.length === 0) continue;
    const outer = parseRing(poly[0]);
    if (!outer) continue;
    const holes = poly.slice(1).map(parseRing).filter((r): r is Array<readonly [number, number]> => r != null);
    vertices += outer.length + holes.reduce((t, r) => t + r.length, 0);
    if (vertices > MAX_CONTOUR_VERTICES) return null;
    polygons.push([outer, ...holes]);
  }
  return polygons.length ? { polygons } : null;
}

/** Le point est-il dans l'anneau ? Tir de rayon, longitudes ramenées au point (l'antiméridien ne coupe pas l'anneau). */
function inRing(ring: ReadonlyArray<readonly [number, number]>, p: { lat: number; lon: number }): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = lonDelta(p.lon, ring[i][0]);
    const yi = ring[i][1] - p.lat;
    const xj = lonDelta(p.lon, ring[j][0]);
    const yj = ring[j][1] - p.lat;
    if (yi > 0 !== yj > 0 && 0 < ((xj - xi) * (0 - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Distance (km) du point au trait de l'anneau, au plus `capKm` (au-delà, on ne cherche plus). */
function nearRing(ring: ReadonlyArray<readonly [number, number]>, p: { lat: number; lon: number }, capKm: number): boolean {
  const kx = 111.32 * Math.cos((p.lat * Math.PI) / 180);
  const ky = 110.57;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const ax = lonDelta(p.lon, ring[j][0]) * kx;
    const ay = (ring[j][1] - p.lat) * ky;
    const bx = lonDelta(p.lon, ring[i][0]) * kx;
    const by = (ring[i][1] - p.lat) * ky;
    // Écarte vite les segments dont la boîte est hors de portée.
    if (Math.min(ax, bx) > capKm || Math.max(ax, bx) < -capKm || Math.min(ay, by) > capKm || Math.max(ay, by) < -capKm) continue;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (-ax * dx - ay * dy) / len2));
    if (Math.hypot(ax + t * dx, ay + t * dy) <= capKm) return true;
  }
  return false;
}

/**
 * Le lieu est-il SUR l'île ? Dans l'un de ses polygones (hors trous), ou à moins de {@link COAST_TOLERANCE_KM}
 * de son trait de côte. Un lieu du continent, même dans la boîte de l'île, est faux.
 */
export function onIslandContour(contour: IslandContour, p: { lat: number; lon: number }): boolean {
  for (const [outer, ...holes] of contour.polygons) {
    if (inRing(outer, p) && !holes.some((h) => inRing(h, p))) return true;
  }
  return contour.polygons.some((rings) => rings.some((ring) => nearRing(ring, p, COAST_TOLERANCE_KM)));
}

/** Un lieu dont l'altitude est connue. */
type Known = AreaPlace & { eleM: number };

/** Rayon (km) de la zone où l'on randonne sur une île : celui d'un lieu naturel sans emprise pour l'activité et la durée. */
export function islandZoneKm(activity: string, days: number): number {
  return planningZoneKm({ activity, days, halfExtentKm: null, settlement: false });
}

/** Une île qui ne tient pas dans sa zone de randonnée : son centre ne dit plus où aller, il faut choisir le massif. */
export function isLargeIsland(halfExtentKm: number | null | undefined, activity: string, days: number): boolean {
  return halfExtentKm != null && Number.isFinite(halfExtentKm) && halfExtentKm > islandZoneKm(activity, days);
}

export interface IslandZoneInput {
  /** Lieux réels de l'île, avec l'altitude quand elle est lue. */
  places: readonly AreaPlace[];
  /** L'île : son centre et la demi-diagonale de son emprise (km). */
  island: { lat: number; lon: number; halfExtentKm: number };
  /**
   * Le contour de l'île. Sans lui (null) on ne choisit rien : l'emprise et le cercle de l'île englobent
   * des lieux du continent proche, qu'aucun calcul ne sait distinguer de ceux de l'île.
   */
  contour: IslandContour | null;
  activity: string;
  days: number;
  /** Lieu dit par la personne, déjà retrouvé sur l'île : la zone s'y centre. */
  near?: { name?: string; lat: number; lon: number } | null;
}

export interface IslandZone {
  /** Centre de la zone (un point de recherche, pas forcément un lieu). */
  center: { lat: number; lon: number };
  /** Rayon de la zone (km) : celui d'un voyage à pied dans un lieu naturel, jamais plus de 48. */
  radiusKm: number;
  /** Le lieu de la carte le plus proche du centre : nomme le choix à l'écran. */
  around: string | null;
  /** Altitude du lieu le plus haut de la zone (m), si une altitude est connue. */
  highestM: number | null;
  /** Lieux habités de la zone dont l'altitude est connue. */
  places: number;
  why: 'altitude' | 'lieu dit';
}

/** Altitude au-dessus de laquelle un lieu compte pour le massif : la médiane des lieux de l'île (comme `keepHighlands`). */
function medianEle(eles: readonly number[]): number {
  const sorted = [...eles].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * La zone où randonner sur une grande île, ou null (île qui tient dans sa propre
 * zone, relief inconnu). Le rayon est celui que le planificateur donnerait à un
 * lieu naturel sans emprise (`planningZoneKm`) : le reste du calcul ne change pas.
 */
export function pickIslandZone(input: IslandZoneInput): IslandZone | null {
  const radiusKm = islandZoneKm(input.activity, input.days);
  // Une île qui tient dans une zone n'a pas de massif à choisir : le centre convient.
  if (!isLargeIsland(input.island.halfExtentKm, input.activity, input.days)) return null;
  const { contour } = input;
  // Sans contour : jamais de lieu du continent pris pour un lieu de l'île.
  if (!contour) return null;

  const onIsland = input.places.filter((p) => SETTLEMENT.has(p.kind) && onIslandContour(contour, p));
  const nearest = (c: { lat: number; lon: number }) => {
    let top: AreaPlace | null = null;
    let topKm = Infinity;
    for (const p of onIsland) {
      const d = distanceKm(c, p);
      if (d < topKm || (d === topKm && top && p.id < top.id)) {
        top = p;
        topKm = d;
      }
    }
    return top?.name ?? null;
  };
  const known = onIsland.filter((p): p is Known => p.eleM != null && Number.isFinite(p.eleM));
  const inZone = (c: { lat: number; lon: number }) => known.filter((p) => distanceKm(c, p) <= radiusKm);
  const highest = (c: { lat: number; lon: number }) => inZone(c).reduce<number | null>((m, p) => (m == null || p.eleM > m ? p.eleM : m), null);

  // La personne a dit un lieu de l'île : c'est lui, le reste de l'île n'est pas son voyage.
  if (input.near && onIslandContour(contour, input.near)) {
    const center = { lat: input.near.lat, lon: input.near.lon };
    return {
      center,
      radiusKm,
      around: input.near.name ?? nearest(center),
      highestM: highest(center),
      places: inZone(center).length,
      why: 'lieu dit',
    };
  }

  if (known.length < ISLAND_MIN_RELIEF_PLACES) return null;
  const ordinary = medianEle(known.map((p) => p.eleM));
  // Chaque lieu au-dessus du niveau ordinaire de l'île est un centre possible ; sa zone vaut la somme de
  // ce que ses lieux dépassent ce niveau : plusieurs lieux hauts ensemble font un massif, un seul n'en fait pas.
  let top: { center: Known; score: number } | null = null;
  const candidates = [...known].filter((p) => p.eleM > ordinary).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const c of candidates) {
    const score = inZone(c).reduce((t, p) => t + Math.max(0, p.eleM - ordinary), 0);
    if (!top || score > top.score + 1e-9 || (Math.abs(score - top.score) <= 1e-9 && c.eleM > top.center.eleM)) top = { center: c, score };
  }
  if (!top) return null;

  // Le centre de la zone : le barycentre des lieux hauts qu'elle réunit, pas le seul lieu de départ du calcul.
  const members = inZone(top.center).filter((p) => p.eleM > ordinary);
  const weight = (p: Known) => p.eleM - ordinary;
  const total = members.reduce((t, p) => t + weight(p), 0);
  const lat = members.reduce((t, p) => t + p.lat * weight(p), 0) / total;
  const lon = wrapLon(top.center.lon + members.reduce((t, p) => t + lonDelta(top!.center.lon, p.lon) * weight(p), 0) / total);
  const center = { lat, lon };
  return { center, radiusKm, around: nearest(center), highestM: highest(center), places: inZone(center).length, why: 'altitude' };
}
