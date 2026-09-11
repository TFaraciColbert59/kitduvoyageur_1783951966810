# A1 — Domaine central, BDD et sécurité — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.
> TDD strict (Red/Green/Refactor) pour toute logique TS. Steps en cases `- [ ]`.

**Goal:** Installer les contrats TypeScript, les schémas Zod, 8 migrations additives et
la sécurité RLS du domaine Adventure Intelligence — sans aucune fonctionnalité visible.

**Architecture:** Domaine pur `src/features/adventure-intelligence/domain` +
`schemas` + `providers` + `server` (consents). Migrations additives idempotentes,
RLS 4 niveaux (ADR-AI-003), événements domaine idempotents (ADR-AI-006).

**Tech Stack:** TypeScript strict, Zod 4, Vitest 4, Supabase/PostgreSQL/PostGIS, pgTAP.

**Spec:** `docs/superpowers/specs/2026-09-11-a1-domain-database-security-design.md`
**Contraintes:** `docs/architecture/adventure-intelligence-decisions.md` (ADR-AI-001..008)

## Global Constraints

- Namespace strict : `src/features/adventure-intelligence/**` ; tables préfixées.
- `trail_segments` = réseau unique ; `trail_segment_features` = enrichissement 1:1.
- Aucune collision : `Confidence` (objet) ≠ `ConfidenceLevelEnum` (trips).
- Provenance = taxonomie existante `measured|official|community|computed|estimated|suggested`.
- Migrations additives, idempotentes, timestamps `20260911130000+`, jamais destructives.
- RLS sur toute table ; `SECURITY DEFINER` avec `search_path = public, pg_temp`.
- Aucun connecteur santé réel ; `external_readiness` non octroyable.
- Tests TS : `tests/adventure-intelligence/*.spec.ts` (IDs `TEST-A1-*`), style vitest du repo.
- `npm run lint`, `npm run type-check`, `npm run test` doivent rester verts.

---

### Task 1: Domaine noyau — confidence, provenance, engine, events

**Files:**
- Create: `src/features/adventure-intelligence/domain/confidence.ts`
- Create: `src/features/adventure-intelligence/domain/provenance.ts`
- Create: `src/features/adventure-intelligence/domain/engine.ts`
- Create: `src/features/adventure-intelligence/domain/events.ts`
- Test: `tests/adventure-intelligence/domain-core.spec.ts`

**Interfaces (exact) :**
- `makeConfidence({ score, sampleCount, method, reasons? }): Confidence` — score clampé [0,1] ; `level` : `>=0.75 high`, `>=0.5 medium`, sinon `low` ; `reasons` non vide si `low`.
- `combineConfidence(...parts: Confidence[]): Confidence` — score = min, sampleCount = somme, méthode `'combined:min'`, reasons concaténées.
- `isPersonalized(c: Confidence): boolean` — `sampleCount >= 3 && score >= 0.5`.
- `PROVENANCE_SOURCES` (const) + `isResolvableProvenance(p)` — `official|community|measured` exigent `sourceRef` ou `observedAt`.
- `isStale(p, nowIso, maxAgeSeconds)`.
- `EngineResult<T>`, `Assumption`, `EngineWarning`, `Alternative<T>`, `PlanImpact`, `AdventureExecutionContext`, `AdventureEngine<I,O>` (voir spec).
- `makeEngineResult<T>(partial): EngineResult<T>` (défauts : confiance froide, tableaux vides, `computedAt = new Date().toISOString()`).
- `validateEngineResult(r): string[]` — erreurs si score hors bornes, `computedAt` non ISO, `validUntil < computedAt`.
- `ADVENTURE_DOMAIN_EVENT_TYPES` (const), `buildDomainEvent({ type, entityType, entityId, processorVersion, payload?, actorId? })` avec `idempotencyKey = type:entityId:processorVersion`.

- [ ] **Step 1 : tests rouges** — écrire `tests/adventure-intelligence/domain-core.spec.ts` (TEST-A1-CONF-01..05, TEST-A1-PROV-01..04, TEST-A1-ENG-01..05, TEST-A1-EVT-01..03). Cas clés : bornes de score, faible confiance ⇒ reasons non vide, parité de taxonomie provenance avec `ProvenanceTypeEnum.options` importé de `@/features/trips/schemas/autoGen.schema`, idempotencyKey stable.
- [ ] **Step 2 : vérifier l'échec** — `npx vitest run tests/adventure-intelligence/domain-core.spec.ts` → FAIL (modules absents).
- [ ] **Step 3 : implémenter** les 4 fichiers du domaine (types + helpers purs, zéro I/O).
- [ ] **Step 4 : vérifier le vert** — même commande → PASS ; `npm run type-check` → exit 0.
- [ ] **Step 5 : commit** — `feat(a1): domaine noyau — confidence, provenance, engine contract, domain events`.

---

### Task 2: Domaine plan — constraints, decisions, adventurePlan + schéma

**Files:**
- Create: `src/features/adventure-intelligence/domain/constraints.ts`
- Create: `src/features/adventure-intelligence/domain/decisions.ts`
- Create: `src/features/adventure-intelligence/domain/adventurePlan.ts`
- Create: `src/features/adventure-intelligence/schemas/adventurePlan.schema.ts`
- Test: `tests/adventure-intelligence/adventurePlan.schema.spec.ts`

**Interfaces (exact) :**
- `AdventureConstraint<T>` `{ id, kind: 'hard'|'soft', label, value: T, locked, source: 'user'|'system'|'safety' }` + `assertNoSilentLockOverride(before, after): boolean`.
- `DecisionType = 'payment'|'cancellation'|'safety_change'|'location_share'|'group_change'|'other'` ; `requiresConfirmation(type)` → `true` sauf `other`.
- `AdventurePlan` : `{ id, ownerId, status: 'draft'|'active'|'completed'|'archived', currentVersion, intent, participants, dates, destinations, sections, confidence, monitoringRules, createdAt, updatedAt }` — `sections` couvre : transport, localMobility, accommodations, dailyStages, activityRoutes, terrainAnalysis, personalDifficulty, groupDifficulty, paceStrategies, foodAndWater, gearPlan, budget, bookings, documents, regulations, safetyPlan, offlinePackage, liveConditions, alternatives ; chaque section = `PlanValue<T> | null`.
- Zod : `confidenceSchema`, `provenanceSchema`, `assumptionSchema`, `engineWarningSchema`, `planValueSchema(inner)`, `adventureIntentSchema`, `planParticipantSchema`, `adventurePlanSchema`, `planVersionMetaSchema`, `adventureDecisionSchema` ; `z.infer` exportés.

- [ ] **Step 1 : tests rouges** — TEST-A1-PLAN-01..06 : plan minimal valide ; section = `PlanValue` complet ; `validUntil < computedAt` rejeté par refine ; décision `payment` ⇒ `requiresConfirmation = true` ; verrou non modifiable silencieusement ; audit sémantique `satisfies AdventurePlan`.
- [ ] **Step 2 : échec** — `npx vitest run tests/adventure-intelligence/adventurePlan.schema.spec.ts` → FAIL.
- [ ] **Step 3 : implémenter** types + schéma (Zod 4, messages FR).
- [ ] **Step 4 : vert** — même commande + `npm run type-check`.
- [ ] **Step 5 : commit** — `feat(a1): AdventurePlan, contraintes et décisions — types + schéma Zod`.

---

### Task 3: Schémas domaine — performance, terrain, prediction, live

**Files:**
- Create: `src/features/adventure-intelligence/schemas/performance.schema.ts`
- Create: `src/features/adventure-intelligence/schemas/terrain.schema.ts`
- Create: `src/features/adventure-intelligence/schemas/prediction.schema.ts`
- Create: `src/features/adventure-intelligence/schemas/live.schema.ts`
- Create: `src/features/adventure-intelligence/schemas/index.ts`
- Test: `tests/adventure-intelligence/schemas.spec.ts`

**Interfaces (exact) :** voir spec + master plan §27. Points normatifs :
- `PerformanceProfile` : `flatSpeedKmH > 0`, `ascentSpeedMPerHour >= 0`, `descentSpeedMPerHour >= 0`, `gradeResponse/surfaceResponse/packResponse` (courbes), `fatigueCurve`, `pauseModel`, `confidence`, `modelVersion`, `computedAt` ISO.
- `TrackQuality` = `{ overall, gpsAccuracy, temporalContinuity, altitudeReliability, plausibleMovement, reasons }` bornés [0,1].
- `CALIBRATION_LEVELS = ['cold','calibration','personalization','contextualization']`.
- `SegmentPrediction` : P50/P90, `paceRangeMinPerKm: [number, number]`, `effortScore`, `personalDifficulty`, `recommendedPauseSeconds`, `confidence`, `factors` ; refine `P50 <= P90` et `paceRange[0] <= paceRange[1]`.
- `RoutePrediction` : stratégies `comfort|recommended|fast`, `etaP50 <= etaP90`, `criticalSegmentIds`.
- `TerrainReportCategory` (13 valeurs live.schema) ; `TerrainReportStatus` (8 statuts) ; `Confirmation = present|gone|unknown` ; `CONDITION_BUCKETS = dry|wet|snow|ice|day|night|ascent|descent|light_pack|heavy_pack`.

- [ ] **Step 1 : tests rouges** — TEST-A1-PERF-01..04, TEST-A1-TER-01..04, TEST-A1-PRED-01..04, TEST-A1-LIVE-01..04 (dont rejets P90 < P50, catégories invalides, bucket inconnu).
- [ ] **Step 2 : échec** — `npx vitest run tests/adventure-intelligence/schemas.spec.ts`.
- [ ] **Step 3 : implémenter** les schémas + barrel.
- [ ] **Step 4 : vert** — même commande + `npm run type-check`.
- [ ] **Step 5 : commit** — `feat(a1): schemas performance, terrain, prediction, live (Zod v4)`.

---

### Task 4: Contrat santé futur + NoopReadinessProvider

**Files:**
- Create: `src/features/adventure-intelligence/domain/health.ts`
- Create: `src/features/adventure-intelligence/providers/noopReadinessProvider.ts`
- Create: `src/features/adventure-intelligence/index.ts` (barrel public)
- Test: `tests/adventure-intelligence/readiness.spec.ts`

**Interfaces (exact) :** `ExternalReadinessProvider` (`providerId`, `isAvailable()`,
`requestAuthorization(categories)`, `getDailyReadiness(date)`) ; `NoopReadinessProvider`
implémente `ExternalReadinessProvider` et retourne : `isAvailable() = false`,
`requestAuthorization(...) = { granted: false, categories: [], reason: 'not_implemented_phase1' }`,
`getDailyReadiness(...) = null`. Le fichier porte un commentaire d'en-tête : « Aucun
connecteur HealthKit/Health Connect/Garmin/Fitbit/BLE — contrats futurs uniquement. »

- [ ] **Step 1 : tests rouges** — TEST-A1-HEALTH-01..03.
- [ ] **Step 2 : échec** — `npx vitest run tests/adventure-intelligence/readiness.spec.ts`.
- [ ] **Step 3 : implémenter** health.ts + noop + barrel.
- [ ] **Step 4 : vert** — même commande + `npm run type-check`.
- [ ] **Step 5 : commit** — `feat(a1): contrat ExternalReadinessProvider + Noop (sante hors perimetre)`.

---

### Task 5: Migrations additives M1..M8

**Files (créés dans cette phase, DDL normatif) :**
- Create: `supabase/migrations/20260911130000_a1_consents_segment_features.sql`
- Create: `supabase/migrations/20260911131000_a1_private_activity_observations.sql`
- Create: `supabase/migrations/20260911132000_a1_performance_profiles.sql`
- Create: `supabase/migrations/20260911133000_a1_collective_aggregates.sql`
- Create: `supabase/migrations/20260911134000_a1_terrain_live.sql`
- Create: `supabase/migrations/20260911135000_a1_adventure_plan.sql`
- Create: `supabase/migrations/20260911136000_a1_predictions.sql`
- Create: `supabase/migrations/20260911137000_a1_domain_events.sql`

**Contenu normatif** (idempotent : `CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS`,
`CREATE OR REPLACE FUNCTION`, gardes `DO $$`; commentaires FR; `BEGIN;`/`COMMIT;` pour M8) :
- M1 : `adventure_data_consents` (unique `user_id+purpose+policy_version`, CHECK
  `external_readiness ⇒ granted=false`, RLS owner) + `trail_segment_features`
  (PK `segment_id`, classes 0..5, lecture publique, écriture service).
- M2 : extension `hike_sessions` (`processing_status`, `processor_version`,
  `processed_at`, `track_quality`, `visibility`, `updated_at`) + `session_segment_passages`
  (unique `session+segment+direction+entered_at+processor_version`, RLS propriétaire via
  session, écriture service) + `performance_observations` (RLS propriétaire, écriture service).
- M3 : `user_performance_profiles` (unique `user+activity_type`) +
  `user_performance_profile_versions` (unique `profile+model_version`) — RLS propriétaire,
  écriture service.
- M4 : `segment_condition_buckets` (10 lignes seed) + `segment_collective_aggregates`
  (unique `segment+bucket+direction+processor_version`) + policy SELECT public
  `distinct_user_count >= 5` + écriture service.
- M5 : `terrain_reports` (+ compteurs `present_count/gone_count/unknown_count`) +
  `terrain_report_confirmations` (unique `report+user`) + trigger de comptage
  `SECURITY DEFINER` + `terrain_events` + vue `terrain_reports_public` sans identité.
- M6 : `adventure_plans` (owner, `trip_id` FK `trips`), `adventure_plan_versions`,
  `adventure_plan_decisions`, `adventure_engine_runs` — RLS propriétaire +
  `can_read_trip(trip_id)`.
- M7 : `segment_predictions`, `route_predictions` (FK plan) — RLS propriétaire,
  CHECK `p90 >= p50`, écriture service.
- M8 : `adventure_domain_events` (unique `idempotency_key`, statuts 4) + index +
  `claim_pending_adventure_events(integer)` SKIP LOCKED cap 5 + REVOKE/GRANT service_role ;
  RLS select/insert acteur.

- [ ] **Step 1 : écrire M1..M8** conformément au DDL ci-dessus et à la matrice RLS de la spec.
- [ ] **Step 2 : contrôle statique** — `git diff --check` ; recherche `CREATE TABLE` sans `ENABLE ROW LEVEL SECURITY` ; vérifier chaque `SECURITY DEFINER` a `SET search_path`.
- [ ] **Step 3 : commit** — `feat(db): a1 fondations Adventure Intelligence (8 migrations additives, RLS 4 niveaux)`.
- [ ] **Step 4 : gate manuelle documentée** — copie de base : `supabase db push --db-url "<copie>"` puis `supabase test db --db-url "<copie>"` (non exécutée ici, cf. a0).

---

### Task 6: pgTAP — sécurité domaine A1

**Files:**
- Create: `supabase/tests/database/a1_domain_security.test.sql`

**Contenu normatif :** `BEGIN; SELECT plan(N);` fixtures `auth.users` + lignes ;
`SET LOCAL ROLE authenticated; SET LOCAL "request.jwt.claim.sub" = '<uuid>';` puis :
- TEST-A1-RLS-01 : un utilisateur ne voit pas les consents d'autrui.
- TEST-A1-RLS-02 : `external_readiness` octroyé ⇒ violation de contrainte.
- TEST-A1-RLS-03 : passages non lisibles par un tiers ; lisibles par le propriétaire.
- TEST-A1-RLS-04 : profils de performance privés.
- TEST-A1-RLS-05 : agrégats < 5 utilisateurs invisibles en SELECT public.
- TEST-A1-RLS-06 : vue `terrain_reports_public` n'expose pas `reporter_id` et filtre les statuts.
- TEST-A1-RLS-07 : `adventure_plans` privé ; lisible par collaborateur via `can_read_trip`.
- TEST-A1-RLS-08 : `adventure_domain_events` : acteur voit les siens seulement.
- TEST-A1-RLS-09 : `claim_pending_adventure_events` non exécutable par `authenticated`.
- `SELECT * FROM finish(); ROLLBACK;`

- [ ] **Step 1 : écrire la suite** en suivant `supabase/tests/database/field_proof.test.sql` (plan conforme au nombre d'assertions).
- [ ] **Step 2 : revue statique** — `plan(N)` == nombre d'assertions ; aucun `SET ROLE` sans `ROLLBACK`.
- [ ] **Step 3 : commit** — `test(db): suite pgTAP a1 — RLS et seuils publics`.

---

### Task 7: Serveur consentements + tests

**Files:**
- Create: `src/features/adventure-intelligence/server/consents.ts`
- Test: `tests/adventure-intelligence/consents.server.spec.ts`

**Interfaces (exact) :**
- `listConsents(): Promise<ConsentRow[]>` — `createClient()` de `@/lib/supabase/server`, `auth.getUser()`, select own ; erreurs → `[]`.
- `setConsent(purpose, granted): Promise<{ ok: boolean; error?: string }>` — Zod `consentPurposeSchema` ; refuse `external_readiness` avec `{ ok: false, error: 'external_readiness_disabled' }` (double barrière client, en plus de la contrainte SQL) ; upsert `user_id/purpose/policy_version='a1-v1'` avec `granted_at`/`revoked_at`.
- Fichier `import 'server-only'`.

- [ ] **Step 1 : tests rouges** — TEST-A1-CONSENT-01..04 avec `vi.mock('@/lib/supabase/server')` (pattern `tests/trips/notes/queries-trip-notes.spec.ts`).
- [ ] **Step 2 : échec** — `npx vitest run tests/adventure-intelligence/consents.server.spec.ts`.
- [ ] **Step 3 : implémenter**.
- [ ] **Step 4 : vert** — même commande + `npm run type-check`.
- [ ] **Step 5 : commit** — `feat(a1): consentements serveur (list/set, external_readiness refuse)`.

---

### Task 8: Vérification Phase 1, rapport, tag

**Files:**
- Create: `docs/reports/A1_VERIFICATION.md`

- [ ] **Step 1 :** `npm run lint` ; `npm run type-check` ; `npm run test` ; `npm run build` ; `npm run verify:invariants` — tout vert.
- [ ] **Step 2 :** contrôle sécurité statique : grep des nouvelles policies ; vérifier `public_read_user_profiles` documenté pour vérification sur copie.
- [ ] **Step 3 :** rédiger `A1_VERIFICATION.md` (commandes, résultats, gate manuelle copie BDD, état : réalisé).
- [ ] **Step 4 : commit** — `docs(a1): rapport de verification phase 1` puis `git tag a1-done`.

---

## Self-Review

- Couverture spec : domaine (T1-T4), BDD (T5), RLS (T5-T6), santé Noop (T4), consents (M1+T7), events (M8). ✅
- Placeholders : aucun « TBD » ; les DDL sont spécifiés table par table ; les tests ont des IDs et cas précis.
- Cohérence des types : `Confidence`/`DataProvenance`/`EngineResult` uniques (T1) réutilisés par T2-T4 et par le serveur T7.
- Gate adaptable : « base vide migrable » remplacée par validation sur copie (ruling a0 documenté).
