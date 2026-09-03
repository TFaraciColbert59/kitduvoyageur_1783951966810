# Spec — Routeur IA central NVIDIA Nemotron via OpenRouter

> Spec issue du brief utilisateur du 2026-09-03 (chantier « Intégrer NVIDIA Nemotron
> via OpenRouter sur tout le site »). Ce document voyage avec le plan
> `docs/superpowers/plans/2026-09-03-nemotron-ai-router.md`.

## Objectif

Remplacer les providers IA payants (OPENAI/ANTHROPIC/GEMINI/PERPLEXITY via
`@rocketnew/llm-sdk`) par NVIDIA Nemotron via OpenRouter, derrière un routeur IA
central unique côté serveur.

## Modèles (IDs OpenRouter exacts)

| Tier  | Modèle OpenRouter ID                     |
|-------|------------------------------------------|
| HEAVY | `nvidia/nemotron-3-ultra-550b-a55b:free` |
| FAST  | `nvidia/nemotron-3-nano-30b-a3b:free`    |

Tier `:free` : 20 req/min, 50 req/jour par défaut (1000/jour si ≥ 10 $ de crédits,
jamais consommés sur `:free`). Congestion possible (429/5xx) → chaîne de fallback
obligatoire dès le départ. Nemotron 3 Ultra est un modèle à raisonnement
(budget défaut 16384 tokens) → borner `reasoning.max_tokens`.

## Prérequis — Chantier 0 (sécurité, ABSOLU)

`src/lib/supabase/server.ts` contient une clé anon Supabase en dur (fallback lignes 3-4),
commitée sur repo public → compromise.

1. Signaler clairement dans le rapport.
2. Refactorer `server.ts` pour exiger `NEXT_PUBLIC_SUPABASE_URL` et
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, sans fallback en dur (throw explicite si absent).
3. Ajouter ces clés à `.env.example` sans valeurs réelles.
4. Ne pas toucher à la logique cookies existante.
5. Action manuelle utilisateur : régénérer la clé anon (Dashboard Supabase →
   Settings → API → Rotate anon key).

## Livrables

### 1. Routeur IA central — `src/lib/ai/nemotronRouter.ts` (SERVEUR ONLY)

- `import 'server-only'` en tête (paquet `server-only` à ajouter — ajout autorisé,
  ne touche pas au bloc `rocketCritical`).
- `askAI(opts)` : `{ task: 'heavy'|'fast', system, prompt, maxTokens, reasoningBudget? }`
  validé par Zod. Retourne `{ text, model, degraded }`.
- OpenRouter `https://openrouter.ai/api/v1/chat/completions` via `fetch` natif
  (zéro nouveau SDK). Headers : `Authorization: Bearer $OPENROUTER_API_KEY`,
  `HTTP-Referer: $NEXT_PUBLIC_SITE_URL`, `X-Title: 'LKDV'`.
- Timeout `AbortSignal` : 8 s (`fast`), 45 s (`heavy`).
- Fallback : échec primaire (429/5xx/timeout) →
  heavy→nano ; fast→ultra borné à 1000 tokens → `degraded: true`.
  Jamais de throw non géré vers l'UI : erreur typée en dernier recours,
  traduite en toast gracieux par l'appelant.
- Ne jamais logger la clé. `console.error` uniquement.

### 2. Migration Supabase — cache + quota (idempotente)

`supabase/migrations/20260903…_*.sql` (nom final ajusté : le `.gitignore` contient
`*cache*` qui ignorerait silencieusement un fichier nommé `ai_cache_quota.sql`) :

- `ai_response_cache` : cache_key TEXT UNIQUE, feature, response, model, hit_count,
  created_at, expires_at. RLS ENABLE, policy SELECT = FALSE (service only).
  Index sur cache_key et expires_at.
- `ai_usage_daily` : user_id → auth.users ON DELETE CASCADE, day DATE DEFAULT
  CURRENT_DATE, requests_heavy INT, requests_fast INT, PK (user_id, day).
  RLS : user lit SA propre consommation uniquement.
- `check_and_increment_ai_quota(p_user_id UUID, p_tier TEXT) RETURNS BOOLEAN` :
  SECURITY DEFINER, limites 20 heavy + 100 fast / jour / user, atomique
  (INSERT … ON CONFLICT … DO UPDATE, vérifie le compteur AVANT incrément).
- `get_ai_cache(p_cache_key) RETURNS TEXT` (NULL si expiré) et
  `set_ai_cache(p_cache_key, p_feature, p_response, p_model, p_ttl_seconds)`.
- Le routeur consulte le cache AVANT l'appel et y écrit APRÈS, via service role
  côté serveur uniquement (jamais depuis le client).

### 3. Refonte `src/app/api/ai/chat-completion/route.ts`

- Conserver `export const dynamic = 'force-dynamic'` et l'auth production
  (`supabase.auth.getUser`).
- Ne PAS casser le streaming SSE existant. Deux modes :
  a) provider payant legacy demandé explicitement ET sa clé existe →
     comportement actuel conservé (rétrocompatibilité) ;
  b) sinon (défaut) → `askAI`, tier déduit du body (`task`), avec
     `check_and_increment_ai_quota` puis le cache.
- Toute entrée validée par Zod (provider, model, messages, task, parameters).
- Réponse mode (b) : `{ text, model, degraded, cached }`.

### 4. Endpoint diagnostic — `src/app/api/ai/ping/route.ts`

- GET `force-dynamic` : appelle Ultra ET Nano via `askAI` (prompt trivial),
  mesure la latence, renvoie `{ ultra: {ok, ms, degraded}, nano: {ok, ms, degraded} }`.
- Protégé par auth admin (`is_admin()` existant).

### 5. Variables d'environnement

- `.env.example` : ajouter `OPENROUTER_API_KEY=` et `NEXT_PUBLIC_SITE_URL=` (vides).
- `.env.local` : ne jamais le créer/modifier/committer — l'utilisateur le remplit
  manuellement. Vérifier qu'il reste git-ignoré.

### 6. Tests

- Vitest `nemotronRouter` : mock fetch — fallback sur 429, borne du reasoning
  budget, timeout, aucune fuite de clé dans les erreurs.
- Playwright e2e léger : `/api/ai/ping` répond 401 sans session admin, 200 avec.

## Quality gates (bloquants, ordre CI)

1. `npm run lint` · 2. `npm run type-check` · 3. `npm run build` · 4. `npm run test`
(`eslint.ignoreDuringBuilds` non touché.)

## Contraintes absolues

Aucune clé en dur · Zod sur toute entrée · RLS sur toute nouvelle table ·
séparation Server/Client stricte (zéro appel IA depuis `'use client'`) ·
aucune régression SSE ni providers legacy · dépendances : ajout uniquement
(bloc `rocketCritical` intact).

## Rapport final attendu

Fichiers créés/modifiés · SQL à exécuter dans Supabase · actions manuelles
(rotation clé anon, crédits OpenRouter ≥ 10 $, remplissage `.env.local`) ·
résultat des 4 quality gates.
