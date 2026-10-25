-- ============================================================================
-- Copie locale des objets de production touchés par 20261025120000_rewards_points_v1.
--
-- Définitions relues en production le 25 octobre 2026 (pg_get_functiondef,
-- information_schema, pg_policies, role_table_grants) sur le projet
-- icxyvwzfjbflcbqukpfz. Seules les colonnes et fonctions utilisées par la
-- migration et ses tests sont reproduites ; les corps de fonctions sont
-- recopiés à l'identique. Sert à valider la migration « sur copie » avant
-- toute application en production (CLAUDE.md, workflow d'un changement).
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;

CREATE TABLE auth.users (id uuid PRIMARY KEY);

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.role', true), '');
$$;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.role() TO anon, authenticated, service_role;

CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE,
  full_name text,
  trust_score integer DEFAULT 50,
  loyalty_points integer DEFAULT 0,
  loyalty_level text DEFAULT 'Explorateur',
  xp integer DEFAULT 0,
  level integer DEFAULT 1,
  role text DEFAULT 'user' CHECK (role = ANY (ARRAY['user', 'admin', 'moderator'])),
  is_suspended_groups boolean DEFAULT false,
  suspended_from_groups_at timestamptz,
  two_fa_enabled boolean DEFAULT false,
  is_demo boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;
CREATE POLICY profiles_read_own ON public.user_profiles FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.guard_user_profile_privileged_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  privileged_change boolean := false;
BEGIN
  IF auth.role() IS NULL OR auth.role() NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    privileged_change :=
      NEW.role IS DISTINCT FROM 'user'
      OR NEW.trust_score IS DISTINCT FROM 50
      OR NEW.is_suspended_groups IS DISTINCT FROM false
      OR NEW.suspended_from_groups_at IS NOT NULL
      OR NEW.two_fa_enabled IS DISTINCT FROM false
      OR NEW.loyalty_points IS DISTINCT FROM 0
      OR NEW.loyalty_level IS DISTINCT FROM 'Explorateur'
      OR NEW.xp IS DISTINCT FROM 0
      OR NEW.level IS DISTINCT FROM 1;
  ELSE
    privileged_change :=
      NEW.role IS DISTINCT FROM OLD.role
      OR NEW.trust_score IS DISTINCT FROM OLD.trust_score
      OR NEW.is_suspended_groups IS DISTINCT FROM OLD.is_suspended_groups
      OR NEW.suspended_from_groups_at IS DISTINCT FROM OLD.suspended_from_groups_at
      OR NEW.two_fa_enabled IS DISTINCT FROM OLD.two_fa_enabled
      OR NEW.email IS DISTINCT FROM OLD.email
      OR NEW.loyalty_points IS DISTINCT FROM OLD.loyalty_points
      OR NEW.loyalty_level IS DISTINCT FROM OLD.loyalty_level
      OR NEW.xp IS DISTINCT FROM OLD.xp
      OR NEW.level IS DISTINCT FROM OLD.level;
  END IF;
  IF privileged_change THEN
    RAISE EXCEPTION 'user_profiles: colonne de privilège protégée (role, trust_score, suspension, 2FA, email, loyalty, xp, level)'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $function$;

CREATE TRIGGER guard_user_profile_privileged_columns BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_profile_privileged_columns();

-- ── Fidélité ────────────────────────────────────────────────────────────────
CREATE TABLE public.loyalty_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  points integer DEFAULT 0,
  type text DEFAULT 'earned'::text,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  source_id text
);
CREATE INDEX idx_loyalty_history_user_id ON public.loyalty_history USING btree (user_id);

CREATE TABLE public.loyalty_rewards (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  title text NOT NULL,
  description text DEFAULT ''::text,
  points_cost integer DEFAULT 100,
  category text DEFAULT 'Réduction'::text,
  value text DEFAULT ''::text,
  available boolean DEFAULT true,
  image text DEFAULT ''::text,
  alt text DEFAULT ''::text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.loyalty_redemptions (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reward_id uuid REFERENCES public.loyalty_rewards(id) ON DELETE CASCADE,
  points_spent integer DEFAULT 0,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  status text DEFAULT 'completed'::text
);
CREATE INDEX idx_loyalty_redemptions_user_id ON public.loyalty_redemptions USING btree (user_id);

ALTER TABLE public.loyalty_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_read_own_loyalty_history ON public.loyalty_history FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY auth_read_own_loyalty_redemptions ON public.loyalty_redemptions FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY admin_manage_loyalty_rewards ON public.loyalty_rewards FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY public_read_loyalty_rewards ON public.loyalty_rewards FOR SELECT USING (true);
GRANT SELECT ON public.loyalty_history, public.loyalty_redemptions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_rewards TO anon, authenticated;
GRANT ALL ON public.loyalty_history, public.loyalty_redemptions, public.loyalty_rewards TO service_role;

CREATE OR REPLACE FUNCTION public.sync_loyalty_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
    UPDATE public.user_profiles
    SET loyalty_points = (
        SELECT COALESCE(SUM(points), 0)
        FROM public.loyalty_history
        WHERE user_id = NEW.user_id
    )
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$function$;
CREATE TRIGGER trigger_sync_loyalty_points AFTER INSERT OR DELETE OR UPDATE ON public.loyalty_history
  FOR EACH ROW EXECUTE FUNCTION public.sync_loyalty_points();

CREATE OR REPLACE FUNCTION public.legacy_loyalty_level_for(p_points integer)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN p_points >= 7500 THEN 'Légende du Voyage'
    WHEN p_points >= 3500 THEN 'Guide de Montagne'
    WHEN p_points >= 1500 THEN 'Randonneur Expert'
    WHEN p_points >= 500  THEN 'Aventurier'
    ELSE 'Explorateur'
  END;
$function$;

CREATE OR REPLACE FUNCTION public.legacy_loyalty_spend(p_user_id uuid, p_points integer, p_reason text, p_source_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_balance integer;
  v_new_balance integer;
  v_level text;
BEGIN
  IF p_points IS NULL OR p_points <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_points');
  END IF;

  IF p_source_id IS NULL OR length(p_source_id) = 0 OR length(p_source_id) > 200 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_source');
  END IF;

  PERFORM 1 FROM public.user_profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;

  SELECT COALESCE(SUM(points), 0) INTO v_balance
  FROM public.loyalty_history
  WHERE user_id = p_user_id;

  IF EXISTS (SELECT 1 FROM public.loyalty_history WHERE source_id = p_source_id AND user_id = p_user_id) THEN
    SELECT loyalty_level INTO v_level FROM public.user_profiles WHERE id = p_user_id;
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'balance', v_balance, 'level', v_level);
  END IF;

  IF v_balance < p_points THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance', 'balance', v_balance);
  END IF;

  INSERT INTO public.loyalty_history (user_id, action, points, type, source_id)
  VALUES (p_user_id, COALESCE(p_reason, 'Dépense'), -p_points, 'spent', p_source_id);

  v_new_balance := GREATEST(0, v_balance - p_points);
  v_level := public.legacy_loyalty_level_for(v_new_balance);

  UPDATE public.user_profiles
     SET loyalty_level = v_level,
         updated_at = now()
   WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'balance', v_new_balance, 'level', v_level);
END; $function$;
REVOKE ALL ON FUNCTION public.legacy_loyalty_spend(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.legacy_loyalty_spend(uuid, integer, text, text) TO service_role;

-- ── Programme économique legacy ─────────────────────────────────────────────
CREATE TABLE public.reward_config (
  key text NOT NULL PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.reward_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow admin write on reward_config" ON public.reward_config FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Allow public read on reward_config" ON public.reward_config FOR SELECT TO public USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reward_config TO anon, authenticated;
GRANT ALL ON public.reward_config TO service_role;

INSERT INTO public.reward_config (key, value) VALUES
  ('action_base_points', '{"like": 1, "post": 20, "carnet": 100, "comment": 10, "referral": 200, "group_message": 2, "guide_contribution": 150}'),
  ('action_limits', '{"like_daily": 10, "post_daily": 2, "like_weekly": 50, "post_weekly": 8, "carnet_daily": 1, "carnet_weekly": 3, "comment_daily": 5, "comment_weekly": 20, "group_message_daily": 30}'),
  ('kill_switches', '{"cashout_active": true, "rewards_active": true}'),
  ('trust_level_caps', '{"0": 50, "1": 100, "2": 300, "3": 1000, "4": 5000, "5": -1}'),
  ('cashout_min_threshold', '20');

CREATE TABLE public.reward_accounts (
  user_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  available_points integer DEFAULT 0,
  pending_points integer DEFAULT 0,
  available_cash numeric DEFAULT 0,
  pending_cash numeric DEFAULT 0,
  store_credit_cents bigint DEFAULT 0,
  status text DEFAULT 'active' CHECK (status = ANY (ARRAY['active', 'suspended', 'limited', 'suspect']))
);
ALTER TABLE public.reward_accounts ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.reward_accounts TO authenticated;
GRANT ALL ON public.reward_accounts TO service_role;

CREATE TABLE public.reward_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  amount numeric,
  points_redeemed integer,
  currency text,
  reward_period text,
  status text,
  payment_provider text,
  payment_reference text,
  requested_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  processed_at timestamptz,
  rejection_reason text,
  risk_score integer,
  idempotency_key text,
  metadata jsonb
);
ALTER TABLE public.reward_withdrawals ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.reward_withdrawals TO service_role;

CREATE TABLE public.pending_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  action_type text,
  target_id uuid,
  target_type text,
  base_points integer,
  quality_score numeric,
  trust_score integer,
  final_points integer,
  status text,
  rejection_reason text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  validated_at timestamptz
);
CREATE TABLE public.reward_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  points integer,
  transaction_type text,
  reference_id uuid,
  reference_type text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
GRANT ALL ON public.pending_contributions, public.reward_transactions TO service_role;

CREATE OR REPLACE FUNCTION public.claim_reward_points(p_user_id uuid, p_action_type text, p_target_id uuid, p_target_type text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_rewards_active BOOLEAN;
  v_account_status TEXT;
  v_trust_score INTEGER;
  v_target_author_id UUID;
  v_base_points INTEGER;
  v_daily_limit INTEGER;
  v_weekly_limit INTEGER;
  v_daily_count INTEGER;
  v_weekly_count INTEGER;
  v_points_earned_today INTEGER;
  v_user_level INTEGER;
  v_level_cap INTEGER;
  v_quality_score NUMERIC(3,2) := 1.00;
  v_content TEXT;
  v_spam_words JSONB;
  v_final_points INTEGER;
  v_status TEXT := 'pending';
  v_contribution_id UUID;
  v_transaction_type TEXT;
BEGIN
  -- 1. Check Kill Switch
  SELECT (value->>'rewards_active')::boolean INTO v_rewards_active FROM public.reward_config WHERE key = 'kill_switches';
  IF NOT COALESCE(v_rewards_active, true) THEN
    RAISE EXCEPTION 'Les récompenses sont temporairement désactivées';
  END IF;

  -- 2. Check Account Status & Profile Trust
  SELECT status INTO v_account_status FROM public.reward_accounts WHERE user_id = p_user_id;
  SELECT trust_score INTO v_trust_score FROM public.user_profiles WHERE id = p_user_id;

  IF v_account_status = 'suspended' THEN
    RAISE EXCEPTION 'Ce compte est suspendu de toute récompense';
  END IF;

  -- 3. Check Self-Action
  IF p_action_type = 'like' THEN
    IF p_target_type = 'post' THEN
      SELECT author_id INTO v_target_author_id FROM public.community_posts WHERE id = p_target_id;
    ELSIF p_target_type = 'carnet' THEN
      SELECT author_id INTO v_target_author_id FROM public.carnets WHERE id = p_target_id;
    ELSIF p_target_type = 'comment' THEN
      SELECT author_id INTO v_target_author_id FROM public.post_comments WHERE id = p_target_id;
    ELSIF p_target_type = 'club_topic' THEN
      SELECT author_id INTO v_target_author_id FROM public.club_topics WHERE id = p_target_id;
    END IF;

    IF v_target_author_id = p_user_id THEN
      RAISE EXCEPTION 'Auto-like non éligible aux récompenses';
    END IF;
  ELSIF p_action_type = 'comment' THEN
    IF p_target_type = 'post' THEN
      SELECT author_id INTO v_target_author_id FROM public.community_posts WHERE id = p_target_id;
    ELSIF p_target_type = 'carnet' THEN
      SELECT author_id INTO v_target_author_id FROM public.carnets WHERE id = p_target_id;
    END IF;

    IF v_target_author_id = p_user_id THEN
      RAISE EXCEPTION 'Commentaires sur vos propres contenus non éligibles aux récompenses';
    END IF;
  END IF;

  -- 4. Get Base Points
  SELECT (value->>p_action_type)::integer INTO v_base_points FROM public.reward_config WHERE key = 'action_base_points';
  IF v_base_points IS NULL OR v_base_points = 0 THEN
    RETURN NULL;
  END IF;

  -- 5. Check Action Limits
  SELECT (value->>(p_action_type || '_daily'))::integer, (value->>(p_action_type || '_weekly'))::integer
  INTO v_daily_limit, v_weekly_limit
  FROM public.reward_config WHERE key = 'action_limits';

  IF v_daily_limit IS NOT NULL THEN
    SELECT COUNT(*)::integer INTO v_daily_count FROM public.pending_contributions
    WHERE user_id = p_user_id AND action_type = p_action_type AND status <> 'rejected' AND created_at > now() - INTERVAL '1 day';

    IF v_daily_count >= v_daily_limit THEN
      RAISE EXCEPTION 'Limite quotidienne de gains pour cette action atteinte';
    END IF;
  END IF;

  IF v_weekly_limit IS NOT NULL THEN
    SELECT COUNT(*)::integer INTO v_weekly_count FROM public.pending_contributions
    WHERE user_id = p_user_id AND action_type = p_action_type AND status <> 'rejected' AND created_at > now() - INTERVAL '7 days';

    IF v_weekly_count >= v_weekly_limit THEN
      RAISE EXCEPTION 'Limite hebdomadaire de gains pour cette action atteinte';
    END IF;
  END IF;

  -- 6. Check Trust Level daily cap
  SELECT COALESCE(level, 1) INTO v_user_level FROM public.user_profiles WHERE id = p_user_id;
  SELECT (value->>(v_user_level::text))::integer INTO v_level_cap FROM public.reward_config WHERE key = 'trust_level_caps';

  IF v_level_cap IS NOT NULL AND v_level_cap <> -1 THEN
    SELECT COALESCE(SUM(final_points), 0)::integer INTO v_points_earned_today FROM public.pending_contributions
    WHERE user_id = p_user_id AND status <> 'rejected' AND created_at > now() - INTERVAL '1 day';

    IF (v_points_earned_today + v_base_points) > v_level_cap THEN
      RAISE EXCEPTION 'Limite quotidienne d''émission de points atteinte pour votre niveau';
    END IF;
  END IF;

  -- 7. Quality Scoring
  IF p_action_type IN ('comment', 'post') THEN
    v_content := p_metadata->>'content';
    IF v_content IS NOT NULL THEN
      IF length(trim(v_content)) < 10 THEN
        v_quality_score := v_quality_score * 0.50;
      END IF;

      SELECT value INTO v_spam_words FROM public.reward_config WHERE key = 'spam_words';
      IF v_spam_words IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(v_spam_words) AS sw
          WHERE lower(v_content) LIKE '%' || lower(sw) || '%'
        ) THEN
          v_quality_score := v_quality_score * 0.20;
        END IF;
      END IF;
    END IF;
  END IF;

  v_final_points := ROUND(v_base_points * v_quality_score);
  IF v_final_points <= 0 THEN
    RAISE EXCEPTION 'Qualité ou pertinence insuffisante pour obtenir des points';
  END IF;

  -- 8. Auto-approve conditions
  IF v_account_status = 'limited' THEN
    v_status := 'pending';
  ELSIF COALESCE(v_trust_score, 50) >= 60 OR p_action_type IN ('like', 'group_message') THEN
    v_status := 'approved';
  ELSE
    v_status := 'pending';
  END IF;

  -- 9. Insert pending contribution
  INSERT INTO public.pending_contributions (
    user_id, action_type, target_id, target_type, base_points, quality_score, trust_score,
    final_points, status, metadata, validated_at
  ) VALUES (
    p_user_id, p_action_type, p_target_id, p_target_type, v_base_points, v_quality_score,
    COALESCE(v_trust_score, 50), v_final_points, v_status, p_metadata,
    CASE WHEN v_status = 'approved' THEN now() ELSE NULL END
  )
  RETURNING id INTO v_contribution_id;

  -- 10. If approved, immediately insert ledger transaction
  IF v_status = 'approved' THEN
    v_transaction_type := CASE
      WHEN p_action_type = 'like' THEN 'LIKE_REWARD'::text
      WHEN p_action_type = 'comment' THEN 'COMMENT_REWARD'::text
      WHEN p_action_type = 'post' THEN 'POST_REWARD'::text
      WHEN p_action_type = 'carnet' THEN 'JOURNAL_REWARD'::text
      WHEN p_action_type = 'group_message' THEN 'GROUP_REWARD'::text
      WHEN p_action_type = 'referral' THEN 'REFERRAL_REWARD'::text
      ELSE 'ADMIN_ADJUSTMENT'::text
    END;

    INSERT INTO public.reward_transactions (user_id, points, transaction_type, reference_id, reference_type, metadata)
    VALUES (p_user_id, v_final_points, v_transaction_type, v_contribution_id, p_target_type,
            jsonb_build_object('auto_approved', true));
  END IF;

  RETURN v_contribution_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.claim_reward_points(uuid, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_reward_points(uuid, text, uuid, text, jsonb) TO service_role;
