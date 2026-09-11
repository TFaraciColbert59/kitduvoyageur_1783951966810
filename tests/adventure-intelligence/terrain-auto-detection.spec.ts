import { describe, it, expect } from 'vitest';
import {
  AUTO_DETECTION_SHADOW,
  AUTO_MIN_COLLECTIVE_PASSAGES,
  AUTO_MIN_OFF_ROUTE,
  AUTO_MIN_UTURNS,
  AUTO_SLOWDOWN_THRESHOLD,
  detectAutoCandidates,
} from '@/features/adventure-intelligence/domain/terrainAutoDetection';
import type { CollectivePassage } from '@/features/adventure-intelligence/domain/collectiveIntelligence';

const NOW = '2026-09-11T12:00:00.000Z';

function hoursAgo(hours: number): string {
  return new Date(Date.parse(NOW) - hours * 3600000).toISOString();
}

function passage(overrides: Partial<CollectivePassage> = {}): CollectivePassage {
  return {
    passageId: `p-${overrides.segmentId ?? 10}-${overrides.userIdHash ?? 'u1'}`,
    userIdHash: 'u1',
    segmentId: 10,
    direction: 'forward',
    observedDurationS: 100,
    expectedDurationS: 100,
    quality: 0.9,
    observedAt: hoursAgo(2),
    conditionBucket: 'dry',
    uturnDetected: false,
    offRoute: false,
    ...overrides,
  };
}

function slowPassages(segmentId: number, count: number, ratio: number): CollectivePassage[] {
  return Array.from({ length: count }, (_, index) =>
    passage({
      passageId: `p-${segmentId}-${index}`,
      userIdHash: `user-${index}`,
      segmentId,
      observedDurationS: 100 * ratio,
      expectedDurationS: 100,
    })
  );
}

describe('Terrain Live — détection automatique shadow (TEST-A5-AUTO)', () => {
  it('TEST-A5-AUTO-01: un ralentissement collectif ≥ 1,6× produit un candidat obstacle motivé', () => {
    const candidates = detectAutoCandidates({
      passages: [
        ...slowPassages(10, 3, 1.8),
        ...slowPassages(20, 3, 1.1),
      ],
    });

    const segment10 = candidates.filter((entry) => entry.segmentId === 10);
    expect(segment10).toHaveLength(1);
    expect(segment10[0].category).toBe('obstacle');
    expect(segment10[0].reason).toContain('ralentissement_collectif');
    expect(segment10[0].reason).toContain('1.80');
    expect(segment10[0].confidence).toBeGreaterThan(0);
    expect(segment10[0].confidence).toBeLessThanOrEqual(1);

    expect(candidates.some((entry) => entry.segmentId === 20)).toBe(false);
    expect(AUTO_SLOWDOWN_THRESHOLD).toBe(1.6);
    expect(AUTO_MIN_COLLECTIVE_PASSAGES).toBe(3);
  });

  it('TEST-A5-AUTO-02: demi-tours, sorties de trace et contournements sont détectés et motivés', () => {
    const candidates = detectAutoCandidates({
      passages: [
        // 3 demi-tours ⇒ fermeture probable.
        ...Array.from({ length: 3 }, (_, index) =>
          passage({
            passageId: `uturn-${index}`,
            segmentId: 31,
            userIdHash: `user-${index}`,
            uturnDetected: true,
          })
        ),
        // 3 sorties de trace ⇒ balisage manquant.
        ...Array.from({ length: 3 }, (_, index) =>
          passage({
            passageId: `offroute-${index}`,
            segmentId: 32,
            userIdHash: `user-${index}`,
            offRoute: true,
          })
        ),
        // 3 contournements ralentis (off-route, sans demi-tour) ⇒ obstacle.
        ...Array.from({ length: 3 }, (_, index) =>
          passage({
            passageId: `bypass-${index}`,
            segmentId: 33,
            userIdHash: `user-${index}`,
            offRoute: true,
            observedDurationS: 150,
            expectedDurationS: 100,
          })
        ),
      ],
    });

    const closure = candidates.find((entry) => entry.segmentId === 31);
    expect(closure?.category).toBe('closure');
    expect(closure?.reason).toContain('demi_tours_repetes_3');

    const marking = candidates.find((entry) => entry.segmentId === 32);
    expect(marking?.category).toBe('marking');
    expect(marking?.reason).toContain('sorties_de_trace_repetees_3');

    const obstacle = candidates.find(
      (entry) => entry.segmentId === 33 && entry.category === 'obstacle'
    );
    expect(obstacle?.category).toBe('obstacle');
    expect(obstacle?.reason).toContain('contournements_repetes_3');

    expect(AUTO_MIN_UTURNS).toBe(3);
    expect(AUTO_MIN_OFF_ROUTE).toBe(3);
  });

  it('TEST-A5-AUTO-03: toute détection reste en shadow, jamais publiée', () => {
    const candidates = detectAutoCandidates({ passages: slowPassages(10, 4, 2) });

    expect(AUTO_DETECTION_SHADOW).toBe(true);
    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(candidate.sourceType).toBe('auto');
      expect(candidate.shadow).toBe(true);
      expect(candidate).not.toHaveProperty('status');
      expect(candidate.sourceType).not.toBe('user');
      expect(JSON.stringify(candidate)).not.toContain('reporter');
    }
  });

  it('TEST-A5-AUTO-04: sous les seuils, aucun candidat n’est produit', () => {
    const candidates = detectAutoCandidates({
      passages: [
        ...slowPassages(10, 2, 2),
        ...Array.from({ length: 2 }, (_, index) =>
          passage({ passageId: `uturn-${index}`, segmentId: 11, uturnDetected: true })
        ),
        ...Array.from({ length: 2 }, (_, index) =>
          passage({ passageId: `off-${index}`, segmentId: 12, offRoute: true })
        ),
      ],
    });

    expect(candidates).toEqual([]);
  });
});
