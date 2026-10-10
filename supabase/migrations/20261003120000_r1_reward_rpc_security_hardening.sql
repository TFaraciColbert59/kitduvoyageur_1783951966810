-- ============================================================================
-- 20261003120000_r1_reward_rpc_security_hardening.sql
--
-- LKDV Community Architecture — Milestone 1 (Requirement R1)
-- Durcissement de la sécurité du système de récompenses et des fonctions RPC :
--
-- 1. Redéfinition stricte de `claim_reward_points` :
--    • search_path immuable : `SET search_path = public, pg_temp;`
--    • Contrôle d'identité strict :
--        - Si session authentifiée (`auth.uid() IS NOT NULL`), vérifie que
--          `auth.uid() = p_user_id` (interdit l'usurpation d'identité).
--        - Si non authentifié (`auth.uid() IS NULL`), exige que le rôle appelant
--          soit `service_role` (interdit les appels anonymes directs).
--    • Vérification systématique de l'existence de la cible (`p_target_id`) et
--      du profil utilisateur (`p_user_id`) avant toute écriture.
--    • Révocation totale d'`EXECUTE` pour `PUBLIC`, `anon` et `authenticated`.
--    • Attribution d'`EXECUTE` exclusivement au `service_role` (consommé par
--      la route d'API serveur `/api/rewards/claim`).
--
-- 2. Sécurisation du `search_path` des fonctions SECURITY DEFINER héritées :
--    • Application de `SET search_path = public, pg_temp;` sur l'ensemble des
--      34 fonctions identifiées lors de l'audit architectural afin d'éliminer
--      les risques de détournement de schéma / injection par search_path.
--
-- Migration additive, défensive et idempotente.
-- ============================================================================

-- ── 1. Redéfinition sécurisée de claim_reward_points ─────────────────────────

CREATE OR REPLACE FUNCTION public.claim_reward_points(
  p_user_id UUID,
  p_action_type TEXT,
  p_target_id UUID,
  p_target_type TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
  -- A. Gardes d'identité et de rôle (Anti-usurpation / Défense en profondeur)
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Non autorisé: usurpation d''identité interdite' USING ERRCODE = '42501';
  END IF;

  IF auth.uid() IS NULL AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Non autorisé: appel anonyme interdit' USING ERRCODE = '42501';
  END IF;

  -- B. Vérification de l'existence de l'utilisateur
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Utilisateur introuvable' USING ERRCODE = 'P0002';
  END IF;

  -- C. Vérification de l'existence de la cible avant traitement
  IF p_target_type = 'post' THEN
    IF NOT EXISTS (SELECT 1 FROM public.community_posts WHERE id = p_target_id) THEN
      RAISE EXCEPTION 'Cible introuvable: publication inexistante' USING ERRCODE = 'P0002';
    END IF;
  ELSIF p_target_type = 'carnet' THEN
    IF NOT EXISTS (SELECT 1 FROM public.carnets WHERE id = p_target_id) THEN
      RAISE EXCEPTION 'Cible introuvable: carnet inexistant' USING ERRCODE = 'P0002';
    END IF;
  ELSIF p_target_type = 'comment' THEN
    IF NOT EXISTS (SELECT 1 FROM public.post_comments WHERE id = p_target_id) THEN
      RAISE EXCEPTION 'Cible introuvable: commentaire inexistant' USING ERRCODE = 'P0002';
    END IF;
  ELSIF p_target_type = 'club_topic' THEN
    IF NOT EXISTS (SELECT 1 FROM public.club_topics WHERE id = p_target_id) THEN
      RAISE EXCEPTION 'Cible introuvable: sujet de club inexistant' USING ERRCODE = 'P0002';
    END IF;
  ELSIF p_target_type = 'user' OR p_action_type = 'referral' THEN
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_target_id) THEN
      RAISE EXCEPTION 'Cible introuvable: profil utilisateur inexistant' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  -- 1. Check Kill Switch
  SELECT (value->>'rewards_active')::boolean INTO v_rewards_active
  FROM public.reward_config
  WHERE key = 'kill_switches';

  IF NOT COALESCE(v_rewards_active, true) THEN
    RAISE EXCEPTION 'Les récompenses sont temporairement désactivées';
  END IF;

  -- 2. Check Account Status & Profile Trust
  SELECT status INTO v_account_status FROM public.reward_accounts WHERE user_id = p_user_id;
  SELECT trust_score INTO v_trust_score FROM public.user_profiles WHERE id = p_user_id;

  IF v_account_status = 'suspended' THEN
    RAISE EXCEPTION 'Ce compte est suspendu de toute récompense';
  END IF;

  -- 3. Check Self-Action (interdiction de s'attribuer des points sur son propre contenu)
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
  SELECT (value->>p_action_type)::integer INTO v_base_points
  FROM public.reward_config
  WHERE key = 'action_base_points';

  IF v_base_points IS NULL OR v_base_points = 0 THEN
    RETURN NULL;
  END IF;

  -- 5. Check Action Limits (quotidienne et hebdomadaire)
  SELECT (value->>(p_action_type || '_daily'))::integer, (value->>(p_action_type || '_weekly'))::integer
  INTO v_daily_limit, v_weekly_limit
  FROM public.reward_config
  WHERE key = 'action_limits';

  IF v_daily_limit IS NOT NULL THEN
    SELECT COUNT(*)::integer INTO v_daily_count
    FROM public.pending_contributions
    WHERE user_id = p_user_id
      AND action_type = p_action_type
      AND status <> 'rejected'
      AND created_at > now() - INTERVAL '1 day';

    IF v_daily_count >= v_daily_limit THEN
      RAISE EXCEPTION 'Limite quotidienne de gains pour cette action atteinte';
    END IF;
  END IF;

  IF v_weekly_limit IS NOT NULL THEN
    SELECT COUNT(*)::integer INTO v_weekly_count
    FROM public.pending_contributions
    WHERE user_id = p_user_id
      AND action_type = p_action_type
      AND status <> 'rejected'
      AND created_at > now() - INTERVAL '7 days';

    IF v_weekly_count >= v_weekly_limit THEN
      RAISE EXCEPTION 'Limite hebdomadaire de gains pour cette action atteinte';
    END IF;
  END IF;

  -- 6. Check Trust Level daily cap
  SELECT COALESCE(level, 1) INTO v_user_level FROM public.user_profiles WHERE id = p_user_id;
  SELECT (value->>(v_user_level::text))::integer INTO v_level_cap
  FROM public.reward_config
  WHERE key = 'trust_level_caps';

  IF v_level_cap IS NOT NULL AND v_level_cap <> -1 THEN
    SELECT COALESCE(SUM(final_points), 0)::integer INTO v_points_earned_today
    FROM public.pending_contributions
    WHERE user_id = p_user_id
      AND status <> 'rejected'
      AND created_at > now() - INTERVAL '1 day';

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

  -- 8. Conditions d'auto-approbation
  IF v_account_status = 'limited' THEN
    v_status := 'pending';
  ELSIF COALESCE(v_trust_score, 50) >= 60 OR p_action_type IN ('like', 'group_message') THEN
    v_status := 'approved';
  ELSE
    v_status := 'pending';
  END IF;

  -- 9. Insertion de la contribution
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

  -- 10. Si approuvé, inscription immédiate dans le ledger des transactions
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
$$;

-- Révocation stricte des permissions sur claim_reward_points
REVOKE ALL ON FUNCTION public.claim_reward_points(UUID, TEXT, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_reward_points(UUID, TEXT, UUID, TEXT, JSONB) TO service_role;

COMMENT ON FUNCTION public.claim_reward_points(UUID, TEXT, UUID, TEXT, JSONB) IS
  'Attribution sécurisée de points de récompense — service_role uniquement, search_path public/pg_temp strict, vérification d''identité et validation des cibles.';


-- ── 2. Durcissement du search_path des 34 fonctions SECURITY DEFINER héritées ──

DO $$
DECLARE
  v_proc RECORD;
BEGIN
  -- Boucle défensive sur toutes les fonctions d'audit existantes dans le schéma public
  FOR v_proc IN
    SELECT p.oid::regprocedure AS proc_name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        -- 34 fonctions héritées auditées (Phase 1 legacy public, extensions)
        'get_admin_role',
        'handle_new_user',
        'update_loyalty_points',
        'can_user_bid',
        'can_user_sell_auction',
        'place_bid',
        'set_auto_bid',
        'get_comparable_sales',
        'get_occasion_listing_for_product',
        'increment_stock',
        'handle_new_user_reward_account',
        'update_reward_account_on_transaction',
        'update_reward_account_on_contribution',
        'claim_reward_points',
        'process_pending_contribution',
        'request_withdrawal',
        'finalize_reward_period',
        'process_withdrawal',
        'notify',
        'trg_on_community_post_like',
        'trg_on_community_post_comment',
        'trg_on_carnet_like',
        'trg_on_carnet_comment',
        'trg_on_group_message',
        'trg_on_group_member_join',
        'trg_on_group_task_assigned',
        'trg_on_group_expense_added',
        'send_digests',
        'cleanup_expired_trash_kits',
        'record_hike_gear_usage',
        'purge_expired_lkv_events',
        'lkv_ensure_auto_crew',
        'lkv_seed_trip_checklist_template',
        'get_user_badges_progress',
        -- Fonctions critiques associées (triggers et RPCs d'interaction sociale)
        'toggle_community_post_like',
        'decrement_stock_on_order'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', v_proc.proc_name);
  END LOOP;
END $$;
