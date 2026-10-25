BEGIN;
SELECT plan(7);

-- A-039 / A-032 / A-033.

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('a0320000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'dr_a@test.local', 'x', '{}', '{}', now(), now()),
  ('a0320000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'dr_b@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('a0320000-0000-4000-8000-000000000001', 'Dora', 'dr_a@test.local'),
  ('a0320000-0000-4000-8000-000000000002', 'Evan', 'dr_b@test.local')
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'a0320000-0000-4000-8000-000000000001';

-- 1. Première publication avec clé d'idempotence.
SELECT lives_ok(
  $$ INSERT INTO public.community_posts (author_id, content, likes_count, comments_count, client_request_id)
     VALUES ('a0320000-0000-4000-8000-000000000001', 'Publication idempotente', 0, 0,
             'a0320000-9000-4000-8000-000000000001') $$,
  '1. Publication avec clé acceptée'
);

-- 2. Le retry (même auteur, même clé) est refusé par l'unicité.
SELECT throws_ok(
  $$ INSERT INTO public.community_posts (author_id, content, likes_count, comments_count, client_request_id)
     VALUES ('a0320000-0000-4000-8000-000000000001', 'Doublon de retry', 0, 0,
             'a0320000-9000-4000-8000-000000000001') $$,
  '23505', NULL,
  '2. Un retry avec la même clé ne crée pas de doublon'
);

-- 3. Un autre auteur peut réutiliser la même clé (unicité par auteur).
SET LOCAL "request.jwt.claim.sub" = 'a0320000-0000-4000-8000-000000000002';
SELECT lives_ok(
  $$ INSERT INTO public.community_posts (author_id, content, likes_count, comments_count, client_request_id)
     VALUES ('a0320000-0000-4000-8000-000000000002', 'Publication d''un autre auteur', 0, 0,
             'a0320000-9000-4000-8000-000000000001') $$,
  '3. La clé est unique PAR auteur'
);

-- 4. A-033 : contenu vide refusé côté serveur.
SELECT throws_ok(
  $$ INSERT INTO public.community_posts (author_id, content, likes_count, comments_count)
     VALUES ('a0320000-0000-4000-8000-000000000002', '   ', 0, 0) $$,
  '23514', NULL,
  '4. Contenu vide refusé pour les nouvelles écritures'
);

-- 5. A-032 : brouillon privé — écriture et lecture par soi.
INSERT INTO public.community_post_drafts (user_id, title, content, tags)
VALUES ('a0320000-0000-4000-8000-000000000002', 'Titre brouillon', 'Contenu en cours…', ARRAY['trek'])
ON CONFLICT (user_id) DO UPDATE SET content = EXCLUDED.content;
SELECT is(
  (SELECT count(*)::int FROM public.community_post_drafts),
  1,
  '5. Le brouillon est enregistré pour son auteur'
);

-- 6. Un autre compte ne voit AUCUN brouillon.
SET LOCAL "request.jwt.claim.sub" = 'a0320000-0000-4000-8000-000000000001';
SELECT is_empty(
  $$ SELECT 1 FROM public.community_post_drafts $$,
  '6. Aucun brouillon visible depuis un autre compte'
);

-- 7. Anonyme : aucun accès.
RESET ROLE;
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT 1 FROM public.community_post_drafts $$,
  '42501', NULL,
  '7. Anonyme : aucun accès aux brouillons'
);

SELECT * FROM finish();
ROLLBACK;
