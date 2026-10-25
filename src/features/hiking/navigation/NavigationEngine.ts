import { GPSPosition, POI, NavigationInstruction } from '../types';
import { HikeEngine } from '../engine/HikeEngine';

export type DeviationLevel = 'NORMAL' | 'WATCH' | 'WARNING' | 'OFF_ROUTE';

export interface NavigationStatus {
  deviationLevel: DeviationLevel;
  deviationMeters: number;
  isOffRoute: boolean;
  rejoinPoint: { lat: number; lon: number; bearingDeg: number } | null;
  currentSegmentName: string;
  nextWaypoint: (POI & { distanceRemainingM: number }) | null;
  instruction: NavigationInstruction;
}

export interface NavigationEngineOptions {
  watchThresholdM?: number;    // default 10m
  warningThresholdM?: number;  // default 25m
  offRouteThresholdM?: number; // default 50m
  rejoinThresholdM?: number;   // default 30m
  debounceCount?: number;      // default 2 samples
}

export class NavigationEngine {
  private options: Required<NavigationEngineOptions>;
  private historyDeviations: number[] = [];
  private consecutiveOffRouteSamples: number = 0;
  private consecutiveRejoinSamples: number = 0;
  private isOffRouteState: boolean = false;
  private currentSegmentName: string = 'Sentier principal';

  constructor(options?: NavigationEngineOptions) {
    this.options = {
      watchThresholdM: 10,
      warningThresholdM: 25,
      offRouteThresholdM: 50,
      rejoinThresholdM: 30,
      debounceCount: 2,
      ...options,
    };
  }

  /**
   * Evaluates current position relative to route geometry and waypoints.
   */
  public evaluateNavigation(
    currentPos: GPSPosition,
    routePoints?: { lat: number; lon: number }[],
    waypoints: POI[] = [],
    segmentName?: string
  ): NavigationStatus {
    if (segmentName) {
      this.currentSegmentName = segmentName;
    }

    // 1. Calculate deviation distance and closest point on route
    const { deviationMeters, closestPoint } = this.calculateRouteDeviation(currentPos, routePoints);

    // Maintain short history window (last 5 samples)
    this.historyDeviations.push(deviationMeters);
    if (this.historyDeviations.length > 5) {
      this.historyDeviations.shift();
    }

    // 2. Determine Multi-level Deviation Level with Debounce
    const deviationLevel = this.determineDeviationLevel(deviationMeters);

    // 3. Calculate Rejoin Point if off route or warning
    let rejoinPoint: { lat: number; lon: number; bearingDeg: number } | null = null;
    if (closestPoint && (deviationLevel === 'WARNING' || deviationLevel === 'OFF_ROUTE')) {
      const bearing = HikeEngine.calculateBearingDeg(
        currentPos.latitude,
        currentPos.longitude,
        closestPoint.lat,
        closestPoint.lon
      );
      rejoinPoint = {
        lat: closestPoint.lat,
        lon: closestPoint.lon,
        bearingDeg: bearing,
      };
    }

    // 4. Waypoint Approach Detection
    const nextWaypoint = this.findNextWaypoint(currentPos, waypoints);

    // 5. Generate Turn / Guidance Instruction
    const instruction = this.generateInstruction(
      currentPos,
      deviationLevel,
      deviationMeters,
      nextWaypoint,
      rejoinPoint
    );

    return {
      deviationLevel,
      deviationMeters,
      isOffRoute: this.isOffRouteState,
      rejoinPoint,
      currentSegmentName: this.currentSegmentName,
      nextWaypoint,
      instruction,
    };
  }

  public reset(): void {
    this.historyDeviations = [];
    this.consecutiveOffRouteSamples = 0;
    this.consecutiveRejoinSamples = 0;
    this.isOffRouteState = false;
  }

  // ── PRIVATE HELPERS ─────────────────────────────────────────────────────────

  private determineDeviationLevel(deviationMeters: number): DeviationLevel {
    const { watchThresholdM, warningThresholdM, offRouteThresholdM, rejoinThresholdM, debounceCount } = this.options;

    if (deviationMeters >= offRouteThresholdM) {
      this.consecutiveOffRouteSamples++;
      this.consecutiveRejoinSamples = 0;
      if (this.consecutiveOffRouteSamples >= debounceCount) {
        this.isOffRouteState = true;
      }
    } else if (deviationMeters <= rejoinThresholdM) {
      this.consecutiveRejoinSamples++;
      this.consecutiveOffRouteSamples = 0;
      if (this.consecutiveRejoinSamples >= debounceCount) {
        this.isOffRouteState = false;
      }
    }

    if (this.isOffRouteState) {
      return 'OFF_ROUTE';
    }
    if (deviationMeters >= warningThresholdM) {
      return 'WARNING';
    }
    if (deviationMeters >= watchThresholdM) {
      return 'WATCH';
    }
    return 'NORMAL';
  }

  private calculateRouteDeviation(
    currentPos: GPSPosition,
    routePoints?: { lat: number; lon: number }[]
  ): { deviationMeters: number; closestPoint: { lat: number; lon: number } | null } {
    if (!routePoints || routePoints.length === 0) {
      return { deviationMeters: 0, closestPoint: null };
    }

    let minDistanceKm = Infinity;
    let closestPoint: { lat: number; lon: number } | null = null;

    for (const pt of routePoints) {
      const distKm = HikeEngine.calculateDistanceKm(
        currentPos.latitude,
        currentPos.longitude,
        pt.lat,
        pt.lon
      );
      if (distKm < minDistanceKm) {
        minDistanceKm = distKm;
        closestPoint = pt;
      }
    }

    const deviationMeters = isFinite(minDistanceKm) ? Math.round(minDistanceKm * 1000) : 0;
    return { deviationMeters, closestPoint };
  }

  private findNextWaypoint(
    currentPos: GPSPosition,
    waypoints: POI[]
  ): (POI & { distanceRemainingM: number }) | null {
    if (waypoints.length === 0) return null;

    let closestPoi: POI | null = null;
    let minRemainingM = Infinity;

    for (const poi of waypoints) {
      const distKm = HikeEngine.calculateDistanceKm(
        currentPos.latitude,
        currentPos.longitude,
        poi.lat,
        poi.lon
      );
      const distM = Math.round(distKm * 1000);
      if (distM < minRemainingM) {
        minRemainingM = distM;
        closestPoi = poi;
      }
    }

    if (!closestPoi) return null;
    return {
      ...closestPoi,
      distanceRemainingM: minRemainingM,
    };
  }

  private generateInstruction(
    currentPos: GPSPosition,
    level: DeviationLevel,
    deviationMeters: number,
    nextWaypoint: (POI & { distanceRemainingM: number }) | null,
    rejoinPoint: { lat: number; lon: number; bearingDeg: number } | null
  ): NavigationInstruction {
    if (level === 'OFF_ROUTE') {
      return {
        type: 'off-route',
        message: `⚠️ Sortie du parcours (${deviationMeters} m)`,
        distanceMeters: deviationMeters,
        targetLat: rejoinPoint?.lat,
        targetLon: rejoinPoint?.lon,
        bearingDeg: rejoinPoint?.bearingDeg,
      };
    }

    if (nextWaypoint && nextWaypoint.distanceRemainingM < 30) {
      return {
        type: 'poi-reached',
        message: `📍 ${nextWaypoint.name} atteint !`,
        distanceMeters: 0,
        targetLat: nextWaypoint.lat,
        targetLon: nextWaypoint.lon,
      };
    }

    if (nextWaypoint && nextWaypoint.distanceRemainingM < 200) {
      const bearing = HikeEngine.calculateBearingDeg(
        currentPos.latitude,
        currentPos.longitude,
        nextWaypoint.lat,
        nextWaypoint.lon
      );

      let turnType: NavigationInstruction['type'] = 'straight';
      if (currentPos.heading != null) {
        const delta = (bearing - currentPos.heading + 360) % 360;
        if (delta > 45 && delta < 135) turnType = 'turn-right';
        else if (delta > 225 && delta < 315) turnType = 'turn-left';
        else if (delta >= 135 && delta <= 225) turnType = 'u-turn';
      }

      return {
        type: turnType,
        message: `${nextWaypoint.name} dans ${Math.round(nextWaypoint.distanceRemainingM)} m`,
        distanceMeters: Math.round(nextWaypoint.distanceRemainingM),
        targetLat: nextWaypoint.lat,
        targetLon: nextWaypoint.lon,
        bearingDeg: bearing,
      };
    }

    return {
      type: 'straight',
      message: `Continuez sur ${this.currentSegmentName}`,
      distanceMeters: 0,
    };
  }
}
