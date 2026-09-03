import 'server-only';
import { z } from 'zod';
import { getProvider, modelFor } from './providers';
import { getCached, setCached } from './responseStore';
import { consumeQuota } from './quota';
import { getFeature } from './features/registry';
import type { AIRequest, AIResponse } from './providers/types';

/**
 * POINT D'ENTRÉE UNIQUE du système IA LKDV — SERVEUR ONLY.
 * Les features n'importent JAMAIS un provider : elles appellent askAI().
 *
 * Flux strict (spec §4.8) :
 *   (1) feature inconnue / requête invalide → throw (bug programmeur)
 *   (2) cache (TTL > 0) → hit = retour immédiat
 *   (3) quota (tier + plafond feature du registre) → dépassé = fallback
 *   (4) provider complet → setCached + retour
 *   (5) tout échec (429/5xx/timeout/noop) → fallbackResponse du registre.
 *
 * Aucun path utilisateur ne throw : la dégradation gracieuse est garantie.
 * La clé API n'est JAMAIS loggée ni incluse dans un résultat.
 */

const askAISchema = z.object({
  feature: z.string().min(1).max(64),
  tier: z.enum(['heavy', 'fast']),
  system: z.string().min(1).max(8_000),
  prompt: z.string().min(1).max(64_000),
  maxTokens: z.number().int().min(64).max(8_192).default(2_048),
  reasoningBudget: z.number().int().min(64).optional(),
  cacheTtlSeconds: z.number().int().min(0).max(31_536_000).optional(),
  userId: z.string().uuid().optional(),
});

export async function askAI(rawRequest: AIRequest): Promise<AIResponse> {
  const parsed = askAISchema.safeParse(rawRequest);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join('.') || 'root').join(', ');
    throw new Error(`[askAI] requête invalide (fields: ${fields})`);
  }
  const req = parsed.data;

  // (1) Registre : feature inconnue = bug programmeur → throw assumé.
  const spec = getFeature(req.feature);

  // (2) Cache avant tout : 0 appel réseau si hit.
  const ttl = req.cacheTtlSeconds ?? spec.cacheTtlSeconds;
  if (ttl > 0) {
    const hit = await getCached(req.feature, req.prompt);
    if (hit) return { ...hit, cached: true };
  }

  // (3) Quota : tier (20/100) + plafond feature du registre.
  if (req.userId) {
    const allowed = await consumeQuota(req.userId, req.tier, req.feature, spec.maxPerUserPerDay);
    if (!allowed) {
      return spec.fallbackResponse(req);
    }
  }

  // (4) Provider — reasoning borné par le registre (crucial pour le quota :free).
  const reasoningBudget = Math.min(
    spec.maxReasoningBudget,
    req.reasoningBudget ?? spec.maxReasoningBudget
  );
  const provider = getProvider();

  try {
    const text = await provider.complete({ ...req, reasoningBudget });
    const response: AIResponse = {
      text,
      model: provider.name === 'openrouter' ? modelFor(req.tier) : provider.name,
      degraded: false,
      cached: false,
      provider: provider.name,
    };
    if (ttl > 0) {
      await setCached(req.feature, req.prompt, response, ttl);
    }
    return response;
  } catch (err) {
    // (5) Fallback feature : jamais de crash vers l'UI, jamais de clé dans les erreurs.
    console.error(
      `[askAI] provider ${provider.name} en échec pour ${req.feature}:`,
      err instanceof Error ? err.message : err
    );
    return spec.fallbackResponse(req);
  }
}
