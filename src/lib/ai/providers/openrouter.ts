import type { AIProvider, AIRequest, AITier } from './types';
import { ProviderError } from './types';

/**
 * Adapter OpenRouter — NVIDIA Nemotron (tier :free).
 * 20 req/min, 50/jour par défaut (1000/jour avec ≥ 10 $ de crédits).
 * La clé n'est JAMAIS loggée ni incluse dans une erreur.
 */

export const MODEL_BY_TIER: Record<AITier, string> = {
  heavy: 'nvidia/nemotron-3-ultra-550b-a55b:free',
  fast: 'nvidia/nemotron-3-nano-30b-a3b:free',
};

export function modelFor(tier: AITier): string {
  return MODEL_BY_TIER[tier];
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_MS: Record<AITier, number> = { fast: 8_000, heavy: 45_000 };

function openRouterHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.com',
    'X-Title': 'LKDV',
  };
}

export const openrouterProvider: AIProvider = {
  name: 'openrouter',

  isAvailable(): boolean {
    return !!process.env.OPENROUTER_API_KEY;
  },

  async complete(req: AIRequest): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new ProviderError('Clé OpenRouter absente', 503);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS[req.tier]);

    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: openRouterHeaders(apiKey),
        signal: controller.signal,
        body: JSON.stringify({
          model: MODEL_BY_TIER[req.tier],
          max_tokens: req.maxTokens,
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.prompt },
          ],
          // Raisonnement UNIQUEMENT pour Ultra (heavy) ET si un budget est fourni.
          ...(req.tier === 'heavy' && req.reasoningBudget
            ? { reasoning: { max_tokens: req.reasoningBudget } }
            : {}),
        }),
      });

      if (!res.ok) {
        throw new ProviderError(`OpenRouter HTTP ${res.status}`, res.status);
      }

      const data = await res.json();
      const content: unknown = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.trim().length === 0) {
        throw new ProviderError('OpenRouter: réponse vide', 502);
      }
      return content;
    } finally {
      clearTimeout(timer);
    }
  },
};
