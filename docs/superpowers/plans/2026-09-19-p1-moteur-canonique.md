# P1 — Moteur de progression canonique : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le moteur de progression factice de la branche par un moteur serveur-autoritaire : ledger canonique étendu, décisions journalisées, outbox atomique, projections reconstructibles, sécurité RLS/RPC, service et routes honnêtes.

**Architecture:** Le Reward Engine existant porte le gain canonique ; un trigger crée un événement outbox durable ; un consommateur SQL atomique met à jour les projections (`progression_events`, `user_progression`, `user_season_progress`) ; le rebuild rejoue les décisions enregistrées ; aucune écriture cliente.

**Tech Stack:** PostgreSQL 17 + PostGIS, pgTAP, Supabase CLI, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-19-lkdv-progression-canonique-direction-mobile-design.md` (§2 et §3).

## Global Constraints

- Base de test locale : conteneur `lkdv-test-db` (port 55432), baseline + auth + grants + migrations post-baseline (procédure dans le plan programme).
- Tests SQL : `npx supabase test db --db-url "postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable" supabase/tests/database/<fichier>.test.sql`
- Tests TS : `npm test -- <chemin>`, puis `npm run type-check`, `npm run lint`.
- Clé d'idempotence : `<source>:<source_id>`, sans `rules_version`.
- Allocations : montants par compétence, somme exacte = gain, arrondi plus fort reste.
- UID nul n'autorise rien ; appels serveur par `service_role` uniquement.
- Chaque tâche : test d'abord (pgTAP ou Vitest), implémentation minimale, tests verts, commit.

---

### Task 1: Colonnes canoniques du ledger et validateur d'allocations

**Files:**
- Create: `supabase/migrations/20260920100000_progression_canonique_ledger.sql`
- Create: `supabase/tests/database/progression_canonique_ledger.test.sql`

**Interfaces:**
- Consumes: `reward_transactions` (baseline), `progression_seasons` (migration 20260919).
- Produces: colonnes `idempotency_key`, `effective_at`, `season_id`, `rules_version`, `skill_allocations`, `counts_for_progression`, `affects_balance` ; type `PROGRESSION_AWARD` ; `public.progression_allocations_valid(points integer, allocations jsonb) returns boolean`.

- [ ] **Step 1: Write the failing test** — `supabase/tests/database/progression_canonique_ledger.test.sql`

```sql
BEGIN;
SET LOCAL search_path = public;
SELECT plan(8);

-- 1. Colonnes additives présentes
SELECT has_column('public', 'reward_transactions', 'idempotency_key', '1. idempotency_key existe');
SELECT has_column('public', 'reward_transactions', 'skill_allocations', '2. skill_allocations existe');
SELECT has_column('public', 'reward_transactions', 'affects_balance', '3. affects_balance existe');

-- 4. Le type PROGRESSION_AWARD est accepté
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc','authenticated','authenticated','ledger@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc','Carol Ledger','ledger@test.local')
ON CONFLICT (id) DO NOTHING;
SELECT lives_ok(
  $$INSERT INTO public.reward_transactions (user_id, points, transaction_type, idempotency_key, counts_for_progression, affects_balance)
    VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 10, 'PROGRESSION_AWARD', 'test:1', true, false)$$,
  '4. PROGRESSION_AWARD accepté'
);

-- 5. Clé d'idempotence unique
SELECT throws_ok(
  $$INSERT INTO public.reward_transactions (user_id, points, transaction_type, idempotency_key)
    VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 10, 'ADMIN_ADJUSTMENT', 'test:1')$$,
  '23505', NULL, '5. idempotency_key dupliquée refusée'
);

-- 6-7. Validateur d'allocations
SELECT ok(public.progression_allocations_valid(20, '[{"skill":"explorer","weight":1,"points":20}]'::jsonb), '6. allocation exacte valide');
SELECT ok(NOT public.progression_allocations_valid(20, '[{"skill":"explorer","weight":1,"points":19}]'::jsonb), '7. somme incorrecte refusée');
SELECT throws_ok(
  $$INSERT INTO public.reward_transactions (user_id, points, transaction_type, skill_allocations)
    VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 20, 'PROGRESSION_AWARD', '[{"skill":"explorer","weight":1,"points":19}]'::jsonb)$$,
  '23514', NULL, '8. contrainte CHECK des allocations appliquée'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx supabase test db --db-url "postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable" supabase/tests/database/progression_canonique_ledger.test.sql`
Expected: FAIL (colonnes absentes).

- [ ] **Step 3: Write minimal implementation** — `supabase/migrations/20260920100000_progression_canonique_ledger.sql`

```sql
-- Ledger canonique : colonnes additives, type PROGRESSION_AWARD, validateur d'allocations.
ALTER TABLE public.reward_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS effective_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS season_id TEXT REFERENCES public.progression_seasons(id),
  ADD COLUMN IF NOT EXISTS rules_version TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS skill_allocations JSONB,
  ADD COLUMN IF NOT EXISTS counts_for_progression BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS affects_balance BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.reward_transactions DROP CONSTRAINT IF EXISTS reward_transactions_transaction_type_check;
ALTER TABLE public.reward_transactions ADD CONSTRAINT reward_transactions_transaction_type_check
  CHECK (transaction_type IN ('LIKE_REWARD','COMMENT_REWARD','POST_REWARD','JOURNAL_REWARD','GROUP_REWARD',
    'QUALITY_BONUS','FRAUD_REVERSAL','ADMIN_ADJUSTMENT','REDEMPTION','EXPIRATION','REFERRAL_REWARD','PROGRESSION_AWARD'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_transactions_idempotency
  ON public.reward_transactions (idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.progression_allocations_valid(p_points INTEGER, p_allocations JSONB)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT p_allocations IS NULL OR (
    jsonb_typeof(p_allocations) = 'array'
    AND COALESCE((SELECT SUM((e->>'points')::int) FROM jsonb_array_elements(p_allocations) e), 0) = p_points
    AND COALESCE((SELECT bool_and(
          COALESCE((e->>'weight')::numeric, 0) >= 0
          AND e->>'skill' IN ('explorer','preparer','partager','entraider')
        ) FROM jsonb_array_elements(p_allocations) e), true)
  );
$$;

ALTER TABLE public.reward_transactions ADD CONSTRAINT chk_skill_allocations
  CHECK (skill_allocations IS NULL OR public.progression_allocations_valid(points, skill_allocations));
```

- [ ] **Step 4: Run test to verify it passes** (même commande) — Expected: 8/8 ok.
- [ ] **Step 5: Commit** — `git add supabase/migrations/20260920100000_progression_canonique_ledger.sql supabase/tests/database/progression_canonique_ledger.test.sql && git commit -m "feat(db): ledger canonique progression (colonnes, type, validateur d'allocations)"`

---

### Task 2: Trigger de solde respectueux du marquage, outbox durable, revokes d'écriture

**Files:**
- Create: `supabase/migrations/20260920101000_progression_outbox.sql`
- Create: `supabase/tests/database/progression_canonique_outbox.test.sql`

**Interfaces:**
- Consumes: Task 1 ; `update_reward_account_on_transaction` (baseline).
- Produces: `progression_outbox` (id, reward_transaction_id UNIQUE, user_id, season_id, status, attempts, available_at, locked_at, processed_at, last_error, payload_snapshot, created_at) ; trigger `on_reward_transaction_progression_outbox` ; `reward_transactions` non modifiable par `authenticated`/`anon`.

- [ ] **Step 1: Write the failing test**

```sql
BEGIN;
SET LOCAL search_path = public;
SELECT plan(6);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd','authenticated','authenticated','outbox@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd','Dan Outbox','outbox@test.local')
ON CONFLICT (id) DO NOTHING;

-- 1. Gain progression pur : solde économique inchangé
INSERT INTO public.reward_transactions (user_id, points, transaction_type, idempotency_key, counts_for_progression, affects_balance, effective_at)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 25, 'PROGRESSION_AWARD', 'outbox:1', true, false, now());
SELECT is((SELECT available_points FROM public.reward_accounts WHERE user_id='dddddddd-dddd-dddd-dddd-dddddddddddd'), 0, '1. affects_balance=false ne crédite pas le solde');

-- 2. Une ligne outbox créée, en attente
SELECT is((SELECT count(*)::int FROM public.progression_outbox WHERE reward_transaction_id = (SELECT id FROM public.reward_transactions WHERE idempotency_key='outbox:1')), 1, '2. outbox créée');
SELECT is((SELECT status FROM public.progression_outbox WHERE reward_transaction_id = (SELECT id FROM public.reward_transactions WHERE idempotency_key='outbox:1')), 'pending', '3. statut pending');

-- 3. Pas d'outbox sans marquage
INSERT INTO public.reward_transactions (user_id, points, transaction_type, idempotency_key, counts_for_progression)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 5, 'ADMIN_ADJUSTMENT', 'outbox:2', false);
SELECT is((SELECT count(*)::int FROM public.progression_outbox o JOIN public.reward_transactions t ON t.id=o.reward_transaction_id WHERE t.idempotency_key='outbox:2'), 0, '4. counts_for_progression=false → aucune outbox');

-- 4. Écriture directe cliente refusée
SELECT is((SELECT has_table_privilege('authenticated','public.reward_transactions','INSERT')), false, '5. INSERT client révoqué');
SELECT is((SELECT has_table_privilege('authenticated','public.progression_outbox','SELECT')), false, '6. SELECT client outbox révoqué');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test to verify it fails** (même commande que Task 1, fichier outbox) — Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```sql
-- Trigger de solde : ignore les écritures marquées affects_balance=false
CREATE OR REPLACE FUNCTION public.update_reward_account_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT COALESCE(NEW.affects_balance, true) THEN
    RETURN NEW; -- progression pure : aucun droit économique
  END IF;
  INSERT INTO public.reward_accounts (user_id, available_points, lifetime_points, eligible_points, earned_this_period, redeemed_points)
  VALUES (NEW.user_id, GREATEST(0, NEW.points), GREATEST(0, NEW.points), GREATEST(0, NEW.points), GREATEST(0, NEW.points),
    CASE WHEN NEW.transaction_type = 'REDEMPTION' THEN ABS(NEW.points) ELSE 0 END)
  ON CONFLICT (user_id) DO UPDATE SET
    available_points = GREATEST(0, public.reward_accounts.available_points + NEW.points),
    lifetime_points = public.reward_accounts.lifetime_points + CASE WHEN NEW.points > 0 THEN NEW.points ELSE 0 END,
    eligible_points = GREATEST(0, public.reward_accounts.eligible_points + NEW.points),
    earned_this_period = GREATEST(0, public.reward_accounts.earned_this_period + CASE WHEN NEW.transaction_type <> 'REDEMPTION' THEN NEW.points ELSE 0 END),
    redeemed_points = public.reward_accounts.redeemed_points + CASE WHEN NEW.transaction_type = 'REDEMPTION' THEN ABS(NEW.points) ELSE 0 END,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TABLE IF NOT EXISTS public.progression_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_transaction_id UUID NOT NULL UNIQUE REFERENCES public.reward_transactions(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL,
  season_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','processed','failed','dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  last_error TEXT,
  payload_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.progression_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.progression_outbox FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_progression_outbox()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT COALESCE(NEW.counts_for_progression, false) THEN RETURN NEW; END IF;
  INSERT INTO public.progression_outbox (reward_transaction_id, user_id, season_id, payload_snapshot)
  VALUES (NEW.id, NEW.user_id, NEW.season_id,
    jsonb_build_object('points', NEW.points, 'allocations', NEW.skill_allocations,
      'transaction_type', NEW.transaction_type, 'effective_at', NEW.effective_at,
      'rules_version', NEW.rules_version, 'reference_type', NEW.reference_type))
  ON CONFLICT (reward_transaction_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_reward_transaction_progression_outbox ON public.reward_transactions;
CREATE TRIGGER on_reward_transaction_progression_outbox
  AFTER INSERT ON public.reward_transactions
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_progression_outbox();

-- Les écritures clientes directes sont révoquées (les RPC SECURITY DEFINER restent seules voies)
DROP POLICY IF EXISTS "Allow admin write on reward_transactions" ON public.reward_transactions;
REVOKE INSERT, UPDATE, DELETE ON public.reward_transactions FROM anon, authenticated;
DROP POLICY IF EXISTS "Allow admin write on pending_contributions" ON public.pending_contributions;
REVOKE INSERT, UPDATE, DELETE ON public.pending_contributions FROM anon, authenticated;
```

- [ ] **Step 4: Run test to verify it passes** — Expected: 6/6 ok.
- [ ] **Step 5: Commit** — `git commit -am "feat(db): outbox progression durable, trigger de solde respectueux du marquage, revokes"`

---

### Task 3: Règles versionnées, décisions journalisées, niveau canonique

**Files:**
- Create: `supabase/migrations/20260920102000_progression_rules_decisions.sql`
- Create: `supabase/tests/database/progression_canonique_rules.test.sql`

**Interfaces:**
- Produces: `progression_rules(version PK, payload JSONB, active BOOLEAN, created_at)` avec une seule version active ; `progression_decisions(idempotency_key PK, user_id, action_type, source_type, source_id, outcome, reason, reward_transaction_id, rules_version, effective_at, created_at)` ; `public.progression_level_for(p_points integer) returns table(level int, level_title text)`.

- [ ] **Step 1: Write the failing test**

```sql
BEGIN;
SET LOCAL search_path = public;
SELECT plan(5);
SELECT ok(exists(SELECT 1 FROM public.progression_rules WHERE active), '1. une version de règles active');
SELECT is((SELECT level FROM public.progression_level_for(0)), 1, '2. 0 point → niveau 1');
SELECT is((SELECT level FROM public.progression_level_for(1500)), 5, '3. 1500 → niveau 5');
SELECT is((SELECT level_title FROM public.progression_level_for(20000)), 'Gardien des Horizons', '4. 20000 → titre max');
SELECT throws_ok(
  $$INSERT INTO public.progression_decisions (idempotency_key,user_id,action_type,source_type,source_id,outcome,rules_version)
    VALUES ('k','00000000-0000-0000-0000-000000000000','x','y','z','bogus','v1')$$,
  '23514', NULL, '5. issue invalide refusée');
SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Write minimal implementation**

```sql
CREATE TABLE IF NOT EXISTS public.progression_rules (
  version TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_progression_rules_active ON public.progression_rules ((active)) WHERE active;
ALTER TABLE public.progression_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.progression_rules FROM anon, authenticated;

INSERT INTO public.progression_rules (version, active, payload) VALUES ('v1', true, jsonb_build_object(
  'levels', jsonb_build_array(
    jsonb_build_object('level',1,'min_points',0,'title','Randonneur Curieux'),
    jsonb_build_object('level',2,'min_points',100,'title','Marcheur Averti'),
    jsonb_build_object('level',3,'min_points',300,'title','Arpenteur des Bois'),
    jsonb_build_object('level',4,'min_points',700,'title','Éclaireur des Cimes'),
    jsonb_build_object('level',5,'min_points',1500,'title','Navigateur Alpin'),
    jsonb_build_object('level',6,'min_points',3000,'title','Pionnier des Crêtes'),
    jsonb_build_object('level',7,'min_points',5500,'title','Guide de Cordée'),
    jsonb_build_object('level',8,'min_points',9000,'title','Maître d''Expédition'),
    jsonb_build_object('level',9,'min_points',14000,'title','Légende des Sentiers'),
    jsonb_build_object('level',10,'min_points',20000,'title','Gardien des Horizons')),
  'grace_days', 14,
  'late_policy', 'refuse',
  'min_participants', 5,
  'season_duration_weeks', 8,
  'actions', '{}'::jsonb
)) ON CONFLICT (version) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.progression_decisions (
  idempotency_key TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('awarded','awarded_lifetime_only','refused','duplicate')),
  reason TEXT,
  reward_transaction_id UUID,
  rules_version TEXT NOT NULL,
  effective_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.progression_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.progression_decisions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.progression_level_for(p_points INTEGER)
RETURNS TABLE(level INT, level_title TEXT)
LANGUAGE sql STABLE AS $$
  SELECT t.level::int, t.title
  FROM public.progression_rules r,
       jsonb_to_recordset(r.payload->'levels') AS t(level int, min_points int, title text)
  WHERE r.active AND p_points >= t.min_points
  ORDER BY t.min_points DESC LIMIT 1;
$$;
```

- [ ] **Step 4: Run to verify pass.** — Expected: 5/5 ok.
- [ ] **Step 5: Commit** — `git commit -am "feat(db): règles versionnées, décisions et niveau canonique"`

---

### Task 4: Fonction d'attribution `award_progression_gain`

**Files:**
- Create: `supabase/migrations/20260920103000_award_gain.sql`
- Create: `supabase/tests/database/progression_canonique_award.test.sql`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `public.award_progression_gain(p_user_id uuid, p_action_type text, p_source_type text, p_source_id text, p_effective_at timestamptz, p_points_total integer, p_weights jsonb, p_explanation text, p_metadata jsonb default '{}') returns jsonb`. Retour : `{success, outcome, reason?, idempotencyKey, idempotent?, points, allocations, rewardTransactionId?, seasonId?}`. Clé construite : `p_source_type || ':' || p_source_id`. Exécution `service_role` uniquement.

- [ ] **Step 1: Write the failing test**

```sql
BEGIN;
SET LOCAL search_path = public;
SELECT plan(8);
UPDATE public.progression_rules SET payload = jsonb_set(payload, '{actions}',
  '{"test_hike":{"caps":{"daily":2,"weekly":5,"season":10}},"test_prep":{"caps":{"daily":5,"weekly":10,"season":20}}}'::jsonb) WHERE active;

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','authenticated','authenticated','award@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email)
VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','Eve Award','award@test.local')
ON CONFLICT (id) DO NOTHING;

-- 1. Attribution valide
SELECT is((public.award_progression_gain('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','test_hike','hike_session','s-1', now(), 40,
  '{"explorer":1,"preparer":0,"partager":0,"entraider":0}', 'Randonnée terminée'))->>'outcome', 'awarded', '1. attribution validée');
SELECT is((SELECT COUNT(*)::int FROM public.reward_transactions WHERE idempotency_key='hike_session:s-1' AND counts_for_progression), 1, '2. transaction canonique unique');
SELECT is((SELECT (skill_allocations->0->>'points')::int FROM public.reward_transactions WHERE idempotency_key='hike_session:s-1'), 40, '3. allocation explorer = 40');
SELECT is((SELECT COUNT(*)::int FROM public.progression_outbox o JOIN public.reward_transactions t ON t.id=o.reward_transaction_id WHERE t.idempotency_key='hike_session:s-1'), 1, '4. outbox créée');

-- 2. Rejeu → idempotent, aucune nouvelle transaction
SELECT is((public.award_progression_gain('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','test_hike','hike_session','s-1', now(), 40,
  '{"explorer":1,"preparer":0,"partager":0,"entraider":0}', 'Randonnée terminée'))->>'idempotent', 'true', '5. rejeu idempotent');
SELECT is((SELECT COUNT(*)::int FROM public.reward_transactions WHERE idempotency_key='hike_session:s-1'), 1, '6. pas de double crédit');

-- 3. Poids invalides → refus journalisé
SELECT is((public.award_progression_gain('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','test_prep','trail_prep','eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee:r-1', now(), 30,
  '{"explorer":0.5,"preparer":0.2,"partager":0,"entraider":0}', 'x'))->>'outcome', 'refused', '7. somme des poids ≠ 1 refusée');
SELECT is((SELECT outcome FROM public.progression_decisions WHERE idempotency_key='trail_prep:eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee:r-1'), 'refused', '8. refus conservé');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Write minimal implementation** — points clés de `20260920103000_award_gain.sql` :

```sql
CREATE OR REPLACE FUNCTION public.award_progression_gain(
  p_user_id UUID, p_action_type TEXT, p_source_type TEXT, p_source_id TEXT,
  p_effective_at TIMESTAMPTZ, p_points_total INTEGER, p_weights JSONB,
  p_explanation TEXT, p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key TEXT := p_source_type || ':' || p_source_id;
  v_rules RECORD; v_decision RECORD; v_tx_id UUID; v_season TEXT; v_season_status TEXT;
  v_outcome TEXT := 'awarded'; v_reason TEXT;
  v_w_explorer NUMERIC; v_w_preparer NUMERIC; v_w_partager NUMERIC; v_w_entraider NUMERIC;
  v_p_explorer INT; v_p_preparer INT; v_p_partager INT; v_p_entraider INT; v_rest INT;
  v_alloc JSONB; v_grace INTERVAL; v_daily INT; v_weekly INT; v_season_cap INT; v_count INT;
  v_frac JSONB := '[]'::jsonb; v_f RECORD; v_left INT;
BEGIN
  -- Identité : un appel porteur d'une session utilisateur ne peut viser un autre compte
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Identité non concordante';
  END IF;

  SELECT idempotency_key INTO v_decision.idempotency_key FROM public.progression_decisions WHERE idempotency_key = v_key;

  SELECT * INTO v_rules FROM public.progression_rules WHERE active;
  v_grace := (COALESCE((v_rules.payload->>'grace_days')::int, 14) || ' days')::interval;

  -- Contrôles d'éligibilité
  IF v_rules.payload->'actions'->p_action_type IS NULL THEN
    v_outcome := 'refused'; v_reason := 'action_non_autorisee';
  ELSIF p_points_total IS NULL OR p_points_total <= 0 THEN
    v_outcome := 'refused'; v_reason := 'gain_non_positif';
  ELSE
    v_w_explorer := COALESCE((p_weights->>'explorer')::numeric, -1);
    v_w_preparer := COALESCE((p_weights->>'preparer')::numeric, -1);
    v_w_partager := COALESCE((p_weights->>'partager')::numeric, -1);
    v_w_entraider := COALESCE((p_weights->>'entraider')::numeric, -1);
    IF v_w_explorer < 0 OR v_w_preparer < 0 OR v_w_partager < 0 OR v_w_entraider < 0
       OR ABS((v_w_explorer+v_w_preparer+v_w_partager+v_w_entraider) - 1) > 0.0001 THEN
      v_outcome := 'refused'; v_reason := 'poids_invalides';
    END IF;
  END IF;

  -- Saison : fenêtre de la date effective, grâce, politique tardive
  IF v_outcome <> 'refused' THEN
    SELECT s.id, s.status INTO v_season, v_season_status FROM public.progression_seasons s
      WHERE p_effective_at >= s.starts_at AND p_effective_at <= s.ends_at ORDER BY s.starts_at DESC LIMIT 1;
    IF v_season IS NOT NULL AND v_season_status = 'completed'
       AND now() > (SELECT ends_at + v_grace FROM public.progression_seasons WHERE id = v_season) THEN
      IF COALESCE(v_rules.payload->>'late_policy','refuse') = 'refuse' THEN
        v_outcome := 'refused'; v_reason := 'hors_delai';
      ELSE
        v_outcome := 'awarded_lifetime_only'; v_season := NULL;
      END IF;
    ELSIF v_season IS NULL THEN
      v_outcome := 'awarded_lifetime_only';
    END IF;
  END IF;

  -- Plafonds quotidien / hebdomadaire / saison
  IF v_outcome <> 'refused' THEN
    v_daily := (v_rules.payload->'actions'->p_action_type->'caps'->>'daily')::int;
    v_weekly := (v_rules.payload->'actions'->p_action_type->'caps'->>'weekly')::int;
    v_season_cap := (v_rules.payload->'actions'->p_action_type->'caps'->>'season')::int;
    IF v_daily IS NOT NULL THEN
      SELECT COUNT(*) INTO v_count FROM public.progression_decisions d
        WHERE d.user_id=p_user_id AND d.action_type=p_action_type AND d.outcome='awarded'
          AND d.effective_at > now() - interval '1 day';
      IF v_count >= v_daily THEN v_outcome := 'refused'; v_reason := 'plafond_quotidien'; END IF;
    END IF;
    IF v_outcome <> 'refused' AND v_weekly IS NOT NULL THEN
      SELECT COUNT(*) INTO v_count FROM public.progression_decisions d
        WHERE d.user_id=p_user_id AND d.action_type=p_action_type AND d.outcome='awarded'
          AND d.effective_at > now() - interval '7 days';
      IF v_count >= v_weekly THEN v_outcome := 'refused'; v_reason := 'plafond_hebdomadaire'; END IF;
    END IF;
    IF v_outcome <> 'refused' AND v_season_cap IS NOT NULL AND v_season IS NOT NULL THEN
      SELECT COUNT(*) INTO v_count FROM public.progression_decisions d
        WHERE d.user_id=p_user_id AND d.action_type=p_action_type AND d.outcome='awarded'
          AND d.effective_at >= (SELECT starts_at FROM public.progression_seasons WHERE id=v_season)
          AND d.effective_at <= (SELECT ends_at FROM public.progression_seasons WHERE id=v_season);
      IF v_count >= v_season_cap THEN v_outcome := 'refused'; v_reason := 'plafond_saison'; END IF;
    END IF;
  END IF;

  -- Décision (idempotente) : le premier appel gagne, les suivants lisent la décision existante
  INSERT INTO public.progression_decisions (idempotency_key,user_id,action_type,source_type,source_id,outcome,reason,rules_version,effective_at)
  VALUES (v_key,p_user_id,p_action_type,p_source_type,p_source_id,v_outcome,v_reason,COALESCE(v_rules.version,'v1'),p_effective_at)
  ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO v_decision FROM public.progression_decisions WHERE idempotency_key=v_key;
    RETURN jsonb_build_object('success', v_decision.outcome IN ('awarded','awarded_lifetime_only'),
      'outcome', v_decision.outcome, 'reason', v_decision.reason,
      'idempotencyKey', v_key, 'idempotent', true, 'rewardTransactionId', v_decision.reward_transaction_id);
  END IF;

  IF v_outcome = 'refused' THEN
    RETURN jsonb_build_object('success', false, 'outcome', 'refused', 'reason', v_reason, 'idempotencyKey', v_key);
  END IF;

  -- Ventilation déterministe (plus fort reste), ordre fixe des compétences
  v_p_explorer := FLOOR(p_points_total * v_w_explorer);
  v_p_preparer := FLOOR(p_points_total * v_w_preparer);
  v_p_partager := FLOOR(p_points_total * v_w_partager);
  v_p_entraider := FLOOR(p_points_total * v_w_entraider);
  v_rest := p_points_total - (v_p_explorer+v_p_preparer+v_p_partager+v_p_entraider);
  v_frac := jsonb_build_array(
    jsonb_build_object('k','explorer','r',(p_points_total*v_w_explorer)-v_p_explorer),
    jsonb_build_object('k','preparer','r',(p_points_total*v_w_preparer)-v_p_preparer),
    jsonb_build_object('k','partager','r',(p_points_total*v_w_partager)-v_p_partager),
    jsonb_build_object('k','entraider','r',(p_points_total*v_w_entraider)-v_p_entraider));
  FOR v_f IN SELECT value->>'k' AS k FROM jsonb_array_elements(v_frac) ORDER BY (value->>'r')::numeric DESC, value->>'k' LOOP
    EXIT WHEN v_rest <= 0;
    IF v_f.k = 'explorer' THEN v_p_explorer := v_p_explorer + 1;
    ELSIF v_f.k = 'preparer' THEN v_p_preparer := v_p_preparer + 1;
    ELSIF v_f.k = 'partager' THEN v_p_partager := v_p_partager + 1;
    ELSE v_p_entraider := v_p_entraider + 1; END IF;
    v_rest := v_rest - 1;
  END LOOP;
  v_alloc := jsonb_build_array(
    jsonb_build_object('skill','explorer','weight',v_w_explorer,'points',v_p_explorer),
    jsonb_build_object('skill','preparer','weight',v_w_preparer,'points',v_p_preparer),
    jsonb_build_object('skill','partager','weight',v_w_partager,'points',v_p_partager),
    jsonb_build_object('skill','entraider','weight',v_w_entraider,'points',v_p_entraider));

  INSERT INTO public.reward_transactions
    (user_id, points, transaction_type, reference_type, metadata, idempotency_key, effective_at, season_id,
     rules_version, skill_allocations, counts_for_progression, affects_balance)
  VALUES (p_user_id, p_points_total, 'PROGRESSION_AWARD', p_source_type,
    COALESCE(p_metadata,'{}'::jsonb) || jsonb_build_object('action_type',p_action_type,'explanation',p_explanation,'source_id',p_source_id),
    v_key, p_effective_at, v_season, COALESCE(v_rules.version,'v1'), v_alloc, true, false)
  RETURNING id INTO v_tx_id;

  UPDATE public.progression_decisions SET reward_transaction_id=v_tx_id, outcome=v_outcome WHERE idempotency_key=v_key;
  RETURN jsonb_build_object('success',true,'outcome',v_outcome,'idempotencyKey',v_key,
    'points',p_points_total,'allocations',v_alloc,'rewardTransactionId',v_tx_id,'seasonId',v_season);
END; $$;

REVOKE ALL ON FUNCTION public.award_progression_gain(uuid,text,text,text,timestamptz,integer,jsonb,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_progression_gain(uuid,text,text,text,timestamptz,integer,jsonb,text,jsonb) TO service_role;
```

- [ ] **Step 4: Run to verify pass.** — Expected: 8/8 ok.
- [ ] **Step 5: Commit** — `git commit -am "feat(db): fonction d'attribution canonique idempotente"`

---

### Task 5: Consommateur d'outbox atomique et projections par saison

**Files:**
- Create: `supabase/migrations/20260920104000_outbox_consumer.sql`
- Create: `supabase/tests/database/progression_canonique_consumer.test.sql`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: `user_season_progress(user_id, season_id, season_points, skill_*_points, updated_at)` PK `(user_id, season_id)` ; colonnes ajoutées à `progression_events` ; `user_progression.current_season_id` ; `public.process_progression_outbox(p_limit integer default 50) returns jsonb` (`{processed, failed}`), service_role uniquement.

- [ ] **Step 1: Write the failing test**

```sql
BEGIN;
SET LOCAL search_path = public;
SELECT plan(9);
UPDATE public.progression_rules SET payload = jsonb_set(payload, '{actions}',
  '{"test_hike":{"caps":{"daily":5,"weekly":10,"season":20}}}'::jsonb) WHERE active;
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff','authenticated','authenticated','cons@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email)
VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff','Flo Consommateur','cons@test.local') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.reward_accounts (user_id) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff') ON CONFLICT DO NOTHING;

-- Attribution puis consommation
SELECT (public.award_progression_gain('ffffffff-ffff-ffff-ffff-ffffffffffff','test_hike','hike_session','c-1', now(), 40,
  '{"explorer":0.75,"preparer":0.25,"partager":0,"entraider":0}','Rando'))->>'outcome';
SELECT is((public.process_progression_outbox(10))->>'processed', '1', '1. un événement consommé');
SELECT is((SELECT lifetime_points FROM public.user_progression WHERE user_id='ffffffff-ffff-ffff-ffff-ffffffffffff'), 40, '2. cumul à vie = 40');
SELECT is((SELECT skill_explorer_points FROM public.user_progression WHERE user_id='ffffffff-ffff-ffff-ffff-ffffffffffff'), 30, '3. explorer = 30');
SELECT is((SELECT season_points FROM public.user_season_progress s WHERE s.user_id='ffffffff-ffff-ffff-ffff-ffffffffffff'), 40, '4. points de saison = 40');
SELECT is((SELECT status FROM public.progression_outbox o JOIN public.reward_transactions t ON t.id=o.reward_transaction_id WHERE t.idempotency_key='hike_session:c-1'), 'processed', '5. outbox traitée');
SELECT is((SELECT count(*)::int FROM public.progression_events e JOIN public.reward_transactions t ON t.id=e.reward_transaction_id WHERE t.idempotency_key='hike_session:c-1'), 1, '6. journal de projection écrit');

-- Rejeu du consommateur → aucun double incrément
SELECT is((public.process_progression_outbox(10))->>'processed', '0', '7. rien à retraiter');
SELECT is((SELECT lifetime_points FROM public.user_progression WHERE user_id='ffffffff-ffff-ffff-ffff-ffffffffffff'), 40, '8. cumul inchangé');

-- Compensation négative via le même pipeline
INSERT INTO public.reward_transactions (user_id, points, transaction_type, idempotency_key, effective_at, season_id, rules_version, skill_allocations, counts_for_progression, affects_balance)
SELECT 'ffffffff-ffff-ffff-ffff-ffffffffffff', -40, 'FRAUD_REVERSAL', 'fraud_reversal:c-1', now(), season_id, 'v1',
  '[{"skill":"explorer","weight":0.75,"points":-30},{"skill":"preparer","weight":0.25,"points":-10},{"skill":"partager","weight":0,"points":0},{"skill":"entraider","weight":0,"points":0}]'::jsonb, true, false
FROM public.reward_transactions WHERE idempotency_key='hike_session:c-1';
SELECT (public.process_progression_outbox(10))->>'processed';
SELECT is((SELECT lifetime_points FROM public.user_progression WHERE user_id='ffffffff-ffff-ffff-ffff-ffffffffffff'), 0, '9. compensation appliquée sans négatif');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Write minimal implementation** (structure de `20260920104000_outbox_consumer.sql`) :

```sql
CREATE TABLE IF NOT EXISTS public.user_season_progress (
  user_id UUID NOT NULL,
  season_id TEXT NOT NULL REFERENCES public.progression_seasons(id),
  season_points INTEGER NOT NULL DEFAULT 0 CHECK (season_points >= 0),
  skill_explorer_points INTEGER NOT NULL DEFAULT 0 CHECK (skill_explorer_points >= 0),
  skill_preparer_points INTEGER NOT NULL DEFAULT 0 CHECK (skill_preparer_points >= 0),
  skill_partager_points INTEGER NOT NULL DEFAULT 0 CHECK (skill_partager_points >= 0),
  skill_entraider_points INTEGER NOT NULL DEFAULT 0 CHECK (skill_entraider_points >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, season_id)
);
ALTER TABLE public.user_season_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_season_progress FROM anon, authenticated;

ALTER TABLE public.progression_events
  ADD COLUMN IF NOT EXISTS reward_transaction_id UUID UNIQUE REFERENCES public.reward_transactions(id),
  ADD COLUMN IF NOT EXISTS effective_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rules_version TEXT,
  ADD COLUMN IF NOT EXISTS skill_allocations JSONB;
ALTER TABLE public.progression_events ALTER COLUMN season_id DROP NOT NULL;

ALTER TABLE public.user_progression ADD COLUMN IF NOT EXISTS current_season_id TEXT;

CREATE OR REPLACE FUNCTION public.process_progression_outbox(p_limit INTEGER DEFAULT 50)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row RECORD; v_processed INT := 0; v_failed INT := 0;
  v_active_season TEXT; v_alloc JSONB;
  v_p_explorer INT; v_p_preparer INT; v_p_partager INT; v_p_entraider INT;
  v_w_explorer NUMERIC; v_w_preparer NUMERIC; v_w_partager NUMERIC; v_w_entraider NUMERIC;
  v_abs INT;
BEGIN
  SELECT id INTO v_active_season FROM public.progression_seasons WHERE status='active' LIMIT 1;
  FOR v_row IN
    SELECT o.id AS outbox_id, o.attempts, t.*
    FROM public.progression_outbox o JOIN public.reward_transactions t ON t.id = o.reward_transaction_id
    WHERE o.status IN ('pending','failed') AND o.available_at <= now()
    ORDER BY o.created_at LIMIT p_limit FOR UPDATE OF o SKIP LOCKED
  LOOP
    BEGIN
      UPDATE public.progression_outbox SET status='processing', locked_at=now(), attempts=v_row.attempts+1 WHERE id=v_row.outbox_id;
      IF EXISTS (SELECT 1 FROM public.progression_events WHERE reward_transaction_id = v_row.id) THEN
        UPDATE public.progression_outbox SET status='processed', processed_at=now(), last_error=NULL WHERE id=v_row.outbox_id;
        CONTINUE;
      END IF;
      v_alloc := v_row.skill_allocations;
      v_p_explorer := COALESCE((SELECT (e->>'points')::int FROM jsonb_array_elements(v_alloc) e WHERE e->>'skill'='explorer'),0);
      v_p_preparer := COALESCE((SELECT (e->>'points')::int FROM jsonb_array_elements(v_alloc) e WHERE e->>'skill'='preparer'),0);
      v_p_partager := COALESCE((SELECT (e->>'points')::int FROM jsonb_array_elements(v_alloc) e WHERE e->>'skill'='partager'),0);
      v_p_entraider := COALESCE((SELECT (e->>'points')::int FROM jsonb_array_elements(v_alloc) e WHERE e->>'skill'='entraider'),0);
      v_abs := GREATEST(1, ABS(v_row.points));
      v_w_explorer := ABS(v_p_explorer)::numeric / v_abs; v_w_preparer := ABS(v_p_preparer)::numeric / v_abs;
      v_w_partager := ABS(v_p_partager)::numeric / v_abs; v_w_entraider := ABS(v_p_entraider)::numeric / v_abs;

      INSERT INTO public.progression_events (idempotency_key,user_id,season_id,action_type,points_total,
        weight_explorer,weight_preparer,weight_partager,weight_entraider,explanation,
        reward_transaction_id,effective_at,rules_version,skill_allocations)
      VALUES ('reward_tx:'||v_row.id, v_row.user_id, v_row.season_id,
        COALESCE(v_row.metadata->>'action_type','gain'), v_row.points,
        v_w_explorer,v_w_preparer,v_w_partager,v_w_entraider,
        COALESCE(v_row.metadata->>'explanation','Gain validé'),
        v_row.id, COALESCE(v_row.effective_at,v_row.created_at), v_row.rules_version, v_alloc);

      INSERT INTO public.user_progression (user_id,lifetime_points,season_points,level,level_title,
        skill_explorer_points,skill_preparer_points,skill_partager_points,skill_entraider_points,current_season_id,updated_at)
      SELECT v_row.user_id, GREATEST(0,v_row.points),
        CASE WHEN v_row.season_id = v_active_season THEN GREATEST(0,v_row.points) ELSE 0 END,
        lv.level, lv.level_title,
        GREATEST(0,v_p_explorer),GREATEST(0,v_p_preparer),GREATEST(0,v_p_partager),GREATEST(0,v_p_entraider),
        CASE WHEN v_row.season_id = v_active_season THEN v_active_season ELSE NULL END, now()
      FROM public.progression_level_for(GREATEST(0,v_row.points)) lv
      ON CONFLICT (user_id) DO UPDATE SET
        lifetime_points = GREATEST(0, public.user_progression.lifetime_points + v_row.points),
        season_points = CASE WHEN v_row.season_id = v_active_season
          THEN GREATEST(0, public.user_progression.season_points + v_row.points)
          ELSE public.user_progression.season_points END,
        skill_explorer_points = GREATEST(0, public.user_progression.skill_explorer_points + v_p_explorer),
        skill_preparer_points = GREATEST(0, public.user_progression.skill_preparer_points + v_p_preparer),
        skill_partager_points = GREATEST(0, public.user_progression.skill_partager_points + v_p_partager),
        skill_entraider_points = GREATEST(0, public.user_progression.skill_entraider_points + v_p_entraider),
        current_season_id = COALESCE(CASE WHEN v_row.season_id = v_active_season THEN v_active_season END, public.user_progression.current_season_id),
        updated_at = now();

      IF v_row.season_id IS NOT NULL THEN
        INSERT INTO public.user_season_progress (user_id,season_id,season_points,skill_explorer_points,skill_preparer_points,skill_partager_points,skill_entraider_points,updated_at)
        VALUES (v_row.user_id,v_row.season_id,GREATEST(0,v_row.points),GREATEST(0,v_p_explorer),GREATEST(0,v_p_preparer),GREATEST(0,v_p_partager),GREATEST(0,v_p_entraider),now())
        ON CONFLICT (user_id,season_id) DO UPDATE SET
          season_points = GREATEST(0, public.user_season_progress.season_points + v_row.points),
          skill_explorer_points = GREATEST(0, public.user_season_progress.skill_explorer_points + v_p_explorer),
          skill_preparer_points = GREATEST(0, public.user_season_progress.skill_preparer_points + v_p_preparer),
          skill_partager_points = GREATEST(0, public.user_season_progress.skill_partager_points + v_p_partager),
          skill_entraider_points = GREATEST(0, public.user_season_progress.skill_entraider_points + v_p_entraider),
          updated_at = now();
      END IF;

      UPDATE public.user_progression up SET level = lv.level, level_title = lv.level_title
      FROM public.progression_level_for(up.lifetime_points) lv WHERE up.user_id = v_row.user_id;

      UPDATE public.progression_outbox SET status='processed', processed_at=now(), last_error=NULL, locked_at=NULL WHERE id=v_row.outbox_id;
      v_processed := v_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.progression_outbox
      SET status = CASE WHEN v_row.attempts + 1 >= 5 THEN 'dead' ELSE 'failed' END,
          last_error = SQLERRM, locked_at = NULL,
          available_at = now() + (interval '1 minute' * power(2, LEAST(v_row.attempts + 1, 6)))
      WHERE id = v_row.outbox_id;
      v_failed := v_failed + 1;
    END;
  END LOOP;
  RETURN jsonb_build_object('processed', v_processed, 'failed', v_failed);
END; $$;

REVOKE ALL ON FUNCTION public.process_progression_outbox(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_progression_outbox(integer) TO service_role;
```

- [ ] **Step 4: Run to verify pass.** — Expected: 9/9 ok.
- [ ] **Step 5: Commit** — `git commit -am "feat(db): consommateur outbox atomique et projections par saison"`

---

### Task 6: Reconstruction et compensation canonique

**Files:**
- Create: `supabase/migrations/20260920105000_rebuild_fraud.sql`
- Create: `supabase/tests/database/progression_canonique_rebuild.test.sql`

**Interfaces:**
- Produces: `public.rebuild_progression_from_ledger(p_user_id uuid) returns jsonb` ; `public.reverse_progression_fraud_canonical(p_original_transaction_id uuid, p_reason text) returns jsonb` ; les deux `service_role` uniquement.

- [ ] **Step 1: Write the failing test (extrait)**

```sql
BEGIN;
SET LOCAL search_path = public;
SELECT plan(5);
-- (fixture utilisateur comme Task 5, attribution 40 + consommation)
-- 1. Sabotage de la projection puis rebuild → retour au ledger
UPDATE public.user_progression SET lifetime_points = 999, skill_explorer_points = 999 WHERE user_id='ffffffff-ffff-ffff-ffff-ffffffffffff';
SELECT is((public.rebuild_progression_from_ledger('ffffffff-ffff-ffff-ffff-ffffffffffff'))->>'success','true','1. rebuild exécuté');
SELECT is((SELECT lifetime_points FROM public.user_progression WHERE user_id='ffffffff-ffff-ffff-ffff-ffffffffffff'), 40, '2. cumul reconstruit depuis le ledger');
-- 2. Compensation canonique
SELECT is((public.reverse_progression_fraud_canonical((SELECT id FROM public.reward_transactions WHERE idempotency_key='hike_session:c-1'),'test fraude'))->>'success','true','3. compensation créée');
SELECT is((public.process_progression_outbox(10))->>'processed','1','4. compensation consommée');
SELECT is((SELECT lifetime_points FROM public.user_progression WHERE user_id='ffffffff-ffff-ffff-ffff-ffffffffffff'), 0, '5. niveau/points corrigés sans réécriture d''historique');
SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Write minimal implementation**

```sql
CREATE OR REPLACE FUNCTION public.rebuild_progression_from_ledger(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row RECORD; v_active TEXT; v_total INT; v_e INT; v_p INT; v_pa INT; v_en INT; v_lv RECORD;
BEGIN
  SELECT id INTO v_active FROM public.progression_seasons WHERE status='active' LIMIT 1;
  DELETE FROM public.user_season_progress WHERE user_id = p_user_id;
  DELETE FROM public.user_progression WHERE user_id = p_user_id;
  v_total := 0; v_e := 0; v_p := 0; v_pa := 0; v_en := 0;
  FOR v_row IN
    SELECT * FROM public.reward_transactions
    WHERE user_id = p_user_id AND counts_for_progression = true ORDER BY created_at, id
  LOOP
    v_e := v_e + COALESCE((SELECT (e->>'points')::int FROM jsonb_array_elements(v_row.skill_allocations) e WHERE e->>'skill'='explorer'),0);
    v_p := v_p + COALESCE((SELECT (e->>'points')::int FROM jsonb_array_elements(v_row.skill_allocations) e WHERE e->>'skill'='preparer'),0);
    v_pa := v_pa + COALESCE((SELECT (e->>'points')::int FROM jsonb_array_elements(v_row.skill_allocations) e WHERE e->>'skill'='partager'),0);
    v_en := v_en + COALESCE((SELECT (e->>'points')::int FROM jsonb_array_elements(v_row.skill_allocations) e WHERE e->>'skill'='entraider'),0);
    v_total := v_total + v_row.points;
    IF v_row.season_id IS NOT NULL THEN
      INSERT INTO public.user_season_progress (user_id,season_id,season_points,skill_explorer_points,skill_preparer_points,skill_partager_points,skill_entraider_points,updated_at)
      VALUES (p_user_id,v_row.season_id,GREATEST(0,v_row.points),GREATEST(0,COALESCE((SELECT (e->>'points')::int FROM jsonb_array_elements(v_row.skill_allocations) e WHERE e->>'skill'='explorer'),0)),
        GREATEST(0,COALESCE((SELECT (e->>'points')::int FROM jsonb_array_elements(v_row.skill_allocations) e WHERE e->>'skill'='preparer'),0)),
        GREATEST(0,COALESCE((SELECT (e->>'points')::int FROM jsonb_array_elements(v_row.skill_allocations) e WHERE e->>'skill'='partager'),0)),
        GREATEST(0,COALESCE((SELECT (e->>'points')::int FROM jsonb_array_elements(v_row.skill_allocations) e WHERE e->>'skill'='entraider'),0)),now())
      ON CONFLICT (user_id,season_id) DO UPDATE SET
        season_points = GREATEST(0, public.user_season_progress.season_points + v_row.points),
        skill_explorer_points = GREATEST(0, public.user_season_progress.skill_explorer_points + COALESCE((SELECT (e->>'points')::int FROM jsonb_array_elements(v_row.skill_allocations) e WHERE e->>'skill'='explorer'),0)),
        skill_preparer_points = GREATEST(0, public.user_season_progress.skill_preparer_points + COALESCE((SELECT (e->>'points')::int FROM jsonb_array_elements(v_row.skill_allocations) e WHERE e->>'skill'='preparer'),0)),
        skill_partager_points = GREATEST(0, public.user_season_progress.skill_partager_points + COALESCE((SELECT (e->>'points')::int FROM jsonb_array_elements(v_row.skill_allocations) e WHERE e->>'skill'='partager'),0)),
        skill_entraider_points = GREATEST(0, public.user_season_progress.skill_entraider_points + COALESCE((SELECT (e->>'points')::int FROM jsonb_array_elements(v_row.skill_allocations) e WHERE e->>'skill'='entraider'),0)),now();
    END IF;
  END LOOP;
  v_total := GREATEST(0, v_total);
  SELECT * INTO v_lv FROM public.progression_level_for(v_total);
  INSERT INTO public.user_progression (user_id,lifetime_points,season_points,level,level_title,
    skill_explorer_points,skill_preparer_points,skill_partager_points,skill_entraider_points,current_season_id)
  SELECT p_user_id, v_total,
    COALESCE((SELECT season_points FROM public.user_season_progress WHERE user_id=p_user_id AND season_id=v_active),0),
    v_lv.level, v_lv.level_title, GREATEST(0,v_e),GREATEST(0,v_p),GREATEST(0,v_pa),GREATEST(0,v_en), v_active;
  RETURN jsonb_build_object('success',true,'lifetimePoints',v_total,'replayed',true);
END; $$;

CREATE OR REPLACE FUNCTION public.reverse_progression_fraud_canonical(p_original_transaction_id UUID, p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_orig RECORD; v_key TEXT; v_alloc JSONB; v_existing UUID;
BEGIN
  SELECT * INTO v_orig FROM public.reward_transactions WHERE id = p_original_transaction_id AND counts_for_progression = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','original_introuvable'); END IF;
  v_key := 'fraud_reversal:' || p_original_transaction_id;
  SELECT id INTO v_existing FROM public.reward_transactions WHERE idempotency_key = v_key;
  IF v_existing IS NOT NULL THEN RETURN jsonb_build_object('success',true,'idempotent',true,'rewardTransactionId',v_existing); END IF;
  SELECT jsonb_agg(jsonb_build_object('skill', e->>'skill','weight', e->>'weight','points', -((e->>'points')::int)))
    INTO v_alloc FROM jsonb_array_elements(v_orig.skill_allocations) e;
  INSERT INTO public.reward_transactions (user_id, points, transaction_type, reference_id, reference_type, metadata,
    idempotency_key, effective_at, season_id, rules_version, skill_allocations, counts_for_progression, affects_balance)
  VALUES (v_orig.user_id, -v_orig.points, 'FRAUD_REVERSAL', v_orig.id, 'progression_correction',
    jsonb_build_object('reason', p_reason, 'original_transaction_id', v_orig.id),
    v_key, now(), v_orig.season_id, v_orig.rules_version, v_alloc, true, false)
  RETURNING id INTO v_existing;
  RETURN jsonb_build_object('success',true,'rewardTransactionId',v_existing);
END; $$;

REVOKE ALL ON FUNCTION public.rebuild_progression_from_ledger(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reverse_progression_fraud_canonical(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_progression_from_ledger(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reverse_progression_fraud_canonical(uuid,text) TO service_role;
```

- [ ] **Step 4: Run to verify pass.** — Expected: 5/5 ok.
- [ ] **Step 5: Commit** — `git commit -am "feat(db): rebuild depuis le ledger et compensation canonique"`

---

### Task 7: Sécurité des tables de progression et territoire privé

**Files:**
- Create: `supabase/migrations/20260920106000_progression_security.sql`
- Create: `supabase/tests/database/progression_canonique_security.test.sql`

**Interfaces:**
- Produces: suppression des policies dangereuses ; `user_territory` + `user_territory_private` (consentement, verrou) ; `apply_progression_points` et `reverse_progression_fraud` révoquées puis supprimées.

- [ ] **Step 1: Write the failing test**

```sql
BEGIN;
SET LOCAL search_path = public;
SELECT plan(6);
-- 1. Aucun client ne peut modifier ses points ni lire les coordonnées d'autrui
SELECT is((SELECT has_table_privilege('authenticated','public.user_progression','UPDATE')), false, '1. UPDATE user_progression révoqué');
SELECT is((SELECT has_table_privilege('authenticated','public.progression_events','SELECT')), false, '2. SELECT client révoqué sur progression_events');
SELECT is((SELECT count(*)::int FROM pg_policies WHERE tablename='user_progression' AND policyname='Public read user progression'), 0, '3. policy de lecture publique supprimée');
-- 2. Fonctions legacy inaccessibles
SELECT is((SELECT has_function_privilege('authenticated','public.apply_progression_points(uuid,text,text,integer,numeric,numeric,numeric,numeric,text)','EXECUTE')), false, '4. RPC legacy révoquée');
SELECT is((SELECT to_regclass('public.user_territory_private') IS NOT NULL), true, '5. table territoire privé créée');
SELECT is((SELECT has_table_privilege('authenticated','public.user_territory_private','SELECT')), false, '6. coordonnées privées inaccessibles au client');
SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Write minimal implementation**

```sql
-- Lecture/écriture cliente retirées des tables de progression : tout passe par des routes serveur
DROP POLICY IF EXISTS "Public read user progression" ON public.user_progression;
DROP POLICY IF EXISTS "Users update own territory" ON public.user_progression;
REVOKE ALL ON TABLE public.user_progression, public.progression_events, public.progression_decisions FROM anon, authenticated;

-- Fonctions legacy du moteur parallèle : révoquées et supprimées
REVOKE ALL ON FUNCTION public.apply_progression_points(uuid,text,text,integer,numeric,numeric,numeric,numeric,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reverse_progression_fraud(text,text) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.apply_progression_points(uuid,text,text,integer,numeric,numeric,numeric,numeric,text);
DROP FUNCTION IF EXISTS public.reverse_progression_fraud(text,text);

-- Territoire déclaré (identifiants stables) et rattachement privé (consentement + verrou)
CREATE TABLE IF NOT EXISTS public.user_territory (
  user_id UUID PRIMARY KEY,
  country_code TEXT NOT NULL DEFAULT 'FR',
  city_code TEXT, region_code TEXT, city_name TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','geocoded')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.user_territory_private (
  user_id UUID PRIMARY KEY,
  lat DOUBLE PRECISION NOT NULL, lng DOUBLE PRECISION NOT NULL, accuracy_m INTEGER,
  consent_at TIMESTAMPTZ NOT NULL, locked_until TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_territory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_territory_private ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_territory, public.user_territory_private FROM anon, authenticated;
CREATE POLICY "Users read own territory" ON public.user_territory FOR SELECT TO authenticated USING (auth.uid() = user_id);
```

- [ ] **Step 4: Run to verify pass.**
- [ ] **Step 5: Commit** — `git commit -am "feat(db): verrouillage sécurité progression et territoire privé"`

---

### Task 8: Service et routes honnêtes (zéro donnée de démo)

**Files:**
- Modify: `src/features/progression/domain/types.ts`, `src/features/progression/domain/rules.ts`
- Create: `src/features/progression/server/progressionDto.ts`
- Modify: `src/features/progression/server/progressionService.ts` (réécrit : suppression intégrale de `DEMO_*`, `user_demo_01`, Chamonix, `localRank` codé, `?? 380`, `?? 65 %`)
- Modify: `src/app/api/progression/route.ts`, `leaderboard/route.ts`, `territory/route.ts`, `challenge/replace/route.ts`
- Create: `tests/features/progression/canonicalDto.spec.ts`, `tests/features/progression/canonicalService.spec.ts`, `tests/features/progression/canonicalRoutes.spec.ts`

**Interfaces:**
- Produces: `getProgressionProfile(userId)` → `{ points: {lifetime, season, seasonId}, level: {level,title}, skills, challenge: null | {...}, leaderboardRank: null | number, updatedAt: null | string, hasData: boolean }` ; `getTerritorialLeaderboard(userId, filter)` → `{ rows: [], communityForming: boolean, refreshedAt: null, minParticipants: number }` (pas d'agrégat avant P3) ; routes : 401 anonyme, 501 `not_implemented_p3` pour territoire/remplacement.

- [ ] **Step 1: Write failing Vitest tests** — ex. `canonicalService.spec.ts` mocke le client Supabase et vérifie : profil vide → `hasData=false`, zéro point, rang `null`, aucun utilisateur démo ; classement vide → `rows=[]`, `refreshedAt=null` ; `canonicalRoutes.spec.ts` → 401 sans session, 501 sur les deux routes différées.
- [ ] **Step 2: Run** `npm test -- tests/features/progression` — Expected: FAIL.
- [ ] **Step 3: Implement** : réécrire le service sans aucun fallback inventé ; le profil lit `user_progression` + `user_season_progress` + `reward_accounts` (solde utilisable) via le client serveur **service role** (tableaux non lisibles par les clients) ; le classement lit `progression_leaderboard_agg` (table créée en P3, requête tolérante à son absence → `rows=[]`).
- [ ] **Step 4: Run** tests + `npm run type-check` — Expected: PASS, 0 erreur.
- [ ] **Step 5: Commit** — `git commit -am "feat(progression): service et routes honnêtes sans données de démonstration"`

---

### Task 9: Cron de consommation d'outbox et healthcheck

**Files:**
- Create: `src/app/api/cron/progression-outbox/route.ts`
- Create: `tests/features/progression/progressionOutboxCron.spec.ts`
- Create: `scripts/ops/progression_outbox_health.mjs`

**Interfaces:**
- Consumes: RPC `process_progression_outbox`.
- Produces: `POST/GET /api/cron/progression-outbox` protégé par `CRON_SECRET` (comme `process-hike-sessions`), appelle la RPC avec `service_role`, renvoie `{processed, failed}` ; script de santé comptant `pending`, `failed`, `dead` et le retard max.

- [ ] **Step 1: Test Vitest** : sans `Authorization: Bearer <CRON_SECRET>` → 401 et aucun appel RPC ; avec → appelle `process_progression_outbox`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** en copiant le pattern exact de `src/app/api/cron/process-hike-sessions/route.ts` (env `CRON_SECRET`, `createServiceClient`).
- [ ] **Step 4: Run** tests + `npm run lint`.
- [ ] **Step 5: Commit** — `git commit -am "feat(progression): cron de consommation d'outbox et sonde de santé"`

---

### Task 10: Matrice producteurs et documentation d'exploitation

**Files:**
- Create: `docs/progression/PRODUCER_MATRIX.md` (matrice `action → source → validation → gain → répartition → plafond → test`, statuts prêts/à compléter/désactivés avec dépendances)
- Create: `docs/progression/LOCAL_DB_TESTING.md` (procédure conteneur + baseline + pgTAP éprouvée)
- Modify: `docs/progression/LAUNCH_READINESS.md` (créé en P7, squelette ici)

- [ ] **Step 1: Rédiger les trois documents** en reprenant strictement le spec (§3) et la procédure réellement exécutée.
- [ ] **Step 2: Vérifier** que chaque producteur désactivé liste précisément ce qui manque.
- [ ] **Step 3: Commit** — `git commit -am "docs(progression): matrice producteurs, procédure DB locale et squelette lancement"`

---

## Self-review du plan

- **Couverture du spec** : §2.1→T1, §2.2→T3, §2.3→T2/T5/T9, §2.4→T5/T6, §2.5→T4, §2.6→T3, §2.7→T7, §2.8→T8/T10 ; §3.4 est repris par T10 et appliqué en P2. Le rayon 1 km et les agrégats sont explicitement renvoyés en P3 (routes 501 en attendant).
- **Placeholders** : aucun TBD ; les tâches 8–10 décrivent l'implémentation attendue sans coller l'intégralité du code, car les signatures exactes des modules existants sont fournies en Interfaces et le code suit les patterns du dépôt.
- **Cohérence des types** : `outcome` (T3/T4), `skill_allocations` (T1/T4/T5/T6), `reward_transaction_id` (T5), `process_progression_outbox` (T5/T9), `rebuild_progression_from_ledger` et `reverse_progression_fraud_canonical` (T6/T8) sont nommés identiquement partout.
- **Points de vigilance relevés pendant la rédaction** : (a) la migration 20260919 doit être appliquée avant 20260920* ; (b) les tests pgTAP écrivent des fixtures `auth.users` — le baseline local fournit `auth.users` et `auth.uid()` ; (c) `progression_decisions.effective_at` est utilisé par les plafonds de T4.
