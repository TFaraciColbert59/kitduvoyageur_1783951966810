import type { AIRequest, AIResponse } from '../providers/types';

/**
 * Feature « compas-brief » — l'extraction du Brief du Compas v6.
 *
 * Le modèle LIT une demande et rend des variables avec le passage de la phrase qui
 * les justifie ; il ne fournit aucun fait (ni lieu, ni prix, ni date). Chaque valeur
 * est ensuite contrôlée mot pour mot contre la phrase (moteur du Brief, `parseExtraction`).
 * Décision D1 de Tony du 10/11/2026 : l'IA peut extraire le Brief ; l'extraction reste
 * derrière l'interrupteur COMPAS_V6_BRIEF (éteint par défaut).
 *
 * tier `fast`, raisonnement coupé : c'est de l'extraction. Cache à 0 : le cache partagé
 * d'`askAI` rangerait la phrase d'une personne ; le cache mémoire de l'appelant suffit.
 */

export const COMPAS_BRIEF_SPEC = {
  tier: 'fast' as const,
  maxReasoningBudget: 0,
  cacheTtlSeconds: 0,
  maxPerUserPerDay: 200,
};

/** Repli : un objet JSON vide, jamais une valeur (le Brief reste vide, le moteur de règles continue). */
export async function fallbackResponse(_req: AIRequest): Promise<AIResponse> {
  return {
    text: JSON.stringify({}),
    model: 'fallback-deterministe',
    degraded: true,
    cached: false,
    provider: 'fallback',
  };
}
