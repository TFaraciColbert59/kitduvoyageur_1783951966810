# A4 — Intelligence collective des sentiers — Rapport implémenteur

- Worktree : `C:/Users/Tony/Downloads/LKDV/worktrees/adventure-intelligence`
- Branche : `chantier/adventure-intelligence`
- Date : 2026-09-11
- Spec normative : `docs/superpowers/specs/2026-09-11-a4-collective-trail-intelligence-design.md`
- Commits (ordre de la spec) :
  1. `6f48bbd98d8726d4d804151335b9cff543330e20` — `feat(a4): agregation collective robuste (mediane ponderee, buckets, seuils)`
  2. `a5e4e5614c218efb7042bf1259be4120f6c9fc3f` — `feat(a4): eligibilite collective — consentement et qualites`
  3. `432559116f2d0db4f97aae91e3b1bdbb2d95db70` — `feat(db): a4 support d'agregation (index partiel + RPC segments eligibles)`
  4. `c914162af700082186b97a8912112f9d7c605360` — `feat(a4): orchestrateur serveur + cron d'agregation`
  5. `796b666cc39b5e31e08cec4ec837f066e02f7e3c` — `refactor(a4): TrailIntelligenceEngine deterministe par segment (Math.random supprime)`

---

## Task 1 — Agrégation collective robuste (commit 1)

**Fichiers**
- `src/features/adventure-intelligence/domain/collectiveIntelligence.ts` (moteur pur, 400+ lignes)
- `tests/adventure-intelligence/collective-intelligence.spec.ts` (TEST-A4-AGG-01..10)

**Implémentation**
- `normalizedSlowdown` : ratio observé/attendu, jamais de vitesse brute ; `expected <= 0` ou non fini ⇒ 1.
- `weightedMedian` ré-exportée de A3 (`performanceProfile.ts`) — aucune duplication.
- `percentile` interpolé (p borné [0,1], `null` si vide).
- `detectAnomalies<T>` générique : MAD pondéré, score z modifié `0.6745·|x−méd|/MAD`, seuil 3,5 ; MAD = 0 ⇒ seules les valeurs égales à la médiane ; `{ kept, rejected }` dans l'ordre d'entrée.
- `assignConditionBucket` : priorité glace > neige > humide > nuit > montée > descente > sac lourd (≥ 8 kg) > sac léger > sec.
- `aggregateCollective` : groupes `(segment, bucket, sens)` ; pondération `qualité × récence (demi-vie 180 j)` ; winsorisation `[0.25, 4]` ; exclusion des observations > 730 j ; MAD 3,5 ; scores `slowdownScore = clamp((méd−1)·50+50)`, `effortScore` (médiane+variance), `technicalScore` (uturns+offRoute+variance), `fatigueScore` (ralentissements tardifs ≥ 18 h UTC), `orientationScore` (offRoute) ; `collectiveDifficulty = 0,4·effort + 0,25·technique + 0,2·fatigue + 0,15·orientation` ; confiance `makeConfidence` méthode `collective_weighted_median_a4` ; sortie triée et arrondie 4 décimales (déterminisme).
- `isPublishable` : ≥ 5 utilisateurs distincts, confiance ≥ 0,5, ancienneté ≤ 730 j (`lastObservedAt` optionnel sinon `computedAt`).

**TDD**
- RED : `npx vitest run tests/adventure-intelligence/collective-intelligence.spec.ts` → `Cannot find package '@/.../domain/collectiveIntelligence'`, 1 fichier en échec, 0 test.
- GREEN après implémentation : 10/10 tests passés (premier passage 6/10, corrections de fixtures : `computedAt` doit être injecté à `isPublishable` car absent de l'interface `CollectiveAggregate` ; ratio par défaut des fixtures corrigé).

## Task 2 — Éligibilité collective (commit 2)

**Fichiers**
- `src/features/adventure-intelligence/domain/collectiveEligibility.ts`
- `tests/adventure-intelligence/collective-eligibility.spec.ts` (TEST-A4-ELIG-01..05)

**Implémentation**
- Seuils exportés : GPS ≥ 0,6, map-matching ≥ 0,6, qualité passage ≥ 0,5 ; consentement requis ; session terminée ; mouvement plausible.
- Raisons stables et ordonnées (`ELIGIBILITY_REASONS`) : `consentement_collectif_absent`, `session_non_terminee`, `qualite_gps_insuffisante`, `qualite_map_matching_insuffisante`, `mouvement_non_plausible`, `qualite_passage_insuffisante`. Qualité non finie ⇒ refus.

**TDD**
- RED : `Cannot find package '@/.../domain/collectiveEligibility'`.
- GREEN : 5/5 tests passés au premier passage après implémentation.

## Task 3 — Migration support d'agrégation (commit 3)

**Fichier**
- `supabase/migrations/20260911160000_a4_aggregation_support.sql`

**Contenu**
- Index partiel idempotent `idx_session_segment_passages_collective_recent (segment_id, exited_at DESC) WHERE eligible_for_collective = true`. Décision : la spec mentionne `observed_at` ; la table `session_segment_passages` n'a pas cette colonne, `exited_at` est l'horodatage d'observation du passage (aligné sur `performance_observations.observed_at`).
- RPC `a4_recent_eligible_segments(p_since interval DEFAULT '90 days', p_limit int DEFAULT 500)` : segments avec passages éligibles récents + sessions `processed`, retourne `(segment_id, last_exited_at, eligible_passage_count)` — uniquement des agrégats, jamais d'identité.
- `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp`, `REVOKE ALL FROM public`, `REVOKE` conditionnel `anon`/`authenticated`, `GRANT EXECUTE TO service_role` (calqué sur le style A2).
- Additif : `CREATE INDEX IF NOT EXISTS` + `CREATE OR REPLACE FUNCTION`.

## Task 4 — Orchestrateur serveur + cron (commit 4)

**Fichiers**
- `src/features/adventure-intelligence/server/aggregateSegments.ts`
- `src/app/api/cron/aggregate-segments/route.ts`
- `tests/adventure-intelligence/aggregate-segments.server.spec.ts` (TEST-A4-SRV-01..04)

**Implémentation**
- Client injecté `AggregateSegmentsClient` : `getEligiblePassages(segmentIds, sinceDays)`, `getConsents(userIds)`, `getExpectedDurations(passages)`, `upsertAggregates(rows)`.
- `hashUserId` = SHA-256 tronqué 32 hex (server-only, `node:crypto`) : aucune identité brute n'entre dans le moteur ni ne sort de l'orchestrateur.
- Pipeline : lecture → consentement + `collectiveEligibility` → durées attendues → `CollectivePassage[]` (bucket via `assignConditionBucket`) → `aggregateCollective({ now })` → `isPublishable` → upsert `onConflict: segment_id,condition_bucket,direction,processor_version`, `processor_version = 'a4-v1'`.
- Résumé = compteurs uniquement (`segments`, `passages`, `aggregates`, `suppressed`).
- Route : POST, `CRON_SECRET` Bearer, `force-dynamic`, RPC `a4_recent_eligible_segments`, lots (200 segments / 5000 passages), `getExpectedDurations` via profils A3 (`predictSegment`) avec repli sûr sur l'allure standard.

**TDD**
- RED : `Cannot find package '@/.../server/aggregateSegments'`.
- GREEN : 4/4 (un aller-retour de correction d'assertion de test sur la forme des appels enregistrés).
- Contrôle anti-fuite : `JSON.stringify(résumé + lignes)` ne contient ni `user_id`, ni id de passage, ni hash utilisateur (SRV-04).

## Task 5 — Migration du prototype (commit 5)

**Fichiers**
- `src/features/hiking/intelligence/TrailIntelligenceEngine.ts`
- `tests/adventure-intelligence/trail-intelligence-legacy.spec.ts` (TEST-A4-LEG-01..02)
- Test existant `src/features/hiking/intelligence/__tests__/TrailIntelligenceEngine.test.ts` : **inchangé** (adaptation minimale = zéro).

**Implémentation**
- `Math.random()` supprimé : `anonymizedSessionId = anon-<fnv1a(id|userId|startedAt)>` (hash FNV-1a pur, déterministe, sans PII).
- Propositions : identifiants `prop-dur-...-<hash>` / `prop-diff-...-<hash>` (plus de `Date.now()`), `createdAt` fourni par `options.now` (défaut maintenant).
- `processSegmentAggregates(segmentId, passages, options?)` : entrée par segment, délègue à `aggregateCollective`, retourne l'agrégat du segment ou `null`.
- `processTrailTelemetry(routeId, officialTrail, samples, options?)` : 4ᵉ paramètre optionnel rétrocompatible `{ now?, passages? }` ; quand `passages` est fourni, expose `collectiveAggregates`. Façade route-level (moyennes, confiance, propositions) strictement inchangée.

**TDD**
- RED : `Math.random` appelé 2 fois (`expected "random" to not be called at all, but actually been called 2 times`) + `TrailIntelligenceEngine.processSegmentAggregates is not a function`.
- GREEN : 2/2 LEG `npx vitest run tests/adventure-intelligence/trail-intelligence-legacy.spec.ts`, et `src/features/hiking/intelligence` reste vert (3/3 scénarios historiques).

---

## Preuves de vérification (avant chaque commit)

- `npx vitest run tests/adventure-intelligence src/features/hiking/intelligence` :
  - commit 1 : 16 fichiers / 126 tests passés
  - commit 2 : 17 fichiers / 131 tests passés
  - commit 3 : 17 fichiers / 131 tests passés
  - commit 4 : 18 fichiers / 135 tests passés
  - commit 5 : 19 fichiers / 137 tests passés
- `npm run type-check` (`tsc --noEmit`) : exit 0 avant chacun des 5 commits.
- `npm run build` : **jamais exécuté** (contrainte respectée).

## Décisions notables

1. **`isPublishable(a, options)`** : `computedAt` fait partie de l'entrée exigée par la spec mais pas de `CollectiveAggregate` ; le serveur compose `{ ...aggregate, computedAt: now }`. L'ancienneté de la dernière observation est portée par `options.lastObservedAt`, et `aggregateCollective` exclut déjà les observations > 730 j.
2. **Confiance** : `0,5·min(1, users/5) + 0,3·min(1, passages/15) + 0,2·(1−dispersion)` — le plancher de 5 utilisateurs est la contrainte réellement discriminante, conforme à « plancher de publication ».
3. **Migrations/moteurs** : `weightedMedian` ré-exportée de A3 ; `ConditionBucket` importé en type depuis `schemas/live.schema` (aucune duplication).
4. **Prototype** : extension additive (paramètre optionnel) plutôt que changement de signature ; IDs déterministes par hash ; `createdAt` injectable. Compatibilité totale des appelants et tests historiques.
5. **Route** : `plausibleMovement` absent de `track_quality` ⇒ `false` (prudence), qualité passage = `min(gps, mapMatch)`, `isNight` = heure UTC (< 6 h ou ≥ 21 h), `exited_at` = horodatage d'observation.

## Concerns

1. **Pas de validation d'intégration DB** : la migration (index partiel + RPC) et les requêtes PostgREST de la route (embed `session:hike_sessions!session_id`, `trail_segment_features`) n'ont pas été exécutées contre une instance Supabase dans cet environnement. À vérifier en staging (Testcontainers/Supabase local) avant production.
2. **Buckets `heavy_pack`/`light_pack` et `weather`** ne sont pas alimentés par la route actuelle (poids de sac absent des passages, météo non modélisée) ; ils restent disponibles pour des appelants fournissant ces entrées.
3. **`sessionFinished`** s'appuie sur `processing_status = 'processed'` + `ended_at` ; les sessions non traitées sont exclues (attendu A2).
4. **Rétention** : la fenêtre de 90 j limite les volumes par cron ; l'ancienneté de publication (730 j) est appliquée au moment de l'écriture, les agrégats stockés ne sont pas purgés automatiquement.
5. Le fichier de spec A4 reste non commité (untracked) ; à committer côté docs si souhaité.
