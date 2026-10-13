BEGIN;
SELECT plan(8);

-- A-211 + A-212 — invariants de références et compteur de likes.

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('a2110000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'inv_a@test.local', 'x', '{}', '{}', now(), now()),
  ('a2110000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'inv_b@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('a2110000-0000-4000-8000-000000000001', 'Iris', 'inv_a@test.local'),
  ('a2110000-0000-4000-8000-000000000002', 'Ivan', 'inv_b@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.community_posts (id, author_id, content, likes_count, comments_count) VALUES
  ('a2110000-1000-4000-8000-000000000001', 'a2110000-0000-4000-8000-000000000001', 'Post 1', 0, 0),
  ('a2110000-1000-4000-8000-000000000002', 'a2110000-0000-4000-8000-000000000001', 'Post 2', 0, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.post_comments (id, post_id, author_id, content) VALUES
  ('a2110000-2000-4000-8000-000000000001', 'a2110000-1000-4000-8000-000000000001', 'a2110000-0000-4000-8000-000000000001', 'Racine post 1')
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'a2110000-0000-4000-8000-000000000002';

-- 1. Répondre au commentaire d'un AUTRE post est refusé.
SELECT throws_ok(
  $$ INSERT INTO public.post_comments (post_id, author_id, content, parent_id)
     VALUES ('a2110000-1000-4000-8000-000000000002', 'a2110000-0000-4000-8000-000000000002',
             'Réponse hors post', 'a2110000-2000-4000-8000-000000000001') $$,
  '42501', NULL,
  '1. Un parent d''un autre post est refusé'
);

-- 2. Répondre dans le même post fonctionne.
SELECT lives_ok(
  $$ INSERT INTO public.post_comments (post_id, author_id, content, parent_id)
     VALUES ('a2110000-1000-4000-8000-000000000001', 'a2110000-0000-4000-8000-000000000002',
             'Réponse valide', 'a2110000-2000-4000-8000-000000000001') $$,
  '2. Répondre dans le même post est accepté'
);

-- 3. A-212 : un like DIRECT (hors RPC) met le compteur à jour.
INSERT INTO public.post_likes (post_id, user_id)
VALUES ('a2110000-1000-4000-8000-000000000001', 'a2110000-0000-4000-8000-000000000002');
RESET ROLE;
SELECT is(
  (SELECT likes_count FROM public.community_posts WHERE id = 'a2110000-1000-4000-8000-000000000001'),
  1,
  '3. Le compteur suit un like direct (recount)'
);

-- 4. Deuxième like → 2.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'a2110000-0000-4000-8000-000000000001';
INSERT INTO public.post_likes (post_id, user_id)
VALUES ('a2110000-1000-4000-8000-000000000001', 'a2110000-0000-4000-8000-000000000001');
RESET ROLE;
SELECT is(
  (SELECT likes_count FROM public.community_posts WHERE id = 'a2110000-1000-4000-8000-000000000001'),
  2,
  '4. Deux likes → compteur 2'
);

-- 5. Retrait d'un like → 1.
DELETE FROM public.post_likes
 WHERE post_id = 'a2110000-1000-4000-8000-000000000001'
   AND user_id = 'a2110000-0000-4000-8000-000000000002';
SELECT is(
  (SELECT likes_count FROM public.community_posts WHERE id = 'a2110000-1000-4000-8000-000000000001'),
  1,
  '5. Retrait → compteur 1'
);

-- 6. A-211 messages : réponse vers une autre conversation refusée.
INSERT INTO public.conversations (id, type, name, created_by, direct_pair_key) VALUES
  ('a2110000-3000-4000-8000-000000000001', 'group', 'Conv 1', 'a2110000-0000-4000-8000-000000000001', NULL),
  ('a2110000-3000-4000-8000-000000000002', 'group', 'Conv 2', 'a2110000-0000-4000-8000-000000000001', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.conversation_members (conversation_id, user_id, role) VALUES
  ('a2110000-3000-4000-8000-000000000001', 'a2110000-0000-4000-8000-000000000001', 'owner'),
  ('a2110000-3000-4000-8000-000000000002', 'a2110000-0000-4000-8000-000000000001', 'owner')
ON CONFLICT DO NOTHING;
INSERT INTO public.messages (id, conversation_id, sender_id, content) VALUES
  ('a2110000-4000-4000-8000-000000000001', 'a2110000-3000-4000-8000-000000000001', 'a2110000-0000-4000-8000-000000000001', 'Message conv 1')
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'a2110000-0000-4000-8000-000000000001';
SELECT throws_ok(
  $$ INSERT INTO public.messages (conversation_id, sender_id, content, reply_to_id)
     VALUES ('a2110000-3000-4000-8000-000000000002', 'a2110000-0000-4000-8000-000000000001',
             'Réponse croisée', 'a2110000-4000-4000-8000-000000000001') $$,
  '42501', NULL,
  '6. Une réponse hors conversation est refusée'
);

-- 7. Réponse dans la même conversation acceptée.
SELECT lives_ok(
  $$ INSERT INTO public.messages (conversation_id, sender_id, content, reply_to_id)
     VALUES ('a2110000-3000-4000-8000-000000000001', 'a2110000-0000-4000-8000-000000000001',
             'Réponse valide', 'a2110000-4000-4000-8000-000000000001') $$,
  '7. Une réponse dans la même conversation est acceptée'
);

-- 8. Les trois triggers sont actifs.
SELECT is(
  (SELECT count(*)::int FROM pg_trigger
    WHERE NOT tgisinternal
      AND tgname IN ('guard_post_comment_parent_same_post', 'guard_message_reply_same_conversation', 'sync_community_post_likes_count')),
  3,
  '8. Les gardes et le recount sont en place'
);

SELECT * FROM finish();
ROLLBACK;
