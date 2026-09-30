/**
 * Appel provider de la narration Nemotron (T2) — SERVEUR UNIQUEMENT.
 *
 * Ce fichier est le SEUL endroit du chantier trajectoire qui touche a un
 * provider. Il porte `import 'server-only'` : l'oublier rendrait le bundle
 * client invalide, puisque `askAI` transporte lui-meme cette contrainte.
 *
 * Tout le raisonnement — forme attendue, prompt, controle anti-invention —
 * vit dans `grounding.ts`, qui est pur. Ce module ne fait que trois choses :
 * appeler le provider, appliquer la porte, emballer le resultat. Il ne
 * decide rien, donc il n'a rien a lui-meme de testable.
 *
 * Il ne leve jamais. Une erreur reseau, un quota epuise, un JSON invalide ou
 * un chiffre injustifie rendent tous `null` : c'est la seule facon de tenir
 * « jamais bloquante ». Si ce module levait, l'appelant devrait faire un
 * try/catch, et un oubli dans un `useEffect` devient un ecran casse.
 */

import 'server-only';

import { askAI } from '@/lib/ai/askAI';
import type { AIResponse } from '@/lib/ai/providers/types';

import type { TrajectoireSnapshot } from '../domain/types';

import {
  buildNarrationResult,
  groundNarration,
  NARRATION_MAX_TOKENS,
  parseModelNarration,
  stateForPrompt,
  SYSTEM_PROMPT,
  type NarrationResult,
} from './grounding';

// Re-export : le contrat public du module reste `modelNarration`, ce qui evite
// de casser les appelants et la suite de tests existants.
export * from './grounding';

/**
 * Demande une narration au modele, sans jamais faire echouer l'appelant.
 *
 * Toute erreur — reseau, quota, JSON invalide, chiffre non justifie — se
 * transforme en `null`.
 */
export async function requestModelNarration(
  snapshot: TrajectoireSnapshot,
  signal?: AbortSignal
): Promise<NarrationResult | null> {
  // Abandon AVANT tout appel : si le curseur a deja bouge, inutile de payer
  // un jeton pour decrire un etat que l'utilisateur a quitte.
  if (signal?.aborted) return null;

  const prompt = JSON.stringify(stateForPrompt(snapshot));

  let response: AIResponse;
  try {
    response = await askAI({
      feature: 'trajectoire-narration',
      tier: 'fast',
      system: SYSTEM_PROMPT,
      prompt,
      maxTokens: NARRATION_MAX_TOKENS,
      cacheTtlSeconds: 3600,
      ...(signal ? { signal } : {}),
    });
  } catch {
    // Provider muet, quota epuise, registre inconnu : le gabarit reste.
    return null;
  }

  if (response.degraded) return null;

  const shape = parseModelNarration(response.text);
  if (!shape) return null;
  if (!groundNarration(shape, snapshot)) return null;

  return buildNarrationResult(shape, response.model);
}
