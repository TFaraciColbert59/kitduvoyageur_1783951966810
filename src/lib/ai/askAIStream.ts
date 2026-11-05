import 'server-only';
import { askAISchema, aiEnabled, siteAiVerdict } from './askAI';
import { getFeature } from './features/registry';
import { getCached } from './responseStore';
import { consumeQuota } from './quota';
import { providerChain, modelNameFor } from './providers';
import type { AIFailureReason, AIRequest, AIResponse, AIProvider } from './providers/types';

/**
 * Chemin streaming du port IA, parallèle à `askAI` et soumis aux MÊMES
 * précontrôles : feature du registre, mode IA du site, cache, quota par
 * personne, plafond journalier du site, chaîne de providers autorisés.
 *
 * Différences assumées :
 * - le cache, quand il est actif, rend le texte complet en un seul delta ;
 * - un provider n'est abandonné qu'AVANT le premier token. Après le premier
 *   token, un échec est une erreur identifiable : on ne colle pas la réponse
 *   d'un autre modèle derrière un début de texte déjà affiché ;
 * - le premier token a son propre délai (12 s) : un provider muet ne consomme
 *   pas tout son délai avant que le suivant démarre.
 */
const FIRST_TOKEN_TIMEOUT_MS = 12_000;

export interface AIStreamResult {
  stream: AsyncIterable<string>;
  model: string;
  provider: string;
  degraded: boolean;
  cached: boolean;
  failureReason?: AIFailureReason;
}

function singleText(text: string, meta: Omit<AIStreamResult, 'stream'>): AIStreamResult {
  return {
    ...meta,
    stream: (async function* () {
      yield text;
    })(),
  };
}

function fromResponse(response: AIResponse, cached = false): AIStreamResult {
  return singleText(response.text, {
    model: response.model,
    provider: response.provider,
    degraded: response.degraded,
    cached: cached || response.cached,
    failureReason: response.failureReason,
  });
}

function firstToken(
  iterator: AsyncIterator<string>,
  controller: AbortController
): Promise<IteratorResult<string>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error('premier token: delai depasse'));
    }, FIRST_TOKEN_TIMEOUT_MS);
    iterator.next().then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function* continueStream(
  first: string,
  iterator: AsyncIterator<string>,
  controller: AbortController,
  req: AIRequest,
  onAbort: () => void
): AsyncGenerator<string> {
  try {
    yield first;
    for (;;) {
      const next = await iterator.next();
      if (next.done) return;
      yield next.value;
    }
  } finally {
    req.signal?.removeEventListener('abort', onAbort);
    controller.abort();
    try {
      await iterator.return?.();
    } catch {
      /* le provider est déjà fermé */
    }
  }
}

export async function askAIStream(rawRequest: AIRequest): Promise<AIStreamResult> {
  const parsed = askAISchema.safeParse(rawRequest);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.') || 'root').join(', ');
    throw new Error(`[askAIStream] requête invalide (fields: ${fields})`);
  }
  const req: AIRequest = { ...parsed.data, signal: rawRequest.signal };
  const spec = getFeature(req.feature);

  if (req.json) {
    // Un objet JSON doit être reçu et validé en entier avant une écriture
    // métier : il ne passe pas par ce flux.
    throw new Error('[askAIStream] le streaming JSON structuré est interdit');
  }

  if (!aiEnabled()) {
    return fromResponse({ ...(await spec.fallbackResponse(req)), failureReason: 'ia_eteinte' });
  }

  const ttl = req.cacheTtlSeconds ?? spec.cacheTtlSeconds;
  if (ttl > 0) {
    const hit = await getCached(req.feature, req.prompt, ...(req.locale ? [req.locale] : []));
    if (hit) return fromResponse(hit, true);
  }

  if (req.userId) {
    let counterUnreadable = false;
    const allowed = await consumeQuota(
      req.userId,
      req.quotaTier ?? req.tier,
      req.feature,
      spec.maxPerUserPerDay,
      {
        onUnreadable: () => {
          counterUnreadable = true;
        },
      }
    );
    if (!allowed && counterUnreadable) {
      return fromResponse({
        ...(await spec.fallbackResponse(req)),
        failureReason: 'compteur_illisible',
      });
    }
    if (!allowed) {
      return fromResponse({ ...(await spec.fallbackResponse(req)), failureReason: 'quota_epuise' });
    }
  }

  const site = await siteAiVerdict();
  if (site !== 'ok') {
    return fromResponse({
      ...(await spec.fallbackResponse(req)),
      failureReason: site === 'plafond' ? 'quota_epuise' : 'compteur_illisible',
    });
  }

  const reasoningBudget = Math.min(
    spec.maxReasoningBudget,
    req.reasoningBudget ?? spec.maxReasoningBudget
  );
  const chain = providerChain(req.tier, { expert: req.expert }).filter(
    (provider): provider is AIProvider & { stream: NonNullable<AIProvider['stream']> } =>
      provider.name !== 'noop' && typeof provider.stream === 'function'
  );

  let lastFailure = 'provider_indisponible';
  for (const provider of chain) {
    if (req.signal?.aborted) break;
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    req.signal?.addEventListener('abort', onAbort, { once: true });
    const iterator = provider
      .stream({ ...req, reasoningBudget, signal: controller.signal })
      [Symbol.asyncIterator]();
    try {
      const first = await firstToken(iterator, controller);
      if (first.done) {
        req.signal?.removeEventListener('abort', onAbort);
        await iterator.return?.();
        continue;
      }
      return {
        stream: continueStream(first.value, iterator, controller, req, onAbort),
        model: modelNameFor(provider, req.tier),
        provider: provider.name,
        degraded: false,
        cached: false,
      };
    } catch (error) {
      req.signal?.removeEventListener('abort', onAbort);
      controller.abort();
      try {
        await iterator.return?.();
      } catch {
        /* déjà fermé */
      }
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('delai') || message.includes('504')) lastFailure = 'delai_depasse';
    }
  }

  console.error(`[askAIStream] tous providers en echec pour ${req.feature}`);
  const fallback = await spec.fallbackResponse(req);
  return fromResponse({
    ...fallback,
    degraded: true,
    failureReason: lastFailure as AIFailureReason,
  });
}
