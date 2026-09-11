import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ANOMALY_THRESHOLD_PCT,
  P90_COVERAGE_TARGET,
  residualAnomalies,
  runBacktest,
  type BacktestSample,
} from '@/features/adventure-intelligence/domain/backtesting';

function sample(overrides: Partial<BacktestSample> = {}): BacktestSample {
  return {
    predictedP50Seconds: 1000,
    predictedP90Seconds: 1200,
    actualSeconds: 1000,
    predictedDifficulty: null,
    feltDifficulty: null,
    ...overrides,
  };
}

describe('A9 — backtesting des prédictions (TEST-A9-BT)', () => {
  it('TEST-A9-BT-01: la MAE médiane, moyenne et P90 mesurent l’erreur sans les paires de difficulté nulles', () => {
    const metrics = runBacktest([
      sample({ actualSeconds: 1000, predictedDifficulty: 2, feltDifficulty: 2 }),
      sample({ actualSeconds: 1100, predictedDifficulty: 3, feltDifficulty: null }),
      sample({ actualSeconds: 800, predictedDifficulty: null, feltDifficulty: 4 }),
      sample({ actualSeconds: 1200, predictedDifficulty: 4, feltDifficulty: 6 }),
    ]);

    expect(metrics.sampleCount).toBe(4);
    expect(metrics.medianAbsErrorPct).toBeCloseTo(15, 5);
    expect(metrics.meanAbsErrorPct).toBeCloseTo(12.5, 5);
    expect(metrics.p90ErrorPct).toBeCloseTo(20, 5);
    expect(metrics.difficultyMae).toBeCloseTo(1, 5);
  });

  it('TEST-A9-BT-02: la couverture P90 est la part des sorties réelles sous le P90 prédit', () => {
    const underCovered = runBacktest([
      sample({ predictedP90Seconds: 1100, actualSeconds: 1000 }),
      sample({ predictedP90Seconds: 1100, actualSeconds: 1100 }),
      sample({ predictedP90Seconds: 1100, actualSeconds: 800 }),
      sample({ predictedP90Seconds: 1100, actualSeconds: 1250 }),
    ]);

    expect(underCovered.p90Coverage).toBeCloseTo(0.75, 5);
    expect(underCovered.p90Coverage).toBeLessThan(P90_COVERAGE_TARGET);

    const covered = runBacktest([
      sample({ predictedP90Seconds: 1300, actualSeconds: 1250 }),
      sample({ predictedP90Seconds: 1300, actualSeconds: 900 }),
      sample({ predictedP90Seconds: 1300, actualSeconds: 1300 }),
    ]);

    expect(covered.p90Coverage).toBe(1);
    expect(covered.p90Coverage).toBeGreaterThanOrEqual(P90_COVERAGE_TARGET);
  });

  it('TEST-A9-BT-03: la dérive est agrégée par bucket de terrain, bucket null exclu', () => {
    const metrics = runBacktest([
      sample({ actualSeconds: 1100, terrainBucket: 'ascent' }),
      sample({ actualSeconds: 1300, terrainBucket: 'ascent' }),
      sample({ actualSeconds: 900, terrainBucket: 'flat' }),
      sample({ actualSeconds: 1000, terrainBucket: null }),
      sample({ actualSeconds: 1000, terrainBucket: 'technical' }),
      sample({ actualSeconds: 2000 }),
    ]);

    expect(metrics.driftByBucket).toEqual({ flat: -10, ascent: 20, technical: 0 });
    expect(Object.keys(metrics.driftByBucket)).toHaveLength(3);
  });

  it('TEST-A9-BT-04: les anomalies résiduelles listent les écarts au-delà du seuil', () => {
    const samples = [
      sample({ actualSeconds: 1500 }),
      sample({ actualSeconds: 1050 }),
      sample({ actualSeconds: 650 }),
    ];

    const anomalies = residualAnomalies(samples, 25);
    expect(anomalies.map((entry) => entry.index)).toEqual([0, 2]);
    expect(anomalies[0].errorPct).toBeCloseTo(50, 5);
    expect(anomalies[1].errorPct).toBeCloseTo(-35, 5);
    expect(anomalies[0].reason).toContain('sous-estimation');
    expect(anomalies[1].reason).toContain('surestimation');
    for (const anomaly of anomalies) {
      expect(anomaly.reason.trim().length).toBeGreaterThan(0);
      expect(anomaly.reason).toContain('25');
    }

    const strict = residualAnomalies(samples, 40);
    expect(strict.map((entry) => entry.index)).toEqual([0]);

    expect(DEFAULT_ANOMALY_THRESHOLD_PCT).toBe(30);
    const withDefault = residualAnomalies(samples);
    expect(withDefault.map((entry) => entry.index)).toEqual([0, 2]);
  });

  it('TEST-A9-BT-05: un échantillon vide retourne des métriques nulles sans NaN', () => {
    const metrics = runBacktest([]);

    expect(metrics.sampleCount).toBe(0);
    expect(metrics.medianAbsErrorPct).toBe(0);
    expect(metrics.meanAbsErrorPct).toBe(0);
    expect(metrics.p90ErrorPct).toBe(0);
    expect(metrics.p90Coverage).toBe(0);
    expect(metrics.difficultyMae).toBeNull();
    expect(metrics.driftByBucket).toEqual({});

    for (const value of [
      metrics.medianAbsErrorPct,
      metrics.meanAbsErrorPct,
      metrics.p90ErrorPct,
      metrics.p90Coverage,
    ]) {
      expect(Number.isNaN(value)).toBe(false);
    }

    expect(residualAnomalies([])).toEqual([]);

    const withoutDifficulties = runBacktest([sample(), sample()]);
    expect(withoutDifficulties.difficultyMae).toBeNull();
    expect(withoutDifficulties.sampleCount).toBe(2);
  });
});
