/**
 * A9 — Backtesting des prédictions (moteur pur).
 *
 * Confronte les prédictions P50/P90 aux durées réellement observées :
 * erreur en pourcentage (`(réel − P50) / P50 × 100`, positive = sous-estimation),
 * MAE médiane/moyenne, P90 des erreurs absolues (rang le plus proche),
 * couverture P90 (part des sorties réelles ≤ P90 prédit, cible ≥ 0.85),
 * MAE de difficulté (paires complètes uniquement) et dérive signée par
 * bucket de terrain (moyenne, buckets `null` exclus).
 *
 * Aucune I/O, aucune écriture : uniquement des fonctions pures.
 */

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
