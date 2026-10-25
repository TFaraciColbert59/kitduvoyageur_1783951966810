/**
 * A13 (S8) — Export de backtesting sur données réelles anonymisées
 * (TEST-A13-BT-01..03).
 *
 * Vérifie la logique pure du script d'export : pseudonymisation SHA-256 des
 * identifiants, projection stricte des champs (aucune position GPS, aucun nom,
 * aucun email, aucun identifiant brut), dérivation des échantillons prédit/réel
 * et sérialisation JSONL relue par le harnais `a11_backtest.ts`. Aucune donnée
 * n'est inventée : les lignes invalides sont comptées, jamais transformées.
 */
import { describe, it, expect } from 'vitest';
import {
  MIN_BACKTEST_SAMPLES,
  buildSamplesFromRows,
  deriveTerrainBucket,
  formatExportSummaryFr,
  hashAnonymousId,
  serializeSamplesJsonl,
} from '../../scripts/ai/a13_export_backtest.mjs';
import { parseSamplesFile } from '../../scripts/ai/a11_backtest';

const USER_ID = '2f8a2f8e-4d1c-4a6b-9f0e-7c3b5a1d2e4f';
const USER_ID_OTHER = '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
const SESSION_ID = '11111111-2222-4333-8444-555555555555';
const SESSION_ID_OTHER = '66666666-7777-4888-8999-000000000000';

/** SHA-256 hex connu (vecteur de test NIST pour « abc »). */
const SHA256_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

const SAMPLE_KEYS = [
  'actualSeconds',
  'feltDifficulty',
  'modelVersion',
  'predictedDifficulty',
  'predictedP50Seconds',
  'predictedP90Seconds',
  'sessionHash',
  'source',
  'terrainBucket',
  'userHash',
];

const EXPECTED_COUNTS_KEYS = [
  'minSamples',
  'routeRows',
  'routeSamples',
  'samples',
  'segmentRows',
  'segmentSamples',
  'skippedRouteRows',
  'skippedSegmentRows',
  'sufficient',
  'usersHashed',
];

function validRouteRow(overrides: Record<string, unknown> = {}) {
  return {
    user_id: USER_ID,
    session_id: SESSION_ID,
    strategy: 'recommended',
    total_duration_p50_s: 7200,
    total_duration_p90_s: 9000,
    personal_difficulty: 42,
    model_version: 'a13-v1',
    actual_seconds: 7800,
    ...overrides,
  };
}

function validSegmentRow(overrides: Record<string, unknown> = {}) {
  return {
    user_id: USER_ID,
    session_id: SESSION_ID,
    segment_id: 123,
    predicted_duration_p50: 600,
    predicted_duration_p90: 750,
    personal_difficulty: 55,
    model_version: 'a13-v1',
    actual_seconds: 660,
    gain_m: 120,
    loss_m: 5,
    sac_scale: 'hiking',
    surface: 'ground',
    ...overrides,
  };
}

describe('A13 (S8) — export backtesting anonymisé (TEST-A13-BT)', () => {
  it('TEST-A13-BT-01: pseudonymisation SHA-256 déterministe et projection sans PII', () => {
    expect(hashAnonymousId('abc')).toBe(SHA256_ABC);
    expect(hashAnonymousId('abc')).toHaveLength(64);
    expect(hashAnonymousId('abc', 'sel')).toBe(
      'c572967c109c6ade343e43a8b649a178ff987ddf7028353f1818e69d6b3ba612'
    );
    expect(hashAnonymousId('abc', 'sel')).not.toBe(hashAnonymousId('abc'));
    expect(hashAnonymousId('abc', 'sel')).toBe(hashAnonymousId('abc', 'sel'));
    expect(hashAnonymousId('')).toBeNull();
    expect(hashAnonymousId(null)).toBeNull();

    const { samples } = buildSamplesFromRows({
      routeRows: [
        validRouteRow(),
        validRouteRow({ session_id: SESSION_ID_OTHER, actual_seconds: 8100 }),
      ],
      segmentRows: [validSegmentRow()],
    });
    expect(samples).toHaveLength(3);
    expect(samples[0].userHash).toBe(samples[1].userHash);
    expect(samples[0].sessionHash).not.toBe(samples[1].sessionHash);

    const jsonl = serializeSamplesJsonl(samples);
    expect(jsonl).not.toContain(USER_ID);
    expect(jsonl).not.toContain(SESSION_ID);
    expect(jsonl.toLowerCase()).not.toContain('email');
    expect(jsonl.toLowerCase()).not.toContain('"lat"');
    expect(jsonl.toLowerCase()).not.toContain('"lng"');
    expect(jsonl.toLowerCase()).not.toContain('latitude');
    expect(jsonl.toLowerCase()).not.toContain('longitude');
    expect(jsonl.toLowerCase()).not.toContain('full_name');

    for (const sample of samples) {
      expect(Object.keys(sample).sort()).toEqual(SAMPLE_KEYS);
      expect(sample.userHash).toMatch(/^[0-9a-f]{64}$/);
      expect(sample.sessionHash).toMatch(/^[0-9a-f]{64}$/);
      expect(['route', 'segment']).toContain(sample.source);
    }
  });

  it('TEST-A13-BT-02: dérivation des échantillons route/segment et relecture JSONL par le harnais A11', () => {
    expect(deriveTerrainBucket({ gainM: 300, lossM: 0, sacScale: 'hiking' })).toBe('ascent');
    expect(deriveTerrainBucket({ gainM: 0, lossM: 300, sacScale: 'hiking' })).toBe('descent');
    expect(deriveTerrainBucket({ gainM: 10, lossM: 5, sacScale: 'hiking' })).toBe('flat');
    expect(deriveTerrainBucket({ gainM: 300, lossM: 0, sacScale: 'mountain_hiking' })).toBe(
      'technical'
    );
    expect(deriveTerrainBucket({ gainM: null, lossM: null, sacScale: null })).toBeNull();

    const { samples, counts } = buildSamplesFromRows({
      routeRows: [
        validRouteRow(),
        // Lignes invalides : jamais transformées, seulement comptées.
        validRouteRow({ total_duration_p50_s: 0 }),
        validRouteRow({ actual_seconds: null }),
      ],
      segmentRows: [validSegmentRow(), validSegmentRow({ predicted_duration_p90: null })],
    });

    expect(Object.keys(counts).sort()).toEqual(EXPECTED_COUNTS_KEYS);
    expect(counts.routeRows).toBe(3);
    expect(counts.segmentRows).toBe(2);
    expect(counts.routeSamples).toBe(1);
    expect(counts.segmentSamples).toBe(1);
    expect(counts.skippedRouteRows).toBe(2);
    expect(counts.skippedSegmentRows).toBe(1);
    expect(counts.samples).toBe(2);
    expect(counts.usersHashed).toBe(1);
    expect(counts.minSamples).toBe(MIN_BACKTEST_SAMPLES);
    expect(samples).toHaveLength(2);

    const routeSample = samples.find((sample) => sample.source === 'route');
    expect(routeSample).toMatchObject({
      predictedP50Seconds: 7200,
      predictedP90Seconds: 9000,
      actualSeconds: 7800,
      predictedDifficulty: 42,
      feltDifficulty: null,
      terrainBucket: null,
      modelVersion: 'a13-v1',
      source: 'route',
    });

    const segmentSample = samples.find((sample) => sample.source === 'segment');
    expect(segmentSample).toMatchObject({
      predictedP50Seconds: 600,
      predictedP90Seconds: 750,
      actualSeconds: 660,
      terrainBucket: 'ascent',
      source: 'segment',
    });

    // JSONL → relecture par le harnais A11 (une ligne = un BacktestSample).
    const jsonl = serializeSamplesJsonl(samples);
    expect(jsonl.endsWith('\n')).toBe(true);
    const reparsed = parseSamplesFile(jsonl);
    expect('error' in reparsed).toBe(false);
    if (!('error' in reparsed)) {
      expect(reparsed.samples).toHaveLength(2);
      for (const sample of reparsed.samples) {
        expect(Number.isFinite(sample.predictedP50Seconds)).toBe(true);
        expect(Number.isFinite(sample.predictedP90Seconds)).toBe(true);
        expect(Number.isFinite(sample.actualSeconds)).toBe(true);
      }
    }

    // Rétrocompatibilité : un tableau JSON reste accepté, un JSONL invalide est refusé.
    expect(parseSamplesFile(JSON.stringify(samples))).toEqual({ samples: samples as never });
    const invalidLine = parseSamplesFile('{"predictedP50Seconds":"oops"}\n');
    expect('error' in invalidLine).toBe(true);
  });

  it('TEST-A13-BT-03: sous 40 échantillons, l’insuffisance est explicite et rien n’est inventé', () => {
    const empty = buildSamplesFromRows({ routeRows: [], segmentRows: [] });
    expect(empty.samples).toEqual([]);
    expect(empty.counts.samples).toBe(0);
    expect(empty.counts.sufficient).toBe(false);

    const emptySummary = formatExportSummaryFr({ counts: empty.counts });
    expect(emptySummary).toContain('DONNÉES INSUFFISANTES');
    expect(emptySummary).toContain(String(MIN_BACKTEST_SAMPLES));
    expect(emptySummary).toContain('aucune donnée inventée');

    const below = buildSamplesFromRows({
      routeRows: Array.from({ length: MIN_BACKTEST_SAMPLES - 1 }, (_, index) =>
        validRouteRow({
          user_id: index % 2 === 0 ? USER_ID : USER_ID_OTHER,
          session_id: `session-${index}`,
          actual_seconds: 7000 + index,
        })
      ),
    });
    expect(below.counts.samples).toBe(MIN_BACKTEST_SAMPLES - 1);
    expect(below.counts.sufficient).toBe(false);
    expect(below.samples).toHaveLength(MIN_BACKTEST_SAMPLES - 1);

    const threshold = buildSamplesFromRows({
      routeRows: Array.from({ length: MIN_BACKTEST_SAMPLES }, (_, index) =>
        validRouteRow({
          user_id: index % 2 === 0 ? USER_ID : USER_ID_OTHER,
          session_id: `session-${index}`,
          actual_seconds: 7000 + index,
        })
      ),
    });
    expect(threshold.counts.samples).toBe(MIN_BACKTEST_SAMPLES);
    expect(threshold.counts.sufficient).toBe(true);
    expect(threshold.samples).toHaveLength(MIN_BACKTEST_SAMPLES);

    const summary = formatExportSummaryFr({
      counts: below.counts,
      outputPath: 'C:/tmp/export.jsonl',
      database: { routePredictions: 39, segmentPredictions: 0, hikeSessions: 12 },
      errors: [],
    });
    expect(summary).toContain('C:/tmp/export.jsonl');
    expect(summary).toContain('39');
    expect(summary).toContain('route_predictions');
  });
});
