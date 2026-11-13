import 'server-only';
import { apiError, logServer, redact } from '../../lib/errors';

/**
 * Client NVIDIA NIM — seul fournisseur IA autorisé (décision Tony 2026-10-07).
 * Point d’accès compatible OpenAI ; aucune dépendance SDK.
 *
 * La clé n’est jamais journalisée, ni incluse dans une erreur, ni renvoyée.
 * Le contenu des prompts n’est jamais journalisé (données de membres).
 */
const NIM_CHAT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const DEFAULT_MODEL = 'nvidia/nemotron-3.5-lightning-30b-a3b';
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_TOKENS = 1_400;

export type NimToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export type NimMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: NimToolCall[];
  tool_call_id?: string;
};

export type NimTool = {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export type NimUsage = { prompt_tokens: number; completion_tokens: number; total_tokens: number };

export type NimResponse = {
  content: string;
  toolCalls: NimToolCall[];
  usage: NimUsage;
  model: string;
};

export type NimRequest = {
  model: string;
  messages: NimMessage[];
  tools: NimTool[];
  temperature: number;
  signal?: AbortSignal;
};

export function nimConfigured(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY && String(process.env.NVIDIA_API_KEY).length > 8);
}

/** Modèle par palier : noms identiques à LKDV (Nemotron 3.5 Lightning). */
export function nimModelFor(tier: 'fast' | 'heavy'): string {
  const raw = tier === 'heavy' ? process.env.NVIDIA_MODEL_HEAVY : process.env.NVIDIA_MODEL_FAST;
  return raw && raw.length > 2 ? raw : DEFAULT_MODEL;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseToolCalls(value: unknown): NimToolCall[] {
  if (!Array.isArray(value)) return [];
  const calls: NimToolCall[] = [];
  for (const entry of value) {
    const raw = asRecord(entry);
    const fn = asRecord(raw.function);
    const name = typeof fn.name === 'string' ? fn.name : '';
    if (!name) continue;
    const args = typeof fn.arguments === 'string' ? fn.arguments : JSON.stringify(fn.arguments ?? {});
    calls.push({
      id: typeof raw.id === 'string' ? raw.id : `call_${calls.length}`,
      type: 'function',
      function: { name, arguments: args }
    });
  }
  return calls;
}

/** Un appel, un retry borné sur 429/5xx. Aucun contenu de prompt dans les journaux. */
export async function nimChat(request: NimRequest): Promise<NimResponse> {
  const key = process.env.NVIDIA_API_KEY;
  if (!key || key.length < 8) throw apiError('brick_disabled');

  const payload = {
    model: request.model,
    messages: request.messages,
    tools: request.tools.length ? request.tools : undefined,
    tool_choice: request.tools.length ? 'auto' : undefined,
    temperature: request.temperature,
    max_tokens: MAX_TOKENS,
    stream: false
  };

  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const started = Date.now();
    let response: Response;
    try {
      response = await fetch(NIM_CHAT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(payload),
        signal: request.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
    } catch (error) {
      logServer({
        level: 'warn',
        scope: 'crm',
        event: 'nim_unreachable',
        message: error instanceof Error ? error.message : 'réseau',
        duration_ms: Date.now() - started
      });
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        continue;
      }
      throw apiError('external_failed');
    }

    lastStatus = response.status;
    if (response.ok) {
      const body = asRecord(await response.json().catch(() => null));
      const choices = Array.isArray(body.choices) ? body.choices : [];
      const message = asRecord(asRecord(choices[0]).message);
      const usage = asRecord(body.usage);
      return {
        content: typeof message.content === 'string' ? message.content : '',
        toolCalls: parseToolCalls(message.tool_calls),
        usage: {
          prompt_tokens: typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0,
          completion_tokens: typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0,
          total_tokens: typeof usage.total_tokens === 'number' ? usage.total_tokens : 0
        },
        model: typeof body.model === 'string' ? body.model : request.model
      };
    }

    // 401/403 : clé refusée ; aucun détail de la réponse n’est journalisé.
    logServer({
      level: 'warn',
      scope: 'crm',
      event: 'nim_refused',
      message: `HTTP ${response.status} ${redact(response.statusText)}`,
      duration_ms: Date.now() - started
    });
    if ((response.status === 429 || response.status >= 500) && attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      continue;
    }
    throw apiError('external_failed');
  }

  logServer({ level: 'error', scope: 'crm', event: 'nim_failed', message: `HTTP ${lastStatus}` });
  throw apiError('external_failed');
}
