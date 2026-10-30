-- AUD-VA-03: resume an interrupted paid checkout under the order row lock.
-- Deploy before the webhook. No customer role can invoke these functions.
ALTER TABLE public.orders ADD COLUMN stripe_refund_seen_at timestamptz;

CREATE FUNCTION public.resume_stripe_checkout(
  p_order_id uuid, p_session_id text, p_lines jsonb,
  p_merchandise_cents integer, p_metadata jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE
  o public.orders%ROWTYPE; line record; item public.order_items%ROWTYPE;
  product public.shop_products%ROWTYPE; n integer; movements integer; moved integer;
  receipt jsonb; result jsonb := '[]'; incoming_plan text; incoming_passes jsonb;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR o.stripe_session_id IS DISTINCT FROM p_session_id
      OR o.payment_method IS DISTINCT FROM 'card' THEN
    RAISE EXCEPTION 'checkout order/session mismatch';
  END IF;
  -- Refund wins over a later retry, even before its financial reversal finishes.
  IF o.stripe_refund_seen_at IS NOT NULL OR o.payment_state IN ('partially_refunded','refunded') THEN
    IF o.user_id IS NOT NULL AND o.payment_state = 'pending' AND p_merchandise_cents > 0 THEN
      -- The refund arrived before the original financial record. Do not
      -- resurrect delivery/grants, or silently claim this payment is complete.
      RAISE EXCEPTION 'refund preceded encashment: financial reconciliation required';
    END IF;
    RETURN jsonb_build_object('terminal', true, 'items', '[]'::jsonb);
  END IF;
  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR p_merchandise_cents IS NULL
      OR p_merchandise_cents < 0 THEN RAISE EXCEPTION 'invalid paid checkout'; END IF;

  -- Stable product lock order also serializes distinct orders for the same stock.
  FOR line IN
    SELECT (x->>'product_id')::uuid AS product_id,
      sum((x->>'quantity')::integer)::integer AS quantity,
      sum((x->>'total_cents')::bigint)::bigint AS total_cents
    FROM jsonb_array_elements(p_lines) x GROUP BY 1 ORDER BY 1
  LOOP
    IF line.product_id IS NULL OR line.quantity IS NULL OR line.quantity <= 0
        OR line.total_cents IS NULL OR line.total_cents < 0 THEN
      RAISE EXCEPTION 'invalid paid line';
    END IF;
    SELECT * INTO product FROM public.shop_products WHERE id = line.product_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'paid product absent from canonical stock'; END IF;
    SELECT count(*) INTO n FROM public.order_items
      WHERE order_id = o.id AND product_id = line.product_id;
    IF n > 1 THEN RAISE EXCEPTION 'ambiguous legacy order lines'; END IF;
    IF n = 1 THEN
      SELECT * INTO item FROM public.order_items WHERE order_id = o.id AND product_id = line.product_id;
      IF item.quantity IS DISTINCT FROM line.quantity THEN RAISE EXCEPTION 'legacy quantity mismatch'; END IF;
    ELSE
      INSERT INTO public.order_items(order_id, product_id, product_slug, product_name,
        quantity, unit_price_eur, total_price_eur, transaction_type)
      VALUES(o.id, product.id, product.slug, product.name, line.quantity,
        line.total_cents::numeric / 100 / line.quantity, line.total_cents::numeric / 100, 'achat')
      RETURNING * INTO item;
    END IF;
    -- Historical rows/prices are retained. The durable stock movement is the
    -- idempotence proof, never merely the existence of an order_item.
    SELECT count(*), COALESCE(sum(-quantity_change), 0) INTO movements, moved
      FROM public.stock_movements WHERE product_id = product.id
        AND reference_type = 'order' AND reference_id = o.id::text AND movement_type = 'sale';
    IF movements = 0 THEN
      PERFORM public.decrement_stock_on_order(product.id, line.quantity, o.id::text, o.user_id);
    ELSIF movements <> 1 OR moved <> line.quantity THEN
      RAISE EXCEPTION 'ambiguous legacy stock movements';
    END IF;
    result := result || jsonb_build_array(jsonb_build_object('productId', product.id,
      'orderItemId', item.id, 'totalCents', round(item.total_price_eur * 100)));
  END LOOP;

  IF o.user_id IS NOT NULL AND p_merchandise_cents > 0 THEN
    receipt := public.record_order_encashment_event('stripe:' || p_session_id, o.id, 'payment', p_merchandise_cents);
    IF receipt->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'checkout encashment refused'; END IF;
  END IF;
  incoming_plan := CASE WHEN p_metadata->>'plan' IN ('free','explorer','expedition','group')
    THEN p_metadata->>'plan' ELSE 'free' END;
  SELECT COALESCE(jsonb_agg(DISTINCT pass), '[]'::jsonb) INTO incoming_passes FROM (
    SELECT trim(value) AS pass FROM jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(p_metadata->'passes') = 'array' THEN p_metadata->'passes'
      ELSE to_jsonb(string_to_array(COALESCE(p_metadata->>'passes', ''), ',')) END)
    UNION SELECT p_metadata->>'pass'
  ) p WHERE pass IN ('weekend','trip','expedition');
  IF o.user_id IS NOT NULL AND (incoming_plan <> 'free' OR incoming_passes <> '[]'::jsonb) THEN
    INSERT INTO public.user_entitlements(user_id, plan, active_passes, source)
    VALUES(o.user_id, incoming_plan, incoming_passes, 'stripe_metadata')
    ON CONFLICT(user_id) DO UPDATE SET
      plan = CASE WHEN array_position(ARRAY['free','explorer','expedition','group'], user_entitlements.plan)
        > array_position(ARRAY['free','explorer','expedition','group'], EXCLUDED.plan)
        THEN user_entitlements.plan ELSE EXCLUDED.plan END,
      active_passes = (SELECT COALESCE(jsonb_agg(DISTINCT value), '[]'::jsonb)
        FROM jsonb_array_elements(user_entitlements.active_passes || EXCLUDED.active_passes)),
      source = 'stripe_metadata', updated_at = now();
  END IF;
  RETURN jsonb_build_object('terminal', false, 'items', result);
END $$;
REVOKE ALL ON FUNCTION public.resume_stripe_checkout(uuid,text,jsonb,integer,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resume_stripe_checkout(uuid,text,jsonb,integer,jsonb) TO service_role;

-- Keep the existing attribution logic, but serialize it with checkout/refund.
ALTER FUNCTION public.insert_kit_attribution(uuid,uuid,uuid,integer,integer,jsonb,uuid)
  RENAME TO insert_kit_attribution_before_audva03;
REVOKE ALL ON FUNCTION public.insert_kit_attribution_before_audva03(uuid,uuid,uuid,integer,integer,jsonb,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
CREATE FUNCTION public.insert_kit_attribution(p_kit_id uuid, p_order_item_id uuid,
  p_product_id uuid, p_amount_cents integer, p_rate_bps integer, p_shares jsonb, p_buyer_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE o public.orders%ROWTYPE;
BEGIN
  SELECT orders.* INTO o FROM public.orders JOIN public.order_items oi ON oi.order_id = orders.id
    WHERE oi.id = p_order_item_id FOR UPDATE OF orders;
  IF NOT FOUND OR o.stripe_refund_seen_at IS NOT NULL
    OR o.payment_state IN ('partially_refunded','refunded') THEN RETURN NULL; END IF;
  RETURN public.insert_kit_attribution_before_audva03(p_kit_id, p_order_item_id,
    p_product_id, p_amount_cents, p_rate_bps, p_shares, p_buyer_user_id);
END $$;
REVOKE ALL ON FUNCTION public.insert_kit_attribution(uuid,uuid,uuid,integer,integer,jsonb,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_kit_attribution(uuid,uuid,uuid,integer,integer,jsonb,uuid) TO service_role;

ALTER FUNCTION public.reverse_kit_attribution_by_session(text) RENAME TO reverse_kit_attribution_by_session_before_audva03;
REVOKE ALL ON FUNCTION public.reverse_kit_attribution_by_session_before_audva03(text) FROM PUBLIC, anon, authenticated, service_role;
CREATE FUNCTION public.reverse_kit_attribution_by_session(p_stripe_session_id text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public.orders SET stripe_refund_seen_at = COALESCE(stripe_refund_seen_at, now())
    WHERE stripe_session_id = p_stripe_session_id;
  RETURN public.reverse_kit_attribution_by_session_before_audva03(p_stripe_session_id);
END $$;
REVOKE ALL ON FUNCTION public.reverse_kit_attribution_by_session(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_kit_attribution_by_session(text) TO service_role;
