BEGIN;
SELECT plan(7);

-- A-104 — un club vivant conserve toujours un admin actif.

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('a1040000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'la_a@test.local', 'x', '{}', '{}', now(), now()),
  ('a1040000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'la_b@test.local', 'x', '{}', '{}', now(), now()),
  ('a1040000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'la_c@test.local', 'x', '{}', '{}', now(), now()),
  ('a1040000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'la_d@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('a1040000-0000-4000-8000-000000000001', 'Ada', 'la_a@test.local'),
  ('a1040000-0000-4000-8000-000000000002', 'Bastien', 'la_b@test.local'),
  ('a1040000-0000-4000-8000-000000000003', 'Clara', 'la_c@test.local'),
  ('a1040000-0000-4000-8000-000000000004', 'Diane', 'la_d@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, slug, name, privacy, created_by) VALUES
  ('a1040000-1000-4000-8000-000000000001', 'club-la-1', 'Club dernier admin 1', 'open', 'a1040000-0000-4000-8000-000000000002'),
  ('a1040000-1000-4000-8000-000000000002', 'club-la-2', 'Club dernier admin 2', 'open', 'a1040000-0000-4000-8000-000000000004')
ON CONFLICT (id) DO NOTHING;

-- Club 1 : admin Bastien (002), membre Clara (003).
-- Club 2 : SEULE admin Diane (004), membre Ada (001).
INSERT INTO public.club_members (id, club_id, user_id, role, status) VALUES
  ('a1040000-2000-4000-8000-000000000001', 'a1040000-1000-4000-8000-000000000001', 'a1040000-0000-4000-8000-000000000002', 'admin', 'active'),
  ('a1040000-2000-4000-8000-000000000002', 'a1040000-1000-4000-8000-000000000001', 'a1040000-0000-4000-8000-000000000003', 'member', 'active'),
  ('a1040000-2000-4000-8000-000000000003', 'a1040000-1000-4000-8000-000000000002', 'a1040000-0000-4000-8000-000000000004', 'admin', 'active'),
  ('a1040000-2000-4000-8000-000000000004', 'a1040000-1000-4000-8000-000000000002', 'a1040000-0000-4000-8000-000000000001', 'member', 'active')
ON CONFLICT (id) DO NOTHING;

-- 1. Diane, seule admin : se rétrograder → refusé.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'a1040000-0000-4000-8000-000000000004';
SELECT throws_ok(
  $$ UPDATE public.club_members SET role = 'member'
      WHERE id = 'a1040000-2000-4000-8000-000000000003' $$,
  '42501', NULL,
  '1. Rétrograder le dernier admin est refusé'
);

-- 2. Promouvoir un second admin est accepté.
SELECT lives_ok(
  $$ UPDATE public.club_members SET role = 'admin'
      WHERE id = 'a1040000-2000-4000-8000-000000000004' $$,
  '2. Promotion d''un second admin acceptée'
);

-- 3. Avec un second admin, se rétrograder passe.
UPDATE public.club_members SET role = 'member'
 WHERE id = 'a1040000-2000-4000-8000-000000000003';
SELECT is(
  (SELECT role FROM public.club_members WHERE id = 'a1040000-2000-4000-8000-000000000003'),
  'member',
  '3. Avec un second admin, la rétrogradation passe'
);

-- 4. Ada est désormais seule admin : se bannir → refusé.
SET LOCAL "request.jwt.claim.sub" = 'a1040000-0000-4000-8000-000000000001';
SELECT throws_ok(
  $$ UPDATE public.club_members SET status = 'banned'
      WHERE id = 'a1040000-2000-4000-8000-000000000004' $$,
  '42501', NULL,
  '4. Bannir le dernier admin (soi-même) est refusé'
);

-- 5. Quitter en étant le dernier admin → refusé.
SELECT throws_ok(
  $$ DELETE FROM public.club_members
      WHERE id = 'a1040000-2000-4000-8000-000000000004' $$,
  '42501', NULL,
  '5. Le dernier admin ne peut pas quitter le club'
);

-- 6. Un membre simple quitte sans contrainte.
SET LOCAL "request.jwt.claim.sub" = 'a1040000-0000-4000-8000-000000000003';
DELETE FROM public.club_members WHERE id = 'a1040000-2000-4000-8000-000000000002';
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.club_members WHERE id = 'a1040000-2000-4000-8000-000000000002'),
  0,
  '6. Un membre simple peut toujours quitter'
);

-- 7. La suppression du club entier n'est jamais bloquée par la garde.
DELETE FROM public.clubs WHERE id = 'a1040000-1000-4000-8000-000000000002';
SELECT is(
  (SELECT count(*)::int FROM public.club_members WHERE club_id = 'a1040000-1000-4000-8000-000000000002'),
  0,
  '7. Suppression du club : cascade complète, garde neutralisée'
);

SELECT * FROM finish();
ROLLBACK;
