import { describe, it, expect } from 'vitest';
import {
  CALIBRATION_THRESHOLDS,
  buildPerformanceProfile,
  rejectOutliersMAD,
  weightedMedian,
  type ProfileObservation,
} from '@/features/adventure-intelligence/domain/performanceProfile';
import { performanceProfileSchema } from '@/features/adventure-intelligence/schemas/performance.schema';

const USER_ID = '33333333-3333-4333-8333-333333333333';
const NOW = '2026-09-11T12:00:00.000Z';

function daysAgo(days: number): string {
  return new Date(Date.parse(NOW) - days * 86400000).toISOString();
}

function observation(overrides: Partial<ProfileObservation> = {}): ProfileObservation {
  return {
    observedAt: daysAgo(1),
    distanceM: 4000,
    durationS: 3600,
    movingS: 3000,
    gainM: 0,
    lossM: 0,
    meanGradePct: 0,
    quality: 0.9,
    ...overrides,
  };
}

describe('Profil de performance appris — TEST-A3-PROF', () => {
  it('TEST-A3-PROF-01: la médiane pondérée reflète les poids et ignore les entrées invalides', () => {
    expect(weightedMedian([])).toBeNull();
    expect(
      weightedMedian([
        { value: 10, weight: 1 },
        { value: 20, weight: 1 },
        { value: 30, weight: 1 },
      ])
    ).toBe(20);

    // Le poids fort fait basculer la médiane sur la valeur haute.
    expect(
      weightedMedian([
        { value: 10, weight: 1 },
        { value: 30, weight: 9 },
      ])
    ).toBe(30);

    expect(weightedMedian([{ value: 5, weight: 0 }])).toBeNull();
    expect(
      weightedMedian([
        { value: Number.NaN, weight: 1 },
        { value: 8, weight: 1 },
      ])
    ).toBe(8);
  });

  it('TEST-A3-PROF-02: le rejet MAD écarte les anomalies et respecte le seuil', () => {
    const entries = [
      { value: 10, weight: 1 },
      { value: 10, weight: 1 },
      { value: 11, weight: 1 },
      { value: 12, weight: 1 },
      { value: 100, weight: 1 },
    ];

    const kept = rejectOutliersMAD(entries);
    expect(kept).toHaveLength(4);
    expect(kept.map((entry) => entry.value)).not.toContain(100);

    expect(rejectOutliersMAD(entries, 100)).toHaveLength(5);

    // MAD = 0 : les valeurs identiques restent, rien d'autre ne rentre.
    const identical = [
      { value: 10, weight: 1 },
      { value: 10, weight: 1 },
      { value: 10, weight: 1 },
    ];
    expect(rejectOutliersMAD(identical)).toHaveLength(3);
  });

  it('TEST-A3-PROF-03: sépare plat, montée et descente (allure et m/h)', () => {
    const flat = [
      observation({ distanceM: 4000, movingS: 3000, gainM: 0, lossM: 0, meanGradePct: 0 }),
      observation({ distanceM: 4000, movingS: 3000, gainM: 0, lossM: 0, meanGradePct: 1 }),
      observation({ distanceM: 4000, movingS: 3000, gainM: 0, lossM: 0, meanGradePct: -1 }),
    ];
    const ascent = [
      observation({ distanceM: 2000, movingS: 1800, gainM: 400, lossM: 0, meanGradePct: 20 }),
      observation({ distanceM: 2000, movingS: 1800, gainM: 400, lossM: 0, meanGradePct: 20 }),
      observation({ distanceM: 2000, movingS: 1800, gainM: 400, lossM: 0, meanGradePct: 20 }),
    ];
    const descent = [
      observation({ distanceM: 2000, movingS: 1500, gainM: 0, lossM: 500, meanGradePct: -25 }),
      observation({ distanceM: 2000, movingS: 1500, gainM: 0, lossM: 500, meanGradePct: -25 }),
      observation({ distanceM: 2000, movingS: 1500, gainM: 0, lossM: 500, meanGradePct: -25 }),
    ];

    const profile = buildPerformanceProfile([...flat, ...ascent, ...descent], { now: NOW });

    expect(profile.flatSpeedKmH).toBeCloseTo(4.8, 5);
    expect(profile.ascentSpeedMPerHour).toBeCloseTo(800, 5);
    expect(profile.descentSpeedMPerHour).toBeCloseTo(1200, 5);
    expect(profile.sampleCount).toBe(9);
  });

  it('TEST-A3-PROF-04: la récence pondère les observations récentes', () => {
    const recentFast = observation({
      observedAt: daysAgo(0),
      distanceM: 6000,
      movingS: 3000,
      meanGradePct: 0,
    });
    const oldSlow = observation({
      observedAt: daysAgo(365),
      distanceM: 3000,
      movingS: 3000,
      meanGradePct: 0,
    });

    const withRecency = buildPerformanceProfile([recentFast, oldSlow], {
      now: NOW,
      halfLifeDays: 90,
    });
    const withoutRecency = buildPerformanceProfile([recentFast, oldSlow], {
      now: NOW,
      halfLifeDays: Number.POSITIVE_INFINITY,
    });

    expect(withRecency.flatSpeedKmH).toBeCloseTo(7.2, 5);
    expect(withoutRecency.flatSpeedKmH).toBeCloseTo(3.6, 5);
  });

  it('TEST-A3-PROF-05: profil froid sous 3 observations exploitables', () => {
    const two = [observation(), observation({ observedAt: daysAgo(2) })];
    const cold = buildPerformanceProfile(two, { now: NOW });

    expect(cold.calibrationLevel).toBe('cold');
    expect(cold.personalized).toBe(false);
    expect(cold.sampleCount).toBe(2);
    expect(cold.confidence.score).toBe(0);
    expect(cold.flatSpeedKmH).toBeGreaterThan(0);

    // minQuality écarte les observations peu fiables.
    const lowQuality = [
      observation({ quality: 0.1 }),
      observation({ quality: 0.2 }),
      observation({ quality: 0.3 }),
    ];
    const filtered = buildPerformanceProfile(lowQuality, { now: NOW, minQuality: 0.5 });
    expect(filtered.calibrationLevel).toBe('cold');
    expect(filtered.sampleCount).toBe(0);

    const parsed = performanceProfileSchema.parse({ ...cold, userId: USER_ID });
    expect(parsed.calibrationLevel).toBe('cold');
    expect(parsed.modelVersion).toBe('a3-v1');
  });

  it('TEST-A3-PROF-06: niveaux de calibration à 3, 10 et 20+ observations diversifiées', () => {
    const three = buildPerformanceProfile(
      [observation(), observation({ observedAt: daysAgo(2) }), observation({ observedAt: daysAgo(3) })],
      { now: NOW }
    );
    expect(three.calibrationLevel).toBe('calibration');
    expect(three.personalized).toBe(true);

    const ten = buildPerformanceProfile(
      Array.from({ length: 10 }, (_, index) => observation({ observedAt: daysAgo(index) })),
      { now: NOW }
    );
    expect(ten.calibrationLevel).toBe('personalization');

    const diverse = Array.from({ length: 21 }, (_, index) =>
      index % 2 === 0
        ? observation({ observedAt: daysAgo(index), meanGradePct: 0 })
        : observation({
            observedAt: daysAgo(index),
            gainM: 300,
            lossM: 0,
            meanGradePct: 15,
            distanceM: 2000,
            movingS: 1800,
          })
    );
    const contextual = buildPerformanceProfile(diverse, { now: NOW });
    expect(contextual.sampleCount).toBe(21);
    expect(contextual.calibrationLevel).toBe('contextualization');

    // 21 observations non diversifiées : pas de contextualisation.
    const monotone = Array.from({ length: 21 }, (_, index) =>
      observation({ observedAt: daysAgo(index), meanGradePct: 0 })
    );
    expect(buildPerformanceProfile(monotone, { now: NOW }).calibrationLevel).toBe('personalization');
    expect(CALIBRATION_THRESHOLDS).toEqual({ calibration: 3, personalization: 10, contextualization: 20 });
  });

  it('TEST-A3-PROF-07: réponse au portage neutre sans données puis régressive', () => {
    const neutral = buildPerformanceProfile(
      [observation(), observation({ observedAt: daysAgo(2) }), observation({ observedAt: daysAgo(3) })],
      { now: NOW }
    );
    expect(neutral.packResponse.points).toEqual([{ x: 0, value: 1 }]);

    const weighted = Array.from({ length: 6 }, (_, index) =>
      observation({
        observedAt: daysAgo(index),
        packWeightKg: 5 + index,
        distanceM: (5.2 - index * 0.2) * 1000,
        movingS: 3600,
        meanGradePct: 0,
      })
    );
    const learned = buildPerformanceProfile(weighted, { now: NOW });

    expect(learned.packResponse.points.length).toBeGreaterThan(1);
    const first = learned.packResponse.points[0];
    const last = learned.packResponse.points[learned.packResponse.points.length - 1];
    expect(last.value).toBeLessThan(first.value);
  });

  it('TEST-A3-PROF-08: confiance bornée à 0.95 et pénalisée par la dispersion', () => {
    const tight = Array.from({ length: 25 }, (_, index) =>
      observation({ observedAt: daysAgo(index), distanceM: 5000, movingS: 3600, meanGradePct: 0 })
    );
    const tightProfile = buildPerformanceProfile(tight, { now: NOW });

    expect(tightProfile.sampleCount).toBe(25);
    expect(tightProfile.confidence.score).toBeLessThanOrEqual(0.95);
    expect(tightProfile.confidence.score).toBeGreaterThan(0);
    expect(tightProfile.confidence.method).toBe('weighted_median_a3');
    expect(tightProfile.modelVersion).toBe('a3-v1');

    const wild = Array.from({ length: 25 }, (_, index) =>
      observation({
        observedAt: daysAgo(index),
        distanceM: (index % 5 === 0 ? 1500 : 8000) * 1,
        movingS: 3600,
        meanGradePct: 0,
      })
    );
    const wildProfile = buildPerformanceProfile(wild, { now: NOW });

    expect(wildProfile.confidence.score).toBeLessThan(tightProfile.confidence.score);
    expect(wildProfile.confidence.score).toBeGreaterThanOrEqual(0);
    expect(tightProfile.fatigueCurve.points.length).toBeGreaterThanOrEqual(1);
    expect(tightProfile.pauseModel.minPauseMinutes).toBeGreaterThanOrEqual(0);
  });
});
