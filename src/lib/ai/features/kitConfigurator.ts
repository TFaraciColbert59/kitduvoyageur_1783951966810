import type { AIRequest, AIResponse } from '../providers/types';

/**
 * Feature « kit-configurator » — rapport de kit connecté (Chantier B).
 * tier heavy, SANS cache (kit = personnel), quota serré : rare par nature.
 * Le moteur déterministe décide ce qui manque ; l'IA explique et propose des
 * alternatives RÉELLES issues du catalogue — elle ne fabrique rien.
 */

export const KIT_CONFIGURATOR_SPEC = {
  tier: 'heavy' as const,
  maxReasoningBudget: 4000,
  cacheTtlSeconds: 0, // kit = personnel : pas de cache
  maxPerUserPerDay: 10,
};

export async function fallbackResponse(_req: AIRequest): Promise<AIResponse> {
  return {
    text:
      "Rapport de kit généré sans les justifications détaillées de l'assistant IA " +
      "(service momentanément indisponible). Les listes d'équipement, manques et " +
      'alertes restent fiables : elles proviennent du moteur déterministe.',
    model: 'fallback-deterministe',
    degraded: true,
    cached: false,
    provider: 'fallback',
  };
}
