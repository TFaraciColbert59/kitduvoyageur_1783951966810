/**
 * Analyse télémétrique unifiée d'une sortie (A04 · K5.08, K5.09, S2.04–S2.12).
 *
 * Consolide les points GPS, les séries d'import FIT/TCX ou capteur, et les
 * configurations de zones pour produire :
 *   - profils synchronisés (distance, altitude, vitesse/allure, GAP, FC,
 *     puissance mesurée/estimée, cadence, température) + curseur commun carte ;
 *   - splits par km ou mile avec mise en évidence du plus rapide + intervalles ;
 *   - synthèse qualité/lacunes des capteurs (FC, cadence, température, énergie, pas) ;
 *   - estimation explicite de puissance vélo (si capteur absent et trace valide) ;
 *   - distribution dans les zones cardio, allure et puissance (`activityMetrics.ts`) ;
 *   - effort perçu (RPE 1–10) et effort relatif cardio / sRPE.
 */

import type {
  OutingImportSample,
  OutingImportSummary,
  OutingPoint,
} from '@/features/compte/server/sorties';
import {
  computeSlopeAdjustedPace,
  haversineDistanceM,
  minettiCostRatio,
  supportsSlopeAdjustedPace,
  type GapTracePoint,
  type SlopeAdjustedPaceResult,
} from '../activity/slopeAdjustedPace';
import {
  computeHeartRateZoneTimes,
  computePaceZoneTimes,
  computePowerZoneTimes,
  computeRelativeEffort,
  normalizePerceivedEffort,
  type EffortWeights,
  type HeartRateSample,
  type PerceivedEffortResult,
  type PowerSample,
  type RelativeEffortResult,
  type SpeedSample,
  type ZoneSet,
  type ZoneTimeResult,
} from './activityMetrics';
import {
  computePowerCurve,
  estimateFtpFromPowerCurve,
  type EstimatedFtpResult,
  type PowerCurveResult,
} from './powerCurve';

export interface AlignedTelemetryPoint {
  readonly index: number;
  readonly distanceKm: number;
  readonly elapsedS: number | null;
  readonly timestampMs: number | null;
  readonly lat: number;
  readonly lng: number;
  readonly altitudeM: number | null;
  readonly speedMps: number | null;
  readonly speedKmh: number | null;
  readonly paceMinPerKm: number | null;
  readonly gapPaceMinPerKm: number | null;
  readonly gradePct: number | null;
  readonly heartRateBpm: number | null;
  readonly cadence: number | null;
  readonly powerW: number | null;
  readonly powerQuality: 'measured' | 'estimated' | null;
  readonly temperatureC: number | null;
}

export interface ComputedTraceSplit {
  readonly index: number;
  readonly unit: 'km' | 'mi';
  readonly distanceM: number;
  readonly durationS: number;
  readonly paceMinPerKm: number | null;
  readonly gapPaceMinPerKm: number | null;
  readonly speedKmh: number | null;
  readonly elevationGainM: number | null;
  readonly elevationLossM: number | null;
  readonly averageHrBpm: number | null;
  readonly averagePowerW: number | null;
  readonly completed: boolean;
  readonly isFastest: boolean;
}

export interface DetectedInterval {
  readonly index: number;
  readonly kind: 'effort' | 'recovery';
  readonly startKm: number;
  readonly endKm: number;
  readonly durationS: number;
  readonly averageSpeedKmh: number | null;
  readonly averagePaceMinPerKm: number | null;
  readonly averageHrBpm: number | null;
  readonly averagePowerW: number | null;
}

export interface SensorChannelStats {
  readonly key: 'heartRate' | 'cadence' | 'temperature' | 'power';
  readonly label: string;
  readonly unit: string;
  readonly avg: number;
  readonly min: number;
  readonly max: number;
  readonly count: number;
  readonly coveragePct: number;
  readonly qualityLabel: 'mesurée' | 'estimée';
}

export interface EnergyAndStepsReading {
  readonly caloriesKcal: number | null;
  readonly caloriesQuality: 'measured' | 'estimated' | 'unavailable';
  readonly caloriesNote: string;
  readonly steps: number | null;
  readonly stepsQuality: 'measured' | 'estimated' | 'unavailable';
  readonly stepsNote: string;
}

export interface CyclingPowerAnalysis {
  readonly status: 'available' | 'unavailable';
  readonly quality: 'measured' | 'estimated' | null;
  readonly method: string | null;
  readonly averageW: number | null;
  readonly maxW: number | null;
  readonly normalizedW: number | null;
  readonly samples: readonly { atMs: number; watts: number; quality: 'measured' | 'estimated' }[];
  readonly curve: PowerCurveResult;
  readonly estimatedFtp: EstimatedFtpResult;
}

export interface OutingTelemetryBundle {
  readonly aligned: readonly AlignedTelemetryPoint[];
  readonly kmSplits: readonly ComputedTraceSplit[];
  readonly miSplits: readonly ComputedTraceSplit[];
  readonly intervals: readonly DetectedInterval[];
  readonly sensorChannels: readonly SensorChannelStats[];
  readonly energyAndSteps: EnergyAndStepsReading;
  readonly gap: SlopeAdjustedPaceResult | null;
  readonly powerAnalysis: CyclingPowerAnalysis;
  readonly hrZones: ZoneTimeResult | null;
  readonly paceZones: ZoneTimeResult | null;
  readonly powerZones: ZoneTimeResult | null;
  readonly relativeEffort: RelativeEffortResult | null;
  readonly perceivedEffort: PerceivedEffortResult | null;
  readonly sRpeLoad: number | null;
}

const LOCAL_ZONES_KEY = 'lkdv.metrics.zoneConfigs.v1';
const LOCAL_RPE_KEY = 'lkdv.metrics.outingRpe.v1';

const SPORT_MET: Record<string, number> = {
  course: 9.8,
  trail: 10.5,
  velo: 8.0,
  rando: 6.0,
  ski: 7.5,
  kayak: 5.5,
  escalade: 6.5,
  musculation: 5.0,
};

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Construit les configurations de zones de référence si l'utilisateur n'a pas
 * encore enregistré ses zones personnalisées (tout en conservant les seuils
 * explicites s'ils existent).
 */
export function buildDefaultZoneSet(
  metric: 'heartRate' | 'power' | 'pace',
  discipline = 'all',
  customThreshold?: number | null,
): ZoneSet {
  const now = Date.UTC(2026, 0, 1);
  if (metric === 'heartRate') {
    const fcMax = customThreshold && customThreshold > 100 ? customThreshold : 190;
    return {
      id: `default-hr-${discipline}`,
      version: '1',
      discipline,
      metric: 'heartRate',
      basis: 'absolute',
      unit: 'bpm',
      threshold: {
        kind: 'maxHeartRate',
        value: fcMax,
        unit: 'bpm',
        origin: customThreshold ? 'manual' : 'estimated',
        measuredAtMs: null,
      },
      effectiveFromMs: 0,
      recordedAtMs: now,
      bands: [
        { id: 'z1', label: 'Z1 · Récupération', lower: 0, upper: Math.round(fcMax * 0.6) },
        { id: 'z2', label: 'Z2 · Endurance', lower: Math.round(fcMax * 0.6), upper: Math.round(fcMax * 0.7) },
        { id: 'z3', label: 'Z3 · Tempo', lower: Math.round(fcMax * 0.7), upper: Math.round(fcMax * 0.8) },
        { id: 'z4', label: 'Z4 · Seuil', lower: Math.round(fcMax * 0.8), upper: Math.round(fcMax * 0.9) },
        { id: 'z5', label: 'Z5 · VO2max', lower: Math.round(fcMax * 0.9), upper: null },
      ],
    };
  }
  if (metric === 'power') {
    const ftp = customThreshold && customThreshold > 50 ? customThreshold : 250;
    return {
      id: `default-power-${discipline}`,
      version: '1',
      discipline,
      metric: 'power',
      basis: 'absolute',
      unit: 'watts',
      threshold: {
        kind: 'ftp',
        value: ftp,
        unit: 'watts',
        origin: customThreshold ? 'manual' : 'estimated',
        measuredAtMs: null,
      },
      effectiveFromMs: 0,
      recordedAtMs: now,
      bands: [
        { id: 'z1', label: 'Z1 · Récup. active', lower: 0, upper: Math.round(ftp * 0.55) },
        { id: 'z2', label: 'Z2 · Endurance', lower: Math.round(ftp * 0.55), upper: Math.round(ftp * 0.75) },
        { id: 'z3', label: 'Z3 · Tempo', lower: Math.round(ftp * 0.75), upper: Math.round(ftp * 0.9) },
        { id: 'z4', label: 'Z4 · Seuil FTP', lower: Math.round(ftp * 0.9), upper: Math.round(ftp * 1.05) },
        { id: 'z5', label: 'Z5 · VO2 / Anaérobie', lower: Math.round(ftp * 1.05), upper: null },
      ],
    };
  }
  // Allure (en secondes/km — convertie via vitesse en m/s dans computePaceZoneTimes)
  const thresholdPaceSPerKm = customThreshold && customThreshold > 120 ? customThreshold : 270; // 4:30/km
  return {
    id: `default-pace-${discipline}`,
    version: '1',
    discipline,
    metric: 'pace',
    basis: 'absolute',
    unit: 'secondsPerKm',
    threshold: {
      kind: 'paceThreshold',
      value: thresholdPaceSPerKm,
      unit: 'secondsPerKm',
      origin: customThreshold ? 'manual' : 'estimated',
      measuredAtMs: null,
    },
    effectiveFromMs: 0,
    recordedAtMs: now,
    bands: [
      { id: 'z1', label: 'Z1 · Facile', lower: Math.round(thresholdPaceSPerKm * 1.25), upper: null },
      {
        id: 'z2',
        label: 'Z2 · Endurance',
        lower: Math.round(thresholdPaceSPerKm * 1.12),
        upper: Math.round(thresholdPaceSPerKm * 1.25),
      },
      {
        id: 'z3',
        label: 'Z3 · Tempo',
        lower: Math.round(thresholdPaceSPerKm * 1.03),
        upper: Math.round(thresholdPaceSPerKm * 1.12),
      },
      {
        id: 'z4',
        label: 'Z4 · Seuil',
        lower: Math.round(thresholdPaceSPerKm * 0.94),
        upper: Math.round(thresholdPaceSPerKm * 1.03),
      },
      { id: 'z5', label: 'Z5 · Vitesse / VMA', lower: 0, upper: Math.round(thresholdPaceSPerKm * 0.94) },
    ],
  };
}

export const DEFAULT_CARDIO_WEIGHTS: EffortWeights = {
  id: 'lkdv-trimp-weights-v1',
  version: '1',
  pointsPerHour: {
    z1: 30,
    z2: 60,
    z3: 120,
    z4: 210,
    z5: 300,
  },
};

export function readLocalZoneSets(discipline?: string): ZoneSet[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(LOCAL_ZONES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? (parsed as ZoneSet[]) : [];
    if (!discipline) return list;
    return list.filter((item) => item.discipline === discipline || item.discipline === 'all');
  } catch {
    return [];
  }
}

export function saveLocalZoneSet(zoneSet: ZoneSet): ZoneSet[] {
  const existing = readLocalZoneSets().filter((item) => item.id !== zoneSet.id);
  const next = [zoneSet, ...existing];
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LOCAL_ZONES_KEY, JSON.stringify(next));
    }
  } catch {
    /* ignore */
  }
  return next;
}

export function readOutingRpe(outingId: string): number | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage || !outingId) return null;
    const raw = window.localStorage.getItem(LOCAL_RPE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, unknown>;
    const value = map[outingId];
    return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10
      ? value
      : null;
  } catch {
    return null;
  }
}

export function saveOutingRpe(outingId: string, rpe: number | null): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage || !outingId) return;
    const raw = window.localStorage.getItem(LOCAL_RPE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    if (rpe === null) {
      delete map[outingId];
    } else {
      map[outingId] = rpe;
    }
    window.localStorage.setItem(LOCAL_RPE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function alignSampleToPoint(
  pointIndex: number,
  pointTimestampMs: number | null,
  samples: readonly OutingImportSample[],
): OutingImportSample | null {
  if (samples.length === 0) return null;
  if (pointTimestampMs !== null) {
    // Cherche l'échantillon le plus proche dans +/- 10 s
    let best: OutingImportSample | null = null;
    let bestDelta = 10_000;
    for (const sample of samples) {
      const sMs = parseMs(sample.recordedAt);
      if (sMs === null) continue;
      const delta = Math.abs(sMs - pointTimestampMs);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = sample;
      }
    }
    if (best) return best;
  }
  return samples[pointIndex] ?? null;
}

function estimateCyclingWatts(speedMps: number, grade: number, massKg = 80): number {
  if (!Number.isFinite(speedMps) || speedMps < 0.5) return 0;
  const g = 9.80665;
  const crr = 0.005;
  const rho = 1.225;
  const cdA = 0.36;
  const clampedGrade = Math.max(-0.25, Math.min(0.3, grade));
  const rolling = crr * massKg * g * Math.cos(Math.atan(clampedGrade));
  const gravity = massKg * g * Math.sin(Math.atan(clampedGrade));
  const aero = 0.5 * rho * cdA * speedMps * speedMps;
  const wheelPower = (rolling + gravity + aero) * speedMps;
  if (wheelPower <= 0) return 0;
  return Math.round(wheelPower / 0.97);
}

/**
 * Construit les séries alignées point-par-point depuis les segments visibles
 * et les échantillons FIT/TCX optionnels.
 */
export function buildAlignedTelemetry(
  sport: string | null | undefined,
  segments: readonly (readonly OutingPoint[])[],
  samples: readonly OutingImportSample[] | null | undefined,
): AlignedTelemetryPoint[] {
  const flatPoints = segments.flat();
  if (flatPoints.length === 0) return [];
  const sampleList = Array.isArray(samples) ? samples : [];
  const isRun = supportsSlopeAdjustedPace(sport);
  const isBike = sport === 'velo';

  const result: AlignedTelemetryPoint[] = [];
  let cumulativeM = 0;
  let firstMs: number | null = null;
  let prevPoint: OutingPoint | null = null;
  let prevMs: number | null = null;

  for (let i = 0; i < flatPoints.length; i += 1) {
    const pt = flatPoints[i];
    const pointTs = parseMs(pt.timestamp);
    const sample = alignSampleToPoint(i, pointTs, sampleList);
    const tMs = pointTs ?? parseMs(sample?.recordedAt);
    if (firstMs === null && tMs !== null) firstMs = tMs;
    let stepDistM = 0;
    let dtS: number | null = null;
    if (prevPoint) {
      stepDistM = haversineDistanceM(prevPoint.lat, prevPoint.lng, pt.lat, pt.lng);
      // Ignorer les sauts aberrants entre segments masqués (> 2 km d'un coup)
      if (stepDistM > 2000 && prevMs !== null && tMs !== null && tMs - prevMs < 30_000) {
        stepDistM = 0;
      }
      cumulativeM += stepDistM;
      if (prevMs !== null && tMs !== null && tMs > prevMs) {
        dtS = (tMs - prevMs) / 1000;
      }
    }

    const rawSpeed =
      finiteOrNull(sample?.speedMps) ??
      (dtS !== null && dtS > 0 && dtS <= 120 && stepDistM >= 0
        ? Math.min(stepDistM / dtS, isBike ? 32 : 11)
        : null);

    const speedKmh = rawSpeed !== null && rawSpeed >= 0 ? Math.round(rawSpeed * 3.6 * 10) / 10 : null;
    const paceMinPerKm =
      rawSpeed !== null && rawSpeed > 0.35 ? 1000 / rawSpeed / 60 : null;

    const altitudeM = finiteOrNull(pt.elevationM) ?? finiteOrNull(sample?.altitudeM);
    const prevAlt = prevPoint ? finiteOrNull(prevPoint.elevationM) : null;
    const grade =
      prevPoint &&
      stepDistM >= 5 &&
      altitudeM !== null &&
      prevAlt !== null
        ? Math.max(-0.45, Math.min(0.45, (altitudeM - prevAlt) / stepDistM))
        : null;

    const gapPaceMinPerKm =
      isRun && paceMinPerKm !== null && grade !== null
        ? paceMinPerKm / minettiCostRatio(grade)
        : null;

    const measuredPower = finiteOrNull(sample?.powerW);
    const estimatedPower =
      measuredPower === null && isBike && rawSpeed !== null && grade !== null
        ? estimateCyclingWatts(rawSpeed, grade)
        : null;

    const cadence =
      finiteOrNull(sample?.cadenceRpm) ?? finiteOrNull(sample?.cadenceSpm);

    result.push({
      index: i,
      distanceKm: Math.round((cumulativeM / 1000) * 1000) / 1000,
      elapsedS: firstMs !== null && tMs !== null ? Math.max(0, (tMs - firstMs) / 1000) : null,
      timestampMs: tMs,
      lat: pt.lat,
      lng: pt.lng,
      altitudeM,
      speedMps: rawSpeed,
      speedKmh,
      paceMinPerKm,
      gapPaceMinPerKm,
      gradePct: grade !== null ? Math.round(grade * 1000) / 10 : null,
      heartRateBpm: finiteOrNull(sample?.heartRateBpm),
      cadence,
      powerW: measuredPower ?? estimatedPower,
      powerQuality:
        measuredPower !== null ? 'measured' : estimatedPower !== null ? 'estimated' : null,
      temperatureC: finiteOrNull(sample?.temperatureC),
    });

    prevPoint = pt;
    prevMs = tMs;
  }

  return result;
}

/**
 * Calcule les splits par km ou par mile depuis la trace alignée, avec
 * prorata exact au franchissement de chaque seuil et surbrillance du plus rapide.
 */
export function computeTraceSplits(
  aligned: readonly AlignedTelemetryPoint[],
  unit: 'km' | 'mi',
): ComputedTraceSplit[] {
  if (aligned.length < 2) return [];
  const unitKm = unit === 'km' ? 1 : 1.609344;

  interface Bucket {
    index: number;
    distKm: number;
    durS: number;
    gainM: number;
    lossM: number;
    hasEle: boolean;
    hrSum: number;
    hrWeight: number;
    powerSum: number;
    powerWeight: number;
    gapWeightedPaceSum: number;
    gapDistKm: number;
    completed: boolean;
  }

  const makeBucket = (index: number): Bucket => ({
    index,
    distKm: 0,
    durS: 0,
    gainM: 0,
    lossM: 0,
    hasEle: false,
    hrSum: 0,
    hrWeight: 0,
    powerSum: 0,
    powerWeight: 0,
    gapWeightedPaceSum: 0,
    gapDistKm: 0,
    completed: false,
  });

  const buckets: Bucket[] = [makeBucket(1)];

  for (let i = 1; i < aligned.length; i += 1) {
    const prev = aligned[i - 1];
    const curr = aligned[i];
    const segDistKm = Math.max(0, curr.distanceKm - prev.distanceKm);
    if (segDistKm <= 0) continue;

    const segDurS =
      prev.elapsedS !== null && curr.elapsedS !== null && curr.elapsedS > prev.elapsedS
        ? curr.elapsedS - prev.elapsedS
        : curr.speedMps !== null && curr.speedMps > 0.3
          ? (segDistKm * 1000) / curr.speedMps
          : 0;
    const dEle =
      prev.altitudeM !== null && curr.altitudeM !== null
        ? curr.altitudeM - prev.altitudeM
        : null;

    let remDistKm = segDistKm;
    let remDurS = segDurS;

    while (remDistKm > 1e-6) {
      let current = buckets[buckets.length - 1];
      const missingKm = unitKm - current.distKm;
      if (missingKm <= 1e-6) {
        current = makeBucket(current.index + 1);
        buckets.push(current);
        continue;
      }
      const takeKm = Math.min(remDistKm, missingKm);
      const frac = takeKm / remDistKm;
      const takeDurS = remDurS * frac;

      current.distKm += takeKm;
      current.durS += takeDurS;

      if (dEle !== null) {
        current.hasEle = true;
        const partEle = dEle * (takeKm / segDistKm);
        if (partEle > 0) current.gainM += partEle;
        else current.lossM += Math.abs(partEle);
      }
      if (curr.heartRateBpm !== null && takeDurS > 0) {
        current.hrSum += curr.heartRateBpm * takeDurS;
        current.hrWeight += takeDurS;
      }
      if (curr.powerW !== null && takeDurS > 0) {
        current.powerSum += curr.powerW * takeDurS;
        current.powerWeight += takeDurS;
      }
      if (curr.gapPaceMinPerKm !== null) {
        current.gapWeightedPaceSum += curr.gapPaceMinPerKm * takeKm;
        current.gapDistKm += takeKm;
      }

      if (Math.abs(current.distKm - unitKm) <= 1e-4) {
        current.completed = true;
        buckets.push(makeBucket(current.index + 1));
      }

      remDistKm -= takeKm;
      remDurS -= takeDurS;
    }
  }

  const nonEmpty = buckets.filter((b) => b.distKm > 0.02);
  if (nonEmpty.length === 0) return [];

  // Trouver le split complété le plus rapide (plus petite allure / plus grande vitesse)
  let fastestIndex: number | null = null;
  let bestPace = Number.POSITIVE_INFINITY;
  for (const b of nonEmpty) {
    if (!b.completed || b.durS <= 0) continue;
    const pace = b.durS / 60 / b.distKm;
    if (pace < bestPace) {
      bestPace = pace;
      fastestIndex = b.index;
    }
  }

  return nonEmpty.map((b) => {
    const paceMinPerKm = b.durS > 0 && b.distKm > 0 ? b.durS / 60 / b.distKm : null;
    const speedKmh = b.durS > 0 && b.distKm > 0 ? (b.distKm / b.durS) * 3600 : null;
    return {
      index: b.index,
      unit,
      distanceM: Math.round(b.distKm * 1000),
      durationS: Math.round(b.durS),
      paceMinPerKm,
      gapPaceMinPerKm: b.gapDistKm > 0 ? b.gapWeightedPaceSum / b.gapDistKm : null,
      speedKmh,
      elevationGainM: b.hasEle ? Math.round(b.gainM) : null,
      elevationLossM: b.hasEle ? Math.round(b.lossM) : null,
      averageHrBpm: b.hrWeight > 0 ? Math.round(b.hrSum / b.hrWeight) : null,
      averagePowerW: b.powerWeight > 0 ? Math.round(b.powerSum / b.powerWeight) : null,
      completed: b.completed,
      isFastest: fastestIndex !== null && b.index === fastestIndex,
    };
  });
}

/**
 * Détecte les intervalles d'effort vs récupération (S2.05) à partir des variations
 * soutenues de vitesse (>= 12 % au-dessus de la médiane de séance pendant >= 20 s).
 */
export function detectEffortIntervals(
  aligned: readonly AlignedTelemetryPoint[],
): DetectedInterval[] {
  const speeds = aligned
    .map((p) => p.speedKmh)
    .filter((v): v is number => v !== null && v > 1.5)
    .slice()
    .sort((a, b) => a - b);
  if (speeds.length < 10) return [];
  const medianSpeed = speeds[Math.floor(speeds.length / 2)];
  const surgeThreshold = medianSpeed * 1.12;

  const intervals: DetectedInterval[] = [];
  let inEffort: boolean | null = null;
  let startIdx = 0;

  const flush = (endIdx: number, effort: boolean) => {
    const startPt = aligned[startIdx];
    const endPt = aligned[endIdx];
    if (startPt.elapsedS === null || endPt.elapsedS === null) return;
    const durS = endPt.elapsedS - startPt.elapsedS;
    if (durS < 20) return;

    const slice = aligned.slice(startIdx, endIdx + 1);
    const hrs = slice.map((p) => p.heartRateBpm).filter((v): v is number => v !== null);
    const pwrs = slice.map((p) => p.powerW).filter((v): v is number => v !== null);
    const distKm = Math.max(0, endPt.distanceKm - startPt.distanceKm);
    const speedKmh = durS > 0 && distKm > 0 ? (distKm / durS) * 3600 : null;
    const paceMinPerKm = speedKmh && speedKmh > 0 ? 60 / speedKmh : null;

    intervals.push({
      index: intervals.length + 1,
      kind: effort ? 'effort' : 'recovery',
      startKm: startPt.distanceKm,
      endKm: endPt.distanceKm,
      durationS: Math.round(durS),
      averageSpeedKmh: speedKmh !== null ? Math.round(speedKmh * 10) / 10 : null,
      averagePaceMinPerKm: paceMinPerKm,
      averageHrBpm: hrs.length > 0 ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null,
      averagePowerW: pwrs.length > 0 ? Math.round(pwrs.reduce((a, b) => a + b, 0) / pwrs.length) : null,
    });
  };

  for (let i = 0; i < aligned.length; i += 1) {
    const s = aligned[i].speedKmh;
    if (s === null) continue;
    const isEffort = s >= surgeThreshold;
    if (inEffort === null) {
      inEffort = isEffort;
      startIdx = i;
    } else if (isEffort !== inEffort) {
      flush(i - 1, inEffort);
      inEffort = isEffort;
      startIdx = i;
    }
  }
  if (inEffort !== null) {
    flush(aligned.length - 1, inEffort);
  }

  // N'exposer les intervalles que si au moins un bloc d'effort et un contraste existent
  const effortCount = intervals.filter((i) => i.kind === 'effort').length;
  return effortCount >= 2 ? intervals : [];
}

export function summarizeSensorChannels(
  aligned: readonly AlignedTelemetryPoint[],
  samples: readonly OutingImportSample[] | null | undefined,
): SensorChannelStats[] {
  const totalPoints = Math.max(aligned.length, samples?.length ?? 0, 1);
  const channels: SensorChannelStats[] = [];

  const collect = (
    key: SensorChannelStats['key'],
    label: string,
    unit: string,
    values: number[],
    qualityLabel: 'mesurée' | 'estimée',
  ) => {
    if (values.length === 0) return;
    const sum = values.reduce((a, b) => a + b, 0);
    channels.push({
      key,
      label,
      unit,
      avg: Math.round((sum / values.length) * 10) / 10,
      min: Math.round(Math.min(...values) * 10) / 10,
      max: Math.round(Math.max(...values) * 10) / 10,
      count: values.length,
      coveragePct: Math.min(100, Math.round((values.length / totalPoints) * 100)),
      qualityLabel,
    });
  };

  const sampleList = Array.isArray(samples) ? samples : [];
  const hrVals = (
    sampleList.length > 0
      ? sampleList.map((s) => s.heartRateBpm)
      : aligned.map((p) => p.heartRateBpm)
  ).filter((v): v is number => v !== null && Number.isFinite(v));
  collect('heartRate', 'Fréquence cardiaque', 'bpm', hrVals, 'mesurée');

  const cadVals = (
    sampleList.length > 0
      ? sampleList.map((s) => s.cadenceRpm ?? s.cadenceSpm)
      : aligned.map((p) => p.cadence)
  ).filter((v): v is number => v !== null && Number.isFinite(v));
  const hasRpm = sampleList.some((s) => s.cadenceRpm !== null);
  collect('cadence', 'Cadence', hasRpm ? 'tr/min' : 'pas/min', cadVals, 'mesurée');

  const tempVals = (
    sampleList.length > 0
      ? sampleList.map((s) => s.temperatureC)
      : aligned.map((p) => p.temperatureC)
  ).filter((v): v is number => v !== null && Number.isFinite(v));
  collect('temperature', 'Température', '°C', tempVals, 'mesurée');

  const measuredPowerVals = aligned
    .filter((p) => p.powerQuality === 'measured' && p.powerW !== null)
    .map((p) => p.powerW as number);
  const estimatedPowerVals = aligned
    .filter((p) => p.powerQuality === 'estimated' && p.powerW !== null)
    .map((p) => p.powerW as number);
  if (measuredPowerVals.length > 0) {
    collect('power', 'Puissance', 'W', measuredPowerVals, 'mesurée');
  } else if (estimatedPowerVals.length > 0) {
    collect('power', 'Puissance', 'W', estimatedPowerVals, 'estimée');
  }

  return channels;
}

export function resolveCaloriesAndSteps(params: {
  sport: string | null | undefined;
  durationS: number | null;
  movingS: number | null;
  summary: OutingImportSummary | null | undefined;
  samples: readonly OutingImportSample[] | null | undefined;
  measuredCaloriesKcal: number | null;
  averageHrBpm: number | null;
  bodyWeightKg?: number | null;
}): EnergyAndStepsReading {
  const weightKg =
    typeof params.bodyWeightKg === 'number' &&
    Number.isFinite(params.bodyWeightKg) &&
    params.bodyWeightKg > 25
      ? params.bodyWeightKg
      : 70;
  const activeS = params.movingS ?? params.durationS;

  let caloriesKcal: number | null =
    finiteOrNull(params.summary?.caloriesKcal) ?? finiteOrNull(params.measuredCaloriesKcal);
  let caloriesQuality: EnergyAndStepsReading['caloriesQuality'] =
    caloriesKcal !== null ? 'measured' : 'unavailable';
  let caloriesNote =
    caloriesKcal !== null
      ? 'Valeur fournie par la montre ou le fichier importé (mesurée).'
      : 'Durée insuffisante pour estimer la dépense énergétique.';

  if (caloriesKcal === null && activeS !== null && activeS > 60) {
    const minutes = activeS / 60;
    if (params.averageHrBpm !== null && params.averageHrBpm >= 70) {
      // Keytel et al. (2005) — estimation mixte cardiaque (poids référence si absent)
      const kcalPerMin = Math.max(
        1,
        (-55.0969 + 0.6309 * params.averageHrBpm + 0.1988 * weightKg + 0.2017 * 35) / 4.184,
      );
      caloriesKcal = Math.round(kcalPerMin * minutes);
      caloriesQuality = 'estimated';
      caloriesNote = `Estimée via fréquence cardiaque moyenne (poids ${weightKg} kg${params.bodyWeightKg ? '' : ' par défaut'}).`;
    } else {
      const met = SPORT_MET[params.sport ?? ''] ?? 5.5;
      caloriesKcal = Math.round(((met * 3.5 * weightKg) / 200) * minutes);
      caloriesQuality = 'estimated';
      caloriesNote = `Estimée via MET du sport (${met}) sur durée active (poids ${weightKg} kg${params.bodyWeightKg ? '' : ' par défaut'}).`;
    }
  }

  // Pas : uniquement si cadence course/marche mesurée (`cadenceSpm`) est présente
  const cadSpm = (params.samples ?? [])
    .map((s) => s.cadenceSpm)
    .filter((v): v is number => v !== null && Number.isFinite(v) && v > 0);
  let steps: number | null = null;
  let stepsQuality: EnergyAndStepsReading['stepsQuality'] = 'unavailable';
  let stepsNote = 'Podomètre ou cadence course absent : aucun pas inventé.';

  if (cadSpm.length > 0 && activeS !== null && activeS > 0) {
    const avgSpm = cadSpm.reduce((a, b) => a + b, 0) / cadSpm.length;
    steps = Math.round(avgSpm * (activeS / 60));
    stepsQuality = 'estimated';
    stepsNote = 'Estimés depuis la cadence de pas mesurée × temps actif.';
  }

  return {
    caloriesKcal,
    caloriesQuality,
    caloriesNote,
    steps,
    stepsQuality,
    stepsNote,
  };
}

function computeNormalizedPower(watts: readonly number[]): number | null {
  if (watts.length < 30) return null;
  let sum4 = 0;
  let count = 0;
  for (let i = 29; i < watts.length; i += 1) {
    let win = 0;
    for (let j = i - 29; j <= i; j += 1) win += watts[j];
    const avg = win / 30;
    sum4 += avg ** 4;
    count += 1;
  }
  if (count === 0) return null;
  return Math.round((sum4 / count) ** 0.25);
}

/**
 * Analyse complète d'une sortie : courbes, splits, intervalles, GAP, zones,
 * puissance, courbe de puissance / FTP et effort relatif / RPE.
 */
export function analyzeOutingTelemetry(input: {
  outingId: string;
  sport: string | null | undefined;
  segments: readonly (readonly OutingPoint[])[];
  samples?: readonly OutingImportSample[] | null;
  summary?: OutingImportSummary | null;
  durationS: number | null;
  movingTimeS: number | null;
  measuredCaloriesKcal?: number | null;
  measuredHrBpm?: number | null;
  rpe?: number | null;
  zoneSets?: readonly ZoneSet[];
  bodyWeightKg?: number | null;
}): OutingTelemetryBundle {
  const aligned = buildAlignedTelemetry(input.sport, input.segments, input.samples);
  const kmSplits = computeTraceSplits(aligned, 'km');
  const miSplits = computeTraceSplits(aligned, 'mi');
  const intervals = detectEffortIntervals(aligned);
  const sensorChannels = summarizeSensorChannels(aligned, input.samples);

  const hrChannel = sensorChannels.find((c) => c.key === 'heartRate');
  const avgHr = hrChannel?.avg ?? finiteOrNull(input.measuredHrBpm);

  const energyAndSteps = resolveCaloriesAndSteps({
    sport: input.sport,
    durationS: input.durationS,
    movingS: input.movingTimeS,
    summary: input.summary,
    samples: input.samples,
    measuredCaloriesKcal: finiteOrNull(input.measuredCaloriesKcal),
    averageHrBpm: avgHr,
    bodyWeightKg: input.bodyWeightKg,
  });

  const gapPoints: GapTracePoint[] = aligned.map((pt) => ({
    lat: pt.lat,
    lng: pt.lng,
    elevationM: pt.altitudeM,
    timestampMs: pt.timestampMs,
  }));
  const gap = computeSlopeAdjustedPace(input.sport, gapPoints);

  // Puissance & Courbe de puissance
  const timedPowerSamples = aligned
    .filter((p) => p.powerW !== null && p.timestampMs !== null && p.powerQuality !== null)
    .map((p) => ({
      atMs: p.timestampMs as number,
      watts: p.powerW as number,
      quality: p.powerQuality as 'measured' | 'estimated',
    }));

  const powerCurve = computePowerCurve(timedPowerSamples, {
    bodyWeightKg: input.bodyWeightKg,
  });
  const estimatedFtp = estimateFtpFromPowerCurve(powerCurve, input.bodyWeightKg);
  const powerValues = timedPowerSamples.map((s) => s.watts);
  const powerQuality: 'measured' | 'estimated' | null =
    timedPowerSamples.length === 0
      ? null
      : timedPowerSamples.some((s) => s.quality === 'estimated')
        ? 'estimated'
        : 'measured';
  const powerAnalysis: CyclingPowerAnalysis =
    timedPowerSamples.length > 0
      ? {
          status: 'available',
          quality: powerQuality,
          method:
            powerQuality === 'measured' ? 'sensor-or-import' : 'cycling-physics-v1',
          averageW: Math.round(powerValues.reduce((a, b) => a + b, 0) / powerValues.length),
          maxW: Math.round(Math.max(...powerValues)),
          normalizedW: computeNormalizedPower(powerValues),
          samples: timedPowerSamples,
          curve: powerCurve,
          estimatedFtp,
        }
      : {
          status: 'unavailable',
          quality: null,
          method: null,
          averageW: null,
          maxW: null,
          normalizedW: null,
          samples: [],
          curve: powerCurve,
          estimatedFtp,
        };

  // Zones & Effort Relatif
  const customZones = input.zoneSets ?? [];
  const hrZoneSet =
    customZones.find((z) => z.metric === 'heartRate') ??
    buildDefaultZoneSet('heartRate', input.sport ?? 'all');
  const powerZoneSet =
    customZones.find((z) => z.metric === 'power') ??
    buildDefaultZoneSet('power', input.sport ?? 'all', estimatedFtp.ftpW);
  const paceZoneSet =
    customZones.find((z) => z.metric === 'pace') ??
    buildDefaultZoneSet('pace', input.sport ?? 'all');

  const timedPoints = aligned.filter((p) => p.timestampMs !== null);
  const fromMs = timedPoints[0]?.timestampMs ?? 0;
  const toMs = timedPoints[timedPoints.length - 1]?.timestampMs ?? 0;
  const hasWindow = timedPoints.length >= 2 && toMs > fromMs;

  let hrZones: ZoneTimeResult | null = null;
  let paceZones: ZoneTimeResult | null = null;
  let powerZones: ZoneTimeResult | null = null;
  let relativeEffort: RelativeEffortResult | null = null;

  if (hasWindow) {
    const baseOpts = {
      fromMs,
      toMs,
      maxHoldMs: 15_000,
      source: { kind: 'import' as const, id: input.outingId },
      computedAtMs: toMs,
    };

    const hrSamples: HeartRateSample[] = timedPoints
      .filter((p) => p.heartRateBpm !== null)
      .map((p) => ({ atMs: p.timestampMs as number, bpm: p.heartRateBpm }));
    if (hrSamples.length >= 2) {
      hrZones = computeHeartRateZoneTimes(hrSamples, hrZoneSet, baseOpts);
      relativeEffort = computeRelativeEffort(hrZones, {
        weights: DEFAULT_CARDIO_WEIGHTS,
        computedAtMs: toMs,
      });
    }

    const speedSamples: SpeedSample[] = timedPoints
      .filter((p) => p.speedMps !== null)
      .map((p) => ({ atMs: p.timestampMs as number, speedMps: p.speedMps }));
    if (speedSamples.length >= 2) {
      paceZones = computePaceZoneTimes(speedSamples, paceZoneSet, baseOpts);
    }

    if (timedPowerSamples.length >= 2) {
      const pSamples: PowerSample[] = timedPowerSamples.map((p) => ({
        atMs: p.atMs,
        watts: p.watts,
      }));
      powerZones = computePowerZoneTimes(pSamples, powerZoneSet, {
        ...baseOpts,
        source: {
          kind: powerQuality === 'estimated' ? 'estimated' : 'import',
          id: input.outingId,
        },
      });
    }
  }

  const effectiveRpe = input.rpe ?? readOutingRpe(input.outingId);
  const perceivedEffort =
    effectiveRpe !== null
      ? normalizePerceivedEffort(
          {
            value: effectiveRpe,
            scale: { min: 1, max: 10, step: 1, labels: {} },
            recordedAtMs: toMs || Date.now(),
          },
        )
      : null;

  const activeMinutes =
    input.movingTimeS !== null
      ? input.movingTimeS / 60
      : input.durationS !== null
        ? input.durationS / 60
        : null;
  const sRpeLoad =
    effectiveRpe !== null && activeMinutes !== null && activeMinutes > 0
      ? Math.round(effectiveRpe * activeMinutes * 0.25)
      : null;

  return {
    aligned,
    kmSplits,
    miSplits,
    intervals,
    sensorChannels,
    energyAndSteps,
    gap,
    powerAnalysis,
    hrZones,
    paceZones,
    powerZones,
    relativeEffort,
    perceivedEffort,
    sRpeLoad,
  };
}
