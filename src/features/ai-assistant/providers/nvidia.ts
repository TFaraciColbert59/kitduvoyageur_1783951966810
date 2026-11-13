/**
 * S2.37 — adaptateur du routeur IA LKDV (NVIDIA NIM en direct).
 *
 * Le bilan post-activité reste dans l'application : il passe par `askAI`,
 * donc par le quota, le plafond du site et le registre de features. Aucun
 * autre fournisseur n'est appelé ici.
 */

import { aiEnabled } from '@/lib/ai/aiMode';
import { askAI } from '@/lib/ai/askAI';
import type {
  AssistantCompletionPort,
  AssistantCompletionRequest,
  AssistantCompletionResult,
} from '../contracts';
import type { AssistantProviderEnv } from './external';

export const POST_ACTIVITY_AI_FEATURE = 'post-activity-insight';

export function createPostActivityProvider(
  userId: string,
  env: AssistantProviderEnv = process.env
): AssistantCompletionPort {
  const key = env.NVIDIA_API_KEY?.trim() ?? '';
  return {
    id: 'nvidia',
    isAvailable: () => key.length > 0 && aiEnabled(env as Record<string, string | undefined>),
    async complete(request: AssistantCompletionRequest): Promise<AssistantCompletionResult> {
      if (!key) throw new Error('clé NVIDIA absente');
      const result = await askAI({
        feature: POST_ACTIVITY_AI_FEATURE,
        tier: 'fast',
        system: request.system,
        prompt: request.prompt,
        maxTokens: request.maxTokens,
        cacheTtlSeconds: 0,
        userId,
      });
      if (result.degraded) {
        throw new Error(result.failureReason ?? 'provider_indisponible');
      }
      return { text: result.text, provider: result.provider, model: result.model };
    },
  };
}
