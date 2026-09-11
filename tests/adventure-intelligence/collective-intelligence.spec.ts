import { describe, it, expect } from 'vitest';
import {
  aggregateCollective,
  assignConditionBucket,
  detectAnomalies,
  isPublishable,
  normalizedSlowdown,
  percentile,
  weightedMedian,
  MAX_AGGREGATE_AGE_DAYS,
  MIN_DISTINCT_USERS,
  type CollectiveAggregate,
  type CollectivePassage,
} from '@/features/adventure-intelligence/domain/collectiveIntelligence';
import { makeConfidence } from '@/features/adventure-intelligence/domain/confidence';
import type { ConditionBucket } from '@/features/adventure-intelligence/schemas/live.schema';

const NOW = '2026-09-11T12:00:00.000Z';

function daysAgo(days: number): string {
  return new Date(Date.parse(NOW) - days * 86400000).toISOString();
}

function passage(overrides: Partial<CollectivePassage> = {}): CollectivePassage {
  return {
    passageId: `p-${Math.abs(overrides.observedDurationS ?? 120)}-${overrides.userIdHash ?? 'u1'}`,
    userIdHash: 'u1',
    segmentId: 10,
    direction: 'forward',
    observedDurationS: 120,
    expectedDurationS: 100,
    quality: 0.9,
    observedAt: daysAgo(1),
    conditionBucket: 'dry' as ConditionBucket,
    uturnDetected: false,
    offRoute: false,
    ...overrides,
  };
}

/** Cinq utilisateurs distincts, ratio identique (1.2), qualité maximale. */
function fiveUsers(overrides: Partial<CollectivePassage> = {}): CollectivePassage[] {
  return Array.from({ length: 5 }, (_, index) =>
    passage({
      passageId: `p-${index}`,
      userIdHash: `user-${index}`,
      observedDurationS: 120,
      expectedDurationS: 100,
      ...overrides,
    })
  );
}

describe('Agrégation collective robuste — TEST-A4-AGG', () => {
  it('TEST-A4-AGG-01: normalise par le ratio observé/attendu, jamais par une vitesse brute', () => {
    expect(normalizedSlowdown(120, 100)).toBeCloseTo(1.2, 6);
    expect(normalizedSlowdown(80, 100)).toBeCloseTo(0.8, 6);
    expect(normalizedSlowdown(100, 0)).toBe(1);
    expect(normalizedSlowdown(100, -5)).toBe(1);
    expect(normalizedSlowdown(Number.NaN, 100)).toBe(1);

    // Mêmes ratios, durées absolues très différentes ⇒ mêmes agrégats.
    const slow = aggregateCollective(
      fiveUsers({ observedDurationS: 240, expectedDurationS: 200 }),
      { now: NOW }
    );
    const fast = aggregateCollective(
      fiveUsers({ observedDurationS: 24, expectedDurationS: 20 }),
      { now: NOW }
    );

    expect(slow).toHaveLength(1);
    expect(fast).toHaveLength(1);
    expect(slow[0].weightedMedianSlowdown).toBeCloseTo(1.2, 6);
    expect(fast[0].weightedMedianSlowdown).toBeCloseTo(1.2, 6);
    expect(slow[0].p50).toBeCloseTo(fast[0].p50, 6);
  });

  it('TEST-A4-AGG-02: la médiane pondérée résiste aux extrêmes, contrairement à la moyenne', () => {
    expect(
      weightedMedian([
        { value: 10, weight: 1 },
        { value: 30, weight: 9 },
      ])
    ).toBe(30);
    expect(weightedMedian([])).toBeNull();

    // Quatre passages à ratio 1 et un à ratio 3 : la médiane pondérée reste 1.
    const passages = [
      ...fiveUsers({ observedDurationS: 100, expectedDurationS: 100 })
        .slice(0, 4)
        .map((entry, index) => ({
          ...entry,
          passageId: `median-${index}`,
        })),
      passage({ passageId: 'median-out', userIdHash: 'user-4', observedDurationS: 300 }),
    ];

    const [aggregate] = aggregateCollective(passages, { now: NOW });
    const ratios = passages.map(
      (entry) => entry.observedDurationS / entry.expectedDurationS
    );
    const arithmeticMean = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;

    expect(arithmeticMean).toBeGreaterThan(1.3);
    expect(aggregate.weightedMedianSlowdown).toBeCloseTo(1, 6);
    expect(aggregate.weightedMedianSlowdown).not.toBeCloseTo(arithmeticMean, 1);
  });

  it('TEST-A4-AGG-03: percentiles interpolés et ordonnés', () => {
    expect(percentile([], 0.5)).toBeNull();
    expect(percentile([2], 0.9)).toBe(2);
    expect(percentile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75, 6);
    expect(percentile([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5, 6);
    expect(percentile([1, 2, 3, 4], 0.75)).toBeCloseTo(3.25, 6);
    expect(percentile([1, 2, 3, 4], 0.9)).toBeCloseTo(3.7, 6);
    expect(percentile([1, 2, 3, 4], 2)).toBe(4);

    const [aggregate] = aggregateCollective(
      fiveUsers({
        observedDurationS: 100,
        expectedDurationS: 100,
        userIdHash: 'user-shared',
        passageId: 'p-shared',
      }).map((entry, index) => ({
        ...entry,
        userIdHash: `user-${index}`,
        observedDurationS: 100 + index * 10,
      })),
      { now: NOW }
    );

    expect(aggregate.p25).toBeLessThanOrEqual(aggregate.p50);
    expect(aggregate.p50).toBeLessThanOrEqual(aggregate.p75);
    expect(aggregate.p75).toBeLessThanOrEqual(aggregate.p90);
  });

  it('TEST-A4-AGG-04: le rejet MAD écarte une anomalie sans déplacer la médiane', () => {
    const entries = [
      { value: 10, weight: 1 },
      { value: 10, weight: 1 },
      { value: 11, weight: 1 },
      { value: 12, weight: 1 },
      { value: 100, weight: 1 },
    ];

    const { kept, rejected } = detectAnomalies(entries);
    expect(kept).toHaveLength(4);
    expect(kept.map((entry) => entry.value)).not.toContain(100);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].value).toBe(100);

    // Seuil très large : l'anomalie est conservée.
    const loose = detectAnomalies(entries, 100);
    expect(loose.kept).toHaveLength(5);
    expect(loose.rejected).toHaveLength(0);

    const clean = fiveUsers({ observedDurationS: 100, expectedDurationS: 100 });
    const withOutlier = [
      ...clean,
      passage({ passageId: 'outlier', userIdHash: 'user-out', observedDurationS: 1000 }),
    ];

    const [withoutAggregate] = aggregateCollective(clean, { now: NOW });
    const [withAggregate] = aggregateCollective(withOutlier, { now: NOW });

    expect(withoutAggregate.weightedMedianSlowdown).toBeCloseTo(1, 6);
    expect(withAggregate.weightedMedianSlowdown).toBeCloseTo(1, 6);
    expect(withAggregate.passageCount).toBe(5);
  });

  it('TEST-A4-AGG-05: chaque bucket de conditions est agrégé séparément', () => {
    expect(assignConditionBucket({ surface: 'snow', weather: null })).toBe('snow');
    expect(assignConditionBucket({ surface: null, weather: 'verglas' })).toBe('ice');
    expect(assignConditionBucket({ surface: null, weather: 'pluie' })).toBe('wet');
    expect(assignConditionBucket({ isNight: true })).toBe('night');
    expect(assignConditionBucket({ isAscent: true })).toBe('ascent');
    expect(assignConditionBucket({ isAscent: false })).toBe('descent');
    expect(assignConditionBucket({ packWeightKg: 12 })).toBe('heavy_pack');
    expect(assignConditionBucket({ packWeightKg: 3 })).toBe('light_pack');
    expect(assignConditionBucket({})).toBe('dry');
    // La condition la plus contraignante gagne.
    expect(assignConditionBucket({ surface: 'glace', weather: 'neige' })).toBe('ice');

    const buckets: ConditionBucket[] = ['dry', 'wet', 'snow'];
    const aggregates = aggregateCollective(
      buckets.map((bucket, index) =>
        passage({
          passageId: `bucket-${bucket}`,
          userIdHash: `user-${index}`,
          conditionBucket: bucket,
        })
      ),
      { now: NOW }
    );

    expect(aggregates).toHaveLength(3);
    expect(aggregates.map((entry) => entry.conditionBucket)).toEqual(['dry', 'snow', 'wet']);
    for (const aggregate of aggregates) {
      expect(aggregate.passageCount).toBe(1);
      expect(aggregate.distinctUserCount).toBe(1);
    }
  });

  it('TEST-A4-AGG-06: les sens forward et reverse sont agrégés séparément', () => {
    const aggregates = aggregateCollective(
      [
        passage({ passageId: 'fwd-1', userIdHash: 'u1', direction: 'forward' }),
        passage({ passageId: 'rev-1', userIdHash: 'u2', direction: 'reverse' }),
      ],
      { now: NOW }
    );

    expect(aggregates).toHaveLength(2);
    const byDirection = new Map(aggregates.map((entry) => [entry.direction, entry]));
    expect(byDirection.get('forward')?.passageCount).toBe(1);
    expect(byDirection.get('reverse')?.passageCount).toBe(1);
  });

  it('TEST-A4-AGG-07: plancher de publication à 5 utilisateurs distincts', () => {
    const [four] = aggregateCollective(
      Array.from({ length: 4 }, (_, index) =>
        passage({ passageId: `p-${index}`, userIdHash: `user-${index}` })
      ),
      { now: NOW }
    );
    const [five] = aggregateCollective(fiveUsers(), { now: NOW });

    expect(MIN_DISTINCT_USERS).toBe(5);
    expect(four.distinctUserCount).toBe(4);
    expect(five.distinctUserCount).toBe(5);
    expect(isPublishable({ ...four, computedAt: NOW }, { now: NOW })).toBe(false);
    expect(isPublishable({ ...five, computedAt: NOW }, { now: NOW })).toBe(true);

    // Plusieurs passages d'un même utilisateur ne comptent qu'une fois.
    const [repeated] = aggregateCollective(
      Array.from({ length: 8 }, (_, index) =>
        passage({ passageId: `rep-${index}`, userIdHash: 'user-0' })
      ),
      { now: NOW }
    );
    expect(repeated.passageCount).toBe(8);
    expect(repeated.distinctUserCount).toBe(1);
    expect(isPublishable({ ...repeated, computedAt: NOW }, { now: NOW })).toBe(false);
  });

  it('TEST-A4-AGG-08: une confiance faible rend l’agrégat non publiable', () => {
    const [aggregate] = aggregateCollective(fiveUsers(), { now: NOW });
    const lowConfidence: CollectiveAggregate = {
      ...aggregate,
      confidence: makeConfidence({
        score: 0.3,
        sampleCount: aggregate.passageCount,
        method: 'collective_weighted_median_a4',
      }),
    };

    expect(aggregate.confidence.score).toBeGreaterThanOrEqual(0.5);
    expect(isPublishable({ ...aggregate, computedAt: NOW }, { now: NOW })).toBe(true);
    expect(isPublishable({ ...lowConfidence, computedAt: NOW }, { now: NOW })).toBe(false);
    expect(
      isPublishable({ ...lowConfidence, computedAt: NOW }, { now: NOW, minConfidence: 0.2 })
    ).toBe(true);
  });

  it('TEST-A4-AGG-09: une agrégation ancienne n’est plus publiable', () => {
    const [aggregate] = aggregateCollective(fiveUsers(), { now: NOW });

    const staleComputedAt = daysAgo(MAX_AGGREGATE_AGE_DAYS + 10);
    expect(isPublishable({ ...aggregate, computedAt: staleComputedAt }, { now: NOW })).toBe(false);
    expect(
      isPublishable({ ...aggregate, computedAt: daysAgo(10) }, { now: NOW })
    ).toBe(true);

    // Dernière observation trop vieille : explicitement non publiable.
    const staleObservation = daysAgo(MAX_AGGREGATE_AGE_DAYS + 10);
    const freshAggregate = { ...aggregate, computedAt: NOW };
    expect(
      isPublishable(freshAggregate, { now: NOW, lastObservedAt: staleObservation })
    ).toBe(false);
    expect(isPublishable(freshAggregate, { now: NOW, lastObservedAt: daysAgo(30) })).toBe(true);

    // Les passages plus vieux que 730 j sont exclus de l'agrégation.
    const tooOld = fiveUsers({ observedAt: daysAgo(MAX_AGGREGATE_AGE_DAYS + 1) });
    expect(aggregateCollective(tooOld, { now: NOW })).toEqual([]);
  });

  it('TEST-A4-AGG-10: scores bornés et agrégation déterministe', () => {
    const passages = Array.from({ length: 12 }, (_, index) =>
      passage({
        passageId: `mix-${index}`,
        userIdHash: `user-${index % 6}`,
        observedDurationS: 90 + (index % 5) * 30,
        expectedDurationS: 100,
        quality: 0.6 + (index % 4) * 0.1,
        observedAt: daysAgo(index),
        conditionBucket: index % 2 === 0 ? 'dry' : 'wet',
        uturnDetected: index % 3 === 0,
        offRoute: index % 4 === 0,
      })
    );

    const first = aggregateCollective(passages, { now: NOW });
    const second = aggregateCollective(passages, { now: NOW });

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);

    for (const aggregate of first) {
      for (const score of [
        aggregate.slowdownScore,
        aggregate.effortScore,
        aggregate.technicalScore,
        aggregate.fatigueScore,
        aggregate.orientationScore,
        aggregate.collectiveDifficulty,
      ]) {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
      expect(aggregate.confidence.method).toBe('collective_weighted_median_a4');
      expect(Number.isFinite(aggregate.weightedMedianSlowdown)).toBe(true);
      expect(Number.isFinite(aggregate.p90)).toBe(true);
    }
  });
});
