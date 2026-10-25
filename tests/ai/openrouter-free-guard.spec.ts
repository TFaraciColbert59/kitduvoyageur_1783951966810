import { describe, it, expect } from 'vitest';
import { assertFreeModel, MODEL_BY_TIER } from '../../src/lib/ai/providers/openrouter';
import { ProviderError } from '../../src/lib/ai/providers/types';

/**
 * Garde-fou « free uniquement » (Vague D — décision produit 2026-09-11) :
 * aucun appel OpenRouter ne doit jamais partir sur un modèle payant, même si
 * MODEL_BY_TIER est modifié par erreur.
 */
describe('openrouter — garde-fou :free', () => {
  it('tous les modèles configurés sont en tier :free', () => {
    for (const [tier, model] of Object.entries(MODEL_BY_TIER)) {
      expect(model.endsWith(':free'), `${tier} -> ${model}`).toBe(true);
    }
  });

  it('accepte un modèle :free et le retourne tel quel', () => {
    const model = 'nvidia/nemotron-3-ultra-550b-a55b:free';
    expect(assertFreeModel(model)).toBe(model);
  });

  it('refuse un modèle payant avant tout appel réseau', () => {
    expect(() => assertFreeModel('openai/gpt-4o')).toThrow(ProviderError);
    expect(() => assertFreeModel('nvidia/nemotron-3-ultra-550b-a55b')).toThrow(ProviderError);
  });

  it('refuse aussi un suffixe approchant (:free-tier ne matche pas)', () => {
    expect(() => assertFreeModel('vendor/model:free-tier')).toThrow(ProviderError);
  });
});
