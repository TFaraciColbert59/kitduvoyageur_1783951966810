import 'server-only';
import { z } from 'zod';
import { providerChain, modelNameFor } from './providers';
import { raceProviders, HEDGE_MS } from './providers/providerRace';
import { getCached, setCached } from './responseStore';
import { consumeQuota } from './quota';
import { getFeature } from './features/registry';
import { rateLimit } from '@/lib/rate-limit';
import type { AIRequest, AIResponse, AIFailureReason } from './providers/types';

/**
 * POINT D'ENTRÉE UNIQUE du système IA LKDV — SERVEUR ONLY.
 * Les features n'importent JAMAIS un provider : elles appellent askAI().
 *
 * Flux strict (spec §4.8) :
 *   (1) feature inconnue / requête invalide → throw (bug programmeur)
 *   (2) cache (TTL > 0) → hit = retour immédiat
 *   (0) IA éteinte (`AI_MODE=off`, plan 1.7) → fallback, aucun appel
 *   (3) quota (tier + plafond feature du registre) → dépassé = fallback
 *   (3 bis) plafond du site par jour (`AI_DAILY_CAP`, 2 000) → fallback ;
 *       compteur en panne = refus (fail-closed : l'IA n'est jamais due)
 *   (4) provider complet → setCached + retour
 *   (5) tout échec (429/5xx/timeout/noop) → fallbackResponse du registre.
 *
 * Aucun path utilisateur ne throw : la dégradation gracieuse est garantie.
 * La clé API n'est JAMAIS loggée ni incluse dans un résultat.
 */

/** IA allumée ? `AI_MODE=off` l'éteint pour tout le site (repli par règles partout). */
export function aiEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.AI_MODE?.trim().toLowerCase() !== 'off';
}

/** Appels IA par jour pour tout le site (en plus du quota de chaque personne). */
export function aiDailyCap(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.AI_DAILY_CAP);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2000;
}

async function siteAllowsAi(): Promise<boolean> {
  try {
    const r = await rateLimit({ key: 'ai:site:day', limit: aiDailyCap(), windowMs: 86_400_000, failMode: 'closed' });
    return r.allowed;
  } catch {
    return false;
  }
}

const askAISchema = z.object({
  feature: z.string().min(1).max(64),
  tier: z.enum(['heavy', 'fast']),
  system: z.string().min(1).max(8_000),
  prompt: z.string().min(1).max(64_000),
  maxTokens: z.number().int().min(64).max(8_192).default(2_048),
  reasoningBudget: z.number().int().min(64).optional(),
  cacheTtlSeconds: z.number().int().min(0).max(31_536_000).optional(),
  userId: z.string().uuid().optional(),
  plugins: z
    .array(
      z.object({
        id: z.string(),
        max_results: z.number().int().positive().optional(),
      })
    )
    .optional(),
  // Sans cette ligne, zod retire le drapeau et le provider ne demande jamais
  // de JSON au modèle.
  json: z.boolean().optional(),
});

export async function askAI(rawRequest: AIRequest): Promise<AIResponse> {
  const parsed = askAISchema.safeParse(rawRequest);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join('.') || 'root').join(', ');
    throw new Error(`[askAI] requête invalide (fields: ${fields})`);
  }
  // Le signal d'annulation n'est pas une donnée à valider : zod le retirerait.
  const req: AIRequest = { ...parsed.data, signal: rawRequest.signal };

  // (1) Registre : feature inconnue = bug programmeur → throw assumé.
  const spec = getFeature(req.feature);

  // (0) IA éteinte pour le site : le repli de la feature, sans rien appeler.
  if (!aiEnabled()) {
    return { ...(await spec.fallbackResponse(req)), failureReason: 'ia_eteinte' as AIFailureReason };
  }

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
      // La cause est attachee ICI : sans elle, l'appelant ne peut pas
      // distinguer un quota epuise d'une panne, et afficher les deux comme une
      // indisponibilite de service.
      return { ...(await spec.fallbackResponse(req)), failureReason: 'quota_epuise' as AIFailureReason };
    }
  }

  // (3 bis) Plafond du site : une rafale (ou un abus) ne vide pas l'offre gratuite.
  if (!(await siteAllowsAi())) {
    console.warn('[askAI] plafond du site atteint pour', req.feature);
    return { ...(await spec.fallbackResponse(req)), failureReason: 'quota_epuise' as AIFailureReason };
  }

  // (4) Provider — reasoning borné par le registre (crucial pour le quota :free).
  const reasoningBudget = Math.min(
    spec.maxReasoningBudget,
    req.reasoningBudget ?? spec.maxReasoningBudget
  );
  // (4) Provider — reasoning borne par le registre (crucial pour le quota :free).
  //
  // La chaine n est pas seulement CONSULTEE, elle est EMPRUNTEE — et elle ne
  // se joue plus l un apres l autre. Voir `providerRace` : un candidat lent
  // ne se voit plus laisser tout son delai avant que le suivant demarre. Mesure
  // du 2026-09-29 : NVIDIA repond en 4,6 s quand elle repond, mais un 503 en
  // 200 ms l another fois — et le tout sequentielavalait alors 70 s d ecran
  // fige. Le provider qui a repondu est celui nomme dans `AIResponse.model`,
  // donc la provenance affichee a l utilisateur dit la verite.
  const chaine = providerChain(req.tier).filter((provider) => provider.name !== 'noop');
  const depart = Date.now();
  const course = await raceProviders(chaine, { ...req, reasoningBudget }, { hedgeMs: HEDGE_MS[req.tier] });
  const echecs = course.echecs.map((e) => e.provider + ': ' + e.raison);

  if (course.provider && course.text !== null) {
    const provider = course.provider;
    const response: AIResponse = {
      text: course.text,
      model: modelNameFor(provider, req.tier),
      degraded: false,
      cached: false,
      provider: provider.name,
    };
    if (ttl > 0) {
      await setCached(req.feature, req.prompt, response, ttl);
    }
    // Trace de SUCCES, symetrique de la trace d echec total plus bas. Sans
    // elle, une generation servie par le repli et une generation servie par
    // l IA ne laissaient pas la meme trace au bout du compte : impossible de
    // distinguer les deux depuis le serveur. On n ecrit ni la cle, ni le
    // prompt, ni la reponse — seulement qui a repondu, en combien de temps,
    // et apres combien de candidats tombes.
    console.log(
      '[askAI] ' +
        req.feature +
        ' -> ' +
        response.model +
        ' (' +
        provider.name +
        ') en ' +
        (Date.now() - depart) +
        'ms apres ' +
        echecs.length +
        ' echec(s) et ' +
        course.lances +
        ' candidat(s) lance(s)'
    );
    return response;
  }

  // (5) Fallback feature : jamais de crash vers l'UI, jamais de cle dans les
  // erreurs. Toute la chaine a echoue — on rend la feature telle qu elle sait
  // rendre, et on nomme la DERNIERE cause rencontree.
  console.error(`[askAI] tous providers en echec pour ${req.feature} —`, echecs.join(' | '));
  const dernier = echecs[echecs.length - 1] ?? '';
  // 504 = le provider a depasse son propre delai (cf. nvidia.ts). C'est le
  // SEUL aleas transitoire de cette liste, et donc le seul qui se retente.
  const failureReason: AIFailureReason = dernier.includes('delai') || dernier.includes('504')
    ? 'delai_depasse'
    : 'provider_indisponible';
  return { ...(await spec.fallbackResponse(req)), failureReason };
}
