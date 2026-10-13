BEGIN;
SELECT plan(5);

-- A-067/A-216 — quotas quotidiens.

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('a0670000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'qu_a@test.local', 'x', '{}', '{}', now(), now()),
  ('a0670000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'qu_b@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('a0670000-0000-4000-8000-000000000001', 'Quinn', 'qu_a@test.local'),
  ('a0670000-0000-4000-8000-000000000002', 'Rachel', 'qu_b@test.local')
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'a0670000-0000-4000-8000-000000000001';

-- 1. 20 stories tiennent dans le quota.
SELECT lives_ok(
  $$ INSERT INTO public.post_stories (author_id, image_url)
     SELECT 'a0670000-0000-4000-8000-000000000001', 'https://cdn.test/q/' || g
       FROM generate_series(1, 20) AS g $$,
  '1. 20 stories publiées (quota journalier respecté)'
);

-- 2. La 21e est refusée.
SELECT throws_ok(
  $$ INSERT INTO public.post_stories (author_id, image_url)
     VALUES ('a0670000-0000-4000-8000-000000000001', 'https://cdn.test/q/21') $$,
  'P0001', NULL,
  '2. La 21e story est refusée (limite 20/jour)'
);

-- 3. Une autre identité n'est pas affectée.
SET LOCAL "request.jwt.claim.sub" = 'a0670000-0000-4000-8000-000000000002';
SELECT lives_ok(
  $$ INSERT INTO public.post_stories (author_id, image_url)
     VALUES ('a0670000-0000-4000-8000-000000000002', 'https://cdn.test/q/autre') $$,
  '3. Le quota est PAR identité'
);

-- 4. Un like tient dans le quota (aucun blocage du geste normal).
SELECT lives_ok(
  $$ INSERT INTO public.post_likes (post_id, user_id)
     SELECT p.id, 'a0670000-0000-4000-8000-000000000002'
       FROM (SELECT id FROM public.community_posts LIMIT 1) p $$,
  '4. Le geste normal (like) passe'
);

-- 5. Les huit déclencheurs de quota sont actifs.
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM pg_trigger WHERE NOT tgisinternal AND tgname = 'enforce_daily_quota'),
  8,
  '5. Les huit surfaces plafonnées sont couvertes'
);

SELECT * FROM finish();
ROLLBACK;
