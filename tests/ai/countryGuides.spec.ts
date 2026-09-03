import { describe, it, expect, vi, beforeEach } from 'vitest';

const { askAIMock, getCachedMock, setCachedMock } = vi.hoisted(() => ({
  askAIMock: vi.fn(),
  getCachedMock: vi.fn(async (..._args: unknown[]) => null as unknown),
  setCachedMock: vi.fn(async (..._args: unknown[]) => {}),
}));

vi.mock('../../src/lib/ai/askAI', () => ({ askAI: askAIMock }));
vi.mock('../../src/lib/ai/responseStore', () => ({
  getCached: getCachedMock,
  setCached: setCachedMock,
}));

import {
  COUNTRY_GUIDES_SPEC,
  COUNTRY_QUESTIONS,
  isSupportedCountry,
  buildGuidePrompt,
  buildCountryContext,
  buildGuideFallback,
} from '../../src/lib/ai/features/countryGuides';
import { generateForCountries } from '../../src/lib/ai/countryGuidesPregen';
import type { CountryDetail } from '../../src/lib/countryDetails';

const DETAIL: Partial<CountryDetail> = {
  nom: 'Népal',
  region: 'Asie',
  capitale: 'Katmandou',
  langue: 'Népali',
  langue_sub: '+ anglais dans le tourisme',
  monnaie_code: 'NPR',
  monnaie_nom: 'Roupie népalaise',
  saison_recommandee: 'Octobre–novembre, mars–avril',
};

describe('src/lib/ai/features/countryGuides — Q&R pays cache-first', () => {
  it('TEST-CG-01: spec — heavy, budget 2000, cache 30 j, 30/jour', () => {
    expect(COUNTRY_GUIDES_SPEC).toEqual({
      tier: 'heavy',
      maxReasoningBudget: 2000,
      cacheTtlSeconds: 2_592_000,
      maxPerUserPerDay: 30,
    });
  });

  it('TEST-CG-02: au moins 25 questions uniques et en français', () => {
    expect(COUNTRY_QUESTIONS.length).toBeGreaterThanOrEqual(25);
    expect(new Set(COUNTRY_QUESTIONS).size).toBe(COUNTRY_QUESTIONS.length);
    expect(COUNTRY_QUESTIONS.every((q) => /^[A-ZÉÀ]./.test(q))).toBe(true);
    // Questions canoniques du brief
    expect(COUNTRY_QUESTIONS.some((q) => /eau/i.test(q))).toBe(true);
    expect(COUNTRY_QUESTIONS.some((q) => /sécurit/i.test(q))).toBe(true);
    expect(COUNTRY_QUESTIONS.some((q) => /visa/i.test(q))).toBe(true);
  });

  it('TEST-CG-03: isSupportedCountry — codes du référentiel seulement', () => {
    expect(isSupportedCountry('FR')).toBe(true);
    expect(isSupportedCountry('fr')).toBe(true);
    expect(isSupportedCountry('NP')).toBe(true);
    expect(isSupportedCountry('XX')).toBe(false);
    expect(isSupportedCountry('')).toBe(false);
  });

  it('TEST-CG-04: buildCountryContext — faits du détail pays (monnaie, langue, saison)', () => {
    const context = buildCountryContext(DETAIL);

    expect(context).toContain('Népal');
    expect(context).toContain('Katmandou');
    expect(context).toContain('Népali');
    expect(context).toContain('NPR');
    expect(context).toContain('Octobre');
  });

  it('TEST-CG-05: buildGuidePrompt — question + contexte pays + consigne factuelle', () => {
    const { system, prompt } = buildGuidePrompt('Népal', 'L\'eau du robinet est-elle potable ?', buildCountryContext(DETAIL));

    expect(prompt).toContain('Népal');
    expect(prompt).toContain('eau du robinet');
    expect(system).toMatch(/guide de voyage/i);
    expect(system).toMatch(/n'invente jamais|incertaine/i);
  });

  it('TEST-CG-06: buildGuideFallback — faits statiques + mention sobre obligatoire', () => {
    const text = buildGuideFallback(DETAIL, 'Faut-il un visa pour le Népal ?');

    expect(text).toMatch(/réponse standard/i);
    expect(text).toContain('Népal');
    expect(text).toContain('Katmandou');
    expect(text).toContain('Roupie népalaise');

    const empty = buildGuideFallback(undefined, 'Question');
    expect(empty).toMatch(/réponse standard/i);
    expect(empty.length).toBeGreaterThan(30);
  });
});

describe('src/lib/ai/countryGuidesPregen — pré-génération du cache', () => {
  beforeEach(() => {
    askAIMock.mockReset().mockResolvedValue({
      text: 'Réponse pré-générée.', model: 'm', degraded: false, cached: false, provider: 'openrouter',
    });
    getCachedMock.mockReset().mockResolvedValue(null);
    setCachedMock.mockReset().mockResolvedValue(undefined);
  });

  it('TEST-CG-07: génère pays × questions (limite) et écrit le cache avec la TTL 30 j', async () => {
    const result = await generateForCountries({ countries: ['NP'], maxQuestions: 2 });

    expect(result.generated).toBe(2);
    expect(result.skipped).toBe(0);
    expect(askAIMock).toHaveBeenCalledTimes(2);
    expect(setCachedMock).toHaveBeenCalledWith(
      'country-guides',
      expect.stringContaining('Népal'),
      expect.objectContaining({ text: 'Réponse pré-générée.' }),
      2_592_000
    );
  });

  it('TEST-CG-08: cache encore valide → skip (pas d\'appel IA, pas d\'écriture)', async () => {
    getCachedMock.mockResolvedValue({ text: 'déjà là', model: 'm', degraded: false, cached: true, provider: 'openrouter' });

    const result = await generateForCountries({ countries: ['NP'], maxQuestions: 3 });

    expect(result.generated).toBe(0);
    expect(result.skipped).toBe(3);
    expect(askAIMock).not.toHaveBeenCalled();
    expect(setCachedMock).not.toHaveBeenCalled();
  });

  it('TEST-CG-09: IA dégradée → ni écriture ni comptage (retry au prochain run), pays inconnu → ignoré', async () => {
    askAIMock.mockResolvedValue({
      text: 'surcharge', model: 'fallback-deterministe', degraded: true, cached: false, provider: 'fallback',
    });

    const result = await generateForCountries({ countries: ['NP', 'XX'], maxQuestions: 1 });

    expect(result.generated).toBe(0);
    expect(setCachedMock).not.toHaveBeenCalled();
    expect(result.invalidCountries).toContain('XX');
  });
});
