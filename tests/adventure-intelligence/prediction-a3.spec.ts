import { describe, it, expect } from 'vitest';
import {
  STRATEGIES,
  predictRoute,
  predictSegment,
} from '@/features/adventure-intelligence/domain/prediction';
import { makeConfidence } from '@/features/adventure-intelligence/domain/confidence';
import {
  performanceProfileSchema,
  type PerformanceProfile,
} from '@/features/adventure-intelligence/schemas/performance.schema';
import { routePredictionSchema, segmentPredictionSchema } from '@/features/adventure-intelligence/schemas/prediction.schema';

const USER_ID = '55555555-5555-4555-8555-555555555555';
const START_AT = '2026-09-11T12:00:00.000Z';

function profile(overrides: Record<string, unknown> = {}): PerformanceProfile {
  return performanceProfileSchema.parse({
    userId: USER_ID,
    activityType: 'hiking',
    flatSpeedKmH: 5,
    ascentSpeedMPerHour: 400,
    descentSpeedMPerHour: 600,
    gradeResponse: { points: [{ x: 0, value: 1 }] },
    surfaceResponse: { points: [{ x: 0, value: 1 }] },
    fatigueCurve: { points: [{ x: 0, value: 1 }] },
    pauseModel: { pauseMinutesPerHour: 0 },
    packResponse: { points: [{ x: 0, value: 1 }] },
    confidence: makeConfidence({ score: 0.9, sampleCount: 30, method: 'test' }),
    sampleCount: 30,
    calibrationLevel: 'personalization',
    modelVersion: 'a3-v1',
    computedAt: START_AT,
    ...overrides,
  });
}

function segmentInput(overrides: Record<string, unknown> = {}) {
  return {
    segmentId: 1,
    distanceM: 10000,
    gainM: 0,
    lossM: 0,
    meanGradePct: 0,
    technicalClass: 0,
    surface: null,
    packWeightKg: null,
    fatigueBefore: null,
    ...overrides,
  };
}

describe('Prédiction segment et route — TEST-A3-PRED', () => {
  it('TEST-A3-PRED-01: invariant 1 — plus de distance ⇒ jamais moins de temps', () => {
    const warm = profile();
    const short = predictSegment(segmentInput({ distanceM: 10000 }), warm, warm.confidence);
    const long = predictSegment(segmentInput({ distanceM: 15000 }), warm, warm.confidence);

    expect(long.durationP50Seconds).toBeGreaterThanOrEqual(short.durationP50Seconds);
    expect(long.durationP90Seconds).toBeGreaterThanOrEqual(short.durationP90Seconds);

    const routeShort = predictRoute(
      { segments: [{ segmentId: 1, distanceM: 10000, gainM: 0, lossM: 0 }], startAt: START_AT, profile: warm, confidence: warm.confidence },
      'recommended'
    );
    const routeLong = predictRoute(
      { segments: [{ segmentId: 1, distanceM: 15000, gainM: 0, lossM: 0 }], startAt: START_AT, profile: warm, confidence: warm.confidence },
      'recommended'
    );
    expect(routeLong.totalDurationP50Seconds).toBeGreaterThanOrEqual(routeShort.totalDurationP50Seconds);
  });

  it('TEST-A3-PRED-02: invariant 2 — plus de D+ ⇒ effort jamais inférieur', () => {
    const warm = profile();
    const low = predictSegment(segmentInput({ gainM: 100 }), warm, warm.confidence);
    const high = predictSegment(segmentInput({ gainM: 1500 }), warm, warm.confidence);

    expect(high.effortScore).toBeGreaterThanOrEqual(low.effortScore);
    expect(high.personalDifficulty).toBeGreaterThanOrEqual(low.personalDifficulty);
    expect(high.effortScore).toBeGreaterThan(0);
  });

  it('TEST-A3-PRED-03: invariant 3 — confiance faible ⇒ intervalle P50–P90 plus large', () => {
    const warm = profile();
    const highConfidence = makeConfidence({ score: 0.9, sampleCount: 30, method: 'test' });
    const lowConfidence = makeConfidence({ score: 0.2, sampleCount: 3, method: 'test' });

    const high = predictSegment(segmentInput(), warm, highConfidence);
    const low = predictSegment(segmentInput(), warm, lowConfidence);
    const highRatio = high.durationP90Seconds / high.durationP50Seconds;
    const lowRatio = low.durationP90Seconds / low.durationP50Seconds;

    expect(lowRatio).toBeGreaterThan(highRatio);

    const highRoute = predictRoute(
      { segments: [{ segmentId: 1, distanceM: 10000, gainM: 300, lossM: 300 }], startAt: START_AT, profile: warm, confidence: highConfidence },
      'recommended'
    );
    const lowRoute = predictRoute(
      { segments: [{ segmentId: 1, distanceM: 10000, gainM: 300, lossM: 300 }], startAt: START_AT, profile: warm, confidence: lowConfidence },
      'recommended'
    );
    expect(lowRoute.totalDurationP90Seconds / lowRoute.totalDurationP50Seconds).toBeGreaterThan(
      highRoute.totalDurationP90Seconds / highRoute.totalDurationP50Seconds
    );
  });

  it('TEST-A3-PRED-04: invariant 4 — stratégie rapide jamais plus lente que confort', () => {
    const warm = profile();
    const input = {
      segments: [
        { segmentId: 1, distanceM: 6000, gainM: 400, lossM: 200, technicalClass: 2 },
        { segmentId: 2, distanceM: 5000, gainM: 700, lossM: 100, technicalClass: 3 },
      ],
      startAt: START_AT,
      profile: warm,
      confidence: warm.confidence,
    };

    const comfort = predictRoute(input, 'comfort');
    const recommended = predictRoute(input, 'recommended');
    const fast = predictRoute(input, 'fast');

    expect(fast.totalDurationP50Seconds).toBeLessThanOrEqual(comfort.totalDurationP50Seconds);
    expect(recommended.totalDurationP50Seconds).toBeLessThanOrEqual(comfort.totalDurationP50Seconds);
    expect(fast.totalDurationP50Seconds).toBeLessThanOrEqual(recommended.totalDurationP50Seconds);
    expect(STRATEGIES).toEqual(['comfort', 'recommended', 'fast']);
  });

  it('TEST-A3-PRED-05: invariant 5 — profil froid explicitement non personnalisé', () => {
    const cold = profile({
      calibrationLevel: 'cold',
      sampleCount: 0,
      flatSpeedKmH: 5,
      confidence: makeConfidence({ score: 0, sampleCount: 0, method: 'cold' }),
    });

    const coldSegment = predictSegment(segmentInput({ distanceM: 10000 }), cold, cold.confidence);
    const warmSegment = predictSegment(segmentInput({ distanceM: 10000 }), profile(), profile().confidence);
    expect(coldSegment.durationP50Seconds).toBeCloseTo(10000 * 0.0135 * 60, 0);
    expect(coldSegment.durationP50Seconds).toBeGreaterThan(warmSegment.durationP50Seconds);

    const route = predictRoute(
      { segments: [{ segmentId: 1, distanceM: 10000, gainM: 0, lossM: 0 }], startAt: START_AT, profile: cold, confidence: cold.confidence },
      'recommended'
    );
    expect(route.warnings.some((warning) => warning.code === 'cold_profile')).toBe(true);

    const warmRoute = predictRoute(
      { segments: [{ segmentId: 1, distanceM: 10000, gainM: 0, lossM: 0 }], startAt: START_AT, profile: profile(), confidence: profile().confidence },
      'recommended'
    );
    expect(warmRoute.warnings.some((warning) => warning.code === 'cold_profile')).toBe(false);
  });

  it('TEST-A3-PRED-06: P90 toujours supérieur ou égal à P50 (segment et route)', () => {
    const warm = profile();
    const segment = predictSegment(segmentInput({ gainM: 800, lossM: 600 }), warm, warm.confidence);
    expect(segment.durationP90Seconds).toBeGreaterThanOrEqual(segment.durationP50Seconds);
    expect(segment.paceRangeMinPerKm[1]).toBeGreaterThanOrEqual(segment.paceRangeMinPerKm[0]);

    const route = predictRoute(
      {
        segments: [
          { segmentId: 1, distanceM: 4000, gainM: 300, lossM: 100 },
          { segmentId: 2, distanceM: 7000, gainM: 500, lossM: 900 },
        ],
        startAt: START_AT,
        profile: warm,
        confidence: warm.confidence,
      },
      'recommended'
    );
    expect(route.totalDurationP90Seconds).toBeGreaterThanOrEqual(route.totalDurationP50Seconds);
    expect(Date.parse(route.etaP90)).toBeGreaterThanOrEqual(Date.parse(route.etaP50));
  });

  it('TEST-A3-PRED-07: segments critiques = top 3 difficulté', () => {
    const warm = profile();
    const route = predictRoute(
      {
        segments: [
          { segmentId: 11, distanceM: 2000, gainM: 100, lossM: 0 },
          { segmentId: 22, distanceM: 2000, gainM: 800, lossM: 0 },
          { segmentId: 33, distanceM: 2000, gainM: 1500, lossM: 0 },
          { segmentId: 44, distanceM: 2000, gainM: 300, lossM: 0 },
        ],
        startAt: START_AT,
        profile: warm,
        confidence: warm.confidence,
      },
      'recommended'
    );

    expect(route.criticalSegmentIds).toHaveLength(3);
    expect(route.criticalSegmentIds).toContain(33);
    expect(route.criticalSegmentIds).toContain(22);
    expect(route.criticalSegmentIds).toContain(44);
    expect(route.criticalSegmentIds).not.toContain(11);
  });

  it('TEST-A3-PRED-08: facteurs explicables présents et bornés', () => {
    const warm = profile();
    const segment = predictSegment(
      segmentInput({ gainM: 900, lossM: 400, technicalClass: 4, packWeightKg: 12, fatigueBefore: 55 }),
      warm,
      warm.confidence
    );

    const codes = segment.factors.map((factor) => factor.code);
    for (const expected of ['slope', 'technical', 'pack', 'fatigue', 'confidence']) {
      expect(codes).toContain(expected);
    }
    for (const factor of segment.factors) {
      expect(factor.label.length).toBeGreaterThan(0);
      expect(['increase', 'decrease', 'neutral']).toContain(factor.impact);
      if (factor.weight != null) {
        expect(factor.weight).toBeGreaterThanOrEqual(0);
        expect(factor.weight).toBeLessThanOrEqual(1);
      }
    }
  });

  it('TEST-A3-PRED-09: pause recommandée proportionnelle à la durée et au profil', () => {
    const warm = profile({ pauseModel: { pauseMinutesPerHour: 6 } });
    const short = predictSegment(segmentInput({ distanceM: 5000 }), warm, warm.confidence);
    const long = predictSegment(segmentInput({ distanceM: 15000 }), warm, warm.confidence);

    expect(short.recommendedPauseSeconds).toBeGreaterThan(0);
    expect(long.recommendedPauseSeconds).toBeGreaterThan(short.recommendedPauseSeconds);
    expect(short.recommendedPauseSeconds).toBeCloseTo(360, 0);

    const withoutProfile = predictSegment(segmentInput({ distanceM: 10000 }), null, null);
    expect(withoutProfile.recommendedPauseSeconds).toBeGreaterThan(0);
  });

  it('TEST-A3-PRED-10: half-turn horodaté et prédictions conformes au schéma A1', () => {
    const warm = profile();
    const route = predictRoute(
      {
        segments: [
          { segmentId: 7, distanceM: 8000, gainM: 600, lossM: 400 },
          { segmentId: 8, distanceM: 6000, gainM: 300, lossM: 700 },
        ],
        startAt: START_AT,
        profile: warm,
        confidence: warm.confidence,
        packWeightKg: 9,
        turnaroundAfterS: 3600,
      },
      'fast'
    );

    expect(route.turnaroundTime).toBe('2026-09-11T13:00:00.000Z');
    expect(route.pausesSeconds).toBeGreaterThanOrEqual(0);
    expect(route.maxFatigue).toBeGreaterThanOrEqual(0);
    expect(route.personalDifficulty).toBeGreaterThanOrEqual(0);
    expect(route.modelVersion).toBe('a3-v1');
    expect(routePaceOrdered(route.paceP25MinPerKm, route.paceP50MinPerKm, route.paceP75MinPerKm)).toBe(true);

    const parsedRoute = routePredictionSchema.parse({ ...route, userId: USER_ID });
    expect(parsedRoute.criticalSegmentIds.length).toBeLessThanOrEqual(3);

    const segment = predictSegment(segmentInput({ gainM: 500, lossM: 500 }), warm, warm.confidence);
    const parsedSegment = segmentPredictionSchema.parse(segment);
    expect(parsedSegment.durationP50Seconds).toBe(segment.durationP50Seconds);
    expect(parsedSegment.factors.length).toBeGreaterThan(0);
  });

  it('TEST-A3-PRED-11: flag route_prediction_v2 désactivé ⇒ repli sûr non personnalisé', () => {
    const warm = profile();
    const personalized = predictSegment(segmentInput({ distanceM: 10000 }), warm, warm.confidence);
    const explicitOn = predictSegment(segmentInput({ distanceM: 10000 }), warm, warm.confidence, {
      flagEnabled: true,
    });
    const flaggedOff = predictSegment(segmentInput({ distanceM: 10000 }), warm, warm.confidence, {
      flagEnabled: false,
    });

    expect(explicitOn.durationP50Seconds).toBe(personalized.durationP50Seconds);
    expect(flaggedOff.durationP50Seconds).toBeCloseTo(10000 * 0.0135 * 60, 0);
    expect(flaggedOff.durationP50Seconds).toBeGreaterThan(personalized.durationP50Seconds);
  });
});

function routePaceOrdered(p25?: number, p50?: number, p75?: number): boolean {
  if (p25 == null || p50 == null || p75 == null) return false;
  return p25 <= p50 && p50 <= p75;
}
