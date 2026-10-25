-- ============================================================================
-- TEMPLATE « HONORER » — matérialiser une commande pour un paiement orphelin
-- ============================================================================
-- ⚠️  À n'exécuter QU'UNE FOIS la livraison CONFIRMÉE (colis parti / déjà reçu).
-- ⚠️  À valider sur la COPIE d'abord ; chaque exécution concerne UN orphelin.
-- ⚠️  Nécessite une session service_role (la RLS interdit l'insert client par
--      design — c'est voulu). Ne pas exécuter dans le SQL editor connecté en anon.
--
-- Mirroire le flux du webhook (src/app/api/stripe/webhook/route.ts) :
--   orders status 'confirmed' + notes 'RÉCONCILIATION: <session>' + stripe_session_id
--   → order_items par produit → decrement_stock_on_order par item.
--
-- AVANT d'exécuter : éditer les constantes du DO block avec les valeurs du JSON
-- sorti par scripts/db/reconcile_stripe.mjs (docs/reconciliation/orphans_*.json).

DO $$
DECLARE
  -- ▶ À ÉDITER par orphelin :
  v_session_id   constant text    := 'cs_XXX';                              -- session_id Stripe
  v_email        constant text    := 'client@exemple.fr';                   -- customer_email (JSON)
  v_amount_eu    constant numeric := 89.90;                                 -- montant (JSON, déjà en €)
  v_items        constant jsonb   := '[{"product_id":"5f…","name":"Sac 45L","quantity":1}]'; -- line_items du JSON

  -- (ne pas toucher)
  v_user_id      uuid;
  v_order_id     uuid;
  v_order_number text;
  v_item         record;
BEGIN
  -- 1) Rattacher le compte : par email (orders.user_id REFERENCES user_profiles).
  SELECT id INTO v_user_id
  FROM public.user_profiles
  WHERE lower(email) = lower(v_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE WARNING 'Aucun compte user_profiles pour % — la commande sera sans user_id. Si orders.user_id est NOT NULL, passer en ENQUÊTE (collision historique entre les formes de la table).', v_email;
  END IF;

  -- 2) Commande (même forme que le webhook, notes de traçage distincte).
  v_order_number := 'RECON-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(v_session_id, 'cs_', ''), 1, 8));

  BEGIN
    INSERT INTO public.orders
      (user_id, order_number, status, payment_method, shipping_address, items,
       subtotal_eur, shipping_eur, total_eur, notes, stripe_session_id)
    VALUES
      (v_user_id, v_order_number, 'confirmed', 'card', '{}'::jsonb, v_items,
       v_amount_eu, 0, v_amount_eu, 'RÉCONCILIATION: ' || v_session_id, v_session_id)
    RETURNING id INTO v_order_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Commande déjà couverte pour % — vérifier la couverture avant de continuer.', v_session_id;
  END;

  RAISE NOTICE 'Commande créée : % (id %)', v_order_number, v_order_id;

  -- 3) order_items + déstockage (un par produit).
  FOR v_item IN
    SELECT value->>'product_id' AS product_id,
           value->>'name'       AS name,
           (value->>'quantity')::int AS qty
    FROM jsonb_array_elements(v_items)
  LOOP
    IF v_item.product_id IS NULL OR v_item.product_id = '' THEN
      RAISE WARNING '  line item sans product_id (%, qty %) → commande tracée, order_items non créé', v_item.name, v_item.qty;
      CONTINUE;
    END IF;

    PERFORM public.decrement_stock_on_order(
      v_item.product_id::uuid, v_item.qty, v_order_id::text, v_user_id
    );

    INSERT INTO public.order_items
      (order_id, product_id, product_name, quantity, unit_price_eur, total_price_eur, transaction_type)
    SELECT v_order_id, p.id, p.name, v_item.qty, p.price_eur, p.price_eur * v_item.qty, 'achat'
    FROM public.shop_products p
    WHERE p.id = v_item.product_id::uuid;

    RAISE NOTICE '  + order_item % (x%) déstocké', v_item.name, v_item.qty;
  END LOOP;

  RAISE NOTICE '✔ FINI — tracer la ligne dans RECONCILIATION_STRIPE.md (n° commande %).', v_order_number;
END $$;

-- ---------------------------------------------------------------------------
-- Remboursement (décision « rembourser ») : ce n'est PAS du SQL — passer par le
-- dashboard Stripe ou le CLI :
--   stripe refunds create --payment-intent <payment_intent>
-- puis tracer la ligne dans RECONCILIATION_STRIPE.md (refund ID).
-- ---------------------------------------------------------------------------