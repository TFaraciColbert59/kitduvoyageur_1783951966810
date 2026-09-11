# a10 — P0 · Finalisation préproduction — Design & Plan

Date : 2026-09-11 · Type : spec + plan combinés
Entrées contractuelles : `docs/architecture/adventure-intelligence-audit-31bdb279.md`,
`docs/architecture/adventure-intelligence-finalization-roadmap.md`, ADR-AI-001..008.
Skills : `supabase-postgis` (RLS, index, PostGIS), `subagent-driven-development`, TDD.

## Règles globales

- Migrations additives/idempotentes `20260911210000+` ; RLS obligatoire ;
  `SECURITY DEFINER` + `search_path = public, pg_temp` + REVOKE/GRANT explicites.
- Aucun flag de domaine activé ; aucun connecteur santé ; aucune donnée inventée.
- Tests TS dans `tests/adventure-intelligence/*.spec.ts` (IDs `TEST-A10-*`), pgTAP dans
  `supabase/tests/database/a10_*.test.sql`.
- CI obligatoire par lot ; push `origin audit/adventure-intelligence` après gates.
- Commits : `type(scope): description` sans accents.

---

## Lot 10.1 — CI et hygiène dépôt

**Files:** Modify `.github/workflows/ci.yml` (+ résolution SHA des actions).

- `on.push.branches` : ajouter `'audit/**'`.
- Ajouter la gate `npm run verify:icons` dans `quality-gates`.
- Épingler les actions par SHA (checkout, setup-node, upload-artifact) avec commentaire
  du tag (`# v4.x.y`), vérifié via `git ls-remote`.
- E2E : conserver `scripts/e2e/voyage.spec.ts` + ajouter le spec AI (lot 10.11 le crée) ;
  prévoir `npx playwright test` complet derrière une variable de workflow si stable.
- Commit : `ci(a10): audit branch, icones et actions epinglees`.

## Lot 10.3+10.4+10.5+10.6 — Pipeline GPS durci (une seule vague d'implémentation)

### 10.3 GPS horodaté

- Migration `20260911210000_a10_gps_timed_samples.sql` :
  `ALTER TABLE hike_sessions ADD COLUMN IF NOT EXISTS positions_timed jsonb;`
  + CHECK `jsonb_typeof = 'array'` (gardée `DO $$`), commentaire « échantillons horodatés ».
- `server/processHikeSession.ts` : schéma Zod `PersistedGpsSample { lat, lng, timestamp,
  elevationM?, accuracyM?, speedMps? }` (max 50 000) ; si `positions_timed` présent et
  valide → source unique de temps ; sinon **legacy** : passages produits mais
  `eligible_for_collective = false` et **aucune observation** (`reason: 'timed_samples_missing'`).
- `HikeSessionService` (client) : écrire `positions_timed` en plus de `positions_geojson`
  quand un horodatage est disponible (aucun changement de forme de `positions_geojson`).
- Tests `TEST-A10-GPS-01..05` : timed prioritaire, legacy exclu du collectif et sans
  observations, schéma rejette l'invalide, plafond.

### 10.4 RPC transactionnelles

- Migration `20260911220000_a10_transactional_rpcs.sql` :
  - `performance_observations` : index unique partiel
    `UNIQUE (passage_id, processor_version) WHERE passage_id IS NOT NULL`.
  - `persist_processed_hike_session(p_session_id uuid, p_passages jsonb,
    p_observations jsonb, p_processor_version text, p_track_quality jsonb) RETURNS jsonb` :
    `SECURITY DEFINER`, transaction implicite ; upsert passages (clé complète
    session+segment+direction+entered_at+version) `RETURNING id, segment_id, direction,
    entered_at` ; upsert observations par `(passage_id, processor_version)` ; update session
    `processed` + qualité ; le tout atomique.
  - `create_adventure_plan_bundle(p_plan jsonb, p_version jsonb, p_runs jsonb,
    p_decisions jsonb) RETURNS uuid` : une transaction ; retourne `plan_id`.
  - REVOKE anon/authenticated, GRANT service_role.
- `processHikeSession` : rattachement des observations **par clé complète**
  (`segmentId|direction|enteredAt`), plus jamais par file `segment_id` ; appel unique au
  client `persistTranscript(...)`.
- `generateAdventure` : appel unique `persistPlanBundle(...)`.
- Tests `TEST-A10-TX-01..06` : clé complète (aller-retour même segment), zéro doublon
  d'observation sur rejeu, échec partiel → pas d'écriture partielle (fake client
  transactionnel), bundle plan atomique.

### 10.5 Lease / retry / dead-letter

- Migration `20260911230000_a10_session_lease.sql` :
  colonnes `processing_started_at timestamptz`, `processing_attempts integer NOT NULL
  DEFAULT 0`, `last_processing_error text`, `next_retry_at timestamptz` ; statut CHECK
  étendu (`dead_letter`) par DROP/ADD contrainte.
- `CREATE OR REPLACE FUNCTION a2_claim_pending_sessions(p_limit int)` : réclame
  `pending` (et `next_retry_at <= now()` ou null) **et** `processing` expirées
  (`processing_started_at < now() - interval '15 minutes'`) avec `attempts < 5` ;
  incrémente `attempts`, pose `processing_started_at = now()`.
- `processHikeSession` : sur échec, `next_retry_at = now() + 2^attempts minutes` ;
  à `attempts >= 5` → `dead_letter` + `last_processing_error`.
- Tests `TEST-A10-LEASE-01..04` (pur : politique backoff/terminal) + pgTAP claim.

### 10.6 Batch PostGIS

- Migration `20260911240000_a10_batch_candidates.sql` :
  `a2_match_track_candidates(p_points jsonb, p_radius_m float8)` RETURNS TABLE
  (`point_index int, segment_id bigint, distance_m float8, bearing_deg float8, highway text,
  surface text, sac_scale text`) — `jsonb_array_elements` + `LATERAL ST_DWithin` sur
  `s.geom::geography`, top 5 par point (row_number), GIST utilisé.
- `processHikeSession` : un seul appel batch sur les points retenus (échantillonnés par
  pas max : 1 point / 25 m équivalent, plafond 2 000 points de matching) ; fin de la boucle
  N+1. Simplification : conserver premier/dernier + pas régulier (documenté).
- Tests `TEST-A10-BATCH-01..03` (échantillonnage borné, pas d'appel par point, fallback
  vide sans erreur).

**Commits (4)** : `feat(a10): echantillons GPS horodates`,
`feat(db): a10 RPC transactionnelles sessions et plans`,
`feat(a10): lease retry dead-letter des sessions`,
`feat(db): a10 map-matching batch PostGIS + orchestration`.

## Lot 10.7 — Consentements imposés + révocation

- Migration `20260911250000_a10_consent_enforcement.sql` :
  `has_active_consent(p_user_id uuid, p_purpose text) RETURNS boolean` — `SECURITY DEFINER
  STABLE`, **dernière `policy_version` uniquement**, `granted AND revoked_at IS NULL`
  (audit #25) ; REVOKE public/anon/authenticated, GRANT service_role.
- `processHikeSession` : observations seulement si `personal_performance` actif ;
  `eligible_for_collective` seulement si `collective_terrain` actif (double contrôle,
  en plus du flag) ; sinon passages privés sans dérivation.
- `consents.ts` : à la révocation, émettre `consent.revoked` dans `adventure_domain_events`
  (idempotency key stable) — best effort, jamais bloquant.
- `server/processAdventureEvents.ts` + cron `POST /api/cron/process-adventure-events`
  (CRON_SECRET) : handler `consent.revoked` → supprimer observations, profil + versions,
  `segment_predictions`/`route_predictions` de l'utilisateur, supprimer les agrégats des
  segments concernés (recalcul ultérieur), marquer l'événement `processed`.
- Tests `TEST-A10-CONS-01..05` + pgTAP `has_active_consent` (dernière version seulement).
- Commit : `feat(a10): consentements imposes et purge sur revocation`.

## Lot 10.8 — Durcissement `/api/adventure/generate`

- Migration `20260911260000_a10_generation_requests.sql` : table
  `adventure_generation_requests(id uuid pk, user_id uuid, idempotency_key text NOT NULL,
  status text CHECK (pending|done|failed), plan_id uuid, created_at default now(),
  UNIQUE (user_id, idempotency_key))` + index unique partiel `(user_id) WHERE status='pending'`
  + RLS propriétaire en lecture.
- `domain/generationLimits.ts` (pur) : `evaluateGenerationRequest({ existing, activePending,
  recentCount, now })` → `{ decision: 'reuse'|'conflict'|'rate_limited'|'proceed', retryAfterS? }`
  (quota 5/heure/user, 1 génération active).
- Route : header `Idempotency-Key` requis (400 sinon) ; réponse identique si `done` ;
  409 si `pending` ; 429 + `Retry-After` si quota ; marquage `done` après persistance.
- Tests `TEST-A10-GEN-01..06` + tests route mockés.
- Commit : `feat(a10): idempotence et quotas de generation`.

## Lot 10.9 — Profil réel et prédictions persistées

- `generateAdventure` (deps étendues) : `getCurrentProfile(userId)` +
  `hasActiveConsent(userId,'personal_performance')` → si consentement actif, profil injecté
  dans `predictionAdapter`/`difficultyAdapter` (`flagEnabled = route_prediction_v2`) ;
  sinon fallback standard explicite.
- Persistance : `insertSegmentPredictions(rows)`, `insertRoutePrediction(row)` via
  `create_adventure_plan_bundle` étendu (paramètre `predictions jsonb`) ou RPC dédiée
  `persist_route_predictions` — table `segment_predictions`/`route_predictions` existantes,
  `model_version = 'a10-v1'`, `context_hash` documenté (`uniform_from_blueprint` tant que le
  routage réel n'est pas branché — note a11).
- Tests `TEST-A10-PRED-01..05` : profil utilisé si consentement, fallback sinon,
  P90 ≥ P50 persisté, idempotence par modèle.
- Commit : `feat(a10): profil reel injecte et predictions persistees`.

## Lot 10.10 — Shadow runners

- Migration `20260911270000_a10_shadow_runs.sql` : table `adventure_shadow_runs`
  (`id`, `user_id`, `kind CHECK (profile|route_prediction|collective|terrain_auto)`,
  `primary_version`, `shadow_version`, `primary_value jsonb`, `shadow_value jsonb`,
  `delta_pct numeric`, `agreement boolean`, `confidence jsonb`, `latency_ms integer`,
  `decision text CHECK (pending|keep|promote|reject) DEFAULT 'pending'`, `created_at`),
  RLS service_role uniquement, index `(kind, created_at DESC)`.
- Cron `POST /api/cron/run-adventure-shadows` (CRON_SECRET) : si flag shadow actif,
  compare V1 (standard) / V2 (profil) sur des sessions récentes bornées et écrit les
  comparaisons ; Terrain auto : candidats `detectAutoCandidates` journalisés uniquement.
- Tests `TEST-A10-SHADOW-01..04` (fake client, bornes, aucune écriture publique, latence).
- Commit : `feat(a10): shadow runners et table de comparaison`.

## Lot 10.2 — Validation BDD (URL de copie fournie par l'humain)

- Réparer les 4 migrations préexistantes invalides (`\$\$` → `$$`, INDEX inline sortis) :
  `20260810212500`, `20260810213000`, `20260810213500`, `20260810214000` — édition
  minimale de replay uniquement (déjà appliquées en prod).
- F1 : migration `20260911280000_a10_f1_public_profiles.sql` : vue `public_profiles`
  (`id, full_name, username, avatar_url, trust_score, signature_visibility` filtrée) +
  `DROP POLICY IF EXISTS public_read_user_profiles` ; migration des lectures publiques
  (`carnets`, `avis`, hub crews) vers la vue (deux étapes, les embeds FK→vue n'existant pas).
- Exécution : `supabase db push --db-url "$AUDIT_DATABASE_URL"` sur copie ;
  `supabase test db --db-url "$AUDIT_DATABASE_URL"` (a1, a2, a10) ; contrôle `pg_policies`
  `user_profiles` avec rôles anon/A/B/admin/service_role ; base vide après réparation.
- Commit : `fix(db): a10 replay lots 7-10 et fermeture F1`.

## Lot 10.11 — Montage UI + E2E

- Monter `AdventureHubSection`/`AdventureCockpit` sur données réelles du hub (sans toucher
  `src/app/hub/[section]/page.tsx` pour éviter le conflit avec le chantier v16 en cours) :
  point d'ancrage `src/features/hub/components/**` + catalogue de widgets.
- Brancher `useTerrainReports` sur la carte existante quand le flag `terrain_live` est actif.
- `scripts/e2e/adventure-intelligence.spec.ts` : chargement hub, absence d'erreur console,
  section Adventure visible si données ; a11y ciblée.
- Skills `apple-ui-designer` + `ux-mobile` + `interaction-design` obligatoires.
- Commit : `feat(a10): montage hub/cockpit et E2E Adventure Intelligence`.

## Gate de sortie a10

CI verte sur `audit/**` ; base vide + copie migrées ; pgTAP verts ; F1 fermé ;
GPS horodaté sans artifice ; pipelines transactionnels ; lease/retry ; batch PostGIS ;
consentements appliqués ; quotas/idempotence ; prédictions réelles ; shadow runners ;
UI montée + E2E ; flags OFF ; rapport `A10_VERIFICATION.md` ; tag `a10-done` ; push.
