-- pgTAP — carnet_etapes (20261110100100)
-- 1. Un participant (collaborateur contributor) écrit, modifie, supprime une étape.
-- 2. Un tiers ne peut ni écrire ni modifier ni supprimer.
-- 3. Un visiteur lit les étapes d'un carnet public, pas celles d'un carnet privé.
BEGIN;
SET LOCAL search_path = public;
SELECT plan(9);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('c6000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'ce_author@test.local', 'x', '{}', '{}', now(), now()),
  ('c6000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'ce_contrib@test.local', 'x', '{}', '{}', now(), now()),
  ('c6000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'ce_other@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, email, full_name, created_at)
VALUES
  ('c6000000-0000-4000-8000-000000000001', 'ce_author@test.local', 'Auteur', now()),
  ('c6000000-0000-4000-8000-000000000002', 'ce_contrib@test.local', 'Contrib', now()),
  ('c6000000-0000-4000-8000-000000000003', 'ce_other@test.local', 'Autre', now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.carnets (id, author_id, title, destination, visibility)
VALUES
  ('c6100000-0000-4000-8000-000000000001', 'c6000000-0000-4000-8000-000000000001', 'Carnet étapes public', 'Écrins', 'public'),
  ('c6100000-0000-4000-8000-000000000002', 'c6000000-0000-4000-8000-000000000001', 'Carnet étapes privé', 'Vercors', 'private');
INSERT INTO public.carnet_collaborators (carnet_id, user_id, role)
VALUES ('c6100000-0000-4000-8000-000000000001', 'c6000000-0000-4000-8000-000000000002', 'contributor');
INSERT INTO public.carnet_etapes (id, carnet_id, jour_numero, ordre, lieu_depart, lieu_arrivee)
VALUES ('c6200000-0000-4000-8000-000000000002', 'c6100000-0000-4000-8000-000000000002', 1, 1, 'Privé A', 'Privé B');

SET LOCAL ROLE authenticated;

SET LOCAL "request.jwt.claims" = '{"sub": "c6000000-0000-4000-8000-000000000002", "role": "authenticated"}';
SELECT lives_ok(
  $$INSERT INTO public.carnet_etapes (id, carnet_id, jour_numero, ordre, lieu_depart, lieu_arrivee)
    VALUES ('c6200000-0000-4000-8000-000000000001', 'c6100000-0000-4000-8000-000000000001', 1, 1, 'La Bérarde', 'Pigeonnier')$$,
  'un participant écrit une étape'
);
SELECT results_eq(
  $$UPDATE public.carnet_etapes SET lieu_arrivee = 'Refuge' WHERE id = 'c6200000-0000-4000-8000-000000000001' RETURNING lieu_arrivee$$,
  $$VALUES ('Refuge'::text)$$, 'et la modifie'
);

SET LOCAL "request.jwt.claims" = '{"sub": "c6000000-0000-4000-8000-000000000003", "role": "authenticated"}';
SELECT throws_ok(
  $$INSERT INTO public.carnet_etapes (carnet_id, jour_numero, ordre, lieu_depart) VALUES ('c6100000-0000-4000-8000-000000000001', 2, 1, 'X')$$,
  '42501', NULL, 'un tiers ne peut pas écrire'
);
SELECT is_empty(
  $$UPDATE public.carnet_etapes SET recit = 'pirate' WHERE id = 'c6200000-0000-4000-8000-000000000001' RETURNING 1$$,
  'un tiers ne modifie rien'
);
SELECT is_empty(
  $$DELETE FROM public.carnet_etapes WHERE id = 'c6200000-0000-4000-8000-000000000001' RETURNING 1$$,
  'un tiers ne supprime rien'
);
SELECT isnt_empty(
  $$SELECT 1 FROM public.carnet_etapes WHERE carnet_id = 'c6100000-0000-4000-8000-000000000001'$$,
  'un visiteur lit les étapes du carnet public'
);
SELECT is_empty(
  $$SELECT 1 FROM public.carnet_etapes WHERE carnet_id = 'c6100000-0000-4000-8000-000000000002'$$,
  'un visiteur ne lit pas les étapes du carnet privé'
);

SET LOCAL "request.jwt.claims" = '{"sub": "c6000000-0000-4000-8000-000000000002", "role": "authenticated"}';
SELECT throws_ok(
  $$INSERT INTO public.carnet_etapes (carnet_id, jour_numero, ordre, lieu_depart) VALUES ('c6100000-0000-4000-8000-000000000002', 1, 2, 'Y')$$,
  '42501', NULL, 'un participant d''un carnet n''écrit pas dans un autre'
);
SELECT results_eq(
  $$DELETE FROM public.carnet_etapes WHERE id = 'c6200000-0000-4000-8000-000000000001' RETURNING 1$$,
  $$VALUES (1)$$, 'le participant supprime son étape'
);

SELECT * FROM finish();
ROLLBACK;
