/**
 * Lot S03-UI — catalogue serveur des Live Segments.
 *
 * Le lot S03 (contrat `src/features/live-segments`) ne possède pas encore de
 * table de segments dédiée : les segments vivent aujourd'hui dans le domaine
 * Segments (S01) et les traces OSM. Cette surface HTTP expose donc un
 * catalogue **explicitement identifié comme démonstration** (`dataSource:
 * 'demo_catalog'`), afin que l'UI et les tests puissent être branchés sans
 * inventer de records personnels ni de temps de référence attribués à
 * quelqu'un.
 *
 * Le port `LiveSegmentCatalog` est volontairement petit : brancher la base
 * réelle (S01 / table de segments) consiste à fournir une autre implémentation,
 * sans toucher aux routes ni aux composants.
 */

import {
  haversineDistanceM,
  sanitizeSegmentForLive,
  type GhostProfile,
  type LiveSegmentDefinition,
  type PrivacyContext,
  type SegmentPoint,
  type SportType,
} from '@/features/live-segments';

export type LiveSegmentDataSource = 'demo_catalog';

export interface LiveSegmentCatalogEntry {
  definition: LiveSegmentDefinition;
  /** Région lisible, jamais une coordonnée précise côté client. */
  region: string;
  dataSource: LiveSegmentDataSource;
}

export interface LiveSegmentSummary {
  id: string;
  version: number;
  name: string;
  sport: SportType;
  direction: LiveSegmentDefinition['direction'];
  totalDistanceM: number;
  elevationGainM: number;
  region: string;
  dataSource: LiveSegmentDataSource;
  pointCount: number;
  points: SegmentPoint[];
  start: SegmentPoint;
  ghostProfiles: GhostProfile[];
  /** Distance entre le point de départ du segment et la position demandée. */
  distanceFromViewerM: number | null;
}

export interface ListLiveSegmentsParams {
  lat?: number | null;
  lon?: number | null;
  radiusM?: number | null;
  sport?: SportType | null;
  limit?: number | null;
  viewerId?: string | null;
  optedIn?: boolean;
}

export interface ListLiveSegmentsResult {
  items: LiveSegmentSummary[];
  dataSource: LiveSegmentDataSource;
  /** Nombre de segments du catalogue avant filtrage géographique. */
  catalogSize: number;
}

export const LIVE_SEGMENT_CATALOG_DATA_SOURCE: LiveSegmentDataSource = 'demo_catalog';

const EARTH_RADIUS_M = 6_371_008.8;
const MAX_RADIUS_M = 200_000;
const DEFAULT_RADIUS_M = 50_000;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

/** Point destination sur le grand cercle, pour construire une trace de démo. */
function destinationPoint(
  origin: { lat: number; lon: number },
  bearingDeg: number,
  distanceM: number,
): { lat: number; lon: number } {
  const angular = distanceM / EARTH_RADIUS_M;
  const bearing = toRadians(bearingDeg);
  const lat1 = toRadians(origin.lat);
  const lon1 = toRadians(origin.lon);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: toDegrees(lat2), lon: ((toDegrees(lon2) + 540) % 360) - 180 };
}

interface DemoShape {
  id: string;
  name: string;
  sport: SportType;
  region: string;
  start: { lat: number; lon: number; ele: number };
  bearingDeg: number;
  targetLengthM: number;
  elevationGainM: number;
  /** Vitesse moyenne de l'objectif de démonstration, en m/s. */
  targetSpeedMps: number;
}

function buildDemoDefinition(shape: DemoShape): LiveSegmentDefinition {
  const pointCount = Math.max(12, Math.round(shape.targetLengthM / 180));
  const stepM = shape.targetLengthM / (pointCount - 1);
  const raw: Array<{ lat: number; lon: number; ele: number }> = [
    { ...shape.start },
  ];

  for (let index = 1; index < pointCount; index += 1) {
    const previous = raw[index - 1];
    // Léger lacet pour éviter une ligne parfaitement droite ; reste déterministe.
    const bearing = shape.bearingDeg + 11 * Math.sin(index * 0.82);
    const next = destinationPoint(previous, bearing, stepM);
    raw.push({
      lat: next.lat,
      lon: next.lon,
      ele:
        shape.start.ele +
        shape.elevationGainM * (index / (pointCount - 1)) +
        2.2 * Math.sin(index * 0.55),
    });
  }

  const points: SegmentPoint[] = [];
  let cumulative = 0;
  for (let index = 0; index < raw.length; index += 1) {
    if (index > 0) {
      cumulative += haversineDistanceM(
        { lat: raw[index - 1].lat, lon: raw[index - 1].lon },
        { lat: raw[index].lat, lon: raw[index].lon },
      );
    }
    points.push({
      lat: Number(raw[index].lat.toFixed(6)),
      lon: Number(raw[index].lon.toFixed(6)),
      ele: Math.round(raw[index].ele * 10) / 10,
      cumulativeDistanceM: Math.round(cumulative * 10) / 10,
    });
  }

  const totalDistanceM = points[points.length - 1]?.cumulativeDistanceM ?? 0;
  const totalTimeMs = Math.round((totalDistanceM / shape.targetSpeedMps) * 1000);

  // Un objectif de démonstration, jamais présenté comme le temps d'une personne.
  const targetGhost: GhostProfile = {
    kind: 'target',
    label: `Objectif ${Math.max(1, Math.round(totalTimeMs / 60_000))} min`,
    totalTimeMs,
    checkpoints: [0, 1 / 3, 2 / 3, 1].map((ratio) => ({
      distanceM: Math.round(totalDistanceM * ratio * 10) / 10,
      elapsedMs: Math.round(totalTimeMs * ratio),
    })),
    isPublic: true,
    isOptedIn: true,
  };

  return {
    id: shape.id,
    version: 1,
    name: shape.name,
    sport: shape.sport,
    direction: 'forward',
    points,
    totalDistanceM,
    elevationGainM: shape.elevationGainM,
    isPrivate: false,
    ownerId: 'lkdv-demo-catalog',
    isStarred: true,
    ghostProfiles: [targetGhost],
  };
}

const DEMO_SHAPES: readonly DemoShape[] = [
  {
    id: 'demo-semnoz',
    name: 'Montée du Semnoz',
    sport: 'cycling',
    region: 'Baupes · Annecy',
    start: { lat: 45.858, lon: 6.105, ele: 470 },
    bearingDeg: 286,
    targetLengthM: 4_200,
    elevationGainM: 310,
    targetSpeedMps: 6.1,
  },
  {
    id: 'demo-chaubouret',
    name: 'Côte de Chaubouret',
    sport: 'cycling',
    region: 'Pilat · Loire',
    start: { lat: 45.382, lon: 4.545, ele: 780 },
    bearingDeg: 248,
    targetLengthM: 3_600,
    elevationGainM: 270,
    targetSpeedMps: 5.5,
  },
  {
    id: 'demo-lac-blanc',
    name: 'Tour du Lac Blanc',
    sport: 'hiking',
    region: 'Aiguilles Rouges · Haute-Savoie',
    start: { lat: 45.98, lon: 6.89, ele: 2_180 },
    bearingDeg: 42,
    targetLengthM: 2_800,
    elevationGainM: 180,
    targetSpeedMps: 1.35,
  },
  {
    id: 'demo-sainte-baume',
    name: 'Crête de la Sainte-Baume',
    sport: 'trail',
    region: 'Sainte-Baume · Var',
    start: { lat: 43.33, lon: 5.77, ele: 640 },
    bearingDeg: 112,
    targetLengthM: 3_000,
    elevationGainM: 240,
    targetSpeedMps: 2.1,
  },
  {
    id: 'demo-combe-laval',
    name: 'Combe Laval',
    sport: 'gravel',
    region: 'Vercors · Drôme',
    start: { lat: 44.93, lon: 5.34, ele: 320 },
    bearingDeg: 301,
    targetLengthM: 5_000,
    elevationGainM: 380,
    targetSpeedMps: 4.2,
  },
];

let cachedCatalog: readonly LiveSegmentCatalogEntry[] | null = null;

export function getDemoCatalog(): readonly LiveSegmentCatalogEntry[] {
  if (!cachedCatalog) {
    cachedCatalog = DEMO_SHAPES.map((shape) => ({
      definition: buildDemoDefinition(shape),
      region: shape.region,
      dataSource: LIVE_SEGMENT_CATALOG_DATA_SOURCE,
    }));
  }
  return cachedCatalog;
}

export function createPublicPrivacy(
  viewerId: string | null | undefined,
  optedIn = true,
): PrivacyContext {
  return {
    viewerId: viewerId && viewerId.trim() !== '' ? viewerId : 'anonymous',
    optedInLiveSegments: optedIn,
    blockedUserIds: new Set<string>(),
    allowedPeerIds: new Set<string>(),
  };
}

function clampLimit(limit: number | null | undefined): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return 20;
  return Math.max(1, Math.min(50, Math.floor(limit)));
}

function clampRadius(radius: number | null | undefined): number {
  if (typeof radius !== 'number' || !Number.isFinite(radius)) return DEFAULT_RADIUS_M;
  return Math.max(100, Math.min(MAX_RADIUS_M, radius));
}

export function listLiveSegments(params: ListLiveSegmentsParams = {}): ListLiveSegmentsResult {
  const viewerId = params.viewerId ?? 'anonymous';
  const privacy = createPublicPrivacy(viewerId, params.optedIn ?? true);
  const limit = clampLimit(params.limit);
  const radius = clampRadius(params.radiusM);
  const hasPosition =
    typeof params.lat === 'number' &&
    Number.isFinite(params.lat) &&
    Math.abs(params.lat) <= 90 &&
    typeof params.lon === 'number' &&
    Number.isFinite(params.lon) &&
    Math.abs(params.lon) <= 180;

  const origin = hasPosition
    ? { lat: params.lat as number, lon: params.lon as number }
    : null;

  const items: LiveSegmentSummary[] = [];
  const catalog = getDemoCatalog();
  for (const entry of catalog) {
    if (params.sport && entry.definition.sport !== params.sport) continue;

    const sanitized = sanitizeSegmentForLive(entry.definition, privacy);
    if (!sanitized) continue;

    const start = sanitized.points[0];
    if (!start) continue;

    const distanceFromViewerM = origin
      ? Math.round(haversineDistanceM(origin, { lat: start.lat, lon: start.lon }))
      : null;

    if (distanceFromViewerM !== null && distanceFromViewerM > radius) continue;

    items.push({
      id: sanitized.id,
      version: sanitized.version,
      name: sanitized.name,
      sport: sanitized.sport,
      direction: sanitized.direction,
      totalDistanceM: sanitized.totalDistanceM,
      elevationGainM: sanitized.elevationGainM,
      region: entry.region,
      dataSource: entry.dataSource,
      pointCount: sanitized.points.length,
      points: sanitized.points,
      start,
      ghostProfiles: sanitized.ghostProfiles,
      distanceFromViewerM,
    });
  }

  items.sort((a, b) => {
    if (a.distanceFromViewerM !== null && b.distanceFromViewerM !== null) {
      return a.distanceFromViewerM - b.distanceFromViewerM;
    }
    return a.name.localeCompare(b.name, 'fr');
  });

  return {
    items: items.slice(0, limit),
    dataSource: LIVE_SEGMENT_CATALOG_DATA_SOURCE,
    catalogSize: catalog.length,
  };
}

export function getLiveSegment(
  id: string,
  options: { viewerId?: string | null; optedIn?: boolean } = {},
): LiveSegmentCatalogEntry | null {
  const entry = getDemoCatalog().find((item) => item.definition.id === id);
  if (!entry) return null;
  const privacy = createPublicPrivacy(options.viewerId, options.optedIn ?? true);
  const sanitized = sanitizeSegmentForLive(entry.definition, privacy);
  if (!sanitized) return null;
  return { ...entry, definition: sanitized };
}

export function listLiveSegmentsByIds(
  ids: readonly string[],
  options: { viewerId?: string | null; optedIn?: boolean } = {},
): LiveSegmentDefinition[] {
  const privacy = createPublicPrivacy(options.viewerId, options.optedIn ?? true);
  const wanted = new Set(ids);
  const result: LiveSegmentDefinition[] = [];
  for (const entry of getDemoCatalog()) {
    if (!wanted.has(entry.definition.id)) continue;
    const sanitized = sanitizeSegmentForLive(entry.definition, privacy);
    if (sanitized) result.push(sanitized);
  }
  return result;
}

export const LIVE_SEGMENT_MAX_RADIUS_M = MAX_RADIUS_M;
export const LIVE_SEGMENT_DEFAULT_RADIUS_M = DEFAULT_RADIUS_M;
