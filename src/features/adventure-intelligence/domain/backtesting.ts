/**
 * A9 & Lot P6 — Backtesting des prédictions, étanchéité temporelle & ablations (moteur pur).
 *
 * A9 (rétrocompatible) :
 * - Confronte les prédictions P50/P90 aux durées réellement observées :
 *   MAE médiane/moyenne, P90 des erreurs absolues, couverture P90 (cible >= 0.85),
 *   MAE de difficulté et dérive signée par bucket de terrain.
 *
 * Extension Lot P6 :
 * - Étanchéité temporelle stricte (`assertNoSplitLeakage`) : vérifie qu'aucun
 *   utilisateur, itinéraire, groupe ni saison ne fuit entre calibration et évaluation.
 * - Évaluation séparée du pipeline **Prévision (`forecast`)** (météo prévue avant départ)
 *   et **Rétrospectif (`retrospective`)** (météo observée).
 * - Ablations automatisées (`runEffortAblations`) : `full` vs `no_weather`, `no_pack`,
 *   `no_fatigue`, `no_cardio` (MAE, RMSE, biais moyen, couverture P90).
 */
import type { DataLevel, EffortScoreInput } from '../schemas/effort.schema';
import { computeEffortScore } from './effortScore';

export type TerrainBucket = 'flat' | 'ascent' | 'descent' | 'technical';

export interface BacktestSample {
  predictedP50Seconds: number;
  predictedP90Seconds: number;
  actualSeconds: number;
  predictedDifficulty: number | null;
  feltDifficulty: number | null;
  terrainBucket?: TerrainBucket | null;
}

export interface BacktestMetrics {
  sampleCount: number;
  medianAbsErrorPct: number;
  meanAbsErrorPct: number;
  p90ErrorPct: number;
  p90Coverage: number;
  difficultyMae: number | null;
  driftByBucket: Record<string, number>;
}

export interface ResidualAnomaly {
  index: number;
  errorPct: number;
  reason: string;
}

/** Cible de calibration : au moins 85 % des sorties réelles sous le P90 prédit. */
export const P90_COVERAGE_TARGET = 0.85;
/** Seuil par défaut de `residualAnomalies`, en pourcentage d'écart absolu. */
export const DEFAULT_ANOMALY_THRESHOLD_PCT = 30;
/** Ordre canonique des buckets pour une sortie déterministe. */
export const TERRAIN_BUCKETS: readonly TerrainBucket[] = [
  'flat',
  'ascent',
  'descent',
  'technical',
];

function isUsableNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Percentile par rang le plus proche : `sorted[ceil(ratio × n) − 1]`. */
function percentileNearestRank(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(ratio * sorted.length);
  const index = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[index];
}

function signedErrorPct(sample: BacktestSample): number | null {
  if (!isUsableNumber(sample.predictedP50Seconds) || sample.predictedP50Seconds <= 0) return null;
  if (!isUsableNumber(sample.actualSeconds)) return null;
  return ((sample.actualSeconds - sample.predictedP50Seconds) / sample.predictedP50Seconds) * 100;
}

/**
 * Agrège un échantillon de prédictions confrontées au réel. Un échantillon vide
 * (ou sans écart exploitable) retourne des métriques à zéro, jamais `NaN` ;
 * `difficultyMae` vaut `null` tant qu'aucune paire de difficultés n'est complète.
 */
export function runBacktest(samples: BacktestSample[]): BacktestMetrics {
  const absoluteErrors: number[] = [];
  let covered = 0;
  let coverageEligible = 0;
  const bucketAggregates = new Map<TerrainBucket, { total: number; count: number }>();
  const difficultyErrors: number[] = [];

  for (const sample of samples) {
    const errorPct = signedErrorPct(sample);
    if (errorPct != null) absoluteErrors.push(Math.abs(errorPct));

    if (isUsableNumber(sample.predictedP90Seconds) && isUsableNumber(sample.actualSeconds)) {
      coverageEligible += 1;
      if (sample.actualSeconds <= sample.predictedP90Seconds) covered += 1;
    }

    if (sample.terrainBucket != null && errorPct != null) {
      const current = bucketAggregates.get(sample.terrainBucket) ?? { total: 0, count: 0 };
      current.total += errorPct;
      current.count += 1;
      bucketAggregates.set(sample.terrainBucket, current);
    }

    if (isUsableNumber(sample.predictedDifficulty) && isUsableNumber(sample.feltDifficulty)) {
      difficultyErrors.push(Math.abs(sample.predictedDifficulty - sample.feltDifficulty));
    }
  }

  const driftByBucket: Record<string, number> = {};
  for (const bucket of TERRAIN_BUCKETS) {
    const aggregate = bucketAggregates.get(bucket);
    if (aggregate != null && aggregate.count > 0) {
      driftByBucket[bucket] = round(aggregate.total / aggregate.count, 2);
    }
  }

  const meanAbsErrorPct =
    absoluteErrors.length > 0
      ? absoluteErrors.reduce((sum, value) => sum + value, 0) / absoluteErrors.length
      : 0;
  const difficultyMae =
    difficultyErrors.length > 0
      ? difficultyErrors.reduce((sum, value) => sum + value, 0) / difficultyErrors.length
      : null;

  return {
    sampleCount: samples.length,
    medianAbsErrorPct: round(median(absoluteErrors), 2),
    meanAbsErrorPct: round(meanAbsErrorPct, 2),
    p90ErrorPct: round(percentileNearestRank(absoluteErrors, 0.9), 2),
    p90Coverage: round(coverageEligible > 0 ? covered / coverageEligible : 0, 4),
    difficultyMae: difficultyMae != null ? round(difficultyMae, 2) : null,
    driftByBucket,
  };
}

/**
 * Liste les résidus dont l'écart absolu dépasse `thresholdPct` (30 % par
 * défaut), avec l'index d'entrée, l'erreur signée et une raison en français.
 */
export function residualAnomalies(
  samples: BacktestSample[],
  thresholdPct: number = DEFAULT_ANOMALY_THRESHOLD_PCT
): ResidualAnomaly[] {
  const threshold =
    Number.isFinite(thresholdPct) && thresholdPct >= 0
      ? thresholdPct
      : DEFAULT_ANOMALY_THRESHOLD_PCT;
  const anomalies: ResidualAnomaly[] = [];

  samples.forEach((sample, index) => {
    const errorPct = signedErrorPct(sample);
    if (errorPct == null || Math.abs(errorPct) <= threshold) return;

    const rounded = round(errorPct, 2);
    const direction = errorPct > 0 ? 'sous-estimation' : 'surestimation';
    anomalies.push({
      index,
      errorPct: rounded,
      reason: `Écart de ${rounded > 0 ? '+' : ''}${rounded} % — ${direction} de la durée réelle par rapport au P50 prédit (seuil ${threshold} %).`,
    });
  });

  return anomalies;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOT P6 — ÉTANCHÉITÉ TEMPORELLE (FORECAST vs RETROSPECTIVE) & ABLATIONS
// ─────────────────────────────────────────────────────────────────────────────

export type EvaluationPipelineKind = 'forecast' | 'retrospective';

export interface SplitEntityIdentity {
  userId: string;
  routeId: string;
  groupId?: string | null;
  season: string;
  occurredAt: string;
}

export interface SplitLeakageReport {
  isLeakFree: boolean;
  overlappingUsers: string[];
  overlappingRoutes: string[];
  overlappingGroups: string[];
  overlappingSeasons: string[];
  temporalOrderViolations: number;
}

/**
 * Contrôle strict d'étanchéité de split (Lot P6) :
 * Vérifie qu'aucun utilisateur, itinéraire, groupe ni saison ne chevauche
 * entre l'ensemble d'entraînement/calibration et l'ensemble d'évaluation,
 * et que l'évaluation est strictement postérieure ou temporellement étanche.
 */
export function assertNoSplitLeakage(
  calibrationSplit: ReadonlyArray<SplitEntityIdentity>,
  evaluationSplit: ReadonlyArray<SplitEntityIdentity>,
  options: { throwOnLeak?: boolean; requireStrictChronology?: boolean } = {}
): SplitLeakageReport {
  const calUsers = new Set(calibrationSplit.map((e) => e.userId));
  const calRoutes = new Set(calibrationSplit.map((e) => e.routeId));
  const calGroups = new Set(
    calibrationSplit.map((e) => e.groupId).filter((g): g is string => Boolean(g))
  );
  const calSeasons = new Set(calibrationSplit.map((e) => e.season));

  let maxCalMs = Number.NEGATIVE_INFINITY;
  for (const e of calibrationSplit) {
    const ms = Date.parse(e.occurredAt);
    if (Number.isFinite(ms) && ms > maxCalMs) maxCalMs = ms;
  }

  const overlappingUsers = new Set<string>();
  const overlappingRoutes = new Set<string>();
  const overlappingGroups = new Set<string>();
  const overlappingSeasons = new Set<string>();
  let temporalOrderViolations = 0;

  for (const e of evaluationSplit) {
    if (calUsers.has(e.userId)) overlappingUsers.add(e.userId);
    if (calRoutes.has(e.routeId)) overlappingRoutes.add(e.routeId);
    if (e.groupId && calGroups.has(e.groupId)) overlappingGroups.add(e.groupId);
    if (calSeasons.has(e.season)) overlappingSeasons.add(e.season);
    if (options.requireStrictChronology) {
      const evalMs = Date.parse(e.occurredAt);
      if (Number.isFinite(evalMs) && Number.isFinite(maxCalMs) && evalMs <= maxCalMs) {
        temporalOrderViolations += 1;
      }
    }
  }

  const report: SplitLeakageReport = {
    isLeakFree:
      overlappingUsers.size === 0 &&
      overlappingRoutes.size === 0 &&
      overlappingGroups.size === 0 &&
      overlappingSeasons.size === 0 &&
      temporalOrderViolations === 0,
    overlappingUsers: [...overlappingUsers],
    overlappingRoutes: [...overlappingRoutes],
    overlappingGroups: [...overlappingGroups],
    overlappingSeasons: [...overlappingSeasons],
    temporalOrderViolations,
  };

  if (options.throwOnLeak && !report.isLeakFree) {
    throw new Error(
      `Fuite de split détectée : users=${report.overlappingUsers.length}, routes=${report.overlappingRoutes.length}, groups=${report.overlappingGroups.length}, seasons=${report.overlappingSeasons.length}, chrono=${report.temporalOrderViolations}`
    );
  }

  return report;
}

export interface EffortBacktestRecord extends SplitEntityIdentity {
  pipeline: EvaluationPipelineKind;
  dataLevel: DataLevel;
  /** Entrée complète pour le moteur d'effort `effort-score-v1`. */
  input: EffortScoreInput;
  /** Score d'effort réel / référence observé (0..100). */
  observedScore: number;
}

export interface EffortScoreErrorMetrics {
  sampleCount: number;
  mae: number;
  rmse: number;
  meanBias: number;
  p90Coverage: number;
}

export interface TemporalEffortBacktestResult {
  forecast: EffortScoreErrorMetrics;
  retrospective: EffortScoreErrorMetrics;
}

function summarizeEffortErrors(
  pairs: ReadonlyArray<{ predicted: number; p90: number; observed: number }>
): EffortScoreErrorMetrics {
  if (pairs.length === 0) {
    return { sampleCount: 0, mae: 0, rmse: 0, meanBias: 0, p90Coverage: 0 };
  }
  let absSum = 0;
  let sqSum = 0;
  let biasSum = 0;
  let covered = 0;

  for (const p of pairs) {
    const err = p.predicted - p.observed;
    absSum += Math.abs(err);
    sqSum += err * err;
    biasSum += err;
    if (p.observed <= p.p90) covered += 1;
  }

  const n = pairs.length;
  return {
    sampleCount: n,
    mae: round(absSum / n, 3),
    rmse: round(Math.sqrt(sqSum / n), 3),
    meanBias: round(biasSum / n, 3),
    p90Coverage: round(covered / n, 4),
  };
}

/**
 * Évalue séparément les pipelines Prévision (`forecast`, météo prévue avant départ)
 * et Rétrospectif (`retrospective`, météo observée) sur `effort-score-v1`.
 */
export function evaluateTemporalEffortBacktest(
  records: ReadonlyArray<EffortBacktestRecord>
): TemporalEffortBacktestResult {
  const forecastPairs: { predicted: number; p90: number; observed: number }[] = [];
  const retroPairs: { predicted: number; p90: number; observed: number }[] = [];

  for (const rec of records) {
    const out = computeEffortScore(rec.input);
    const pair = {
      predicted: out.erp,
      p90: out.interval.p90,
      observed: rec.observedScore,
    };
    if (rec.pipeline === 'forecast') {
      forecastPairs.push(pair);
    } else {
      retroPairs.push(pair);
    }
  }

  return {
    forecast: summarizeEffortErrors(forecastPairs),
    retrospective: summarizeEffortErrors(retroPairs),
  };
}

export type EffortAblationVariant =
  | 'full'
  | 'no_weather'
  | 'no_pack'
  | 'no_fatigue'
  | 'no_cardio';

export interface EffortAblationReport {
  variants: Record<EffortAblationVariant, EffortScoreErrorMetrics>;
  deltaMaeVsFull: Record<Exclude<EffortAblationVariant, 'full'>, number>;
}

function buildAblatedInput(
  input: EffortScoreInput,
  variant: EffortAblationVariant
): EffortScoreInput {
  if (variant === 'full') return input;

  if (variant === 'no_weather') {
    return {
      ...input,
      weather: {
        tempC: 15,
        windMs: 0,
        humidityPct: 50,
        precipMmPerH: 0,
      },
      ground: {
        ...input.ground,
        snowSinkCm: 0,
        wetness: 0,
      },
      segments: input.segments.map((s) => ({ ...s, snowSinkCm: 0 })),
    };
  }

  if (variant === 'no_pack') {
    return {
      ...input,
      pack: {
        ...input.pack,
        packWeightKg: 0,
        footwearWeightKg: 0,
      },
    };
  }

  if (variant === 'no_fatigue') {
    return {
      ...input,
      observations: input.observations
        ? {
            ...input.observations,
            declaredFatigue: 0,
            recentLoadS: 0,
          }
        : undefined,
    };
  }

  // 'no_cardio' : masque la fréquence cardiaque observée et repasse en `socle`
  return {
    ...input,
    dataLevel: 'socle',
    observations: input.observations
      ? {
          ...input.observations,
          avgHeartRateBpm: undefined,
          maxHeartRateBpm: undefined,
          hrCoverageRatio: undefined,
        }
      : undefined,
  };
}

/**
 * Exécute les ablations automatisées sur `effort-score-v1` :
 * `full` vs `no_weather`, `no_pack`, `no_fatigue`, `no_cardio`
 * (MAE, RMSE, biais moyen, couverture P90).
 */
export function runEffortAblations(
  records: ReadonlyArray<{ input: EffortScoreInput; observedScore: number }>
): EffortAblationReport {
  const variantNames: EffortAblationVariant[] = [
    'full',
    'no_weather',
    'no_pack',
    'no_fatigue',
    'no_cardio',
  ];

  const variants = {} as Record<EffortAblationVariant, EffortScoreErrorMetrics>;

  for (const variant of variantNames) {
    const pairs = records.map((rec) => {
      const ablated = buildAblatedInput(rec.input, variant);
      const out = computeEffortScore(ablated);
      return {
        predicted: out.erp,
        p90: out.interval.p90,
        observed: rec.observedScore,
      };
    });
    variants[variant] = summarizeEffortErrors(pairs);
  }

  const fullMae = variants.full.mae;
  return {
    variants,
    deltaMaeVsFull: {
      no_weather: round(variants.no_weather.mae - fullMae, 3),
      no_pack: round(variants.no_pack.mae - fullMae, 3),
      no_fatigue: round(variants.no_fatigue.mae - fullMae, 3),
      no_cardio: round(variants.no_cardio.mae - fullMae, 3),
    },
  };
}
