-- ============================================================
-- KIT DU VOYAGEUR — Moteur de Récompenses (Reward Engine)
-- Migration: 20260816000000_reward_engine.sql
-- ============================================================

-- ─── 1. CONFIGURATION TABLE ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reward_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.reward_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on reward_config" 
  ON public.reward_config FOR SELECT TO public USING (true);

CREATE POLICY "Allow admin write on reward_config" 
  ON public.reward_config FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ─── 2. REWARD PERIODS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reward_periods (
  id TEXT PRIMARY KEY, -- Format: 'YYYY-MM'
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  eligible_revenue NUMERIC(12,2) DEFAULT 0.00,
  reward_pool NUMERIC(12,2) DEFAULT 0.00,
  total_valid_points INTEGER DEFAULT 0,
  point_weight NUMERIC(20,8) DEFAULT 0.00000000,
  distributed_amount NUMERIC(12,2) DEFAULT 0.00,
  remaining_amount NUMERIC(12,2) DEFAULT 0.00,
  status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CALCULATING', 'FINALIZED', 'DISTRIBUTING', 'CLOSED')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.reward_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on reward_periods" 
  ON public.reward_periods FOR SELECT TO public USING (true);

CREATE POLICY "Allow admin write on reward_periods" 
  ON public.reward_periods FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ─── 3. REWARD ACCOUNTS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reward_accounts (
  user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  available_points INTEGER DEFAULT 0,
  pending_points INTEGER DEFAULT 0,
  invalid_points INTEGER DEFAULT 0,
  lifetime_points INTEGER DEFAULT 0,
  eligible_points INTEGER DEFAULT 0,
  earned_this_period INTEGER DEFAULT 0,
  redeemed_points INTEGER DEFAULT 0,
  available_cash NUMERIC(12,2) DEFAULT 0.00,
  pending_cash NUMERIC(12,2) DEFAULT 0.00,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'limited', 'suspect')),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.reward_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users read own reward_account" 
  ON public.reward_accounts FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Allow admin write on reward_accounts" 
  ON public.reward_accounts FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ─── 4. REWARD TRANSACTIONS (Ledger) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reward_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('LIKE_REWARD', 'COMMENT_REWARD', 'POST_REWARD', 'JOURNAL_REWARD', 'GROUP_REWARD', 'QUALITY_BONUS', 'FRAUD_REVERSAL', 'ADMIN_ADJUSTMENT', 'REDEMPTION', 'EXPIRATION', 'REFERRAL_REWARD')),
  reference_id UUID,
  reference_type TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.reward_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users read own transactions" 
  ON public.reward_transactions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Allow admin write on reward_transactions" 
  ON public.reward_transactions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ─── 5. PENDING CONTRIBUTIONS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pending_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('like', 'comment', 'post', 'carnet', 'group_message', 'guide_contribution', 'referral', 'checklist', 'info_correction')),
  target_id UUID,
  target_type TEXT NOT NULL,
  base_points INTEGER NOT NULL,
  quality_score NUMERIC(3,2) DEFAULT 1.00,
  trust_score INTEGER DEFAULT 50,
  final_points INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'reversed')),
  rejection_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  validated_at TIMESTAMPTZ
);

ALTER TABLE public.pending_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users read own pending_contributions" 
  ON public.pending_contributions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Allow admin write on pending_contributions" 
  ON public.pending_contributions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ─── 6. REWARD WITHDRAWALS (Cash-out) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reward_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  points_redeemed INTEGER NOT NULL CHECK (points_redeemed >= 0),
  currency TEXT DEFAULT 'EUR',
  reward_period TEXT REFERENCES public.reward_periods(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'processing', 'paid', 'rejected')),
  payment_provider TEXT NOT NULL DEFAULT 'bank_transfer',
  payment_reference TEXT,
  requested_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  risk_score INTEGER DEFAULT 0,
  idempotency_key TEXT UNIQUE NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.reward_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users read own withdrawals" 
  ON public.reward_withdrawals FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Allow admin write on reward_withdrawals" 
  ON public.reward_withdrawals FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ─── 7. AUTOMATIC SCHEMAS TRIGGERS & FUNCTIONS ──────────────────────────────

-- Trigger on user profiles to auto create reward account
CREATE OR REPLACE FUNCTION public.handle_new_user_reward_account()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.reward_accounts (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_user_profile_created_reward_account
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_reward_account();

-- Trigger to maintain accounts state on new transaction
CREATE OR REPLACE FUNCTION public.update_reward_account_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.reward_accounts (
    user_id,
    available_points,
    lifetime_points,
    eligible_points,
    earned_this_period,
    redeemed_points
  ) VALUES (
    NEW.user_id,
    GREATEST(0, NEW.points),
    GREATEST(0, NEW.points),
    GREATEST(0, NEW.points),
    GREATEST(0, NEW.points),
    CASE WHEN NEW.transaction_type = 'REDEMPTION' THEN ABS(NEW.points) ELSE 0 END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    available_points = GREATEST(0, public.reward_accounts.available_points + NEW.points),
    lifetime_points = public.reward_accounts.lifetime_points + CASE WHEN NEW.points > 0 THEN NEW.points ELSE 0 END,
    eligible_points = GREATEST(0, public.reward_accounts.eligible_points + NEW.points),
    earned_this_period = GREATEST(0, public.reward_accounts.earned_this_period + CASE WHEN NEW.transaction_type <> 'REDEMPTION' THEN NEW.points ELSE 0 END),
    redeemed_points = public.reward_accounts.redeemed_points + CASE WHEN NEW.transaction_type = 'REDEMPTION' THEN ABS(NEW.points) ELSE 0 END,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_reward_transaction_inserted
  AFTER INSERT ON public.reward_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_reward_account_on_transaction();

-- Trigger to maintain accounts pending points on contribution changes
CREATE OR REPLACE FUNCTION public.update_reward_account_on_contribution()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pending' THEN
      INSERT INTO public.reward_accounts (user_id, pending_points)
      VALUES (NEW.user_id, NEW.final_points)
      ON CONFLICT (user_id) DO UPDATE SET
        pending_points = public.reward_accounts.pending_points + NEW.final_points,
        updated_at = now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
      UPDATE public.reward_accounts
      SET pending_points = GREATEST(0, pending_points - OLD.final_points),
          updated_at = now()
      WHERE user_id = NEW.user_id;
    ELSIF OLD.status = 'pending' AND NEW.status = 'rejected' THEN
      UPDATE public.reward_accounts
      SET pending_points = GREATEST(0, pending_points - OLD.final_points),
          invalid_points = invalid_points + OLD.final_points,
          updated_at = now()
      WHERE user_id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_pending_contribution_changed
  AFTER INSERT OR UPDATE ON public.pending_contributions
  FOR EACH ROW EXECUTE FUNCTION public.update_reward_account_on_contribution();

-- ─── 8. CONFIG SEEDING ────────────────────────────────────────────────────────
INSERT INTO public.reward_config (key, value, description) VALUES
  ('pool_percentage', '0.15'::jsonb, 'Pourcentage du revenu éligible net affecté au pool de récompenses'),
  ('monthly_pool_cap', '5000.00'::jsonb, 'Plafond mensuel en euros pour le pool de récompenses'),
  ('yearly_pool_cap', '50000.00'::jsonb, 'Plafond annuel en euros pour le pool de récompenses'),
  ('security_reserve', '500.00'::jsonb, 'Réserve de trésorerie de sécurité en euros soustraite du pool'),
  ('cashout_min_threshold', '20.00'::jsonb, 'Seuil minimal de retrait en euros'),
  ('cashout_min_age_days', '30'::jsonb, 'Ancienneté de compte minimale en jours requise pour cashout'),
  ('cashout_min_trust_score', '40'::jsonb, 'Score de confiance minimum requis pour cashout'),
  ('action_base_points', '{"like": 1, "comment": 10, "post": 20, "carnet": 100, "group_message": 2, "guide_contribution": 150, "referral": 200}'::jsonb, 'Points de base attribués par type d''action'),
  ('action_limits', '{"like_daily": 10, "like_weekly": 50, "comment_daily": 5, "comment_weekly": 20, "post_daily": 2, "post_weekly": 8, "carnet_daily": 1, "carnet_weekly": 3, "group_message_daily": 30}'::jsonb, 'Limites d''actions (daily et weekly) autorisées pour gain par utilisateur'),
  ('trust_level_caps', '{"0": 50, "1": 100, "2": 300, "3": 1000, "4": 5000, "5": -1}'::jsonb, 'Cap d''émission quotidienne de points par niveau de confiance/reputation'),
  ('spam_words', '["super", "cool", "merci", "top", "génial", "wow", "bravo", "test"]'::jsonb, 'Mots déclencheurs pour réduction du score de qualité'),
  ('kill_switches', '{"rewards_active": true, "cashout_active": true}'::jsonb, 'Kill switches d''urgence pour désactiver l''acquisition ou les retraits')
ON CONFLICT (key) DO NOTHING;

-- Initialisation du compte pour les profils existants
INSERT INTO public.reward_accounts (user_id)
SELECT id FROM public.user_profiles
ON CONFLICT (user_id) DO NOTHING;

-- Seed de la période courante (Août 2026)
INSERT INTO public.reward_periods (id, start_date, end_date, status) VALUES
  ('2026-08', '2026-08-01 00:00:00+00', '2026-09-01 00:00:00+00', 'OPEN')
ON CONFLICT (id) DO NOTHING;
