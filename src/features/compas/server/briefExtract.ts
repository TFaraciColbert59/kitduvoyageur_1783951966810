import 'server-only';
/**
 * Compas v6 — extraction du Brief par l'IA, côté serveur (T1.3).
 *
 * VERROUILLÉ : tant que la décision D1 du propriétaire n'est pas prise
 * (`BRIEF_AI_EXTRACTION_ALLOWED = false`), `extractBrief` rend « off » sans rien lire,
 * sans compter de quota et sans appeler le modèle. Aucun fichier de production
 * n'importe ce module (verrou de lecture : `briefExtract.test.ts`).
 *
 * AVANT D'OUVRIR D1 : ajouter `compas-brief` au registre des fonctions IA
 * (`src/lib/ai/features/registry.ts`) ; le `call` par défaut emprunte `compas-intent` en attendant.
 *
 * Ordre des gardes : décision D1 → drapeau `COMPAS_V6_BRIEF` → `AI_MODE` → cache mémoire →
 * quota « fast » de la personne → appel borné à 8 s → `parseExtraction`.
 *
 * Aucun journal ne contient la phrase ni une valeur extraite : statut et durée seulement.
 */
import { aiEnabled } from '@/lib/ai/aiMode';
import { consumeQuota } from '@/lib/ai/quota';
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
 * Décision D1 (propriétaire) : l'IA peut-elle extraire le Brief ? NON tant que ce n'est pas
 * tranché. Seule une modification de cette constante, relue, l'autorise.
 */
export const BRIEF_AI_EXTRACTION_ALLOWED = false;

export type ExtractOutcome =
  | { status: 'ok'; result: ExtractionResult; cached: boolean; ms: number }
  | { status: 'off'; reason: 'decision_d1' | 'flag' | 'ai_mode' }
  | { status: 'failed'; reason: 'quota' | 'timeout' | 'error' };

/** Délai de l'appel au modèle ; au-delà : `timeout`. */
export const BRIEF_CALL_TIMEOUT_MS = 8_000;
/** Taille maximale du cache mémoire (plus ancienne entrée retirée d'abord). */
export const BRIEF_CACHE_MAX = 500;
/** Compteur de la personne : palier « fast » (400 par jour), plafond propre à cette fonction. */
export const BRIEF_QUOTA_FEATURE = 'compas-brief';
export const BRIEF_QUOTA_FEATURE_LIMIT = 200;

export type BriefCall = (
  messages: ExtractionMessage[],
  jsonSchema: object,
  signal?: AbortSignal
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
 * - Pas de `userId` : le quota de la personne est déjà compté par `extractBrief` (sinon double).
 * - Cache de `askAI` coupé (TTL 0) : il rangerait la phrase dans un cache partagé.
 * - `askAI` exige une fonction du registre : on emprunte `compas-intent` (même palier, même
 *   repli). À remplacer par une entrée `compas-brief` du registre avant d'ouvrir D1.
 * - Chargé à la demande : le client IA n'est jamais tiré tant que D1 est fermée.
 */
const defaultCall: BriefCall = async (messages, jsonSchema, signal) => {
  const { askAI } = await import('@/lib/ai/askAI');
  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  const user = messages.find((m) => m.role === 'user')?.content ?? '';
  const res = await askAI({
    feature: 'compas-intent',
    tier: 'fast',
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

  const allowedByQuota = await consumeQuota(input.userId, 'fast', BRIEF_QUOTA_FEATURE, BRIEF_QUOTA_FEATURE_LIMIT).catch(() => false);
  if (!allowedByQuota) return done({ status: 'failed', reason: 'quota' }, started);

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
    raw = await Promise.race([call(extractionMessages(input), extractionJsonSchema(), controller.signal), timeout]);
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
