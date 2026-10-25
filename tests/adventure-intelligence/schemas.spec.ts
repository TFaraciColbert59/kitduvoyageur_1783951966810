import { describe, it, expect } from 'vitest';
import {
  performanceProfileSchema,
  trackQualitySchema,
  calibrationLevelSchema,
  CALIBRATION_LEVELS,
} from '@/features/adventure-intelligence/schemas/performance.schema';
import {
  trailSegmentFeatureSchema,
  segmentDifficultyClassSchema,
} from '@/features/adventure-intelligence/schemas/terrain.schema';
import {
  segmentPredictionSchema,
  routePredictionSchema,
} from '@/features/adventure-intelligence/schemas/prediction.schema';
import {
  terrainReportSchema,
  terrainReportConfirmationSchema,
  terrainReportCategorySchema,
  terrainReportStatusSchema,
  conditionBucketSchema,
  TERRAIN_REPORT_CATEGORIES,
  TERRAIN_REPORT_STATUSES,
  CONDITION_BUCKETS,
} from '@/features/adventure-intelligence/schemas/live.schema';
import * as schemasBarrel from '@/features/adventure-intelligence/schemas';

const USER_ID = '22222222-2222-4222-8222-222222222222';
const REPORT_ID = '44444444-4444-4444-8444-444444444444';
const COMPUTED_AT = '2026-09-11T10:00:00.000Z';

const CONFIDENCE = {
  score: 0.6,
  level: 'medium' as const,
  sampleCount: 5,
  method: 'test-v1',
};

describe('Schémas performance (TEST-A1-PERF)', () => {
  it('TEST-A1-PERF-01: un PerformanceProfile complet est valide', () => {
    const profile = performanceProfileSchema.parse({
      userId: USER_ID,
      activityType: 'hiking',
      flatSpeedKmH: 4.2,
      ascentSpeedMPerHour: 380,
      descentSpeedMPerHour: 520,
      gradeResponse: { points: [{ x: 0.1, value: 0.9 }] },
      surfaceResponse: { points: [{ x: 0, value: 1 }] },
      fatigueCurve: { points: [{ x: 1, value: 0.8 }], decayPerHour: 0.05 },
      pauseModel: { pauseMinutesPerHour: 6, pauseMinutesPerAscentM: 0.02, minPauseMinutes: 2 },
      packResponse: { points: [{ x: 8, value: 0.85 }] },
      confidence: CONFIDENCE,
      sampleCount: 12,
      calibrationLevel: 'personalization',
      modelVersion: 'profile-v2',
      computedAt: COMPUTED_AT,
    });

    expect(profile.flatSpeedKmH).toBe(4.2);
    expect(profile.calibrationLevel).toBe('personalization');
    expect(profile.gradeResponse.points).toHaveLength(1);
  });

  it('TEST-A1-PERF-02: flatSpeedKmH > 0 et vitesses de dénivelé >= 0', () => {
    const base = {
      userId: USER_ID,
      flatSpeedKmH: 4,
      ascentSpeedMPerHour: 350,
      descentSpeedMPerHour: 500,
      gradeResponse: { points: [{ x: 0, value: 1 }] },
      surfaceResponse: { points: [{ x: 0, value: 1 }] },
      fatigueCurve: { points: [{ x: 0, value: 1 }] },
      pauseModel: { pauseMinutesPerHour: 5 },
      packResponse: { points: [{ x: 0, value: 1 }] },
      confidence: CONFIDENCE,
      modelVersion: 'profile-v2',
      computedAt: COMPUTED_AT,
    };

    expect(performanceProfileSchema.safeParse(base).success).toBe(true);
    expect(performanceProfileSchema.safeParse({ ...base, flatSpeedKmH: 0 }).success).toBe(false);
    expect(performanceProfileSchema.safeParse({ ...base, flatSpeedKmH: -1 }).success).toBe(false);
    expect(performanceProfileSchema.safeParse({ ...base, ascentSpeedMPerHour: -0.1 }).success).toBe(false);
    expect(performanceProfileSchema.safeParse({ ...base, descentSpeedMPerHour: -5 }).success).toBe(false);
  });

  it('TEST-A1-PERF-03: TrackQuality borne chaque indicateur dans [0,1]', () => {
    const quality = trackQualitySchema.parse({
      overall: 0.8,
      gpsAccuracy: 0.9,
      temporalContinuity: 1,
      altitudeReliability: 0.5,
      plausibleMovement: 0.7,
    });
    expect(quality.reasons).toEqual([]);

    expect(
      trackQualitySchema.safeParse({
        overall: 1.2,
        gpsAccuracy: 0.9,
        temporalContinuity: 1,
        altitudeReliability: 0.5,
        plausibleMovement: 0.7,
      }).success
    ).toBe(false);
    expect(
      trackQualitySchema.safeParse({
        overall: 0.8,
        gpsAccuracy: -0.1,
        temporalContinuity: 1,
        altitudeReliability: 0.5,
        plausibleMovement: 0.7,
      }).success
    ).toBe(false);
  });

  it('TEST-A1-PERF-04: CALIBRATION_LEVELS expose les quatre niveaux normatifs', () => {
    expect([...CALIBRATION_LEVELS]).toEqual([
      'cold',
      'calibration',
      'personalization',
      'contextualization',
    ]);
    for (const level of CALIBRATION_LEVELS) {
      expect(calibrationLevelSchema.safeParse(level).success).toBe(true);
    }
    expect(calibrationLevelSchema.safeParse('expert').success).toBe(false);
  });
});

describe('Schémas terrain (TEST-A1-TER)', () => {
  it('TEST-A1-TER-01: un enrichissement de segment complet est valide', () => {
    const feature = trailSegmentFeatureSchema.parse({
      segmentId: 42,
      lengthM: 512.5,
      direction: 'forward',
      meanGradePct: 4.2,
      maxGradePct: 12,
      gainM: 30,
      lossM: 2,
      altitudeMinM: 1200,
      altitudeMaxM: 1230,
      surface: 'gravel',
      technicalClass: 3,
      exposureClass: 2,
      isolationClass: 1,
      source: 'computed',
      computedAt: COMPUTED_AT,
    });

    expect(feature.segmentId).toBe(42);
    expect(feature.technicalClass).toBe(3);
    expect(feature.direction).toBe('forward');
    expect(feature.source).toBe('computed');
  });

  it('TEST-A1-TER-02: les classes de difficulté sont bornées 0..5', () => {
    expect(segmentDifficultyClassSchema.safeParse(0).success).toBe(true);
    expect(segmentDifficultyClassSchema.safeParse(5).success).toBe(true);
    expect(segmentDifficultyClassSchema.safeParse(6).success).toBe(false);
    expect(segmentDifficultyClassSchema.safeParse(-1).success).toBe(false);
    expect(segmentDifficultyClassSchema.safeParse(2.5).success).toBe(false);

    const base = { segmentId: 1, computedAt: COMPUTED_AT };
    expect(trailSegmentFeatureSchema.safeParse({ ...base, technicalClass: 6 }).success).toBe(false);
    expect(trailSegmentFeatureSchema.safeParse({ ...base, exposureClass: -1 }).success).toBe(false);
    expect(trailSegmentFeatureSchema.safeParse({ ...base, isolationClass: 9 }).success).toBe(false);
  });

  it('TEST-A1-TER-03: une direction de segment inconnue est rejetée', () => {
    const base = { segmentId: 1, computedAt: COMPUTED_AT };
    expect(trailSegmentFeatureSchema.safeParse({ ...base, direction: 'backward' }).success).toBe(false);
    expect(trailSegmentFeatureSchema.safeParse({ ...base, direction: 'both' }).success).toBe(true);
  });

  it('TEST-A1-TER-04: la source d’un enrichissement suit la taxonomie de provenance', () => {
    const base = { segmentId: 1, computedAt: COMPUTED_AT };
    for (const source of ['measured', 'official', 'community', 'computed', 'estimated', 'suggested']) {
      expect(trailSegmentFeatureSchema.safeParse({ ...base, source }).success).toBe(true);
    }
    expect(trailSegmentFeatureSchema.safeParse({ ...base, source: 'guessed' }).success).toBe(false);
  });
});

describe('Schémas prédiction (TEST-A1-PRED)', () => {
  it('TEST-A1-PRED-01: une SegmentPrediction complète est valide', () => {
    const prediction = segmentPredictionSchema.parse({
      segmentId: 42,
      durationP50Seconds: 1200,
      durationP90Seconds: 1800,
      paceRangeMinPerKm: [12, 18],
      effortScore: 65,
      personalDifficulty: 58,
      recommendedPauseSeconds: 300,
      confidence: CONFIDENCE,
      factors: [{ code: 'slope', label: 'Montée soutenue', impact: 'increase', weight: 0.4 }],
    });

    expect(prediction.durationP90Seconds).toBe(1800);
    expect(prediction.paceRangeMinPerKm).toEqual([12, 18]);
    expect(prediction.factors[0].code).toBe('slope');
  });

  it('TEST-A1-PRED-02: P90 inférieur à P50 est rejeté', () => {
    const result = segmentPredictionSchema.safeParse({
      segmentId: 42,
      durationP50Seconds: 2000,
      durationP90Seconds: 1800,
      paceRangeMinPerKm: [12, 18],
      effortScore: 65,
      personalDifficulty: 58,
      recommendedPauseSeconds: 300,
      confidence: CONFIDENCE,
      factors: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes('P50'))).toBe(true);
    }
  });

  it('TEST-A1-PRED-03: une fourchette d’allure décroissante est rejetée', () => {
    const result = segmentPredictionSchema.safeParse({
      segmentId: 42,
      durationP50Seconds: 1200,
      durationP90Seconds: 1800,
      paceRangeMinPerKm: [18, 12],
      effortScore: 65,
      personalDifficulty: 58,
      recommendedPauseSeconds: 300,
      confidence: CONFIDENCE,
      factors: [],
    });
    expect(result.success).toBe(false);
  });

  it('TEST-A1-PRED-04: RoutePrediction exige etaP50 <= etaP90 et une stratégie connue', () => {
    const route = {
      userId: USER_ID,
      strategy: 'recommended',
      etaP50: '2026-09-20T15:00:00.000Z',
      etaP90: '2026-09-20T16:30:00.000Z',
      totalDurationP50Seconds: 28800,
      totalDurationP90Seconds: 34200,
      pausesSeconds: 3600,
      criticalSegmentIds: [42, 77],
      confidence: CONFIDENCE,
      modelVersion: 'route-v2',
      computedAt: COMPUTED_AT,
    };

    const parsed = routePredictionSchema.parse(route);
    expect(parsed.strategy).toBe('recommended');
    expect(parsed.criticalSegmentIds).toEqual([42, 77]);

    expect(
      routePredictionSchema.safeParse({
        ...route,
        etaP50: '2026-09-20T17:00:00.000Z',
      }).success
    ).toBe(false);
    expect(routePredictionSchema.safeParse({ ...route, strategy: 'sprint' }).success).toBe(false);
  });
});

describe('Schémas live (TEST-A1-LIVE)', () => {
  it('TEST-A1-LIVE-01: TerrainReportCategory expose les 13 valeurs de la migration', () => {
    expect([...TERRAIN_REPORT_CATEGORIES]).toEqual([
      'obstacle',
      'closure',
      'mud',
      'snow_ice',
      'water',
      'danger',
      'bridge',
      'flood',
      'marking',
      'shelter',
      'crowding',
      'animal',
      'rockfall',
    ]);
    expect(terrainReportCategorySchema.safeParse('volcano').success).toBe(false);
  });

  it('TEST-A1-LIVE-02: TerrainReportStatus expose les 8 statuts du cycle de vie', () => {
    expect([...TERRAIN_REPORT_STATUSES]).toEqual([
      'pending',
      'confirmed',
      'active',
      'stale',
      'verify',
      'resolved',
      'expired',
      'rejected',
    ]);
    expect(terrainReportStatusSchema.safeParse('unknown').success).toBe(false);
  });

  it('TEST-A1-LIVE-03: CONDITION_BUCKETS expose les 10 conditions et rejette un bucket inconnu', () => {
    expect([...CONDITION_BUCKETS]).toEqual([
      'dry',
      'wet',
      'snow',
      'ice',
      'day',
      'night',
      'ascent',
      'descent',
      'light_pack',
      'heavy_pack',
    ]);
    for (const bucket of CONDITION_BUCKETS) {
      expect(conditionBucketSchema.safeParse(bucket).success).toBe(true);
    }
    expect(conditionBucketSchema.safeParse('hail').success).toBe(false);
  });

  it('TEST-A1-LIVE-04: un signalement et sa confirmation sont valides ; le barrel expose les schémas', () => {
    const report = terrainReportSchema.parse({
      id: REPORT_ID,
      reporterId: USER_ID,
      category: 'snow_ice',
      lat: 42.8,
      lng: 0.15,
    });

    expect(report.severity).toBe('warning');
    expect(report.status).toBe('pending');
    expect(report.sourceType).toBe('user');
    expect(report.presentCount).toBe(0);
    expect(report.goneCount).toBe(0);
    expect(report.unknownCount).toBe(0);

    const confirmation = terrainReportConfirmationSchema.parse({
      reportId: REPORT_ID,
      userId: USER_ID,
      confirmation: 'present',
      locationDistanceM: 12,
      gpsQuality: 0.8,
    });
    expect(confirmation.confirmation).toBe('present');
    expect(terrainReportConfirmationSchema.safeParse({ ...confirmation, confirmation: 'maybe' }).success).toBe(false);

    expect(schemasBarrel.terrainReportSchema).toBe(terrainReportSchema);
    expect(schemasBarrel.performanceProfileSchema).toBe(performanceProfileSchema);
    expect(schemasBarrel.segmentPredictionSchema).toBe(segmentPredictionSchema);
    expect(schemasBarrel.adventurePlanSchema).toBeDefined();
  });
});
