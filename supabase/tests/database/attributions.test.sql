-- ============================================================================
-- Part créateur — Lot 6 (RPC insert_kit_attribution, invariants)
--   • condition terrain : pas d'attribution sans session >= 1 km dans la lignée
--   • idempotence : rejeu webhook → une seule attribution par order_item
--   • auto-achat (buyer = forkeur) → aucune part pour l'acheteur
--   • somme des parts = commission (invariant strict)
--   • reversal par session (refund) → status reversed
-- Exécution : pgTAP, transaction annulée.
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
SELECT plan(7);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT x.id, 'authenticated', 'authenticated', x.e, 'x', '{}', '{}', now(), now()
FROM (VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'attr_a@test.local'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'attr_b@test.local'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'attr_c@test.local')
) AS x(id, e)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email)
SELECT x.id, x.n, x.e FROM (VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Attrib A', 'attr_a@test.local'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Attrib B', 'attr_b@test.local')
) AS x(id, n, e)
ON CONFLICT (id) DO NOTHING;

-- Souche (A) + fork (B) + session terrain (>= 1 km) → condition satisfaite
INSERT INTO public.materiel_kits (id, user_id, name, is_souche, origin)
VALUES ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Souche', true, 'souche_editoriale');
INSERT INTO public.materiel_kits (id, user_id, name, forked_from)
VALUES ('00000000-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Fork de A', '00000000-0000-0000-0000-000000000001');

INSERT INTO public.shop_products (id, slug, name, price_eur, available, is_active, stock)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'tente-attr', 'Tente', 300.00, true, true, 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.materiel_kit_items (id, kit_id, user_id, name, category, weight_g, product_id)
VALUES ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Tente', 'Couchage & Tentes', 1800, 'dddddddd-dddd-dddd-dddd-dddddddddddd');

INSERT INTO public.hike_sessions (id, user_id, kit_id, started_at, ended_at, distance_km, duration_seconds)
VALUES ('90000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000002', now() - interval '5 days', now() - interval '4 days', 8.0, 10800);

-- Commande + order_item (cible de l'attribution)
INSERT INTO public.orders (id, user_id, order_number, status, total_eur)
VALUES ('70000000-0000-0000-0000-000000000001', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'ATTR-001', 'confirmed', 300.00);
INSERT INTO public.order_items (id, order_id, product_id, product_slug, product_name, quantity, unit_price_eur, total_price_eur, transaction_type)
VALUES ('60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'tente-attr', 'Tente', 1, 300.00, 300.00, 'achat');

-- Parts attendues (commission 3% de 30000 = 900 cts ; gaps : forkeur B (gap 0), parent A (gap 1))
-- 70/20/10 sur gap 0 et 1 => B 700, A 200.

-- Test 1 : attribution créée + parts (achat par C, tiers)
SELECT public.insert_kit_attribution(
  '00000000-0000-0000-0000-000000000002'::uuid,
  '60000000-0000-0000-0000-000000000001'::uuid,
  'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
  30000, 300,
  '[{"beneficiary_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","generation_gap":0,"share_cents":700},
    {"beneficiary_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","generation_gap":1,"share_cents":200}]'::jsonb,
  'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid);

SELECT is(
  (SELECT count(*) FROM public.kit_attributions
    WHERE order_item_id = '60000000-0000-0000-0000-000000000001'),
  1,
  '1. L''attribution est créée'
);
SELECT is(
  (SELECT count(*) FROM public.kit_royalty_shares),
  2,
  '2. Deux parts créées (forkeur + parent)'
);

-- Test 2 : rejeu du webhook (même order_item) → idempotent (toujours 1 attribution)
SELECT public.insert_kit_attribution(
  '00000000-0000-0000-0000-000000000002'::uuid,
  '60000000-0000-0000-0000-000000000001'::uuid,
  'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
  30000, 300,
  '[{"beneficiary_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","generation_gap":0,"share_cents":700}]'::jsonb,
  'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid);

SELECT is(
  (SELECT count(*) FROM public.kit_attributions
    WHERE order_item_id = '60000000-0000-0000-0000-000000000001'),
  1,
  '3. Le rejeu du webhook ne crée pas de doublon (UNIQUE order_item_id)'
);
SELECT is(
  (SELECT count(*) FROM public.kit_royalty_shares),
  2,
  '4. Les parts ne sont pas dupliquées non plus'
);

-- Test 3 : achat de son propre kit (buyer = forkeur B) → aucune part pour l''acheteur
SELECT public.insert_kit_attribution(
  '00000000-0000-0000-0000-000000000002'::uuid,
  '60000000-0000-0000-0000-000000000001'::uuid,
  'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
  30000, 300,
  '[{"beneficiary_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","generation_gap":0,"share_cents":700},
    {"beneficiary_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","generation_gap":1,"share_cents":200}]'::jsonb,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid);

SELECT is(
  (SELECT count(*) FROM public.kit_royalty_shares
    WHERE beneficiary_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  0,
  '5. Aucune part pour le forkeur qui achète son propre kit'
);

-- Test 4 : somme des parts = commission (invariant strict, granularité par attribution)
SELECT is(
  (SELECT sum(share_cents) FROM public.kit_royalty_shares s
    JOIN public.kit_attributions a ON a.id = s.attribution_id
    WHERE a.order_item_id = '60000000-0000-0000-0000-000000000001'),
  900,
  '6. La somme des parts vaut la commission (900 cts = 3 % de 30000)'
);

-- Test 5 : reversal par session (refund) → parts reversed
INSERT INTO public.orders (id, user_id, order_number, status, total_eur, stripe_session_id)
VALUES ('70000000-0000-0000-0000-000000000002', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'ATTR-002', 'confirmed', 300.00, 'cs_test_attr');
INSERT INTO public.order_items (id, order_id, product_id, product_slug, product_name, quantity, unit_price_eur, total_price_eur, transaction_type)
VALUES ('60000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000002', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'tente-attr', 'Tente', 1, 300.00, 300.00, 'achat');

SELECT public.insert_kit_attribution(
  '00000000-0000-0000-0000-000000000002'::uuid,
  '60000000-0000-0000-0000-000000000002'::uuid,
  'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
  30000, 300,
  '[{"beneficiary_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","generation_gap":0,"share_cents":700}]'::jsonb,
  'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid);

SELECT public.reverse_kit_attribution_by_session('cs_test_attr');

SELECT is(
  (SELECT count(*) FROM public.kit_royalty_shares s
    JOIN public.kit_attributions a ON a.id = s.attribution_id
    WHERE a.order_item_id = '60000000-0000-0000-0000-000000000002'
      AND s.status = 'reversed'),
  1,
  '7. Le remboursement reverse la part (statut reversed)'
);

SELECT * FROM finish();
ROLLBACK;