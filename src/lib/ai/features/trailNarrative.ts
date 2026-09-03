import type { AIRequest, AIResponse } from '../providers/types';

/**
 * Feature « trail-narrative » — récit post-randonnée (Chantier C).
 * tier heavy (Ultra raisonne), cache quasi-infini : un récit ne change JAMAIS.
 * Traitée ASYNCHRONEMENT via ai_jobs + cron — jamais synchrone à la fermeture.
 */

export const TRAIL_NARRATIVE_SPEC = {
  tier: 'heavy' as const,
  maxReasoningBudget: 6000,
  cacheTtlSeconds: 31_536_000, // 1 an — un récit est immuable
  maxPerUserPerDay: 5,
};

/** Fallback déterministe : sobre, jamais vide, jamais de crash. */
export function buildNarrativeFallback(stats: {
  distanceKm: number;
  elevationGainM: number;
  durationSeconds: number;
  routeName?: string;
}): string {
  const hours = Math.floor(stats.durationSeconds / 3600);
  const minutes = Math.round((stats.durationSeconds % 3600) / 60);
  const duration = hours > 0 ? `${hours} h ${minutes.toString().padStart(2, '0')}` : `${minutes} min`;

  const route = stats.routeName ? ` (${stats.routeName})` : '';
  return (
    `Sortie de ${stats.distanceKm.toFixed(1)} km, D+ ${Math.round(stats.elevationGainM)} m, ` +
    `durée ${duration}${route}. Le récit détaillé sera disponible dès que l'assistant ` +
    `IA reprendra du service — vos données sont bien enregistrées.`
  );
}

export async function fallbackResponse(_req: AIRequest): Promise<AIResponse> {
  return {
    text: buildNarrativeFallback({
      distanceKm: 0,
      elevationGainM: 0,
      durationSeconds: 0,
    }),
    model: 'fallback-deterministe',
    degraded: true,
    cached: false,
    provider: 'fallback',
  };
}
