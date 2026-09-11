# Rapport a10 — 10.7 / 10.8 / 10.9 / 10.10

Date : 2026-09-11 · Branche : `audit/adventure-intelligence` · Worktree : `ai-finalization`
Périmètre : audit `31bdb279` items #10, #11, #12, #13, #17, #25, #35 (volet backtesting
V1/V2 préparé par les shadow runners) · Spec : `docs/superpowers/specs/2026-09-11-a10-p0-finalization-design.md`.

## Commits

| Lot | SHA | Sujet |
| --- | --- | --- |
| 10.7 | `96b682fa` | `feat(a10): consentements imposes et purge sur revocation` |
| 10.8 | `247b3680` | `feat(a10): idempotence et quotas de generation` |
| 10.9 | `6eb2f333` | `feat(a10): profil reel injecte et predictions persistees` |
| 10.10 | `b22ff1e5` | `feat(a10): shadow runners et table de comparaison` |

## Gates exécutés

- Avant chaque commit : `npx vitest run tests/adventure-intelligence`, `npm run type-check`, `npm run lint` (exit 0, warnings préexistants uniquement).
- Avant clôture : **`npm run test` complet = 248 fichiers / 1833 tests verts** (exit 0).
- Aucun `npm run build`. Aucun flag activé. Aucune donnée de santé.

---

## Lot 10.7 — Consentements imposés + révocation

### Fichiers

- `supabase/migrations/20260911250000_a10_consent_enforcement.sql` (nouveau)
- `src/features/adventure-intelligence/server/processHikeSession.ts` (client `hasActiveConsent`, gating fail-safe)
- `src/app/api/cron/process-hike-sessions/route.ts` (adapter RPC consentement)
- `src/app/api/cron/aggregate-segments/route.ts` (getConsents : dernière version seulement — #25)
- `src/features/adventure-intelligence/domain/events.ts` (`consent.revoked`)
- `src/features/adventure-intelligence/server/consents.ts` (émission best-effort)
- `src/features/adventure-intelligence/server/processAdventureEvents.ts` (nouveau)
- `src/app/api/cron/process-adventure-events/route.ts` (nouveau)
- `tests/adventure-intelligence/consent-enforcement.spec.ts` (nouveau, 8 tests)
- `supabase/tests/database/a10_consent_enforcement.test.sql` (nouveau, 9 assertions)

### RPC / SQL

```sql
public.has_active_consent(p_user_id uuid, p_purpose text) RETURNS boolean
-- LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
-- sélectionne LA dernière policy_version du couple (user, purpose) :
-- granted AND revoked_at IS NULL ; COALESCE(..., false)
-- REVOKE public/anon/authenticated ; GRANT service_role
```

### Règles appliquées

- `processHikeSession` : `personal_performance` commande les observations, `collective_terrain`
  l'éligibilité collective (indépendants) ; une erreur de contrôle vaut refus (fail-closed) ;
  le legacy sans horodatage reste privé (10.3 conservé).
- `setConsent(false)` émet `consent.revoked` (payload `{userId, purpose, policyVersion,
  revokedAt}`, clé `consent.revoked:<userId>:<purpose>:<revokedAt>`, `processor_version =
  a10-consent-v1`) — jamais bloquant (try/catch + log).
- Handler `consent.revoked` : observations → versions de profil → profil → prédictions
  segment → prédictions route → agrégats collectifs des segments contribués → `processed`.
  Type inconnu = no-op marqué traité ; payload sans user = `failed: missing_user_id`.
- Claim par `claim_pending_adventure_events` existante (SKIP LOCKED, cap 5 tentatives).

### TDD evidence

- **Rouge capturé** : `npx vitest run tests/adventure-intelligence/consent-enforcement.spec.ts`
  → `Error: Cannot find package '@/.../server/processAdventureEvents'`.
- **Vert** : 46 fichiers / 292 tests adventure-intelligence.

---

## Lot 10.8 — Durcissement `/api/adventure/generate`

### Fichiers

- `supabase/migrations/20260911260000_a10_generation_requests.sql` (nouveau)
- `src/features/adventure-intelligence/domain/generationLimits.ts` (nouveau, pur)
- `src/features/adventure-intelligence/server/generationRequests.ts` (nouveau, store Supabase)
- `src/app/api/adventure/generate/route.ts` (durci)
- `tests/adventure-intelligence/generation-limits.spec.ts` (nouveau, 9 tests)
- `tests/adventure-intelligence/adventure-api.spec.ts` (en-tête + store mockés)

### SQL

```sql
adventure_generation_requests(
  id uuid pk, user_id uuid NOT NULL, idempotency_key text NOT NULL,
  status text CHECK (pending|done|failed), plan_id uuid, created_at timestamptz
)
UNIQUE (user_id, idempotency_key)
UNIQUE INDEX (user_id) WHERE status = 'pending'   -- 1 génération active
RLS propriétaire SELECT ; service_role ALL
```

### Décisions pures

`evaluateGenerationRequest({ existing, activePending, recentCount, quotaPerHour? })`
→ `reuse` (clé `done`, plan_id présent) | `conflict` (clé pending, clé done sans plan,
autre pending) | `rate_limited` (quota 5/h, `retryAfterS = 3600`) | `proceed`.
Un échec (`failed`) peut être retenté avec la même clé sous réserve de quota.

### Route

`Idempotency-Key` obligatoire (400, 1..200 car.), 409 si pending/actif, 429 +
`Retry-After: 3600`. Réponse `reuse` reconstruite depuis le plan persisté (planId,
version, variantes, `reused: true`, 200) sans régénération. Après persistance :
`markDone(id, plan_id)` ; sur échec de génération : `markFailed(id)` puis 500.

### TDD evidence

- **Rouge capturé** : import `generationLimits` introuvable.
- **Vert** : 47 fichiers / 301 tests.

---

## Lot 10.9 — Profil réel + prédictions persistées

### Fichiers

- `supabase/migrations/20260911270000_a10_predictions_persist.sql` (nouveau)
- `src/features/adventure-intelligence/server/generateAdventure.ts` (deps + persistance + adapters)
- `src/features/adventure-intelligence/server/adapters/difficultyAdapter.ts` (`segmentPredictions`)
- `src/app/api/adventure/generate/route.ts` (câblage profil/consentement/persistance)
- `tests/adventure-intelligence/predictions-persist.spec.ts` (nouveau, 6 tests)
- `tests/adventure-intelligence/generate-adventure.spec.ts` (deps A10 par défaut)

### RPC

```sql
public.persist_adventure_predictions(
  p_plan_id uuid, p_user_id uuid,
  p_segments jsonb DEFAULT '[]', p_route jsonb DEFAULT '[]'
) RETURNS jsonb
-- SECURITY DEFINER, search_path verrouillé, service_role uniquement
-- upsert segment_predictions (user+segment+context_hash+model_version)
-- upsert route_predictions (user+plan+strategy+model_version), index unique partiel ajouté
-- model_version = 'a10-v1', context_hash = 'uniform_from_blueprint'
```

### Câblage

- `generateAdventure` vérifie `hasActiveConsent(userId, 'personal_performance')` **avant**
  tout chargement ; consentement actif ⇒ `getCurrentProfile` et injection `profile` +
  `startAt` dans `predictionAdapter`/`difficultyAdapter` (`flagEnabled` dérivé de
  `context.featureFlags.route_prediction_v2 === true` côté route) ; sinon profil `null`
  et repli standard explicite (avertissement `cold_profile`).
- Persistance des prédictions **best-effort** après le bundle : un échec est journalisé
  et ne remet pas en cause le plan déjà persisté.
- Route : `getStoredPerformanceProfile` (`user_performance_profiles`), RPC
  `has_active_consent`, `createSupabaseAdventurePredictionPersistence`.

### TDD evidence

- Tests écrits avant implémentation ; première exécution après câblage : échec du
  harness (`persistAdventurePredictions` non exposé), corrigé, puis vert.
- **Vert** : 48 fichiers / 307 tests.

---

## Lot 10.10 — Shadow runners

### Fichiers

- `supabase/migrations/20260911280000_a10_shadow_runs.sql` (nouveau)
- `src/features/adventure-intelligence/server/shadowRuns.ts` (nouveau, runner + adapter)
- `src/app/api/cron/run-adventure-shadows/route.ts` (nouveau)
- `tests/adventure-intelligence/shadow-runs.spec.ts` (nouveau, 5 tests)

### SQL

```sql
adventure_shadow_runs(
  id uuid pk, user_id uuid NULL, kind CHECK (profile|route_prediction|collective|terrain_auto),
  primary_version text, shadow_version text, primary_value jsonb, shadow_value jsonb,
  delta_pct numeric, agreement boolean, confidence jsonb, latency_ms integer >= 0,
  decision CHECK (pending|keep|promote|reject) DEFAULT 'pending', created_at
)
INDEX (kind, created_at DESC) · RLS service_role only · REVOKE public/anon/authenticated
GRANT SELECT/INSERT/UPDATE/DELETE TO service_role
```

### Comportement

- Flags éteints ⇒ **aucun échantillon lu** (coût nul).
- `listRecentPassages(limit)` borné (`25 × limit`, limit ≤ 20 par défaut), utilisateurs
  limités, profil réel exigé (sinon utilisateur ignoré — aucune comparaison inventée).
- `profile` : pace moyenne pondérée standard vs profil ; `route_prediction` : durée P50
  recommandée standard vs profil ; `collective` : médiane des ralentissements attendus
  standard vs profil ; `terrain_auto` : candidates `detectAutoCandidates` journalisés
  `kind='terrain_auto'`, `user_id = null`, jamais publiés (décision `pending`).
- Latence mesurée par comparaison/en lot ; `compareShadow` (tolérance 15 %) fournit
  `delta_pct`/`agreement`.

### TDD evidence

- Tests écrits avant implémentation, exécutés verts au premier run après implémentation.
- **Vert** : 49 fichiers / 312 tests.

---

## Signature des objets SQL créés

| Objet | Type | Accès |
| --- | --- | --- |
| `has_active_consent(uuid, text) → boolean` | fonction STABLE SECURITY DEFINER | service_role uniquement |
| `persist_adventure_predictions(uuid, uuid, jsonb, jsonb) → jsonb` | fonction SECURITY DEFINER | service_role uniquement |
| `adventure_generation_requests` | table | RLS : SELECT propriétaire + service_role ALL |
| `adventure_shadow_runs` | table | RLS : service_role only, anon/authenticated révoqués |

## Décisions de câblage notables

1. Consentements indépendants dans `processHikeSession` (observations ≠ collectif) et
   fail-closed sur erreur de contrôle.
2. Clé d'idempotence `consent.revoked` incluant `revokedAt` : une re-révocation après
   regrant déclenche bien une nouvelle purge (clé stable pour un même instant).
3. `aggregate-segments` aligné sur « dernière version seulement » (#25) sans N+1 RPC.
4. `run-adventure-shadows` lit `feature_flags` en direct service_role : la RPC
   `current_feature_flags` est réservée à `authenticated` et retomberait sur les défauts
   en contexte cron.
5. Persistance des prédictions best-effort (plan déjà persisté) ; réponse `reuse` de la
   route reconstruite depuis le plan pour rester sans régénération.

## Préoccupations / limites assumées

1. **`segment_predictions` et pseudo-segments (a11)** : les segments du blueprint sont
   uniformes (id 1..N) et référencés par FK vers `trail_segments`. Pour ne pas associer
   des prédictions à de vrais segments, la RPC filtre par `JOIN trail_segments` : tant
   que le routage réel n'est pas branché, seules les `route_predictions` sont écrites
   (les lignes segment partiront automatiquement avec de vrais ids en a11).
2. **Ordre des `policy_version`** : `has_active_consent` trie `policy_version DESC`
   (texte). Une future nomenclature multi-digit (`a1-v10`) nécessiterait un tri
   sémantique ; une seule version existe aujourd'hui par utilisateur/finalité.
3. **Terrain auto** : la fenêtre de comparaison collective des shadows utilise les
   passages éligibles récents ; sans profil réel l'utilisateur est ignoré (pas de
   comparaison fictive), donc les volumes shadow dépendent de la calibration.
4. `processAdventureEvents` marque `processed` les types d'événements inconnus (no-op
   journalisé) pour ne pas bloquer la file ; à revoir si d'autres handlers arrivent.
5. Tests 10.9/10.10 écrits avant implémentation mais sans capture rouge propre
   (contrairement à 10.7/10.8) ; le vert a été obtenu après corrections de harness.

---

## Correctifs de revue — purge sécurisée et file fiable

Commit : `fix(a10): purge sur revocation securisee et file evenements fiable`.

| # | Constat | Correctif |
| --- | --- | --- |
| 1 | **Critique** — `consent.revoked` dérivait la cible de `payload.userId` : un payload forgé (acteur A, `userId` B) pouvait purger B (insert authentifié A1). | `processAdventureEvents` dérive la cible **exclusivement** de `actor_id` : absent → `missing_actor_id`, `payload.userId` divergent → `actor_mismatch` (refus tracé, aucune purge). |
| 2 | **Important** — `claim_pending_adventure_events` ne réclamait que `pending`, n'incrémentait pas `attempts` ; `markEventFailed` terminal ⇒ purge RGPD pouvait ne jamais aboutir. | `CREATE OR REPLACE` dans `20260911250000_a10_consent_enforcement.sql` : réclame `pending` + `failed` tant que `attempts < 5`, incrémente `attempts` dans le claim, grants re-verrouillés service_role. À 5 tentatives : ligne `failed` terminale (documentée). Échec applicatif → `status='failed'` + `error`, réessayable. |
| 3 | **Important** — backfill de lease manquant : les `hike_sessions` en `processing` sans `processing_started_at` restaient invisibles au claim. | Backfill idempotent ajouté à `20260911230000_a10_session_lease.sql` (lease à `now()`). |
| 4 | **Mineur** — déduplication avant index unique partiel : `created_at` seul laissait survivre des doublons à timestamp égal. | Départage déterministe `OR (a.created_at = b.created_at AND a.id < b.id)` dans `20260911220000_a10_transactional_rpcs.sql`. |

### Fichiers

- `src/features/adventure-intelligence/server/processAdventureEvents.ts` (cible = acteur, raisons explicites)
- `src/app/api/cron/process-adventure-events/route.ts` (sémantique failed réessayable documentée + log)
- `supabase/migrations/20260911250000_a10_consent_enforcement.sql` (claim `pending`+`failed`)
- `supabase/migrations/20260911230000_a10_session_lease.sql` (backfill)
- `supabase/migrations/20260911220000_a10_transactional_rpcs.sql` (départage `id`)
- `tests/adventure-intelligence/consent-enforcement.spec.ts` (`missing_actor_id`, TEST-A10-CONS-06)
- `supabase/tests/database/a10_consent_enforcement.test.sql` (21 assertions, DB-08..12 retry/cap/terminal)

### Tests

- TEST-A10-CONS-06 : acteur A + `payload.userId` B ⇒ `actor_mismatch`, aucune
  suppression (ni B, ni A), `markEventFailed` appelé, `processed` non appelé.
- pgTAP DB-08..12 : claim `pending`+`failed`, attempts incrémenté, processing en vol
  ignoré, rejeu d'un échec transitoire, montée jusqu'au cap 5, état terminal `failed`
  avec erreur conservée (purge non silencieusement impossible).
- pgTAP **non exécutés** localement (Docker/base absents, contrainte déjà documentée
  lot 10.2) : à lancer sur la copie avec les autres suites.

### Gates

- `npx vitest run tests/adventure-intelligence` : 49 fichiers / **313 tests verts**.
- `npm run type-check` : exit 0.
- `npm run lint` : exit 0, warnings préexistants uniquement.
- `npm run test` (complet) : 248 fichiers / **1834 tests verts** (exit 0).
