import 'server-only';
import { z } from 'zod';
import { buildCacheKey, getCachedResponse, storeCachedResponse } from '@/lib/ai/responseStore';

/**
 * Routeur IA central LKDV — NVIDIA Nemotron via OpenRouter. SERVEUR UNIQUEMENT.
 *
 * - Tier `:free` OpenRouter : congestion fréquente (429/5xx) → chaîne de
 *   fallback obligatoire : heavy→nano ; fast→ultra borné (1000 tokens).
 * - Nemotron 3 Ultra raisonne (budget défaut 16384 tokens) → `reasoning.max_tokens`
 *   borné pour ne pas vider le quota.
 * - Cache consulté avant l'appel, alimenté après (service role, cf. responseStore).
 * - Aucun throw vers l'UI : résultat typé traduit en toast gracieux par l'appelant.
 * - La clé API n'est JAMAIS loggée ni incluse dans une erreur.
 */

export const NEMOTRON_MODELS = {
  heavy: 'nvidia/nemotron-3-ultra-550b-a55b:free',
  fast: 'nvidia/nemotron-3-nano-30b-a3b:free',
} as const;

export const AI_TIMEOUT_MS = { fast: 8_000, heavy: 45_000 } as const;
export const MAX_REASONING_BUDGET = 8_192;

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_REASONING_BUDGET = 4_096;
const FALLBACK_MAX_TOKENS = 1_000;
const FALLBACK_REASONING_BUDGET = 256;
const DEFAULT_CACHE_TTL_SECONDS = 3_600;

export const askAISchema = z.object({
  task: z.enum(['heavy', 'fast']),
  system: z.string().min(1).max(8_000),
  prompt: z.string().min(1).max(64_000),
  maxTokens: z.number().int().min(64).max(8_192).optional(),
  // Plafond appliqué au clamp (MAX_REASONING_BUDGET), pas au schéma — cf. TEST-RT-03.
  reasoningBudget: z.number().int().min(64).optional(),
  feature: z.string().min(1).max(64).default('chat'),
  cache: z.boolean().default(true),
  cacheTtlSeconds: z.number().int().min(60).max(604_800).default(DEFAULT_CACHE_TTL_SECONDS),
});

export type AskAIOpts = z.input<typeof askAISchema>;

export type AskAIErrorCode = 'INVALID_INPUT' | 'NO_KEY' | 'ALL_PROVIDERS_FAILED';

export type AskAIResult =
  | { ok: true; text: string; model: string; degraded: boolean; cached: boolean }
  | {
      ok: false;
      text: '';
      model: null;
      degraded: true;
      error: { code: AskAIErrorCode; message: string };
    };

function openRouterHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.com',
    'X-Title': 'LKDV',
  };
}

type OpenRouterError = Error & { status?: number };

interface CallSpec {
  model: string;
  system: string;
  prompt: string;
  maxTokens?: number;
  reasoningMaxTokens?: number;
  timeoutMs: number;
  apiKey: string;
}

async function callOpenRouter(spec: CallSpec): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), spec.timeoutMs);

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: openRouterHeaders(spec.apiKey),
      signal: controller.signal,
      body: JSON.stringify({
        model: spec.model,
        max_tokens: spec.maxTokens,
        messages: [
          { role: 'system', content: spec.system },
          { role: 'user', content: spec.prompt },
        ],
        ...(spec.reasoningMaxTokens
          ? { reasoning: { max_tokens: spec.reasoningMaxTokens } }
          : {}),
      }),
    });

    if (!res.ok) {
      const err = new Error(`OpenRouter HTTP ${res.status}`) as OpenRouterError;
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const content: unknown = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      const err = new Error('OpenRouter: réponse vide') as OpenRouterError;
      err.status = 502;
      throw err;
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

/** Fallback autorisé uniquement sur congestion/panie : 429, 5xx, timeout, réseau. */
function isFallbackEligible(err: unknown): boolean {
  const status = (err as OpenRouterError)?.status;
  if (status === 429 || (typeof status === 'number' && status >= 500 && status <= 599)) {
    return true;
  }
  const name = (err as { name?: string })?.name;
  if (name === 'AbortError' || name === 'TimeoutError') return true;
  // Erreur réseau sans statut HTTP (fetch TypeError…) → bascule.
  return status === undefined;
}

function failure(code: AskAIErrorCode, message: string): AskAIResult {
  return { ok: false, text: '', model: null, degraded: true, error: { code, message } };
}

export async function askAI(rawOpts: AskAIOpts): Promise<AskAIResult> {
  const parsed = askAISchema.safeParse(rawOpts);
  if (!parsed.success) {
    console.error(
      '[askAI] entrée invalide:',
      parsed.error.issues.map((i) => i.path.join('.') || 'root').join(', ')
    );
    return failure('INVALID_INPUT', 'Paramètres IA invalides.');
  }
  const opts = parsed.data;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('[askAI] OPENROUTER_API_KEY absente — service IA indisponible');
    return failure('NO_KEY', "Le service IA n'est pas configuré.");
  }

  const cacheKey = buildCacheKey({
    feature: opts.feature,
    task: opts.task,
    system: opts.system,
    prompt: opts.prompt,
    maxTokens: opts.maxTokens,
  });

  if (opts.cache) {
    const cached = await getCachedResponse(cacheKey);
    if (cached) {
      return { ok: true, text: cached, model: 'cache', degraded: false, cached: true };
    }
  }

  const primaryModel = NEMOTRON_MODELS[opts.task];
  const fallbackModel = NEMOTRON_MODELS[opts.task === 'heavy' ? 'fast' : 'heavy'];
  const timeoutMs = AI_TIMEOUT_MS[opts.task];
  const primaryReasoning =
    opts.task === 'heavy'
      ? Math.min(opts.reasoningBudget ?? DEFAULT_REASONING_BUDGET, MAX_REASONING_BUDGET)
      : undefined;

  try {
    const text = await callOpenRouter({
      model: primaryModel,
      system: opts.system,
      prompt: opts.prompt,
      maxTokens: opts.maxTokens,
      reasoningMaxTokens: primaryReasoning,
      timeoutMs,
      apiKey,
    });
    if (opts.cache) {
      await storeCachedResponse(cacheKey, opts.feature, text, primaryModel, opts.cacheTtlSeconds);
    }
    return { ok: true, text, model: primaryModel, degraded: false, cached: false };
  } catch (primaryError) {
    if (!isFallbackEligible(primaryError)) {
      console.error(
        '[askAI] échec non récupérable:',
        primaryError instanceof Error ? primaryError.message : primaryError
      );
      return failure('ALL_PROVIDERS_FAILED', 'Le service IA a refusé la requête.');
    }
    console.error(
      `[askAI] ${primaryModel} indisponible (${
        primaryError instanceof Error ? primaryError.message : 'erreur'
      }) — bascule vers ${fallbackModel}`
    );
  }

  // Fallback : heavy→nano ; fast→ultra borné (1000 tokens, raisonnement réduit).
  try {
    const text = await callOpenRouter({
      model: fallbackModel,
      system: opts.system,
      prompt: opts.prompt,
      maxTokens:
        opts.task === 'fast'
          ? Math.min(opts.maxTokens ?? FALLBACK_MAX_TOKENS, FALLBACK_MAX_TOKENS)
          : opts.maxTokens,
      reasoningMaxTokens: opts.task === 'fast' ? FALLBACK_REASONING_BUDGET : undefined,
      timeoutMs,
      apiKey,
    });
    if (opts.cache) {
      await storeCachedResponse(cacheKey, opts.feature, text, fallbackModel, opts.cacheTtlSeconds);
    }
    return { ok: true, text, model: fallbackModel, degraded: true, cached: false };
  } catch (fallbackError) {
    console.error(
      '[askAI] fallback également en échec:',
      fallbackError instanceof Error ? fallbackError.message : fallbackError
    );
    return failure(
      'ALL_PROVIDERS_FAILED',
      'Le service IA est momentanément surchargé. Merci de réessayer dans un instant.'
    );
  }
}
