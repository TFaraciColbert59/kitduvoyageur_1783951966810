# LOT P0 — RAPPORT D'AUDIT, RECONNAISSANCE & CONTRATS ZOD

**Date d'audit** : 20 novembre 2026  
**Dépôt principal audité** : `/Users/fr168256/Projets/LKDV/lkdv-hub-refonte` (`HEAD` : `f316cd1d6` du 19 nov. 2026 à 21:45:42 +0100)  
**Dépôt secondaire comparé** : `/Users/fr168256/Projets/LKDV/lkdv` (`HEAD` : `1a5dc1d9d` du 16 nov. 2026 à 01:44:48 +0100 — dépôt antérieur, utilisé uniquement en lecture seule pour récupérer les paramètres de connexion `.env.local` du projet Supabase `icxyvwzfjbflcbqukpfz`)  
**Mode d'audit** : Lecture seule stricte sur l'existant (code, migrations SQL, base Supabase `icxyvwzfjbflcbqukpfz`).

---

## 1. État exact des 17 `feature_flags` (Code, Migrations SQL & Base Supabase)

La table `public.feature_flags` (créée par `supabase/migrations/20260909140000_hub_feature_flags.sql`, étendue par `20260911330000_a11_flag_cohorts.sql` pour le rollout par cohortes SHA-256 `0..99`) contient exactement **17 flags** en base Supabase (`icxyvwzfjbflcbqukpfz`) et dans l'ensemble des migrations SQL du dépôt :
- **8 flags appartenant directement au domaine `adventure-intelligence`** :
  - **4 flags fonctionnels** consommés par `src/features/adventure-intelligence/server/featureFlags.ts` (`A3_FLAGS` / `AdventureFeatureFlags`, lus via les RPC `current_feature_flags_for(uuid)` ou `current_feature_flags()` avec repli fail-safe tout à `false`).
  - **4 flags shadow** définis dans `src/features/adventure-intelligence/domain/shadowMode.ts` (`SHADOW_FLAGS`) et lus directement en `service_role` par `/api/cron/run-adventure-shadows`.
- **9 flags produit transversaux** partageant la même table `public.feature_flags` et les mêmes RPC `current_feature_flags` / `current_feature_flags_for`.

### 1.1 Tableau exhaustif des 17 `feature_flags`

| # | Identifiant (`feature_flags.id`) | Périmètre | État BDD (`enabled`) | `scope` BDD | `updated_at` (Supabase `icxyvwzfjbflcbqukpfz`) | Migration SQL source | Défaut SQL | Cohorte (`feature_flag_cohorts`) | Consommation dans le code TypeScript |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `performance_profile_v2` | **Adventure Intelligence (A3/A9)** | `false` | `global` | `2026-09-11T21:11:09.278716+00:00` | `20260911150000_a3_feature_flags.sql` & `20260911200000_a9_domain_flags.sql` | `false` | Aucune ligne | `src/features/adventure-intelligence/server/featureFlags.ts` (`A3_FLAGS`), `/api/adventure/generate`, `/api/adventure/[id]/cockpit`, `getAdventureIntelligence.ts` |
| 2 | `route_prediction_v2` | **Adventure Intelligence (A3/A9)** | `false` | `global` | `2026-09-11T21:11:09.278716+00:00` | `20260911150000_a3_feature_flags.sql` & `20260911200000_a9_domain_flags.sql` | `false` | Aucune ligne | `src/features/adventure-intelligence/server/featureFlags.ts`, `routePrediction.ts`, `predictionAdapter.ts`, `difficultyAdapter.ts` |
| 3 | `collective_intelligence` | **Adventure Intelligence (A4/A9)** | `false` | `global` | `2026-09-11T21:11:09.610978+00:00` | `20260911200000_a9_domain_flags.sql` | `false` | Aucune ligne | `src/features/adventure-intelligence/server/featureFlags.ts`, `/api/cron/aggregate-segments/route.ts`, `/api/terrain/conditions/route.ts` |
| 4 | `terrain_live` | **Adventure Intelligence (A5/A9)** | `false` | `global` | `2026-09-11T21:11:09.610978+00:00` | `20260911200000_a9_domain_flags.sql` | `false` | Aucune ligne | `src/features/adventure-intelligence/server/featureFlags.ts`, `/api/terrain/reports/route.ts`, `/api/terrain/reports/[id]/confirm/route.ts`, `cockpitData.ts` |
| 5 | `performance_profile_v2_shadow` | **Adventure Intelligence Shadow (A9/A10)** | `false` | `global` | `2026-09-11T21:11:09.610978+00:00` | `20260911200000_a9_domain_flags.sql` | `false` | Aucune ligne | `src/features/adventure-intelligence/domain/shadowMode.ts` (`SHADOW_FLAGS`), `server/shadowRuns.ts`, `/api/cron/run-adventure-shadows/route.ts` |
| 6 | `route_prediction_v2_shadow` | **Adventure Intelligence Shadow (A9/A10)** | `false` | `global` | `2026-09-11T21:11:09.610978+00:00` | `20260911200000_a9_domain_flags.sql` | `false` | Aucune ligne | `src/features/adventure-intelligence/domain/shadowMode.ts` (`SHADOW_FLAGS`), `server/shadowRuns.ts`, `/api/cron/run-adventure-shadows/route.ts` |
| 7 | `collective_intelligence_shadow` | **Adventure Intelligence Shadow (A9/A10)** | `false` | `global` | `2026-09-11T21:11:09.610978+00:00` | `20260911200000_a9_domain_flags.sql` | `false` | Aucune ligne | `src/features/adventure-intelligence/domain/shadowMode.ts` (`SHADOW_FLAGS`), `server/shadowRuns.ts`, `/api/cron/run-adventure-shadows/route.ts` |
| 8 | `terrain_auto_detection_shadow` | **Adventure Intelligence Shadow (A5/A9)** | `false` | `global` | `2026-09-11T21:11:09.338764+00:00` | `20260911170000_a5_terrain_nearby.sql` & `20260911200000_a9_domain_flags.sql` | `false` | Aucune ligne | `src/features/adventure-intelligence/domain/shadowMode.ts` (`SHADOW_FLAGS`), `server/shadowRuns.ts`, `/api/cron/run-adventure-shadows/route.ts` |
| 9 | `hub_possession_enabled` | Hub Universel (H4) | `false` | `global` | `2026-09-10T17:59:14.058075+00:00` | `20260909140000_hub_feature_flags.sql` | `false` | Aucune ligne | `src/features/hub/server/featureFlags.ts` |
| 10 | `hub_sortie_enabled` | Hub Universel (H4) | `false` | `global` | `2026-09-10T17:59:14.058075+00:00` | `20260909140000_hub_feature_flags.sql` | `false` | Aucune ligne | `src/features/hub/server/featureFlags.ts` |
| 11 | `hub_collectif_enabled` | Hub Universel (H4) | `false` | `global` | `2026-09-10T17:59:14.058075+00:00` | `20260909140000_hub_feature_flags.sql` | `false` | Aucune ligne | `src/features/hub/server/featureFlags.ts` |
| 12 | `hub_all_enabled` | Hub Universel (H4) | `true` | `global` | `2026-09-10T17:59:14.058075+00:00` | `20260909140000_hub_feature_flags.sql` | `true` | Aucune ligne | `src/features/hub/server/featureFlags.ts` |
| 13 | `coverage_publication_enabled` | Couverture Géographique (Phase 4) | `false` | `global` | `2026-09-12T09:12:29.717469+00:00` | `20260911560000_phase4_coverage.sql` | `false` | Aucune ligne | Garde-fou de publication de couverture |
| 14 | `explorer_unified_map_enabled` | Chantier Atlas (Phase 7) | `true` | `global` | `2026-09-12T13:04:25.883335+00:00` | `20260912060000_atlas_rollout_flag.sql` | `false` (activé en BDD) | `percentage: 0`, `allowlist: []`, `exclusions: []` | `src/features/hub/server/featureFlags.ts` (`/explorer`) |
| 15 | `local_leaderboard_active` | Progression 2.0 (1 km) | `false` | `global` | `2026-09-20T09:59:39.212024+00:00` | `20260920109000_leaderboard.sql` | `false` | Aucune ligne | RPC & cron `leaderboard-refresh` |
| 16 | `stories_v2` | Communauté Stories V2 | `false` | `global` | `2026-10-13T21:15:12.614824+00:00` | `20261013281000_stories_v2_flag.sql` | `false` | Aucune ligne | Stories V2 rollout par cohortes |
| 17 | `explorer_v2_enabled` | Explorer V2 (OSM) | `true` | `global` | `2026-10-29T00:05:38.100375+00:00` | `20261101_explorer_v2_data.sql` | `false` (activé en BDD) | Aucune ligne | Routes & UI `/explorer` V2 |

> **Constat clé** : Les **8 flags du domaine `adventure-intelligence`** (`performance_profile_v2`, `route_prediction_v2`, `collective_intelligence`, `terrain_live` et leurs 4 homologues `*_shadow`) sont tous présents en base et tous positionnés à `enabled = false` (aucune activation implicite, conformément à `ADR-AI-008`).

---

## 2. Comptage des lignes existantes dans les 7 tables cibles

Les comptages ont été effectués en lecture seule (`HEAD` / `SELECT` avec `Prefer: count=exact`) sur la base Supabase configurée (`icxyvwzfjbflcbqukpfz`) et recoupés avec les migrations SQL :

| Table (`public.*`) | Nombre exact de lignes (BDD `icxyvwzfjbflcbqukpfz`) | Migration SQL de création / extension | Détail des lignes & observations d'audit |
|---|---|---|---|
| `user_performance_profiles` | **0** | `20260911132000_a1_performance_profiles.sql` | Table vide. Contrainte `UNIQUE (user_id, activity_type)`. RLS `ENABLE` + `FORCE` (lecture propriétaire `authenticated`, écriture `service_role`). La table associée `user_performance_profile_versions` est également à 0 ligne. |
| `performance_observations` | **0** | `20260911131000_a1_private_activity_observations.sql` + `20260911220000_a10_transactional_rpcs.sql` | Table vide. Index unique partiel `idx_performance_observations_passage_version ON (passage_id, processor_version) WHERE passage_id IS NOT NULL`. Écrite atomiquement via la RPC `persist_processed_hike_session`. |
| `trail_segments` | **0** | `20260717110000_trail_segments_and_hiking_routes.sql` | Table vide en base distante. Réseau géométrique central (`geom geometry(LineString, 4326)`, `osm_id`, `highway`, `sac_scale`, `surface`, `tags`). La table 1:1 `trail_segment_features` (`20260911130000`) dépend de `trail_segments(id)`. |
| `route_predictions` | **1** | `20260911136000_a1_predictions.sql` | **1 ligne existante** : `id = 0b1f4c1f-0000-4000-8000-000000000001`, `strategy = 'recommended'`, `model_version = 'seed-demo-v1'`, `computed_at = '2026-09-26T04:04:39.549+00:00'`, `confidence = { level: 'medium', score: 0.78, method: 'pace_resolver_demo_v1', sampleCount: 18 }`. |
| `hike_sessions` | **141** | `20260809200000` + `20260911131000_a1_private_activity_observations.sql` + `20261112120000_explorer_v2_activity_finish_hardening.sql` | **141 lignes existantes** réparties en : **107** avec `processing_status = 'processed'` (`processor_version = 'seed-1'`), **2** avec `processing_status = 'processed'` (`processor_version = null`), et **32** avec `processing_status = 'pending'` (`processor_version = null`). |
| `trip_member_profiles` | **0** | `20260912300000_trip_member_profiles.sql` | Table vide. Clé primaire `(trip_id, user_id)`. Stocke le snapshot membre par voyage (`flat_speed_kmh`, `ascent_speed_m_per_h`, `descent_speed_m_per_h`, `pack_weight_kg`, `max_carry_kg`, `experience_level`, `limitations`, `is_child`, `calibration_level`, `sample_count`). |
| `adventure_data_consents` | **1** | `20260911130000_a1_consents_segment_features.sql` | **1 ligne existante** : `id = 8b450312-7106-4025-8954-a8a43d35abf4`, `purpose = 'personal_performance'`, `granted = true`, `policy_version = 'a1-v1'`, `granted_at = '2026-11-13T18:02:00.652+00:00'`, `revoked_at = null`. |

---

## 3. Vérification des colonnes physiologiques (`weight_kg`, `sex`, `birth_year`, `hr_rest`, `hr_max`)

### 3.1 Inspection de `public.user_profiles`
L'introspection directe du schéma OpenAPI de la base Supabase `icxyvwzfjbflcbqukpfz` et de l'ensemble des migrations SQL confirme que **`public.user_profiles` ne contient AUCUNE des 5 colonnes physiologiques** (`weight_kg`, `sex`, `birth_year`, `hr_rest`, `hr_max`) :

- **Colonnes présentes dans `public.user_profiles` (27 en base distante + 1 en migration locale `20261114120000_g01_sport_profile_prefs.sql`)** :
  `id`, `email`, `full_name`, `avatar_url`, `trust_score`, `loyalty_points`, `loyalty_level`, `bio`, `location`, `created_at`, `updated_at`, `xp`, `level`, `role`, `phone`, `website`, `notification_prefs`, `two_fa_enabled`, `is_suspended_groups`, `age_confirmed_at`, `suspended_from_groups_at`, `signature_visibility`, `is_demo`, `handle`, `profile_visibility`, `cover_url`, `links` (+ `sport_profile_prefs` en migration locale).

| Colonne physiologique recherchée | Présente dans `user_profiles` ? | Présente dans `user_performance_profiles` ? | Présente dans `trip_member_profiles` ? | Équivalents ou colonnes proches dans d'autres tables du dépôt |
|---|---|---|---|---|
| `weight_kg` | **Non** | **Non** | **Non** (uniquement `pack_weight_kg` et `max_carry_kg`) | `body_weight_kg NUMERIC` dans `public.configurator_sessions` et `public.kit_reports` (`20260715100000_configurator_sessions_kit_reports.sql`, rattaché à une session du configurateur matériel). `pack_weight_kg` dans `performance_observations` et `trip_member_profiles`. |
| `sex` | **Non** | **Non** | **Non** | Aucune colonne en base. |
| `birth_year` | **Non** | **Non** | **Non** (`is_child boolean` uniquement) | `age_confirmed_at timestamptz` dans `user_profiles` (confirmation de majorité, aucune année de naissance). |
| `hr_rest` | **Non** | **Non** | **Non** | Aucune colonne de fréquence cardiaque au repos en base. |
| `hr_max` | **Non** | **Non** | **Non** | `threshold_kind = 'maxHeartRate'` + `threshold_value numeric` dans `public.activity_zone_configs` (migration locale `20261113140000_explorer_v2_activity_zone_configs.sql`) ; `max_heart_rate_bpm` et `average_heart_rate_bpm` observés par séance dans `trace_import_summaries` / `trace_import_laps` / `trace_import_samples` (`20261113110000` & `20261113124000`). |

### 3.2 Implications pour les Lots P1 à P6
1. **Ne jamais ajouter de colonnes biométriques sur `user_profiles`** : `user_profiles` est la source de la vue `public_profiles` (`20261114120000_g01_sport_profile_prefs.sql`) et a historiquement souffert de policies de lecture larges.
2. **Confinement strict** : toute persistance future de paramètres physiologiques (`weight_kg`, `sex`, `birth_year`, `hr_rest`, `hr_max`) doit vivre dans une table dédiée (ou extension privée de `user_performance_profiles` sous `FORCE ROW LEVEL SECURITY` + consentement `personal_performance`), et le moteur P1 doit fonctionner dès le niveau `dataLevel = "socle"` avec masse corporelle déclarée ou imputée (`Evidence<number>` avec `kind: "declared" | "imputed"`).

---

## 4. Version PostgreSQL / Supabase & État du correctif RLS `ON CONFLICT` (Novembre 2026)

### 4.1 Version PostgreSQL & PostGIS
- **Configuration locale (`supabase/config.toml`, ligne 41)** : `major_version = 17`.
- **Instance Supabase distante (`icxyvwzfjbflcbqukpfz`, interrogée via les RPC `_postgis_pgsql_version()` et `postgis_full_version()`)** :
  - **PostgreSQL** : **17** (`PGSQL="170"`)
  - **PostGIS** : `POSTGIS="3.3.7 a0c7967" [EXTENSION] PGSQL="170" GEOS="3.14.1-CAPI-1.20.5" PROJ="9.7.1" LIBXML="2.15.1" LIBJSON="0.18" LIBPROTOBUF="1.5.2" WAGYU="0.5.0 (Internal)"`
  - **Schéma applicatif OpenAPI** : version `14.5` (`EXECUTE` par défaut retiré, grants explicites).

### 4.2 État du correctif RLS `ON CONFLICT` (Novembre 2026)
Le correctif de sécurité PostgreSQL sur `INSERT ... ON CONFLICT DO UPDATE / DO NOTHING` (CVE-2025-12817 / PostgreSQL 17.x) impose que, lorsqu'une table active la Row-Level Security (RLS) et qu'un rôle non-propriétaire (`authenticated`) exécute un `INSERT ... ON CONFLICT` (y compris via PostgREST `.upsert()`), **la policy `FOR SELECT` (`USING`) soit évaluée et satisfaite sur la ligne en conflit**, en plus de la policy `FOR INSERT` (`WITH CHECK`) et de la policy `FOR UPDATE` (`USING` + `WITH CHECK`).

L'audit des tables et migrations du dépôt montre que **le dépôt LKDV applique déjà ce patron de conformité** sur toutes les tables utilisant `ON CONFLICT` sous le rôle `authenticated`, et délègue les autres tables à des RPC `SECURITY DEFINER` réservées à `service_role` :

| Table / Flux | Rôle exécutant l'upsert (`ON CONFLICT`) | Policies RLS présentes pour `authenticated` | État vis-à-vis du correctif RLS `ON CONFLICT` |
|---|---|---|---|
| `public.adventure_data_consents` (`src/features/adventure-intelligence/server/consents.ts:114`) | `authenticated` (`.upsert(..., { onConflict: 'user_id,purpose,policy_version' })`) | `adventure_consents_select_own` (`FOR SELECT USING (auth.uid() = user_id)`), `adventure_consents_insert_own` (`FOR INSERT WITH CHECK (...)`), `adventure_consents_update_own` (`FOR UPDATE USING (...) WITH CHECK (...)`) | **Conforme** (`SELECT` + `INSERT` + `UPDATE` alignés sur `auth.uid() = user_id`). |
| `public.user_traveller` (`src/features/compas/server/traveller.ts:76,99`) | `authenticated` (`.upsert(..., { onConflict: 'user_id' })`) | 5 policies réservées à `authenticated` (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, non-anonyme) | **Conforme & vérifié** par la sonde transactionnelle `scripts/verify/user_traveller_rls_probe.sql` (contrôle #6, lignes 77–85 : `INSERT INTO public.user_traveller ... ON CONFLICT (user_id) DO UPDATE` sous rôle `authenticated`). |
| `public.user_orientation` (`20260904010000_user_orientation.sql`) | `authenticated` | `orientation_select_own`, `orientation_insert_own`, `orientation_update_own`, `orientation_delete_own` (`user_id = auth.uid()`) | **Conforme** (`SELECT` + `INSERT` + `UPDATE` présents). |
| `public.trip_member_profiles` (`20260912300000_trip_member_profiles.sql` + `20260925020000_core_rls_auth_initplan.sql`) | `service_role` dans `joinActivity.ts:300` ; `authenticated` autorisé par RLS | `tmprof_select` (`user_id = (SELECT auth.uid()) OR can_read_trip(trip_id)`), `tmprof_insert` (`user_id = (SELECT auth.uid())`), `tmprof_update` (`user_id = (SELECT auth.uid())`) | **Conforme** (policies `SELECT`, `INSERT`, `UPDATE` présentes et optimisées avec `(SELECT auth.uid())`). |
| `public.club_event_registrations` & `event_adventure_links` (`20261119193901`, `20261119195142`, `20261119205238`) | RPC transactionnelles `SECURITY DEFINER` (novembre 2026) | Écriture encapsulée dans des RPC `SECURITY DEFINER` (`search_path` verrouillé) | **Conforme** (exécuté par le propriétaire de la fonction, contourne le piège d'un `ON CONFLICT` client sans visibilité `SELECT`). |
| `user_performance_profiles`, `performance_observations`, `session_segment_passages`, `segment_predictions`, `route_predictions` | `service_role` / RPC `SECURITY DEFINER` (`persist_processed_hike_session`, `persist_adventure_predictions`) | `FOR SELECT TO authenticated USING (user_id = auth.uid())`, `FOR ALL TO service_role` | **Conforme** (`authenticated` ne fait aucun `.upsert()` direct ; tout passe par `service_role`). |

---

## 5. Audit de `vercel.json` et du budget réel de `/api/cron/daily` (270 s)

### 5.1 Configuration `vercel.json` et route `/api/cron/daily`
- **`vercel.json`** :
  - Région : `["cdg1"]` (Paris).
  - Unique cron planifié : `{"path": "/api/cron/daily", "schedule": "0 3 * * *"}` (tous les jours à 03:00 UTC).
  - `buildCommand` : `"NODE_OPTIONS=--max-old-space-size=8192 next build --no-lint"`.
- **`src/app/api/cron/daily/route.ts`** :
  - `export const maxDuration = 300;` (plafond matériel de 300 s sur l'offre Vercel Hobby).
  - Authentification en temps constant via `isCronAuthorized(request, secret)`.
  - Calcul de la rotation quotidienne : `rotation = Math.floor(Date.now() / 86_400_000)`.
- **`src/lib/cron/dailyDispatcher.ts`** :
  - `DAILY_BUDGET_MS = 270_000` (**270 s** de budget total pour laisser 30 s de marge de sérialisation/journalisation avant la coupure Vercel à 300 s).
  - `DAILY_TASK_TIMEOUT_MS = 90_000` (**90 s** max par tâche individuelle).
  - `DAILY_MIN_START_MS = 10_000` (**10 s** de budget restant minimal requis pour lancer la tâche suivante ; sinon elle est marquée `skipped` avec `reason: 'budget'`).
  - **Coupe-circuit anti-chevauchement** : si une tâche atteint son timeout (`TIMED_OUT`), `abandoned = true` et toutes les tâches suivantes sont immédiatement marquées `skipped` (`reason: 'after_timeout'`) pour éviter que deux tâches ne tournent en parallèle en arrière-plan.

### 5.2 Inventaire des 14 tâches de `src/lib/cron/dailyTasks.ts` et budget réel restant

| Rang | Nom de la tâche (`DAILY_CRON_TASKS`) | Méthode | Épinglée (`pinned`) | Plafond interne / comportement actuel | Coût temporel estimé (état actuel BDD) | Coût temporel en charge nominale |
|---|---|---|---|---|---|---|
| 1 | `expire-live-positions` | `GET` | **Oui (`true`)** | Purge des positions live expirées | ~0,3 – 1,0 s | ~0,5 – 2,0 s |
| 2 | `process-adventure-events` | `POST` | **Oui (`true`)** | Purge RGPD sur `consent.revoked` ; boucle jusqu'à `MAX_BATCHES = 20` lots de 10, bornée par `BATCH_DEADLINE_MS = 60_000` (60 s) | ~0,3 – 1,0 s (0 événement en attente) | 1 – 60 s (plafonné à **60 s** max) |
| 3 | `expire-terrain-reports` | `POST` | **Oui (`true`)** | Expiration (`expires_at`) et vieillissement (24 h) des signalements Terrain Live | ~0,3 – 1,0 s | ~0,5 – 2,0 s |
| 4 | `cleanup-ephemeral-groups` | `GET` | **Oui (`true`)** | Nettoyage des groupes éphémères expirés | ~0,3 – 1,0 s | ~0,5 – 2,0 s |
| 5 | `cleanup-solo-crews` | `GET` | **Oui (`true`)** | Nettoyage des équipages solo abandonnés | ~0,3 – 1,0 s | ~0,5 – 2,0 s |
| 6 (rot.) | `process-hike-sessions` | `POST` | Non | Réclame `CLAIM_LIMIT = 5` sessions `pending` (`a2_claim_pending_sessions`), map-matching batch PostGIS (`a2_match_track_candidates`) + RPC `persist_processed_hike_session` + `awardHikeSessionProcessed` | ~2 – 8 s (32 sessions `pending` en base mais `trail_segments` à 0 ligne ⇒ candidats vides rapides) | ~10 – 35 s pour 5 traces GPS denses |
| 7 (rot.) | `aggregate-segments` | `POST` | Non | **Court-circuité en ~0,2 s** tant que `collective_intelligence = false` ; sinon `SEGMENT_LIMIT = 200`, `PASSAGE_LIMIT = 5000` | **~0,2 s** (`skipped: 'flag_disabled'`) | ~5 – 25 s quand `collective_intelligence = true` |
| 8 (rot.) | `progression-outbox` | `POST` | Non | Dépilement de l'outbox de progression | ~0,5 – 2,0 s | ~1 – 5 s |
| 9 (rot.) | `progression-awards` | `POST` | Non | Attribution des intentions de progression | ~0,5 – 2,0 s | ~1 – 5 s |
| 10 (rot.) | `leaderboard-refresh` | `POST` | Non | Court-circuité / rapide tant que `local_leaderboard_active = false` | ~0,3 – 1,0 s | ~1 – 5 s |
| 11 (rot.) | `purge-stories` | `GET` | Non | Purge par lots de 200 des stories expirées non archivées | ~0,5 – 1,5 s | ~1 – 4 s |
| 12 (rot.) | `refresh-kit-scores` | `GET` | Non | Rafraîchissement de la vue matérialisée `kit_trust_scores` | ~0,5 – 2,0 s | ~2 – 8 s |
| 13 (rot.) | `refresh-atlas-density` | `GET` | Non | Rafraîchissement de la vue matérialisée de densité Atlas | ~0,5 – 2,0 s | ~2 – 10 s |
| 14 (rot.) | `run-adventure-shadows` | `POST` | Non | **Court-circuité en ~0,2 s** tant que les 4 flags `*_shadow` sont `false` | **~0,2 s** (aucun échantillon lu) | ~5 – 20 s quand les flags shadow sont actifs |

- **Routes volontairement exclues (`MANUAL_ONLY_CRON_ROUTES`)** : `finalize-kit-attributions`, `process-ai-jobs`, `refresh-country-guides`.
- **Conclusion sur le budget réel restant sur 270 s (`DAILY_BUDGET_MS`)** :
  - **État courant (flags V2 et shadow désactivés)** : exécution totale estimée entre **7 s et 25 s**, soit **~245 s à 263 s de budget restant** sur 270 s.
  - **Charge nominale (tous flags activés, hors rafale RGPD extrême)** : exécution totale estimée entre **35 s et 115 s**, soit **~155 s à 235 s de budget restant**.
  - **Pire cas sans timeout (rafale RGPD saturant les 60 s de `process-adventure-events` + 5 sessions GPS lourdes + agrégation collective + shadows)** : **~125 s à 185 s** consommées, laissant **~85 s à 145 s de budget restant**.
  - **Recommandation pour P1..P6** : Le calcul du score d'effort bioénergétique doit être **pur, déterministe et mis en cache par `snapshot_hash`** (quelques millisecondes en mémoire), sans ajouter de tâche lourde au cron quotidien `/api/cron/daily`.

---

## 6. Règles exactes de `scripts/verify/identity_compliance.mjs`

L'inspection de `scripts/verify/identity_compliance.mjs` (et de sa dépendance directe `scripts/verify/traveller_privacy.mjs` ainsi que `scripts/verify/ci_invariants.mjs`) établit les règles exactes suivantes :

1. **Confinement de `user_orientation` (Règle 1 de `identity_compliance.mjs`)** :
   - Exécute `rg -l "user_orientation" src/components` en excluant `src/components/identity` : échoue si un composant public référence `user_orientation`.
   - Exécute `rg -l "user_orientation" src/features/kits` : échoue si `features/kits` référence `user_orientation`.
2. **Interdiction des tokens CSS `--role-*` (Règle 2 de `identity_compliance.mjs`)** :
   - Exécute `rg -l "\\-\\-[a-z-]*role" src` : échoue si un fichier de `src/` contient un token CSS de la forme `--*role*`.
3. **Verrouillage de la palette dans `src/features/identity` et `src/components/identity` (Règle 3 de `identity_compliance.mjs`)** :
   - Parcourt récursivement les fichiers `.ts` et `.tsx` de `src/features/identity` et `src/components/identity`.
   - Tout code couleur hexadécimal `#[0-9A-Fa-f]{6}\b` hors de la liste autorisée (`#17402C`, `#365233`, `#5A7064`, `#5B7F55`, `#A6C1A0`, `#4B6B7C`, `#8C6418`, `#8A241B`, `#C89A3B`, `#A8443A`, `#FAF8F5`, `#FBFAF6`) fait échouer le script.
   - Toute classe Tailwind par défaut correspondant à `/emerald-|red-|rose-|amber-|gray-/` dans ces deux dossiers fait échouer le script.
4. **Confinement du profil voyageur du Compas (Règle 4 de `identity_compliance.mjs` → `travellerPrivacyViolations(root)` dans `scripts/verify/traveller_privacy.mjs`)** :
   - Parcourt tous les fichiers `.ts/.tsx/.js/.jsx/.mjs` de `src/` (hors `__tests__` et `*.test|spec.*`) et vérifie 12 contraintes strictes sur `user_traveller`, `src/features/compas/server/traveller`, `travellerActions`, `TravellerCard`, `src/features/compas/engine/traveller`, les notes de papiers/devises/prises dépendantes de la nationalité ou résidence, et l'absence d'argument passé à `buildCompasAutofillSystem()`.
5. **Vocabulaire descriptif non hiérarchique (ADR-010 & `tests/identity/orientation.spec.ts`, `tests/identity/field-signature.spec.ts`)** :
   - Les tests unitaires d'identité interdisent les termes hiérarchiques ou compétitifs (`voyageur`, `explorateur`, `trakkeur`, `expert`, `niveau`, `grade` au sens grade social, `rang`, `palier`, `percentile`, `classement`, `rank`, `top`) dans les sorties d'orientation et d'empreinte.
   - Conformément au contrat transversal du chantier Adventure Intelligence, les niveaux de richesse de données utilisent exclusivement `DataLevelSchema = z.enum(["socle", "cardio", "complet"])`, et aucun identifiant ni commentaire de `effort.schema.ts` n'utilise de vocabulaire de classement.

---

## 7. Audit de l'existant pour préparer les Lots P1 à P6

### 7.1 `src/features/adventure-intelligence/`
- **`domain/` (39 modules purs)** :
  - `confidence.ts` (`Confidence`, `COLD_CONFIDENCE`, `makeConfidence`, `combineConfidence`, `clamp01`) et `provenance.ts` (`DataProvenance`, `PROVENANCE_SOURCES`, `isResolvableProvenance`, `isStale`).
  - `performanceProfile.ts` (apprentissage du profil par médiane pondérée récence × qualité + rejet d'outliers MAD, courbes `gradeResponse`, `surfaceResponse`, `fatigueCurve`, `pauseModel`, `packResponse`) — **point d'ancrage du Lot P2**.
  - `paceResolver.ts`, `prediction.ts`, `fatigue.ts` (modèle additif heuristique actuel 0..100, allure P50/P90) — **à enrichir/remplacer en Lot P1/P2 par le modèle bioénergétique LCDA / Pandolf / Minetti + attribution Shapley**.
  - `groupIntelligence.ts`, `planGroupTrek.ts`, `multiDayTrek.ts` (dimensionnement par le membre limitant, risque de séparation, redistribution de portage plafonnée à 5 kg, projection publique `projectGroupPlanPublic`) — **point d'ancrage du Lot P4 (modes `"compact"` vs `"regroupement"`, marge crépuscule, `PublicGroupPredictionSchema`)**.
  - `trackNormalization.ts`, `mapMatching.ts`, `segmentFeatures.ts`, `collectiveEligibility.ts`, `collectiveIntelligence.ts` (pipeline GPS Phase 2 & agrégation Phase 4).
  - `cockpit.ts`, `cockpitLive.ts`, `cockpitMounting.ts`, `offlinePack.ts` (logique du cockpit et mode hors-ligne).
- **`schemas/` (7 fichiers existants + `effort.schema.ts` créé en P0)** :
  - `adventurePlan.schema.ts`, `performance.schema.ts`, `prediction.schema.ts`, `groupTrek.schema.ts`, `terrain.schema.ts`, `live.schema.ts`, `index.ts`.
  - Nouveau fichier P0 : `src/features/adventure-intelligence/schemas/effort.schema.ts` (contrats Zod `EvidenceKindSchema`, `EvidenceSchema`, `DataLevelSchema`, `EffortScoreInputSchema`, `EffortScoreOutputSchema`, `GroupPredictionInputSchema`, `PublicGroupPredictionSchema`, `GroupPredictionOutputSchema`).
- **`server/` (16 modules + 12 adaptateurs sous `server/adapters/`)** :
  - `featureFlags.ts`, `consents.ts`, `processHikeSession.ts`, `buildUserProfile.ts`, `routePrediction.ts`, `groupTrek.ts`, `aggregateSegments.ts`, `terrainReports.ts`, `cockpitData.ts`, `generateAdventure.ts`, `shadowRuns.ts`.
  - Tous les modules serveur utilisent l'injection de dépendances (`*Client` / `*DataSource`), permettant des tests unitaires déterministes sans réseau.
- **`ui/` (10 composants React)** :
  - `AdventureCockpit.tsx`, `AdventureCockpitControl.tsx`, `AdventureHubSection.tsx`, `AdventureIntelligenceHub.tsx`, `GroupPlanSummary.tsx`, `GroupTrekPanel.tsx`, `OfflineBanner.tsx`, `TrekPlanView.tsx`, `useAdventureCockpit.ts` — **points d'ancrage du Lot P5**.

### 7.2 `src/features/compas/server/`
- **`weather.ts`** :
  - Prévisions horaires/journalières **MET Norway (Yr, CC BY 4.0)** via `metnoGet` / `metnoForecastUrl` (coordonnées arrondies à `0,01°` pour mutualiser le cache Vercel, horizon 10 jours, limite 20 req/s, User-Agent canonique).
  - Tendances historiques 5 ans et normales climatologiques mensuelles 2001–2020 **NASA POWER** (`T2M`, `T2M_MIN`, `T2M_MAX`, `PRECTOTCORR`, `WS10M_MAX`, cache 30 jours).
  - Résolution hors-ligne du fuseau horaire via `@photostructure/tz-lookup` (`knownZoneAt`, `destinationZone`).
  - **Réutilisation en Lot P3** : fournit directement `tempC`, `windMs` (à convertir en `windKmh = windMs * 3.6` uniquement dans la formule Wind Chill), précipitations et licence (`CC BY 4.0` / NASA POWER) pour renseigner `Evidence<T>.licenceSnapshot`.
- **`elevation.ts`** :
  - Altitudes réelles lues sur les **Terrain Tiles AWS Open Data** (`terrainElevations`, usage commercial autorisé) : `getRouteElevation`, `routeAscentM` (1 échantillon / ~100 m, borné de 20 à 150 points), `pointsMaxAltitudeM`, `pointsAltitudeRange`.
  - **Réutilisation en Lot P3** : source canonique d'`altitudeM` et de `gradePct` lorsque les segments OSM n'ont pas d'altitude 3D native.
- **`traveller.ts` & `travellerActions.ts`** :
  - Strictement confinés par `scripts/verify/traveller_privacy.mjs` — **ne jamais les importer** depuis `src/features/adventure-intelligence/` ni depuis une route API.

### 7.3 `src/components/compte/overlay/`
- **`CompteOverlayHost.tsx`** :
  - Gestionnaire de pile d'overlays (`stack: Entry[]`) exposant l'API globale `window.__lkdvCompteOverlay` (`openPost`, `openSaved`, `openBadge`, `openGear`, `openSeal`, `openTrust`, `openProfile`, `openCreate`, `close`, `closeAll`).
  - Charge `/api/compte/bootstrap` (`cache: 'no-store'`) uniquement pour les tiroirs nécessitant le bootstrap (`badge`, `gear`, `seal`, `trust`) et vérifie `isUsableBootstrap(payload)` pour ne jamais afficher de zéros trompeurs en cas d'erreur réseau.
- **`OverlaySheet.tsx`** :
  - Primitive modale accessible (`role="dialog"`, `aria-modal="true"`, piège de focus `Tab`/`Shift+Tab`, fermeture `Escape`, restauration du focus à la fermeture, mise en `inert` de `#sheet`, alignement géométrique sur `#card` / `#phone`, support `nested` avec `zIndex: 1320` vs `1200`).
  - Exporte également `DrawerButton` et `DrawerToggle` (`role="switch"`).
- **`DetailDrawers.tsx`, `PostDrawer.tsx`, `PostSheet.tsx`** :
  - Tiroirs spécialisés utilisant `OverlaySheet` et propageant les drapeaux `*Unavailable` pour garantir l'absence de zéros trompeurs.
  - **Réutilisation en Lot P5** : toute fiche de détail ou tiroir explicatif du score d'effort (`IEA`, `ERP`, `eFlatKm`, `technicite`, `risque`, décomposition `shapley` et `evidence[]`) dans l'espace Compte devra s'intégrer via `OverlaySheet` en respectant le piège de focus et l'état explicite d'indisponibilité.

---

## 8. Validation TypeScript & Conformité Anti-Dérive (Porte de Sortie P0)

1. **`node scripts/verify/identity_compliance.mjs`** :
   - **Statut** : `✓ ANTI-DÉRIVE : toutes les contraintes durables sont respectées.` (code de sortie `0`).
2. **`npx tsc --noEmit -p .`** :
   - **Statut sur `src/features/adventure-intelligence/schemas/effort.schema.ts` et tout `src/features/adventure-intelligence/**`** : **0 erreur TypeScript**.
   - **Note sur l'arbre de travail pré-existant (hors périmètre P0)** : le dépôt contenait avant P0 un diff non commité dans `src/features/hub/cockpit/loadCockpit.ts:47` (`supabase.rpc('get_trip_club_route_updates', ...).overrideTypes<...[], { merge: false }>()`) qui émet 2 erreurs `TS2339` / `TS7006` sur `(clubRouteUpdates.data ?? []).map(...)`. Conformément à la règle de lecture seule sur l'existant du Lot P0, `loadCockpit.ts` n'a pas été modifié.
3. **Vérification d'exécution des schémas Zod (`npx tsx`)** :
   - `computeSnapshotHash`, `computeLoadToBodyRatio`, `computePandolfSnowEta`, `isSpeedInLcdaDomain`, `EffortScoreInputSchema`, `EffortScoreOutputSchema`, `GroupPredictionInputSchema`, `PublicGroupPredictionSchema` (rejet récursif prouvé de toute clé biométrique ou vitesse individuelle nominative), `GroupPredictionOutputSchema` : **100 % validés**.

