# A1 — Rapport d'implémentation TypeScript (Tasks 1, 2, 3, 4, 7)

Worktree : `C:/Users/Tony/Downloads/LKDV/worktrees/adventure-intelligence`
Branche : `chantier/adventure-intelligence` · Base : `7b99ccb5` (migrations A1 déjà commitées)
Périmètre : Tasks 1 → 4 et 7 uniquement (Task 5/6 migrations et pgTAP hors périmètre, déjà livrées).

## 1. Task 1 — Domaine noyau (commit `27e982c6`)

`feat(a1): domaine noyau — confidence, provenance, engine contract, domain events`

**Implémenté**
- `domain/confidence.ts` : `Confidence`, `makeConfidence` (clamp [0,1], seuils 0.75/0.5, raisons
  obligatoires si `low`), `combineConfidence` (min, somme, `combined:min`, concat), `isPersonalized`,
  `COLD_CONFIDENCE`.
- `domain/provenance.ts` : `PROVENANCE_SOURCES` (taxonomie trips, import **type-only** de
  `ProvenanceType`), `isResolvableProvenance` (`measured|official|community` exigent
  `sourceRef` ou `observedAt`), `isStale` (sans `observedAt` ⇒ périmé).
- `domain/engine.ts` : `EngineResult<T>`, `Assumption`, `EngineWarning`, `Alternative<T>`,
  `PlanImpact`, `AdventureExecutionContext`, `AdventureEngine<I,O>`, `makeEngineResult`
  (confiance froide, tableaux vides, `computedAt` ISO), `validateEngineResult` (score hors
  bornes, `computedAt` non ISO, `validUntil < computedAt`).
- `domain/events.ts` : `ADVENTURE_DOMAIN_EVENT_TYPES` (17 types du master plan §28.2),
  `buildDomainEvent` avec `idempotencyKey = type:entityId:processorVersion`.

**TDD**
- RED : `npx vitest run tests/adventure-intelligence/domain-core.spec.ts` →
  `Cannot find package '@/features/adventure-intelligence/domain/confidence'` (0 test, exit 1).
- GREEN : même commande → **17/17 passed** (TEST-A1-CONF-01..05, PROV-01..04, ENG-01..05, EVT-01..03).
- `npm run type-check` → exit 0.

## 2. Task 2 — AdventurePlan, contraintes, décisions (commit `9e50807a`)

`feat(a1): AdventurePlan, contraintes et decisions — types + schema Zod`

**Implémenté**
- `domain/constraints.ts` : `AdventureConstraint<T>` (`hard|soft`, `locked`, `user|system|safety`)
  + `assertNoSilentLockOverride` (un verrou doit survivre, rester verrouillé et garder sa valeur ;
  égalité profonde structurelle).
- `domain/decisions.ts` : `DECISION_TYPES` (6), `requiresConfirmation` (`true` sauf `other`),
  `DecisionStatus`, `AdventureDecision`.
- `domain/adventurePlan.ts` : `AdventurePlan` (19 sections `PlanValue<T> | null`), `PlanValue<T>`,
  `MonitoringRule`, `PlanVersionMeta`, etc.
- `schemas/adventurePlan.schema.ts` : `confidenceSchema`, `provenanceSchema`, `assumptionSchema`,
  `engineWarningSchema`, `planImpactSchema`, `alternativeSchema(inner)`, `planValueSchema(inner)`
  (refine `validUntil >= computedAt`), `adventureIntentSchema`, `planParticipantSchema`,
  `adventureDatesSchema`, `adventureDestinationSchema`, `monitoringRuleSchema`,
  `adventurePlanSectionsSchema`, `adventurePlanSchema`, `decisionTypeSchema`,
  `decisionStatusSchema`, `adventureDecisionSchema`, `planVersionMetaSchema`, types `z.infer`.
  Messages d'erreur en français ; défauts sûrs (sections nulles, confiance froide, statut `draft`).

**TDD**
- RED : `npx vitest run tests/adventure-intelligence/adventurePlan.schema.spec.ts` →
  module `schemas/adventurePlan.schema` introuvable (0 test, exit 1).
- GREEN : même commande → **6/6 passed** (TEST-A1-PLAN-01..06 dont audit `satisfies AdventurePlan`).
- `npm run type-check` → exit 0.

## 3. Task 3 — Schémas performance, terrain, prédiction, live (commit `e63eaa2b`)

`feat(a1): schemas performance, terrain, prediction, live (Zod v4)`

**Implémenté** (valeurs alignées sur les migrations M1–M7, autorité DDL)
- `performance.schema.ts` : `PerformanceProfile` (`flatSpeedKmH > 0`, vitesses dénivelé `>= 0`,
  courbes `gradeResponse/surfaceResponse/packResponse`, `fatigueCurve`, `pauseModel`, `confidence`,
  `calibrationLevel`, `modelVersion`, `computedAt` ISO), `TrackQuality` borné [0,1],
  `CALIBRATION_LEVELS` (4).
- `terrain.schema.ts` : `trailSegmentFeatureSchema` (`segmentId`, `direction`, pentes, D+/D-,
  classes `technical/exposure/isolation` 0..5, `source` = taxonomie provenance).
- `prediction.schema.ts` : `SegmentPrediction` (P50/P90, `paceRangeMinPerKm`, effort, difficulté,
  pause, facteurs ; refines `P50 <= P90` et `paceRange[0] <= paceRange[1]`), `RoutePrediction`
  (`comfort|recommended|fast`, `etaP50 <= etaP90`, `totalDurationP50 <= P90`, `criticalSegmentIds`).
- `live.schema.ts` : `TERRAIN_REPORT_CATEGORIES` (13), `TERRAIN_REPORT_STATUSES` (8),
  `TERRAIN_CONFIRMATIONS` (3, alias type `Confirmation`), `CONDITION_BUCKETS` (10),
  `terrainReportSchema`, `terrainReportPublicSchema` (sans `reporterId`),
  `terrainReportConfirmationSchema`, `terrainEventSchema`.
- `schemas/index.ts` : barrel sans collision.

**TDD**
- RED : `npx vitest run tests/adventure-intelligence/schemas.spec.ts` → module introuvable (0 test).
- GREEN : même commande → **16/16 passed** (PERF-01..04, TER-01..04, PRED-01..04, LIVE-01..04).
- `npm run type-check` → exit 0.

## 4. Task 4 — Contrat santé + Noop + barrel public (commit `72a6a3a3`)

`feat(a1): contrat ExternalReadinessProvider + Noop (sante hors perimetre)`

**Implémenté**
- `domain/health.ts` : `ExternalReadinessProvider` (`providerId`, `isAvailable`,
  `requestAuthorization(categories)`, `getDailyReadiness(date)`), `AuthorizationResult`,
  `ExternalReadinessSnapshot`, `READINESS_DATA_CATEGORIES`.
- `providers/noopReadinessProvider.ts` : `isAvailable() = false`,
  `requestAuthorization(...) = { granted: false, categories: [], reason: 'not_implemented_phase1' }`,
  `getDailyReadiness(...) = null`. En-tête explicite : « Aucun connecteur HealthKit / Health
  Connect / Garmin / Fitbit / BLE : contrats futurs uniquement. »
- `index.ts` : barrel public domain + schemas + providers, **sans** `server/` (testé).

**TDD**
- RED : `npx vitest run tests/adventure-intelligence/readiness.spec.ts` → module introuvable.
- GREEN : même commande → **3/3 passed** (HEALTH-01..03, dont absence de `listConsents` dans le barrel).
- `npm run type-check` → exit 0.

## 5. Task 7 — Consentements serveur (commit `201b2d7d`)

`feat(a1): consentements serveur (list/set, external_readiness refuse)`

**Implémenté**
- `server/consents.ts` avec `import 'server-only'` : `CONSENT_PURPOSES`, `consentPurposeSchema`,
  `CONSENT_POLICY_VERSION = 'a1-v1'`.
- `listConsents()` : `createClient()` → `auth.getUser()` → select own ; sans utilisateur ou erreur → `[]`.
- `setConsent(purpose, granted)` : Zod, refuse `external_readiness` (`external_readiness_disabled`,
  double barrière avant tout accès BDD), refuse finalité inconnue (`invalid_purpose`) et anonyme
  (`unauthenticated`), puis upsert `(user_id, purpose, policy_version)` avec `granted_at`/`revoked_at`.

**TDD**
- RED : `npx vitest run tests/adventure-intelligence/consents.server.spec.ts` → module introuvable.
- GREEN : même commande → **4/4 passed** (CONSENT-01..04), mock `vi.mock('@/lib/supabase/server')`.
- `npm run type-check` → exit 0.

## 6. Vérification finale

- `npx vitest run tests/adventure-intelligence` → **5 fichiers, 46/46 tests passed**.
- `npm run type-check` → exit 0.
- `npx next lint --file src/features/adventure-intelligence --file tests/adventure-intelligence`
  → « No ESLint warnings or errors », exit 0.
- `git diff --name-only 7b99ccb5..HEAD` : 22 fichiers, tous dans le périmètre autorisé ;
  **aucune migration modifiée** (`git diff ... -- supabase` vide).
- Aucun `any` dans `src/features/adventure-intelligence` (grep `\bany\b` → vide).
- Parité provenance : `PROVENANCE_SOURCES` == `ProvenanceTypeEnum.options` (TEST-A1-PROV-01).

## 7. Auto-revue / points de conception (zones non spécifiées)

- `isStale` sans `observedAt` → `true` (fraîcheur indéterminable = prudence), choix documenté.
- `combineConfidence()` sans composante → confiance froide (`score 0`, `low`, raison explicite).
- Payloads de sections typés `unknown` en Phase 1 (aucun calcul) : `PlanValue<unknown> | null`.
- Formes des courbes (`points: {x, value}[]`) et du `pauseModel` sont des contrats Phase 1 ;
  révisables en Phase 3 via `modelVersion`.
- Zod 4 `.default()` court-circuite le parsing imbriqué : le défaut `sections` est un littéral
  complet des 19 clés nulles (évite un objet partiel).
- `z.string().url()` conservé par cohérence avec `src/features/affiliation/schemas/affiliate.schema.ts`
  (Zod 4 recommande `z.url()`, dépréciation seulement).

## 8. Concerns

- Contrats inventés là où la spec ne nommait que les champs : `ResponseCurve`/`FatigueCurve`/
  `PauseModel`, catégories de lecture santé, `PerformanceProfile.sampleCount/calibrationLevel`
  (alignés BDD M3). À confirmer par la revue indépendante.
- `listConsents` caste les lignes Supabase (`as ConsentRow[]`) sans validation Zod runtime —
  acceptable en Phase 1 (contrat de types), à durcir si des consommateurs non typés apparaissent.
- Aucun autre point bloquant : suite complète verte, type-check et lint verts, migrations intactes.

---

# Correctif de revue (commit `4374a5af`)

`fix(a1): requiresConfirmation mapping, taxonomies partagees et confidence froide conforme`

## Changements

1. **Requires-confirmation (Important)** — `domain/decisions.ts` expose désormais le mapping
   exhaustif `REQUIRES_CONFIRMATION_BY_TYPE` (`payment|cancellation|safety_change|location_share|
   group_change` → `true`, `other` → `false`) et `requiresConfirmation(type)` le lit
   (`return REQUIRES_CONFIRMATION_BY_TYPE[type]`). `adventureDecisionSchema` ne porte plus
   `z.boolean().default(true)` : le champ est optionnel puis un `.transform()` applique
   `decision.requiresConfirmation ?? requiresConfirmation(decision.decisionType)` — le défaut
   est donc dérivé de la même source de vérité.
2. **Taxonomies partagées (Minor)** — `adventurePlan.schema.ts` importe `DECISION_TYPES` /
   `DECISION_STATUSES` depuis `domain/decisions` et construit `z.enum(DECISION_TYPES)` /
   `z.enum(DECISION_STATUSES)` ; plus aucune liste locale de valeurs (anti-drift).
3. **Confiance froide conforme (Minor)** — le défaut de `confidence` dans `adventurePlanSchema`
   utilise `COLD_CONFIDENCE` du domaine (copie défensive de `reasons`) : niveau `low` ⇒
   `reasons` non vide, invariant aligné sur `makeConfidence`.

**Tests** — `TEST-A1-PLAN-04` asserte le mapping complet et le comportement réel de `parse()`
sans `requiresConfirmation` explicite : `payment` → `true`, `other` → `false`.
`TEST-A1-PLAN-01` vérifie en plus que la confiance froide par défaut porte des raisons.

## Preuves (fix)

- `npx vitest run tests/adventure-intelligence` → **5 fichiers, 46/46 tests passed** (exit 0).
- `npm run type-check` → exit 0.
- `npx next lint --file src/features/adventure-intelligence --file tests/adventure-intelligence`
  → « No ESLint warnings or errors », exit 0.
- Fichiers du correctif : `domain/decisions.ts`, `schemas/adventurePlan.schema.ts`,
  `tests/adventure-intelligence/adventurePlan.schema.spec.ts` (aucun autre fichier modifié).

## Différé (non codé, conforme à la revue)

- Mapping DB↔TS (`ascentSpeedMPerHour` ↔ `ascent_speed_m_per_h`, `effortScore` ↔
  `predicted_effort`) : un mapper sera introduit en Phase 3 lors de l'écriture BDD.
- `z.string().url()` : dépréciation Zod 4 conservée pour l'homogénéité avec le dépôt.
