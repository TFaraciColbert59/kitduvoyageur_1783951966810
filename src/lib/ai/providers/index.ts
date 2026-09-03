import type { AIProvider } from './types';
import { openrouterProvider } from './openrouter';
import { noopProvider } from './noop';

/**
 * Sélecteur de provider — LE point d'extension unique.
 * Brancher Claude/GPT/local demain = écrire un adapter ici et l'ajouter au choix.
 * Aucun autre fichier ne choisit de provider.
 */
export function getProvider(): AIProvider {
  if (openrouterProvider.isAvailable()) {
    return openrouterProvider;
  }
  return noopProvider;
}

export { openrouterProvider, noopProvider };
export { MODEL_BY_TIER, modelFor } from './openrouter';
export type { AIProvider, AIRequest, AIResponse, AITier } from './types';
export { ProviderError } from './types';
