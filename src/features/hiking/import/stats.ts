import type {
  NormalizedTraceLap,
  NormalizedTrackPoint,
  TraceBounds,
  TraceMetric,
  TraceSessionSummary,
} from './model';

export const METRIC_ORDER: readonly TraceMetric[] = [
  'time',
  'position',
  'altitude',
  'distance',
  'speed',
  'heartRate',
  'cadence',
  'power',
  'temperature',
];

export function computeBounds(points: NormalizedTrackPoint[]): TraceBounds | null {
  let minLatitudeDeg = Number.POSITIVE_INFINITY;
  let maxLatitudeDeg = Number.NEGATIVE_INFINITY;
  let minLongitudeDeg = Number.POSITIVE_INFINITY;
  let maxLongitudeDeg = Number.NEGATIVE_INFINITY;
  let minAltitudeM = Number.POSITIVE_INFINITY;
  let maxAltitudeM = Number.NEGATIVE_INFINITY;
  let hasPosition = false;
  let hasAltitude = false;

  for (const point of points) {
    if (point.latitudeDeg != null && point.longitudeDeg != null) {
      hasPosition = true;
      minLatitudeDeg = Math.min(minLatitudeDeg, point.latitudeDeg);
      maxLatitudeDeg = Math.max(maxLatitudeDeg, point.latitudeDeg);
      minLongitudeDeg = Math.min(minLongitudeDeg, point.longitudeDeg);
      maxLongitudeDeg = Math.max(maxLongitudeDeg, point.longitudeDeg);
    }
    if (point.altitudeM != null) {
      hasAltitude = true;
      minAltitudeM = Math.min(minAltitudeM, point.altitudeM);
      maxAltitudeM = Math.max(maxAltitudeM, point.altitudeM);
    }
  }

  if (!hasPosition && !hasAltitude) return null;

  return {
    minLatitudeDeg: hasPosition ? minLatitudeDeg : null,
    maxLatitudeDeg: hasPosition ? maxLatitudeDeg : null,
    minLongitudeDeg: hasPosition ? minLongitudeDeg : null,
    maxLongitudeDeg: hasPosition ? maxLongitudeDeg : null,
    minAltitudeM: hasAltitude ? minAltitudeM : null,
    maxAltitudeM: hasAltitude ? maxAltitudeM : null,
  };
}

export function computeAvailableMetrics(
  points: NormalizedTrackPoint[],
  laps: NormalizedTraceLap[],
  hasTime: boolean,
  summary: TraceSessionSummary | null = null,
): TraceMetric[] {
  const available = new Set<TraceMetric>();

  if (hasTime) available.add('time');
  if (points.some((point) => point.latitudeDeg != null && point.longitudeDeg != null)) {
    available.add('position');
  }
  if (points.some((point) => point.altitudeM != null)) available.add('altitude');
  if (
    points.some((point) => point.distanceM != null)
    || laps.some((lap) => lap.distanceM != null)
    || summary?.distanceM != null
  ) {
    available.add('distance');
  }
  if (
    points.some((point) => point.speedMps != null)
    || laps.some((lap) => lap.maxSpeedMps != null || lap.averageSpeedMps != null)
    || summary?.maxSpeedMps != null
    || summary?.averageSpeedMps != null
  ) {
    available.add('speed');
  }
  if (
    points.some((point) => point.heartRateBpm != null)
    || laps.some((lap) => lap.averageHeartRateBpm != null || lap.maxHeartRateBpm != null)
    || summary?.averageHeartRateBpm != null
    || summary?.maxHeartRateBpm != null
  ) {
    available.add('heartRate');
  }
  if (
    points.some((point) => point.cadenceRpm != null || point.runCadenceSpm != null)
    || laps.some((lap) => lap.averageCadenceRpm != null || lap.averageCadenceSpm != null)
    || summary?.averageCadenceRpm != null
    || summary?.averageCadenceSpm != null
  ) {
    available.add('cadence');
  }
  if (
    points.some((point) => point.powerW != null)
    || laps.some((lap) => lap.maxPowerW != null)
  ) {
    available.add('power');
  }
  if (points.some((point) => point.temperatureC != null)) available.add('temperature');

  return METRIC_ORDER.filter((metric) => available.has(metric));
}
