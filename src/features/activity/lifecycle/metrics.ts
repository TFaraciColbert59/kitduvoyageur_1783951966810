/**
 * Lot A02 — Calculs déterministes des métriques dérivées et lissage des pics GPS
 * (K5.10, S1.17, S1.23, S2.01).
 *
 * Invariants (recherche 06 & brief A02) :
 * - Aucune donnée capteur n'est inventée : un canal absent renvoie `status: 'unavailable'` et `null`.
 * - Distinction stricte entre `0` et valeur manquante (`null`) :
 *   - altitude `0` = niveau de la mer (valide), altitude `null` = absente (ignorée sans interpoler 0) ;
 *   - cardio `0` ou `< 30` bpm = lacune capteur (comptée dans `gapCount`, jamais moyennée à 0) ;
 *   - cadence/puissance `0` = roue libre / arrêt de pédalage mesuré, `null` = capteur absent.
 * - Le lissage des pics GPS (K5.10) écarte les sauts de perte de fix et les vitesses
 *   dépassant le plafond du sport sans jamais modifier `originalPoints`.
 */

import {
  addSplitInterval,
  createSplitsState,
} from '@/features/explorer-v2/activity/splits';
import {
  AUTO_PAUSE_BY_SPORT,
  DEFAULT_MAX_PLAUSIBLE_SPEED_MS,
  MAX_ACCURACY_M,
  MAX_JUMP_M,
  MAX_JUMP_WINDOW_S,
  MIN_MOVING_SPEED_MS,
} from '@/features/explorer-v2/activity/tracker';
import type { Sport } from '@/features/explorer-v2/state/types';
import {
  LIFECYCLE_ALGORITHM_VERSION,
  type ActivityDerivedStats,
  type GpsSpikeDetection,
  type GpsSpikeSmoothingResult,
  type LifecyclePoint,
  type SensorChannelSummary,
} from './types';

const EARTH_RADIUS_M = 6_371_000;
const CARDIO_GAP_THRESHOLD_S = 120;
const MIN_VALID_HEART_RATE_BPM = 30;
const MAX_VALID_HEART_RATE_BPM = 250;

export function clonePoint(point: LifecyclePoint): LifecyclePoint {
  return { ...point };
}

export function clonePoints(points: readonly LifecyclePoint[]): LifecyclePoint[] {
  return points.map(clonePoint);
}

export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function pointDistanceM(
  a: Pick<LifecyclePoint, 'lat' | 'lng'>,
  b: Pick<LifecyclePoint, 'lat' | 'lng'>,
): number {
  if (!isValidCoordinate(a.lat, a.lng) || !isValidCoordinate(b.lat, b.lng)) {
    return 0;
  }
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(Math.min(1, h))));
}

export function parseTimestampMs(iso: string | null | undefined): number | null {
  if (!iso || typeof iso !== 'string') return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/** Plafond de vitesse plausible par sport (m/s) (K5.10). */
export function sportMaxPlausibleSpeedMs(sport: Sport | null | undefined): number {
  if (!sport) return DEFAULT_MAX_PLAUSIBLE_SPEED_MS;
  const profile = AUTO_PAUSE_BY_SPORT[sport];
  return profile?.maxPlausibleSpeedMs ?? DEFAULT_MAX_PLAUSIBLE_SPEED_MS;
}

/** Seuil de vitesse de mouvement par sport (m/s) (S2.01). */
export function sportMovingSpeedThresholdMs(sport: Sport | null | undefined): number {
  if (!sport) return MIN_MOVING_SPEED_MS;
  const profile = AUTO_PAUSE_BY_SPORT[sport];
  if (!profile) return MIN_MOVING_SPEED_MS;
  return Math.min(MIN_MOVING_SPEED_MS, profile.resumeSpeedThresholdMs);
}

/** Trou GPS maximal avant rupture de continuité (s) (S2.01). */
export function sportMaxFixGapS(sport: Sport | null | undefined): number {
  if (!sport) return 120;
  const profile = AUTO_PAUSE_BY_SPORT[sport];
  return profile?.maxFixGapS ?? 120;
}

export interface SmoothGpsOptions {
  /** Surcharge optionnelle du plafond de vitesse (m/s). */
  maxPlausibleSpeedMs?: number;
  /** Précision horizontale maximale acceptée (m). Défaut : 30 m. */
  maxAccuracyM?: number;
}

/**
 * Lisse les pics GPS de vitesse sur une trace sans jamais écraser `originalPoints` (K5.10).
 *
 * Détecte :
 * 1. Coordonnées invalides ou hors bornes ;
 * 2. Précision horizontale supérieure à `maxAccuracyM` (30 m) ;
 * 3. Horodatages non monotones (retour en arrière / doublon temporel) ;
 * 4. Sauts de perte de fix (> 100 m en <= 2 s) ;
 * 5. Vitesses implicites supérieures au maximum plausible du sport ;
 * 6. Aller-retour aberrant sur un point isolé (téléportation d'un seul échantillon).
 */
export function smoothGpsSpeedSpikes(
  points: readonly LifecyclePoint[],
  sport: Sport,
  options: SmoothGpsOptions = {},
): GpsSpikeSmoothingResult {
  const originalPoints = clonePoints(points);
  const maxSpeedMs =
    typeof options.maxPlausibleSpeedMs === 'number' && options.maxPlausibleSpeedMs > 0
      ? options.maxPlausibleSpeedMs
      : sportMaxPlausibleSpeedMs(sport);
  const maxAccuracyM =
    typeof options.maxAccuracyM === 'number' && options.maxAccuracyM > 0
      ? options.maxAccuracyM
      : MAX_ACCURACY_M;
  const maxGapS = sportMaxFixGapS(sport);

  const spikes: GpsSpikeDetection[] = [];
  const cleanedPoints: LifecyclePoint[] = [];

  let rawMaxSpeedMs = 0;
  let correctedMaxSpeedMs = 0;
  let lastAccepted: LifecyclePoint | null = null;
  let lastAcceptedTMs: number | null = null;
  let rejectedSinceLastAccepted = false;

  for (let i = 0; i < originalPoints.length; i += 1) {
    const candidate = originalPoints[i];

    // Calcul de la vitesse brute max pour diagnostic avant/après
    if (typeof candidate.speedMs === 'number' && Number.isFinite(candidate.speedMs)) {
      if (candidate.speedMs > rawMaxSpeedMs) rawMaxSpeedMs = candidate.speedMs;
    }
    if (i > 0) {
      const prevRaw = originalPoints[i - 1];
      const t0 = parseTimestampMs(prevRaw.timestamp);
      const t1 = parseTimestampMs(candidate.timestamp);
      if (t0 !== null && t1 !== null && t1 > t0) {
        const dtRaw = (t1 - t0) / 1000;
        const distRaw = pointDistanceM(prevRaw, candidate);
        const speedRaw = distRaw / dtRaw;
        if (Number.isFinite(speedRaw) && speedRaw > rawMaxSpeedMs) {
          rawMaxSpeedMs = speedRaw;
        }
      }
    }

    if (!isValidCoordinate(candidate.lat, candidate.lng)) {
      spikes.push({
        pointIndex: i,
        timestamp: candidate.timestamp ?? null,
        impliedSpeedMs: 0,
        maxAllowedSpeedMs: maxSpeedMs,
        distanceDeltaM: 0,
        timeDeltaS: 0,
        reason: 'invalid_coordinates',
      });
      rejectedSinceLastAccepted = true;
      continue;
    }

    if (
      candidate.accuracyM !== undefined &&
      candidate.accuracyM !== null &&
      (!Number.isFinite(candidate.accuracyM) ||
        candidate.accuracyM < 0 ||
        candidate.accuracyM > maxAccuracyM)
    ) {
      spikes.push({
        pointIndex: i,
        timestamp: candidate.timestamp ?? null,
        impliedSpeedMs: 0,
        maxAllowedSpeedMs: maxSpeedMs,
        distanceDeltaM: 0,
        timeDeltaS: 0,
        reason: 'accuracy_exceeded',
      });
      rejectedSinceLastAccepted = true;
      continue;
    }

    const currentTMs = parseTimestampMs(candidate.timestamp);

    if (!lastAccepted) {
      const sanitizedFirst = sanitizeReportedSpeed(candidate, maxSpeedMs);
      if (
        typeof sanitizedFirst.speedMs === 'number' &&
        sanitizedFirst.speedMs > correctedMaxSpeedMs
      ) {
        correctedMaxSpeedMs = sanitizedFirst.speedMs;
      }
      cleanedPoints.push(sanitizedFirst);
      lastAccepted = sanitizedFirst;
      lastAcceptedTMs = currentTMs;
      rejectedSinceLastAccepted = false;
      continue;
    }

    if (currentTMs !== null && lastAcceptedTMs !== null && currentTMs <= lastAcceptedTMs) {
      spikes.push({
        pointIndex: i,
        timestamp: candidate.timestamp ?? null,
        impliedSpeedMs: 0,
        maxAllowedSpeedMs: maxSpeedMs,
        distanceDeltaM: pointDistanceM(lastAccepted, candidate),
        timeDeltaS: (currentTMs - lastAcceptedTMs) / 1000,
        reason: 'non_monotonic_timestamp',
      });
      continue;
    }

    const distM = pointDistanceM(lastAccepted, candidate);
    const dtS =
      currentTMs !== null && lastAcceptedTMs !== null
        ? Math.max(0, (currentTMs - lastAcceptedTMs) / 1000)
        : null;

    if (dtS !== null && dtS > 0 && !candidate.discontinuity) {
      const impliedSpeedMs = distM / dtS;

      if (dtS <= MAX_JUMP_WINDOW_S && distM > MAX_JUMP_M) {
        spikes.push({
          pointIndex: i,
          timestamp: candidate.timestamp ?? null,
          impliedSpeedMs,
          maxAllowedSpeedMs: maxSpeedMs,
          distanceDeltaM: distM,
          timeDeltaS: dtS,
          reason: 'short_window_jump',
        });
        rejectedSinceLastAccepted = true;
        continue;
      }

      if (dtS <= maxGapS && impliedSpeedMs > maxSpeedMs) {
        spikes.push({
          pointIndex: i,
          timestamp: candidate.timestamp ?? null,
          impliedSpeedMs,
          maxAllowedSpeedMs: maxSpeedMs,
          distanceDeltaM: distM,
          timeDeltaS: dtS,
          reason: 'exceeds_sport_max_speed',
        });
        rejectedSinceLastAccepted = true;
        continue;
      }

      // Détection d'une excursion aller-retour sur un seul point (ex: rebond paroi/forêt)
      const nextRaw = i + 1 < originalPoints.length ? originalPoints[i + 1] : null;
      if (nextRaw && isValidCoordinate(nextRaw.lat, nextRaw.lng)) {
        const nextTMs = parseTimestampMs(nextRaw.timestamp);
        const dtNextS =
          nextTMs !== null && currentTMs !== null && nextTMs > currentTMs
            ? (nextTMs - currentTMs) / 1000
            : null;
        if (dtNextS !== null && dtNextS > 0 && dtS + dtNextS <= maxGapS) {
          const distBackM = pointDistanceM(candidate, nextRaw);
          const directDistM = pointDistanceM(lastAccepted, nextRaw);
          const directSpeedMs = directDistM / (dtS + dtNextS);
          const returnSpeedMs = distBackM / dtNextS;
          // Si l'aller et le retour sont tous deux > 65 % du max du sport alors que la corde directe est < 25 %
          if (
            impliedSpeedMs > maxSpeedMs * 0.65 &&
            returnSpeedMs > maxSpeedMs * 0.65 &&
            directSpeedMs < maxSpeedMs * 0.25 &&
            distM + distBackM > directDistM * 3
          ) {
            spikes.push({
              pointIndex: i,
              timestamp: candidate.timestamp ?? null,
              impliedSpeedMs,
              maxAllowedSpeedMs: maxSpeedMs,
              distanceDeltaM: distM,
              timeDeltaS: dtS,
              reason: 'isolated_acceleration_spike',
            });
            rejectedSinceLastAccepted = true;
            continue;
          }
        }
      }

      // Si ce point est accepté et continu, on met à jour la vitesse maximale corrigée
      if (!rejectedSinceLastAccepted && dtS <= maxGapS) {
        const effectivePointSpeed = resolveSegmentSpeedMs(candidate, impliedSpeedMs, maxSpeedMs);
        if (effectivePointSpeed > correctedMaxSpeedMs) {
          correctedMaxSpeedMs = effectivePointSpeed;
        }
      }
    }

    const sanitized = sanitizeReportedSpeed(candidate, maxSpeedMs);
    cleanedPoints.push(sanitized);
    lastAccepted = sanitized;
    if (currentTMs !== null) lastAcceptedTMs = currentTMs;
    rejectedSinceLastAccepted = false;
  }

  return {
    cleanedPoints,
    originalPoints,
    spikes,
    rawMaxSpeedKmh: rawMaxSpeedMs > 0 ? roundTo(rawMaxSpeedMs * 3.6, 2) : null,
    correctedMaxSpeedKmh:
      correctedMaxSpeedMs > 0 ? roundTo(correctedMaxSpeedMs * 3.6, 2) : null,
    sport,
  };
}

function sanitizeReportedSpeed(
  point: LifecyclePoint,
  maxAllowedSpeedMs: number,
): LifecyclePoint {
  if (typeof point.speedMs !== 'number' || !Number.isFinite(point.speedMs)) {
    return { ...point };
  }
  if (point.speedMs < 0 || point.speedMs > maxAllowedSpeedMs) {
    return { ...point, speedMs: null };
  }
  return { ...point };
}

function resolveSegmentSpeedMs(
  point: LifecyclePoint,
  impliedSpeedMs: number,
  maxAllowedSpeedMs: number,
): number {
  if (
    typeof point.speedMs === 'number' &&
    Number.isFinite(point.speedMs) &&
    point.speedMs >= 0 &&
    point.speedMs <= maxAllowedSpeedMs
  ) {
    // Si la vitesse GPS rapportée dépasse le plafond ou diverge fortement, on borne par la vitesse géométrique
    return Math.min(maxAllowedSpeedMs, Math.max(point.speedMs, impliedSpeedMs));
  }
  return Math.min(maxAllowedSpeedMs, impliedSpeedMs);
}

/**
 * Synthétise un canal capteur sans jamais inventer de valeur (recherche 06).
 */
export function summarizeSensorChannel(
  points: readonly LifecyclePoint[],
  channel: 'heartRateBpm' | 'cadenceRpm' | 'powerWatts',
): SensorChannelSummary {
  let sum = 0;
  let sampleCount = 0;
  let min: number | null = null;
  let max: number | null = null;
  let gapCount = 0;
  let hadValidBefore = false;
  let inMissingRun = false;
  let lastValidTMs: number | null = null;

  for (const point of points) {
    const raw = point[channel];
    const tMs = parseTimestampMs(point.timestamp);

    if (raw === undefined || raw === null || !Number.isFinite(raw)) {
      if (hadValidBefore && !inMissingRun) {
        gapCount += 1;
        inMissingRun = true;
      }
      continue;
    }

    if (channel === 'heartRateBpm') {
      // Un 0 bpm ou une valeur hors plage physiologique est une lacune capteur, pas une mesure
      if (raw < MIN_VALID_HEART_RATE_BPM || raw > MAX_VALID_HEART_RATE_BPM) {
        gapCount += 1;
        inMissingRun = true;
        continue;
      }
      if (
        lastValidTMs !== null &&
        tMs !== null &&
        (tMs - lastValidTMs) / 1000 > CARDIO_GAP_THRESHOLD_S &&
        !inMissingRun
      ) {
        gapCount += 1;
      }
    } else {
      // Pour cadence et puissance, 0 est une mesure valide (roue libre), mais négatif est invalide
      if (raw < 0) {
        if (hadValidBefore && !inMissingRun) {
          gapCount += 1;
          inMissingRun = true;
        }
        continue;
      }
    }

    inMissingRun = false;
    hadValidBefore = true;
    if (tMs !== null) lastValidTMs = tMs;

    sum += raw;
    sampleCount += 1;
    if (min === null || raw < min) min = raw;
    if (max === null || raw > max) max = raw;
  }

  if (sampleCount === 0) {
    return {
      status: 'unavailable',
      avg: null,
      max: null,
      min: null,
      sampleCount: 0,
      gapCount,
    };
  }

  return {
    status: gapCount > 0 ? 'partial' : 'measured',
    avg: roundTo(sum / sampleCount, 1),
    max: roundTo(max!, 1),
    min: roundTo(min!, 1),
    sampleCount,
    gapCount,
  };
}

export interface ComputeStatsOptions {
  /** Horodatage ISO de début de séance (utile quand la trace n'a pas de timestamps par point). */
  startedAt?: string | null;
  /** Horodatage ISO de fin de séance. */
  endedAt?: string | null;
  /** Durée stockée en secondes (fallback pour anciennes randonnées sans timestamps par point). */
  fallbackDurationS?: number | null;
  /** Distance stockée en mètres (fallback pour anciennes randonnées sans trace ou override manuel). */
  overrideDistanceM?: number | null;
  /** D+ stocké en mètres (fallback ou override manuel S1.23). */
  overrideElevationGainM?: number | null;
  /** D- stocké en mètres (override manuel S1.23). */
  overrideElevationLossM?: number | null;
  /** Altitude max stockée (fallback pour anciennes randonnées). */
  fallbackMaxAltitudeM?: number | null;
}

/**
 * Calcule de façon déterministe toutes les métriques dérivées d'une activité
 * (S2.01, K5.10, S1.17, S1.23) :
 * - `elapsedTimeS`, `movingTimeS`, `pauseTimeS`
 * - `distanceM`, `distanceKm`
 * - `elevationGainM`, `elevationLossM`, `minAltitudeM`, `maxAltitudeM`
 * - `avgSpeedKmh`, `elapsedSpeedKmh`, `maxSpeedKmh`, `avgPaceSecondsPerKm`
 * - `splitsKm`, `splitsMi`
 * - `heartRate`, `cadence`, `power`
 */
export function computeActivityStats(
  points: readonly LifecyclePoint[],
  sport: Sport,
  options: ComputeStatsOptions = {},
): ActivityDerivedStats {
  const smoothing = smoothGpsSpeedSpikes(points, sport);
  const cleaned = smoothing.cleanedPoints;

  const movingSpeedThresholdMs = sportMovingSpeedThresholdMs(sport);
  const maxGapS = sportMaxFixGapS(sport);

  let cumulativeDistanceM = 0;
  let movingTimeS = 0;
  let pauseCount = 0;
  let elevationGainM = 0;
  let elevationLossM = 0;
  let minAltitudeM: number | null = null;
  let maxAltitudeM: number | null = null;

  let splitsState = createSplitsState();

  let firstTimestampMs: number | null = null;
  let lastTimestampMs: number | null = null;
  let lastValidElevationM: number | null = null;
  let pausedRunActive = false;

  for (let i = 0; i < cleaned.length; i += 1) {
    const pt = cleaned[i];
    const tMs = parseTimestampMs(pt.timestamp);
    if (tMs !== null) {
      if (firstTimestampMs === null || tMs < firstTimestampMs) firstTimestampMs = tMs;
      if (lastTimestampMs === null || tMs > lastTimestampMs) lastTimestampMs = tMs;
    }

    // Altitude : 0 est valide (niveau de la mer), null est ignoré sans inventer 0
    if (typeof pt.elevationM === 'number' && Number.isFinite(pt.elevationM)) {
      if (minAltitudeM === null || pt.elevationM < minAltitudeM) {
        minAltitudeM = pt.elevationM;
      }
      if (maxAltitudeM === null || pt.elevationM > maxAltitudeM) {
        maxAltitudeM = pt.elevationM;
      }
      if (lastValidElevationM !== null && !pt.discontinuity) {
        const deltaEle = pt.elevationM - lastValidElevationM;
        if (deltaEle > 0) elevationGainM += deltaEle;
        else if (deltaEle < 0) elevationLossM += Math.abs(deltaEle);
      }
      lastValidElevationM = pt.elevationM;
    } else if (pt.discontinuity) {
      lastValidElevationM = null;
    }

    if (i === 0) continue;

    const prev = cleaned[i - 1];
    if (pt.discontinuity) {
      pauseCount += 1;
      pausedRunActive = false;
      continue;
    }

    const segDistM = pointDistanceM(prev, pt);
    const prevTMs = parseTimestampMs(prev.timestamp);
    const dtS =
      tMs !== null && prevTMs !== null && tMs > prevTMs ? (tMs - prevTMs) / 1000 : null;

    if (dtS !== null) {
      // Au-delà de maxFixGapS, il s'agit d'une coupure/pause longue : ni distance ni temps en mouvement
      if (dtS > maxGapS) {
        pauseCount += 1;
        pausedRunActive = false;
        lastValidElevationM =
          typeof pt.elevationM === 'number' && Number.isFinite(pt.elevationM)
            ? pt.elevationM
            : null;
        continue;
      }

      const impliedSpeedMs = dtS > 0 ? segDistM / dtS : 0;
      const reportedSpeedMs =
        typeof pt.speedMs === 'number' && Number.isFinite(pt.speedMs) && pt.speedMs >= 0
          ? pt.speedMs
          : null;
      // Si speedMs est explicitement 0 mais que le point n'a presque pas bougé, c'est un arrêt
      const effectiveSpeedMs =
        reportedSpeedMs === 0 && segDistM < 3 ? 0 : Math.max(impliedSpeedMs, reportedSpeedMs ?? 0);

      const isMoving = effectiveSpeedMs + 1e-9 >= movingSpeedThresholdMs;
      cumulativeDistanceM += segDistM;

      if (isMoving) {
        movingTimeS += dtS;
        pausedRunActive = false;
        if (segDistM > 0) {
          splitsState = addSplitInterval(splitsState, segDistM, dtS);
        }
      } else {
        if (!pausedRunActive) {
          pauseCount += 1;
          pausedRunActive = true;
        }
        if (segDistM > 0) {
          splitsState = addSplitInterval(splitsState, segDistM, 0);
        }
      }
    } else {
      // Trace géométrique sans horodatages par point (ex: LineString GeoJSON historique)
      cumulativeDistanceM += segDistM;
      if (segDistM > 0) {
        splitsState = addSplitInterval(splitsState, segDistM, 0);
      }
    }
  }

  // Calcul du temps écoulé total (elapsedTimeS)
  let elapsedTimeS = 0;
  if (
    firstTimestampMs !== null &&
    lastTimestampMs !== null &&
    lastTimestampMs >= firstTimestampMs
  ) {
    elapsedTimeS = Math.round((lastTimestampMs - firstTimestampMs) / 1000);
  } else {
    const startMs = parseTimestampMs(options.startedAt);
    const endMs = parseTimestampMs(options.endedAt);
    if (startMs !== null && endMs !== null && endMs >= startMs) {
      elapsedTimeS = Math.round((endMs - startMs) / 1000);
    } else if (
      typeof options.fallbackDurationS === 'number' &&
      Number.isFinite(options.fallbackDurationS) &&
      options.fallbackDurationS > 0
    ) {
      elapsedTimeS = Math.round(options.fallbackDurationS);
    }
  }

  // Si les points n'avaient aucun horodatage mais que la séance a une durée connue,
  // le temps en mouvement retombe sur la durée connue.
  if (
    movingTimeS === 0 &&
    firstTimestampMs === null &&
    elapsedTimeS > 0 &&
    (cumulativeDistanceM > 0 || (options.overrideDistanceM ?? 0) > 0)
  ) {
    movingTimeS = elapsedTimeS;
  }

  movingTimeS = Math.min(elapsedTimeS > 0 ? elapsedTimeS : movingTimeS, Math.round(movingTimeS));
  elapsedTimeS = Math.max(elapsedTimeS, movingTimeS);
  const pauseTimeS = Math.max(0, elapsedTimeS - movingTimeS);

  const finalDistanceM =
    typeof options.overrideDistanceM === 'number' &&
    Number.isFinite(options.overrideDistanceM) &&
    options.overrideDistanceM >= 0
      ? roundTo(options.overrideDistanceM, 1)
      : roundTo(cumulativeDistanceM, 1);

  const finalDistanceKm = roundTo(finalDistanceM / 1000, 3);

  const finalElevationGainM =
    typeof options.overrideElevationGainM === 'number' &&
    Number.isFinite(options.overrideElevationGainM) &&
    options.overrideElevationGainM >= 0
      ? Math.round(options.overrideElevationGainM)
      : Math.round(elevationGainM);

  const finalElevationLossM =
    typeof options.overrideElevationLossM === 'number' &&
    Number.isFinite(options.overrideElevationLossM) &&
    options.overrideElevationLossM >= 0
      ? Math.round(options.overrideElevationLossM)
      : Math.round(elevationLossM);

  const finalMaxAltitudeM =
    maxAltitudeM !== null
      ? Math.round(maxAltitudeM)
      : typeof options.fallbackMaxAltitudeM === 'number' &&
          Number.isFinite(options.fallbackMaxAltitudeM)
        ? Math.round(options.fallbackMaxAltitudeM)
        : null;

  const finalMinAltitudeM = minAltitudeM !== null ? Math.round(minAltitudeM) : null;

  const avgSpeedKmh =
    finalDistanceM > 0 && movingTimeS > 0
      ? roundTo((finalDistanceM / movingTimeS) * 3.6, 2)
      : null;

  const elapsedSpeedKmh =
    finalDistanceM > 0 && elapsedTimeS > 0
      ? roundTo((finalDistanceM / elapsedTimeS) * 3.6, 2)
      : null;

  const maxSpeedKmh =
    smoothing.correctedMaxSpeedKmh !== null && avgSpeedKmh !== null
      ? Math.max(smoothing.correctedMaxSpeedKmh, avgSpeedKmh)
      : smoothing.correctedMaxSpeedKmh ?? avgSpeedKmh;

  const avgPaceSecondsPerKm =
    finalDistanceM > 0 && movingTimeS > 0
      ? roundTo(movingTimeS / (finalDistanceM / 1000), 1)
      : null;

  return {
    elapsedTimeS,
    movingTimeS,
    pauseTimeS,
    distanceM: finalDistanceM,
    distanceKm: finalDistanceKm,
    elevationGainM: finalElevationGainM,
    elevationLossM: finalElevationLossM,
    minAltitudeM: finalMinAltitudeM,
    maxAltitudeM: finalMaxAltitudeM,
    avgSpeedKmh,
    elapsedSpeedKmh,
    maxSpeedKmh,
    avgPaceSecondsPerKm,
    splitsKm: splitsState.km,
    splitsMi: splitsState.mi,
    heartRate: summarizeSensorChannel(cleaned, 'heartRateBpm'),
    cadence: summarizeSensorChannel(cleaned, 'cadenceRpm'),
    power: summarizeSensorChannel(cleaned, 'powerWatts'),
    spikeCount: smoothing.spikes.length,
    pauseCount,
    algorithmVersion: LIFECYCLE_ALGORITHM_VERSION,
  };
}

/**
 * Lissage altimétrique par seuil d'hystérésis (S1.23 `threshold_smoothing`).
 * Filtre les oscillations GPS/barométriques inférieures à `thresholdM` sans
 * inventer d'altitude sur les points où `elevationM` vaut `null`.
 */
export function applyElevationThresholdSmoothing(
  points: readonly LifecyclePoint[],
  thresholdM = 2,
): LifecyclePoint[] {
  const effectiveThreshold =
    typeof thresholdM === 'number' && Number.isFinite(thresholdM) && thresholdM > 0
      ? thresholdM
      : 2;
  let anchorEle: number | null = null;

  return points.map((pt) => {
    if (pt.elevationM === null || !Number.isFinite(pt.elevationM)) {
      return { ...pt, elevationM: null };
    }
    if (anchorEle === null) {
      anchorEle = pt.elevationM;
      return { ...pt };
    }
    if (Math.abs(pt.elevationM - anchorEle) >= effectiveThreshold) {
      anchorEle = pt.elevationM;
    }
    return {
      ...pt,
      elevationM: roundTo(anchorEle, 1),
    };
  });
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
