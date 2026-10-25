-- ============================================================================
-- 20261025120000_rewards_points_v1 — Récompenses LKDV : points, objectif,
-- catalogue financé, échanges atomiques. Migration ADDITIVE.
--
-- Dossier : docs/research/2026-10-25-recompenses-lkdv/ (PLAN-IMPLEMENTATION.md,
-- AUDIT-RECONCILIATION.md, LIVRAISON.md).
--
-- Principes :
--   * L'unité grand public « points » = journal `loyalty_history` (solde =
--     SUM(points), déjà canonique, synchronisé par `sync_loyalty_points`).
--     Les XP, parts économiques (`reward_accounts`) et crédits créateur restent
--     des unités distinctes, jamais additionnées.
--   * Aucune émission nouvelle n'est ouverte : `points_program.emission_open`
--     vaut false, chaque producteur est fermé, et l'émission sociale legacy
--     (`claim_reward_points`) est coupée par `kill_switches.rewards_active`.
--     Le droit de retrait cash déjà acquis (`cashout_active`) est conservé.
--   * Un objet n'est réclamable que s'il est financé, chiffré et en stock
--     déclaré (`reward_catalog_funding`, privé). Aucun stock n'est inventé :
--     toutes les lignes existantes partent `unfunded`.
--   * Aucune ligne de journal n'est supprimée ni modifiée. Les compensations
--     sont des écritures inverses idempotentes. Une dépense ne retire jamais
--     d'XP.
--   * Écritures exclusivement par fonctions SECURITY DEFINER (search_path
--     verrouillé, EXECUTE au seul service_role) ; verrou `user_profiles …
--     FOR UPDATE`, le même que les fonctions `legacy_loyalty_*`, pour
--     sérialiser quotas, dépenses et compensations d'un même membre.
-- ============================================================================

-- ── 0. Idempotence du journal fidélité garantie en base ─────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.loyalty_history
    WHERE source_id IS NOT NULL
    GROUP BY user_id, source_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'loyalty_history : doublons (user_id, source_id) — réconcilier avant cette migration';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_history_user_source_uniq
  ON public.loyalty_history (user_id, source_id)
  WHERE source_id IS NOT NULL;

-- ── 1. Émission sociale legacy fermée (like, message, carnet, commentaire…) ─
-- `claim_reward_points` lit `COALESCE(rewards_active, true)` : la clé doit
-- exister et valoir false. `cashout_active` n'est pas modifié (droits acquis).
INSERT INTO public.reward_config (key, value, description)
VALUES (
  'kill_switches',
  '{"rewards_active": false, "cashout_active": true}'::jsonb,
  'Interrupteurs du programme économique legacy'
)
ON CONFLICT (key) DO UPDATE
  SET value = public.reward_config.value || '{"rewards_active": false}'::jsonb,
      updated_at = now();

-- ── 2. Contrat du programme de points (fermé) ───────────────────────────────
-- Barème pilote C du dossier de recherche (05-proposition-et-validation.md) :
-- hypothèse à tester, non publiée. Chaque producteur reste fermé tant que sa
-- preuve serveur et son financement ne sont pas démontrés. ON CONFLICT DO
-- NOTHING : une configuration déjà décidée n'est jamais écrasée.
INSERT INTO public.reward_config (key, value, description)
VALUES (
  'points_program',
  '{
    "version": "pilote-c-2026-10",
    "emission_open": false,
    "closure_reason": "Financement et conditions des nouveaux gains non démontrés",
    "weekly_cap": 250,
    "rules": {
      "activity_validated": {"label": "Sortie validée", "points": 50, "weekly_limit": 3, "producer_open": false, "requires_review": false},
      "useful_story": {"label": "Récit utile", "points": 25, "weekly_limit": 2, "producer_open": false, "requires_review": true},
      "help_accepted": {"label": "Aide acceptée", "points": 25, "weekly_limit": 2, "producer_open": false, "requires_review": true},
      "preparation_done": {"label": "Préparation terminée", "points": 10, "weekly_limit": 1, "producer_open": false, "requires_review": false}
    }
  }'::jsonb,
  'Programme points LKDV : barème, plafonds, ouverture. Fermé par défaut.'
)
ON CONFLICT (key) DO NOTHING;

-- ── 3. Catalogue : conditions publiques + financement privé ─────────────────
ALTER TABLE public.loyalty_rewards
  ADD COLUMN IF NOT EXISTS fulfillment text,
  ADD COLUMN IF NOT EXISTS terms text,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS partner_disclosure text,
  ADD COLUMN IF NOT EXISTS cash_complement_cents integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_rewards_fulfillment_check') THEN
    ALTER TABLE public.loyalty_rewards ADD CONSTRAINT loyalty_rewards_fulfillment_check
      CHECK (fulfillment IS NULL OR fulfillment IN ('physical', 'voucher', 'service', 'digital'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_rewards_cash_complement_check') THEN
    ALTER TABLE public.loyalty_rewards ADD CONSTRAINT loyalty_rewards_cash_complement_check
      CHECK (cash_complement_cents >= 0);
  END IF;
END $$;

-- Coût rendu, financeur et stock : données internes, jamais lisibles par
-- anon/authenticated (la table `loyalty_rewards` est en lecture publique).
CREATE TABLE IF NOT EXISTS public.reward_catalog_funding (
  reward_id uuid PRIMARY KEY REFERENCES public.loyalty_rewards(id) ON DELETE CASCADE,
  funding_status text NOT NULL DEFAULT 'unfunded'
    CHECK (funding_status IN ('unfunded', 'funded', 'suspended')),
  cost_cents integer CHECK (cost_cents IS NULL OR cost_cents >= 0),
  funder text CHECK (funder IS NULL OR char_length(funder) BETWEEN 1 AND 200),
  stock_remaining integer CHECK (stock_remaining IS NULL OR stock_remaining >= 0),
  budget_reference text CHECK (budget_reference IS NULL OR char_length(budget_reference) BETWEEN 1 AND 200),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  -- « Financé » exige un coût, un financeur, une référence budgétaire et un
  -- stock déclarés : la ligne ne peut pas être cochée à vide.
  CONSTRAINT reward_catalog_funding_complete CHECK (
    funding_status <> 'funded'
    OR (cost_cents IS NOT NULL AND funder IS NOT NULL AND budget_reference IS NOT NULL AND stock_remaining IS NOT NULL)
  )
);

ALTER TABLE public.reward_catalog_funding ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reward_catalog_funding FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.reward_catalog_funding TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.reward_catalog_funding TO authenticated;
DROP POLICY IF EXISTS reward_catalog_funding_admin ON public.reward_catalog_funding;
CREATE POLICY reward_catalog_funding_admin ON public.reward_catalog_funding
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

-- Chaque objet existant reçoit une ligne `unfunded` (aucun coût ni stock inventé).
INSERT INTO public.reward_catalog_funding (reward_id)
SELECT id FROM public.loyalty_rewards
ON CONFLICT (reward_id) DO NOTHING;

-- ── 4. Échanges : réservation, référence, idempotence, annulation ──────────
ALTER TABLE public.loyalty_redemptions
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS reserved_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_redemptions_status_check') THEN
    ALTER TABLE public.loyalty_redemptions ADD CONSTRAINT loyalty_redemptions_status_check
      CHECK (status IN ('completed', 'fulfilled', 'reserved', 'shipped', 'cancelled'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_redemptions_user_idem_uniq
  ON public.loyalty_redemptions (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ── 5. Objectif choisi (choisir ne dépense rien) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.reward_goals (
  user_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES public.loyalty_rewards(id) ON DELETE CASCADE,
  chosen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reward_goals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reward_goals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.reward_goals TO authenticated;
GRANT ALL ON public.reward_goals TO service_role;
DROP POLICY IF EXISTS reward_goals_read_own ON public.reward_goals;
CREATE POLICY reward_goals_read_own ON public.reward_goals
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ── 6. Décisions d'attribution du programme ─────────────────────────────────
-- Une seule décision par (membre, règle, source), quelle que soit la version
-- du barème : un même fait ne peut pas être réclamé deux fois.
CREATE TABLE IF NOT EXISTS public.reward_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  rule_key text NOT NULL CHECK (rule_key ~ '^[a-z_]{3,40}$'),
  source_type text NOT NULL CHECK (source_type ~ '^[a-z_]{2,40}$'),
  source_id text NOT NULL CHECK (char_length(source_id) BETWEEN 1 AND 200),
  points integer NOT NULL CHECK (points >= 0),
  status text NOT NULL CHECK (status IN ('pending', 'confirmed', 'refused', 'reversed')),
  reason text CHECK (reason IS NULL OR char_length(reason) <= 300),
  rules_version text NOT NULL,
  period_start date NOT NULL,
  history_id uuid REFERENCES public.loyalty_history(id) ON DELETE SET NULL,
  reversal_history_id uuid REFERENCES public.loyalty_history(id) ON DELETE SET NULL,
  reversal_shortfall integer NOT NULL DEFAULT 0 CHECK (reversal_shortfall >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CONSTRAINT reward_awards_one_decision UNIQUE (user_id, rule_key, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS reward_awards_user_period_idx
  ON public.reward_awards (user_id, period_start, status);

ALTER TABLE public.reward_awards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reward_awards FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.reward_awards TO authenticated;
GRANT ALL ON public.reward_awards TO service_role;
DROP POLICY IF EXISTS reward_awards_read_own ON public.reward_awards;
CREATE POLICY reward_awards_read_own ON public.reward_awards
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ── 7. Fonctions ────────────────────────────────────────────────────────────

-- Configuration lue fail-closed : absente ou illisible = programme fermé.
CREATE OR REPLACE FUNCTION public.rewards_program_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT value FROM public.reward_config WHERE key = 'points_program' AND jsonb_typeof(value) = 'object'),
    '{"version": "absent", "emission_open": false, "weekly_cap": 0, "rules": {}}'::jsonb
  );
$$;

-- Semaine civile Europe/Paris (lundi) : base des plafonds hebdomadaires.
CREATE OR REPLACE FUNCTION public.rewards_period_start(p_at timestamptz DEFAULT now())
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT date_trunc('week', p_at AT TIME ZONE 'Europe/Paris')::date;
$$;

-- Attribution : gain entier ou rien, une décision par fait, sous verrou membre.
CREATE OR REPLACE FUNCTION public.rewards_award_points(
  p_user_id uuid,
  p_rule_key text,
  p_source_type text,
  p_source_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cfg jsonb;
  v_rule jsonb;
  v_points integer;
  v_limit integer;
  v_cap integer;
  v_period date;
  v_used integer;
  v_rule_count integer;
  v_existing public.reward_awards%ROWTYPE;
  v_award_id uuid;
  v_history_id uuid;
  v_balance integer;
  v_version text;
BEGIN
  IF p_user_id IS NULL
     OR p_rule_key IS NULL OR p_rule_key !~ '^[a-z_]{3,40}$'
     OR p_source_type IS NULL OR p_source_type !~ '^[a-z_]{2,40}$'
     OR p_source_id IS NULL OR char_length(p_source_id) NOT BETWEEN 1 AND 200 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  v_cfg := public.rewards_program_config();
  v_rule := v_cfg -> 'rules' -> p_rule_key;
  IF v_rule IS NULL OR jsonb_typeof(v_rule) <> 'object' THEN
    RETURN jsonb_build_object('success', false, 'error', 'unknown_rule');
  END IF;

  PERFORM 1 FROM public.user_profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;

  SELECT * INTO v_existing
  FROM public.reward_awards
  WHERE user_id = p_user_id AND rule_key = p_rule_key
    AND source_type = p_source_type AND source_id = p_source_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true, 'status', 'duplicate', 'award_id', v_existing.id,
      'award_status', v_existing.status, 'points', v_existing.points
    );
  END IF;

  IF COALESCE((v_cfg ->> 'emission_open')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'emission_closed');
  END IF;
  IF COALESCE((v_rule ->> 'producer_open')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'producer_closed');
  END IF;

  v_points := (v_rule ->> 'points')::integer;
  v_limit := (v_rule ->> 'weekly_limit')::integer;
  v_cap := (v_cfg ->> 'weekly_cap')::integer;
  v_version := COALESCE(v_cfg ->> 'version', 'inconnue');
  IF v_points IS NULL OR v_points <= 0 OR v_cap IS NULL OR v_cap <= 0 OR (v_limit IS NOT NULL AND v_limit < 0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_config');
  END IF;

  v_period := public.rewards_period_start(now());
  SELECT COALESCE(SUM(points), 0)::integer,
         (COUNT(*) FILTER (WHERE rule_key = p_rule_key))::integer
    INTO v_used, v_rule_count
  FROM public.reward_awards
  WHERE user_id = p_user_id AND period_start = v_period
    AND status IN ('pending', 'confirmed');

  IF v_limit IS NOT NULL AND v_rule_count >= v_limit THEN
    INSERT INTO public.reward_awards (user_id, rule_key, source_type, source_id, points, status, reason, rules_version, period_start, decided_at)
    VALUES (p_user_id, p_rule_key, p_source_type, p_source_id, v_points, 'refused', 'rule_limit', v_version, v_period, now())
    RETURNING id INTO v_award_id;
    RETURN jsonb_build_object('success', true, 'status', 'refused', 'reason', 'rule_limit', 'award_id', v_award_id, 'points', 0);
  END IF;

  IF v_used + v_points > v_cap THEN
    INSERT INTO public.reward_awards (user_id, rule_key, source_type, source_id, points, status, reason, rules_version, period_start, decided_at)
    VALUES (p_user_id, p_rule_key, p_source_type, p_source_id, v_points, 'refused', 'weekly_cap', v_version, v_period, now())
    RETURNING id INTO v_award_id;
    RETURN jsonb_build_object('success', true, 'status', 'refused', 'reason', 'weekly_cap', 'award_id', v_award_id, 'points', 0,
                              'week_remaining', GREATEST(0, v_cap - v_used));
  END IF;

  IF COALESCE((v_rule ->> 'requires_review')::boolean, false) THEN
    INSERT INTO public.reward_awards (user_id, rule_key, source_type, source_id, points, status, rules_version, period_start)
    VALUES (p_user_id, p_rule_key, p_source_type, p_source_id, v_points, 'pending', v_version, v_period)
    RETURNING id INTO v_award_id;
    RETURN jsonb_build_object('success', true, 'status', 'pending', 'award_id', v_award_id, 'points', v_points,
                              'week_remaining', v_cap - v_used - v_points);
  END IF;

  INSERT INTO public.reward_awards (user_id, rule_key, source_type, source_id, points, status, rules_version, period_start, decided_at)
  VALUES (p_user_id, p_rule_key, p_source_type, p_source_id, v_points, 'confirmed', v_version, v_period, now())
  RETURNING id INTO v_award_id;

  INSERT INTO public.loyalty_history (user_id, action, points, type, source_id)
  VALUES (p_user_id, COALESCE(v_rule ->> 'label', 'Gain'), v_points, 'award', 'award:' || v_award_id)
  RETURNING id INTO v_history_id;

  UPDATE public.reward_awards SET history_id = v_history_id WHERE id = v_award_id;

  SELECT COALESCE(SUM(points), 0)::integer INTO v_balance FROM public.loyalty_history WHERE user_id = p_user_id;
  UPDATE public.user_profiles SET loyalty_level = public.legacy_loyalty_level_for(v_balance), updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'status', 'confirmed', 'award_id', v_award_id, 'points', v_points,
                            'balance', v_balance, 'week_remaining', v_cap - v_used - v_points);
END;
$$;

-- Décision d'une attribution en vérification (contrôle humain).
CREATE OR REPLACE FUNCTION public.rewards_decide_award(
  p_award_id uuid,
  p_approve boolean,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid;
  v_award public.reward_awards%ROWTYPE;
  v_history_id uuid;
  v_balance integer;
  v_label text;
BEGIN
  IF p_award_id IS NULL OR p_approve IS NULL OR (p_reason IS NOT NULL AND char_length(p_reason) > 300) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;
  SELECT user_id INTO v_user FROM public.reward_awards WHERE id = p_award_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'award_not_found');
  END IF;
  PERFORM 1 FROM public.user_profiles WHERE id = v_user FOR UPDATE;
  SELECT * INTO v_award FROM public.reward_awards WHERE id = p_award_id FOR UPDATE;

  IF v_award.status <> 'pending' THEN
    IF (p_approve AND v_award.status = 'confirmed') OR (NOT p_approve AND v_award.status = 'refused') THEN
      RETURN jsonb_build_object('success', true, 'idempotent', true, 'status', v_award.status);
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'not_pending', 'status', v_award.status);
  END IF;

  IF NOT p_approve THEN
    UPDATE public.reward_awards
       SET status = 'refused', reason = COALESCE(p_reason, 'review_refused'), decided_at = now()
     WHERE id = p_award_id;
    RETURN jsonb_build_object('success', true, 'status', 'refused');
  END IF;

  v_label := COALESCE(public.rewards_program_config() -> 'rules' -> v_award.rule_key ->> 'label', 'Gain');
  INSERT INTO public.loyalty_history (user_id, action, points, type, source_id)
  VALUES (v_user, v_label, v_award.points, 'award', 'award:' || v_award.id)
  RETURNING id INTO v_history_id;

  UPDATE public.reward_awards
     SET status = 'confirmed', history_id = v_history_id, reason = p_reason, decided_at = now()
   WHERE id = p_award_id;

  SELECT COALESCE(SUM(points), 0)::integer INTO v_balance FROM public.loyalty_history WHERE user_id = v_user;
  UPDATE public.user_profiles SET loyalty_level = public.legacy_loyalty_level_for(v_balance), updated_at = now()
  WHERE id = v_user;

  RETURN jsonb_build_object('success', true, 'status', 'confirmed', 'balance', v_balance);
END;
$$;

-- Contre-écriture d'une attribution confirmée. Ne débite que le solde
-- disponible (le reliquat non repris est tracé), ne touche jamais aux XP.
CREATE OR REPLACE FUNCTION public.rewards_reverse_award(
  p_award_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid;
  v_award public.reward_awards%ROWTYPE;
  v_balance integer;
  v_debit integer;
  v_history_id uuid;
BEGIN
  IF p_award_id IS NULL OR p_reason IS NULL OR char_length(btrim(p_reason)) = 0 OR char_length(p_reason) > 300 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;
  SELECT user_id INTO v_user FROM public.reward_awards WHERE id = p_award_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'award_not_found');
  END IF;
  PERFORM 1 FROM public.user_profiles WHERE id = v_user FOR UPDATE;
  SELECT * INTO v_award FROM public.reward_awards WHERE id = p_award_id FOR UPDATE;

  IF v_award.status = 'reversed' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'status', 'reversed',
                              'shortfall', v_award.reversal_shortfall);
  END IF;
  IF v_award.status <> 'confirmed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_confirmed', 'status', v_award.status);
  END IF;

  SELECT COALESCE(SUM(points), 0)::integer INTO v_balance FROM public.loyalty_history WHERE user_id = v_user;
  v_debit := LEAST(v_award.points, GREATEST(v_balance, 0));

  IF v_debit > 0 THEN
    INSERT INTO public.loyalty_history (user_id, action, points, type, source_id)
    VALUES (v_user, 'Attribution corrigée', -v_debit, 'award_reversal', 'award_reversal:' || v_award.id)
    RETURNING id INTO v_history_id;
  END IF;

  UPDATE public.reward_awards
     SET status = 'reversed', reason = p_reason, reversal_history_id = v_history_id,
         reversal_shortfall = v_award.points - v_debit, decided_at = now()
   WHERE id = p_award_id;

  v_balance := v_balance - v_debit;
  UPDATE public.user_profiles SET loyalty_level = public.legacy_loyalty_level_for(v_balance), updated_at = now()
  WHERE id = v_user;

  RETURN jsonb_build_object('success', true, 'status', 'reversed', 'debited', v_debit,
                            'shortfall', v_award.points - v_debit, 'balance', v_balance);
END;
$$;

-- Échange : réserve le stock et débite le solde dans la même transaction.
CREATE OR REPLACE FUNCTION public.rewards_redeem(
  p_user_id uuid,
  p_reward_id uuid,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.loyalty_redemptions%ROWTYPE;
  v_reward public.loyalty_rewards%ROWTYPE;
  v_funding public.reward_catalog_funding%ROWTYPE;
  v_balance integer;
  v_redemption_id uuid;
  v_reference text;
BEGIN
  IF p_user_id IS NULL OR p_reward_id IS NULL
     OR p_idempotency_key IS NULL OR p_idempotency_key !~ '^[A-Za-z0-9_-]{8,80}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  PERFORM 1 FROM public.user_profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;

  SELECT * INTO v_existing FROM public.loyalty_redemptions
  WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.reward_id IS DISTINCT FROM p_reward_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'idempotency_conflict');
    END IF;
    SELECT COALESCE(SUM(points), 0)::integer INTO v_balance FROM public.loyalty_history WHERE user_id = p_user_id;
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'status', v_existing.status,
                              'redemption_id', v_existing.id, 'reference', v_existing.reference,
                              'points_spent', v_existing.points_spent, 'balance', v_balance);
  END IF;

  SELECT * INTO v_reward FROM public.loyalty_rewards WHERE id = p_reward_id FOR UPDATE;
  IF NOT FOUND OR v_reward.available IS NOT TRUE
     OR (v_reward.expires_at IS NOT NULL AND v_reward.expires_at <= now()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'reward_unavailable');
  END IF;

  SELECT * INTO v_funding FROM public.reward_catalog_funding WHERE reward_id = p_reward_id FOR UPDATE;
  IF NOT FOUND OR v_funding.funding_status <> 'funded' THEN
    RETURN jsonb_build_object('success', false, 'error', 'reward_unfunded');
  END IF;
  IF v_funding.stock_remaining IS NULL OR v_funding.stock_remaining <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'out_of_stock');
  END IF;
  IF v_reward.cash_complement_cents > 0 THEN
    -- Un reste à payer exige le parcours de paiement : pas d'échange ici.
    RETURN jsonb_build_object('success', false, 'error', 'payment_required');
  END IF;
  IF v_reward.points_cost IS NULL OR v_reward.points_cost <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'reward_unavailable');
  END IF;

  SELECT COALESCE(SUM(points), 0)::integer INTO v_balance FROM public.loyalty_history WHERE user_id = p_user_id;
  IF v_balance < v_reward.points_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance', 'balance', v_balance);
  END IF;

  v_redemption_id := gen_random_uuid();
  v_reference := 'R-' || upper(substr(replace(v_redemption_id::text, '-', ''), 1, 10));

  INSERT INTO public.loyalty_redemptions (id, user_id, reward_id, points_spent, status, idempotency_key, reference, reserved_at)
  VALUES (v_redemption_id, p_user_id, p_reward_id, v_reward.points_cost, 'reserved', p_idempotency_key, v_reference, now());

  UPDATE public.reward_catalog_funding
     SET stock_remaining = stock_remaining - 1, updated_at = now()
   WHERE reward_id = p_reward_id;

  INSERT INTO public.loyalty_history (user_id, action, points, type, source_id)
  VALUES (p_user_id, 'Récompense réservée : ' || v_reward.title, -v_reward.points_cost, 'reward_redemption',
          'redeem:' || v_redemption_id);

  v_balance := v_balance - v_reward.points_cost;
  UPDATE public.user_profiles SET loyalty_level = public.legacy_loyalty_level_for(v_balance), updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'status', 'reserved', 'redemption_id', v_redemption_id,
                            'reference', v_reference, 'points_spent', v_reward.points_cost, 'balance', v_balance);
END;
$$;

-- Annulation d'une réservation : recrédit + remise en stock, une seule fois.
CREATE OR REPLACE FUNCTION public.rewards_cancel_redemption(
  p_redemption_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid;
  v_redemption public.loyalty_redemptions%ROWTYPE;
  v_balance integer;
BEGIN
  IF p_redemption_id IS NULL OR p_reason IS NULL OR char_length(btrim(p_reason)) = 0 OR char_length(p_reason) > 300 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;
  SELECT user_id INTO v_user FROM public.loyalty_redemptions WHERE id = p_redemption_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'redemption_not_found');
  END IF;
  PERFORM 1 FROM public.user_profiles WHERE id = v_user FOR UPDATE;
  SELECT * INTO v_redemption FROM public.loyalty_redemptions WHERE id = p_redemption_id FOR UPDATE;

  IF v_redemption.status = 'cancelled' THEN
    SELECT COALESCE(SUM(points), 0)::integer INTO v_balance FROM public.loyalty_history WHERE user_id = v_user;
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'status', 'cancelled', 'balance', v_balance);
  END IF;
  IF v_redemption.status <> 'reserved' THEN
    -- Expédié ou historique : relève d'un retour commercial, pas d'une annulation.
    RETURN jsonb_build_object('success', false, 'error', 'not_cancellable', 'status', v_redemption.status);
  END IF;

  INSERT INTO public.loyalty_history (user_id, action, points, type, source_id)
  VALUES (v_user, 'Réservation annulée, points rendus', v_redemption.points_spent, 'redeem_refund',
          'redeem_refund:' || v_redemption.id);

  UPDATE public.reward_catalog_funding
     SET stock_remaining = stock_remaining + 1, updated_at = now()
   WHERE reward_id = v_redemption.reward_id AND stock_remaining IS NOT NULL;

  UPDATE public.loyalty_redemptions
     SET status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason
   WHERE id = p_redemption_id;

  SELECT COALESCE(SUM(points), 0)::integer INTO v_balance FROM public.loyalty_history WHERE user_id = v_user;
  UPDATE public.user_profiles SET loyalty_level = public.legacy_loyalty_level_for(v_balance), updated_at = now()
  WHERE id = v_user;

  RETURN jsonb_build_object('success', true, 'status', 'cancelled', 'refunded', v_redemption.points_spent,
                            'balance', v_balance);
END;
$$;

-- Choix (ou retrait) de l'objectif : aucun point dépensé.
CREATE OR REPLACE FUNCTION public.rewards_set_goal(
  p_user_id uuid,
  p_reward_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reward public.loyalty_rewards%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;
  PERFORM 1 FROM public.user_profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;

  IF p_reward_id IS NULL THEN
    DELETE FROM public.reward_goals WHERE user_id = p_user_id;
    RETURN jsonb_build_object('success', true, 'goal', NULL);
  END IF;

  SELECT * INTO v_reward FROM public.loyalty_rewards WHERE id = p_reward_id;
  IF NOT FOUND OR v_reward.available IS NOT TRUE
     OR (v_reward.expires_at IS NOT NULL AND v_reward.expires_at <= now()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'reward_unavailable');
  END IF;

  INSERT INTO public.reward_goals (user_id, reward_id, chosen_at)
  VALUES (p_user_id, p_reward_id, now())
  ON CONFLICT (user_id) DO UPDATE SET reward_id = EXCLUDED.reward_id, chosen_at = now();

  RETURN jsonb_build_object('success', true, 'goal', jsonb_build_object('reward_id', p_reward_id));
END;
$$;

-- Lecture cohérente du portefeuille d'un membre (propriétaire uniquement :
-- l'identité vient de la session vérifiée par la route serveur).
CREATE OR REPLACE FUNCTION public.rewards_wallet_snapshot(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cfg jsonb;
  v_period date;
  v_result jsonb;
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;
  v_cfg := public.rewards_program_config();
  v_period := public.rewards_period_start(now());

  SELECT jsonb_build_object(
    'success', true,
    'generated_at', now(),
    'balance', (SELECT COALESCE(SUM(points), 0)::integer FROM public.loyalty_history WHERE user_id = p_user_id),
    'program', jsonb_build_object(
      'version', v_cfg ->> 'version',
      'emission_open', COALESCE((v_cfg ->> 'emission_open')::boolean, false),
      'closure_reason', v_cfg ->> 'closure_reason',
      'weekly_cap', COALESCE((v_cfg ->> 'weekly_cap')::integer, 0),
      'rules', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'key', r.key,
          'label', r.value ->> 'label',
          'points', (r.value ->> 'points')::integer,
          'weekly_limit', (r.value ->> 'weekly_limit')::integer,
          'producer_open', COALESCE((r.value ->> 'producer_open')::boolean, false),
          'requires_review', COALESCE((r.value ->> 'requires_review')::boolean, false)
        ) ORDER BY r.key)
        FROM jsonb_each(CASE WHEN jsonb_typeof(v_cfg -> 'rules') = 'object' THEN v_cfg -> 'rules' ELSE '{}'::jsonb END) r
      ), '[]'::jsonb)
    ),
    'week', jsonb_build_object(
      'start', v_period,
      'used', (SELECT COALESCE(SUM(points), 0)::integer FROM public.reward_awards
               WHERE user_id = p_user_id AND period_start = v_period AND status IN ('pending', 'confirmed'))
    ),
    'pending_points', (SELECT COALESCE(SUM(points), 0)::integer FROM public.reward_awards
                       WHERE user_id = p_user_id AND status = 'pending'),
    'goal', (SELECT jsonb_build_object('reward_id', g.reward_id, 'chosen_at', g.chosen_at)
             FROM public.reward_goals g WHERE g.user_id = p_user_id),
    'catalog', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', lr.id,
        'title', lr.title,
        'description', lr.description,
        'points_cost', lr.points_cost,
        'category', lr.category,
        'value', lr.value,
        'image', NULLIF(lr.image, ''),
        'alt', lr.alt,
        'available', COALESCE(lr.available, false),
        'expires_at', lr.expires_at,
        'fulfillment', lr.fulfillment,
        'terms', lr.terms,
        'terms_version', lr.terms_version,
        'partner_disclosure', lr.partner_disclosure,
        'cash_complement_cents', lr.cash_complement_cents,
        'funding_status', COALESCE(f.funding_status, 'unfunded'),
        'stock_remaining', CASE WHEN f.funding_status = 'funded' THEN f.stock_remaining END,
        'created_at', lr.created_at
      ) ORDER BY lr.points_cost, lr.created_at, lr.id)
      FROM public.loyalty_rewards lr
      LEFT JOIN public.reward_catalog_funding f ON f.reward_id = lr.id
    ), '[]'::jsonb),
    'history', COALESCE((
      SELECT jsonb_agg(h ORDER BY h ->> 'created_at' DESC)
      FROM (
        SELECT jsonb_build_object(
          'id', lh.id, 'action', lh.action, 'points', lh.points, 'type', lh.type,
          'created_at', lh.created_at, 'source_kind', NULLIF(split_part(COALESCE(lh.source_id, ''), ':', 1), '')
        ) AS h
        FROM public.loyalty_history lh
        WHERE lh.user_id = p_user_id
        ORDER BY lh.created_at DESC
        LIMIT 50
      ) recent
    ), '[]'::jsonb),
    'awards', COALESCE((
      SELECT jsonb_agg(a ORDER BY a ->> 'created_at' DESC)
      FROM (
        SELECT jsonb_build_object(
          'id', ra.id, 'rule_key', ra.rule_key, 'points', ra.points, 'status', ra.status,
          'reason', ra.reason, 'created_at', ra.created_at, 'decided_at', ra.decided_at,
          'reversal_shortfall', ra.reversal_shortfall
        ) AS a
        FROM public.reward_awards ra
        WHERE ra.user_id = p_user_id AND ra.status IN ('pending', 'refused', 'reversed')
        ORDER BY ra.created_at DESC
        LIMIT 20
      ) recent
    ), '[]'::jsonb),
    'redemptions', COALESCE((
      SELECT jsonb_agg(r ORDER BY r ->> 'created_at' DESC)
      FROM (
        SELECT jsonb_build_object(
          'id', rd.id, 'reward_id', rd.reward_id, 'reward_title', lr.title, 'points_spent', rd.points_spent,
          'status', rd.status, 'reference', rd.reference, 'created_at', rd.created_at,
          'cancelled_at', rd.cancelled_at
        ) AS r
        FROM public.loyalty_redemptions rd
        LEFT JOIN public.loyalty_rewards lr ON lr.id = rd.reward_id
        WHERE rd.user_id = p_user_id
        ORDER BY rd.created_at DESC
        LIMIT 20
      ) recent
    ), '[]'::jsonb),
    'legacy', (
      SELECT jsonb_build_object(
        'economic_points', COALESCE(ra.available_points, 0),
        'economic_pending_points', COALESCE(ra.pending_points, 0),
        'available_cash', COALESCE(ra.available_cash, 0),
        'pending_cash', COALESCE(ra.pending_cash, 0),
        'store_credit_cents', COALESCE(ra.store_credit_cents, 0),
        'cashout_active', COALESCE((SELECT (value ->> 'cashout_active')::boolean FROM public.reward_config WHERE key = 'kill_switches'), false),
        'cashout_min_threshold', (SELECT CASE WHEN jsonb_typeof(value) = 'number' THEN (value #>> '{}')::numeric END
                                  FROM public.reward_config WHERE key = 'cashout_min_threshold'),
        -- Demandes de retrait du membre : statut et montant seulement, jamais
        -- les coordonnées bancaires (metadata) ni le score de risque.
        'withdrawals', COALESCE((
          SELECT jsonb_agg(w ORDER BY w ->> 'requested_at' DESC)
          FROM (
            SELECT jsonb_build_object(
              'id', rw.id, 'amount', rw.amount, 'status', rw.status,
              'payment_provider', rw.payment_provider, 'requested_at', rw.requested_at,
              'rejection_reason', rw.rejection_reason
            ) AS w
            FROM public.reward_withdrawals rw
            WHERE rw.user_id = p_user_id
            ORDER BY rw.requested_at DESC
            LIMIT 10
          ) recent
        ), '[]'::jsonb)
      )
      FROM (SELECT 1) one
      LEFT JOIN public.reward_accounts ra ON ra.user_id = p_user_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ── 8. Permissions : service_role uniquement ────────────────────────────────
DO $$
DECLARE
  sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'public.rewards_program_config()',
    'public.rewards_period_start(timestamptz)',
    'public.rewards_award_points(uuid,text,text,text)',
    'public.rewards_decide_award(uuid,boolean,text)',
    'public.rewards_reverse_award(uuid,text)',
    'public.rewards_redeem(uuid,uuid,text)',
    'public.rewards_cancel_redemption(uuid,text)',
    'public.rewards_set_goal(uuid,uuid)',
    'public.rewards_wallet_snapshot(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', sig);
  END LOOP;
END $$;

COMMENT ON TABLE public.reward_awards IS
  'Décisions du programme points : une par (membre, règle, source). Écriture par fonctions rewards_* (service_role).';
COMMENT ON TABLE public.reward_goals IS
  'Objectif de récompense choisi par le membre. Choisir ne dépense aucun point.';
COMMENT ON TABLE public.reward_catalog_funding IS
  'Financement interne du catalogue (coût rendu, financeur, budget, stock). Jamais exposé aux membres.';
