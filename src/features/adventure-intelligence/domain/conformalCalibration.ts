/**
 * LOT P6 — Calibration conforme asymétrique par case (moteur pur).
 *
 * Remplace le facteur fixe `BASE_UNCERTAINTY_FACTOR = 1.05` par des quantiles
 * conformes asymétriques `[qLow, qHigh]` calculés par case :
 *   `dataLevel ("socle" | "cardio" | "complet") × historyBucket ("0" | "1-4" | "5-19" | "20+") × routeType`
 * avec repli hiérarchique propre lorsque l'effectif d'une case est insuffisant.
 *
 * Garantie finie (Split Conformal Prediction) :
 * - Borne supérieure P90 : couverture nominale 90 % (`alphaHigh = 0.10`, cible >= 0.85 et ±3 pts du nominal).
 * - Intervalle bilatéral [P10, P90] : couverture nominale 80 % (`alphaLow = 0.10`, `alphaHigh = 0.10`).
 *
 * Domaine pur : zéro I/O, 100 % déterministe.
 */
import type { DataLevel, EffortQuantileInterval } from '../schemas/effort.schema';

export type HistoryBucket = '0' | '1-4' | '5-19' | '20+';
export type RouteTypeBucket = 'flat' | 'mountain' | 'alpine' | 'winter' | 'technical' | string;

export interface ConformalCellKey {
  dataLevel: DataLevel;
  historyBucket: HistoryBucket;
  routeType: RouteTypeBucket;
}

export interface ConformalCalibrationSample extends ConformalCellKey {
  /** Valeur prédite (ex. score IEA/ERP 0..100 ou durée). */
  predicted: number;
  /** Valeur réellement observée. */
  observed: number;
}

export interface ConformalQuantileCell {
  key: string;
  sampleCount: number;
  /** Quantile inférieur signé (négatif ou nul pour P10 = pred + qLow). */
  qLow: number;
  /** Quantile supérieur signé (positif ou nul pour P90 = pred + qHigh). */
  qHigh: number;
  fallbackLevel: 'exact' | 'dataLevel_history' | 'dataLevel' | 'global';
}

export interface ConformalCalibrator {
  alphaLow: number;
  alphaHigh: number;
  nominalP90Coverage: number;
  nominalIntervalCoverage: number;
  minCellSamples: number;
  cells: Record<string, ConformalQuantileCell>;
  globalCell: ConformalQuantileCell;
}

export interface ConformalCalibrationOptions {
  /** Niveau de risque queue basse (défaut 0.10 -> P10). */
  alphaLow?: number;
  /** Niveau de risque queue haute (défaut 0.10 -> P90, couverture nominale 90 %). */
  alphaHigh?: number;
  /** Effectif minimal d'une case avant repli hiérarchique (défaut 12). */
  minCellSamples?: number;
}

export interface ConformalCoverageReport {
  sampleCount: number;
  p90Coverage: number;
  intervalCoverage: number;
  nominalP90Coverage: number;
  nominalIntervalCoverage: number;
  p90DeviationPts: number;
  intervalDeviationPts: number;
  meetsP90Target: boolean;
  withinNominalBand: boolean;
  meanIntervalWidth: number;
  byDataLevel: Record<
    DataLevel,
    { sampleCount: number; p90Coverage: number; intervalCoverage: number; meanWidth: number }
  >;
}

/** Facteur historique remplacé par la calibration conforme asymétrique P6. */
export const LEGACY_BASE_UNCERTAINTY_FACTOR = 1.05;

/** Cibles normatives Lot P6 : couverture P90 >= 0.85 et écart <= 3 pts (0.03) du nominal. */
export const CONFORMAL_MIN_P90_COVERAGE = 0.85;
export const CONFORMAL_MAX_NOMINAL_DEVIATION_PTS = 3.0;

export function historyBucketFromCount(sessionCount: number): HistoryBucket {
  const n = Number.isFinite(sessionCount) ? Math.max(0, Math.trunc(sessionCount)) : 0;
  if (n === 0) return '0';
  if (n <= 4) return '1-4';
  if (n <= 19) return '5-19';
  return '20+';
}

function makeKey(dataLevel: string, historyBucket: string, routeType: string): string {
  return `${dataLevel}|${historyBucket}|${routeType}`;
}

/**
 * Quantile conforme en échantillon fini :
 * - Pour la borne supérieure (1 - alphaHigh) : rang ceil((n + 1) * (1 - alphaHigh))
 * - Pour la borne inférieure (alphaLow) : rang floor((n + 1) * alphaLow)
 */
function finiteSampleConformalQuantiles(
  residuals: number[],
  alphaLow: number,
  alphaHigh: number
): { qLow: number; qHigh: number } {
  if (residuals.length === 0) {
    return { qLow: -5, qHigh: 5 };
  }
  const sorted = [...residuals].sort((a, b) => a - b);
  const n = sorted.length;

  const interpAt = (pos: number): number => {
    const clamped = Math.min(n - 1, Math.max(0, pos));
    const lo = Math.floor(clamped);
    const hi = Math.min(n - 1, lo + 1);
    const frac = clamped - lo;
    return sorted[lo] * (1 - frac) + sorted[hi] * frac;
  };

  const hiPos = (n + 1) * (1 - alphaHigh) - 1;
  const loPos = (n + 1) * alphaLow - 1;

  const qLow = Math.min(0, interpAt(loPos));
  const qHigh = Math.max(0, interpAt(hiPos));
  return { qLow, qHigh };
}

/**
 * Ajuste un calibrateur conforme asymétrique par case
 * (`dataLevel × historyBucket × routeType`) avec repli hiérarchique automatique.
 */
export function fitConformalCalibrator(
  samples: ReadonlyArray<ConformalCalibrationSample>,
  options: ConformalCalibrationOptions = {}
): ConformalCalibrator {
  const alphaLow = options.alphaLow ?? 0.10;
  const alphaHigh = options.alphaHigh ?? 0.10;
  const minCellSamples = Math.max(3, Math.trunc(options.minCellSamples ?? 12));

  const globalResiduals: number[] = [];
  const byExact = new Map<string, number[]>();
  const byLevelHistory = new Map<string, number[]>();
  const byLevel = new Map<string, number[]>();

  for (const s of samples) {
    if (!Number.isFinite(s.predicted) || !Number.isFinite(s.observed)) continue;
    const residual = s.observed - s.predicted;
    globalResiduals.push(residual);

    const kExact = makeKey(s.dataLevel, s.historyBucket, s.routeType);
    const kLH = makeKey(s.dataLevel, s.historyBucket, '*');
    const kL = makeKey(s.dataLevel, '*', '*');

    (byExact.get(kExact) ?? (byExact.set(kExact, []), byExact.get(kExact)!)).push(residual);
    (byLevelHistory.get(kLH) ?? (byLevelHistory.set(kLH, []), byLevelHistory.get(kLH)!)).push(
      residual
    );
    (byLevel.get(kL) ?? (byLevel.set(kL, []), byLevel.get(kL)!)).push(residual);
  }

  const globalQ = finiteSampleConformalQuantiles(globalResiduals, alphaLow, alphaHigh);
  const globalCell: ConformalQuantileCell = {
    key: makeKey('*', '*', '*'),
    sampleCount: globalResiduals.length,
    qLow: globalQ.qLow,
    qHigh: globalQ.qHigh,
    fallbackLevel: 'global',
  };

  const cells: Record<string, ConformalQuantileCell> = {};

  for (const [key, res] of byLevel.entries()) {
    if (res.length >= minCellSamples) {
      const q = finiteSampleConformalQuantiles(res, alphaLow, alphaHigh);
      cells[key] = {
        key,
        sampleCount: res.length,
        qLow: q.qLow,
        qHigh: q.qHigh,
        fallbackLevel: 'dataLevel',
      };
    }
  }

  for (const [key, res] of byLevelHistory.entries()) {
    if (res.length >= minCellSamples) {
      const q = finiteSampleConformalQuantiles(res, alphaLow, alphaHigh);
      cells[key] = {
        key,
        sampleCount: res.length,
        qLow: q.qLow,
        qHigh: q.qHigh,
        fallbackLevel: 'dataLevel_history',
      };
    }
  }

  for (const [key, res] of byExact.entries()) {
    if (res.length >= minCellSamples) {
      const q = finiteSampleConformalQuantiles(res, alphaLow, alphaHigh);
      cells[key] = {
        key,
        sampleCount: res.length,
        qLow: q.qLow,
        qHigh: q.qHigh,
        fallbackLevel: 'exact',
      };
    }
  }

  return {
    alphaLow,
    alphaHigh,
    nominalP90Coverage: Number((1 - alphaHigh).toFixed(4)),
    nominalIntervalCoverage: Number((1 - alphaLow - alphaHigh).toFixed(4)),
    minCellSamples,
    cells,
    globalCell,
  };
}

/** Résout la case conforme par hiérarchie : exact → dataLevel×history → dataLevel → global. */
export function resolveConformalCell(
  calibrator: ConformalCalibrator,
  cell: ConformalCellKey
): ConformalQuantileCell {
  const kExact = makeKey(cell.dataLevel, cell.historyBucket, cell.routeType);
  if (calibrator.cells[kExact]) return calibrator.cells[kExact];

  const kLH = makeKey(cell.dataLevel, cell.historyBucket, '*');
  if (calibrator.cells[kLH]) return calibrator.cells[kLH];

  const kL = makeKey(cell.dataLevel, '*', '*');
  if (calibrator.cells[kL]) return calibrator.cells[kL];

  return calibrator.globalCell;
}

/**
 * Produit l'intervalle conforme asymétrique `[p10, p50, p90]` borné dans `[minBound, maxBound]`.
 */
export function predictConformalInterval(
  calibrator: ConformalCalibrator,
  predicted: number,
  cell: ConformalCellKey,
  bounds: { min?: number; max?: number } = { min: 0, max: 100 }
): { interval: EffortQuantileInterval; cellUsed: ConformalQuantileCell } {
  const minVal = bounds.min ?? 0;
  const maxVal = bounds.max ?? 100;
  const cellUsed = resolveConformalCell(calibrator, cell);

  const p50 = Math.min(maxVal, Math.max(minVal, predicted));
  const p10 = Math.min(p50, Math.max(minVal, predicted + cellUsed.qLow));
  const p90 = Math.max(p50, Math.min(maxVal, predicted + cellUsed.qHigh));

  return {
    interval: { p10, p50, p90 },
    cellUsed,
  };
}

/**
 * Évalue la couverture empirique P90 et bilatérale `[P10, P90]` sur un jeu d'évaluation
 * disjoint (sans fuite) et vérifie les seuils P6 (`>= 0.85` et `±3 pts` du nominal).
 */
export function evaluateConformalCoverage(
  calibrator: ConformalCalibrator,
  evalSamples: ReadonlyArray<ConformalCalibrationSample>,
  bounds: { min?: number; max?: number } = { min: 0, max: 100 }
): ConformalCoverageReport {
  let coveredP90 = 0;
  let coveredInterval = 0;
  let widthSum = 0;

  const perLevel: Record<
    DataLevel,
    { n: number; c90: number; cInt: number; wSum: number }
  > = {
    socle: { n: 0, c90: 0, cInt: 0, wSum: 0 },
    cardio: { n: 0, c90: 0, cInt: 0, wSum: 0 },
    complet: { n: 0, c90: 0, cInt: 0, wSum: 0 },
  };

  for (const s of evalSamples) {
    const { interval } = predictConformalInterval(calibrator, s.predicted, s, bounds);
    const hit90 = s.observed <= interval.p90;
    const hitInt = s.observed >= interval.p10 && s.observed <= interval.p90;
    const width = interval.p90 - interval.p10;

    if (hit90) coveredP90 += 1;
    if (hitInt) coveredInterval += 1;
    widthSum += width;

    const st = perLevel[s.dataLevel];
    st.n += 1;
    if (hit90) st.c90 += 1;
    if (hitInt) st.cInt += 1;
    st.wSum += width;
  }

  const n = evalSamples.length;
  const p90Coverage = n > 0 ? Number((coveredP90 / n).toFixed(4)) : 0;
  const intervalCoverage = n > 0 ? Number((coveredInterval / n).toFixed(4)) : 0;
  const p90DeviationPts = Number((Math.abs(p90Coverage - calibrator.nominalP90Coverage) * 100).toFixed(2));
  const intervalDeviationPts = Number(
    (Math.abs(intervalCoverage - calibrator.nominalIntervalCoverage) * 100).toFixed(2)
  );

  return {
    sampleCount: n,
    p90Coverage,
    intervalCoverage,
    nominalP90Coverage: calibrator.nominalP90Coverage,
    nominalIntervalCoverage: calibrator.nominalIntervalCoverage,
    p90DeviationPts,
    intervalDeviationPts,
    meetsP90Target: p90Coverage >= CONFORMAL_MIN_P90_COVERAGE,
    withinNominalBand:
      p90DeviationPts <= CONFORMAL_MAX_NOMINAL_DEVIATION_PTS &&
      intervalDeviationPts <= CONFORMAL_MAX_NOMINAL_DEVIATION_PTS,
    meanIntervalWidth: n > 0 ? Number((widthSum / n).toFixed(2)) : 0,
    byDataLevel: {
      socle: {
        sampleCount: perLevel.socle.n,
        p90Coverage: perLevel.socle.n > 0 ? Number((perLevel.socle.c90 / perLevel.socle.n).toFixed(4)) : 0,
        intervalCoverage:
          perLevel.socle.n > 0 ? Number((perLevel.socle.cInt / perLevel.socle.n).toFixed(4)) : 0,
        meanWidth:
          perLevel.socle.n > 0 ? Number((perLevel.socle.wSum / perLevel.socle.n).toFixed(2)) : 0,
      },
      cardio: {
        sampleCount: perLevel.cardio.n,
        p90Coverage:
          perLevel.cardio.n > 0 ? Number((perLevel.cardio.c90 / perLevel.cardio.n).toFixed(4)) : 0,
        intervalCoverage:
          perLevel.cardio.n > 0 ? Number((perLevel.cardio.cInt / perLevel.cardio.n).toFixed(4)) : 0,
        meanWidth:
          perLevel.cardio.n > 0 ? Number((perLevel.cardio.wSum / perLevel.cardio.n).toFixed(2)) : 0,
      },
      complet: {
        sampleCount: perLevel.complet.n,
        p90Coverage:
          perLevel.complet.n > 0 ? Number((perLevel.complet.c90 / perLevel.complet.n).toFixed(4)) : 0,
        intervalCoverage:
          perLevel.complet.n > 0 ? Number((perLevel.complet.cInt / perLevel.complet.n).toFixed(4)) : 0,
        meanWidth:
          perLevel.complet.n > 0 ? Number((perLevel.complet.wSum / perLevel.complet.n).toFixed(2)) : 0,
      },
    },
  };
}
