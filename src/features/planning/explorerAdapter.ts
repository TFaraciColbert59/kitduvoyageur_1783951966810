import { haversineKm } from './split';
import type {
  ContinuousRoute,
  GpxTrackPoint,
  LodgingAnchor,
  MultiDayPlan,
  RouteTheme,
  SportKind,
  StageRevision,
} from './models';
import type { PoiItem } from '@/features/explorer-v2/data/hooks';
import type { TrailRouteSnapshot } from '@/features/explorer-v2/state/types';

export type { PoiItem };

export const EXPLORER_PENDING_STAGE_KEY = 'lkdv.explorer.pendingStage.v1';

export interface PendingStageLaunchPayload {
  planId: string;
  planTitle: string;
  stageId: string;
  dayNumber: number;
  stageRevision: number;
  sport: SportKind;
  points: GpxTrackPoint[];
}

export function explorerSportToPlanningSport(sport?: string | null): SportKind {
  switch (sport) {
    case 'gravel':
      return 'gravel';
    case 'vtt':
    case 'bikepacking':
      return 'bikepacking';
    case 'velo':
    case 'route':
    case 'cycling':
      return 'cycling';
    case 'trail':
    case 'course':
      return 'trail';
    case 'trek':
    case 'trekking':
      return 'trekking';
    case 'alpi':
    case 'mountaineering':
      return 'mountaineering';
    default:
      return 'hiking';
  }
}

export function extractLineCoordinatesFromGeojson(geojson: unknown): Array<[number, number]> {
  const coords: Array<[number, number]> = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      if (
        typeof node[0] === 'number' &&
        typeof node[1] === 'number' &&
        Number.isFinite(node[0]) &&
        Number.isFinite(node[1])
      ) {
        coords.push([node[0], node[1]]);
        return;
      }
      for (const child of node) walk(child);
    } else if (node && typeof node === 'object') {
      const obj = node as { coordinates?: unknown; geometry?: unknown; features?: unknown };
      if (obj.coordinates !== undefined) walk(obj.coordinates);
      if (obj.geometry !== undefined) walk(obj.geometry);
      if (obj.features !== undefined) walk(obj.features);
    }
  };
  walk(geojson);
  return coords;
}

/**
 * K2.29 : convertit une trace Explorer (GeoJSON + altitudes optionnelles) en
 * `ContinuousRoute` prête pour `splitRouteIntoDays`.
 */
export function continuousRouteFromExplorer(input: {
  id: string;
  name?: string | null;
  geojson: unknown;
  sport?: SportKind;
  theme?: RouteTheme;
  countryCode?: string;
  timezone?: string;
  ownerId?: string;
  elevationsM?: Array<number | null>;
}): ContinuousRoute | null {
  const raw = extractLineCoordinatesFromGeojson(input.geojson);
  if (raw.length < 2) return null;
  const points: GpxTrackPoint[] = raw.map(([lon, lat], idx) => ({
    lat,
    lon,
    eleM:
      input.elevationsM && typeof input.elevationsM[idx] === 'number'
        ? (input.elevationsM[idx] as number)
        : 0,
  }));
  // Réduire légèrement si > 400 points pour garder un découpage fluide sans perdre la forme
  const step = points.length > 400 ? points.length / 400 : 1;
  const sampled: GpxTrackPoint[] = [];
  if (step === 1) {
    sampled.push(...points);
  } else {
    for (let i = 0; i < 399; i += 1) {
      sampled.push(points[Math.round(i * step)]);
    }
    sampled.push(points[points.length - 1]);
  }
  return {
    id: input.id,
    title: (input.name ?? '').trim() || `Itinéraire ${input.id}`,
    countryCode: input.countryCode ?? 'FR',
    sport: input.sport ?? 'hiking',
    theme: input.theme ?? 'general',
    timezone: input.timezone ?? 'Europe/Paris',
    points: sampled,
    ownerId: input.ownerId ?? 'explorer-local',
    audience: 'private',
    revision: 1,
  };
}

/**
 * K2.31 : transforme les POI Explorer (`refuge`, `bivouac`) en `LodgingAnchor[]`
 * triés par proximité au tracé ou au point de fin de journée.
 */
export function lodgingsFromExplorerPois(
  pois: readonly PoiItem[],
  refPoint?: { lat: number; lon: number; eleM?: number | null } | null
): LodgingAnchor[] {
  return pois
    .filter((p) => p.kind === 'refuge' || p.kind === 'bivouac')
    .map((p) => ({
      id: String(p.id),
      name: p.name,
      type: (p.kind === 'bivouac' ? 'bivouac' : 'refuge') as LodgingAnchor['type'],
      lat: p.lat,
      lon: p.lon,
      eleM: p.ele_m ?? null,
      capacity: p.capacity ?? null,
    }))
    .sort((a, b) => {
      if (!refPoint) return 0;
      const origin: GpxTrackPoint = { lat: refPoint.lat, lon: refPoint.lon, eleM: refPoint.eleM ?? null };
      return (
        haversineKm(origin, { lat: a.lat, lon: a.lon, eleM: a.eleM }) -
        haversineKm(origin, { lat: b.lat, lon: b.lon, eleM: b.eleM })
      );
    });
}

/**
 * K2.32 : convertit une étape d'un plan multi-jours en `TrailRouteSnapshot`
 * directement armable dans Explorer.
 */
export function trailSnapshotFromStage(
  planTitle: string,
  stage: Pick<StageRevision, 'stageId' | 'dayNumber' | 'points' | 'revision'>
): TrailRouteSnapshot {
  const coordinates = stage.points.map((p) => [p.lon, p.lat]);
  return {
    id: `stage-${stage.stageId}-r${stage.revision}`,
    name: `${planTitle} · Jour ${stage.dayNumber}`,
    status: coordinates.length >= 2 ? 'ready' : 'unavailable',
    geojson:
      coordinates.length >= 2
        ? { type: 'LineString', coordinates }
        : null,
  };
}

export function writePendingStageLaunch(payload: PendingStageLaunchPayload, storage?: Storage | null): boolean {
  const target = storage ?? (typeof window !== 'undefined' ? window.sessionStorage : null);
  if (!target) return false;
  try {
    target.setItem(EXPLORER_PENDING_STAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function consumePendingStageLaunch(storage?: Storage | null): PendingStageLaunchPayload | null {
  const target = storage ?? (typeof window !== 'undefined' ? window.sessionStorage : null);
  if (!target) return null;
  try {
    const raw = target.getItem(EXPLORER_PENDING_STAGE_KEY);
    if (!raw) return null;
    target.removeItem(EXPLORER_PENDING_STAGE_KEY);
    const parsed = JSON.parse(raw) as PendingStageLaunchPayload;
    if (!parsed || !Array.isArray(parsed.points) || parsed.points.length < 2) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * K1.13 : aventures multi-jours publiques de référence dans Explorer
 * (permettant découverte par pays, durée et thème dès la recherche Explorer).
 */
export function buildExplorerCatalogAdventures(): MultiDayPlan[] {
  const mkStage = (
    planId: string,
    day: number,
    pts: Array<[number, number, number]>,
    dist: number,
    dplus: number,
    lodgingName: string
  ): StageRevision => ({
    stageId: `${planId}-j${day}`,
    dayNumber: day,
    revision: 1,
    startPointIndex: 0,
    endPointIndex: pts.length - 1,
    startCoord: { lat: pts[0][0], lon: pts[0][1], eleM: pts[0][2] },
    endCoord: {
      lat: pts[pts.length - 1][0],
      lon: pts[pts.length - 1][1],
      eleM: pts[pts.length - 1][2],
    },
    points: pts.map(([lat, lon, eleM]) => ({ lat, lon, eleM })),
    distanceKm: dist,
    elevationGainM: dplus,
    elevationLossM: Math.round(dplus * 0.85),
    estimatedHours: Number((dist / 3.8 + dplus / 400).toFixed(1)),
    endLodging: {
      id: `lodge-${planId}-${day}`,
      name: lodgingName,
      type: 'refuge',
      lat: pts[pts.length - 1][0],
      lon: pts[pts.length - 1][1],
      eleM: pts[pts.length - 1][2],
    },
    standaloneLaunchable: true,
    offline: {
      mapReady: false,
      traceReady: true,
      guidanceReady: true,
      searchReady: true,
      rerouteReady: false,
    },
  });

  return [
    {
      id: 'adv-tmb-alpes',
      title: 'Tour du Mont-Blanc · Versant Sud',
      countryCode: 'FR',
      theme: 'alpine',
      sport: 'trekking',
      revision: 1,
      daysCount: 4,
      timezone: 'Europe/Paris',
      sourceRouteId: 'catalog-tmb',
      ownerId: 'public-lkdv',
      audience: 'public',
      publicShareConsented: true,
      createdAtIso: '2026-06-01T08:00:00.000Z',
      updatedAtIso: '2026-06-01T08:00:00.000Z',
      stages: [
        mkStage('adv-tmb', 1, [[45.887, 6.801, 1005], [45.841, 6.762, 1650], [45.798, 6.722, 1743]], 15.2, 1020, 'Refuge de la Balme'),
        mkStage('adv-tmb', 2, [[45.798, 6.722, 1743], [45.764, 6.774, 2537], [45.774, 6.829, 1789]], 16.4, 980, 'Refuge des Mottets'),
        mkStage('adv-tmb', 3, [[45.774, 6.829, 1789], [45.768, 6.912, 2516], [45.792, 6.968, 1224]], 18.1, 1050, 'Courmayeur · Val Veny'),
        mkStage('adv-tmb', 4, [[45.792, 6.968, 1224], [45.839, 7.039, 2537], [45.882, 7.078, 1600]], 14.8, 900, 'Refuge Elena / La Fouly'),
      ],
    },
    {
      id: 'adv-vercors-gr91',
      title: 'Hauts Plateaux du Vercors',
      countryCode: 'FR',
      theme: 'ridge',
      sport: 'trekking',
      revision: 1,
      daysCount: 3,
      timezone: 'Europe/Paris',
      sourceRouteId: 'catalog-gr91',
      ownerId: 'public-lkdv',
      audience: 'public',
      publicShareConsented: true,
      createdAtIso: '2026-06-01T08:00:00.000Z',
      updatedAtIso: '2026-06-01T08:00:00.000Z',
      stages: [
        mkStage('adv-vercors', 1, [[45.012, 5.565, 1180], [44.955, 5.531, 1520], [44.910, 5.492, 1615]], 16.0, 620, 'Cabane des Chaumailloux'),
        mkStage('adv-vercors', 2, [[44.910, 5.492, 1615], [44.861, 5.471, 1730], [44.812, 5.458, 1460]], 17.5, 680, 'Bivouac Pré Peyret'),
        mkStage('adv-vercors', 3, [[44.812, 5.458, 1460], [44.765, 5.421, 1340], [44.718, 5.388, 1050]], 14.5, 550, 'Col de Rousset'),
      ],
    },
    {
      id: 'adv-gr20-corse',
      title: 'GR20 Nord · Cirque et Lacs',
      countryCode: 'FR',
      theme: 'lake',
      sport: 'trekking',
      revision: 1,
      daysCount: 3,
      timezone: 'Europe/Paris',
      sourceRouteId: 'catalog-gr20',
      ownerId: 'public-lkdv',
      audience: 'public',
      publicShareConsented: true,
      createdAtIso: '2026-06-01T08:00:00.000Z',
      updatedAtIso: '2026-06-01T08:00:00.000Z',
      stages: [
        mkStage('adv-gr20', 1, [[42.495, 8.855, 270], [42.455, 8.875, 1100], [42.419, 8.898, 1570]], 12.2, 1280, 'Refuge d’Ortu di u Piobbu'),
        mkStage('adv-gr20', 2, [[42.419, 8.898, 1570], [42.390, 8.912, 1980], [42.362, 8.918, 1380]], 13.0, 950, 'Refuge de Carrozzu'),
        mkStage('adv-gr20', 3, [[42.362, 8.918, 1380], [42.345, 8.938, 1890], [42.326, 8.965, 1422]], 14.0, 870, 'Haut-Asco'),
      ],
    },
    {
      id: 'adv-gravel-loire',
      title: 'Gravel des Châteaux et Vallées',
      countryCode: 'FR',
      theme: 'heritage',
      sport: 'gravel',
      revision: 1,
      daysCount: 3,
      timezone: 'Europe/Paris',
      sourceRouteId: 'catalog-loire-gravel',
      ownerId: 'public-lkdv',
      audience: 'public',
      publicShareConsented: true,
      createdAtIso: '2026-06-01T08:00:00.000Z',
      updatedAtIso: '2026-06-01T08:00:00.000Z',
      stages: [
        mkStage('adv-loire', 1, [[47.902, 1.909, 115], [47.742, 1.622, 108], [47.586, 1.335, 95]], 58.0, 380, 'Blois · Bords de Loire'),
        mkStage('adv-loire', 2, [[47.586, 1.335, 95], [47.412, 1.158, 92], [47.411, 0.985, 85]], 54.0, 410, 'Amboise · Gîte cycliste'),
        mkStage('adv-loire', 3, [[47.411, 0.985, 85], [47.335, 0.802, 78], [47.394, 0.684, 56]], 56.0, 330, 'Tours · Confluence'),
      ],
    },
  ];
}
