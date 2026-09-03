import { describe, it, expect } from 'vitest';

import { FEATURES, getFeature } from '../../src/lib/ai/features/registry';
import type { AIRequest, AIResponse } from '../../src/lib/ai/providers/types';

function dummyReq(feature: string): AIRequest {
  return {
    feature,
    tier: 'heavy',
    system: 'sys',
    prompt: 'prompt de test',
    maxTokens: 1024,
  };
}

const EXPECTED_SPECS: Record<string, { tier: string; maxReasoningBudget: number; cacheTtlSeconds: number; maxPerUserPerDay: number }> = {
  'kit-configurator': { tier: 'heavy', maxReasoningBudget: 4000, cacheTtlSeconds: 0, maxPerUserPerDay: 10 },
  'trail-narrative': { tier: 'heavy', maxReasoningBudget: 6000, cacheTtlSeconds: 31_536_000, maxPerUserPerDay: 5 },
  'country-guides': { tier: 'heavy', maxReasoningBudget: 2000, cacheTtlSeconds: 2_592_000, maxPerUserPerDay: 30 },
  'chat-completion': { tier: 'heavy', maxReasoningBudget: 4096, cacheTtlSeconds: 0, maxPerUserPerDay: 100 },
  diagnostic: { tier: 'heavy', maxReasoningBudget: 512, cacheTtlSeconds: 0, maxPerUserPerDay: 50 },
};

describe('src/lib/ai/features/registry — registre des features IA', () => {
  it('TEST-REG-01: les 5 features sont déclarées avec leurs specs exactes', () => {
    expect(Object.keys(FEATURES).sort()).toEqual(Object.keys(EXPECTED_SPECS).sort());

    for (const [name, spec] of Object.entries(EXPECTED_SPECS)) {
      const declared = FEATURES[name];
      expect(declared, `feature ${name} manquante`).toBeDefined();
      expect(declared.tier).toBe(spec.tier);
      expect(declared.maxReasoningBudget).toBe(spec.maxReasoningBudget);
      expect(declared.cacheTtlSeconds).toBe(spec.cacheTtlSeconds);
      expect(declared.maxPerUserPerDay).toBe(spec.maxPerUserPerDay);
    }
  });

  it('TEST-REG-02: chaque fallbackResponse résout un AIResponse dégradé valide (jamais de throw)', async () => {
    for (const [name, spec] of Object.entries(FEATURES)) {
      const result: AIResponse = await spec.fallbackResponse(dummyReq(name));
      expect(typeof result.text, `fallback ${name} sans texte`).toBe('string');
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.degraded).toBe(true);
      expect(result.cached).toBe(false);
      expect(result.provider).toBe('fallback');
    }
  });

  it('TEST-REG-03: fallbacks spécifiques — narrative template, guides mention sobre', async () => {
    const narrative = await FEATURES['trail-narrative'].fallbackResponse(dummyReq('trail-narrative'));
    expect(narrative.text).toMatch(/Sortie de/);

    const guides = await FEATURES['country-guides'].fallbackResponse(dummyReq('country-guides'));
    expect(guides.text).toMatch(/éponse standard/i);
  });

  it('TEST-REG-04: getFeature retourne la spec, throw sur feature inconnue', () => {
    expect(getFeature('kit-configurator')).toBe(FEATURES['kit-configurator']);
    expect(() => getFeature('feature-fantome')).toThrow(/feature-fantome/);
  });
});
