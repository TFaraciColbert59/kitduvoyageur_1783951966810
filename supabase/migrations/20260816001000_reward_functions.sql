-- ============================================================
-- KIT DU VOYAGEUR — Fonctions Backend Récompenses
-- Migration: 20260816001000_reward_functions.sql
-- ============================================================

-- ─── 1. FUNCTION: CLAIM REWARD POINTS ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_reward_points(
  p_user_id UUID,
  p_action_type TEXT,
  p_target_id UUID,
  p_target_type TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
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

      -- Check spam words
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
    user_id,
    action_type,
    target_id,
    target_type,
    base_points,
    quality_score,
    trust_score,
    final_points,
    status,
    metadata,
    validated_at
  ) VALUES (
    p_user_id,
    p_action_type,
    p_target_id,
    p_target_type,
    v_base_points,
    v_quality_score,
    COALESCE(v_trust_score, 50),
    v_final_points,
    v_status,
    p_metadata,
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

    INSERT INTO public.reward_transactions (
      user_id,
      points,
      transaction_type,
      reference_id,
      reference_type,
      metadata
    ) VALUES (
      p_user_id,
      v_final_points,
      v_transaction_type,
      v_contribution_id,
      p_target_type,
      jsonb_build_object('auto_approved', true)
    );
  END IF;

  RETURN v_contribution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 2. FUNCTION: PROCESS PENDING CONTRIBUTION ──────────────────────────────
CREATE OR REPLACE FUNCTION public.process_pending_contribution(
  p_contribution_id UUID,
  p_approve BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_contrib RECORD;
  v_transaction_type TEXT;
BEGIN
  -- Verify requester is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès interdit: Administrateurs uniquement';
  END IF;

  SELECT * INTO v_contrib FROM public.pending_contributions WHERE id = p_contribution_id;
  IF v_contrib IS NULL THEN
    RAISE EXCEPTION 'Contribution introuvable';
  END IF;

  IF v_contrib.status <> 'pending' THEN
    RAISE EXCEPTION 'Cette contribution a déjà été traitée';
  END IF;

  IF p_approve THEN
    -- Update contribution status
    UPDATE public.pending_contributions
    SET status = 'approved',
        validated_at = now()
    WHERE id = p_contribution_id;

    -- Insert reward transaction
    v_transaction_type := CASE 
      WHEN v_contrib.action_type = 'like' THEN 'LIKE_REWARD'::text
      WHEN v_contrib.action_type = 'comment' THEN 'COMMENT_REWARD'::text
      WHEN v_contrib.action_type = 'post' THEN 'POST_REWARD'::text
      WHEN v_contrib.action_type = 'carnet' THEN 'JOURNAL_REWARD'::text
      WHEN v_contrib.action_type = 'group_message' THEN 'GROUP_REWARD'::text
      WHEN v_contrib.action_type = 'referral' THEN 'REFERRAL_REWARD'::text
      ELSE 'ADMIN_ADJUSTMENT'::text
    END;

    INSERT INTO public.reward_transactions (
      user_id,
      points,
      transaction_type,
      reference_id,
      reference_type,
      metadata
    ) VALUES (
      v_contrib.user_id,
      v_contrib.final_points,
      v_transaction_type,
      p_contribution_id,
      v_contrib.target_type,
      jsonb_build_object('approved_by_admin', auth.uid(), 'reason', p_reason)
    );
  ELSE
    -- Update contribution status
    UPDATE public.pending_contributions
    SET status = 'rejected',
        rejection_reason = p_reason,
        validated_at = now()
    WHERE id = p_contribution_id;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 3. FUNCTION: REQUEST WITHDRAWAL ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_amount NUMERIC(12,2),
  p_payment_provider TEXT,
  p_idempotency_key TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_cashout_active BOOLEAN;
  v_available_cash NUMERIC(12,2);
  v_created_at TIMESTAMPTZ;
  v_min_age_days INTEGER;
  v_min_threshold NUMERIC(12,2);
  v_min_trust_score INTEGER;
  v_trust_score INTEGER;
  v_account_status TEXT;
  v_withdrawal_id UUID;
  v_existing_id UUID;
BEGIN
  -- Authenticated user required
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  -- 1. Check idempotency
  SELECT id INTO v_existing_id FROM public.reward_withdrawals WHERE idempotency_key = p_idempotency_key;
  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  -- 2. Check Kill Switch
  SELECT (value->>'cashout_active')::boolean INTO v_cashout_active FROM public.reward_config WHERE key = 'kill_switches';
  IF NOT COALESCE(v_cashout_active, true) THEN
    RAISE EXCEPTION 'Les retraits sont temporairement désactivés par un administrateur';
  END IF;

  -- 3. Get User Account & Trust
  SELECT available_cash, status INTO v_available_cash, v_account_status FROM public.reward_accounts WHERE user_id = v_user_id;
  SELECT created_at, trust_score INTO v_created_at, v_trust_score FROM public.user_profiles WHERE id = v_user_id;

  IF v_account_status IN ('suspended', 'limited') THEN
    RAISE EXCEPTION 'Votre compte n''est pas autorisé à effectuer des retraits';
  END IF;

  -- 4. Check age constraint
  SELECT value::integer INTO v_min_age_days FROM public.reward_config WHERE key = 'cashout_min_age_days';
  IF v_created_at > (now() - (COALESCE(v_min_age_days, 30) || ' days')::interval) THEN
    RAISE EXCEPTION 'Votre compte est trop récent pour effectuer un retrait';
  END IF;

  -- 5. Check trust score constraint
  SELECT value::integer INTO v_min_trust_score FROM public.reward_config WHERE key = 'cashout_min_trust_score';
  IF COALESCE(v_trust_score, 50) < COALESCE(v_min_trust_score, 40) THEN
    RAISE EXCEPTION 'Votre score de confiance est insuffisant pour effectuer un retrait';
  END IF;

  -- 6. Check min threshold
  SELECT value::numeric(12,2) INTO v_min_threshold FROM public.reward_config WHERE key = 'cashout_min_threshold';
  IF p_amount < COALESCE(v_min_threshold, 20.00) THEN
    RAISE EXCEPTION 'Le montant minimum de retrait est de % €', COALESCE(v_min_threshold, 20.00);
  END IF;

  -- 7. Check balance
  IF p_amount > v_available_cash THEN
    RAISE EXCEPTION 'Solde de récompenses disponibles insuffisant';
  END IF;

  -- 8. Deduct available cash and move to pending cash (atomic lock)
  UPDATE public.reward_accounts
  SET available_cash = available_cash - p_amount,
      pending_cash = pending_cash + p_amount,
      updated_at = now()
  WHERE user_id = v_user_id;

  -- 9. Insert withdrawal request
  INSERT INTO public.reward_withdrawals (
    user_id,
    amount,
    points_redeemed,
    currency,
    status,
    payment_provider,
    idempotency_key,
    metadata,
    risk_score
  ) VALUES (
    v_user_id,
    p_amount,
    0,
    'EUR',
    'pending',
    p_payment_provider,
    p_idempotency_key,
    p_metadata,
    CASE WHEN COALESCE(v_trust_score, 50) < 50 THEN 40 ELSE 0 END
  )
  RETURNING id INTO v_withdrawal_id;

  RETURN v_withdrawal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 4. FUNCTION: FINALIZE REWARD PERIOD ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.finalize_reward_period(
  p_period_id TEXT,
  p_eligible_revenue NUMERIC(12,2)
)
RETURNS BOOLEAN AS $$
DECLARE
  v_period RECORD;
  v_pool_pct NUMERIC(12,2);
  v_monthly_cap NUMERIC(12,2);
  v_security_reserve NUMERIC(12,2);
  v_pool_size NUMERIC(12,2);
  v_total_points INTEGER;
  v_point_weight NUMERIC(20,8);
  v_user RECORD;
  v_user_payout NUMERIC(12,2);
  v_distributed_sum NUMERIC(12,2) := 0.00;
  v_remaining_residual NUMERIC(12,2) := 0.00;
BEGIN
  -- Verify admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès interdit';
  END IF;

  SELECT * INTO v_period FROM public.reward_periods WHERE id = p_period_id;
  IF v_period IS NULL THEN
    RAISE EXCEPTION 'Période introuvable';
  END IF;

  IF v_period.status <> 'OPEN' THEN
    RAISE EXCEPTION 'Cette période ne peut pas être finalisée (statut actuel: %)', v_period.status;
  END IF;

  -- Update to CALCULATING
  UPDATE public.reward_periods
  SET status = 'CALCULATING',
      eligible_revenue = p_eligible_revenue,
      updated_at = now()
  WHERE id = p_period_id;

  -- 1. Read Pool Config
  SELECT value::numeric(12,2) INTO v_pool_pct FROM public.reward_config WHERE key = 'pool_percentage';
  SELECT value::numeric(12,2) INTO v_monthly_cap FROM public.reward_config WHERE key = 'monthly_pool_cap';
  SELECT value::numeric(12,2) INTO v_security_reserve FROM public.reward_config WHERE key = 'security_reserve';

  -- Calculate Pool size
  v_pool_size := LEAST(v_monthly_cap, p_eligible_revenue * v_pool_pct) - v_security_reserve;
  IF v_pool_size < 0 THEN
    v_pool_size := 0.00;
  END IF;

  -- 2. Sum eligible points across all active reward accounts
  SELECT COALESCE(SUM(eligible_points), 0) INTO v_total_points FROM public.reward_accounts WHERE status <> 'suspended';

  IF v_total_points > 0 THEN
    v_point_weight := v_pool_size / v_total_points;
  ELSE
    v_point_weight := 0.00000000;
  END IF;

  -- Update period details
  UPDATE public.reward_periods
  SET status = 'DISTRIBUTING',
      reward_pool = v_pool_size,
      total_valid_points = v_total_points,
      point_weight = v_point_weight,
      updated_at = now()
  WHERE id = p_period_id;

  -- 3. Distribute cash to users and reset period points
  FOR v_user IN 
    SELECT user_id, eligible_points FROM public.reward_accounts WHERE eligible_points > 0 AND status <> 'suspended'
  LOOP
    v_user_payout := ROUND(v_user.eligible_points * v_point_weight, 2);
    v_distributed_sum := v_distributed_sum + v_user_payout;

    -- Credit user account available cash
    UPDATE public.reward_accounts
    SET available_cash = available_cash + v_user_payout,
        eligible_points = 0,
        earned_this_period = 0,
        updated_at = now()
    WHERE user_id = v_user.user_id;

    -- Write Redemption points transaction
    INSERT INTO public.reward_transactions (
      user_id,
      points,
      transaction_type,
      reference_id,
      reference_type,
      metadata
    ) VALUES (
      v_user.user_id,
      -v_user.eligible_points,
      'REDEMPTION',
      NULL,
      'period_conversion',
      jsonb_build_object('period_id', p_period_id, 'payout_eur', v_user_payout)
    );
  END LOOP;

  -- Calculate rounding residues
  v_remaining_residual := v_pool_size - v_distributed_sum;

  -- Close the period
  UPDATE public.reward_periods
  SET status = 'CLOSED',
      distributed_amount = v_distributed_sum,
      remaining_amount = v_remaining_residual,
      updated_at = now()
  WHERE id = p_period_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 5. FUNCTION: PROCESS WITHDRAWAL ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_withdrawal(
  p_withdrawal_id UUID,
  p_approve BOOLEAN,
  p_reference TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_withdrawal RECORD;
BEGIN
  -- Admin only
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès interdit';
  END IF;

  SELECT * INTO v_withdrawal FROM public.reward_withdrawals WHERE id = p_withdrawal_id;
  IF v_withdrawal IS NULL THEN
    RAISE EXCEPTION 'Retrait introuvable';
  END IF;

  IF v_withdrawal.status <> 'pending' AND v_withdrawal.status <> 'under_review' THEN
    RAISE EXCEPTION 'Ce retrait a déjà été traité (statut: %)', v_withdrawal.status;
  END IF;

  IF p_approve THEN
    -- Approve and deduct from pending cash
    UPDATE public.reward_withdrawals
    SET status = 'paid',
        payment_reference = p_reference,
        reviewed_at = now(),
        processed_at = now()
    WHERE id = p_withdrawal_id;

    UPDATE public.reward_accounts
    SET pending_cash = GREATEST(0, pending_cash - v_withdrawal.amount),
        updated_at = now()
    WHERE user_id = v_withdrawal.user_id;

    -- Add to audit logs
    INSERT INTO public.admin_audit_logs (
      admin_email,
      action,
      target_table,
      target_id,
      target_name,
      new_data
    ) VALUES (
      'admin',
      'APPROVE_WITHDRAWAL',
      'reward_withdrawals',
      p_withdrawal_id::text,
      'Withdrawal approved for user ' || v_withdrawal.user_id::text,
      jsonb_build_object('amount', v_withdrawal.amount, 'reference', p_reference)
    );
  ELSE
    -- Reject and move pending cash back to available cash
    UPDATE public.reward_withdrawals
    SET status = 'rejected',
        rejection_reason = p_reason,
        reviewed_at = now(),
        processed_at = now()
    WHERE id = p_withdrawal_id;

    UPDATE public.reward_accounts
    SET pending_cash = GREATEST(0, pending_cash - v_withdrawal.amount),
        available_cash = available_cash + v_withdrawal.amount,
        updated_at = now()
    WHERE user_id = v_withdrawal.user_id;

    -- Add to audit logs
    INSERT INTO public.admin_audit_logs (
      admin_email,
      action,
      target_table,
      target_id,
      target_name,
      new_data
    ) VALUES (
      'admin',
      'REJECT_WITHDRAWAL',
      'reward_withdrawals',
      p_withdrawal_id::text,
      'Withdrawal rejected for user ' || v_withdrawal.user_id::text,
      jsonb_build_object('amount', v_withdrawal.amount, 'reason', p_reason)
    );
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
