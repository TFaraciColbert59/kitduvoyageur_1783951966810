import { computeCscMetrics } from './bleGattDecoders';
import type {
  DecodedBleFrame,
  DecodedCscFrame,
  QualifiedMetricValue,
  QualifiedTelemetrySnapshot,
  QualifiedTelemetrySummary,
  TelemetryMetricKey,
} from './types';

export const DEFAULT_TELEMETRY_STALE_MS = 5_000;
export const DEFAULT_WHEEL_CIRCUMFERENCE_MM = 2_105;

interface StoredMetric {
  value: number;
  sourceDeviceId: string;
  updatedAtMs: number;
}

function emptyMetric(): QualifiedMetricValue {
  return {
    value: null,
    qualification: 'unavailable',
    sourceDeviceId: null,
    updatedAtMs: null,
  };
}

function qualifyMetric(
  stored: StoredMetric | undefined,
  nowMs: number,
  staleAfterMs: number,
): QualifiedMetricValue {
  if (!stored) return emptyMetric();
  const ageMs = nowMs - stored.updatedAtMs;
  return {
    value: stored.value,
    qualification: ageMs <= staleAfterMs ? 'measured' : 'stale',
    sourceDeviceId: stored.sourceDeviceId,
    updatedAtMs: stored.updatedAtMs,
  };
}

export interface QualifiedTelemetryStreamOptions {
  staleAfterMs?: number;
  wheelCircumferenceMm?: number;
}

/**
 * Flux de télémétrie qualifiée temps réel (S6.06, S6.07).
 *
 * Invariant strict : aucune valeur n'est jamais inventée ou simulée.
 * En l'absence de capteur réel, chaque métrique reste `unavailable` avec `value: null`.
 */
export class QualifiedTelemetryStream {
  private readonly staleAfterMs: number;
  private readonly wheelCircumferenceMm: number;
  private readonly metrics = new Map<TelemetryMetricKey, StoredMetric>();
  private readonly lastCscByDevice = new Map<string, DecodedCscFrame>();

  private sampleCount = 0;
  private hrValues: number[] = [];
  private powerValues: number[] = [];
  private cadenceValues: number[] = [];
  private speedValues: number[] = [];

  constructor(options: QualifiedTelemetryStreamOptions = {}) {
    this.staleAfterMs = options.staleAfterMs ?? DEFAULT_TELEMETRY_STALE_MS;
    this.wheelCircumferenceMm = options.wheelCircumferenceMm ?? DEFAULT_WHEEL_CIRCUMFERENCE_MM;
  }

  private setMetric(key: TelemetryMetricKey, value: number, deviceId: string, nowMs: number): void {
    if (!Number.isFinite(value)) return;
    this.metrics.set(key, { value, sourceDeviceId: deviceId, updatedAtMs: nowMs });
  }

  /**
   * Ingère une trame GATT décodée issue d'un capteur réel.
   */
  ingestFrame(deviceId: string, frame: DecodedBleFrame, nowMs: number = Date.now()): void {
    let recordedAny = false;

    switch (frame.kind) {
      case 'heart_rate': {
        if (frame.heartRateBpm > 0) {
          this.setMetric('heartRateBpm', frame.heartRateBpm, deviceId, nowMs);
          this.hrValues.push(frame.heartRateBpm);
          recordedAny = true;
        }
        break;
      }

      case 'cycling_sc': {
        const prev = this.lastCscByDevice.get(deviceId);
        this.lastCscByDevice.set(deviceId, frame);
        if (prev) {
          const { speedMs, cadenceRpm } = computeCscMetrics(
            prev,
            frame,
            this.wheelCircumferenceMm,
          );
          if (speedMs !== null) {
            this.setMetric('cyclingSpeedMs', speedMs, deviceId, nowMs);
            this.speedValues.push(speedMs);
            recordedAny = true;
          }
          if (cadenceRpm !== null) {
            this.setMetric('cyclingCadenceRpm', cadenceRpm, deviceId, nowMs);
            this.cadenceValues.push(cadenceRpm);
            recordedAny = true;
          }
        }
        break;
      }

      case 'cycling_power': {
        this.setMetric('cyclingPowerWatts', frame.instantaneousPowerWatts, deviceId, nowMs);
        this.powerValues.push(frame.instantaneousPowerWatts);
        recordedAny = true;
        break;
      }

      case 'running_sc': {
        this.setMetric('runningSpeedMs', frame.instantaneousSpeedMs, deviceId, nowMs);
        this.setMetric('runningCadenceSpm', frame.instantaneousCadenceSpm, deviceId, nowMs);
        this.speedValues.push(frame.instantaneousSpeedMs);
        this.cadenceValues.push(frame.instantaneousCadenceSpm);
        if (frame.strideLengthM !== null) {
          this.setMetric('strideLengthM', frame.strideLengthM, deviceId, nowMs);
        }
        recordedAny = true;
        break;
      }
    }

    if (recordedAny) {
      this.sampleCount += 1;
    }
  }

  /**
   * Réinitialise l'état CSC d'un capteur déconnecté pour éviter un faux delta à la reconnexion.
   */
  clearDeviceState(deviceId: string): void {
    this.lastCscByDevice.delete(deviceId);
  }

  getSnapshot(nowMs: number = Date.now()): QualifiedTelemetrySnapshot {
    return {
      capturedAtMs: nowMs,
      heartRateBpm: qualifyMetric(this.metrics.get('heartRateBpm'), nowMs, this.staleAfterMs),
      cyclingSpeedMs: qualifyMetric(this.metrics.get('cyclingSpeedMs'), nowMs, this.staleAfterMs),
      cyclingCadenceRpm: qualifyMetric(
        this.metrics.get('cyclingCadenceRpm'),
        nowMs,
        this.staleAfterMs,
      ),
      cyclingPowerWatts: qualifyMetric(
        this.metrics.get('cyclingPowerWatts'),
        nowMs,
        this.staleAfterMs,
      ),
      runningSpeedMs: qualifyMetric(this.metrics.get('runningSpeedMs'), nowMs, this.staleAfterMs),
      runningCadenceSpm: qualifyMetric(
        this.metrics.get('runningCadenceSpm'),
        nowMs,
        this.staleAfterMs,
      ),
      strideLengthM: qualifyMetric(this.metrics.get('strideLengthM'), nowMs, this.staleAfterMs),
    };
  }

  /**
   * Résumé agrégé des seules mesures réelles reçues (`null` si aucune mesure réelle).
   */
  getSummary(): QualifiedTelemetrySummary {
    const avg = (arr: number[]): number | null =>
      arr.length === 0 ? null : arr.reduce((sum, v) => sum + v, 0) / arr.length;
    const max = (arr: number[]): number | null =>
      arr.length === 0 ? null : arr.reduce((m, v) => (v > m ? v : m), arr[0]!);

    return {
      sampleCount: this.sampleCount,
      avgHeartRateBpm: avg(this.hrValues),
      maxHeartRateBpm: max(this.hrValues),
      avgPowerWatts: avg(this.powerValues),
      maxPowerWatts: max(this.powerValues),
      avgCadenceRpm: avg(this.cadenceValues),
      avgSpeedMs: avg(this.speedValues),
    };
  }
}
