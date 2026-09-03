-- ============================================================================
-- Audit RLS — tables créées par le chantier lignées (Lot 8.1)
--   • anon ne lit/écrit RIEN sur les tables de travail
--   • un utilisateur ne voit pas les données d'un autre
--   • les agrégats publics (matviews) restent lisibles (découverte)
-- Exécution : pgTAP, transaction annulée.
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
SELECT plan(10);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT x.id, 'authenticated', 'authenticated', x.e, 'x', '{}', '{}', now(), now()
FROM (VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'sec_a@test.local'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'sec_b@test.local')
) AS x(id, e)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.materiel_kits (id, user_id, name, is_souche, origin)
VALUES ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Kit A', true, 'souche_editoriale');

INSERT INTO public.hike_sessions (id, user_id, kit_id, started_at, ended_at, distance_km, duration_seconds)
VALUES ('90000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', now(), now(), 5.0, 1800);

INSERT INTO public.kit_field_reports (kit_id, hike_session_id, user_id, item_key, verdict)
VALUES ('00000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tente', 'essentiel');

INSERT INTO public.orders (id, user_id, order_number, status, total_eur)
VALUES ('70000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'SEC-001', 'confirmed', 300.00);
INSERT INTO public.order_items (id, order_id, product_id, product_slug, product_name, quantity, unit_price_eur, total_price_eur, transaction_type)
VALUES ('60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', NULL, 'x', 'X', 1, 300.00, 300.00, 'achat');

INSERT INTO public.kit_attributions (id, kit_id, order_item_id, amount_cents, rate_bps)
VALUES ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 900, 300);

INSERT INTO public.kit_royalty_shares (attribution_id, beneficiary_id, generation_gap, share_cents)
VALUES ('50000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 0, 900);

-- 1-3 : anon bloqué en lecture sur les tables de travail
SET LOCAL ROLE anon;
SELECT is_empty('SELECT * FROM public.checkout_intents', '1. anon ne lit pas checkout_intents');
SELECT is_empty('SELECT * FROM public.kit_field_reports', '2. anon ne lit pas kit_field_reports');
SELECT is_empty('SELECT * FROM public.kit_royalty_shares', '3. anon ne lit pas kit_royalty_shares');
SELECT is_empty('SELECT * FROM public.kit_attributions', '4. anon ne lit pas kit_attributions');

-- 5 : tous les agrégats publics restent lisibles par anon (découverte)
SELECT ok(
  (SELECT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'kit_item_survival')),
  '5. kit_item_survival existe (grant anon)'
);

-- 6-7 : utilisateur B ne voit pas les données de A
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT is_empty(
  'SELECT * FROM public.kit_field_reports',
  '6. B ne voit aucun débriefing (ceux de A sont invisibles)'
);
SELECT is_empty(
  'SELECT * FROM public.kit_royalty_shares',
  '7. B ne voit aucune part (celles de A sont invisibles)'
);

-- 8 : A voit SES parts (RLS own)
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT is(
  (SELECT count(*) FROM public.kit_royalty_shares),
  1,
  '8. A voit ses propres parts'
);

-- 9 : B ne peut pas lire le débriefing de A (path RLS)
SET LOCAL "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT is(
  (SELECT count(*) FROM public.kit_field_reports WHERE item_key = 'tente'),
  0,
  '9. B ne peut pas filtrer les débriefings de A'
);

-- 10 : anon ne peut pas exécuter insert_kit_attribution (service_role uniquement)
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT public.insert_kit_attribution(NULL, NULL, NULL, 0, 0, '[]', NULL) $$,
  'permission denied for function insert_kit_attribution',
  '10. anon ne peut pas invoquer la RPC d''attribution'
);

SELECT * FROM finish();
ROLLBACK;