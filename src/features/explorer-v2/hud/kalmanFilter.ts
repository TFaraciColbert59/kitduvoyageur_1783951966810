/**
 * Filtre de Kalman 2D pour lissage de position GPS en suivi terrain (Track E).
 *
 * - Pondère chaque mesure par son incertitude (`accuracyM`).
 * - Rejette les pics aberrants dont la précision dépasse 65 m sans altérer l'état.
 * - Détecte le passage en navigation à l'estime (`isDeadReckoning`) dès que
 *   l'écart depuis le dernier point valide dépasse 8 000 ms.
 */

export interface GpsFixInput {
  lat: number;
  lng: number;
  /** Rayon d'incertitude horizontal en mètres (1 sigma). */
  accuracyM: number;
  /** Horodatage du fix en millisecondes. */
  timestampMs: number;
  /** Vitesse instantanée rapportée par le capteur (m/s), optionnelle. */
  speedMps?: number | null;
}

export interface FilteredGpsPoint {
  lat: number;
  lng: number;
  accuracyM: number;
  timestampMs: number;
}

export interface GpsKalmanFilterOptions {
  /** Précision minimale retenue pour éviter une variance nulle (m). Défaut : 1. */
  minAccuracyM?: number;
  /** Seuil au-delà duquel un fix est rejeté comme pic aberrant (m). Défaut : 65. */
  maxAccuracyM?: number;
  /** Bruit de processus nominal en m/s (vitesse caractéristique). Défaut : 3. */
  processNoiseMps?: number;
  /** Durée sans fix valide au-delà de laquelle on passe à l'estime (ms). Défaut : 8000. */
  deadReckoningGapMs?: number;
}

export const DEFAULT_MAX_GPS_ACCURACY_M = 65;
export const DEFAULT_DEAD_RECKONING_GAP_MS = 8000;

export class GpsKalmanFilter {
  private readonly minAccuracyM: number;
  private readonly maxAccuracyM: number;
  private readonly processNoiseMps: number;
  private readonly deadReckoningGapMs: number;

  private lat: number | null = null;
  private lng: number | null = null;
  private variance: number = -1;
  private lastTimestampMs: number | null = null;
  private rejectedCount = 0;

  constructor(options: GpsKalmanFilterOptions = {}) {
    this.minAccuracyM = options.minAccuracyM ?? 1;
    this.maxAccuracyM = options.maxAccuracyM ?? DEFAULT_MAX_GPS_ACCURACY_M;
    this.processNoiseMps = options.processNoiseMps ?? 3;
    this.deadReckoningGapMs = options.deadReckoningGapMs ?? DEFAULT_DEAD_RECKONING_GAP_MS;
  }

  /**
   * Intègre un nouveau fix GPS.
   * Retourne le point lissé, ou `null` si le fix est invalide, hors ordre ou
   * rejeté pour imprécision (> 65 m).
   */
  process(fix: GpsFixInput): FilteredGpsPoint | null {
    if (
      !Number.isFinite(fix.lat) ||
      !Number.isFinite(fix.lng) ||
      !Number.isFinite(fix.accuracyM) ||
      !Number.isFinite(fix.timestampMs) ||
      fix.lat < -90 ||
      fix.lat > 90 ||
      fix.lng < -180 ||
      fix.lng > 180 ||
      fix.accuracyM <= 0
    ) {
      this.rejectedCount += 1;
      return null;
    }

    if (fix.accuracyM > this.maxAccuracyM) {
      this.rejectedCount += 1;
      return null;
    }

    if (this.lastTimestampMs !== null && fix.timestampMs < this.lastTimestampMs) {
      this.rejectedCount += 1;
      return null;
    }

    const effectiveAccuracy = Math.max(fix.accuracyM, this.minAccuracyM);

    if (this.variance < 0 || this.lat === null || this.lng === null || this.lastTimestampMs === null) {
      this.lat = fix.lat;
      this.lng = fix.lng;
      this.variance = effectiveAccuracy * effectiveAccuracy;
      this.lastTimestampMs = fix.timestampMs;
      return this.getLastPosition();
    }

    const dtSeconds = Math.max(0, (fix.timestampMs - this.lastTimestampMs) / 1000);
    if (dtSeconds > 0) {
      const speed =
        fix.speedMps !== undefined &&
        fix.speedMps !== null &&
        Number.isFinite(fix.speedMps) &&
        fix.speedMps > 0
          ? Math.max(this.processNoiseMps, fix.speedMps)
          : this.processNoiseMps;
      this.variance += dtSeconds * speed * speed;
    }

    const measurementVariance = effectiveAccuracy * effectiveAccuracy;
    const kalmanGain = this.variance / (this.variance + measurementVariance);

    this.lat += kalmanGain * (fix.lat - this.lat);
    this.lng += kalmanGain * (fix.lng - this.lng);
    this.variance = (1 - kalmanGain) * this.variance;
    this.lastTimestampMs = fix.timestampMs;

    return this.getLastPosition();
  }

  /**
   * Vrai lorsque le dernier fix valide remonte à plus de 8 000 ms (perte de signal / estime).
   */
  isDeadReckoning(nowMs: number = Date.now()): boolean {
    if (this.lastTimestampMs === null || !Number.isFinite(nowMs)) return false;
    return nowMs - this.lastTimestampMs > this.deadReckoningGapMs;
  }

  getLastPosition(): FilteredGpsPoint | null {
    if (this.lat === null || this.lng === null || this.lastTimestampMs === null || this.variance < 0) {
      return null;
    }
    return {
      lat: this.lat,
      lng: this.lng,
      accuracyM: Math.sqrt(this.variance),
      timestampMs: this.lastTimestampMs,
    };
  }

  getLastTimestampMs(): number | null {
    return this.lastTimestampMs;
  }

  getRejectedCount(): number {
    return this.rejectedCount;
  }

  reset(): void {
    this.lat = null;
    this.lng = null;
    this.variance = -1;
    this.lastTimestampMs = null;
    this.rejectedCount = 0;
  }
}
