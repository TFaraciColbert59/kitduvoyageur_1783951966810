# RUNBOOK DE DÉPLOIEMENT EN SHADOW MODE — EFFORT ENGINE V1

**Projet Supabase cible** : `icxyvwzfjbflcbqukpfz` (PostgreSQL `17.6.1.141`)  
**Branche applicative** : `feat/effort-engine-v1` → `main`  
**Migration UP** : `supabase/migrations/20261120143000_effort_engine_v1.sql`  
**Migration DOWN (rollback schéma)** : `supabase/migrations_down/20261120143000_effort_engine_v1.down.sql`  
**Portée de mise en service** : Shadow Mode silencieux uniquement (`effort_score_v1_shadow`), sans exposition utilisateur en production tant que la phase shadow n'est pas validée.

> **Règle d'ordre stricte** : Exécuter les étapes **A → B → C** dans cet ordre exact. Ne jamais activer `effort_score_v1_shadow = true` avant que la migration DB (Étape A) ET le déploiement Vercel de `main` (Étape B) ne soient tous deux **verts**.

---

## Étape A — Base de données Supabase (`icxyvwzfjbflcbqukpfz`), tous les flags à `false`

### A.1 Application de la migration SQL (additive et rétrocompatible)

La migration `supabase/migrations/20261120143000_effort_engine_v1.sql` est strictement additive :
- crée `public.user_physiology`, `public.effort_scores`, `public.group_prediction_members` avec `ENABLE` + `FORCE ROW LEVEL SECURITY` ;
- ajoute `posterior jsonb` sur `public.user_performance_profiles` et `scope` / `member_user_id` sur `public.route_predictions` ;
- étend `public.adventure_data_consents.purpose` sans supprimer les valeurs historiques (notamment `'personal_performance'`) ;
- met à jour `public.has_active_consent(uuid, text)` avec rétrocompatibilité `'personal_scoring'` / `'personal_performance'` et priorité stricte à la révocation RGPD ;
- insère `effort_score_v1_shadow` et `group_prediction_v2_shadow` à **`enabled = false`** (`ON CONFLICT (id) DO NOTHING`).

Choisir **une** des trois voies d'application ci-dessous sur `icxyvwzfjbflcbqukpfz` :

1. **Via Supabase CLI (recommandé si CLI liée au projet `icxyvwzfjbflcbqukpfz`)** :
   ```bash
   # Vérifier d'abord que seule la migration 20261120143000_effort_engine_v1.sql est en attente
   supabase link --project-ref icxyvwzfjbflcbqukpfz
   supabase db push --dry-run
   supabase db push
   ```
   > Attention : si des migrations `20261119*` non mergées sont présentes localement dans le répertoire de travail, privilégier `psql` ou le SQL Editor ci-dessous afin de n'appliquer **strictement que** `supabase/migrations/20261120143000_effort_engine_v1.sql`.

2. **Via `psql` (application ciblée d'un fichier unique)** :
   ```bash
   psql "$SUPABASE_PROD_DB_URL" \
     -v ON_ERROR_STOP=1 \
     -f supabase/migrations/20261120143000_effort_engine_v1.sql
   ```

3. **Via Supabase Dashboard → SQL Editor (`icxyvwzfjbflcbqukpfz`)** :
   - Ouvrir le SQL Editor du projet `icxyvwzfjbflcbqukpfz`.
   - Coller intégralement le contenu de `supabase/migrations/20261120143000_effort_engine_v1.sql` et exécuter en une transaction (`BEGIN; ... COMMIT;`).

> **Rappel critique après migration** : `effort_score_v1_shadow` et `group_prediction_v2_shadow` restent **obligatoirement à `false`** à la fin de l'Étape A.

---

### A.2 Vérification immédiate des Advisors Supabase (Sécurité RLS & Performance)

1. Dans le Dashboard Supabase du projet `icxyvwzfjbflcbqukpfz`, ouvrir **Database → Advisors** (ou via l'outil MCP `get_advisors` sur `security` et `performance`) :
   - **Security Advisor** : 0 alerte critique sur `user_physiology`, `effort_scores`, `group_prediction_members`, `route_predictions`, `user_performance_profiles`, `adventure_data_consents`, et `has_active_consent` (`SET search_path = public, pg_temp`).
   - **Performance Advisor** : 0 avertissement `auth_rls_initplan` (toutes les policies utilisent `(SELECT auth.uid())`) et présence des index `idx_effort_scores_user_computed`, `idx_effort_scores_hike_session`, `idx_group_prediction_members_prediction`, `idx_group_prediction_members_user`, `idx_route_predictions_member_user`.

2. Exécuter les **requêtes SQL de contrôle RLS & Feature Flags** (lecture seule) :

```sql
-- 1) Vérifier ENABLE + FORCE ROW LEVEL SECURITY sur toutes les tables P3
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'user_physiology',
    'effort_scores',
    'group_prediction_members',
    'route_predictions',
    'user_performance_profiles',
    'adventure_data_consents'
  )
ORDER BY c.relname;
-- Attendu : rls_enabled = true ET rls_forced = true pour les 6 tables.

-- 2) Vérifier que TOUS les feature flags adventure-intelligence (y compris shadow) sont à false
SELECT id, enabled, updated_at
FROM public.feature_flags
WHERE id IN (
  'performance_profile_v2',
  'route_prediction_v2',
  'collective_intelligence',
  'terrain_live',
  'performance_profile_v2_shadow',
  'route_prediction_v2_shadow',
  'collective_intelligence_shadow',
  'terrain_auto_detection_shadow',
  'effort_score_v1_shadow',
  'group_prediction_v2_shadow'
)
ORDER BY id;
-- Attendu : 10 lignes, TOUTES avec enabled = false.
```

---

### A.3 Contrôle de la préservation du consentement historique `'personal_performance'` & test lecture-seule `has_active_consent`

```sql
-- 1) Vérifier la préservation intacte de la ligne historique en production
SELECT id, user_id, purpose, granted, policy_version, granted_at, revoked_at
FROM public.adventure_data_consents
WHERE id = '8b450312-7106-4025-8954-a8a43d35abf4';
-- Attendu : 1 ligne, purpose = 'personal_performance', granted = true,
--           policy_version = 'a1-v1', revoked_at IS NULL.

-- 2) Test lecture-seule de la rétrocompatibilité public.has_active_consent(..., 'personal_scoring')
SELECT
  c.id AS consent_id,
  c.user_id,
  c.purpose AS stored_purpose,
  public.has_active_consent(c.user_id, 'personal_scoring') AS personal_scoring_active,
  public.has_active_consent(c.user_id, 'personal_performance') AS personal_performance_active
FROM public.adventure_data_consents c
WHERE c.id = '8b450312-7106-4025-8954-a8a43d35abf4';
-- Attendu : personal_scoring_active = true ET personal_performance_active = true.
```

---

## Étape B — Pull Request, contrôles CI/locaux & Déploiement Vercel

### B.1 Check-list PR et merge `feat/effort-engine-v1` → `main`

Avant d'ouvrir / merger la PR vers `main`, vérifier chaque point ci-dessous :

- [ ] **Isolation stricte du diff PR** :
  ```bash
  git diff --name-only main...feat/effort-engine-v1
  ```
  Vérifier qu'**aucun fichier hors périmètre** n'apparaît dans la PR, notamment :
  - **ABSENT** : `src/features/hub/cockpit/loadCockpit.ts` (et tout `src/features/hub/*`)
  - **ABSENT** : `src/app/api/clubs/*`, `src/app/sorties/*`, `src/components/clubs/*`, `src/features/clubs/*`
  - **ABSENT** : `supabase/migrations/20261119*`, `supabase/migrations_down/20261119*`, `supabase/tests/database/*`
- [ ] **Gardes anti-dérive & vie privée** :
  ```bash
  node scripts/verify/identity_compliance.mjs
  node scripts/verify/traveller_privacy.mjs
  ```
- [ ] **Audit d'équité démographique (P6)** :
  ```bash
  npx tsx scripts/verify/effort_fairness_audit.ts
  ```
- [ ] **Suite Vitest complète P1–P6 & régression A2/A10** :
  ```bash
  npx vitest run \
    src/features/adventure-intelligence/domain/__tests__/effortScore.test.ts \
    src/features/adventure-intelligence/domain/__tests__/groupIntelligenceV2.test.ts \
    src/features/adventure-intelligence/domain/__tests__/effortBacktestP6.test.ts \
    src/features/adventure-intelligence/server/__tests__/geoWeatherP2.test.ts \
    src/features/adventure-intelligence/server/__tests__/effortShadowP3.test.ts \
    src/components/compte/overlay/__tests__/effortDrawer.test.tsx \
    tests/adventure-intelligence/process-hike-session.spec.ts \
    tests/adventure-intelligence/consent-enforcement.spec.ts
  ```
- [ ] **Validation E2E Playwright P4 (tiroir Effort / Compte)** :
  ```bash
  npx playwright test scripts/e2e/effort-drawer.spec.ts
  ```
- [ ] **Merge `feat/effort-engine-v1` → `main`** (squash ou merge commit propre selon la politique du dépôt) après revue et CI verte.

### B.2 Validation du build et du déploiement Vercel

1. Vérifier que le déploiement Vercel de `main` est **Ready / Vert** avec la commande définie dans `vercel.json` :
   - `buildCommand`: `NODE_OPTIONS=--max-old-space-size=8192 next build --no-lint`
   - `regions`: `["cdg1"]`
   - `crons`: `[{ "path": "/api/cron/daily", "schedule": "0 3 * * *" }]`
2. Vérifier la configuration du cron `/api/cron/daily` :
   - `src/app/api/cron/daily/route.ts` exporte `export const maxDuration = 300;` (plafond Vercel Hobby 300 s).
   - `src/lib/cron/dailyTasks.ts` borne le répartiteur à `DAILY_BUDGET_MS = 270_000` (270 s), réserve `DAILY_AVAILABLE_EFFORT_SHADOW_BUDGET_MS = 155_000` (~155 s disponibles) et découpe les `hike_sessions` en lots idempotents de `EFFORT_SHADOW_BATCH_SIZE = 25` (6 lots pour les 141 sessions actuelles) avec arrêt anticipé sous `DAILY_MIN_START_MS = 10_000` (10 s).
3. Vérifier dans les logs Vercel que les requêtes de santé répondent `200` et qu'aucune erreur serveur n'apparaît alors que tous les flags shadow sont encore à `false`.

---

## Étape C — Activation du Shadow Mode (uniquement après déploiement Vercel vert)

### C.1 Activation ciblée d'`effort_score_v1_shadow` uniquement

Exécuter **exactement** cette requête sur `icxyvwzfjbflcbqukpfz` (en laissant tous les autres flags `adventure-intelligence`, dont `group_prediction_v2_shadow`, à `false`) :

```sql
UPDATE public.feature_flags
SET enabled = true, updated_at = now()
WHERE id = 'effort_score_v1_shadow';
```

Vérification immédiate post-activation :

```sql
SELECT id, enabled, updated_at
FROM public.feature_flags
WHERE id IN (
  'performance_profile_v2',
  'route_prediction_v2',
  'collective_intelligence',
  'terrain_live',
  'performance_profile_v2_shadow',
  'route_prediction_v2_shadow',
  'collective_intelligence_shadow',
  'terrain_auto_detection_shadow',
  'effort_score_v1_shadow',
  'group_prediction_v2_shadow'
)
ORDER BY id;
-- Attendu : UNIQUEMENT effort_score_v1_shadow = true ; les 9 autres flags = false.
```

> **Rappel RGPD (fail-closed au démarrage)** :
> Seul l'utilisateur disposant déjà du consentement historique actif `'personal_performance'` (`adventure_data_consents.id = '8b450312-7106-4025-8954-a8a43d35abf4'`) sera scoré en mode shadow au démarrage via `public.has_active_consent(user_id, 'personal_scoring')`. Tous les autres utilisateurs sans consentement explicite restent strictement non scorés (fail-closed). Si cet utilisateur révoque explicitement `'personal_scoring'`, le scoring s'arrête immédiatement dès le prochain cycle.

---

### C.2 Contrôle des premières lignes persistées dans `public.effort_scores`

Après le premier passage de `/api/cron/daily` (ou une invocation manuelle autorisée avec `Authorization: Bearer $CRON_SECRET`), contrôler les premières lignes écrites en mode shadow :

```sql
SELECT
  id,
  user_id,
  hike_session_id,
  score_version,
  snapshot_hash,
  iea,
  erp,
  e_flat_km,
  technicite,
  data_level,
  interval_p10,
  interval_p50,
  interval_p90,
  evidence,
  warnings,
  is_shadow,
  computed_at
FROM public.effort_scores
WHERE is_shadow = true
ORDER BY computed_at DESC
LIMIT 20;
```

Points de contrôle attendus sur ces lignes :
- `is_shadow = true` sur toutes les lignes ;
- `snapshot_hash` non vide et unique (rejeu du cron idempotent via `ON CONFLICT (snapshot_hash) DO NOTHING`, aucun doublon) ;
- `iea` et `erp` bornés dans `[0, 100]` ;
- `data_level IN ('socle', 'cardio', 'complet')` cohérent avec les capteurs présents sur la session ;
- `evidence` est un tableau JSON non nul documentant la provenance des entrées (ex: `direct_positions_timed` ou `direct_scalar_fallback` tant que `trail_segments = 0`) ;
- `user_id` correspond uniquement aux utilisateurs consentis (`has_active_consent(user_id, 'personal_scoring') = true`).

---

### C.3 Procédure de Rollback

#### 1. Rollback instantané en 1 ligne (sans migration destructive — recommandé en cas d'anomalie)

Coupe immédiatement tout calcul et toute persistance shadow sans toucher au schéma ni aux données existantes :

```sql
UPDATE public.feature_flags SET enabled = false, updated_at = now() WHERE id = 'effort_score_v1_shadow';
```

#### 2. Rollback schéma complet (uniquement si retrait complet de la migration P3 requis)

La migration descendante `supabase/migrations_down/20261120143000_effort_engine_v1.down.sql` annule proprement les objets P3 (flags shadow, tables `group_prediction_members` / `effort_scores` / `user_physiology`, colonnes additives et contrainte CHECK A1) **tout en préservant intégralement** la ligne historique `'personal_performance'` (`8b450312-7106-4025-8954-a8a43d35abf4`) et les lignes solo existantes de `route_predictions` :

```bash
psql "$SUPABASE_PROD_DB_URL" \
  -v ON_ERROR_STOP=1 \
  -f supabase/migrations_down/20261120143000_effort_engine_v1.down.sql
```
