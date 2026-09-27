import type { AIProvider, AIRequest, AITier } from './types';
import { ProviderError } from './types';

/**
 * Adapter NVIDIA NIM (build.nvidia.com) — endpoint gratuit, appel direct.
 *
 * Mete le Nemotron 3.5 Lightning en ACCES DIRECT, sans passer par OpenRouter :
 * meme famille de modele que le fallback `fast` d'openrouter.ts, mais la
 * requete ne transite plus par un tiers — pas de `HTTP-Referer` a transmettre,
 * pas de quota OpenRouter partage, et la cle vit chez NVIDIA.
 *
 * La cle n'est JAMAIS loggee ni incluse dans une erreur : `ProviderError` ne
 * transporte qu'un statut et un message redige, comme pour l'adapter OpenRouter.
 *
 * Portee : l'endpoint gratuit build.nvidia.com ne sert QUE ce modele. Le tier
 * `heavy` n'atteint donc cet adapter qu'en dernier recours, quand aucune cle
 * OpenRouter n'est configuree (cf. `getProvider(tier)`). C'est une degradation
 * assumee et documentee, jamais un silence : le modele remonte dans
 * `AIResponse.model` et la provenance l'affiche a l'utilisateur.
 */

const NIM_CHAT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

/**
 * Tier `fast` : Nemotron 3.5 Lightning 30B-A3B. Contexte 1M, structured
 * output et function calling supportes par l'endpoint.
 * Tier `heavy` : repli sur le meme modele (cf. note de portee ci-dessus).
 */
export const NIM_MODEL_BY_TIER: Record<AITier, string> = {
  heavy: 'nvidia/nemotron-3.5-lightning-30b-a3b',
  fast: 'nvidia/nemotron-3.5-lightning-30b-a3b',
};

export function nvidiaModelFor(tier: AITier): string {
  return NIM_MODEL_BY_TIER[tier];
}

const TIMEOUT_MS: Record<AITier, number> = { fast: 45_000, heavy: 60_000 };

/**
 * Le raisonnement compte DANS max_tokens chez Nemotron : sans buffer, le
 * budget est entierement consomme par le CoT et la reponse finale arrive vide
 * (symptome deja observe et corrige sur l'adapter OpenRouter).
 */
const MIN_COMPLETION_BUFFER = 512;
const MIN_REASONING = 64;

function nimHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

export const nvidiaProvider: AIProvider = {
  name: 'nvidia',

  isAvailable(): boolean {
    const key = process.env.NVIDIA_API_KEY;
    return typeof key === 'string' && key.trim().length > 0;
  },

  async complete(req: AIRequest): Promise<string> {
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey || apiKey.trim().length === 0) {
      throw new ProviderError('Cle NVIDIA absente', 503);
    }

    // Tier `fast` : raisonnement DESACTIVE. Mesure relevee sur le meme modele
    // via OpenRouter (2026-09-03) — le CoT inline multipliait la latence par 6
    // (12-19 s -> 2 s) et polluait le contenu. Le preparateur attend une
    // reponse courte et structuree, pas un raisonnement long.
    const thinkingDisabled = req.tier === 'fast';
    const reasoningBudget =
      !thinkingDisabled && req.reasoningBudget
        ? Math.min(req.reasoningBudget, req.maxTokens - MIN_COMPLETION_BUFFER)
        : undefined;
    const useReasoning = !thinkingDisabled && reasoningBudget != null && reasoningBudget >= MIN_REASONING;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS[req.tier]);

    try {
      const res = await fetch(NIM_CHAT_URL, {
        method: 'POST',
        headers: nimHeaders(apiKey),
        signal: controller.signal,
        body: JSON.stringify({
          model: nvidiaModelFor(req.tier),
          max_tokens: req.maxTokens,
          temperature: 0.4,
          top_p: 0.95,
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.prompt },
          ],
          chat_template_kwargs: { enable_thinking: !thinkingDisabled },
          ...(useReasoning ? { reasoning_budget: reasoningBudget } : {}),
        }),
      });

      if (!res.ok) {
        // On ne recopie JAMAIS le corps de la reponse : NVIDIA y joint des
        // en-tetes d'authentification dans certains cas d'echec.
        throw new ProviderError(`NVIDIA NIM HTTP ${res.status}`, res.status);
      }

      const data = await res.json();

      // 200 + erreur embarquee : l'endpoint peut repondre 200 avec un upstream
      // tombe. Meme garde-fou que l'adapter OpenRouter.
      if (data?.error) {
        throw new ProviderError('NVIDIA NIM: erreur upstream', 502);
      }

      const content: unknown = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.trim().length === 0) {
        throw new ProviderError('NVIDIA NIM: reponse vide', 502);
      }
      return content;
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      // Abort => timeout. On ne remonte pas le message brut du runtime, qui
      // pourrait contenir l'URL complete et donc le contexte de l'appel.
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ProviderError('NVIDIA NIM: delai depasse', 504);
      }
      throw new ProviderError('NVIDIA NIM: echec reseau', 502);
    } finally {
      clearTimeout(timer);
    }
  },
};

export default nvidiaProvider;
