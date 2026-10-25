import { z } from 'zod';
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

/** Payload d'un job « trail-narrative » (shape de useHikingStore, réduit aux stats). */
export const trailNarrativeJobSchema = z.object({
  sessionId: z.string().uuid(),
  distanceKm: z.number().min(0).max(500),
  durationSeconds: z.number().int().min(0).max(60 * 60 * 24 * 30),
  elevationGainM: z.number().min(0).max(20_000),
  routeName: z.string().max(200).optional(),
  weather: z.string().max(200).optional(),
  startedAt: z.string().max(60).optional(),
});

export type TrailNarrativeJobPayload = z.output<typeof trailNarrativeJobSchema>;

export function buildNarrativePrompt(stats: TrailNarrativeJobPayload): { system: string; prompt: string } {
  const system =
    "Tu es la plume du carnet de voyage de LKDV (Le Kit du Voyageur). Tu écris en français, " +
    'à la première personne, comme un randonneur qui raconte sa sortie le soir au refuge. ' +
    'Réponds avec le récit uniquement : pas de JSON, pas de markdown, pas de titre, pas de liste à puces.';

  const hours = Math.floor(stats.durationSeconds / 3600);
  const minutes = Math.round((stats.durationSeconds % 3600) / 60);
  const durationLabel = `${hours} h ${minutes.toString().padStart(2, '0')}`;

  const prompt = `Rédige un récit de randonnée de 150 à 250 mots à partir de ces données réelles :

- Distance : ${stats.distanceKm.toFixed(1)} km
- Dénivelé positif : ${Math.round(stats.elevationGainM)} m
- Durée : ${durationLabel}
- Itinéraire : ${stats.routeName ?? 'sortie libre, itinéraire non nommé'}
- Météo : ${stats.weather ?? 'non relevée'}

Consignes : évoque le rythme de la journée, l'effort du dénivelé, l'ambiance météo, et une ouverture sur le souvenir qu'on gardera de cette sortie. Reste factuel sur les chiffres (ne les invente pas), poétique sur le reste. Pas de liste à puces, une seule suite de paragraphes.`;

  return { system, prompt };
}

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
