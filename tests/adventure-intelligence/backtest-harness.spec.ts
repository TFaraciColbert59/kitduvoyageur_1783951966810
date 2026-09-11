/**
 * A11 #35 — Harnais de backtesting réel (TEST-A11-BT-01..03).
 *
 * Le fixture d'échantillons réalistes doit passer le seuil de couverture P90
 * via le moteur pur `runBacktest` ; le rapport du script est vérifié sans
 * exécution du script (import pur, `main()` gardé).
 */
import { describe, it, expect } from 'vitest';
import fixture from '../../scripts/ai/fixtures/backtest-sample.json';
import {
  buildBacktestReport,
  evaluateBacktestExitCode,
  formatBacktestReportFr,
  parseBacktestArgs,
} from '../../scripts/ai/a11_backtest';
import {
  P90_COVERAGE_TARGET,
  TERRAIN_BUCKETS,
  residualAnomalies,
  runBacktest,
  type BacktestSample,
} from '@/features/adventure-intelligence/domain/backtesting';

const samples = fixture as BacktestSample[];

describe('A11 — harnais de backtesting (TEST-A11-BT)', () => {
  it('TEST-A11-BT-01: le fixture contient ≥ 40 échantillons réalistes couvrant les quatre buckets', () => {
    expect(Array.isArray(samples)).toBe(true);
    expect(samples.length).toBeGreaterThanOrEqual(40);

    const buckets = new Set(samples.map((sample) => sample.terrainBucket ?? null));
    for (const bucket of TERRAIN_BUCKETS) {
      expect(buckets.has(bucket)).toBe(true);
    }

    for (const sample of samples) {
      expect(Number.isFinite(sample.predictedP50Seconds)).toBe(true);
      expect(Number.isFinite(sample.predictedP90Seconds)).toBe(true);
      expect(Number.isFinite(sample.actualSeconds)).toBe(true);
      expect(sample.predictedP50Seconds).toBeGreaterThan(0);
      expect(sample.predictedP90Seconds).toBeGreaterThanOrEqual(sample.predictedP50Seconds);
      expect(sample.actualSeconds).toBeGreaterThan(0);
    }
  });

  it('TEST-A11-BT-02: le fixture passe la couverture P90 et le rapport est chiffré en français', () => {
    const metrics = runBacktest(samples);
    expect(metrics.p90Coverage).toBeGreaterThanOrEqual(P90_COVERAGE_TARGET);
    expect(metrics.medianAbsErrorPct).toBeGreaterThan(0);
    expect(Object.keys(metrics.driftByBucket).length).toBeGreaterThan(0);

    const report = buildBacktestReport(samples);
    expect(report.coverageMet).toBe(true);
    expect(evaluateBacktestExitCode(report)).toBe(0);

    const text = formatBacktestReportFr(report);
    for (const label of [
      'Échantillons',
      'MAE médiane',
      'Couverture P90',
      'Dérive par bucket',
      'Anomalies',
    ]) {
      expect(text).toContain(label);
    }
    expect(text).toContain(`${(metrics.p90Coverage * 100).toFixed(1)} %`);
  });

  it('TEST-A11-BT-03: seuil, entrée vide et anomalies produisent un code de sortie non nul', () => {
    const strict = buildBacktestReport(samples, 0.99);
    expect(strict.coverageMet).toBe(false);
    expect(evaluateBacktestExitCode(strict)).toBe(1);

    const empty = buildBacktestReport([], P90_COVERAGE_TARGET);
    expect(empty.metrics.sampleCount).toBe(0);
    expect(empty.coverageMet).toBe(false);
    expect(evaluateBacktestExitCode(empty)).toBe(1);

    const report = buildBacktestReport(samples);
    expect(report.anomalies).toEqual(residualAnomalies(samples));
    expect(report.anomalies.length).toBeGreaterThan(0);
    for (const anomaly of report.anomalies) {
      expect(anomaly.reason.trim().length).toBeGreaterThan(0);
      expect(Number.isFinite(anomaly.errorPct)).toBe(true);
    }

    const args = parseBacktestArgs(['fiche.json', '--min-coverage=0.9']);
    expect(args).toEqual({ samplesPath: 'fiche.json', minCoverage: 0.9 });
    expect(parseBacktestArgs([])).toEqual({ samplesPath: null, minCoverage: P90_COVERAGE_TARGET });
    expect(formatBacktestReportFr(buildBacktestReport(samples))).toBe(
      formatBacktestReportFr(buildBacktestReport(samples))
    );
  });
});
