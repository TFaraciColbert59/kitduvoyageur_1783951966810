/**
 * Conversions d'unités et formatage sans invention de métriques (S1.08–S1.12).
 *
 * Toutes les mesures internes sont stockées dans le système international :
 *   - distances en mètres (`m`)
 *   - dénivelés en mètres (`m`)
 *   - durées en secondes (`s`)
 *   - vitesses en mètres par seconde (`m/s`) ou kilomètres par heure (`km/h`)
 *
 * Les conversions vers les unités impériales (`mi`, `yd`, `ft`, `mph`, `min/mi`,
 * `min/100yd`) sont pures et exactes.
 */

import type {
  DistanceUnit,
  ElevationUnit,
  ExplicitMetricValue,
  MetricAvailabilityStatus,
  MetricUnavailableReason,
  UnitSystem,
} from './types';

export const METERS_PER_KM = 1000;
export const METERS_PER_MILE = 1609.344;
export const METERS_PER_YARD = 0.9144;
export const METERS_PER_FOOT = 0.3048;

export function toMeters(value: number, unit: DistanceUnit): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  switch (unit) {
    case 'm':
      return value;
    case 'km':
      return value * METERS_PER_KM;
    case 'mi':
      return value * METERS_PER_MILE;
    case 'yd':
      return value * METERS_PER_YARD;
  }
}

export function fromMeters(distanceM: number, unit: DistanceUnit): number {
  if (!Number.isFinite(distanceM) || distanceM < 0) return 0;
  switch (unit) {
    case 'm':
      return distanceM;
    case 'km':
      return distanceM / METERS_PER_KM;
    case 'mi':
      return distanceM / METERS_PER_MILE;
    case 'yd':
      return distanceM / METERS_PER_YARD;
  }
}

export function elevationToMeters(value: number, unit: ElevationUnit): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return unit === 'ft' ? value * METERS_PER_FOOT : value;
}

export function elevationFromMeters(elevM: number, unit: ElevationUnit): number {
  if (!Number.isFinite(elevM) || elevM < 0) return 0;
  return unit === 'ft' ? elevM / METERS_PER_FOOT : elevM;
}

export function formatDurationSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad2 = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${pad2(minutes)}:${pad2(secs)}`;
  }
  return `${minutes}:${pad2(secs)}`;
}

/**
 * Formate une allure (en secondes par unité de distance, ex. s/km, s/mi, s/100m).
 */
export function formatPaceSeconds(paceSeconds: number, unitLabel: string): string {
  if (!Number.isFinite(paceSeconds) || paceSeconds <= 0) return 'Indisponible';
  const rounded = Math.round(paceSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')} /${unitLabel}`;
}

export function unavailableMetric<T = number>(
  unit: string,
  reason: MetricUnavailableReason,
): ExplicitMetricValue<T> {
  return {
    status: 'unavailable',
    value: null,
    unit,
    formatted: 'Indisponible',
    unavailableReason: reason,
  };
}

export function availableMetric(
  value: number,
  unit: string,
  formatted: string,
  status: Exclude<MetricAvailabilityStatus, 'unavailable'> = 'measured',
): ExplicitMetricValue<number> {
  return {
    status,
    value,
    unit,
    formatted,
  };
}

export function buildStandardSummaryMetrics(params: {
  distanceM: number | null;
  movingS: number;
  elevGainM: number | null;
  verticalDropM?: number | null;
  heartRateBpm?: number | null;
  powerW?: number | null;
  cadenceRpm?: number | null;
  units: UnitSystem;
  sourceStatus?: 'measured' | 'manual';
  distanceUnavailableReason?: MetricUnavailableReason;
  elevationUnavailableReason?: MetricUnavailableReason;
}) {
  const status = params.sourceStatus ?? 'measured';
  const isImperial = params.units === 'imperial';

  const duration = availableMetric(
    params.movingS,
    's',
    formatDurationSeconds(params.movingS),
    status,
  );

  const hasDistance =
    params.distanceM !== null &&
    params.distanceM !== undefined &&
    Number.isFinite(params.distanceM) &&
    params.distanceM >= 0;

  const distanceUnit = isImperial ? 'mi' : 'km';
  const distanceValue = hasDistance
    ? fromMeters(params.distanceM!, isImperial ? 'mi' : 'km')
    : null;
  const distance: ExplicitMetricValue<number> =
    hasDistance && distanceValue !== null
      ? availableMetric(
          Number(distanceValue.toFixed(2)),
          distanceUnit,
          `${distanceValue.toFixed(2)} ${distanceUnit}`,
          status,
        )
      : unavailableMetric(distanceUnit, params.distanceUnavailableReason ?? 'no_gps_in_mode');

  const elevUnit = isImperial ? 'ft' : 'm';
  const hasElevation =
    params.elevGainM !== null &&
    params.elevGainM !== undefined &&
    Number.isFinite(params.elevGainM) &&
    params.elevGainM >= 0;
  const elevValue = hasElevation
    ? Math.round(elevationFromMeters(params.elevGainM!, isImperial ? 'ft' : 'm'))
    : null;
  const elevationGain: ExplicitMetricValue<number> =
    hasElevation && elevValue !== null
      ? availableMetric(elevValue, elevUnit, `${elevValue} ${elevUnit}`, status)
      : unavailableMetric(elevUnit, params.elevationUnavailableReason ?? 'elevation_missing');

  const hasVerticalDrop =
    params.verticalDropM !== null &&
    params.verticalDropM !== undefined &&
    Number.isFinite(params.verticalDropM) &&
    params.verticalDropM >= 0;
  const dropValue = hasVerticalDrop
    ? Math.round(elevationFromMeters(params.verticalDropM!, isImperial ? 'ft' : 'm'))
    : null;
  const verticalDrop: ExplicitMetricValue<number> =
    hasVerticalDrop && dropValue !== null
      ? availableMetric(dropValue, elevUnit, `${dropValue} ${elevUnit}`, status)
      : unavailableMetric(elevUnit, params.elevationUnavailableReason ?? 'not_applicable_for_sport');

  const canComputeRhythm = hasDistance && params.distanceM! > 0 && params.movingS > 0;
  const speedUnit = isImperial ? 'mph' : 'km/h';
  const paceUnit = isImperial ? 'mi' : 'km';

  let speed: ExplicitMetricValue<number>;
  let pace: ExplicitMetricValue<number>;

  if (canComputeRhythm) {
    const kmh = (params.distanceM! / params.movingS) * 3.6;
    const speedVal = isImperial ? kmh / 1.609344 : kmh;
    speed = availableMetric(
      Number(speedVal.toFixed(1)),
      speedUnit,
      `${speedVal.toFixed(1)} ${speedUnit}`,
      status,
    );

    const paceSec = params.movingS / fromMeters(params.distanceM!, isImperial ? 'mi' : 'km');
    pace = availableMetric(
      Math.round(paceSec),
      `s/${paceUnit}`,
      formatPaceSeconds(paceSec, paceUnit),
      status,
    );
  } else {
    speed = unavailableMetric(speedUnit, 'insufficient_distance_or_time');
    pace = unavailableMetric(`s/${paceUnit}`, 'insufficient_distance_or_time');
  }

  const heartRate: ExplicitMetricValue<number> =
    typeof params.heartRateBpm === 'number' &&
    Number.isFinite(params.heartRateBpm) &&
    params.heartRateBpm > 0
      ? availableMetric(
          Math.round(params.heartRateBpm),
          'bpm',
          `${Math.round(params.heartRateBpm)} bpm`,
          status,
        )
      : unavailableMetric('bpm', 'no_sensor_connected');

  const power: ExplicitMetricValue<number> =
    typeof params.powerW === 'number' && Number.isFinite(params.powerW) && params.powerW >= 0
      ? availableMetric(Math.round(params.powerW), 'W', `${Math.round(params.powerW)} W`, status)
      : unavailableMetric('W', 'no_sensor_connected');

  const cadence: ExplicitMetricValue<number> =
    typeof params.cadenceRpm === 'number' &&
    Number.isFinite(params.cadenceRpm) &&
    params.cadenceRpm >= 0
      ? availableMetric(
          Math.round(params.cadenceRpm),
          'rpm',
          `${Math.round(params.cadenceRpm)} rpm`,
          status,
        )
      : unavailableMetric('rpm', 'no_sensor_connected');

  return {
    distance,
    duration,
    elevationGain,
    verticalDrop,
    speed,
    pace,
    heartRate,
    power,
    cadence,
  };
}
