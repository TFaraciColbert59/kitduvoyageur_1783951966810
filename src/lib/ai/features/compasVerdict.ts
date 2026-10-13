import type { AIRequest, AIResponse } from '../providers/types';

/**
 * Feature « compas-verdict » — l'IA EXPLIQUE le verdict du Compas.
 *
 * Le niveau et les signaux viennent du moteur ; le modèle ne fait que les
 * reformuler pour un humain. Sa réponse est relue par
 * `features/compas/engine/verdictExplain.checkExplanation` : un nombre absent
 * des faits, un score ou une réassurance la font écarter.
 *
 * tier `fast`, raisonnement coupé. Cache d'un jour (plan 1.7) : les faits
 * (niveau, signaux, météo, étapes) sont toute la demande, donc la clé ; une
 * réponse n'est reprise que pour exactement les mêmes faits.
 */

export const COMPAS_VERDICT_SPEC = {
  tier: 'fast' as const,
  maxReasoningBudget: 0,
  cacheTtlSeconds: 86_400,
  maxPerUserPerDay: 30,
};

export function buildCompasVerdictSystem(): string {
  return [
    'Tu expliques en francais, a une personne qui prepare une sortie en montagne, le verdict calcule par une application.',
    'Regles imperatives :',
    '1. Deux phrases courtes, 350 caracteres au plus, texte simple sans liste, sans titre ni markdown.',
    '2. Tu n utilises QUE les faits fournis. Aucun nombre, lieu, horaire, conseil chiffre ou equipement qui n y figure pas.',
    '3. Tu ne changes jamais le niveau decide ; tu ne donnes aucun score ni aucune note.',
    '4. Tu ne rassures pas au-dela des faits : jamais « sans danger », « aucun risque », « en toute securite ».',
    '5. Tu dis ce qui n a pas pu etre verifie quand les faits le mentionnent.',
  ].join('\n');
}

export function buildCompasVerdictPrompt(facts: string): string {
  return `Faits (seule source autorisee) :\n${facts}\n\nExplique ce verdict.`;
}

export async function fallbackResponse(_req: AIRequest): Promise<AIResponse> {
  // Jamais affiché comme une explication : l'action détecte `degraded`.
  return {
    text: 'Explication indisponible.',
    model: 'fallback-deterministe',
    degraded: true,
    cached: false,
    provider: 'fallback',
  };
}
