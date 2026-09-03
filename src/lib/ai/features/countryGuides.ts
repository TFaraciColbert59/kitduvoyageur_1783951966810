import type { AIRequest, AIResponse } from '../providers/types';

/**
 * Feature « country-guides » — Q&R pays (Chantier D).
 * Le cache EST le modèle économique : réponses pré-générées hors trafic,
 * TTL 30 jours → ~90 % de cache HIT = instantané, gratuit, sans quota.
 */

export const COUNTRY_GUIDES_SPEC = {
  tier: 'heavy' as const,
  maxReasoningBudget: 2000,
  cacheTtlSeconds: 2_592_000, // 30 jours
  maxPerUserPerDay: 30,
};

export async function fallbackResponse(_req: AIRequest): Promise<AIResponse> {
  return {
    text:
      'Réponse standard — l\'assistant est très sollicité en ce moment. ' +
      'Consultez la fiche pays pour les informations essentielles (climat, monnaie, ' +
      'santé, sécurité) et reformulez votre question dans quelques instants.',
    model: 'fallback-deterministe',
    degraded: true,
    cached: false,
    provider: 'fallback',
  };
}
