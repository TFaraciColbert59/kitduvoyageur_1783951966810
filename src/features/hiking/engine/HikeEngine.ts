import { GPSPosition } from '../types';

export class HikeEngine {
  /**
   * Earth radius in kilometers (WGS-84 sphere approximation).
   */
  private static readonly EARTH_RADIUS_KM = 6371.0;

  /**
   * Calculate Haversine distance between two GPS positions in kilometers.
   */
  public static calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return this.EARTH_RADIUS_KM * c;
  }

  /**
   * Calculate bearing (heading angle 0-360°) from pos1 to pos2.
   */
  public static calculateBearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const phi1 = this.toRadians(lat1);
    const phi2 = this.toRadians(lat2);
    const deltaLambda = this.toRadians(lon2 - lon1);

    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x =
      Math.cos(phi1) * Math.sin(phi2) -
      Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

    const theta = Math.atan2(y, x);
    return (this.toDegrees(theta) + 360) % 360;
  }

  /**
   * Filter and smooth altitude changes from GPS positions.
   * Ignores samples with altitudeAccuracy > 25m and calculates positive elevation gain (> 2m delta).
   */
  public static calculateElevationGain(positions: GPSPosition[]): number | null {
    const validAltitudes = positions
      .filter((p) => p.altitude != null && (p.altitudeAccuracy == null || p.altitudeAccuracy <= 25))
      .map((p) => p.altitude as number);

    if (validAltitudes.length < 2) return null;

    // Moving average smoothing (window of 5)
    const windowSize = 5;
    const smoothed: number[] = [];
    for (let i = 0; i < validAltitudes.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(validAltitudes.length, i + Math.ceil(windowSize / 2));
      const slice = validAltitudes.slice(start, end);
      const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
      smoothed.push(avg);
    }

    let gainM = 0;
    for (let i = 1; i < smoothed.length; i++) {
      const delta = smoothed[i] - smoothed[i - 1];
      if (delta > 2.0) {
        gainM += delta;
      }
    }

    return gainM;
  }

  /**
   * Calculate average pace in min/km from duration (seconds) and distance (km).
   */
  public static calculatePaceMinPerKm(durationSeconds: number, distanceKm: number): number {
    if (distanceKm <= 0 || durationSeconds <= 0) return 0;
    return durationSeconds / 60.0 / distanceKm;
  }

  private static toRadians(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  private static toDegrees(rad: number): number {
    return (rad * 180) / Math.PI;
  }
}
