-- ============================================================================
-- PHASE 1 — Verrouillage des soldes : le navigateur n'écrit plus aucun point.
--   1. Garde colonnes v2 (loyalty_points, loyalty_level, xp, level)
--   2. Fermeture loyalty_history / loyalty_redemptions / orders au client
--   3. Backfill d'ouvertures (Σ journal = solde, sans perte)
--   4. RPC legacy service_role : spend / earn / cart_refund / redeem
--   5. RPC commandes service_role : create_shop_order
-- Additive et idempotente. Down : migrations_down/20261010140000_phase1_balance_lockdown.down.sql
-- ============================================================================

-- 1. GARDE COLONNES v2 -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_user_profile_privileged_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
END; $$;

-- 2. FERMETURE DES ÉCRITURES LEGACY ------------------------------------------
DROP POLICY IF EXISTS "auth_insert_loyalty_history" ON public.loyalty_history;
DROP POLICY IF EXISTS "auth_insert_loyalty_redemptions" ON public.loyalty_redemptions;
REVOKE INSERT, UPDATE, DELETE ON public.loyalty_history FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.loyalty_redemptions FROM anon, authenticated;

-- 3. COMMANDES : plus d'écriture cliente (forge de points via trigger)
DROP POLICY IF EXISTS "users_manage_own_orders" ON public.orders;
DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
CREATE POLICY "orders_select_own" ON public.orders
  FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM anon, authenticated;

-- 4. BACKFILL D'OUVERTURES ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.legacy_loyalty_backfill_openings(p_version text DEFAULT 'v1')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_count integer;
BEGIN
  INSERT INTO public.loyalty_history (user_id, action, points, type, source_id)
  SELECT p.id,
         'Solde reporté (réconciliation Phase 1)',
         p.loyalty_points - COALESCE(j.sum_points, 0),
         'opening_balance',
         'opening:' || p.id || ':' || COALESCE(p_version, 'v1')
  FROM public.user_profiles p
  LEFT JOIN (SELECT user_id, SUM(points) AS sum_points FROM public.loyalty_history GROUP BY user_id) j
    ON j.user_id = p.id
  WHERE p.loyalty_points - COALESCE(j.sum_points, 0) <> 0
    AND NOT EXISTS (
      SELECT 1 FROM public.loyalty_history h
      WHERE h.source_id = 'opening:' || p.id || ':' || COALESCE(p_version, 'v1')
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

SELECT public.legacy_loyalty_backfill_openings();

-- 5. ÉCHELLE NIVEAU LEGACY (miroir de update_loyalty_points) ------------------
CREATE OR REPLACE FUNCTION public.legacy_loyalty_level_for(p_points integer)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_points >= 7500 THEN 'Légende du Voyage'
    WHEN p_points >= 3500 THEN 'Guide de Montagne'
    WHEN p_points >= 1500 THEN 'Randonneur Expert'
    WHEN p_points >= 500  THEN 'Aventurier'
    ELSE 'Explorateur'
  END;
$$;

-- 6. RPC LEGACY — dépense -----------------------------------------------------
-- Idempotence par source_id, verrou user_profiles FOR UPDATE, solde = Σ journal,
-- refus si insuffisant, recalcul de loyalty_level.
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

  IF EXISTS (SELECT 1 FROM public.loyalty_history WHERE source_id = p_source_id) THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'balance', v_balance);
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

-- 7. RPC LEGACY — gain --------------------------------------------------------
-- Symétrique de spend (points positifs, type paramétrable).
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

  IF EXISTS (SELECT 1 FROM public.loyalty_history WHERE source_id = p_source_id) THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'balance', v_balance);
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

-- 8. RPC LEGACY — remboursement d'un article offert (panier) ------------------
-- Montant repris du journal (jamais du client) : ligne cart_free_apply:<id>.
-- Idempotent via cart_free_remove:<id>.
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

  IF EXISTS (SELECT 1 FROM public.loyalty_history WHERE source_id = 'cart_free_remove:' || p_cart_item_id) THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'balance', v_balance);
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

-- 9. RPC LEGACY — échange de récompense ---------------------------------------
-- Verrou profil + verrou récompense, échange unique (user, reward).
CREATE OR REPLACE FUNCTION public.legacy_loyalty_redeem(
  p_user_id uuid,
  p_reward_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_reward RECORD;
  v_balance integer;
  v_new_balance integer;
  v_level text;
BEGIN
  PERFORM 1 FROM public.user_profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;

  SELECT * INTO v_reward
  FROM public.loyalty_rewards
  WHERE id = p_reward_id
  FOR UPDATE;

  IF NOT FOUND OR v_reward.available = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'reward_unavailable');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.loyalty_redemptions
    WHERE user_id = p_user_id AND reward_id = p_reward_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_redeemed');
  END IF;

  SELECT COALESCE(SUM(points), 0) INTO v_balance
  FROM public.loyalty_history
  WHERE user_id = p_user_id;

  IF v_balance < v_reward.points_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance', 'balance', v_balance);
  END IF;

  INSERT INTO public.loyalty_history (user_id, action, points, type, source_id)
  VALUES (p_user_id, 'Récompense échangée : ' || v_reward.title, -v_reward.points_cost, 'reward_redemption', 'reward_' || p_reward_id);

  INSERT INTO public.loyalty_redemptions (user_id, reward_id, points_spent, status)
  VALUES (p_user_id, p_reward_id, v_reward.points_cost, 'completed');

  v_new_balance := v_balance - v_reward.points_cost;
  v_level := public.legacy_loyalty_level_for(v_new_balance);

  UPDATE public.user_profiles
     SET loyalty_level = v_level,
         updated_at = now()
   WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'balance', v_new_balance, 'level', v_level);
END; $$;

-- 10. RPC COMMANDES — création serveur ----------------------------------------
-- Prix, livraison et total calculés serveur ; résolution produits par slug ;
-- stock décrémenté par article ; le trigger process_order_points reste
-- l'unique créditeur de points.
CREATE OR REPLACE FUNCTION public.create_shop_order(
  p_user_id uuid,
  p_payment_method text,
  p_shipping_address jsonb,
  p_items jsonb,
  p_shipping_option text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_item jsonb;
  v_line jsonb;
  v_slug text;
  v_qty integer;
  v_product RECORD;
  v_subtotal numeric := 0;
  v_shipping numeric;
  v_total numeric;
  v_lines jsonb := '[]'::jsonb;
  v_resolved jsonb := '[]'::jsonb;
  v_order_number text;
  v_order_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Identité non concordante' USING ERRCODE='42501';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_items');
  END IF;

  FOR v_item IN SELECT elem FROM jsonb_array_elements(p_items) AS t(elem) LOOP
    v_slug := v_item->>'slug';
    v_qty := CASE
      WHEN (v_item->>'quantity') ~ '^[0-9]+$' THEN (v_item->>'quantity')::integer
      ELSE NULL
    END;

    IF v_slug IS NULL OR btrim(v_slug) = '' OR v_qty IS NULL OR v_qty < 1 THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_items');
    END IF;

    SELECT id, slug, name, price_eur INTO v_product
    FROM public.shop_products
    WHERE slug = v_slug AND available = true
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'unknown_product', 'slug', v_slug);
    END IF;

    v_subtotal := v_subtotal + (v_product.price_eur * v_qty);
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'name', v_product.name,
      'quantity', v_qty,
      'unit_price_eur', v_product.price_eur,
      'slug', v_product.slug
    ));
    v_resolved := v_resolved || jsonb_build_array(jsonb_build_object(
      'id', v_product.id,
      'quantity', v_qty
    ));
  END LOOP;

  IF p_shipping_option = 'standard' THEN
    v_shipping := CASE WHEN v_subtotal >= 99 THEN 0 ELSE 5.9 END;
  ELSIF p_shipping_option = 'express' THEN
    v_shipping := 9.9;
  ELSIF p_shipping_option = 'relay' THEN
    v_shipping := 3.9;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_shipping');
  END IF;

  v_total := v_subtotal + v_shipping;

  v_order_number := 'KDV-' || upper(to_hex((extract(epoch from clock_timestamp())*1000)::bigint)) || '-' || upper(substr(md5(random()::text), 1, 4));

  INSERT INTO public.orders (
    user_id, order_number, status, payment_method, shipping_address,
    items, subtotal_eur, shipping_eur, total_eur
  ) VALUES (
    p_user_id, v_order_number, 'confirmed', p_payment_method,
    COALESCE(p_shipping_address, '{}'::jsonb),
    v_lines, v_subtotal, v_shipping, v_total
  ) RETURNING id INTO v_order_id;

  FOR v_line IN SELECT elem FROM jsonb_array_elements(v_resolved) AS t(elem) LOOP
    PERFORM public.decrement_stock_on_order(
      (v_line->>'id')::uuid,
      (v_line->>'quantity')::integer,
      v_order_id::text,
      p_user_id
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'orderId', v_order_id,
    'orderNumber', v_order_number,
    'totalEur', v_total
  );
END; $$;

-- 11. PRIVILÈGES : service_role uniquement ------------------------------------
REVOKE ALL ON FUNCTION public.legacy_loyalty_backfill_openings(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.legacy_loyalty_backfill_openings(text) TO service_role;

REVOKE ALL ON FUNCTION public.legacy_loyalty_level_for(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.legacy_loyalty_level_for(integer) TO service_role;

REVOKE ALL ON FUNCTION public.legacy_loyalty_spend(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.legacy_loyalty_spend(uuid, integer, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.legacy_loyalty_earn(uuid, integer, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.legacy_loyalty_earn(uuid, integer, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.legacy_loyalty_cart_refund(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.legacy_loyalty_cart_refund(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.legacy_loyalty_redeem(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.legacy_loyalty_redeem(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.create_shop_order(uuid, text, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_shop_order(uuid, text, jsonb, jsonb, text) TO service_role;
