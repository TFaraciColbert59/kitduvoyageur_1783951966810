import type { AIRequest, AIResponse } from '../providers/types';
import * as kitConfigurator from './kitConfigurator';
import * as trailNarrative from './trailNarrative';
import * as activityEnrichment from './activityEnrichment';
import * as countryGuides from './countryGuides';
import * as paysRecommendations from './paysRecommendations';
import * as itinerary from './itinerary';
import * as trajectoireNarration from './trajectoireNarration';
import * as trailAiEnrichment from './trailAiEnrichment';

/**
 * Registre des features IA — ajouter une feature IA = ajouter UN fichier
 * dans features/ + UNE entrée ici. Rien d'autre.
 * fallbackResponse est OBLIGATOIRE pour chaque feature : c'est ce qui rend
 * le système incassable (quota dépassé, provider tombé, congestion :free).
 */

export interface FeatureSpec {
  tier: 'heavy' | 'fast';
  maxReasoningBudget: number;
  cacheTtlSeconds: number; // 0 = pas de cache
  maxPerUserPerDay: number;
  fallbackResponse: (req: AIRequest) => Promise<AIResponse>; // JAMAIS de throw
}

/** Fallback générique pour les features techniques (chat, diagnostic). */
function technicalFallback(featureLabel: string) {
  return async (_req: AIRequest): Promise<AIResponse> => ({
    text: `${featureLabel} momentanément indisponible. Merci de réessayer dans un instant.`,
    model: 'fallback-deterministe',
    degraded: true,
    cached: false,
    provider: 'fallback',
  });
}

export const FEATURES: Record<string, FeatureSpec> = {
  'kit-configurator': {
    tier: kitConfigurator.KIT_CONFIGURATOR_SPEC.tier,
    maxReasoningBudget: kitConfigurator.KIT_CONFIGURATOR_SPEC.maxReasoningBudget,
    cacheTtlSeconds: kitConfigurator.KIT_CONFIGURATOR_SPEC.cacheTtlSeconds,
    maxPerUserPerDay: kitConfigurator.KIT_CONFIGURATOR_SPEC.maxPerUserPerDay,
    fallbackResponse: kitConfigurator.fallbackResponse,
  },
  'trail-narrative': {
    tier: trailNarrative.TRAIL_NARRATIVE_SPEC.tier,
    maxReasoningBudget: trailNarrative.TRAIL_NARRATIVE_SPEC.maxReasoningBudget,
    cacheTtlSeconds: trailNarrative.TRAIL_NARRATIVE_SPEC.cacheTtlSeconds,
    maxPerUserPerDay: trailNarrative.TRAIL_NARRATIVE_SPEC.maxPerUserPerDay,
    fallbackResponse: trailNarrative.fallbackResponse,
  },
  'activity-enrichment': {
    tier: activityEnrichment.ACTIVITY_ENRICHMENT_SPEC.tier,
    maxReasoningBudget: activityEnrichment.ACTIVITY_ENRICHMENT_SPEC.maxReasoningBudget,
    cacheTtlSeconds: activityEnrichment.ACTIVITY_ENRICHMENT_SPEC.cacheTtlSeconds,
    maxPerUserPerDay: activityEnrichment.ACTIVITY_ENRICHMENT_SPEC.maxPerUserPerDay,
    fallbackResponse: activityEnrichment.fallbackResponse,
  },
  'country-guides': {
    tier: countryGuides.COUNTRY_GUIDES_SPEC.tier,
    maxReasoningBudget: countryGuides.COUNTRY_GUIDES_SPEC.maxReasoningBudget,
    cacheTtlSeconds: countryGuides.COUNTRY_GUIDES_SPEC.cacheTtlSeconds,
    maxPerUserPerDay: countryGuides.COUNTRY_GUIDES_SPEC.maxPerUserPerDay,
    fallbackResponse: countryGuides.fallbackResponse,
  },
  'pays-recommendations': {
    tier: paysRecommendations.PAYS_RECOMMENDATIONS_SPEC.tier,
    maxReasoningBudget: paysRecommendations.PAYS_RECOMMENDATIONS_SPEC.maxReasoningBudget,
    cacheTtlSeconds: paysRecommendations.PAYS_RECOMMENDATIONS_SPEC.cacheTtlSeconds,
    maxPerUserPerDay: paysRecommendations.PAYS_RECOMMENDATIONS_SPEC.maxPerUserPerDay,
    fallbackResponse: paysRecommendations.fallbackResponse,
  },
  'trajectoire-narration': {
    tier: trajectoireNarration.TRAJECTOIRE_NARRATION_SPEC.tier,
    maxReasoningBudget: trajectoireNarration.TRAJECTOIRE_NARRATION_SPEC.maxReasoningBudget,
    cacheTtlSeconds: trajectoireNarration.TRAJECTOIRE_NARRATION_SPEC.cacheTtlSeconds,
    maxPerUserPerDay: trajectoireNarration.TRAJECTOIRE_NARRATION_SPEC.maxPerUserPerDay,
    fallbackResponse: trajectoireNarration.fallbackResponse,
  },
  'itinerary': {
    tier: itinerary.ITINERARY_SPEC.tier,
    maxReasoningBudget: itinerary.ITINERARY_SPEC.maxReasoningBudget,
    cacheTtlSeconds: itinerary.ITINERARY_SPEC.cacheTtlSeconds,
    maxPerUserPerDay: itinerary.ITINERARY_SPEC.maxPerUserPerDay,
    fallbackResponse: itinerary.fallbackResponse,
  },
  'trail-ai-enrichment': {
    tier: trailAiEnrichment.TRAIL_AI_ENRICHMENT_SPEC.tier,
    maxReasoningBudget: trailAiEnrichment.TRAIL_AI_ENRICHMENT_SPEC.maxReasoningBudget,
    cacheTtlSeconds: trailAiEnrichment.TRAIL_AI_ENRICHMENT_SPEC.cacheTtlSeconds,
    maxPerUserPerDay: trailAiEnrichment.TRAIL_AI_ENRICHMENT_SPEC.maxPerUserPerDay,
    fallbackResponse: trailAiEnrichment.fallbackResponse,
  },
  'country-practical-guide': {
    tier: 'fast',
    maxReasoningBudget: 0,
    cacheTtlSeconds: 2_592_000, // 30 jours
    maxPerUserPerDay: 100,
    fallbackResponse: async (_req: AIRequest): Promise<AIResponse> => ({
      text: JSON.stringify({
        content_md: "Informations pratiques temporairement indisponibles. Veuillez vérifier auprès de l'ambassade ou des services officiels.",
        sources: [],
      }),
      model: 'fallback-deterministe',
      degraded: true,
      cached: false,
      provider: 'fallback',
    }),
  },
  'chat-completion': {
    tier: 'heavy', // défaut déclaré — l'appelant passe toujours req.tier
    maxReasoningBudget: 4096,
    cacheTtlSeconds: 0,
    maxPerUserPerDay: 100,
    fallbackResponse: technicalFallback("L'assistant IA est"),
  },
  diagnostic: {
    tier: 'heavy',
    maxReasoningBudget: 512,
    cacheTtlSeconds: 0,
    maxPerUserPerDay: 50,
    fallbackResponse: technicalFallback('Le diagnostic IA est'),
  },
};

export function getFeature(name: string): FeatureSpec {
  const spec = FEATURES[name];
  if (!spec) {
    throw new Error(`[ai/registry] feature inconnue : ${name}`);
  }
  return spec;
}
