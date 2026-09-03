import { z } from 'zod';
import type { AskAIErrorCode } from '@/lib/ai/nemotronRouter';

/**
 * Logique pure du point d'entrée IA `/api/ai/chat-completion` :
 * validation Zod de TOUTE entrée, résolution du mode (legacy payant vs
 * routeur Nemotron par défaut), dérivation prompt/système, payload SSE.
 * Import de types uniquement (aucune dépendance runtime vers le routeur).
 */

export const LEGACY_PROVIDERS = ['OPEN_AI', 'ANTHROPIC', 'GEMINI', 'PERPLEXITY'] as const;
export type LegacyProvider = (typeof LEGACY_PROVIDERS)[number];

export const chatCompletionBodySchema = z.object({
  provider: z.enum([...LEGACY_PROVIDERS, 'nemotron']).optional(),
  model: z.string().min(1).max(200).optional(),
  task: z.enum(['heavy', 'fast']).default('fast'),
  system: z.string().min(1).max(8_000).optional(),
  prompt: z.string().min(1).max(64_000).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string().min(1).max(64_000),
      })
    )
    .min(1)
    .max(100)
    .optional(),
  stream: z.boolean().default(false),
  maxTokens: z.number().int().min(64).max(8_192).optional(),
  reasoningBudget: z.number().int().min(64).max(8_192).optional(),
  parameters: z.record(z.string(), z.unknown()).default({}),
});

export type ChatCompletionBody = z.output<typeof chatCompletionBodySchema>;

export const DEFAULT_LKDV_SYSTEM =
  "Tu es l'assistant IA de LKDV (Le Kit du Voyageur), plateforme francophone de " +
  'préparation et d\'équipement pour voyageurs et randonneurs. Réponds en français, ' +
  'de façon concise, fiable et utile. Reste dans ton domaine : voyage, randonnée, ' +
  'équipement, préparation, logistique et questions pratiques associées. Ne produis ' +
  'aucun contenu illégal, dangereux ou hors sujet ; ne divulgue aucune donnée ' +
  'personnelle ; si une demande sort du cadre, invite poliment l\'utilisateur à la ' +
  'reformuler.';

export type ResolvedMode =
  | { ok: true; mode: 'legacy'; body: ChatCompletionBody }
  | { ok: true; mode: 'nemotron'; body: ChatCompletionBody }
  | { ok: false; issues: string[] };

/**
 * Mode legacy UNIQUEMENT si un provider payant est demandé explicitement ET
 * que sa clé existe (rétrocompatibilité). Dans tous les autres cas → routeur
 * Nemotron (défaut), conformément à la spec.
 */
export function resolveAiMode(
  rawBody: unknown,
  apiKeys: Record<string, string | undefined>
): ResolvedMode {
  const parsed = chatCompletionBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`),
    };
  }
  const body = parsed.data;
  const legacyWanted =
    typeof body.provider === 'string' && body.provider !== 'nemotron' && !!apiKeys[body.provider];

  if (legacyWanted) {
    return { ok: true, mode: 'legacy', body };
  }
  return { ok: true, mode: 'nemotron', body };
}

export function derivePromptAndSystem(
  body: Pick<ChatCompletionBody, 'system' | 'prompt' | 'messages'>
): { system: string; prompt: string } | null {
  const messages = body.messages ?? [];
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const lastSystem = [...messages].reverse().find((m) => m.role === 'system');

  const prompt = body.prompt ?? lastUser?.content;
  if (!prompt || prompt.trim().length === 0) return null;

  const system = body.system ?? lastSystem?.content ?? DEFAULT_LKDV_SYSTEM;
  return { system, prompt };
}

/** Contrat SSE du client existant : frames `start`, `chunk`, `done`. */
export function buildSsePayload(text: string, degraded: boolean): string {
  const frames = [
    { type: 'start' },
    { type: 'chunk', chunk: { text, degraded } },
    { type: 'done' },
  ];
  return frames.map((f) => `data: ${JSON.stringify(f)}\n\n`).join('');
}

export const ASKAI_ERROR_STATUS: Record<AskAIErrorCode, number> = {
  INVALID_INPUT: 400,
  NO_KEY: 503,
  ALL_PROVIDERS_FAILED: 502,
};
