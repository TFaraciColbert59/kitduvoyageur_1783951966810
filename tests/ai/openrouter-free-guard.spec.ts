import { describe, it, expect } from 'vitest';
import { assertAllowedModel, MODEL_BY_TIER } from '../../src/lib/ai/providers/openrouter';
import { ProviderError } from '../../src/lib/ai/providers/types';

/**
 * Garde-fou de coût (décision du 2026-10-07 : Nemotron 3.5 Lightning payant
 * sur OpenRouter) : seul le modèle de la liste blanche part sur le réseau.
 */
describe('openrouter — liste blanche de modèles', () => {
  it('les modèles configurés sont Nemotron 3.5 Lightning (payant)', () => {
    for (const [tier, model] of Object.entries(MODEL_BY_TIER)) {
      expect(model, tier).toBe('nvidia/nemotron-3.5-lightning');
    }
  });

  it('accepte le modèle autorisé et le retourne tel quel', () => {
    expect(assertAllowedModel('nvidia/nemotron-3.5-lightning')).toBe('nvidia/nemotron-3.5-lightning');
  });

  it('refuse tout autre modèle avant tout appel réseau', () => {
    expect(() => assertAllowedModel('openai/gpt-4o')).toThrow(ProviderError);
    expect(() => assertAllowedModel('nvidia/nemotron-3-ultra-550b-a55b')).toThrow(ProviderError);
    expect(() => assertAllowedModel('nvidia/nemotron-3.5-lightning:free-tier')).toThrow(ProviderError);
  });
});
