import { haversineKm, type RouteLeg } from './engine/routing';
import {
  MAX_ROUTE_WAYPOINTS,
  isRouteSport,
  type RouteSport,
} from './routeProfiles';

/**
 * Révision de parcours (R01 · K2.09 / K2.14).
 *
 * Contrat PUR, sans base ni réseau : un brouillon est une liste de points
 * demandés, une géométrie mesurée, le profil sportif qui l'a produite et sa
 * provenance. La version ne change que si le contenu change ; enregistrer deux
 * fois le même tracé conserve donc la même révision.
 *
 * Depuis K2.14, un tronçon peut être MANUEL : sa géométrie est dessinée à la
 * main et n'est jamais envoyée au routeur. `sections` porte ce découpage
 * (calculé / manuel) ; `geometry` reste la ligne complète pour les surfaces
 * qui n'ont pas besoin du détail. Un ancien brouillon sans `sections` reste
 * lisible : sa géométrie est alors traitée comme un tracé calculé.
 *
 * Une révision n'écrase jamais une séance déjà liée : la persistance existante
 * (métadonnées du voyage) ne touche ni `hike_sessions` ni `hiking_routes`.
 */

export type RoutePointKind = 'start' | 'via' | 'end';

export type WaypointSemanticKind =
  | 'waypoint'
  | 'water'
  | 'bivouac'
  | 'viewpoint'
  | 'danger'
  | 'access'
  | 'summit'
  | 'refuge'
  | 'custom';

export type RouteShapeMode = 'one_way' | 'loop' | 'out_and_back';
export type WaypointInsertMode = 'optimal' | 'append';

export interface RouteRevisionPoint {
  readonly id: string;
  readonly lat: number;
  readonly lon: number;
  readonly kind: RoutePointKind;
  readonly name?: string | null;
  readonly semanticKind?: WaypointSemanticKind;
  readonly note?: string | null;
  readonly shared?: boolean;
  readonly poiId?: string | null;
}

/**
 * `LineString` GeoJSON, coordonnées `[lon, lat]`. L'index signature permet de
 * le passer tel quel aux composants de carte qui attendent un GeoJSON brut.
 */
export interface RouteGeometry {
  readonly type: 'LineString';
  readonly coordinates: Array<[number, number]>;
  readonly [key: string]: unknown;
}

export type RouteSectionMode = 'routed' | 'manual';

/**
 * Un tronçon entre deux points consécutifs. `routed` vient d'une mesure du
 * routeur ; `manual` est un tracé dessiné à la main, sans appel réseau. Les
 * deux portent leur propre géométrie, ce qui permet d'afficher et de
 * persister le mélange sans jamais faire passer le manuel pour un chemin.
 */
export interface RouteSection {
  readonly id: string;
  readonly mode: RouteSectionMode;
  readonly fromIndex: number;
  readonly toIndex: number;
  readonly geometry: RouteGeometry;
  readonly distanceKm: number;
  readonly durationMin: number | null;
  readonly provider: string | null;
}

export interface RouteRevision {
  readonly id: string;
  readonly version: number;
  readonly sport: RouteSport;
  readonly engine: string;
  readonly savedAt: string;
  readonly points: RouteRevisionPoint[];
  readonly geometry: RouteGeometry;
  /** Un tronçon par paire de points ; vide pour un ancien brouillon. */
  readonly sections: RouteSection[];
  readonly distanceKm: number | null;
  readonly durationMin: number | null;
  readonly provider: string | null;
  readonly warnings: string[];
}

export type RouteDraft = RouteRevision;

export const ROUTE_REVISION_ENGINE = 'lkdv-route-editor/2';
export const MAX_REVISION_GEOMETRY_POINTS = 20_000;

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function inBounds(lat: number, lon: number): boolean {
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function obj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Coordonnées `[lon, lat]` valides, ou `null` (aucun point inventé). */
export function readCoordinate(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lon = finite(value[0]);
  const lat = finite(value[1]);
  if (lon == null || lat == null || !inBounds(lat, lon)) return null;
  return [lon, lat];
}

/** Géométrie `LineString` valide, ou `null`. `MultiLineString` est concaténée. */
export function readLineString(value: unknown): RouteGeometry | null {
  const geometry = obj(value);
  if (!geometry) return null;
  if (geometry.type === 'Feature') return readLineString(geometry.geometry);
  if (geometry.type === 'LineString') {
    const coordinates = readCoordinates(geometry.coordinates);
    return coordinates ? { type: 'LineString', coordinates } : null;
  }
  if (geometry.type === 'MultiLineString') {
    const lines = geometry.coordinates;
    if (!Array.isArray(lines)) return null;
    const coordinates: Array<[number, number]> = [];
    for (const line of lines) {
      const read = readCoordinates(line);
      if (!read) return null;
      for (const pair of read) {
        const previous = coordinates[coordinates.length - 1];
        if (previous && previous[0] === pair[0] && previous[1] === pair[1]) continue;
        coordinates.push(pair);
        if (coordinates.length > MAX_REVISION_GEOMETRY_POINTS) return null;
      }
    }
    return coordinates.length >= 2 ? { type: 'LineString', coordinates } : null;
  }
  return null;
}

function readCoordinates(value: unknown): Array<[number, number]> | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > MAX_REVISION_GEOMETRY_POINTS) {
    return null;
  }
  const out: Array<[number, number]> = [];
  for (const entry of value) {
    const pair = readCoordinate(entry);
    if (!pair) return null;
    out.push(pair);
  }
  return out;
}

/** Une droite entre les points demandés : repli d'affichage, jamais une mesure. */
export function lineStringFromPoints(points: readonly { lat: number; lon: number }[]): RouteGeometry {
  const coordinates: Array<[number, number]> = points
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && inBounds(p.lat, p.lon))
    .map((p) => [p.lon, p.lat] as [number, number]);
  return { type: 'LineString', coordinates };
}

/** La géométrie d'une réponse de routage : les tronçons bout à bout, sans doublon. */
export function lineStringFromLegs(legs: readonly RouteLeg[]): RouteGeometry {
  const coordinates: Array<[number, number]> = [];
  for (const leg of legs) {
    for (const pair of leg.geometry) {
      const read = readCoordinate(pair);
      if (!read) continue;
      const previous = coordinates[coordinates.length - 1];
      if (previous && previous[0] === read[0] && previous[1] === read[1]) continue;
      coordinates.push(read);
    }
  }
  return simplifyRouteGeometry({ type: 'LineString', coordinates });
}

/**
 * Décimation régulière, extrémités gardées : une géométrie de fournisseur
 * peut compter des milliers de points, et les métadonnées du voyage n'ont pas
 * à les porter. 500 points gardent la forme d'un itinéraire de plusieurs jours.
 */
export function simplifyRouteGeometry(
  geometry: RouteGeometry,
  max = 500
): RouteGeometry {
  const points = geometry.coordinates;
  if (points.length <= max || max < 2) return geometry;
  const coordinates: Array<[number, number]> = [];
  const step = (points.length - 1) / (max - 1);
  for (let index = 0; index < max; index += 1) {
    coordinates.push(points[Math.round(index * step)]);
  }
  return { type: 'LineString', coordinates };
}

/** Longueur mesurée d'une géométrie, en km. Sert au tracé manuel, jamais au réseau. */
export function routeGeometryDistanceKm(geometry: RouteGeometry): number {
  let km = 0;
  for (let index = 1; index < geometry.coordinates.length; index += 1) {
    const from = geometry.coordinates[index - 1];
    const to = geometry.coordinates[index];
    if (!from || !to) continue;
    km += haversineKm({ lat: from[1], lon: from[0] }, { lat: to[1], lon: to[0] });
  }
  return km;
}

/** Les tronçons bout à bout, sans point dupliqué à leur jonction. */
export function lineStringFromSections(sections: readonly RouteSection[]): RouteGeometry {
  const coordinates: Array<[number, number]> = [];
  for (const section of sections) {
    for (const pair of section.geometry.coordinates) {
      const previous = coordinates[coordinates.length - 1];
      if (previous && previous[0] === pair[0] && previous[1] === pair[1]) continue;
      coordinates.push(pair);
    }
  }
  return { type: 'LineString', coordinates };
}

/**
 * Un tronçon par paire de points, dans l'ordre, sans doublon. C'est la
 * condition pour composer un tracé sans trou ni segment inventé.
 */
export function routeSectionsCoverPoints(
  sections: readonly RouteSection[],
  pointCount: number
): boolean {
  if (pointCount < 2 || sections.length !== pointCount - 1) return false;
  let expected = 0;
  for (const section of sections) {
    if (section.toIndex !== section.fromIndex + 1) return false;
    if (section.fromIndex !== expected) return false;
    if (section.fromIndex < 0 || section.toIndex >= pointCount) return false;
    expected += 1;
  }
  return expected === pointCount - 1;
}

/**
 * Recale les extrémités d'un tronçon manuel sur les points courants. Les
 * repères intermédiaires restent ceux dessinés ; la distance est remesurée sur
 * la ligne réellement affichée. Aucun appel réseau.
 */
export function syncManualSectionsToPoints(
  sections: readonly RouteSection[],
  points: readonly RouteRevisionPoint[]
): RouteSection[] {
  return sections.map((section) => {
    if (section.mode !== 'manual') return section;
    const from = points[section.fromIndex];
    const to = points[section.toIndex];
    if (!from || !to) return section;
    const coordinates = section.geometry.coordinates.slice();
    if (coordinates.length < 2) return section;
    coordinates[0] = [from.lon, from.lat];
    coordinates[coordinates.length - 1] = [to.lon, to.lat];
    const geometry: RouteGeometry = { type: 'LineString', coordinates };
    return { ...section, geometry, distanceKm: routeGeometryDistanceKm(geometry) };
  });
}

/** Retire les tronçons qui touchent un point supprimé, puis décale les index. */
export function removePointFromSections(
  sections: readonly RouteSection[],
  removedIndex: number
): RouteSection[] {
  return sections
    .filter((section) => section.fromIndex !== removedIndex && section.toIndex !== removedIndex)
    .map((section) => ({
      ...section,
      fromIndex: section.fromIndex > removedIndex ? section.fromIndex - 1 : section.fromIndex,
      toIndex: section.toIndex > removedIndex ? section.toIndex - 1 : section.toIndex,
    }))
    .filter((section) => section.toIndex === section.fromIndex + 1);
}

/** Fabrique un tronçon manuel entre deux points, avec ses repères intermédiaires. */
export function manualRouteSection(
  fromIndex: number,
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  coordinates?: ReadonlyArray<readonly [number, number]>
): RouteSection {
  const geometry: RouteGeometry = {
    type: 'LineString',
    coordinates:
      coordinates && coordinates.length >= 2
        ? coordinates.map(([lon, lat]) => [lon, lat] as [number, number])
        : [
            [from.lon, from.lat] as [number, number],
            [to.lon, to.lat] as [number, number],
          ],
  };
  return {
    id: `manual-${fromIndex + 1}`,
    mode: 'manual',
    fromIndex,
    toIndex: fromIndex + 1,
    geometry,
    distanceKm: routeGeometryDistanceKm(geometry),
    durationMin: null,
    provider: null,
  };
}

export function routeTotals(legs: readonly RouteLeg[]): { distanceKm: number; durationMin: number } {
  return legs.reduce(
    (total, leg) => ({
      distanceKm: total.distanceKm + (Number.isFinite(leg.distanceKm) ? leg.distanceKm : 0),
      durationMin: total.durationMin + (Number.isFinite(leg.durationMin) ? leg.durationMin : 0),
    }),
    { distanceKm: 0, durationMin: 0 }
  );
}

/** Identifiant stable d'un point dans l'éditeur : l'index fait foi tant qu'il vit. */
export function routePointId(index: number): string {
  return `pt-${index + 1}`;
}

/** Réindexe les identifiants et les rôles départ / passage / arrivée. */
const WAYPOINT_SEMANTIC_KINDS: ReadonlySet<WaypointSemanticKind> = new Set([
  'waypoint',
  'water',
  'bivouac',
  'viewpoint',
  'danger',
  'access',
  'summit',
  'refuge',
  'custom',
]);

export function normalizeRoutePoints(
  points: readonly Partial<RouteRevisionPoint>[]
): RouteRevisionPoint[] {
  const out: RouteRevisionPoint[] = [];
  for (const point of points) {
    const lat = finite(point.lat);
    const lon = finite(point.lon);
    if (lat == null || lon == null || !inBounds(lat, lon)) continue;
    const index = out.length;
    const name = typeof point.name === 'string' && point.name.trim() ? point.name.trim().slice(0, 80) : undefined;
    const note = typeof point.note === 'string' && point.note.trim() ? point.note.trim().slice(0, 280) : undefined;
    const semanticKind =
      point.semanticKind && WAYPOINT_SEMANTIC_KINDS.has(point.semanticKind)
        ? point.semanticKind
        : undefined;
    const poiId = typeof point.poiId === 'string' && point.poiId.trim() ? point.poiId.slice(0, 80) : undefined;
    out.push({
      id: routePointId(index),
      lat,
      lon,
      kind: index === 0 ? 'start' : 'via',
      ...(name ? { name } : {}),
      ...(semanticKind ? { semanticKind } : {}),
      ...(note ? { note } : {}),
      ...(typeof point.shared === 'boolean' ? { shared: point.shared } : {}),
      ...(poiId ? { poiId } : {}),
    });
  }
  if (out.length > 0) {
    const last = out[out.length - 1];
    out[out.length - 1] = { ...last, kind: 'end' };
  }
  return out;
}

/**
 * Réduit une liste trop longue en gardant départ, arrivée et des passages
 * régulièrement espacés. Sert aux voyages de plus de douze étapes : l'éditeur
 * ne peut pas envoyer au routeur plus de points que sa borne, et il vaut mieux
 * le dire par un tracé simplifié que refuser tout le parcours.
 */
export function limitRoutePoints(
  points: readonly RouteRevisionPoint[],
  max = MAX_ROUTE_WAYPOINTS
): RouteRevisionPoint[] {
  if (points.length <= max) return normalizeRoutePoints(points);
  if (max < 2) return normalizeRoutePoints(points.slice(0, Math.max(2, max)));
  const out: RouteRevisionPoint[] = [points[0]];
  for (let slot = 1; slot < max - 1; slot += 1) {
    const index = Math.round((slot * (points.length - 1)) / (max - 1));
    const point = points[index];
    if (point && !out.some((p) => p.lat === point.lat && p.lon === point.lon)) out.push(point);
  }
  const last = points[points.length - 1];
  if (last && !out.some((p) => p.lat === last.lat && p.lon === last.lon)) out.push(last);
  return normalizeRoutePoints(out);
}

export function moveRoutePoint(
  points: readonly RouteRevisionPoint[],
  index: number,
  lat: number,
  lon: number
): RouteRevisionPoint[] {
  if (!Number.isInteger(index) || index < 0 || index >= points.length) return [...points];
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inBounds(lat, lon)) return [...points];
  return points.map((point, i) => (i === index ? { ...point, lat, lon } : point));
}

function pointToSegmentDistSq(
  p: { lat: number; lon: number },
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const cosLat = Math.cos(((a.lat + b.lat) * 0.5 * Math.PI) / 180);
  const ax = a.lon * cosLat;
  const ay = a.lat;
  const bx = b.lon * cosLat;
  const by = b.lat;
  const px = p.lon * cosLat;
  const py = p.lat;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-12) return (px - ax) ** 2 + (py - ay) ** 2;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return (px - cx) ** 2 + (py - cy) ** 2;
}

export function appendRoutePoint(
  points: readonly RouteRevisionPoint[],
  lat: number,
  lon: number,
  meta?: Partial<Pick<RouteRevisionPoint, 'name' | 'semanticKind' | 'note' | 'shared' | 'poiId'>>
): RouteRevisionPoint[] {
  if (points.length >= MAX_ROUTE_WAYPOINTS) return [...points];
  return normalizeRoutePoints([...points, { lat, lon, ...(meta ?? {}) }]);
}

/**
 * K2.10 : insère le point sur le tronçon le plus proche (insertion optimale),
 * plutôt qu'en fin de liste. Respecte la borne MAX_ROUTE_WAYPOINTS.
 */
export function insertRoutePointOptimal(
  points: readonly RouteRevisionPoint[],
  lat: number,
  lon: number,
  meta?: Partial<Pick<RouteRevisionPoint, 'name' | 'semanticKind' | 'note' | 'shared' | 'poiId'>>
): RouteRevisionPoint[] {
  if (points.length >= MAX_ROUTE_WAYPOINTS) return [...points];
  if (points.length < 2) {
    return appendRoutePoint(points, lat, lon, meta);
  }
  let bestIndex = points.length - 1;
  let bestDist = Infinity;
  for (let i = 0; i < points.length - 1; i += 1) {
    const d = pointToSegmentDistSq({ lat, lon }, points[i], points[i + 1]);
    if (d < bestDist) {
      bestDist = d;
      bestIndex = i + 1;
    }
  }
  const next = points.slice();
  next.splice(bestIndex, 0, {
    id: routePointId(bestIndex),
    lat,
    lon,
    kind: 'via',
    ...(meta ?? {}),
  });
  return normalizeRoutePoints(next);
}

/** K2.08 : réordonner les points de passage (haut / bas / index quelconque). */
export function reorderRoutePoint(
  points: readonly RouteRevisionPoint[],
  fromIndex: number,
  toIndex: number
): RouteRevisionPoint[] {
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= points.length ||
    toIndex >= points.length ||
    fromIndex === toIndex
  ) {
    return [...points];
  }
  const next = points.slice();
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return [...points];
  next.splice(toIndex, 0, moved);
  return normalizeRoutePoints(next);
}

/** K2.13 : inverser le sens du tracé (et les éventuels tronçons manuels). */
export function reverseRouteState(
  points: readonly RouteRevisionPoint[],
  sections: readonly RouteSection[]
): { points: RouteRevisionPoint[]; sections: RouteSection[] } {
  const reversedPoints = normalizeRoutePoints([...points].reverse());
  const count = points.length;
  const reversedSections = sections
    .slice()
    .reverse()
    .map((section, idx) => {
      const reversedGeom: RouteGeometry = {
        type: 'LineString',
        coordinates: [...section.geometry.coordinates].reverse(),
      };
      return {
        ...section,
        fromIndex: idx,
        toIndex: idx + 1,
        id: `${section.mode === 'manual' ? 'manual' : 'leg'}-${idx + 1}`,
        geometry: reversedGeom,
        // Conserver la durée uniquement sur les tronçons calculés ou forcer le recalcul en UI
        durationMin: section.mode === 'manual' ? null : section.durationMin,
      };
    })
    .filter((section) => count >= 2 && section.toIndex < count);
  return { points: reversedPoints, sections: reversedSections };
}

/** K2.12 : basculer entre aller simple, boucle (retour au départ) et aller-retour. */
export function applyRouteShapeMode(
  points: readonly RouteRevisionPoint[],
  mode: RouteShapeMode
): RouteRevisionPoint[] {
  if (points.length < 2) return [...points];
  const first = points[0];
  const last = points[points.length - 1];
  const isClosed =
    points.length >= 3 &&
    haversineKm({ lat: first.lat, lon: first.lon }, { lat: last.lat, lon: last.lon }) < 0.08;

  if (mode === 'one_way') {
    if (isClosed && points.length > 2) {
      return normalizeRoutePoints(points.slice(0, -1));
    }
    return [...points];
  }

  if (mode === 'loop') {
    if (isClosed) return [...points];
    if (points.length >= MAX_ROUTE_WAYPOINTS) {
      return normalizeRoutePoints([...points.slice(0, MAX_ROUTE_WAYPOINTS - 1), { ...first }]);
    }
    return normalizeRoutePoints([...points, { lat: first.lat, lon: first.lon, name: first.name, semanticKind: first.semanticKind }]);
  }

  // out_and_back : aller puis retour en miroir vers le départ
  const base = isClosed ? points.slice(0, -1) : points;
  const returnLeg = base.slice(0, -1).reverse().map((p) => ({
    lat: p.lat,
    lon: p.lon,
    name: p.name,
    semanticKind: p.semanticKind,
  }));
  return limitRoutePoints(normalizeRoutePoints([...base, ...returnLeg]), MAX_ROUTE_WAYPOINTS);
}

/** K2.15 : suppression en lot / rognage d'un intervalle de points. */
export function batchRemoveRoutePoints(
  points: readonly RouteRevisionPoint[],
  sections: readonly RouteSection[],
  indicesToRemove: ReadonlySet<number>
): { points: RouteRevisionPoint[]; sections: RouteSection[] } {
  const remaining = points.filter((_, idx) => !indicesToRemove.has(idx));
  if (remaining.length < 2) {
    return { points: [...points], sections: [...sections] };
  }
  let nextSections = [...sections];
  const sortedDesc = [...indicesToRemove].filter((i) => Number.isInteger(i) && i >= 0 && i < points.length).sort((a, b) => b - a);
  for (const idx of sortedDesc) {
    nextSections = removePointFromSections(nextSections, idx);
  }
  return {
    points: normalizeRoutePoints(remaining),
    sections: nextSections,
  };
}

/** K2.11 / S3.07 : met à jour le nom, type et statut de partage d'un point d'intérêt du tracé. */
export function updateRoutePointMeta(
  points: readonly RouteRevisionPoint[],
  index: number,
  meta: Partial<Pick<RouteRevisionPoint, 'name' | 'semanticKind' | 'note' | 'shared' | 'poiId'>>
): RouteRevisionPoint[] {
  if (!Number.isInteger(index) || index < 0 || index >= points.length) return [...points];
  return points.map((point, i) => (i === index ? { ...point, ...meta } : point));
}

/** K2.17 : estimation de durée selon vitesse ajustable et profil sportif (+ VAE). */
export function defaultSpeedKmHForSport(sport: RouteSport, ebike = false): number {
  if (sport === 'marche') return 4.2;
  if (sport === 'route') return ebike ? 26 : 22;
  if (sport === 'gravel') return ebike ? 22 : 17;
  if (sport === 'vtt') return ebike ? 19 : 13;
  return 28; // enduro
}

export function estimateDurationMinutesForSpeed(
  distanceKm: number | null,
  speedKmH: number,
  gainM = 0,
  sport: RouteSport = 'marche',
  ebike = false
): number | null {
  if (distanceKm == null || !Number.isFinite(distanceKm) || distanceKm < 0) return null;
  if (!Number.isFinite(speedKmH) || speedKmH <= 0.5) return null;
  const flatHours = distanceKm / speedKmH;
  const ascentRate =
    sport === 'marche' ? 350 : ebike ? 950 : sport === 'enduro' ? 1200 : 600;
  const climbHours = gainM > 0 ? gainM / ascentRate : 0;
  return Math.round((flatHours + climbHours * 0.5) * 60);
}

/** K2.11 / S3.07 : export GPX 1.1 incluant points nommés/typés (<wpt>) + trace (<trkpt>). */
export function gpxFromRouteDraft(
  title: string,
  points: readonly RouteRevisionPoint[],
  geometry: RouteGeometry,
  options?: { includeUnshared?: boolean }
): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const includeUnshared = options?.includeUnshared ?? true;
  const wpts = points
    .filter((p) => (includeUnshared || p.shared !== false) && (p.name || (p.semanticKind && p.semanticKind !== 'waypoint') || p.note))
    .map((p) => {
      const sym = p.semanticKind ? `<sym>${esc(p.semanticKind)}</sym><type>${esc(p.semanticKind)}</type>` : '';
      const name = p.name ? `<name>${esc(p.name)}</name>` : `<name>${esc(p.kind)}</name>`;
      const desc = p.note ? `<desc>${esc(p.note)}</desc>` : '';
      return `  <wpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}">${name}${desc}${sym}</wpt>`;
    })
    .join('\n');
  const trkpts = geometry.coordinates
    .map(([lon, lat]) => `      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}" />`)
    .join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="LKDV" xmlns="http://www.topografix.com/GPX/1/1">',
    `  <metadata><name>${esc(title || 'Itinéraire LKDV')}</name></metadata>`,
    wpts,
    '  <trk>',
    `    <name>${esc(title || 'Itinéraire LKDV')}</name>`,
    '    <trkseg>',
    trkpts,
    '    </trkseg>',
    '  </trk>',
    '</gpx>',
  ]
    .filter(Boolean)
    .join('\n');
}

export function removeRoutePoint(
  points: readonly RouteRevisionPoint[],
  index: number
): RouteRevisionPoint[] {
  if (points.length <= 2 || !Number.isInteger(index) || index < 0 || index >= points.length) {
    return [...points];
  }
  return normalizeRoutePoints(points.filter((_, i) => i !== index));
}

function readPoint(value: unknown, index: number): RouteRevisionPoint | null {
  const point = obj(value);
  if (!point) return null;
  const lat = finite(point.lat);
  const lon = finite(point.lon);
  if (lat == null || lon == null || !inBounds(lat, lon)) return null;
  const kind = point.kind;
  const name = typeof point.name === 'string' && point.name.trim() ? point.name.trim().slice(0, 80) : undefined;
  const note = typeof point.note === 'string' && point.note.trim() ? point.note.trim().slice(0, 280) : undefined;
  const semanticKind =
    typeof point.semanticKind === 'string' && WAYPOINT_SEMANTIC_KINDS.has(point.semanticKind as WaypointSemanticKind)
      ? (point.semanticKind as WaypointSemanticKind)
      : undefined;
  const poiId = typeof point.poiId === 'string' && point.poiId.trim() ? point.poiId.slice(0, 80) : undefined;
  return {
    id: typeof point.id === 'string' && point.id.trim() ? point.id.slice(0, 40) : routePointId(index),
    lat,
    lon,
    kind: kind === 'start' || kind === 'via' || kind === 'end' ? kind : index === 0 ? 'start' : 'via',
    ...(name ? { name } : {}),
    ...(semanticKind ? { semanticKind } : {}),
    ...(note ? { note } : {}),
    ...(typeof point.shared === 'boolean' ? { shared: point.shared } : {}),
    ...(poiId ? { poiId } : {}),
  };
}

function readSection(value: unknown, pointCount: number): RouteSection | null {
  const raw = obj(value);
  if (!raw) return null;
  const mode = raw.mode;
  if (mode !== 'routed' && mode !== 'manual') return null;
  const fromIndex = finite(raw.fromIndex);
  const toIndex = finite(raw.toIndex);
  if (
    fromIndex == null ||
    toIndex == null ||
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    toIndex !== fromIndex + 1 ||
    toIndex >= pointCount
  ) {
    return null;
  }
  const geometry = readLineString(raw.geometry);
  if (!geometry) return null;
  const distanceKm = finite(raw.distanceKm);
  if (distanceKm == null || distanceKm < 0) return null;
  const durationMin = raw.durationMin == null ? null : finite(raw.durationMin);
  if (raw.durationMin != null && (durationMin == null || durationMin < 0)) return null;
  const provider =
    typeof raw.provider === 'string' && raw.provider.trim() ? raw.provider.slice(0, 40) : null;
  return {
    id:
      typeof raw.id === 'string' && raw.id.trim()
        ? raw.id.slice(0, 80)
        : `${mode === 'manual' ? 'manual' : 'leg'}-${fromIndex + 1}`,
    mode,
    fromIndex,
    toIndex,
    geometry,
    // Le manuel est remesuré sur la ligne dessinée ; le routé garde sa mesure.
    distanceKm: mode === 'manual' ? routeGeometryDistanceKm(geometry) : distanceKm,
    durationMin: mode === 'manual' ? null : durationMin,
    provider: mode === 'manual' ? null : provider,
  };
}

/**
 * Lit `trips.metadata.compas.routeDraft`. Défensif : une valeur illisible est
 * ignorée, jamais devinée. C'est ce qui permet de déployer le contrat sans
 * migration et sans casser les voyages existants.
 */
export function readRouteDraft(metadata: unknown): RouteDraft | null {
  const meta = obj(metadata);
  const compas = meta ? obj(meta.compas) : null;
  const raw = compas ? obj(compas.routeDraft) : null;
  if (!raw) return null;
  const sport = raw.sport;
  if (!isRouteSport(sport)) return null;

  const version = finite(raw.version);
  if (version == null || !Number.isInteger(version) || version < 1 || version > 10_000) return null;

  if (!Array.isArray(raw.points) || raw.points.length < 2 || raw.points.length > MAX_ROUTE_WAYPOINTS) {
    return null;
  }
  const points = raw.points.map(readPoint);
  if (points.some((point): point is null => point === null)) return null;

  let geometry = readLineString(raw.geometry);
  if (!geometry) return null;

  // `sections` est facultatif : un brouillon d'avant K2.14 garde sa géométrie
  // entière, traitée comme calculée. Un découpage incomplet est ignoré plutôt
  // que complété par une supposition.
  let sections: RouteSection[] = [];
  if (Array.isArray(raw.sections)) {
    const read = raw.sections.map((entry) => readSection(entry, points.length));
    if (read.every((section): section is RouteSection => section !== null)) {
      const candidate = syncManualSectionsToPoints(read, points as RouteRevisionPoint[]);
      if (routeSectionsCoverPoints(candidate, points.length)) {
        sections = candidate;
        geometry = simplifyRouteGeometry(lineStringFromSections(candidate));
      }
    }
  }

  let distanceKm = raw.distanceKm == null ? null : finite(raw.distanceKm);
  let durationMin = raw.durationMin == null ? null : finite(raw.durationMin);
  if (raw.distanceKm != null && (distanceKm == null || distanceKm < 0)) return null;
  if (raw.durationMin != null && (durationMin == null || durationMin < 0)) return null;

  // Un découpage valide fait foi : la distance manuelle est remesurée et la
  // durée redevient inconnue dès qu'un tronçon n'est pas routé. Cela garde le
  // total cohérent même si un point a bougé depuis l'enregistrement.
  if (sections.length > 0) {
    const manual = sections.some((section) => section.mode === 'manual');
    const routed = sections.filter((section) => section.mode === 'routed');
    distanceKm = sections.reduce((total, section) => total + section.distanceKm, 0);
    durationMin =
      manual || routed.some((section) => section.durationMin == null)
        ? null
        : routed.reduce((total, section) => total + (section.durationMin ?? 0), 0);
  }

  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.filter((warning): warning is string => typeof warning === 'string').slice(0, 10)
    : [];

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.slice(0, 80) : 'route-draft',
    version,
    sport,
    engine: typeof raw.engine === 'string' && raw.engine.trim() ? raw.engine.slice(0, 80) : ROUTE_REVISION_ENGINE,
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt.slice(0, 40) : '',
    points: points as RouteRevisionPoint[],
    geometry,
    sections,
    distanceKm,
    durationMin,
    provider:
      typeof raw.provider === 'string' && raw.provider.trim() ? raw.provider.slice(0, 40) : null,
    warnings,
  };
}

export interface CreateRouteDraftInput {
  tripId: string;
  sport: RouteSport;
  points: readonly Partial<RouteRevisionPoint>[];
  geometry: RouteGeometry | null;
  sections?: readonly RouteSection[];
  distanceKm: number | null;
  durationMin: number | null;
  provider: string | null;
  previous?: RouteDraft | null;
  warnings?: readonly string[];
  now?: string;
}

function sameSections(
  previous: readonly RouteSection[],
  sections: readonly RouteSection[]
): boolean {
  if (previous.length !== sections.length) return false;
  for (let index = 0; index < sections.length; index += 1) {
    const a = previous[index];
    const b = sections[index];
    if (!a || !b) return false;
    if (
      a.mode !== b.mode ||
      a.fromIndex !== b.fromIndex ||
      a.toIndex !== b.toIndex ||
      a.distanceKm !== b.distanceKm ||
      a.durationMin !== b.durationMin ||
      a.provider !== b.provider ||
      a.geometry.coordinates.length !== b.geometry.coordinates.length
    ) {
      return false;
    }
    for (let point = 0; point < b.geometry.coordinates.length; point += 1) {
      const ca = a.geometry.coordinates[point];
      const cb = b.geometry.coordinates[point];
      if (!ca || !cb || ca[0] !== cb[0] || ca[1] !== cb[1]) return false;
    }
  }
  return true;
}

function sameContent(
  previous: RouteDraft,
  sport: RouteSport,
  points: readonly RouteRevisionPoint[],
  geometry: RouteGeometry,
  sections: readonly RouteSection[]
): boolean {
  if (previous.sport !== sport) return false;
  if (previous.points.length !== points.length) return false;
  for (let index = 0; index < points.length; index += 1) {
    const a = previous.points[index];
    const b = points[index];
    if (!a || !b || a.lat !== b.lat || a.lon !== b.lon) return false;
  }
  if (!sameSections(previous.sections ?? [], sections)) return false;
  if (previous.geometry.coordinates.length !== geometry.coordinates.length) return false;
  for (let index = 0; index < geometry.coordinates.length; index += 1) {
    const a = previous.geometry.coordinates[index];
    const b = geometry.coordinates[index];
    if (!a || !b || a[0] !== b[0] || a[1] !== b[1]) return false;
  }
  return true;
}

/**
 * Construit la prochaine révision. Le contenu identique rend la révision
 * précédente telle quelle : « enregistrer puis rouvrir conserve la même
 * révision », y compris après un second enregistrement sans modification.
 */
export function createRouteDraft(input: CreateRouteDraftInput): RouteDraft {
  const points = normalizeRoutePoints(input.points);
  const candidateSections = input.sections
    ? syncManualSectionsToPoints([...input.sections], points)
    : (input.previous?.sections ?? []);
  const sections = routeSectionsCoverPoints(candidateSections, points.length)
    ? candidateSections
    : [];
  const geometry =
    sections.length > 0
      ? simplifyRouteGeometry(lineStringFromSections(sections))
      : simplifyRouteGeometry(input.geometry ?? lineStringFromPoints(points));
  const previous = input.previous ?? null;
  if (previous && sameContent(previous, input.sport, points, geometry, sections)) return previous;

  return {
    id: previous?.id ?? `draft-${input.tripId}`.slice(0, 80),
    version: (previous?.version ?? 0) + 1,
    sport: input.sport,
    engine: ROUTE_REVISION_ENGINE,
    savedAt: input.now ?? new Date().toISOString(),
    points,
    geometry,
    sections,
    distanceKm: input.distanceKm,
    durationMin: input.durationMin,
    provider: input.provider,
    warnings: [...(input.warnings ?? [])].slice(0, 10),
  };
}
