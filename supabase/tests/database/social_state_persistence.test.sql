BEGIN;
SELECT plan(10);

-- F-012 — persistance des favoris et likes de commentaires.

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('f0120000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'soc_a@test.local', 'x', '{}', '{}', now(), now()),
  ('f0120000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'soc_b@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('f0120000-0000-4000-8000-000000000001', 'Sacha', 'soc_a@test.local'),
  ('f0120000-0000-4000-8000-000000000002', 'Sam', 'soc_b@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.community_posts (id, author_id, content, likes_count, comments_count) VALUES
  ('f0120000-1000-4000-8000-000000000001', 'f0120000-0000-4000-8000-000000000001', 'Post test social', 0, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.post_comments (id, post_id, author_id, content) VALUES
  ('f0120000-2000-4000-8000-000000000001', 'f0120000-1000-4000-8000-000000000001', 'f0120000-0000-4000-8000-000000000001', 'Commentaire test')
ON CONFLICT (id) DO NOTHING;

-- ── Favoris ────────────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f0120000-0000-4000-8000-000000000001';

SELECT lives_ok(
  $$ INSERT INTO public.post_saves (user_id, post_id)
     VALUES ('f0120000-0000-4000-8000-000000000001', 'f0120000-1000-4000-8000-000000000001') $$,
  '1. Un membre peut enregistrer une publication en favori'
);

SELECT throws_ok(
  $$ INSERT INTO public.post_saves (user_id, post_id)
     VALUES ('f0120000-0000-4000-8000-000000000001', 'f0120000-1000-4000-8000-000000000001') $$,
  '23505',
  NULL,
  '2. Un favori ne peut pas être dupliqué (unicité utilisateur/publication)'
);

-- B ne voit pas les favoris de A (lecture privée).
SET LOCAL "request.jwt.claim.sub" = 'f0120000-0000-4000-8000-000000000002';
SELECT is_empty(
  $$ SELECT 1 FROM public.post_saves $$,
  '3. Les favoris d''une autre personne ne sont pas lisibles'
);

-- B ne peut pas supprimer le favori de A (0 ligne).
DELETE FROM public.post_saves WHERE post_id = 'f0120000-1000-4000-8000-000000000001';
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.post_saves),
  1,
  '4. Le favori d''autrui ne peut pas être supprimé'
);

-- A retire son favori.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f0120000-0000-4000-8000-000000000001';
DELETE FROM public.post_saves
 WHERE post_id = 'f0120000-1000-4000-8000-000000000001'
   AND user_id = 'f0120000-0000-4000-8000-000000000001';
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.post_saves),
  0,
  '5. Son propre favori est retirable'
);

-- ── Likes de commentaires ──────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f0120000-0000-4000-8000-000000000001';
INSERT INTO public.post_comment_likes (user_id, comment_id)
VALUES ('f0120000-0000-4000-8000-000000000001', 'f0120000-2000-4000-8000-000000000001');

SELECT throws_ok(
  $$ INSERT INTO public.post_comment_likes (user_id, comment_id)
     VALUES ('f0120000-0000-4000-8000-000000000001', 'f0120000-2000-4000-8000-000000000001') $$,
  '23505',
  NULL,
  '6. Un like de commentaire ne peut pas être dupliqué'
);

-- Le compteur est public (lecture par B).
SET LOCAL "request.jwt.claim.sub" = 'f0120000-0000-4000-8000-000000000002';
SELECT is(
  (SELECT count(*)::int FROM public.post_comment_likes
    WHERE comment_id = 'f0120000-2000-4000-8000-000000000001'),
  1,
  '7. Les likes de commentaires sont lisibles publiquement (compteur)'
);

-- B ne peut pas retirer le like de A.
DELETE FROM public.post_comment_likes
 WHERE comment_id = 'f0120000-2000-4000-8000-000000000001'
   AND user_id = 'f0120000-0000-4000-8000-000000000001';
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.post_comment_likes),
  1,
  '8. Le like d''autrui ne peut pas être retiré'
);

-- Suppression du commentaire → cascade des likes.
DELETE FROM public.post_comments WHERE id = 'f0120000-2000-4000-8000-000000000001';
SELECT is(
  (SELECT count(*)::int FROM public.post_comment_likes),
  0,
  '9. Supprimer un commentaire retire ses likes (cascade)'
);

-- Inventaire : les deux tables sont sous RLS.
SELECT is(
  (SELECT count(*)::int FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('post_saves', 'post_comment_likes')
      AND c.relrowsecurity),
  2,
  '10. RLS activée sur les deux tables'
);

SELECT * FROM finish();
ROLLBACK;
