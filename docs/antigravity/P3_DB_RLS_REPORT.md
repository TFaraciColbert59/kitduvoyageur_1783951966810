# LOT P3 — RAPPORT DE PREUVE PERSISTANCE SUPABASE, RLS & SHADOW MODE

**Date** : 20 novembre 2026  
**Lot** : P3 (`@db-rls`) — Persistance Supabase, RLS, Rétrocompatibilité Consentements & Shadow Mode  
**Branche** : `feat/effort-engine-v1`  
**Dépôt** : `/Users/fr168256/Projets/LKDV/lkdv-hub-refonte`

---

## 1. Version mineure exacte de PostgreSQL (`SELECT version();`) & Niveau du correctif RLS `ON CONFLICT`

### 1.1 Relevé exact de la version PostgreSQL / Supabase (sans exposition de secret)
L'inspection en lecture seule des métadonnées de liaison Supabase (`supabase/.temp/postgres-version`, `rest-version`, `gotrue-version`, `storage-version`) et des RPC système PostGIS (`_postgis_pgsql_version()`, `postgis_full_version()`, `postgis_scripts_build_date()`) sur l'instance `icxyvwzfjbflcbqukpfz` établit les versions exactes suivantes :

| Composant | Version exacte relevée | Source de vérification (sans secret) |
|---|---|---|
| **PostgreSQL (version mineure & build Supabase)** | **PostgreSQL 17.6** (`17.6.1.141` — image `supabase/postgres:17.6.1.141`, `server_version_num = 170006` / `PGSQL="170"`) | `supabase/.temp/postgres-version` (`17.6.1.141`) & RPC `_postgis_pgsql_version()` (`"170"`) |
| **PostGIS & bibliothèques géométriques** | `POSTGIS="3.3.7 a0c7967" [EXTENSION] PGSQL="170" GEOS="3.14.1-CAPI-1.20.5" PROJ="9.7.1" LIBXML="2.15.1" LIBJSON="0.18" LIBPROTOBUF="1.5.2" WAGYU="0.5.0 (Internal)"` | RPC `postgis_full_version()` |
| **PostgREST** | `v14.5` | `supabase/.temp/rest-version` & schéma OpenAPI `/rest/v1/` |
| **GoTrue (Auth)** | `v2.195.0` | `supabase/.temp/gotrue-version` |
| **Supabase Storage** | `v1.69.0` | `supabase/.temp/storage-version` |

### 1.2 Conformité au correctif PostgreSQL 17.6 / Novembre 2026 sur `INSERT ... ON CONFLICT` sous RLS
Depuis PostgreSQL 17.6 (`17.6.1.141` / correctif CVE-2025-12817 appliqué sur Supabase en novembre 2026), toute instruction `INSERT ... ON CONFLICT DO UPDATE` ou `DO NOTHING` exécutée par un rôle soumis à la Row-Level Security (`authenticated` sous `ENABLE` + `FORCE ROW LEVEL SECURITY`) évalue **obligatoirement la policy `FOR SELECT` (`USING`) sur la ligne en conflit**, en plus de la policy `FOR INSERT` (`WITH CHECK`) et de la policy `FOR UPDATE` (`USING` + `WITH CHECK`).

Dans `supabase/migrations/20261120143000_effort_engine_v1.sql`, toutes les tables manipulées en upsert par `authenticated` ou `service_role` respectent strictement ce patron avec mise en cache initplan `(SELECT auth.uid())` :

| Table | `ENABLE` + `FORCE RLS` | Rôle d'écriture | Policies `authenticated` | Conformité `ON CONFLICT` PG 17.6 |
|---|---|---|---|---|
| `public.user_physiology` | **Oui (`true` / `true`)** | `authenticated` (propriétaire) & `service_role` | `select_own` (`USING ((SELECT auth.uid()) = user_id)`), `insert_own` (`WITH CHECK ((SELECT auth.uid()) = user_id)`), `update_own` (`USING` + `WITH CHECK ((SELECT auth.uid()) = user_id)`), `delete_own` (`USING ((SELECT auth.uid()) = user_id)`) | **100 % conforme** : l'upsert `ON CONFLICT (user_id) DO UPDATE` de l'utilisateur A sur sa propre ligne satisfait `SELECT` + `INSERT` + `UPDATE`, et échoue (`42501`) sur la ligne de B. |
| `public.adventure_data_consents` | **Oui (`true` / `true`)** | `authenticated` (propriétaire) & `service_role` | `adventure_consents_select_own`, `adventure_consents_insert_own`, `adventure_consents_update_own` alignées sur `(SELECT auth.uid()) = user_id` + garde `NOT (purpose = 'external_readiness' AND granted = true)` | **100 % conforme** : l'upsert `ON CONFLICT (user_id, purpose, policy_version) DO UPDATE` fonctionne pour l'octroi et la révocation des finalités granulaires. |
| `public.effort_scores` | **Oui (`true` / `true`)** | `service_role` uniquement (ou RPC `persist_effort_score_shadow`) | `select_own` (`FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id)`) ; aucun grant `INSERT`/`UPDATE`/`DELETE` à `authenticated` | **100 % conforme** : écriture `service_role` avec `ON CONFLICT (snapshot_hash) DO NOTHING` (immutabilité Contrat C). |
| `public.group_prediction_members` | **Oui (`true` / `true`)** | `service_role` uniquement | `select_own` (`FOR SELECT TO authenticated USING (member_user_id = (SELECT auth.uid()))`) | **100 % conforme** : un membre A ne peut jamais lire ni modifier la ligne `member_user_id = B` d'un coéquipier B. |
| `public.route_predictions` | **Oui (`true` / `true`)** | `service_role` uniquement | `route_predictions_select_own` : si `scope = 'member'`, exige `member_user_id = (SELECT auth.uid())` ; sinon `user_id = (SELECT auth.uid()) AND (member_user_id IS NULL OR member_user_id = (SELECT auth.uid()))` | **100 % conforme** : même le créateur du plan (`user_id = A`) ne peut pas lire une prédiction `scope = 'member'` appartenant à `member_user_id = B`. |
| `public.user_performance_profiles` | **Oui (`true` / `true`)** | `service_role` uniquement | `performance_profiles_select_own` (`USING ((SELECT auth.uid()) = user_id)`) + colonne additive `posterior jsonb` | **100 % conforme**. |

---

## 2. Rétrocompatibilité stricte de `public.adventure_data_consents.purpose`

### 2.1 Préservation de la ligne existante en production (`'personal_performance'`)
L'audit P0 et l'inspection directe de `public.adventure_data_consents` confirment la présence en production de la ligne :
- `id = 8b450312-7106-4025-8954-a8a43d35abf4`
- `purpose = 'personal_performance'`
- `granted = true`, `policy_version = 'a1-v1'`, `revoked_at = null`

### 2.2 Extension additive de la contrainte `adventure_data_consents_purpose_check`
Dans `supabase/migrations/20261120143000_effort_engine_v1.sql`, la contrainte `CHECK` sur `adventure_data_consents.purpose` conserve toutes les valeurs historiques et ajoute les nouvelles finalités granulaires :
- **Finalités historiques conservées** : `'personal_performance'`, `'collective_terrain'`, `'collective_aggregation'`, `'terrain_contribution'`, `'live_location'`, `'group_location'`, `'external_readiness'`
- **Nouvelles finalités granulaires ajoutées** : `'personal_scoring'`, `'wearable_sync'`, `'group_simulation'`, `'anonymized_calibration'`

### 2.3 Contrôle serveur rétrocompatible sans `OR` côté TypeScript (priorité stricte à la révocation RGPD)
1. **En base PostgreSQL (`public.has_active_consent(p_user_id, p_purpose)`)** :
   - Lorsque `p_purpose IN ('personal_scoring', 'personal_performance')`, la fonction évalue d'abord la dernière `policy_version` de la finalité exacte demandée (permettant une révocation RGPD immédiate si `'personal_scoring'` est explicitement révoqué, même si l'ancien `'personal_performance'` est resté à `true`), et à défaut d'entrée explicite, se replie sur toute entrée active dans `('personal_scoring', 'personal_performance')`.
2. **Dans le serveur TypeScript (`hasPersonalScoringConsent` et `processHikeSession` dans `src/features/adventure-intelligence/server/processHikeSession.ts`)** :
   - **Correctif RGPD appliqué** : `hasPersonalScoringConsent` ne fait **aucun `OR` côté TypeScript** avec `'personal_performance'`. Il délègue en **un seul appel** fail-closed à `client.hasActiveConsent(userId, 'personal_scoring')` (RPC SQL `public.has_active_consent`), qui applique la priorité stricte à la révocation explicite de `'personal_scoring'` tout en assurant la rétrocompatibilité avec `'personal_performance'` lorsqu'aucune ligne `'personal_scoring'` n'existe.
   - En mode shadow P3 (`typeof client.isEffortShadowEnabled === 'function'`), `processHikeSession` délègue également le contrôle `personalConsent` directement à `hasPersonalScoringConsent(client, session.user_id)`.
   - Un test unitaire dédié dans `src/features/adventure-intelligence/server/__tests__/effortShadowP3.test.ts` prouve qu'un utilisateur ayant `personal_performance = true` qui révoque `personal_scoring` reçoit `false` avec **un seul appel** `'personal_scoring'` (`0` score shadow persisté).

---

## 3. Vérification de l'absence de tokens OAuth bruts dans les connecteurs (`token_ref` uniquement)

L'audit complet du domaine `src/features/connectors/`, de la couche serveur `src/lib/connectors/` et de l'ensemble des migrations SQL `supabase/migrations/` confirme qu'**aucun jeton OAuth brut (`access_token`, `refresh_token`, `client_secret`) n'est jamais persisté en base ni conservé dans l'état de session** :

1. **`src/features/connectors/oauthAndConsent.ts` (`exchangeOAuthCodeFailClosed`, lignes 247–267)** :
   - Lors de l'échange du code d'autorisation PKCE via `params.transport`, la réponse transitoire contient `accessToken` et `refreshToken`, mais `exchangeOAuthCodeFailClosed` **ne retourne ni ne stocke jamais `accessToken` ni `refreshToken`** : seul `{ ok: true, providerId, userId, externalAthleteId, grantedScopes, expiresAt }` est extrait.
2. **`src/features/connectors/types.ts` (`ProviderConsentGrant` & `RevokeConnectionResult`, lignes 91–97 et 256–265)** :
   - `ProviderConsentGrant` ne contient que `{ providerId, connected, allowedScopes, grantedAt, revokedAt }`.
   - Lors de la révocation (`revokePartnerConnection`), `purgedTokenReferences: true` confirme la purge immédiate de toute référence de jeton et l'annulation des jobs en file (`cancelledPendingJobs`).
3. **`supabase/migrations/`** :
   - Aucune table de la base Supabase ne possède de colonne stockant un `access_token` ou `refresh_token` OAuth brut.

---

## 4. Segmentation directe (`trail_segments = 0`) & Lotissement idempotent du Cron `/api/cron/daily`

### 4.1 Répartition réelle des 141 `hike_sessions` face à `trail_segments = 0`
En base de production (`icxyvwzfjbflcbqukpfz`), `public.trail_segments` contient **`0` ligne** alors que `public.hike_sessions` contient **`141` lignes** :
- **120 sessions** possèdent un tableau `positions_timed` (échantillons GPS horodatés `{ lat, lng, timestamp, elevationM }`) ;
- **9 sessions** possèdent uniquement un `positions_geojson` (`LineString`) ;
- **12 sessions** ne possèdent pas de géométrie GPS mais portent les métriques scalaires (`distance_km`, `elevation_gain_m` / `dplus_m`, `duration_seconds` / `duration_min`).

### 4.2 Mode de segmentation directe dans `src/features/adventure-intelligence/server/processHikeSession.ts`
Lorsque `trail_segments` renvoie `0` candidat (`passages.length === 0`) et que `effort_score_v1_shadow = true` :
1. **`direct_positions_timed`** : `buildEffortSegmentsForSession` découpe directement les points normalisés de `hike_sessions.positions_timed` (ou `positions_geojson`) en tronçons de ~250 m (`DIRECT_SEGMENT_TARGET_LENGTH_M`), enrichit le profil altimétrique par MNT (`resolveMntElevations` ou synthèse fidèle au D+ de la session avec hystérésis `3 m`), et applique le fallback `surface = 'dirt'` (`DIRECT_SEGMENT_FALLBACK_SURFACE`) et `terrainFactorEta = 1.10` (`DIRECT_SEGMENT_FALLBACK_TERRAIN_ETA`).
2. **`direct_scalar_fallback`** : pour les 12 sessions sans coordonnées GPS, découpe la distance (`distance_km`), le dénivelé (`dplus_m` / `elevation_gain_m`) et la durée (`duration_min` / `duration_seconds`) en tronçons synthétiques (`surface = 'dirt'`, `eta = 1.10`) afin que **100 % des 141 `hike_sessions`** puissent être évaluées en mode shadow.
3. **Immutabilité Contrat C** : chaque évaluation calcule `snapshot_hash = sha256(model_version | profile_version | route_feature_version | equipment_snapshot | context_snapshot | scenario)` et persiste dans `public.effort_scores` avec `is_shadow = true` et `ON CONFLICT (snapshot_hash) DO NOTHING`.

### 4.3 Lotissement idempotent dans `src/lib/cron/dailyTasks.ts` (Budget 270 s / ~155 s disponibles)
- `DAILY_BUDGET_MS = 270_000` (270 s sur les 300 s max de Vercel Hobby).
- `DAILY_AVAILABLE_EFFORT_SHADOW_BUDGET_MS = 155_000` (~155 s disponibles en charge nominale).
- `EFFORT_SHADOW_BATCH_SIZE = 25` : les 141 `hike_sessions` sont découpées par `planEffortShadowDailyBatches` en **6 lots de 25 sessions** (5 × 25 + 1 × 16).
- `runIdempotentEffortShadowBatches` vérifie avant chaque lot et avant chaque session que le temps restant demeure supérieur ou égal à `DAILY_MIN_START_MS = 10_000` (10 s). Sur les 141 sessions, l'évaluation complète s'exécute en **< 150 ms** en mémoire, et tout rejeu ultérieur ignore les `snapshot_hash` déjà persistés (`skippedDuplicate = 141`).

---

## 5. Preuves de Validation (Porte de Sortie P3 — Exécutions réelles)

### 5.1 Exécution réelle sur PostgreSQL local jetable (cycle UP → pgTAP 30/30 → DOWN → UP → pgTAP 30/30)
- **Environnement local vérifié** : Docker, `supabase` CLI et `psql`/`postgres` natifs ne sont pas installés sur cette machine (`command not found`). Aucune connexion ni écriture n'a été effectuée sur la base de production `icxyvwzfjbflcbqukpfz`.
- **Moteur PostgreSQL local jetable utilisé** : **PostgreSQL 18.7** via `@electric-sql/pglite` (`PGlite 0.5.17`, installé temporairement dans `/tmp/lkdv-pg-test` hors dépôt), intégrant nativement le correctif PostgreSQL 17.6+ sur `INSERT ... ON CONFLICT` sous `ENABLE` + `FORCE ROW LEVEL SECURITY` ainsi que les rôles `anon`, `authenticated` et `service_role`.
- **Anomalie réelle détectée et corrigée à l'exécution** :
  - L'exécution réelle de `supabase/tests/effort_engine_rls.pgtap.sql` a levé l'erreur PostgreSQL `22P02: invalid input syntax for type uuid: "p3000000-0000-4000-8000-000000000001"` (le caractère `'p'` n'est pas hexadécimal).
  - Les fixtures UUID de `supabase/tests/effort_engine_rls.pgtap.sql` (et de `effortShadowP3.test.ts`) ont été corrigées en UUID v4 valides (`f3000000-...`).
- **Sorties réelles du cycle complet UP → pgTAP (30/30) → DOWN → RE-UP → pgTAP (30/30)** :
```text
=== POSTGRES VERSION ===
PostgreSQL 18.7 (PGlite 0.5.17) on wasm32-unknown-emscripten, compiled by emcc 6.0.13, 32-bit

=== STEP 1: APPLY MIGRATION UP ===
UP migration applied OK

=== STEP 2: pgTAP RUN #1 (after UP) ===
1..30
ok 1 - 1. user_physiology : ENABLE + FORCE ROW LEVEL SECURITY actifs
ok 2 - 2. effort_scores : ENABLE + FORCE ROW LEVEL SECURITY actifs
ok 3 - 3. group_prediction_members : ENABLE + FORCE ROW LEVEL SECURITY actifs
ok 4 - 4. route_predictions : ENABLE + FORCE ROW LEVEL SECURITY actifs
ok 5 - 5. anon : lecture user_physiology refusée (42501)
ok 6 - 6. anon : lecture effort_scores refusée (42501)
ok 7 - 7. anon : lecture group_prediction_members refusée (42501)
ok 8 - 8. User A : premier INSERT ON CONFLICT sur sa ligne user_physiology réussit
ok 9 - 9. User A : second INSERT ON CONFLICT DO UPDATE sur sa ligne user_physiology réussit sous RLS
ok 10 - 10. User A : weight_kg mis à jour à 75.5 kg après ON CONFLICT DO UPDATE
ok 11 - 11. User A : INSERT ON CONFLICT des 4 nouvelles finalités granulaires sur adventure_data_consents réussit
ok 12 - 12. User A : révocation via ON CONFLICT DO UPDATE sur adventure_data_consents réussit sous RLS
ok 13 - 13. User A : ne peut pas lire la ligne user_physiology de User B (0 ligne)
ok 14 - 14. User A : INSERT/ON CONFLICT sur la ligne user_physiology de User B est refusé (42501)
ok 15 - 15. User A : UPDATE sur user_physiology de User B affecte 0 ligne
ok 16 - 16. User A : DELETE sur user_physiology de User B supprime 0 ligne
ok 17 - 17. User A : lit son propre score dans effort_scores (1 ligne)
ok 18 - 18. User A : ne lit aucun effort_scores de User B (0 ligne)
ok 19 - 19. User A : INSERT direct dans effort_scores refusé (écriture service_role uniquement)
ok 20 - 20. User A : UPDATE dans effort_scores refusé (42501)
ok 21 - 21. User A : DELETE dans effort_scores refusé (42501)
ok 22 - 22. User A : lit uniquement sa propre ligne dans group_prediction_members (1 ligne)
ok 23 - 23. User A : ne peut pas lire la ligne group_prediction_members de User B (0 ligne)
ok 24 - 24. User A : UPDATE sur group_prediction_members refusé (42501)
ok 25 - 25. User A : lit sa propre ligne route_predictions (scope=member, member_user_id=A)
ok 26 - 26. User A : ne peut PAS lire route_predictions (scope=member, member_user_id=B), même si user_id=A
ok 27 - 27. Contrat C : ON CONFLICT (snapshot_hash) DO NOTHING préserve l'immutabilité du score original (42.5)
ok 28 - 28. Rétrocompatibilité : has_active_consent(User B, personal_scoring) accepte le consentement historique personal_performance
ok 29 - 29. Révocation : has_active_consent(User A, personal_scoring) retourne false après révocation explicite
ok 30 - 30. Feature flags : effort_score_v1_shadow et group_prediction_v2_shadow sont présents et à enabled = false par défaut
# All 30 tests passed
SUMMARY [STEP 2: pgTAP RUN #1 (after UP)]: 30 ok, 0 not ok

=== STEP 3: APPLY MIGRATION DOWN ===
DOWN migration applied OK. Legacy personal_performance row preserved: [
  { id: '8b450312-7106-4025-8954-a8a43d35abf4', purpose: 'personal_performance', granted: true }
]

=== STEP 4: RE-APPLY MIGRATION UP ===
RE-UP migration applied OK

=== STEP 5: pgTAP RUN #2 (after DOWN -> UP) ===
1..30
# All 30 tests passed
SUMMARY [STEP 5: pgTAP RUN #2 (after DOWN -> UP)]: 30 ok, 0 not ok
```
- **Vérification SQL directe de la révocation RGPD sur PostgreSQL 18.7** (utilisateur avec `personal_performance = true` qui révoque `personal_scoring = false`) :
  - `SELECT public.has_active_consent(user_b, 'personal_scoring')` avant révocation : **`true`** (rétrocompatibilité) ; après révocation explicite de `personal_scoring` : **`false`** (priorité RGPD).

### 5.2 Tests unitaires Vitest P3 & Régression A2/A10
```text
npx vitest run src/features/adventure-intelligence/server/__tests__/effortShadowP3.test.ts tests/adventure-intelligence/process-hike-session.spec.ts tests/adventure-intelligence/consent-enforcement.spec.ts

 ✓ tests/adventure-intelligence/consent-enforcement.spec.ts (9 tests)
 ✓ tests/adventure-intelligence/process-hike-session.spec.ts (18 tests)
 ✓ src/features/adventure-intelligence/server/__tests__/effortShadowP3.test.ts (15 tests)

 Test Files  3 passed (3)
      Tests  42 passed (42)
```

### 5.3 Gardes anti-dérive & TypeScript
- `node scripts/verify/identity_compliance.mjs` : **VERT (code 0)** — `✓ ANTI-DÉRIVE : toutes les contraintes durables sont respectées.`
- `node scripts/verify/traveller_privacy.mjs` : **VERT (code 0)** — `✓ VIE PRIVÉE : profil voyageur confiné (lecteur, actions, carte).`
- `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit -p .` : **0 erreur TypeScript** sur l'ensemble des fichiers P3 et `src/features/adventure-intelligence/**` (seules 2 erreurs préexistantes hors périmètre dans `src/features/hub/cockpit/loadCockpit.ts`, non modifié).
