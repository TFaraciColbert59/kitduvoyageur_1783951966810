import { GPSPosition, GPSSample } from '../types';
import { HikeEngine } from './HikeEngine';

export interface TrackingMetrics {
  distanceKm: number;
  currentSpeedKmH: number;
  averageSpeedKmH: number;
  paceMinPerKm: number;
  elevationGainM: number;
  activeDurationSeconds: number;
  pausedDurationSeconds: number;
  estimatedEtaMinutes: number | null;
  isAutoPaused: boolean;
  rawSampleCount: number;
  validSampleCount: number;
}

export class TrackingEngine {
  private rawPositions: GPSPosition[] = [];
  private validPositions: GPSPosition[] = [];
  private samples: GPSSample[] = [];
  
  private totalDistanceKm: number = 0;
  private elevationGainM: number = 0;
  private startTimeMs: number | null = null;
  private lastActiveTimestampMs: number | null = null;
  private pausedDurationSeconds: number = 0;
  
  private isAutoPaused: boolean = false;
  private autoPauseTimerMs: number = 0;
  private static readonly AUTO_PAUSE_SPEED_THRESHOLD_KMH = 0.5;
  private static readonly AUTO_PAUSE_DURATION_SEC = 120;

  /**
   * Process a raw GPS position input.
   * Returns true if sample was valid and accepted, false if rejected as outlier.
   */
  public processPosition(position: GPSPosition): boolean {
    this.rawPositions.push(position);

    if (!this.startTimeMs) {
      this.startTimeMs = position.timestamp;
      this.lastActiveTimestampMs = position.timestamp;
    }

    // Outlier Filter Checks
    if (!this.isValidPosition(position)) {
      return false;
    }

    const lastPos = this.validPositions.length > 0 ? this.validPositions[this.validPositions.length - 1] : null;

    if (lastPos) {
      const distanceDeltaKm = HikeEngine.calculateDistanceKm(
        lastPos.latitude,
        lastPos.longitude,
        position.latitude,
        position.longitude
      );

      const timeDeltaS = Math.max(0.001, (position.timestamp - lastPos.timestamp) / 1000);
      const speedKmH = (distanceDeltaKm / timeDeltaS) * 3600;

      // Filter impossible hiking speeds (> 30 km/h or teleportation > 500m in 3s)
      if (speedKmH > 30 || (distanceDeltaKm > 0.5 && timeDeltaS < 3)) {
        console.warn('[TrackingEngine] Rejected outlier position (speed/jump):', { speedKmH, distanceDeltaKm });
        return false;
      }

      // Filter altitude jump (> 300m in 60s)
      if (position.altitude != null && lastPos.altitude != null) {
        const altDeltaM = Math.abs(position.altitude - lastPos.altitude);
        if (altDeltaM > 300 && timeDeltaS < 60) {
          console.warn('[TrackingEngine] Rejected altitude jump:', altDeltaM);
          return false;
        }
      }

      // Accumulate valid distance
      const distanceDeltaM = distanceDeltaKm * 1000;
      this.totalDistanceKm += distanceDeltaKm;

      // Auto-pause detection
      if (speedKmH < TrackingEngine.AUTO_PAUSE_SPEED_THRESHOLD_KMH) {
        this.autoPauseTimerMs += timeDeltaS * 1000;
        if (this.autoPauseTimerMs >= TrackingEngine.AUTO_PAUSE_DURATION_SEC * 1000) {
          this.isAutoPaused = true;
        }
      } else {
        this.autoPauseTimerMs = 0;
        this.isAutoPaused = false;
        this.lastActiveTimestampMs = position.timestamp;
      }

      const sample: GPSSample = {
        position,
        distanceDeltaM,
        timeDeltaS,
        elevationDeltaM: position.altitude != null && lastPos.altitude != null ? position.altitude - lastPos.altitude : 0,
      };
      this.samples.push(sample);
    }

    this.validPositions.push(position);
    this.elevationGainM = HikeEngine.calculateElevationGain(this.validPositions) || 0;

    return true;
  }

  /**
   * Calculate current tracking metrics.
   */
  public getMetrics(remainingRouteDistanceKm?: number | null): TrackingMetrics {
    const now = Date.now();
    const firstPos = this.validPositions.length > 0 ? this.validPositions[0] : null;
    const lastPos = this.validPositions.length > 0 ? this.validPositions[this.validPositions.length - 1] : null;
    
    let totalElapsedS = 0;
    if (firstPos && lastPos && lastPos.timestamp > firstPos.timestamp) {
      totalElapsedS = Math.floor((lastPos.timestamp - firstPos.timestamp) / 1000);
    } else if (this.startTimeMs) {
      totalElapsedS = Math.max(0, Math.floor((now - this.startTimeMs) / 1000));
    }
    
    const activeDurationSeconds = Math.max(0, totalElapsedS - this.pausedDurationSeconds);
    const paceMinPerKm = HikeEngine.calculatePaceMinPerKm(activeDurationSeconds, this.totalDistanceKm);
    const averageSpeedKmH = activeDurationSeconds > 0 ? (this.totalDistanceKm / activeDurationSeconds) * 3600 : 0;

    const currentSpeedKmH = lastPos && lastPos.speed != null ? Math.max(0, lastPos.speed * 3.6) : averageSpeedKmH;

    // Calculate ETA (in minutes) for remaining distance
    let estimatedEtaMinutes: number | null = null;
    if (remainingRouteDistanceKm != null && remainingRouteDistanceKm > 0 && paceMinPerKm > 0) {
      estimatedEtaMinutes = Math.round(remainingRouteDistanceKm * paceMinPerKm);
    }

    return {
      distanceKm: this.totalDistanceKm,
      currentSpeedKmH: Math.round(currentSpeedKmH * 10) / 10,
      averageSpeedKmH: Math.round(averageSpeedKmH * 10) / 10,
      paceMinPerKm,
      elevationGainM: Math.round(this.elevationGainM),
      activeDurationSeconds,
      pausedDurationSeconds: this.pausedDurationSeconds,
      estimatedEtaMinutes,
      isAutoPaused: this.isAutoPaused,
      rawSampleCount: this.rawPositions.length,
      validSampleCount: this.validPositions.length,
    };
  }

  public getValidPositions(): GPSPosition[] {
    return [...this.validPositions];
  }

  public reset(): void {
    this.rawPositions = [];
    this.validPositions = [];
    this.samples = [];
    this.totalDistanceKm = 0;
    this.elevationGainM = 0;
    this.startTimeMs = null;
    this.lastActiveTimestampMs = null;
    this.pausedDurationSeconds = 0;
    this.isAutoPaused = false;
    this.autoPauseTimerMs = 0;
  }

  /**
   * Filter out low accuracy GPS readings (> 50 meters).
   */
  private isValidPosition(pos: GPSPosition): boolean {
    if (isNaN(pos.latitude) || isNaN(pos.longitude)) return false;
    if (pos.latitude < -90 || pos.latitude > 90 || pos.longitude < -180 || pos.longitude > 180) return false;
    if (pos.accuracy != null && pos.accuracy > 50) return false;
    return true;
  }
}
