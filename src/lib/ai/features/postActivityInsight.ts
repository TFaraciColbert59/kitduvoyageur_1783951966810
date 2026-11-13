import type { AIRequest, AIResponse } from '../providers/types';
import { ACTIVITY_INSIGHT_SYSTEM_PROMPT } from '@/features/ai-assistant/activity/postActivityInsight';

/**
 * S2.37 — feature « post-activity-insight ».
 * Un bilan personnel n'est jamais mis en cache partagé. Le repli est explicite :
 * aucune phrase chiffrée n'est fabriquée ici, le service A08 rend déjà sa vue
 * déterministe avant d'appeler l'IA.
 */

export const POST_ACTIVITY_INSIGHT_SPEC = {
  tier: 'fast' as const,
  maxReasoningBudget: 512,
  cacheTtlSeconds: 0,
  maxPerUserPerDay: 40,
};

export { ACTIVITY_INSIGHT_SYSTEM_PROMPT };

export async function fallbackResponse(_req: AIRequest): Promise<AIResponse> {
  return {
    text: '',
    model: 'fallback-deterministe',
    degraded: true,
    cached: false,
    provider: 'fallback',
  };
}
