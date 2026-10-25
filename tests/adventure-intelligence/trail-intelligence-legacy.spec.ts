import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  TrailIntelligenceEngine,
  type AnonymizedHikeSample,
} from '@/features/hiking/intelligence/TrailIntelligenceEngine';
import type { CollectivePassage } from '@/features/adventure-intelligence/domain/collectiveIntelligence';
import type { HikeSession, Trail } from '@/features/hiking/types';

const NOW = '2026-09-11T12:00:00.000Z';

function session(overrides: Partial<HikeSession> = {}): HikeSession {
  return {
    id: 'session-legacy-1',
    userId: 'user-legacy-1',
    routeId: 'route-77',
    startedAt: '2026-09-01T08:00:00.000Z',
    distanceKm: 12,
    durationSeconds: 7200,
    positions: [
      { latitude: 45, longitude: 6, speed: 0.1, timestamp: 1000 },
      { latitude: 45.001, longitude: 6, accuracy: 40, timestamp: 2000 },
    ],
    poiEvents: [],
    ...overrides,
  };
}

function samples(count: number, paceMinPerKm = 20): AnonymizedHikeSample[] {
  return Array.from({ length: count }, (_, index) => ({
    routeId: 'trail-1',
    anonymizedSessionId: `anon-${index}`,
    totalDistanceKm: 12,
    durationSeconds: paceMinPerKm * 60 * 12,
    averagePaceMinPerKm: paceMinPerKm,
    slowZonesCount: 5,
    gpsWeakPointsCount: 1,
  }));
}

function passage(overrides: Partial<CollectivePassage> = {}): CollectivePassage {
  return {
    passageId: `legacy-passage-${overrides.userIdHash ?? 'u0'}`,
    userIdHash: 'u0',
    segmentId: 77,
    direction: 'forward',
    observedDurationS: 120,
    expectedDurationS: 100,
    quality: 0.9,
    observedAt: '2026-09-10T10:00:00.000Z',
    conditionBucket: 'dry',
    uturnDetected: false,
    offRoute: false,
    ...overrides,
  };
}

describe('Migration du prototype TrailIntelligenceEngine — TEST-A4-LEG', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TEST-A4-LEG-01: plus de Math.random, résultats identiques sur appels répétés', () => {
    const randomSpy = vi.spyOn(Math, 'random');

    const first = TrailIntelligenceEngine.anonymizeHikeSession(session());
    const second = TrailIntelligenceEngine.anonymizeHikeSession(session());

    expect(randomSpy).not.toHaveBeenCalled();
    expect(first).toEqual(second);
    expect(first.anonymizedSessionId).toMatch(/^anon-[0-9a-f]+$/);
    expect(first.anonymizedSessionId).not.toContain('user-legacy-1');

    const trail: Trail = { id: 'trail-1', name: 'Lac', difficulty: 'Facile', duration_hours: 2 };
    const reportA = TrailIntelligenceEngine.processTrailTelemetry('trail-1', trail, samples(12), {
      now: NOW,
    });
    const reportB = TrailIntelligenceEngine.processTrailTelemetry('trail-1', trail, samples(12), {
      now: NOW,
    });

    expect(reportA).toEqual(reportB);
    expect(reportA.proposedCorrections).toEqual(reportB.proposedCorrections);
    expect(reportA.proposedCorrections[0].createdAt).toBe(NOW);
  });

  it('TEST-A4-LEG-02: façade rétrocompatible et entrée par segment (moteur A4)', () => {
    const trail: Trail = { id: 'trail-1', name: 'Lac', difficulty: 'Facile', duration_hours: 2 };
    const report = TrailIntelligenceEngine.processTrailTelemetry('trail-1', trail, samples(12));

    // Façade route-level historique inchangée.
    expect(report.sampleCount).toBe(12);
    expect(report.observedAveragePaceMinPerKm).toBe(20);
    expect(report.observedDifficulty).toBe('Difficile');
    expect(report.proposedCorrections.length).toBeGreaterThanOrEqual(1);
    expect(report.proposedCorrections[0].status).toBe('pending_review');
    expect(report.proposedCorrections[0].id).toContain('trail-1');

    // Entrée par segment : délégation directe au moteur pur A4.
    const passages = Array.from({ length: 6 }, (_, index) =>
      passage({ passageId: `p-${index}`, userIdHash: `user-${index}` })
    );
    const aggregate = TrailIntelligenceEngine.processSegmentAggregates(77, passages, { now: NOW });

    expect(aggregate).not.toBeNull();
    expect(aggregate).toMatchObject({ segmentId: 77, distinctUserCount: 6, direction: 'forward' });
    expect(aggregate?.confidence.method).toBe('collective_weighted_median_a4');
    expect(
      TrailIntelligenceEngine.processSegmentAggregates(999, passages, { now: NOW })
    ).toBeNull();

    // Quand des passages sont fournis, la façade délègue aussi au moteur A4.
    const withCollective = TrailIntelligenceEngine.processTrailTelemetry(
      'trail-1',
      trail,
      samples(12),
      { now: NOW, passages }
    );
    expect(withCollective.collectiveAggregates).toHaveLength(1);
    expect(withCollective.collectiveAggregates?.[0].passageCount).toBe(6);
  });
});
