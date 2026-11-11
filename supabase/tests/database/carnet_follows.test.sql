-- pgTAP — 20261111120000_carnet_follows
-- Propositions 20/41 : suivre un carnet + fréquence de notification par suiveur.
-- 1. Un visiteur suit un carnet public, relit son suivi, change la fréquence, se désabonne.
-- 2. Un autre utilisateur ne lit ni ne modifie ce suivi.
-- 3. Un participant (collaborateur) ne peut pas suivre son propre carnet.
-- 4. Le rôle anonyme n'a aucun accès (ni lecture ni écriture).
BEGIN;
SET LOCAL search_path = public;
SELECT plan(10);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('cf000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'follow_author@test.local', 'x', '{}', '{}', now(), now()),
  ('cf000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'follow_visitor@test.local', 'x', '{}', '{}', now(), now()),
  ('cf000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'follow_other@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, email, full_name, created_at)
VALUES
  ('cf000000-0000-4000-8000-000000000001', 'follow_author@test.local', 'Auteur', now()),
  ('cf000000-0000-4000-8000-000000000002', 'follow_visitor@test.local', 'Visiteur', now()),
  ('cf000000-0000-4000-8000-000000000003', 'follow_other@test.local', 'Autre', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.carnets (id, author_id, title, destination, visibility)
VALUES ('cf100000-0000-4000-8000-000000000001', 'cf000000-0000-4000-8000-000000000001', 'Carnet suivi', 'Écrins', 'public')
ON CONFLICT (id) DO NOTHING;

-- Un collaborateur (participant) du même carnet, pour le refus d'auto-suivi.
INSERT INTO public.carnet_collaborators (carnet_id, user_id, role)
VALUES ('cf100000-0000-4000-8000-000000000001', 'cf000000-0000-4000-8000-000000000003', 'contributor')
ON CONFLICT DO NOTHING;

-- 1. Le visiteur suit le carnet ---------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "cf000000-0000-4000-8000-000000000002", "role": "authenticated"}';

SELECT lives_ok(
  $$INSERT INTO public.carnet_follows (carnet_id, user_id, notify_mode)
    VALUES ('cf100000-0000-4000-8000-000000000001', 'cf000000-0000-4000-8000-000000000002', 'digest')$$,
  'un visiteur suit un carnet public'
);
SELECT results_eq(
  $$SELECT notify_mode FROM public.carnet_follows WHERE carnet_id = 'cf100000-0000-4000-8000-000000000001'$$,
  $$VALUES ('digest'::text)$$,
  'le suivi se relit avec sa fréquence'
);
SELECT results_eq(
  $$UPDATE public.carnet_follows SET notify_mode = 'moment'
    WHERE carnet_id = 'cf100000-0000-4000-8000-000000000001'
    RETURNING notify_mode$$,
  $$VALUES ('moment'::text)$$,
  'le suiveur change sa fréquence'
);

-- 2. Un autre utilisateur ne voit ni ne modifie ce suivi ---------------------
SET LOCAL "request.jwt.claims" = '{"sub": "cf000000-0000-4000-8000-000000000003", "role": "authenticated"}';
SELECT is_empty(
  $$SELECT 1 FROM public.carnet_follows WHERE carnet_id = 'cf100000-0000-4000-8000-000000000001'$$,
  'un autre utilisateur ne lit pas les préférences du suiveur'
);
SELECT is_empty(
  $$UPDATE public.carnet_follows SET notify_mode = 'highlights'
    WHERE carnet_id = 'cf100000-0000-4000-8000-000000000001' RETURNING 1$$,
  'un autre utilisateur ne modifie pas le suivi'
);
SELECT throws_ok(
  $$INSERT INTO public.carnet_follows (carnet_id, user_id, notify_mode)
    VALUES ('cf100000-0000-4000-8000-000000000001', 'cf000000-0000-4000-8000-000000000003', 'digest')$$,
  '42501', NULL,
  'un participant au carnet ne peut pas suivre son propre carnet'
);

-- 3. Le visiteur se désabonne -------------------------------------------------
SET LOCAL "request.jwt.claims" = '{"sub": "cf000000-0000-4000-8000-000000000002", "role": "authenticated"}';
SELECT results_eq(
  $$DELETE FROM public.carnet_follows WHERE carnet_id = 'cf100000-0000-4000-8000-000000000001' RETURNING 1$$,
  $$VALUES (1)$$,
  'le suiveur se désabonne'
);
SELECT is_empty(
  $$SELECT 1 FROM public.carnet_follows WHERE carnet_id = 'cf100000-0000-4000-8000-000000000001'$$,
  'plus aucun suivi après désabonnement'
);

-- 4. Le rôle anonyme n'a aucun accès -----------------------------------------
RESET ROLE;
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" = '{"role": "anon"}';
SELECT throws_ok(
  $$SELECT 1 FROM public.carnet_follows LIMIT 1$$,
  '42501', NULL,
  'anon ne lit pas carnet_follows'
);
SELECT throws_ok(
  $$INSERT INTO public.carnet_follows (carnet_id, user_id, notify_mode)
    VALUES ('cf100000-0000-4000-8000-000000000001', 'cf000000-0000-4000-8000-000000000002', 'digest')$$,
  '42501', NULL,
  'anon n''écrit pas dans carnet_follows'
);

SELECT * FROM finish();
ROLLBACK;
