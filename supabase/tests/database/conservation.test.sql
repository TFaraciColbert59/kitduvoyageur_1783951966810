-- ============================================================================
-- Conservation & confiance — Lot 4 (jeu synthétique : 1 souche, 5 forks dont
-- 2 auto-forks, 3 sessions). Vérifie :
--   • auto-forks exclus des paires de conservation ;
--   • conservation d'un item par les forks externes seulement ;
--   • axe propagation : user uniques, forks SANS session non comptés ;
--   • plancher de crédibilité (has_min_sessions).
-- Les matviews sont REFRESHées en transaction → le ROLLBACK final annule tout.
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
SELECT plan(8);

-- ----------------------------------------------------------------------------
-- Fixtures
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'cons_a@test.local', 'x', '{}', '{}', now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'cons_b@test.local', 'x', '{}', '{}', now(), now()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'authenticated', 'authenticated', 'cons_c@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Souche détenue par A
INSERT INTO public.materiel_kits (id, user_id, name, is_souche, origin)
VALUES ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Souche', true, 'souche_editoriale');

-- Items de la souche : tente (clé produit), réchaud (clé nom)
INSERT INTO public.materiel_kit_items (id, kit_id, user_id, name, category, weight_g, product_id)
VALUES
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tente MSR', 'Couchage & Tentes', 1800, 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  ('11111111-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Réchaud', 'Cuisine & Réchauds', 400, NULL);

-- 5 forks : 2 AUTO-forks (A), 3 forks externes (B, B, C)
INSERT INTO public.materiel_kits (id, user_id, name, forked_from)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Auto-fork 1', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Auto-fork 2', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000004', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Fork B1',      '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000005', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Fork B2',      '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000006', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Fork C',       '00000000-0000-0000-0000-000000000001');

-- Articles des forks : tous gardent la tente ; le réchaud est abandonné par B2 et C.
INSERT INTO public.materiel_kit_items (id, kit_id, user_id, name, category, weight_g, product_id)
VALUES
  ('22222222-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tente MSR', 'Couchage & Tentes', 1800, 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  ('22222222-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Réchaud', 'Cuisine & Réchauds', 400, NULL),
  ('22222222-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tente MSR', 'Couchage & Tentes', 1800, 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  ('22222222-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Réchaud', 'Cuisine & Réchauds', 400, NULL),
  ('22222222-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000004', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Tente MSR', 'Couchage & Tentes', 1800, 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  ('22222222-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000004', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Réchaud', 'Cuisine & Réchauds', 400, NULL),
  ('22222222-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000005', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Tente MSR', 'Couchage & Tentes', 1800, 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  ('22222222-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000006', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Tente MSR', 'Couchage & Tentes', 1800, 'dddddddd-dddd-dddd-dddd-dddddddddddd');

-- Sessions terrain : Fork B1 (2 sessions), Fork C (1 session), Fork B2 (0 session → exclu)
INSERT INTO public.hiking_routes (id, osm_relation_id, name, region, distance_km)
VALUES (80001, 10080001, 'Route Corse', 'Corse', 15.0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.hike_sessions (id, user_id, kit_id, route_id, started_at, ended_at, distance_km, duration_seconds)
VALUES
  ('90000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000004', 80001, now() - interval '30 days', now() - interval '29 days', 12.0, 14400),
  ('90000000-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000004', 80001, now() - interval '20 days', now() - interval '19 days', 9.0, 10800),
  ('90000000-0000-0000-0000-000000000003', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000006', 80001, now() - interval '10 days', now() - interval '9 days',  6.0, 7200);

-- Refresh des matviews AVANT les assertions
SELECT public.refresh_kit_conservation();

-- ----------------------------------------------------------------------------
-- Assertions
-- ----------------------------------------------------------------------------

-- Test 1 : le réchaud est conservé par 1 fork externe sur 3 → 33.3 %
SELECT is(
  (SELECT round((kept_count::numeric / total_pairs) * 100, 1)
     FROM public.kit_item_survival WHERE item_key = 'rchaud'),
  33.3,
  '1. Item abandonné par 2 forks sur 3 → conservation 33,3 %'
);

-- Test 2 : la tente (product_id) est conservée par les 3 forks externes → 100 %
SELECT is(
  (SELECT round((kept_count::numeric / total_pairs) * 100, 0)
     FROM public.kit_item_survival
     WHERE item_key = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  100,
  '2. Item conservé partout → conservation 100 %'
);

-- Test 3 : les AUTO-forks sont exclus → total_pairs de la tente = 3 (pas 5)
SELECT is(
  (SELECT total_pairs FROM public.kit_item_survival
     WHERE item_key = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  3,
  '3. Les auto-forks ne comptent pas dans les paires de conservation'
);

-- Test 4 : axe propagation — forks avec session : B1, B2(exclu: sans session), C → 2 users uniques
SELECT is(
  (SELECT fork_users_unique FROM public.kit_trust_scores
     WHERE kit_id = '00000000-0000-0000-0000-000000000001'),
  2,
  '4. Uniquement les forks avec session et à user distinct comptent (B et C)'
);

-- Test 5 : profondeur de descendance = 1 (tous forks directs)
SELECT is(
  (SELECT lineage_depth FROM public.kit_trust_scores
     WHERE kit_id = '00000000-0000-0000-0000-000000000001'),
  1,
  '5. Profondeur de la descendance (fork direct = 1)'
);

-- Test 6 : propagation_score > 0 (décroissance temporelle appliquée)
SELECT ok(
  (SELECT propagation_score > 0 FROM public.kit_trust_scores
     WHERE kit_id = '00000000-0000-0000-0000-000000000001'),
  '6. Le score de propagation est positif (décroissance 1/pow(age+2,1.5))'
);

-- Test 7 : endurance — la souche elle-même n''a aucune session → has_min_sessions faux
SELECT is(
  (SELECT has_min_sessions FROM public.kit_trust_scores
     WHERE kit_id = '00000000-0000-0000-0000-000000000001'),
  false,
  '7. Plancher de crédibilité : 0 session → pas de score affiché'
);

-- Test 8 : endurance — le fork B1 a 2 sessions → has_min_sessions vrai
SELECT is(
  (SELECT has_min_sessions FROM public.kit_trust_scores
     WHERE kit_id = '00000000-0000-0000-0000-000000000004'),
  false,
  '8. 2 sessions < 5 → plancher pas encore atteint (lignée jeune)'
);

SELECT * FROM finish();
ROLLBACK;