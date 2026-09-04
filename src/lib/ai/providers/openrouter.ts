import type { AIProvider, AIRequest, AITier } from './types';
import { ProviderError } from './types';

/**
 * Adapter OpenRouter — NVIDIA Nemotron (tier :free).
 * 20 req/min, 50/jour par défaut (1000/jour avec ≥ 10 $ de crédits).
 * La clé n'est JAMAIS loggée ni incluse dans une erreur.
 */

export const MODEL_BY_TIER: Record<AITier, string> = {
  heavy: 'nvidia/nemotron-3-ultra-550b-a55b:free',
  // NB : nemotron-3-nano-30b-a3b:free a été retiré d'OpenRouter (404, 2026-09-03)
  // → remplacé par la génération 3.5 la plus rapide disponible en :free.
  fast: 'nvidia/nemotron-3.5-lightning:free',
};

export function modelFor(tier: AITier): string {
  return MODEL_BY_TIER[tier];
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_MS: Record<AITier, number> = { fast: 45_000, heavy: 60_000 };
/**
 * Chez les modèles à raisonnement (Nemotron Ultra), les tokens de raisonnement
 * comptent DANS max_tokens : sans buffer, le budget est épuisé par le
 * raisonnement et la réponse finale est vide (smoke test 2026-09-03).
 */
const MIN_COMPLETION_BUFFER = 512;
const MIN_REASONING = 64;

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

    // Raisonnement :
    // - heavy (Ultra, modèle de raisonnement) : budget fourni raboté pour garantir
    //   un buffer de complétion (sinon réponse vide — cf. smoke 2026-09-03).
    // - fast (modèles rapides type lightning) : raisonnement DÉSACTIVÉ — leur CoT
    //   inline multipliait la latence par 6 (12-19 s → 2 s) et polluait le contenu.
    const reasoning =
      req.tier === 'heavy'
        ? (() => {
            const effective = req.reasoningBudget
              ? Math.min(req.reasoningBudget, req.maxTokens - MIN_COMPLETION_BUFFER)
              : undefined;
            return effective && effective >= MIN_REASONING ? { max_tokens: effective } : undefined;
          })()
        : { enabled: false, exclude: true };

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
          ...(reasoning ? { reasoning } : {}),
          ...(req.plugins && req.plugins.length > 0 ? { plugins: req.plugins } : {}),
        }),
      });

      if (!res.ok) {
        throw new ProviderError(`OpenRouter HTTP ${res.status}`, res.status);
      }

      const data = await res.json();

      // OpenRouter peut répondre 200 avec une erreur embarquée (upstream en panne).
      if (data?.error) {
        throw new ProviderError(
          `OpenRouter: ${data.error.message ?? 'erreur upstream'}`,
          typeof data.error.code === 'number' ? data.error.code : 502
        );
      }

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
