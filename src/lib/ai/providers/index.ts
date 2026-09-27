import type { AIProvider } from './types';
import { openrouterProvider, modelFor } from './openrouter';
import { nvidiaProvider, nvidiaModelFor } from './nvidia';
import { noopProvider } from './noop';

/**
 * Sélecteur de provider — LE point d'extension unique.
 * Brancher Claude/GPT/local demain = écrire un adapter ici et l'ajouter au choix.
 * Aucun autre fichier ne choisit de provider.
 */
export function getProvider(tier?: 'heavy' | 'fast'): AIProvider {
  if (tier === 'fast' && nvidiaProvider.isAvailable()) {
    return nvidiaProvider;
  }
  if (openrouterProvider.isAvailable()) {
    return openrouterProvider;
  }
  if (nvidiaProvider.isAvailable()) {
    return nvidiaProvider;
  }
  return noopProvider;
}

export function modelNameFor(provider: AIProvider, tier: 'heavy' | 'fast'): string {
  if (provider.name === 'openrouter') return modelFor(tier);
  if (provider.name === 'nvidia') return nvidiaModelFor(tier);
  return provider.name;
}

export { openrouterProvider, nvidiaProvider, noopProvider };
export { MODEL_BY_TIER, modelFor } from './openrouter';
export { NIM_MODEL_BY_TIER, nvidiaModelFor } from './nvidia';
export type { AIProvider, AIRequest, AIResponse, AITier } from './types';
export { ProviderError } from './types';
