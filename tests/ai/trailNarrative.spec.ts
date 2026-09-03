import { describe, it, expect } from 'vitest';

import {
  TRAIL_NARRATIVE_SPEC,
  trailNarrativeJobSchema,
  buildNarrativePrompt,
  buildNarrativeFallback,
} from '../../src/lib/ai/features/trailNarrative';

const VALID_JOB = {
  sessionId: '7b0d3a1e-5c1e-4a4f-9c1d-2f3a4b5c6d7e',
  distanceKm: 14.3,
  durationSeconds: 5 * 3600 + 24 * 60,
  elevationGainM: 870,
  routeName: 'Lac Blanc par l\'Aiguillette',
  weather: 'Frais, brumeux',
  startedAt: '2026-09-03T07:12:00.000Z',
};

describe('src/lib/ai/features/trailNarrative — récit post-randonnée', () => {
  it('TEST-NAR-01: spec du registre — heavy, cache 1 an, 5/jour', () => {
    expect(TRAIL_NARRATIVE_SPEC).toEqual({
      tier: 'heavy',
      maxReasoningBudget: 6000,
      cacheTtlSeconds: 31_536_000,
      maxPerUserPerDay: 5,
    });
  });

  it('TEST-NAR-02: schema du payload de job — valide, puis rejette payloads cassés', () => {
    expect(trailNarrativeJobSchema.safeParse(VALID_JOB).success).toBe(true);

    expect(trailNarrativeJobSchema.safeParse({ ...VALID_JOB, sessionId: 'pas-un-uuid' }).success).toBe(false);
    expect(trailNarrativeJobSchema.safeParse({ ...VALID_JOB, distanceKm: -5 }).success).toBe(false);
    expect(trailNarrativeJobSchema.safeParse({ ...VALID_JOB, durationSeconds: '5h' }).success).toBe(false);
  });

  it('TEST-NAR-03: buildNarrativePrompt — stats injectées, ton carnet, pas de listes, JSON brut interdit', () => {
    const { system, prompt } = buildNarrativePrompt(VALID_JOB);

    expect(system).toMatch(/carnet de voyage/i);
    expect(system).toMatch(/JSON|markdown/i); // consigne de format
    expect(prompt).toContain('14.3');
    expect(prompt).toContain('870');
    expect(prompt).toContain('Lac Blanc');
    expect(prompt).toMatch(/150|250/); // consigne de longueur en mots
    expect(prompt).toMatch(/puce|liste/i); // interdiction des listes à puces
  });

  it('TEST-NAR-04: buildNarrativeFallback — template sobre, durée humaine, jamais vide', () => {
    const text = buildNarrativeFallback({
      distanceKm: 14.3,
      elevationGainM: 870,
      durationSeconds: 5 * 3600 + 24 * 60,
      routeName: 'Lac Blanc',
    });

    expect(text).toMatch(/Sortie de 14.3 km/);
    expect(text).toMatch(/D\+ 870 m/);
    expect(text).toMatch(/5 h 24/);
    expect(text).toContain('Lac Blanc');
  });

  it('TEST-NAR-05: buildNarrativeFallback — sans routeName ni données, reste lisible', () => {
    const text = buildNarrativeFallback({ distanceKm: 0, elevationGainM: 0, durationSeconds: 0 });

    expect(text).toMatch(/Sortie de 0.0 km/);
    expect(text.length).toBeGreaterThan(40);
  });
});
