-- ============================================================================
-- Lineage — matérialisation de la filiation des kits (Lot 1 du chantier lignées)
-- Exécution : pgTAP (supabase test db / dbmate), dans une transaction annulée.
-- Les fixtures auth.users sont minimales (le rôle postgres du test ne passe pas
-- par RLS) ; le trigger SECURITY DEFINER reste le sujet testé.
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
SELECT plan(21);

-- ----------------------------------------------------------------------------
-- Fixtures : 3 utilisateurs (auth.users, cible des FK de materiel_kits) + 1 produit
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'lineage_a@test.local', 'x', '{}', '{}', now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'lineage_b@test.local', 'x', '{}', '{}', now(), now()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'authenticated', 'authenticated', 'lineage_c@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.shop_products (id, slug, name, price_eur, available, is_active, stock)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'tente-msr-hubba', 'Tente MSR Hubba', 299.00, true, true, 10)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Test 1 : un kit créé sans parent est une racine
-- ----------------------------------------------------------------------------
INSERT INTO public.materiel_kits (id, user_id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Kit souche A');

SELECT is(
  (SELECT generation FROM public.materiel_kits WHERE id = '00000000-0000-0000-0000-000000000001'),
  0,
  '1a. Un kit sans parent est à la génération 0'
);
SELECT is(
  (SELECT lineage_root_id FROM public.materiel_kits WHERE id = '00000000-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-000000000001'::uuid,
  '1b. La racine de lignée est lui-même'
);
SELECT ok(
  (SELECT ancestors = '{}'::uuid[] FROM public.materiel_kits WHERE id = '00000000-0000-0000-0000-000000000001'),
  '1c. Les ancêtres d''une racine sont vides'
);

-- ----------------------------------------------------------------------------
-- Test 2 : un fork simple hérite génération 1 + chemin [racine]
-- ----------------------------------------------------------------------------
INSERT INTO public.materiel_kits (id, user_id, name, forked_from)
VALUES ('00000000-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Fork de A', '00000000-0000-0000-0000-000000000001');

SELECT is(
  (SELECT generation FROM public.materiel_kits WHERE id = '00000000-0000-0000-0000-000000000002'),
  1,
  '2a. Un fork est à la génération 1'
);
SELECT is(
  (SELECT lineage_root_id FROM public.materiel_kits WHERE id = '00000000-0000-0000-0000-000000000002'),
  '00000000-0000-0000-0000-000000000001'::uuid,
  '2b. La racine du fork est la racine du parent'
);
SELECT ok(
  (SELECT ancestors = ARRAY['00000000-0000-0000-0000-000000000001']::uuid[] FROM public.materiel_kits WHERE id = '00000000-0000-0000-0000-000000000002'),
  '2c. Les ancêtres du fork sont [racine]'
);

-- ----------------------------------------------------------------------------
-- Test 3 : le fork d'un fork empile le chemin dans le bon ordre (racine → parent)
-- ----------------------------------------------------------------------------
INSERT INTO public.materiel_kits (id, user_id, name, forked_from)
VALUES ('00000000-0000-0000-0000-000000000003', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Fork du fork', '00000000-0000-0000-0000-000000000002');

SELECT is(
  (SELECT generation FROM public.materiel_kits WHERE id = '00000000-0000-0000-0000-000000000003'),
  2,
  '3a. Le fork de fork est à la génération 2'
);
SELECT is(
  (SELECT lineage_root_id FROM public.materiel_kits WHERE id = '00000000-0000-0000-0000-000000000003'),
  '00000000-0000-0000-0000-000000000001'::uuid,
  '3b. La racine reste la souche d''origine'
);
SELECT ok(
  (SELECT ancestors = ARRAY['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002']::uuid[] FROM public.materiel_kits WHERE id = '00000000-0000-0000-0000-000000000003'),
  '3c. Les ancêtres sont [racine, parent] dans cet ordre'
);

-- ----------------------------------------------------------------------------
-- Test 4 : le client ne peut pas imposer generation/ancestors (écrasés)
-- ----------------------------------------------------------------------------
INSERT INTO public.materiel_kits (id, user_id, name, generation, ancestors)
VALUES ('00000000-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tentative client', 99, ARRAY['00000000-0000-0000-0000-000000000099']::uuid[]);

SELECT is(
  (SELECT generation FROM public.materiel_kits WHERE id = '00000000-0000-0000-0000-000000000004'),
  0,
  '4a. generation=99 envoyé par le client est écrasé à 0'
);
SELECT ok(
  (SELECT ancestors = '{}'::uuid[] FROM public.materiel_kits WHERE id = '00000000-0000-0000-0000-000000000004'),
  '4b. ancestors envoyé par le client est écrasé à vide'
);
SELECT throws_ok(
  $$ UPDATE public.materiel_kits SET generation = 99 WHERE id = '00000000-0000-0000-0000-000000000004' $$,
  'Les champs de filiation sont immuables après insertion',
  '4c. Tenter d''altérer generation par UPDATE est rejeté (immuabilité)'
);

-- ----------------------------------------------------------------------------
-- Test 5 : auto-référence / cycle → exception (garde-fou serveur)
-- ----------------------------------------------------------------------------
SELECT throws_ok(
  $$ INSERT INTO public.materiel_kits (id, user_id, name, forked_from)
     VALUES ('00000000-0000-0000-0000-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Boucle', '00000000-0000-0000-0000-000000000006')
       ON CONFLICT DO NOTHING $$,
  'Kit parent introuvable (forked_from = 00000000-0000-0000-0000-000000000006)',
  '5a. Forker sur un parent inexistant est refusé'
);

-- UPDATE : tenter de faire d''un kit descendant son propre parent → cycle détecté
SELECT throws_ok(
  $$ UPDATE public.materiel_kits SET forked_from = '00000000-0000-0000-0000-000000000003'
     WHERE id = '00000000-0000-0000-0000-000000000002' $$,
  'Cycle de lignée détecté',
  '5b. Rendre un kit parent de son propre ancêtre est refusé (cycle)'
);

-- ----------------------------------------------------------------------------
-- Test 6 : suppression d''un kit intermédiaire → forked_from SET NULL,
--           mais la lignée historique (ancestors) est CONSERVÉE.
-- ----------------------------------------------------------------------------
DELETE FROM public.materiel_kits WHERE id = '00000000-0000-0000-0000-000000000002';

SELECT is(
  (SELECT forked_from FROM public.materiel_kits WHERE id = '00000000-0000-0000-0000-000000000003'),
  NULL,
  '6a. La suppression du parent met forked_from à NULL'
);
SELECT is(
  (SELECT generation FROM public.materiel_kits WHERE id = '00000000-0000-0000-0000-000000000003'),
  2,
  '6b. La génération du descendant est conservée (pas de ré-encrage)'
);
SELECT ok(
  (SELECT ancestors = ARRAY['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002']::uuid[] FROM public.materiel_kits WHERE id = '00000000-0000-0000-0000-000000000003'),
  '6c. ancestors conserve l''uuid du kit supprimé (trace historique)'
);

-- ----------------------------------------------------------------------------
-- Test 7 : la contrainte CHECK sur origin est appliquée
-- ----------------------------------------------------------------------------
SELECT throws_ok(
  $$ INSERT INTO public.materiel_kits (id, user_id, name, origin)
     VALUES ('00000000-0000-0000-0000-000000000007', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Origin invalide', 'genetique') $$,
  'new row for relation "materiel_kits" violates check constraint "materiel_kits_origin_chk"',
  '7. Une valeur d''origin hors vocabulaire autorisé est refusée'
);

-- ----------------------------------------------------------------------------
-- Test 8 : item_key — clé d''identité d''objet stable (nom normalisé ou product_id)
-- ----------------------------------------------------------------------------
INSERT INTO public.materiel_kit_items (id, kit_id, user_id, name, category, weight_g)
VALUES ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tente MSR Hubba', 'Couchage & Tentes', 1800);

SELECT is(
  (SELECT item_key FROM public.materiel_kit_items WHERE id = '11111111-0000-0000-0000-000000000001'),
  'tente-msr-hubba',
  '8a. item_key est le nom normalisé (minuscules, tirets)'
);

INSERT INTO public.materiel_kit_items (id, kit_id, user_id, name, category, weight_g, product_id)
VALUES ('11111111-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tente MSR Hubba', 'Couchage & Tentes', 1800, 'dddddddd-dddd-dddd-dddd-dddddddddddd');

SELECT is(
  (SELECT item_key FROM public.materiel_kit_items WHERE id = '11111111-0000-0000-0000-000000000002'),
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '8b. item_key est l''uuid product_id quand le lien catalogue existe'
);

-- ----------------------------------------------------------------------------
-- Test 9 : garde-fou de profondeur — une lignée > 50 générations est refusée
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_cur uuid := '00000000-0000-0000-0000-000000000001';
  v_i   int;
BEGIN
  FOR v_i IN 1..50 LOOP
    INSERT INTO public.materiel_kits (id, user_id, name, forked_from)
    VALUES (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'profondeur ' || v_i, v_cur)
    RETURNING id INTO v_cur;
  END LOOP;
END $$;

SELECT throws_ok(
  $$ INSERT INTO public.materiel_kits (user_id, name, forked_from)
     VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'profondeur 51', (SELECT id FROM public.materiel_kits WHERE name = 'profondeur 50')) $$,
  'Profondeur de lignée maximale (50) dépassée',
  '9. Une 51e génération est refusée (garde-fou anti-abus)'
);

SELECT * FROM finish();
ROLLBACK;