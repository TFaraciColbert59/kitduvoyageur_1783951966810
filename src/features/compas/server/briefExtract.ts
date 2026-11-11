import 'server-only';
/**
 * Compas v6 — extraction du Brief par l'IA, côté serveur (T1.3).
 *
 * Décision D1 prise par Tony le 10 novembre 2026 : l'IA peut extraire le Brief. L'extraction
 * reste derrière COMPAS_V6_BRIEF, éteint par défaut. Aucun fichier de production
 * n'importe encore ce module (verrou de lecture : `briefExtract.test.ts`).
 *
 * Ordre des gardes : décision D1 → drapeau `COMPAS_V6_BRIEF` → `AI_MODE` → cache mémoire →
 * appel borné à 8 s (le quota « fast » de la personne est compté par `askAI`, fonction
 * `compas-brief` du registre) → `parseExtraction`.
 *
 * Aucun journal ne contient la phrase ni une valeur extraite : statut et durée seulement.
 */
import { aiEnabled } from '@/lib/ai/aiMode';
import { extractIntentJson } from '@/lib/ai/features/compasIntent';
import { v6Flags } from '../engine/v6Flags';
import {
  extractionCacheKey,
  extractionJsonSchema,
  extractionMessages,
  parseExtraction,
  type ExtractionMessage,
  type ExtractionResult,
} from '../engine/brief/extract';

/**
 * Décision D1 prise par Tony le 10 novembre 2026 : l'IA peut extraire le Brief.
 * L'extraction reste derrière COMPAS_V6_BRIEF, éteint par défaut.
 */
export const BRIEF_AI_EXTRACTION_ALLOWED = true;

export type ExtractOutcome =
  | { status: 'ok'; result: ExtractionResult; cached: boolean; ms: number }
  | { status: 'off'; reason: 'decision_d1' | 'flag' | 'ai_mode' }
  | { status: 'failed'; reason: 'quota' | 'timeout' | 'error' };

/** Délai de l'appel au modèle ; au-delà : `timeout`. */
export const BRIEF_CALL_TIMEOUT_MS = 8_000;
/** Taille maximale du cache mémoire (plus ancienne entrée retirée d'abord). */
export const BRIEF_CACHE_MAX = 500;
export type BriefCall = (
  messages: ExtractionMessage[],
  jsonSchema: object,
  signal?: AbortSignal,
  userId?: string
) => Promise<unknown>;

/** Erreurs que le `call` par défaut sait nommer : elles deviennent `quota` ou `timeout`. */
class BriefCallError extends Error {
  constructor(readonly kind: 'quota' | 'timeout') {
    super(kind);
  }
}

/** Cache de l'instance : clé = `extractionCacheKey`, valeur = résultat contrôlé (aucune date). */
const cache = new Map<string, ExtractionResult>();

/** Vide le cache (tests). */
export function clearBriefCache(): void {
  cache.clear();
}

function remember(key: string, value: ExtractionResult): void {
  if (!cache.has(key) && cache.size >= BRIEF_CACHE_MAX) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, value);
}

/**
 * Appel par défaut : le client IA du Compas (`askAI`, NVIDIA NIM), palier « fast », JSON.
 * - `askAI` ne sait demander que `response_format: json_object` (nvidia.ts:154), pas un schéma
 *   JSON : la forme attendue est donc écrite dans la demande, et `parseExtraction` valide tout.
 * - `userId` passé à `askAI` : il compte lui-même le quota de la personne (palier « fast » et
 *   plafond de la fonction `compas-brief`, askAI.ts:117-133) ; `extractBrief` ne le compte pas.
 * - Cache de `askAI` coupé (TTL 0, aussi dans le registre) : il rangerait la phrase dans un cache partagé.
 * - Chargé à la demande : le client IA n'est tiré que si l'extraction est réellement tentée.
 */
const defaultCall: BriefCall = async (messages, jsonSchema, signal, userId) => {
  const { askAI } = await import('@/lib/ai/askAI');
  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  const user = messages.find((m) => m.role === 'user')?.content ?? '';
  const res = await askAI({
    feature: 'compas-brief',
    tier: 'fast',
    ...(userId ? { userId } : {}),
    system,
    prompt: `Forme de la réponse (schéma JSON) :\n${JSON.stringify(jsonSchema)}\n\n${user}`,
    maxTokens: 2_048,
    cacheTtlSeconds: 0,
    json: true,
    ...(signal ? { signal } : {}),
  });
  if (res.failureReason === 'quota_epuise' || res.failureReason === 'compteur_illisible') throw new BriefCallError('quota');
  if (res.failureReason === 'delai_depasse') throw new BriefCallError('timeout');
  if (res.degraded || res.provider === 'fallback') throw new Error('briefExtract: IA indisponible');
  return extractIntentJson(res.text) ?? res.text;
};

export async function extractBrief(
  input: { phrase: string; locale: string; today: string; userId: string },
  deps: {
    call?: BriefCall;
    env?: Record<string, string | undefined>;
    allowed?: boolean;
    now?: () => number;
  } = {}
): Promise<ExtractOutcome> {
  const env = deps.env ?? process.env;
  const now = deps.now ?? Date.now;
  const done = (outcome: ExtractOutcome, started: number): ExtractOutcome => {
    // Statut et durée seulement : ni la phrase ni une valeur extraite.
    const detail = outcome.status === 'ok' ? `cached=${outcome.cached}` : `reason=${outcome.reason}`;
    console.info(`[briefExtract] status=${outcome.status} ${detail} ms=${now() - started}`);
    return outcome;
  };
  const started = now();

  if (!(deps.allowed ?? BRIEF_AI_EXTRACTION_ALLOWED)) return done({ status: 'off', reason: 'decision_d1' }, started);
  if (!v6Flags(env).brief) return done({ status: 'off', reason: 'flag' }, started);
  if (!aiEnabled(env)) return done({ status: 'off', reason: 'ai_mode' }, started);

  // Phrase vide : rien à lire, rien à payer.
  if (input.phrase.trim() === '') {
    const result = parseExtraction({}, input.phrase);
    return done({ status: 'ok', result, cached: false, ms: now() - started }, started);
  }

  const key = extractionCacheKey(input);
  const hit = cache.get(key);
  if (hit) return done({ status: 'ok', result: structuredClone(hit), cached: true, ms: now() - started }, started);

  const call = deps.call ?? defaultCall;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new BriefCallError('timeout'));
    }, BRIEF_CALL_TIMEOUT_MS);
  });

  let raw: unknown;
  try {
    raw = await Promise.race([call(extractionMessages(input), extractionJsonSchema(), controller.signal, input.userId), timeout]);
  } catch (err) {
    const kind = err instanceof BriefCallError ? err.kind : 'error';
    return done({ status: 'failed', reason: kind }, started);
  } finally {
    clearTimeout(timer);
  }

  const result = parseExtraction(raw, input.phrase);
  // Une réponse illisible n'est pas gardée : elle ne doit pas rester figée jusqu'au redémarrage.
  if (result.rejected === 'none') remember(key, structuredClone(result));
  return done({ status: 'ok', result, cached: false, ms: now() - started }, started);
}
