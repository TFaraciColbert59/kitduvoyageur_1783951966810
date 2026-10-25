import { describe, it, expect } from 'vitest';
import {
  CANDIDATE_IDS,
  buildCandidates,
} from '@/features/adventure-intelligence/domain/candidates';

describe('A6 — candidats de variantes (TEST-A6-CAND)', () => {
  it('TEST-A6-CAND-01: buildCandidates produit exactement trois variantes nommées', () => {
    const candidates = buildCandidates({ days: 7, participantsCount: 2, month: 7 });

    expect(candidates).toHaveLength(3);
    expect(candidates.map((candidate) => candidate.id)).toEqual([...CANDIDATE_IDS]);
    expect(candidates.map((candidate) => candidate.id)).toEqual([
      'comfort',
      'balanced',
      'adventure',
    ]);
    for (const candidate of candidates) {
      expect(candidate.label.trim().length).toBeGreaterThan(0);
      expect(candidate.uncertainty).toBeGreaterThanOrEqual(0);
      expect(candidate.uncertainty).toBeLessThanOrEqual(1);
    }
  });

  it('TEST-A6-CAND-02: chaque variante est justifiée par des raisons non vides', () => {
    const candidates = buildCandidates();

    for (const candidate of candidates) {
      expect(Array.isArray(candidate.reasons)).toBe(true);
      expect(candidate.reasons.length).toBeGreaterThan(0);
      for (const reason of candidate.reasons) {
        expect(reason.trim().length).toBeGreaterThan(0);
      }
    }

    const adventure = candidates.find((candidate) => candidate.id === 'adventure');
    expect(adventure?.reasons.join(' ').toLowerCase()).toContain('autonomie');
  });

  it('TEST-A6-CAND-03: effort et risque croissent de comfort à adventure, le confort décroît', () => {
    const [comfort, balanced, adventure] = buildCandidates({ days: 10, participantsCount: 3 });

    expect(comfort.effortDeltaPct).toBeLessThan(balanced.effortDeltaPct);
    expect(balanced.effortDeltaPct).toBeLessThan(adventure.effortDeltaPct);

    expect(comfort.riskScore).toBeLessThan(balanced.riskScore);
    expect(balanced.riskScore).toBeLessThan(adventure.riskScore);

    expect(comfort.comfortScore).toBeGreaterThan(balanced.comfortScore);
    expect(balanced.comfortScore).toBeGreaterThan(adventure.comfortScore);

    expect(comfort.budgetDeltaPct).toBeGreaterThan(adventure.budgetDeltaPct);
  });
});
