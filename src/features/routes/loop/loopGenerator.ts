import { haversineKm, type RouteLeg } from '@/features/adventure-prep/engine/routing';
import type { RouteRoutingOptions, RouteSport } from '@/features/adventure-prep/routeProfiles';
import { lineStringFromLegs, type RouteGeometry } from '@/features/adventure-prep/routeRevision';
import { routeAttemptForSport, type RoutePoint } from '@/features/adventure-prep/routingService';

export interface GenerateLoopRequest {
  readonly start: RoutePoint & { readonly label?: string | null };
  readonly sport: RouteSport;
  readonly targetDistanceKm: number;
  readonly bearingDeg?: number | null;
  readonly options?: RouteRoutingOptions;
}

export interface GeneratedLoopResult {
  readonly status: 'ready' | 'unavailable';
  readonly reason?: string;
  readonly sport: RouteSport;
  readonly targetDistanceKm: number;
  readonly actualDistanceKm: number | null;
  readonly durationMin: number | null;
  readonly provider: string | null;
  readonly bearingDeg: number;
  readonly waypoints: RoutePoint[];
  readonly geometry: RouteGeometry | null;
  readonly legs: RouteLeg[] | null;
}

const EARTH_RADIUS_KM = 6371;
const ROAD_WINDING_FACTOR = 1.38;

/** Projette un point depuis `origin` à distance `distanceKm` et cap `bearingDeg`. */
export function destinationPoint(
  origin: RoutePoint,
  distanceKm: number,
  bearingDeg: number
): RoutePoint {
  const angular = distanceKm / EARTH_RADIUS_KM;
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (origin.lat * Math.PI) / 180;
  const lon1 = (origin.lon * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(brng)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2)
    );
  const lonDeg = ((((lon2 * 180) / Math.PI) + 540) % 360) - 180;
  return {
    lat: Number(((lat2 * 180) / Math.PI).toFixed(6)),
    lon: Number(lonDeg.toFixed(6)),
  };
}

/**
 * Construit un anneau géométrique de points de passage formant une boucle
 * réaliste de ~`targetDistanceKm` autour de `start` dans la direction `bearingDeg`.
 */
export function buildLoopSeedWaypoints(
  start: RoutePoint,
  targetDistanceKm: number,
  bearingDeg = 45
): RoutePoint[] {
  const clampedKm = Math.max(2, Math.min(200, targetDistanceKm));
  // Périmètre d'un triangle/losange avec facteur de sinuosité réel du réseau
  const legKm = clampedKm / (3.1 * ROAD_WINDING_FACTOR);
  const p1 = destinationPoint(start, legKm, bearingDeg);
  const p2 = destinationPoint(start, legKm * 1.05, (bearingDeg + 68) % 360);
  return [
    { lat: start.lat, lon: start.lon },
    p1,
    p2,
    { lat: start.lat, lon: start.lon },
  ];
}

export type LoopRouter = (
  points: readonly RoutePoint[],
  sport: RouteSport,
  signal?: AbortSignal,
  cacheBaseUrl?: string,
  signCacheKey?: (key: string) => string,
  options?: RouteRoutingOptions
) => ReturnType<typeof routeAttemptForSport>;

/**
 * S3.09 : Génère une boucle réelle sur le réseau sportif choisi en testant
 * jusqu'à deux caps (cap choisi + cap opposé si hors réseau / hors cible).
 * Aucune distance n'est inventée : en cas d'échec réseau/graphe, retourne `unavailable`.
 */
export async function generateSportLoop(
  req: GenerateLoopRequest,
  deps?: {
    router?: LoopRouter;
    signal?: AbortSignal;
    cacheBaseUrl?: string;
    signCacheKey?: (key: string) => string;
  }
): Promise<GeneratedLoopResult> {
  const targetKm = Number.isFinite(req.targetDistanceKm)
    ? Math.max(2, Math.min(200, req.targetDistanceKm))
    : 10;
  const primaryBearing =
    typeof req.bearingDeg === 'number' && Number.isFinite(req.bearingDeg)
      ? ((req.bearingDeg % 360) + 360) % 360
      : 35;
  const router = deps?.router ?? routeAttemptForSport;

  const bearings = [primaryBearing, (primaryBearing + 180) % 360];
  let best: GeneratedLoopResult | null = null;
  let lastReason = 'unavailable';

  for (const bearing of bearings) {
    const waypoints = buildLoopSeedWaypoints(req.start, targetKm, bearing);
    const attempt = await router(
      waypoints,
      req.sport,
      deps?.signal,
      deps?.cacheBaseUrl,
      deps?.signCacheKey,
      req.options
    );
    if (!attempt.legs || attempt.legs.length === 0) {
      lastReason = attempt.reason ?? 'off_network';
      continue;
    }
    const geometry = lineStringFromLegs(attempt.legs);
    const actualDistanceKm = attempt.legs.reduce((s, l) => s + l.distanceKm, 0);
    const durationMin = attempt.legs.reduce((s, l) => s + l.durationMin, 0);
    const closedCheck =
      geometry.coordinates.length >= 2
        ? haversineKm(
            { lat: geometry.coordinates[0][1], lon: geometry.coordinates[0][0] },
            {
              lat: geometry.coordinates[geometry.coordinates.length - 1][1],
              lon: geometry.coordinates[geometry.coordinates.length - 1][0],
            }
          ) < 0.8
        : false;

    if (!closedCheck || actualDistanceKm <= 0.2) {
      lastReason = 'loop_incomplete';
      continue;
    }

    const candidate: GeneratedLoopResult = {
      status: 'ready',
      sport: req.sport,
      targetDistanceKm: targetKm,
      actualDistanceKm: Number(actualDistanceKm.toFixed(2)),
      durationMin: Math.round(durationMin),
      provider: attempt.provider ?? null,
      bearingDeg: bearing,
      waypoints,
      geometry,
      legs: attempt.legs,
    };

    const ratio = actualDistanceKm / targetKm;
    if (ratio >= 0.72 && ratio <= 1.35) {
      return candidate;
    }
    if (
      !best ||
      Math.abs((candidate.actualDistanceKm ?? 0) - targetKm) <
        Math.abs((best.actualDistanceKm ?? 0) - targetKm)
    ) {
      best = candidate;
    }
  }

  if (best) return best;

  return {
    status: 'unavailable',
    reason: lastReason,
    sport: req.sport,
    targetDistanceKm: targetKm,
    actualDistanceKm: null,
    durationMin: null,
    provider: null,
    bearingDeg: primaryBearing,
    waypoints: [],
    geometry: null,
    legs: null,
  };
}
