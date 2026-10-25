BEGIN;
SELECT plan(9);

-- A-221/A-222/A-223 — file de modération unifiée et traçable.

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('a2210000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'mod_r@test.local', 'x', '{}', '{}', now(), now()),
  ('a2210000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'mod_m@test.local', 'x', '{}', '{}', now(), now()),
  ('a2210000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'mod_x@test.local', 'x', '{}', '{}', now(), now()),
  ('a2210000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'mod_v@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('a2210000-0000-4000-8000-000000000001', 'Romy (déclarante)', 'mod_r@test.local'),
  ('a2210000-0000-4000-8000-000000000002', 'Marc (modérateur)', 'mod_m@test.local'),
  ('a2210000-0000-4000-8000-000000000003', 'Xavier (tiers)', 'mod_x@test.local'),
  ('a2210000-0000-4000-8000-000000000004', 'Véra (cible)', 'mod_v@test.local')
ON CONFLICT (id) DO NOTHING;

-- Marc est modérateur (table admin_roles, lue par is_moderateur()).
INSERT INTO public.admin_roles (user_id, role)
VALUES ('a2210000-0000-4000-8000-000000000002', 'moderateur')
ON CONFLICT DO NOTHING;

-- Cible : une story + un commentaire de Véra.
INSERT INTO public.post_stories (id, author_id, image_url, caption) VALUES
  ('a2210000-1000-4000-8000-000000000001', 'a2210000-0000-4000-8000-000000000004', 'https://cdn.test/v.jpg', 'Contenu de la cible')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.community_posts (id, author_id, content, likes_count, comments_count) VALUES
  ('a2210000-2000-4000-8000-000000000001', 'a2210000-0000-4000-8000-000000000004', 'Post cible', 0, 0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.post_comments (id, post_id, author_id, content) VALUES
  ('a2210000-3000-4000-8000-000000000001', 'a2210000-2000-4000-8000-000000000001', 'a2210000-0000-4000-8000-000000000004', 'Commentaire signalé de la cible')
ON CONFLICT (id) DO NOTHING;

-- 1. Romy signale la story et le commentaire.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'a2210000-0000-4000-8000-000000000001';
INSERT INTO public.story_reports (story_id, story_author_id, reporter_id, reason)
VALUES ('a2210000-1000-4000-8000-000000000001', 'a2210000-0000-4000-8000-000000000004',
        'a2210000-0000-4000-8000-000000000001', 'Story inappropriée');
SELECT is(
  (SELECT status FROM public.story_reports LIMIT 1),
  'pending',
  '1. Le signalement de story naît en pending'
);

INSERT INTO public.comment_reports (comment_id, reporter_id, reason, table_name)
VALUES ('a2210000-3000-4000-8000-000000000001', 'a2210000-0000-4000-8000-000000000001',
        'Commentaire agressif', 'post_comments');

-- 2. La déclarante voit ses deux affaires dans la file.
SELECT is(
  (SELECT count(*)::int FROM public.community_moderation_queue),
  2,
  '2. La déclarante retrouve ses deux signalements'
);

-- 3. Un tiers ne voit rien.
SET LOCAL "request.jwt.claim.sub" = 'a2210000-0000-4000-8000-000000000003';
SELECT is_empty(
  $$ SELECT 1 FROM public.community_moderation_queue $$,
  '3. Un tiers ne voit aucune affaire'
);

-- 4. Le modérateur voit les trois sources visibles (deux affaires).
SET LOCAL "request.jwt.claim.sub" = 'a2210000-0000-4000-8000-000000000002';
SELECT is(
  (SELECT count(*)::int FROM public.community_moderation_queue),
  2,
  '4. Le modérateur voit toutes les affaires'
);

-- 5. Aperçu borné de la cible pour le commentaire.
SELECT is(
  (SELECT target_preview FROM public.community_moderation_queue WHERE source = 'comment'),
  'Commentaire signalé de la cible',
  '5. La file porte un aperçu de la cible'
);

-- 6. Le modérateur tranche : reviewed + traçabilité complète.
UPDATE public.story_reports SET status = 'reviewed'
 WHERE story_id = 'a2210000-1000-4000-8000-000000000001';
SELECT is(
  (SELECT resolved_by FROM public.story_reports LIMIT 1),
  'a2210000-0000-4000-8000-000000000002'::uuid,
  '6. La résolution est signée par le modérateur (trigger)'
);
SELECT ok(
  (SELECT resolved_at IS NOT NULL FROM public.story_reports LIMIT 1),
  '7. La date de résolution est posée'
);

-- 8. Un tiers ne peut pas trancher.
SET LOCAL "request.jwt.claim.sub" = 'a2210000-0000-4000-8000-000000000003';
UPDATE public.story_reports SET status = 'dismissed'
 WHERE story_id = 'a2210000-1000-4000-8000-000000000001';
RESET ROLE;
SELECT is(
  (SELECT status FROM public.story_reports LIMIT 1),
  'reviewed',
  '8. Seul un modérateur peut trancher'
);

-- 9. Anonyme : aucun accès à la file.
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT 1 FROM public.community_moderation_queue $$,
  '42501', NULL,
  '9. Anonyme : aucun accès à la file de modération'
);

SELECT * FROM finish();
ROLLBACK;
