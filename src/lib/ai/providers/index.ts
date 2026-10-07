import type { AIProvider } from './types';
import { openrouterProvider, modelFor } from './openrouter';
import { nvidiaProvider, nvidiaModelFor } from './nvidia';
import { noopProvider } from './noop';

/**
 * Sélecteur de provider — LE point d'extension unique.
 * Brancher Claude/GPT/local demain = écrire un adapter ici et l'ajouter au choix.
 * Aucun autre fichier ne choisit de provider.
 */
/**
 * Les providers A ESSAYER, dans l ordre, pour un tier donne.
 *
 * Pourquoi une chaine et pas un gagnant : `getProvider` choisissait sur la
 * seule PRESENCE d une cle. Une cle presente n est pas un service debout. Le
 * 2026-09-29, la cle NVIDIA etait la, l hote repondait en 0,2 s, et le modele
 * configure ne rendait rien : le tier `fast` etait servi par un provider muet,
 * sans aucune voie de recours, parce que le choix etait fige avant le premier
 * essai. Soixante-dix secondes d ecran fige, puis un parcours 100 % regles
 * presente comme une generation reussie.
 *
 * Décision du 2026-10-07 : OpenRouter (Nemotron 3.5 Lightning payant) d'abord,
 * NVIDIA direct en secours (offre d'évaluation, pas pour la production).
 * Une chaîne muette tombe sur `noop`, donc sur les règles.
 *
 * `noop` ferme toujours la chaine : sans lui, `askAI` n aurait plus ou
 * tomber, et une exception remonterait jusqu au preparateur — exactement ce que
 * `askAI` interdit par construction.
 */
export function providerChain(_tier?: 'heavy' | 'fast'): AIProvider[] {
  const disponibles: AIProvider[] = [];
  // Production : OpenRouter (Nemotron 3.5 Lightning payant) d'abord ; NVIDIA
  // direct (offre d'évaluation) seulement en secours.
  if (openrouterProvider.isAvailable()) disponibles.push(openrouterProvider);
  if (nvidiaProvider.isAvailable()) disponibles.push(nvidiaProvider);
  if (disponibles.length === 0) return [noopProvider];
  return [...disponibles, noopProvider];
}

/** Le premier provider de la chaine. Raccourci pour les appels uniques. */
export function getProvider(tier?: 'heavy' | 'fast'): AIProvider {
  return providerChain(tier)[0];
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
