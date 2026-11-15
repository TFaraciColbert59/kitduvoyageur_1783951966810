/**
 * S2.38 — adaptateurs Claude et Gemini de la surface externe.
 *
 * Ces deux fournisseurs ne sont utilisés QUE par l'assistant d'historique
 * externe, lorsque leur clé existe déjà dans l'environnement
 * (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`). Aucune clé n'est créée, inventée
 * ni écrite dans le dépôt. Clé absente ⇒ `isAvailable()` faux ⇒ la route rend
 * l'état `provider_unconfigured`, sans appel réseau.
 */

import { completion } from '@rocketnew/llm-sdk';
import type {
  AssistantCompletionPort,
  AssistantCompletionRequest,
  AssistantCompletionResult,
} from '../contracts';

export const CLAUDE_MODEL = 'claude-sonnet-4-6';
export const GEMINI_MODEL = 'gemini/gemini-2.5-flash';

export interface AssistantProviderEnv {
  [key: string]: string | undefined;
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;
  NVIDIA_API_KEY?: string;
  AI_MODE?: string;
}

interface LlmCompletionResponse {
  choices?: Array<{ message?: { content?: unknown } }>;
}

function readText(response: unknown): string | null {
  const typed = response as LlmCompletionResponse | null;
  const content = typed?.choices?.[0]?.message?.content;
  return typeof content === 'string' && content.trim().length > 0 ? content : null;
}

function externalProvider(
  id: 'claude' | 'gemini',
  model: string,
  apiKey: string | undefined
): AssistantCompletionPort {
  const key = apiKey?.trim() ?? '';
  return {
    id,
    isAvailable: () => key.length > 0,
    async complete(request: AssistantCompletionRequest): Promise<AssistantCompletionResult> {
      if (!key) throw new Error(`clé ${id} absente`);
      const response = await completion({
        model,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.prompt },
        ],
        max_tokens: request.maxTokens,
        temperature: 0.3,
        stream: false,
        api_key: key,
      });
      const text = readText(response);
      if (!text) throw new Error(`réponse ${id} vide`);
      return { text, provider: id, model };
    },
  };
}

export function createClaudeProvider(env: AssistantProviderEnv = process.env): AssistantCompletionPort {
  return externalProvider('claude', CLAUDE_MODEL, env.ANTHROPIC_API_KEY);
}

export function createGeminiProvider(env: AssistantProviderEnv = process.env): AssistantCompletionPort {
  return externalProvider('gemini', GEMINI_MODEL, env.GEMINI_API_KEY);
}
