/**
 * A3 — Prédiction personnelle segment et route (moteur pur).
 *
 * P50 = durée via `resolvePace` ; P90 = P50 × facteur d'incertitude qui
 * augmente quand la confiance baisse. La fatigue cumulée dégrade l'allure au
 * fil de la route (`computeFatigue` par segment), les stratégies multiplient
 * la vitesse (confort 0.92, recommandée 1.0, rapide 1.12) et les facteurs
 * restent explicables (`PredictionFactor[]`).
 */
import { clamp01, COLD_CONFIDENCE, type Confidence } from './confidence';
import { computeFatigue } from './fatigue';
import { resolvePace, type ResolvedPace } from './paceResolver';
import { PERFORMANCE_PROFILE_MODEL_VERSION } from './performanceProfile';
import type { PauseModel, PerformanceProfile } from '../schemas/performance.schema';
import type {
  EngineWarningSchema,
} from '../schemas/adventurePlan.schema';
import type {
  PredictionFactor,
  RoutePrediction,
  RouteStrategy,
  SegmentPrediction,
} from '../schemas/prediction.schema';

export const STRATEGIES = ['comfort', 'recommended', 'fast'] as const;

/** Facteurs de vitesse par stratégie (confort plus lent, rapide plus vite). */
export const STRATEGY_SPEED_FACTORS: Record<RouteStrategy, number> = {
  comfort: 0.92,
  recommended: 1,
  fast: 1.12,
};

export const BASE_UNCERTAINTY_FACTOR = 1.05;
export const UNCERTAINTY_PER_MISSING_CONFIDENCE = 0.35;
/** Effet maximal de la fatigue cumulée sur l'allure (+30 % de durée à 100). */
export const FATIGUE_PACE_IMPACT = 0.3;

/** Modèle de pauses de repli (profil absent) : 5 min/h, 2 min/100 m D+. */
export const GENERIC_PAUSE_MODEL: PauseModel = {
  pauseMinutesPerHour: 5,
  pauseMinutesPerAscentM: 0.02,
  minPauseMinutes: 0,
};

export interface SegmentPredictionInput {
  segmentId: number;
  distanceM: number;
  gainM: number;
  lossM: number;
  meanGradePct?: number | null;
  technicalClass?: number | null;
  surface?: string | null;
  packWeightKg?: number | null;
  fatigueBefore?: number | null;
}

export interface RouteSegmentInput {
  segmentId: number;
  distanceM: number;
  gainM: number;
  lossM: number;
  technicalClass?: number | null;
}

export interface RoutePredictionInput {
  segments: RouteSegmentInput[];
  startAt: string;
  profile: PerformanceProfile | null;
  confidence: Confidence | null;
  packWeightKg?: number | null;
  turnaroundAfterS?: number | null;
  /** Flag `route_prediction_v2` transmis à `predictSegment` (défaut `true`). */
  flagEnabled?: boolean;
}

/** Prédiction de route sans `userId` : l'identité est ajoutée par le serveur. */
export type LearnedRoutePrediction = Omit<RoutePrediction, 'userId'>;

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Facteur d'incertitude P90/P50 : 1.05 à confiance 1, +0.35 à confiance 0. */
function uncertaintyFactor(score: number): number {
  return BASE_UNCERTAINTY_FACTOR + UNCERTAINTY_PER_MISSING_CONFIDENCE * (1 - clamp01(score));
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function buildFactors(
  input: SegmentPredictionInput,
  confidence: Confidence,
  effortScore: number
): PredictionFactor[] {
  const distanceKm = Math.max(0, input.distanceM) / 1000;
  const gainPerKm = distanceKm > 0 ? Math.max(0, input.gainM) / distanceKm : 0;
  const technicalClass = input.technicalClass ?? 0;
  const packWeightKg = input.packWeightKg ?? 0;
  const fatigueBefore = input.fatigueBefore ?? 0;

  return [
    {
      code: 'slope',
      label: 'Pente',
      impact: gainPerKm > 0 ? 'increase' : 'neutral',
      weight: clamp01(gainPerKm / 500),
    },
    {
      code: 'technical',
      label: 'Technicité',
      impact: technicalClass >= 3 ? 'increase' : 'neutral',
      weight: clamp01(technicalClass / 5),
    },
    {
      code: 'pack',
      label: 'Portage',
      impact: packWeightKg >= 5 ? 'increase' : 'neutral',
      weight: clamp01(packWeightKg / 20),
    },
    {
      code: 'fatigue',
      label: 'Fatigue',
      impact: fatigueBefore > 0 || effortScore >= 50 ? 'increase' : 'neutral',
      weight: clamp01(fatigueBefore / 100),
    },
    {
      code: 'confidence',
      label: 'Confiance',
      impact: confidence.score < 0.5 ? 'increase' : 'neutral',
      weight: clamp01(1 - confidence.score),
    },
  ];
}

/**
 * Prédit un segment : durée P50/P90, fourchette d'allure, effort, difficulté
 * personnelle, pause recommandée et facteurs explicables.
 *
 * `options.flagEnabled` transmet le flag `route_prediction_v2` (défaut `true`,
 * rétrocompatible) : désactivé, `resolvePace` interdit la source `profile` et
 * retombe sur la cascade sûre générique/standard.
 */
export function predictSegment(
  input: SegmentPredictionInput,
  profile: PerformanceProfile | null,
  confidence: Confidence | null,
  options?: { pace?: ResolvedPace; flagEnabled?: boolean }
): SegmentPrediction {
  const pace =
    options?.pace ??
    resolvePace({
      distanceM: input.distanceM,
      gainM: input.gainM,
      lossM: input.lossM,
      surface: input.surface,
      profile,
      confidence,
      flagEnabled: options?.flagEnabled ?? true,
    });
  const effectiveConfidence = pace.confidence;

  const distanceKm = Math.max(0, input.distanceM) / 1000;
  const durationP50Seconds = Math.max(1, Math.round(distanceKm * pace.paceMinPerKm * 60));
  const uncertainty = uncertaintyFactor(effectiveConfidence.score);
  const durationP90Seconds = Math.max(
    durationP50Seconds,
    Math.round(durationP50Seconds * uncertainty)
  );

  const fatigueBefore = input.fatigueBefore != null ? clampNumber(input.fatigueBefore, 0, 100) : null;
  const fatigue = computeFatigue({
    activeDurationS: durationP50Seconds,
    gainM: input.gainM,
    lossM: input.lossM,
    technicalClass: input.technicalClass ?? null,
    packWeightKg: input.packWeightKg ?? null,
    declaredFatigue: fatigueBefore != null ? fatigueBefore / 10 : null,
  });
  const effortScore = clampNumber(Math.round(fatigue.score), 0, 100);

  const slopeIntensity = distanceKm > 0 ? Math.min(20, Math.max(0, input.gainM) / distanceKm / 50) : 0;
  const technicalContribution = Math.min(15, Math.max(0, input.technicalClass ?? 0) * 3);
  const personalDifficulty = clampNumber(
    Math.round(effortScore * 0.7 + slopeIntensity + technicalContribution),
    0,
    100
  );

  const pauseModel = profile?.pauseModel ?? GENERIC_PAUSE_MODEL;
  const pauseMinutes =
    pauseModel.minPauseMinutes +
    pauseModel.pauseMinutesPerHour * (durationP50Seconds / 3600) +
    pauseModel.pauseMinutesPerAscentM * Math.max(0, input.gainM);
  const recommendedPauseSeconds = Math.max(0, Math.round(pauseMinutes * 60));

  return {
    segmentId: input.segmentId,
    durationP50Seconds,
    durationP90Seconds,
    paceRangeMinPerKm: [round3(pace.paceMinPerKm), round3(pace.paceMinPerKm * uncertainty)],
    effortScore,
    personalDifficulty,
    recommendedPauseSeconds,
    confidence: effectiveConfidence,
    factors: buildFactors(input, effectiveConfidence, effortScore),
  };
}

/**
 * Prédit une route complète pour une stratégie : P50/P90, ETA, pauses,
 * fatigue max, heure de demi-tour et segments critiques (top 3 difficulté).
 */
export function predictRoute(
  input: RoutePredictionInput,
  strategy: RouteStrategy
): LearnedRoutePrediction {
  const parsedStartMs = Date.parse(input.startAt);
  const startMs = Number.isFinite(parsedStartMs) ? parsedStartMs : Date.now();
  const speedFactor = STRATEGY_SPEED_FACTORS[strategy];
  const durationFactor = speedFactor > 0 ? 1 / speedFactor : 1;

  const effectiveConfidence = input.confidence ?? input.profile?.confidence ?? COLD_CONFIDENCE;
  const uncertainty = uncertaintyFactor(effectiveConfidence.score);

  let cumulativeFatigue = 0;
  let totalP50MovingSeconds = 0;
  let totalP90MovingSeconds = 0;
  let pausesSeconds = 0;
  let personalDifficultyWeighted = 0;
  let totalDistanceM = 0;
  let maxFatigue = 0;
  const difficulties: { segmentId: number; difficulty: number }[] = [];

  for (const segment of input.segments) {
    const segmentPrediction = predictSegment(
      {
        segmentId: segment.segmentId,
        distanceM: segment.distanceM,
        gainM: segment.gainM,
        lossM: segment.lossM,
        technicalClass: segment.technicalClass ?? null,
        packWeightKg: input.packWeightKg ?? null,
        fatigueBefore: cumulativeFatigue,
      },
      input.profile,
      effectiveConfidence,
      { flagEnabled: input.flagEnabled ?? true }
    );

    const fatigueMultiplier = 1 + FATIGUE_PACE_IMPACT * clamp01(cumulativeFatigue / 100);
    const p50Seconds = Math.max(
      1,
      Math.round(segmentPrediction.durationP50Seconds * fatigueMultiplier * durationFactor)
    );
    const p90Seconds = Math.max(
      p50Seconds,
      Math.round(segmentPrediction.durationP90Seconds * fatigueMultiplier * durationFactor)
    );

    totalP50MovingSeconds += p50Seconds;
    totalP90MovingSeconds += p90Seconds;
    pausesSeconds += segmentPrediction.recommendedPauseSeconds;
    totalDistanceM += Math.max(0, segment.distanceM);
    personalDifficultyWeighted +=
      segmentPrediction.personalDifficulty * Math.max(0, segment.distanceM);
    difficulties.push({
      segmentId: segment.segmentId,
      difficulty: segmentPrediction.personalDifficulty,
    });

    const fatigue = computeFatigue({
      activeDurationS: p50Seconds,
      gainM: segment.gainM,
      lossM: segment.lossM,
      technicalClass: segment.technicalClass ?? null,
      packWeightKg: input.packWeightKg ?? null,
      declaredFatigue: clamp01(cumulativeFatigue / 100) * 10,
    });
    cumulativeFatigue = fatigue.score;
    maxFatigue = Math.max(maxFatigue, cumulativeFatigue);
  }

  const totalDurationP50Seconds = Math.max(1, totalP50MovingSeconds + pausesSeconds);
  const totalDurationP90Seconds = Math.max(
    totalDurationP50Seconds,
    totalP90MovingSeconds + pausesSeconds
  );

  const totalDistanceKm = totalDistanceM / 1000;
  const movingPaceP50 = totalDistanceKm > 0 ? totalP50MovingSeconds / 60 / totalDistanceKm : 0;

  const warnings: EngineWarningSchema[] = [];
  if (input.profile == null || input.profile.calibrationLevel === 'cold') {
    warnings.push({
      code: 'cold_profile',
      message:
        'Profil froid — prédiction non personnalisée (allure générique ou standard appliquée).',
      severity: 'info',
    });
  }
  if (effectiveConfidence.score < 0.5) {
    warnings.push({
      code: 'low_confidence',
      message: 'Confiance faible — fourchette P50–P90 élargie.',
      severity: 'warning',
    });
  }

  const criticalSegmentIds = [...difficulties]
    .sort((a, b) => b.difficulty - a.difficulty)
    .slice(0, 3)
    .map((entry) => entry.segmentId);

  return {
    strategy,
    etaP50: new Date(startMs + totalDurationP50Seconds * 1000).toISOString(),
    etaP90: new Date(startMs + totalDurationP90Seconds * 1000).toISOString(),
    totalDurationP50Seconds,
    totalDurationP90Seconds,
    paceP25MinPerKm: round3(movingPaceP50 / uncertainty),
    paceP50MinPerKm: round3(movingPaceP50),
    paceP75MinPerKm: round3(movingPaceP50 * uncertainty),
    pausesSeconds,
    personalDifficulty:
      totalDistanceM > 0 ? Math.round(personalDifficultyWeighted / totalDistanceM) : 0,
    maxFatigue: Math.round(maxFatigue),
    turnaroundTime:
      input.turnaroundAfterS != null
        ? new Date(startMs + Math.max(0, input.turnaroundAfterS) * 1000).toISOString()
        : undefined,
    criticalSegmentIds,
    warnings,
    confidence: effectiveConfidence,
    modelVersion: PERFORMANCE_PROFILE_MODEL_VERSION,
    computedAt: new Date().toISOString(),
  };
}
