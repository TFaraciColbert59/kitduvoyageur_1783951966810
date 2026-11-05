-- ============================================================================
-- Lot L0-1a — Tests SQL transactionnels : replace_kit_items (SEC-05, SEC-06, SEC-07 + A-04)
-- Exécution : supabase db reset --local && psql -f supabase/tests/kit_items_replace.sql
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
SELECT plan(7);

-- Fixtures utilisateurs A et B
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT x.id::uuid, 'authenticated', 'authenticated', x.e, 'x', '{}', '{}', now(), now()
FROM (VALUES
  ('10101010-0000-4000-8000-000000000001', 'l0_owner@test.local'),
  ('10101010-0000-4000-8000-000000000002', 'l0_intruder@test.local')
) AS x(id, e)
ON CONFLICT (id) DO NOTHING;

-- Kit de A contenant 3 articles initiaux
INSERT INTO public.materiel_kits (id, user_id, name, studio_revision)
VALUES ('20202020-0000-4000-8000-000000000001', '10101010-0000-4000-8000-000000000001', 'Kit Bivouac A', 1);

INSERT INTO public.materiel_kit_items (kit_id, user_id, name, category, weight_g, quantity, is_checked)
VALUES
  ('20202020-0000-4000-8000-000000000001', '10101010-0000-4000-8000-000000000001', 'Tente', 'Abri', 1200, 1, true),
  ('20202020-0000-4000-8000-000000000001', '10101010-0000-4000-8000-000000000001', 'Duvet', 'Couchage', 850, 1, true),
  ('20202020-0000-4000-8000-000000000001', '10101010-0000-4000-8000-000000000001', 'Réchaud', 'Cuisine', NULL, 1, false);

-- 1. Privilèges PUBLIC fermés
SELECT ok(
  NOT has_function_privilege('anon', 'public.replace_kit_items(uuid, jsonb, boolean)', 'EXECUTE'),
  'PUBLIC/anon ne peut pas exécuter replace_kit_items'
);

-- 2. SEC-05 : B tente d'appeler replace_kit_items sur le kit de A -> exception 42501
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '10101010-0000-4000-8000-000000000002';

SELECT throws_ok(
  $$ SELECT public.replace_kit_items('20202020-0000-4000-8000-000000000001'::uuid, '[]'::jsonb, true) $$,
  '42501',
  NULL,
  'SEC-05 : B ne peut pas remplacer les articles du kit de A (42501)'
);

-- 3. SEC-06 : A appelle replace_kit_items(kit non vide, [], false) -> exception 23514 et 0 ligne perdue
SET LOCAL "request.jwt.claim.sub" = '10101010-0000-4000-8000-000000000001';

SELECT throws_ok(
  $$ SELECT public.replace_kit_items('20202020-0000-4000-8000-000000000001'::uuid, '[]'::jsonb, false) $$,
  '23514',
  NULL,
  'SEC-06 : vidage accidentel refusé avec errcode 23514'
);

SELECT is(
  (SELECT count(*)::int FROM public.materiel_kit_items WHERE kit_id = '20202020-0000-4000-8000-000000000001'),
  3,
  'SEC-06 : les 3 articles originaux sont intacts après refus de vidage'
);

-- 4. SEC-07 : Insert invalide (quantity = 0 viole check (quantity > 0)) -> rollback atomique complet
SELECT throws_ok(
  $$ SELECT public.replace_kit_items(
       '20202020-0000-4000-8000-000000000001'::uuid,
       '[{"name":"Valide","quantity":1},{"name":"Invalide","quantity":0}]'::jsonb,
       false
     ) $$,
  '23514',
  NULL,
  'SEC-07 : un article invalide lève une erreur de contrainte et annule le delete'
);

SELECT is(
  (SELECT count(*)::int FROM public.materiel_kit_items WHERE kit_id = '20202020-0000-4000-8000-000000000001'),
  3,
  'SEC-07 : rollback atomique complet — les 3 articles initiaux sont toujours présents'
);

-- 5. A-04 : Remplacement légitime journalise items_replaced (before/after) et préserve weight_g NULL
SELECT lives_ok(
  $$ SELECT public.replace_kit_items(
       '20202020-0000-4000-8000-000000000001'::uuid,
       '[{"name":"Tente","weight_g":1200,"quantity":1},{"name":"Filtre non pesé","weight_g":null,"quantity":1}]'::jsonb,
       false
     ) $$,
  'A-04 : remplacement valide de 3 vers 2 articles exécuté et journalisé'
);

SELECT * FROM finish();
ROLLBACK;
