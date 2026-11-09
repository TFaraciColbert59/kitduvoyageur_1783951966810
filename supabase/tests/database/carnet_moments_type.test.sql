-- ============================================================================
-- pgTAP — carnet_moments.moment_type / moment_meta (migration 20261109100001)
-- 1. Les deux colonnes existent et sont nullables (moments anciens intacts).
-- 2. Un type hors des neuf valeurs est refusé (check).
-- 3. Un moment_meta non objet ou trop gros est refusé.
-- 4. Un participant écrit un moment typé ; un visiteur ne le peut pas (RLS inchangée).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
SELECT plan(8);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('c3000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'mtype_author@test.local', 'x', '{}', '{}', now(), now()),
  ('c3000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'mtype_visitor@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, email, full_name, created_at)
VALUES
  ('c3000000-0000-4000-8000-000000000001', 'mtype_author@test.local', 'Auteur Type', now()),
  ('c3000000-0000-4000-8000-000000000002', 'mtype_visitor@test.local', 'Visiteur Type', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.carnets (id, author_id, title, destination, visibility)
VALUES ('c3100000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000001', 'Carnet Type', 'Écrins', 'public')
ON CONFLICT (id) DO NOTHING;

-- Moment ancien : aucun type.
INSERT INTO public.carnet_moments (id, carnet_id, jour_numero, citation, auteur_id)
VALUES ('c3200000-0000-4000-8000-000000000001', 'c3100000-0000-4000-8000-000000000001', 1, 'Ancien', 'c3000000-0000-4000-8000-000000000001');

SELECT has_column('public', 'carnet_moments', 'moment_type', 'moment_type existe');
SELECT has_column('public', 'carnet_moments', 'moment_meta', 'moment_meta existe');
SELECT is(
  (SELECT moment_type FROM public.carnet_moments WHERE id = 'c3200000-0000-4000-8000-000000000001'),
  NULL::text,
  'Un moment ancien garde moment_type NULL'
);

SELECT throws_ok(
  $$INSERT INTO public.carnet_moments (carnet_id, jour_numero, citation, moment_type)
    VALUES ('c3100000-0000-4000-8000-000000000001', 1, 'x', 'inconnu')$$,
  '23514',
  NULL,
  'Un type hors des neuf valeurs est refusé'
);

SELECT throws_ok(
  $$INSERT INTO public.carnet_moments (carnet_id, jour_numero, citation, moment_type, moment_meta)
    VALUES ('c3100000-0000-4000-8000-000000000001', 1, 'x', 'spend', '[1,2]'::jsonb)$$,
  '23514',
  NULL,
  'Un moment_meta qui n''est pas un objet est refusé'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "c3000000-0000-4000-8000-000000000001", "role": "authenticated"}';
SELECT lives_ok(
  $$INSERT INTO public.carnet_moments (carnet_id, jour_numero, citation, auteur_id, moment_type, moment_meta)
    VALUES ('c3100000-0000-4000-8000-000000000001', 2, 'Casse-croûte', 'c3000000-0000-4000-8000-000000000001', 'spend', '{"amountEur": 14, "category": "Repas"}'::jsonb)$$,
  'Le participant écrit un moment typé'
);

SET LOCAL "request.jwt.claims" = '{"sub": "c3000000-0000-4000-8000-000000000002", "role": "authenticated"}';
SELECT throws_ok(
  $$INSERT INTO public.carnet_moments (carnet_id, jour_numero, citation, auteur_id, moment_type)
    VALUES ('c3100000-0000-4000-8000-000000000001', 2, 'Intrus', 'c3000000-0000-4000-8000-000000000002', 'text')$$,
  '42501',
  NULL,
  'Un visiteur ne peut pas écrire de moment (RLS inchangée)'
);
SELECT is(
  (SELECT count(*)::int FROM public.carnet_moments WHERE carnet_id = 'c3100000-0000-4000-8000-000000000001' AND citation = 'Intrus'),
  0,
  'Aucun moment d''intrus en base'
);

SELECT * FROM finish();
ROLLBACK;
