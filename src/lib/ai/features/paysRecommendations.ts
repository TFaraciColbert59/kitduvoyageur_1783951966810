import type { AIRequest, AIResponse } from '../providers/types';

/**
 * Feature « pays-recommendations » — synthèse courte personnalisée pour une
 * section Pays, à partir de données RÉELLES (spots, itinéraires, sentiers,
 * saison, profil). Le cache 30 j est le modèle économique : coût marginal nul.
 * Le fallback est volontairement vide + degraded : l'appelant conserve alors
 * ses recommandations déterministes (aucun texte inventé).
 */

export const PAYS_RECOMMENDATIONS_SPEC = {
  tier: 'fast' as const,
  maxReasoningBudget: 0,
  cacheTtlSeconds: 2_592_000, // 30 jours
  maxPerUserPerDay: 200,
};

export interface PaysRecommendationPromptInput {
  countryName: string;
  level: 'facile' | 'modere' | 'expert';
  duration: 'weekend' | 'semaine' | 'expedition';
  month: number;
  seasonLabel: string | null;
  spotTitles: string[];
  itineraryTitles: string[];
  trailTitles: string[];
}

const LEVEL_LABEL: Record<PaysRecommendationPromptInput['level'], string> = {
  facile: 'débutant',
  modere: 'intermédiaire',
  expert: 'expérimenté',
};

const DURATION_LABEL: Record<PaysRecommendationPromptInput['duration'], string> = {
  weekend: 'un week-end',
  semaine: 'une semaine',
  expedition: 'une expédition longue',
};

export function buildRecommendationPrompt(input: PaysRecommendationPromptInput): {
  system: string;
  prompt: string;
} {
  const system =
    'Tu es un conseiller de voyage outdoor LKDV. Tu écris en français, en 2 phrases maximum, ' +
    'au ton sobre et concret. Tu ne cites QUE les éléments fournis : n’invente aucun lieu, ' +
    'aucun prix, aucune règle. Pas de markdown, pas de liste.';

  const prompt = `Pays : ${input.countryName}
Profil du voyageur : niveau ${LEVEL_LABEL[input.level]}, disponibilité ${DURATION_LABEL[input.duration]}, mois ${input.month}.
Période conseillée (donnée réelle) : ${input.seasonLabel ?? 'non renseignée'}.
Spots réels : ${input.spotTitles.slice(0, 4).join(' · ') || 'non renseignés'}.
Itinéraires réels : ${input.itineraryTitles.slice(0, 3).join(' · ') || 'non renseignés'}.
Sentiers réels à proximité : ${input.trailTitles.slice(0, 3).join(' · ') || 'non renseignés'}.

Écris une phrase d’introduction qui relie le profil, la période et 1 à 2 de ces éléments, puis une phrase de conseil pratique.`;

  return { system, prompt };
}

/** Fallback non vide (jamais affiché : le service n'utilise pas les réponses dégradées). */
export async function fallbackResponse(_req: AIRequest): Promise<AIResponse> {
  return {
    text: 'Recommandations personnalisées momentanément indisponibles.',
    model: 'fallback-deterministe',
    degraded: true,
    cached: false,
    provider: 'fallback',
  };
}
