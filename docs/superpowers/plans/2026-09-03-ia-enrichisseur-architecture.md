# IA-comme-enrichisseur — Nemotron/OpenRouter sur LKDV (chantiers 0, A, B, C, D)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development ou
> executing-plans. TDD strict (Red/Green/Refactor) pour toute logique.
> Skill `verification-before-completion` avant de clôturer chaque chantier.

**Goal:** Port IA unique + registre de features (fallback déterministe) branché sur Nemotron/OpenRouter, avec 3 features métier (configurateur kit, récit post-randonnée async, guides pays pré-générés).

**Architecture:** « IA-comme-enrichisseur, jamais comme moteur ». Logique métier déterministe en TS testable ; l'IA justifie/raconte/conseille. Port `AIProvider` + adapters (`openrouter`, `noop`) + sélecteur ; `askAI` = seul point d'entrée (cache → quota → provider → fallback registre). Mobilité : changer de provider = 1 adapter ; ajouter une feature = 1 fichier registre.

**Tech Stack:** Next.js 15 App Router, TS strict, Zod 4, `server-only`, Supabase (RLS + SECURITY DEFINER), Vitest, web-push.

**Spec:** brief utilisateur 2026-09-03 (Parties 1-9) + `docs/superpowers/specs/2026-09-03-nemotron-ai-router.md` (chantier 0 déjà réalisé).

## État existant (session précédente, branche `feat/nemotron-ai-router`) — DÉCISIONS DE RESTRUCTURATION

| Existant | Décision |
|---|---|
| Chantier 0 (server.ts sécurisé, `.env.example`) | ✅ FAIT — vérification seulement, aucun rework |
| `nemotronRouter.ts` + `responseStore.ts` | **Supprimés** — remplacés par port/registre (`providers/`, `cache.ts`, `quota.ts`, `registry.ts`, `askAI.ts`) |
| Migration `20260903000000_ai_quota_response_store.sql` | **Remplacée** (git mv → `20260903000000_ai_foundations.sql`) : réponse JSONB + provider, `requests_by_feature`, `ai_jobs`, claim SKIP LOCKED, quota par feature. Justification : migration JAMAIS appliquée en prod (action manuelle en attente) ; garde `DO $$` défensive si elle avait été appliquée |
| Chaîne de fallback heavy↔fast | **Supprimée** (spec v2 : résilience au niveau feature via `fallbackResponse` — déviation assumée vs mission précédente) |
| Route `chat-completion` déjà routée vers askAI | Rewirée : `askAI` gère désormais le quota en interne (userId passé, bloc rpc retiré) |
| Tests vitest | Convention repo : `tests/**/*.spec.ts` SEULEMENT (include `vitest.config.ts`). Les tests vivent donc dans `tests/ai/`, PAS `src/lib/ai/__tests__/` (sinon `npm run test` ne les exécute pas) — déviation assumée vs spec §4.11 |

## Global Constraints

- Aucune clé en dur ; Zod sur toute entrée API ; RLS sur toute nouvelle table ; migrations idempotentes.
- `.gitignore` contient `*cache*` → aucun NOM de fichier avec « cache » (contenu OK).
- Bloc `rocketCritical` / scripts npm / `eslint.ignoreDuringBuilds` intouchables. `server-only` déjà installé (ajout autorisé).
- SSE `chat-completion` + providers legacy + « never fabricate a product » + calculs poids/prix + insertion `kit_reports` : NON NÉGOCIABLES.
- Zéro appel IA depuis `'use client'` — askAI est server-only ; le client passe par les API routes.
- Jamais d'erreur 500 pour l'utilisateur final sur un appel IA → toujours fallbackResponse utile.
- Modèles : heavy `nvidia/nemotron-3-ultra-550b-a55b:free`, fast `nvidia/nemotron-3-nano-30b-a3b:free`. Timeouts 8s/45s. Reasoning borne par feature.
- Gates après CHAQUE chantier : `npm run lint && npm run type-check && npm run build && npm run test`.
- Commits par tâche, `Co-Authored-By: Claude Code <noreply@anthropic.com>`. Branche `feat/nemotron-ai-router`.

---

# CHANTIER 0 — SÉCURITÉ ✅ (déjà commité, vérification)

- [x] Clé anon en dur supprimée (`getSupabaseConfig()` throw explicite), cookies intacts (commit 8e39101).
- [x] `.env.example` créé avec `NEXT_PUBLIC_SUPABASE_URL=` / `NEXT_PUBLIC_SUPABASE_ANON_KEY=` vides.
- [x] `.env.local` git-ignoré (vérifié `git check-ignore`, exit 0).
- [ ] Rapport : action manuelle « Rotate anon key » (l'ancienne est compromise publiquement).

**Aucune nouvelle modification de code dans ce chantier.**

---

# CHANTIER A — FONDATIONS (port + providers + askAI + cache + quota + registre)

### Task A1 — Migration `ai_foundations` (remplace l'ancienne, git mv)

**Files:** `supabase/migrations/20260903000000_ai_foundations.sql` (git mv + réécriture)

- `ai_response_cache` : `response JSONB NOT NULL`, colonne `provider text` ; garde `DO $$` conversion TEXT→JSONB si ancienne version appliquée ; index `expires_at` ; RLS + policy `ai_response_cache_select_false` USING (false).
- `ai_usage_daily` : + `requests_by_feature jsonb NOT NULL DEFAULT '{}'` (ADD COLUMN IF NOT EXISTS).
- `ai_jobs` : id uuid, user_id → auth.users CASCADE, feature, payload jsonb, status CHECK IN ('pending','processing','done','failed'), result jsonb, attempts, created_at, processed_at ; RLS select/insert own ; index (status, created_at).
- `check_and_increment_ai_quota(p_user_id uuid, p_tier text, p_feature text DEFAULT NULL, p_feature_limit integer DEFAULT 0)` : atomique (upsert + WHERE de garde AVANT incrément) — garde tier (heavy<20, fast<100) ET garde feature (`requests_by_feature->>p_feature < p_feature_limit`). Defaults NULL/0 → signature (p_user_id, p_tier) reste valide (rétrocompat route).
- `get_ai_cache(p_cache_key) RETURNS JSONB` (NULL si expiré, incrémente hit_count) ; `set_ai_cache(p_cache_key, p_feature, p_response JSONB, p_model, p_provider, p_ttl_seconds)` (upsert, TTL min 60 s).
- `claim_pending_ai_jobs(p_limit int DEFAULT 10) RETURNS SETOF ai_jobs` : `UPDATE ... SET status='processing' WHERE id IN (SELECT ... WHERE status='pending' AND attempts < 5 ORDER BY created_at LIMIT p_limit FOR UPDATE SKIP LOCKED) RETURNING *`. `attempts` est incrémenté par la ROUTE (pas par le claim) pour ne pas brûler les tentatives sur quota dépassé.
- Revoke public, grant : quota → authenticated+service_role ; cache/claim → service_role uniquement.

**Choix hash cache : SHA-256 côté TS** (`node:crypto`, `cache.ts`) — pas pgcrypto : une dépendance SQL de moins, calcul serveur-only, stabilité garantie. Clé = `sha256(feature + '|' + promptNormalisé + '|' + 'fr')`, normalisation = trim + lowercase + collapse `\s+` (locale constante : site monolingue français).

- [ ] Commit `feat(db): AI foundations — JSONB cache, per-feature quota, async jobs`.

### Task A2 — Port + adapters (TDD)

**Files:** Create `src/lib/ai/providers/types.ts`, `openrouter.ts`, `noop.ts`, `index.ts` ; Test `tests/ai/providers.spec.ts`.

Interfaces (spec §4.1-4.4 verbatim) :
```ts
export type AITier = 'heavy' | 'fast';
export interface AIRequest { feature: string; tier: AITier; system: string; prompt: string;
  maxTokens: number; reasoningBudget?: number; cacheTtlSeconds?: number; userId?: string; }
export interface AIResponse { text: string; model: string; degraded: boolean; cached: boolean; provider: string; }
export interface AIProvider { readonly name: string; isAvailable(): boolean;
  complete(req: AIRequest): Promise<string>; }
```
- `openrouter.complete` : POST `https://openrouter.ai/api/v1/chat/completions`, headers Authorization/HTTP-Referer/X-Title:'LKDV' ; messages system+user ; `max_tokens` ; `reasoning: { max_tokens }` UNIQUEMENT tier heavy ET `reasoningBudget` défini ; throw `{name:'OpenRouterError', status}` sur !ok ou contenu vide ; AbortController 8s fast / 45s heavy. Export `MODEL_BY_TIER` + `modelFor(tier)`.
- `noop` : isAvailable()=true, complete() → `throw new Error('IA indisponible')`.
- `index.getProvider()` : openrouter si `isAvailable()`, sinon noop. Unique point d'extension future.

Tests : headers exacts, modèle par tier, reasoning envoyé seulement heavy+budget ( Jamais pour fast), throw 429/500/vide, timeout AbortSignal transmis, `isAvailable` sans/avec clé, getProvider bascule noop.

- [ ] RED → implémentation → GREEN → Commit `feat(ai): provider port + openrouter/noop adapters`.

### Task A3 — cache.ts + quota.ts (TDD)

**Files:** Create `src/lib/ai/cache.ts`, `src/lib/ai/quota.ts` ; Test `tests/ai/cache.spec.ts`.
- `cache.ts` : client service-role (pattern ex-responseStore, memoïsé, `SUPABASE_SERVICE_ROLE_KEY` absent → cache désactivé, warn une fois, jamais d'exception). `normalizePrompt`, `buildCacheKey(feature, prompt)`, `getCached(feature, prompt) → AIResponse|null` (parse JSONB stocké `{text, model, provider, degraded}`), `setCached(feature, prompt, response, ttlSeconds)` (no-op si ttl ≤ 0 ou client absent).
- `quota.ts` : `consumeQuota(userId, tier, feature, featureLimit) → boolean` via rpc ; **fail-open** sur erreur rpc (warn) : l'app ne doit pas mourir si la migration n'est pas encore appliquée — documenté.
- Tests : normalisation (casse/espaces → même clé), clés distinctes par feature, TTL 0 → setCached no-op, sans clé service → getCached null / setCached no-throw.

### Task A4 — Registre + 3 features + 2 features techniques (TDD)

**Files:** Create `src/lib/ai/features/registry.ts`, `kitConfigurator.ts`, `trailNarrative.ts`, `countryGuides.ts` ; Test `tests/ai/registry.spec.ts`.

```ts
export interface FeatureSpec {
  tier: AITier; maxReasoningBudget: number; cacheTtlSeconds: number; maxPerUserPerDay: number;
  fallbackResponse: (req: AIRequest) => Promise<AIResponse>;  // JAMAIS de throw
}
export const FEATURES: Record<string, FeatureSpec>;
export function getFeature(name: string): FeatureSpec;  // throw si inconnue (bug programmeur)
```
| feature | tier | budget | TTL | /jour |
|---|---|---|---|---|
| kit-configurator | heavy | 4000 | 0 (kit personnel) | 10 |
| trail-narrative | heavy | 6000 | 31536000 | 5 |
| country-guides | heavy | 2000 | 2592000 | 30 |
| chat-completion | (req.tier) | 4096 | 0 | 100 |
| diagnostic | (req.tier) | 512 | 0 | 50 |

Conventions : `tier` du registre = défaut déclaré ; `askAI` utilise TOUJOURS `req.tier` (l'appelant passe `spec.tier`), le registre borne le reasoning. `fallbackResponse` = messages dégradés sobres génériques ; les fallbacks « riches » (listes déterministes, template stats) sont construits par les routes qui ont les données (voir B/C/D) — justification : `AIRequest` ne transporte pas les données déterministes.

Tests : chaque feature a une fallbackResponse qui résout un `AIResponse` valide (exécutées réellement), `getFeature` throw sur inconnue.

### Task A5 — askAI.ts (TDD, port des tests du routeur existant adaptés)

**Files:** Create `src/lib/ai/askAI.ts` (`import 'server-only'`) ; Test `tests/ai/askAI.spec.ts`.

Flux STRICT (spec §4.8) :
1. Zod parse → invalide = throw (bug programmeur, pas un path utilisateur).
2. `getFeature` → inconnue = throw.
3. TTL > 0 → `getCached` ; hit → `{...hit, cached: true}`.
4. `userId` présent → `consumeQuota(userId, tier, feature, spec.maxPerUserPerDay)` ; refusé → `spec.fallbackResponse(req)`.
5. `reasoningBudget` effectif = `min(spec.maxReasoningBudget, req.reasoningBudget ?? spec.maxReasoningBudget)` → `getProvider().complete(...)` → succès : `setCached` si TTL > 0, return `{text, model: modelFor(tier) si openrouter sinon provider.name, degraded:false, cached:false, provider}`.
6. catch → `console.error` sans clé → `spec.fallbackResponse(req)` (degraded:true, provider:'fallback').

Tests (mock `@/lib/ai/providers`, `@/lib/ai/cache`, `@/lib/ai/quota`) : succès ; 429 → fallback, aucun throw ; cache hit → provider NON appelé ; quota refusé → fallback, provider NON appelé ; reasoning borné Ultra seulement (capture args) ; fuite de clé impossible (JSON.stringify du résultat) ; feature inconnue → throw ; sans clé OpenRouter → noop → fallback ; TTL 0 → pas de cache.

### Task A6 — Rewire routes + nettoyage

**Files:** Modify `src/app/api/ai/chat-completion/route.ts`, `src/app/api/ai/ping/route.ts`, `src/lib/ai/requestMode.ts`, tests ; Delete `src/lib/ai/nemotronRouter.ts`, `src/lib/ai/responseStore.ts`, `tests/ai/nemotronRouter.spec.ts` (portés vers askAI.spec.ts).
- `requestMode.ts` : retirer `ASKAI_ERROR_STATUS` + `import type { AskAIErrorCode }` (types disparus) + son test.
- Route chat-completion : import `askAI` depuis `@/lib/ai/askAI` ; le bloc rpc quota est RETIRÉ (askAI consomme via registre) ; appel `askAI({ feature:'chat-completion', tier: body.task, system, prompt, maxTokens: body.maxTokens ?? 2048, reasoningBudget: body.reasoningBudget, userId: userId ?? undefined, cacheTtlSeconds: 0 })` ; réponse 200 `{ text, model, degraded, cached, provider }` (mode dégradé = flag, pas de 500) ; SSE émulé conservé ; legacy inchangé.
- Ping : `feature:'diagnostic'`, `cacheTtlSeconds: 0`, réponse `{ ultra:{ok,ms,degraded}, nano:{ok,ms,degraded} }` inchangée.
- [ ] Gates complètes → Commit `refactor(ai): port/registry architecture, askAI sole entry point`.

---

# CHANTIER B — CONFIGURATEUR DE KIT (revenu boutique)

### Task B1 — Extraction du moteur pur (server-safe)

**Files:** Create `src/lib/ai/configuratorCore.ts` ; Modify `src/lib/ai/configuratorEngine.ts` ; Test `tests/ai/configuratorCore.spec.ts`.

**Choix (le moins invasif, justifié) :** `computeConnectedReport` reste l'API publique du moteur (composants browser inchangés) mais **délègue** détection/totaux/score à `configuratorCore.analyzeKit({ catalog, ownedItems, weatherKey, durationKey, groupMode, groupMembersCount })` — fonction PURE (zéro import Supabase) reprenant verbatim `hasSac/hasDuvet/hasEau/hasVeste/hasTente`, `findProductForCategory` (règle « never fabricate »), `pushIfReal`, alerts météo, totaux, score. La route serveur importe `configuratorCore` + passe catalog/inventaire pré-fetchés côté serveur (client browser jamais importé en serveur).

### Task B2 — Feature kitConfigurator + validation Zod « never fabricate »

**Files:** Create `src/lib/ai/features/kitConfigurator.ts` ; Test `tests/ai/kitConfigurator.spec.ts`.
- `buildKitPrompt({ sessionParams, selectedItems, sourceable, analysis })` → prompt existant (template actuel de la route conservé) + section `ANALYSE DÉTERMINISTE (fait par le code, ne pas réinventer)` avec missingItems/inadequateAlerts JSON + consigne : `alternatives` DOIVENT référencer `"id"` du catalogue fourni.
- `kitAIOutputSchema` (Zod strict, shape exacte attendue par la route) : justifications, alternatives `{eco, premium: {id?, name, brand, price_eur, reason}}`, consumables, bring_yourself, carbon_kg_estimate, destination_context.
- `sanitizeAIKitOutput(parsed, catalogIds)` : ne conserve eco/premium que si `id` ∈ catalogue (ou match name+brand exact → id attaché) ; **tout produit non appariable est supprimé** (jamais fabriqué). Retourne `{data, fabricatedDropped: number}`.
- `buildDeterministicFallback(sessionParams, analysis)` : même shape, justifications/alternatives vides, bring_yourself statique, destination_context dérivé de sessionParams (reprise du fallback catch actuel).

### Task B3 — Câblage route kit-report/generate

**Files:** Modify `src/app/api/kit-report/generate/route.ts`.
1. Zod sur le body (sessionParams + selectedItems) → 400 propre.
2. Mappage `sourceable` → `RealShopProduct[]` ; durée → `durationKey` (diff dates : ≤2j '1-2d', ≤5 '3-5d', ≤14 '1-2w', sinon '2w+') ; season/climate → `weatherKey` (hiver/froid→'froid_sec', pluie→'pluvieux_vente', été/chaud→'sec_chaud', défaut 'frais_brumeux') — mapping déterministe documenté.
3. `analyzeKit(...)` → analysis (données réelles).
4. `askAI({ feature:'kit-configurator', tier:spec.tier, system, prompt, maxTokens: 4000, userId, cacheTtlSeconds: 0 })` — remplace `getChatCompletion(GEMINI,...)`.
5. Parse + Zod + sanitize ; **si result.degraded OU parse invalide → buildDeterministicFallback** (jamais 500). Fabrications droppées loggées en warn.
6. Calcul totalWeightG/totalPriceEur + insertion configurator_sessions/kit_reports : INCHANGÉS.
- [ ] Gates → Commit `feat(ai): kit-configurator via Nemotron — deterministic first, AI enriches`.

---

# CHANTIER C — RÉCIT POST-RANDONNÉE (async, ai_jobs + cron + push)

### Task C1 — Feature trailNarrative
**Files:** Create `src/lib/ai/features/trailNarrative.ts` ; Test `tests/ai/trailNarrative.spec.ts`.
- Spec (heavy, 6000, 31536000, 5) ; `trailNarrativeJobSchema` (Zod payload : sessionId uuid, distanceKm, durationSeconds, elevationGainM, routeName?, weather?, startedAt?) ; `buildNarrativePrompt(stats)` (français, ton carnet de voyage, 150-250 mots, PAS de listes à puces) ; `buildNarrativeFallback(stats)` = template sobre `"Sortie de {distance} km, D+ {elevation} m, durée {duration}..."` (durée humaine h/min).

### Task C2 — Enfilement à la fin de sortie
**Files:** Create `src/app/api/ai/jobs/route.ts` (POST, `force-dynamic`, auth prod obligatoire, Zod `{feature:'trail-narrative', payload}`, INSERT ai_jobs via serveur, RLS insert-own, réponse 202 `{jobId}`) ; Modify `src/features/hiking/controllers/HikingController.ts` (après `saveSession` succès : `fetch('/api/ai/jobs', ...)` fire-and-forget avec `catch(() => {})` — ne JAMAIS bloquer/échouer la fermeture de sortie).
- Justif : insertion via API route (client n'accède jamais au routeur ; RLS insert-own suffit côté route car `auth.uid() = user_id`).

### Task C3 — Cron + notification
**Files:** Create `src/app/api/cron/process-ai-jobs/route.ts` (`force-dynamic`, `Authorization: Bearer ${CRON_SECRET}` sinon 401), `src/lib/ai/pushNotify.ts` ; Test `tests/ai/pushNotify.spec.ts` (mock web-push).
- Boucle : `rpc claim_pending_ai_jobs(10)` (client service) → pour chaque job trail-narrative : payload Zod → **quota testé AVANT askAI** (`consumeQuota` sans incrément de tentatives) → si refusé : re-passe en `pending` (retry jusqu'à minuit, jamais d'erreur visible) → `askAI({feature:'trail-narrative', userId, cacheTtlSeconds: spec TTL})` → succès : `UPDATE hike_sessions SET narratives = COALESCE(narratives,'{}'||jsonb_build_object('recit', text, 'model', model, 'generated_at', now()))` (colonne existante 20260809200000), job `done` + `attempts+1` → push web-push « Votre carnet est prêt » via `push_subscriptions` (`web-push` déjà dépendance, VAPID `NEXT_PUBLIC_VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`, skip silencieux si absentes) → échec provider (degraded) : `attempts+1`, re-`pending` (cap 5 géré par claim).
- [ ] Gates → Commit `feat(ai): async trail narratives via ai_jobs + cron + web-push`.

---

# CHANTIER D — GUIDES PAYS Q&R (cache comme modèle économique)

### Task D1 — Feature + questions
**Files:** Create `src/lib/ai/features/countryGuides.ts`, `src/lib/ai/countryGuidesPregen.ts` ; Test `tests/ai/countryGuides.spec.ts`.
- Spec (heavy, 2000, 2592000, 30) ; `COUNTRY_QUESTIONS` (~25 : eau potable, sécurité, visa, climat, meilleure saison, budget quotidien, prises électriques, monnaie/pourboires, numéros d'urgence, transport, connectivity/SIM, santé/vaccins, douane, langue… — array figé, testé length ≥ 25) ; `buildGuidePrompt(countryName, question, context)` (contexte depuis `countryDetails.ts` : monnaie, langue, saison, fuseau, capitale) ; `buildGuideFallback(detail?)` = réponse statique depuis les champs + mention sobre « réponse standard — l'assistant est très sollicité ».
- `countryGuidesPregen.generateForCountries(codes?, limit)` (server-only) : boucle pays × questions → `askAI` → `setCached` (TTL 30 j) ; saute les entrées encore valides.

### Task D2 — Route ask + cron refresh + script CLI
**Files:** Create `src/app/api/guides/[country]/ask/route.ts` (POST, `force-dynamic`, auth prod, Zod `{question: string.min(2).max(500)}`, pays validé, `askAI` → cache 30 j ; fallback statique), `src/app/api/cron/refresh-country-guides/route.ts` (CRON_SECRET, lot de N pays), `scripts/ai/pregen-country-guides.mjs` (**autonome** : fetch OpenRouter direct + rpc `set_ai_cache` service role via @supabase/supabase-js — ne peut PAS importer askAI server-only hors Next ; args `--country=xx --limit=n --dry-run`).
- Cache hit attendu ≈ 90 % : pré-génération hors trafic + TTL 30 j ; l'expiration naturelle + re-génération à la demande (quota user) font office de régénération — le cron refresh est un rafraîchissement proactif optionnel.
- [ ] Gates → Commit `feat(ai): country guides Q&R — pregenerated cache-first`.

---

# Rapport final (par chantier) — voir réponses dans la conversation
Fichiers exacts, SQL, actions manuelles (rotate anon key, OpenRouter ≥ 10 $, `.env.local` : OPENROUTER_API_KEY/NEXT_PUBLIC_SITE_URL/CRON_SECRET/VAPID, cron externe), gates, choix non triviaux, reports délibérés.
