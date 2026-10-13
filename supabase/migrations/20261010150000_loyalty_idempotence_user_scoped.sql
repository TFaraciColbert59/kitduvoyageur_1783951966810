-- ============================================================================
-- PHASE 1 — correctif : idempotence loyalty scopée par utilisateur.
--   Les contrôles EXISTS sur loyalty_history.source_id des RPC legacy étaient
--   globaux : deux utilisateurs partageant une même source (ids produit du
--   catalogue pour `cart_free_apply:` / `cart_free_remove:`) pouvaient se
--   bloquer mutuellement (remboursement sauté ⇒ points perdus, ou crédit sauté
--   pour l'autre utilisateur).
--   Correctif minimal : `AND user_id = p_user_id` sur les trois contrôles
--   d'idempotence (spend, earn, cart_refund). Toute autre sémantique est
--   identique à 20261010140000_phase1_balance_lockdown.sql.
-- Migration forward : 20261010140000 reste telle qu'appliquée en production.
-- Down : migrations_down/20261010150000_loyalty_idempotence_user_scoped.down.sql
-- ============================================================================

-- 1. legacy_loyalty_spend — idempotence user-scoped ---------------------------
CREATE OR REPLACE FUNCTION public.legacy_loyalty_spend(
  p_user_id uuid,
  p_points integer,
  p_reason text,
  p_source_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
END; $$;

-- 2. legacy_loyalty_earn — idempotence user-scoped ----------------------------
CREATE OR REPLACE FUNCTION public.legacy_loyalty_earn(
  p_user_id uuid,
  p_points integer,
  p_reason text,
  p_source_id text,
  p_type text DEFAULT 'earned'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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

  INSERT INTO public.loyalty_history (user_id, action, points, type, source_id)
  VALUES (p_user_id, COALESCE(p_reason, 'Gain'), p_points, COALESCE(p_type, 'earned'), p_source_id);

  v_new_balance := v_balance + p_points;
  v_level := public.legacy_loyalty_level_for(v_new_balance);

  UPDATE public.user_profiles
     SET loyalty_level = v_level,
         updated_at = now()
   WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'balance', v_new_balance, 'level', v_level);
END; $$;

-- 3. legacy_loyalty_cart_refund — remove idempotence user-scoped --------------
CREATE OR REPLACE FUNCTION public.legacy_loyalty_cart_refund(
  p_user_id uuid,
  p_cart_item_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_applied integer;
  v_balance integer;
  v_new_balance integer;
  v_level text;
BEGIN
  IF p_cart_item_id IS NULL OR length(p_cart_item_id) = 0 OR length(p_cart_item_id) > 200 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_source');
  END IF;

  PERFORM 1 FROM public.user_profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;

  SELECT points INTO v_applied
  FROM public.loyalty_history
  WHERE source_id = 'cart_free_apply:' || p_cart_item_id
    AND user_id = p_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_apply');
  END IF;

  SELECT COALESCE(SUM(points), 0) INTO v_balance
  FROM public.loyalty_history
  WHERE user_id = p_user_id;

  IF EXISTS (SELECT 1 FROM public.loyalty_history WHERE source_id = 'cart_free_remove:' || p_cart_item_id AND user_id = p_user_id) THEN
    SELECT loyalty_level INTO v_level FROM public.user_profiles WHERE id = p_user_id;
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'balance', v_balance, 'level', v_level);
  END IF;

  INSERT INTO public.loyalty_history (user_id, action, points, type, source_id)
  VALUES (p_user_id, 'Remboursement article offert (panier)', -v_applied, 'cart_refund', 'cart_free_remove:' || p_cart_item_id);

  v_new_balance := v_balance - v_applied;
  v_level := public.legacy_loyalty_level_for(v_new_balance);

  UPDATE public.user_profiles
     SET loyalty_level = v_level,
         updated_at = now()
   WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'balance', v_new_balance, 'level', v_level);
END; $$;

-- 4. PRIVILÈGES : service_role uniquement (ré-émis, idempotent) ---------------
REVOKE ALL ON FUNCTION public.legacy_loyalty_spend(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.legacy_loyalty_spend(uuid, integer, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.legacy_loyalty_earn(uuid, integer, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.legacy_loyalty_earn(uuid, integer, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.legacy_loyalty_cart_refund(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.legacy_loyalty_cart_refund(uuid, text) TO service_role;
