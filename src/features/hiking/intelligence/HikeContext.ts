import { GPSPosition, HikingState, POI } from '../types';
import { RouteTurnEvent } from '../services/RouteGeom';

export interface HikeContext {
  position: GPSPosition | null;
  accuracyM: number | null;
  speedKmH: number | null;
  headingDeg: number | null;
  progressFrac: number | null;
  distanceKm: number;
  remainingDistanceKm: number;
  nextTurn: { turn: RouteTurnEvent; distanceRemainingM: number } | null;
  nextPoi: (POI & { distanceRemainingM: number }) | null;
  state: HikingState;
  movingTimeSec: number;
  pausedTimeSec: number;
  elevationGainM: number | null;
  isOffRoute: boolean;
  batteryLevel: number | null;
  isOffline: boolean;
}

export class HikeContextBuilder {
  public static buildContext(params: {
    positions: GPSPosition[];
    state: HikingState;
    distanceKm: number;
    totalRouteDistanceKm?: number | null;
    progressFrac?: number | null;
    nextTurn?: { turn: RouteTurnEvent; distanceRemainingM: number } | null;
    nextPoi?: (POI & { distanceRemainingM: number }) | null;
    durationSeconds: number;
    elevationGainM?: number | null;
    isOffRoute?: boolean;
    batteryLevel?: number | null;
    isOffline?: boolean;
  }): HikeContext {
    const currentPos = params.positions.length > 0 ? params.positions[params.positions.length - 1] : null;

    const totalDist = params.totalRouteDistanceKm || 0;
    const currentDist = params.distanceKm || 0;
    const remainingKm = totalDist > 0 ? Math.max(0, totalDist - currentDist) : 0;

    return {
      position: currentPos,
      accuracyM: currentPos?.accuracy != null && Number.isFinite(currentPos.accuracy) ? currentPos.accuracy : null,
      speedKmH: currentPos?.speed != null && Number.isFinite(currentPos.speed) ? Math.max(0, currentPos.speed * 3.6) : null,
      headingDeg: currentPos?.heading != null && Number.isFinite(currentPos.heading) ? currentPos.heading : null,
      progressFrac: params.progressFrac ?? (totalDist > 0 ? Math.min(1, currentDist / totalDist) : null),
      distanceKm: currentDist,
      remainingDistanceKm: remainingKm,
      nextTurn: params.nextTurn || null,
      nextPoi: params.nextPoi || null,
      state: params.state,
      movingTimeSec: params.durationSeconds,
      pausedTimeSec: 0,
      elevationGainM: params.elevationGainM ?? null,
      isOffRoute: params.isOffRoute ?? false,
      batteryLevel: params.batteryLevel ?? null,
      isOffline: params.isOffline ?? false,
    };
  }
}
