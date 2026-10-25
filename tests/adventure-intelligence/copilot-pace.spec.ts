import { describe, it, expect, vi } from 'vitest';
import { CopilotEngine, type HikeContextSummary } from '@/features/hiking/copilot/CopilotEngine';

function context(paceMinPerKm: number): HikeContextSummary {
  return {
    distanceKm: 6.5,
    durationSeconds: 5400,
    paceMinPerKm,
  };
}

describe('Copilote — résolveur d’allure optionnel (TEST-A3-COP)', () => {
  it('TEST-A3-COP-01: sans résolveur, le comportement historique 15 min/km reste identique', () => {
    const slow = CopilotEngine.generateAnswer('Est-ce que je suis en retard ?', context(21));
    expect(slow).toContain('prévoyez un peu plus de temps');

    const fast = CopilotEngine.generateAnswer('Est-ce que je suis en retard ?', context(12));
    expect(fast).toContain('Excellente allure');

    // Référence historique exacte : 20 − 15 = 5, pas > 5 ⇒ pas d'alerte.
    const boundary = CopilotEngine.generateAnswer('Est-ce que je suis en retard ?', context(20));
    expect(boundary).toContain('Excellente allure');
    expect(boundary).toContain('20.0 min/km');
  });

  it('TEST-A3-COP-02: résolveur injecté utilisé, repli sûr sur 15 si null/invalide', () => {
    const resolver = vi.fn(() => ({ paceMinPerKm: 25 }));
    const personalized = CopilotEngine.generateAnswer(
      'Est-ce que je suis en retard ?',
      context(21),
      resolver
    );

    expect(resolver).toHaveBeenCalledTimes(1);
    expect(resolver).toHaveBeenCalledWith(expect.objectContaining({ distanceKm: 6.5 }));
    // 21 − 25 = −4 ⇒ dans les temps selon le profil appris.
    expect(personalized).toContain('Excellente allure');

    const nullResolver = vi.fn(() => null);
    const fallback = CopilotEngine.generateAnswer(
      'Est-ce que je suis en retard ?',
      context(21),
      nullResolver
    );
    expect(nullResolver).toHaveBeenCalledTimes(1);
    expect(fallback).toContain('prévoyez un peu plus de temps');

    const invalidResolver = vi.fn(() => ({ paceMinPerKm: 0 }));
    const invalid = CopilotEngine.generateAnswer(
      'Est-ce que je suis en retard ?',
      context(21),
      invalidResolver
    );
    expect(invalid).toContain('prévoyez un peu plus de temps');
  });
});
