# Routeur IA Nemotron/OpenRouter — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Routeur IA central serveur (NVIDIA Nemotron via OpenRouter, fallback + cache + quota) remplaçant les providers payants par défaut, après sécurisation de la clé anon Supabase.

**Architecture:** Un module serveur `askAI` (fetch natif OpenRouter, chaîne de fallback heavy↔fast, timeouts, cache Supabase via service role) consommé par la route `chat-completion` (Zod + quota + rétrocompatibilité legacy/SSE) et par un endpoint de diagnostic `/api/ai/ping` (admin). Cache et quota portés par une migration Supabase idempotente (RLS + SECURITY DEFINER).

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Zod 4, `server-only`, Supabase (PostgreSQL/RLS), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-03-nemotron-ai-router.md`

## Global Constraints

- AUCUNE clé en dur, nulle part ; secrets uniquement en variables d'environnement.
- Zod sur toute entrée API. RLS ENABLE + policy nommée snake_case sur toute nouvelle table. Migrations idempotentes.
- Bloc `rocketCritical` de `package.json` intouchable (ajouts uniquement). Scripts `dev`/`build` sacrés. `eslint.ignoreDuringBuilds` non touché.
- ⚠️ `.gitignore` contient `*cache*` : AUCUN fichier ne doit contenir « cache » dans son NOM (contenu OK). D'où : `responseStore.ts`, migration `_ai_quota_response_store.sql` (vérifié via `git check-ignore`).
- Tests unitaires Vitest : `tests/**/*.spec.ts` (config `vitest.config.ts`). E2E Playwright : `scripts/e2e/`.
- Migrations : `supabase/migrations/`, `npm run type-check` doit passer en strict.
- Modèles OpenRouter : HEAVY `nvidia/nemotron-3-ultra-550b-a55b:free`, FAST `nvidia/nemotron-3-nano-30b-a3b:free`.
- Timeouts : 8 s fast / 45 s heavy. Fallback : heavy→nano ; fast→ultra borné 1000 tokens. Reasoning budget max 8192.
- Quota : 20 heavy + 100 fast / jour / user.
- Commits par tâche, message `feat|fix|chore(...)` + `Co-Authored-By: Claude Code <noreply@anthropic.com>`.
- Worktree non requis ; branche `feat/nemotron-ai-router` (jamais de commit direct sur `main`).

---

### Task 1 — Chantier 0 : sécurisation `server.ts` + `.env.example`

**Files:**
- Modify: `src/lib/supabase/server.ts`
- Create: `.env.example`
- Test: `tests/supabase/serverConfig.spec.ts`

**Interfaces:**
- Produces: `createClient(): Promise<SupabaseClient>` (signature inchangée) — throw explicite si `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` absents ; logique cookies inchangée.

- [ ] Écrire le test d'abord (`TEST-SRV-01/02/03/04`), le voir échouer (`npx vitest run tests/supabase/serverConfig.spec.ts`).
- [ ] Implémenter : `getSupabaseConfig()` (référence statique `process.env.NEXT_PUBLIC_*` pour l'inlining Next, lazy dans `createClient()`), cookies inchangés.
- [ ] Voir passer. Créer `.env.example` (toutes valeurs vides). Commit `fix(security)`.

### Task 2 — Migration Supabase cache + quota

**Files:**
- Create: `supabase/migrations/20260903000000_ai_quota_response_store.sql`

- [ ] `ai_response_cache` (PK cache_key, index expires_at, RLS, policy select=false), `ai_usage_daily` (PK (user_id, day), RLS select own), fonctions `check_and_increment_ai_quota` (SECURITY DEFINER, upsert atomique avec WHERE de garde → vérifie AVANT d'incrémenter), `get_ai_cache` (NULL si expiré, incrémente hit_count), `set_ai_cache` (upsert TTL min 60 s). Revoke public, grant service_role (quota aussi à authenticated). Commit `feat(db)`.

### Task 3 — Routeur `askAI` + store de réponses (TDD)

**Files:**
- Create: `src/lib/ai/nemotronRouter.ts`, `src/lib/ai/responseStore.ts`, `src/types/server-only.d.ts`, `tests/mocks/server-only.ts`
- Modify: `vitest.config.ts` (alias `server-only` → mock)
- Test: `tests/ai/nemotronRouter.spec.ts`
- Deps: `npm install server-only` (ajout autorisé)

**Interfaces:**
- Produces: `askAI(opts: AskAIOpts): Promise<AskAIResult>` avec
  `AskAIResult = { ok: true; text; model; degraded; cached } | { ok: false; text: ''; model: null; degraded: true; error: { code: 'INVALID_INPUT'|'NO_KEY'|'ALL_PROVIDERS_FAILED'; message } }` ;
  constantes `NEMOTRON_MODELS`, `AI_TIMEOUT_MS`, `MAX_REASONING_BUDGET`.
- `responseStore` : `buildCacheKey`, `getCachedResponse`, `storeCachedResponse` (client service role ; cache désactivé sans clé, jamais d'exception).

- [ ] Tests d'abord (12 cas : happy paths fast/heavy, clamp reasoning 8192, fallback 429/5xx/AbortError, 401 sans fallback, double échec typé sans fuite de clé, NO_KEY, cache hit/miss/écriture, entrée invalide, fallback fast→ultra borné 1000 tokens). Voir ÉCHOUER.
- [ ] Implémenter. Voir PASSER. Commit `feat(ai)`.

### Task 4 — `requestMode` + refonte `chat-completion` (TDD sur la logique pure)

**Files:**
- Create: `src/lib/ai/requestMode.ts`, Test: `tests/ai/requestMode.spec.ts`
- Modify: `src/app/api/ai/chat-completion/route.ts`

**Interfaces:**
- Produces: `chatCompletionBodySchema` (Zod : provider legacy|nemotron, task heavy|fast défaut fast, system/prompt/messages, stream défaut false, maxTokens, reasoningBudget, parameters défaut {}), `resolveAiMode(rawBody, apiKeys)` → `{ok, mode: 'legacy'|'nemotron', body} | {ok: false, issues}`, `derivePromptAndSystem(body)` → `{system, prompt} | null` (system fallback = `DEFAULT_LKDV_SYSTEM` avec garde-fous), `buildSsePayload(text, degraded)` (frames `start`/`chunk`/`done` compatibles client existant), `ASKAI_ERROR_STATUS`.

- [ ] Tests d'abord (`TEST-MODE-*` : legacy si clé présente, sinon nemotron, task défaut, invalidité, dérivation prompt/system, payload SSE). Voir ÉCHOUER → implémenter → PASSER.
- [ ] Route : garder `force-dynamic`, auth prod inchangée ; mode legacy = comportement actuel exact (validation « Missing required fields », SSE stream) ; mode nemotron = quota `check_and_increment_ai_quota` (401→skip en dev, erreur quota → 429), `askAI`, JSON `{text, model, degraded, cached}` ou SSE émulé si `stream:true`. Aucun throw non géré.
- [ ] Commit `feat(ai)`.

### Task 5 — Endpoint diagnostic `/api/ai/ping` + e2e

**Files:**
- Create: `src/app/api/ai/ping/route.ts`, Test e2e: `scripts/e2e/ai-ping.spec.ts`

- [ ] GET `force-dynamic` : 401 sans session ; 403 si `rpc('is_admin')` faux ; sinon appelle heavy+fast (prompt trivial, `cache:false`), mesure ms, renvoie `{ ultra: {ok, ms, degraded}, nano: {ok, ms, degraded} }`.
- [ ] E2E : 401 sans session (toujours exécuté) ; 200 admin (skip sans `TEST_ADMIN_EMAIL`/`TEST_ADMIN_PASSWORD`, login Supabase password grant + cookie `sb-<ref>-auth-token`).
- [ ] Commit `feat(ai)`.

### Task 6 — Quality gates + rapport

- [ ] `npm run lint` → [ ] `npm run type-check` → [ ] `npm run build` → [ ] `npm run test` (ordre CI, tous bloquants).
- [ ] E2E 401 si serveur démarrable.
- [ ] Rapport : fichiers, SQL à exécuter, actions manuelles (rotation clé anon, crédits OpenRouter ≥ 10 $, `.env.local`), résultat des gates.

## Self-Review (fait à l'écriture)

- Couverture spec : Chantier 0 (T1), routeur (T3), migration (T2), route (T4), ping (T5), env (T1/T3), tests (T3/T4/T5), gates (T6). ✔
- Noms/types cohérents entre Tasks (interfaces ci-dessus). ✔
- Pièges vérifiés : `*cache*` gitignore (noms de fichiers), zod v4 `z.record(z.string(), z.unknown())`, `import type` pour éviter de tirer `server-only` dans les tests de `requestMode`, NEXT_PUBLIC_* référencés statiquement pour l'inlining client. ✔
