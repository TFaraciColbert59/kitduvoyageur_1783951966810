import type { AIRequest, AIResponse } from '../providers/types';
import * as kitConfigurator from './kitConfigurator';
import * as trailNarrative from './trailNarrative';
import * as countryGuides from './countryGuides';

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
  'country-guides': {
    tier: countryGuides.COUNTRY_GUIDES_SPEC.tier,
    maxReasoningBudget: countryGuides.COUNTRY_GUIDES_SPEC.maxReasoningBudget,
    cacheTtlSeconds: countryGuides.COUNTRY_GUIDES_SPEC.cacheTtlSeconds,
    maxPerUserPerDay: countryGuides.COUNTRY_GUIDES_SPEC.maxPerUserPerDay,
    fallbackResponse: countryGuides.fallbackResponse,
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
