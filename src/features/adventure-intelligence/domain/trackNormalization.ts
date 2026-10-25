/**
 * Normalisation de trace GPS — tri, rejets motivés, pauses, métriques, qualité.
 *
 * Moteur pur (ADR-AI-005) : aucune I/O, aucun accès base ni réseau.
 * La qualité réutilise le type A1 `TrackQuality` (aucune duplication de contrat).
 */
import type { TrackQuality } from '../schemas/performance.schema';
import { clamp01 } from './confidence';
import { haversineM, smoothAltitude } from './geo';

export interface TrackPoint {
  lat: number;
  lng: number;
  ele?: number;
  timestamp: string;
  accuracyM?: number;
  speedMps?: number;
}

export const NORMALIZATION_DEFAULTS = {
  maxAccuracyM: 50,
  maxSpeedMps: 8.34,
  maxJumpM: 500,
  altitudeWindow: 5,
  stopSpeedMps: 0.3,
  minPauseS: 60,
  elevationHysteresisM: 3,
};

export type NormalizationOptions = typeof NORMALIZATION_DEFAULTS;

export interface TrackPause {
  startIndex: number;
  endIndex: number;
  startAt: string;
  endAt: string;
  durationS: number;
}

export interface RejectedPoint {
  index: number;
  reason: 'invalid' | 'accuracy' | 'duplicate' | 'teleport';
}

export interface TrackMetrics {
  distanceM: number;
  totalDurationS: number;
  movingDurationS: number;
  gainM: number;
  lossM: number;
  avgSpeedKmh: number;
  movingSpeedKmh: number;
}

export interface NormalizedTrack {
  points: TrackPoint[];
  rejected: RejectedPoint[];
  pauses: TrackPause[];
  metrics: TrackMetrics;
  quality: TrackQuality;
}

interface WorkingPoint {
  rawIndex: number;
  point: TrackPoint;
  timeMs: number;
}

/** Une précision absente est traitée comme la pire possible (départage les doublons). */
function accuracyRank(point: TrackPoint): number {
  return typeof point.accuracyM === 'number' && Number.isFinite(point.accuracyM)
    ? point.accuracyM
    : Number.POSITIVE_INFINITY;
}

function parseTimeMs(timestamp: string): number | null {
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : null;
}

/** D+/D- avec hystérésis : un franchissement de seuil déplace la référence. */
export function elevationGainLoss(
  values: (number | undefined)[],
  hysteresisM: number
): { gainM: number; lossM: number } {
  let gainM = 0;
  let lossM = 0;
  let reference: number | undefined;
  for (const value of values) {
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    if (reference === undefined) {
      reference = value;
      continue;
    }
    if (value > reference + hysteresisM) {
      gainM += value - reference;
      reference = value;
    } else if (value < reference - hysteresisM) {
      lossM += reference - value;
      reference = value;
    }
  }
  return { gainM, lossM };
}

function detectPauses(points: TrackPoint[], options: NormalizationOptions): TrackPause[] {
  const pauses: TrackPause[] = [];
  let runStart = -1;

  const closeRun = (endIndex: number): void => {
    if (runStart === -1) return;
    const startMs = parseTimeMs(points[runStart].timestamp);
    const endMs = parseTimeMs(points[endIndex].timestamp);
    const durationS = startMs !== null && endMs !== null ? (endMs - startMs) / 1000 : 0;
    if (durationS >= options.minPauseS) {
      pauses.push({
        startIndex: runStart,
        endIndex,
        startAt: points[runStart].timestamp,
        endAt: points[endIndex].timestamp,
        durationS,
      });
    }
    runStart = -1;
  };

  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const current = points[i];
    const previousMs = parseTimeMs(previous.timestamp) ?? 0;
    const currentMs = parseTimeMs(current.timestamp) ?? 0;
    const deltaS = (currentMs - previousMs) / 1000;
    const distanceM = haversineM(previous, current);
    const speedMps = deltaS > 0 ? distanceM / deltaS : Number.POSITIVE_INFINITY;

    if (speedMps < options.stopSpeedMps) {
      if (runStart === -1) runStart = i - 1;
    } else {
      closeRun(i - 1);
    }
  }
  closeRun(points.length - 1);

  return pauses;
}

function computeQuality(
  rawCount: number,
  points: TrackPoint[],
  rejected: RejectedPoint[],
  options: NormalizationOptions
): TrackQuality {
  const retained = points.length;
  const accuracyValues = points.map((point) =>
    typeof point.accuracyM === 'number' && Number.isFinite(point.accuracyM)
      ? point.accuracyM
      : options.maxAccuracyM / 2
  );
  const meanAccuracyM =
    accuracyValues.length > 0
      ? accuracyValues.reduce((sum, value) => sum + value, 0) / accuracyValues.length
      : options.maxAccuracyM;

  const gpsAccuracy = clamp01(1 - meanAccuracyM / options.maxAccuracyM);
  const temporalContinuity = rawCount > 0 ? clamp01(retained / rawCount) : 0;
  const altitudePresent = points.filter(
    (point) => typeof point.ele === 'number' && Number.isFinite(point.ele)
  ).length;
  const altitudeReliability = retained > 0 ? clamp01(altitudePresent / retained) : 0;

  const teleportCount = rejected.filter((item) => item.reason === 'teleport').length;
  const invalidCount = rejected.filter((item) => item.reason === 'invalid').length;
  const validCount = Math.max(1, rawCount - invalidCount);
  const plausibleMovement = clamp01(1 - teleportCount / validCount);

  const overall = clamp01(
    0.35 * gpsAccuracy +
      0.25 * temporalContinuity +
      0.2 * altitudeReliability +
      0.2 * plausibleMovement
  );

  const reasons: string[] = [];
  if (rawCount === 0) {
    reasons.push('Trace vide — aucun point exploitable');
  } else {
    if (gpsAccuracy < 0.5) {
      reasons.push('Précision GPS dégradée — moyenne proche du seuil de rejet');
    }
    if (temporalContinuity < 0.5) {
      reasons.push('Continuité temporelle dégradée — nombreux points rejetés');
    }
    if (altitudeReliability < 0.5) {
      reasons.push('Altitude peu fiable — moins de la moitié des points ont une altitude');
    }
    if (plausibleMovement < 0.5) {
      reasons.push('Mouvements implausibles — téléportations fréquentes');
    }
  }
  if (overall < 0.5 && reasons.length === 0) {
    reasons.push('Qualité globale insuffisante pour l’analyse collective');
  }

  return {
    overall,
    gpsAccuracy,
    temporalContinuity,
    altitudeReliability,
    plausibleMovement,
    reasons,
  };
}

/**
 * Transforme une trace brute en trace normalisée :
 * tri temporel → rejets (invalid/accuracy/doublon/téléportation) → lissage
 * altitude → pauses → métriques → qualité.
 */
export function normalizeTrack(
  raw: TrackPoint[],
  options?: Partial<NormalizationOptions>
): NormalizedTrack {
  const config: NormalizationOptions = { ...NORMALIZATION_DEFAULTS, ...options };
  const rejected: RejectedPoint[] = [];
  const candidates: WorkingPoint[] = [];

  raw.forEach((point, index) => {
    const timeMs = parseTimeMs(point.timestamp);
    const validCoordinates =
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lng) &&
      point.lat >= -90 &&
      point.lat <= 90 &&
      point.lng >= -180 &&
      point.lng <= 180;

    if (!validCoordinates || timeMs === null) {
      rejected.push({ index, reason: 'invalid' });
      return;
    }
    if (typeof point.accuracyM === 'number' && point.accuracyM > config.maxAccuracyM) {
      rejected.push({ index, reason: 'accuracy' });
      return;
    }
    candidates.push({ rawIndex: index, point, timeMs });
  });

  candidates.sort(
    (a, b) => a.timeMs - b.timeMs || accuracyRank(a.point) - accuracyRank(b.point) || a.rawIndex - b.rawIndex
  );

  const seenTimestamps = new Set<number>();
  const deduped: WorkingPoint[] = [];
  for (const candidate of candidates) {
    if (seenTimestamps.has(candidate.timeMs)) {
      rejected.push({ index: candidate.rawIndex, reason: 'duplicate' });
      continue;
    }
    seenTimestamps.add(candidate.timeMs);
    deduped.push(candidate);
  }

  const kept: WorkingPoint[] = [];
  for (const candidate of deduped) {
    const previous = kept[kept.length - 1];
    if (previous) {
      const deltaS = (candidate.timeMs - previous.timeMs) / 1000;
      const distanceM = haversineM(previous.point, candidate.point);
      const speedMps = deltaS > 0 ? distanceM / deltaS : Number.POSITIVE_INFINITY;
      if (distanceM > config.maxJumpM || speedMps > config.maxSpeedMps) {
        rejected.push({ index: candidate.rawIndex, reason: 'teleport' });
        continue;
      }
    }
    kept.push(candidate);
  }

  const basePoints: TrackPoint[] = kept.map(({ point }) => {
    const copy: TrackPoint = { ...point };
    if (copy.ele !== undefined && !Number.isFinite(copy.ele)) {
      delete copy.ele;
    }
    return copy;
  });

  const smoothedAltitudes = smoothAltitude(
    basePoints.map((point) => point.ele),
    config.altitudeWindow
  );
  const points: TrackPoint[] = basePoints.map((point, index) => {
    const smoothed = smoothedAltitudes[index];
    return smoothed === undefined ? point : { ...point, ele: smoothed };
  });

  const pauses = detectPauses(points, config);
  const stoppedDurationS = pauses.reduce((sum, pause) => sum + pause.durationS, 0);

  const totalDurationS =
    points.length >= 2
      ? ((parseTimeMs(points[points.length - 1].timestamp) ?? 0) -
          (parseTimeMs(points[0].timestamp) ?? 0)) /
        1000
      : 0;
  const movingDurationS = Math.max(0, totalDurationS - stoppedDurationS);

  let distanceM = 0;
  for (let i = 1; i < points.length; i += 1) {
    distanceM += haversineM(points[i - 1], points[i]);
  }

  const { gainM, lossM } = elevationGainLoss(
    points.map((point) => point.ele),
    config.elevationHysteresisM
  );

  const metrics: TrackMetrics = {
    distanceM,
    totalDurationS,
    movingDurationS,
    gainM,
    lossM,
    avgSpeedKmh: totalDurationS > 0 ? (distanceM / totalDurationS) * 3.6 : 0,
    movingSpeedKmh: movingDurationS > 0 ? (distanceM / movingDurationS) * 3.6 : 0,
  };

  return {
    points,
    rejected,
    pauses,
    metrics,
    quality: computeQuality(raw.length, points, rejected, config),
  };
}
