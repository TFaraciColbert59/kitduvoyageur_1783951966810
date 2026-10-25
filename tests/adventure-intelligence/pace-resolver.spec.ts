import { describe, it, expect } from 'vitest';
import {
  GENERIC_PACE_MIN_PER_KM,
  STANDARD_PACE_MIN_PER_KM,
  resolvePace,
} from '@/features/adventure-intelligence/domain/paceResolver';
import { computeFatigue } from '@/features/adventure-intelligence/domain/fatigue';
import { makeConfidence } from '@/features/adventure-intelligence/domain/confidence';
import { performanceProfileSchema, type PerformanceProfile } from '@/features/adventure-intelligence/schemas/performance.schema';

const USER_ID = '44444444-4444-4444-8444-444444444444';
const NOW = '2026-09-11T12:00:00.000Z';

function profile(overrides: Record<string, unknown> = {}): PerformanceProfile {
  return performanceProfileSchema.parse({
    userId: USER_ID,
    activityType: 'hiking',
    flatSpeedKmH: 4.5,
    ascentSpeedMPerHour: 400,
    descentSpeedMPerHour: 600,
    gradeResponse: { points: [{ x: 0, value: 1 }] },
    surfaceResponse: { points: [{ x: 0, value: 1 }] },
    fatigueCurve: { points: [{ x: 0, value: 1 }] },
    pauseModel: { pauseMinutesPerHour: 0 },
    packResponse: { points: [{ x: 0, value: 1 }] },
    confidence: makeConfidence({ score: 0.8, sampleCount: 30, method: 'test' }),
    sampleCount: 30,
    calibrationLevel: 'personalization',
    modelVersion: 'a3-v1',
    computedAt: NOW,
    ...overrides,
  });
}

const flatInput = {
  distanceM: 10000,
  gainM: 0,
  lossM: 0,
  profile: null,
  confidence: null,
  flagEnabled: true,
};

describe('Cascade d’allure — TEST-A3-PACE', () => {
  it('TEST-A3-PACE-01: profil chaud + flag actif ⇒ source profile personnalisée', () => {
    const warm = profile({ flatSpeedKmH: 4.5 });
    const resolved = resolvePace({ ...flatInput, profile: warm });

    expect(resolved.source).toBe('profile');
    expect(resolved.personalized).toBe(true);
    expect(resolved.paceMinPerKm).toBeCloseTo(60 / 4.5, 2);
    expect(resolved.confidence).toEqual(warm.confidence);
  });

  it('TEST-A3-PACE-02: profil froid ⇒ générique explicitement non personnalisé', () => {
    const cold = profile({
      calibrationLevel: 'cold',
      sampleCount: 1,
      confidence: makeConfidence({ score: 0, sampleCount: 1, method: 'weighted_median_a3' }),
    });
    const resolved = resolvePace({ ...flatInput, profile: cold });

    expect(resolved.source).toBe('generic');
    expect(resolved.personalized).toBe(false);
    expect(resolved.paceMinPerKm).toBeCloseTo(GENERIC_PACE_MIN_PER_KM, 5);
  });

  it('TEST-A3-PACE-03: profil absent ⇒ standard 15 min/km', () => {
    const resolved = resolvePace({ ...flatInput, profile: null });

    expect(resolved.source).toBe('standard');
    expect(resolved.personalized).toBe(false);
    expect(resolved.paceMinPerKm).toBeCloseTo(STANDARD_PACE_MIN_PER_KM, 5);
    expect(resolved.confidence.score).toBe(0);
    expect(STANDARD_PACE_MIN_PER_KM).toBe(15);
    expect(GENERIC_PACE_MIN_PER_KM).toBe(13.5);
  });

  it('TEST-A3-PACE-04: flag désactivé ⇒ jamais personnalisé (générique si données, sinon standard)', () => {
    const warm = profile();
    const withData = resolvePace({ ...flatInput, profile: warm, flagEnabled: false });
    expect(withData.source).toBe('generic');
    expect(withData.personalized).toBe(false);

    const withoutData = resolvePace({ ...flatInput, profile: null, flagEnabled: false });
    expect(withoutData.source).toBe('standard');
    expect(withoutData.personalized).toBe(false);
  });

  it('TEST-A3-PACE-05: confiance faible propagée ⇒ repli générique sans personnalisation', () => {
    const warm = profile();
    const low = makeConfidence({ score: 0.3, sampleCount: 30, method: 'test' });
    const resolved = resolvePace({ ...flatInput, profile: warm, confidence: low });

    expect(resolved.source).toBe('generic');
    expect(resolved.personalized).toBe(false);
    expect(resolved.confidence).toBe(low);

    const high = makeConfidence({ score: 0.6, sampleCount: 30, method: 'test' });
    const personalized = resolvePace({ ...flatInput, profile: warm, confidence: high });
    expect(personalized.source).toBe('profile');
    expect(personalized.confidence).toBe(high);
  });

  it('TEST-A3-PACE-06: plus de D+ ⇒ allure et temps jamais inférieurs', () => {
    const warm = profile({ flatSpeedKmH: 4.5 });
    const flat = resolvePace({ ...flatInput, profile: warm });
    const hilly = resolvePace({ ...flatInput, gainM: 1000, profile: warm });
    const genericHilly = resolvePace({
      ...flatInput,
      gainM: 1000,
      profile: profile({ calibrationLevel: 'cold' }),
    });

    expect(hilly.paceMinPerKm).toBeGreaterThan(flat.paceMinPerKm);
    expect(hilly.paceMinPerKm).toBeCloseTo(60 / 4.5 + 1, 2);
    expect(hilly.paceMinPerKm * 10).toBeGreaterThan(flat.paceMinPerKm * 10);
    expect(genericHilly.paceMinPerKm).toBeCloseTo(GENERIC_PACE_MIN_PER_KM + 0.8, 2);
  });

  it('TEST-A3-PACE-07: descente technique majorée, source et confiance explicites', () => {
    const warm = profile({ flatSpeedKmH: 4.5 });
    const nonTechnical = resolvePace({ ...flatInput, lossM: 500, surface: 'gravel', profile: warm });
    const technical = resolvePace({ ...flatInput, lossM: 500, surface: 'scree', profile: warm });

    expect(technical.paceMinPerKm).toBeCloseTo(nonTechnical.paceMinPerKm + 0.4, 2);
    expect(nonTechnical.paceMinPerKm).toBeCloseTo(technical.paceMinPerKm - 0.4, 2);

    const standard = resolvePace({ ...flatInput, profile: null });
    expect(standard.source).toBe('standard');
    expect(standard.confidence.method).toBe('cold');
    expect(standard.personalized).toBe(false);
  });
});

describe('Fatigue sans santé — TEST-A3-FATIGUE', () => {
  it('TEST-A3-FATIGUE-01: entrée nulle ⇒ score 0 et composantes explicites', () => {
    const result = computeFatigue({
      activeDurationS: 0,
      gainM: 0,
      lossM: 0,
    });

    expect(result.score).toBe(0);
    expect(result.components.length).toBeGreaterThan(0);
    for (const component of result.components) {
      expect(typeof component.label).toBe('string');
      expect(Number.isFinite(component.value)).toBe(true);
    }
  });

  it('TEST-A3-FATIGUE-02: durée, D+, technicité, portage et fatigue déclarée augmentent le score', () => {
    const base = computeFatigue({ activeDurationS: 3600, gainM: 200, lossM: 100 });
    const more = computeFatigue({
      activeDurationS: 7200,
      gainM: 1400,
      lossM: 900,
      technicalClass: 4,
      packWeightKg: 12,
      recentLoadS: 5400,
      declaredFatigue: 7,
    });

    expect(more.score).toBeGreaterThan(base.score);
    expect(more.score).toBeLessThanOrEqual(100);
    expect(base.score).toBeGreaterThanOrEqual(0);

    const max = computeFatigue({
      activeDurationS: 43200,
      gainM: 3000,
      lossM: 3000,
      technicalClass: 5,
      packWeightKg: 30,
      recentLoadS: 21600,
      declaredFatigue: 10,
    });
    expect(max.score).toBeLessThanOrEqual(100);
    expect(max.score).toBeGreaterThanOrEqual(more.score);
  });

  it('TEST-A3-FATIGUE-03: plus de D+ ⇒ effort jamais inférieur (monotonie)', () => {
    const low = computeFatigue({ activeDurationS: 3600, gainM: 100, lossM: 0 });
    const high = computeFatigue({ activeDurationS: 3600, gainM: 1200, lossM: 0 });

    expect(high.score).toBeGreaterThanOrEqual(low.score);

    const paused = computeFatigue({
      activeDurationS: 3600,
      gainM: 100,
      lossM: 0,
      pausesCount: 4,
    });
    expect(paused.score).toBeLessThanOrEqual(low.score);
  });
});
