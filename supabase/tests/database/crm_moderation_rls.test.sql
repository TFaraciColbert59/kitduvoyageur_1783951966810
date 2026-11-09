-- ═══════════════════════════════════════════════════════════════════════════
-- LKDV Control — M05 : contenu masqué invisible au membre, visible à l'auteur,
-- auteur incapable de se réafficher, équipe capable de modérer.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;
SET LOCAL search_path = public;
SELECT plan(8);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('d3000000-0000-4000-8000-000000000001','authenticated','authenticated','crm_author@test.local','x','{}','{}',now(),now()),
  ('d3000000-0000-4000-8000-000000000002','authenticated','authenticated','crm_reader@test.local','x','{}','{}',now(),now()),
  ('d3000000-0000-4000-8000-000000000003','authenticated','authenticated','crm_mod@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, email, full_name) VALUES
  ('d3000000-0000-4000-8000-000000000001','crm_author@test.local','Auteur Test'),
  ('d3000000-0000-4000-8000-000000000002','crm_reader@test.local','Lecteur Test'),
  ('d3000000-0000-4000-8000-000000000003','crm_mod@test.local','Modérateur Test')
ON CONFLICT (id) DO NOTHING;
INSERT INTO admin.staff_memberships (user_id, pole_code, role)
VALUES ('d3000000-0000-4000-8000-000000000003','CONF','membre')
ON CONFLICT (user_id, pole_code) DO UPDATE SET role = 'membre', revoked_at = null;

INSERT INTO public.community_posts (id, author_id, content, audience)
VALUES
  ('d3100000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001','[TEST CRM] publication à masquer','public'),
  ('d3100000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000001','[TEST CRM] publication visible','public');

-- Le modérateur masque via la commande (seul chemin autorisé).
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"d3000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}';
SELECT is((admin.run_command('post_hide','{"target_id":"d3100000-0000-4000-8000-000000000001","reason_code":"spam"}') ->> 'ok')::boolean,
  true, 'la commande post_hide passe pour un membre du pôle Confiance');
SELECT is((SELECT moderation_state FROM public.community_posts WHERE id = 'd3100000-0000-4000-8000-000000000001'),
  'hidden', 'la publication est masquée');

-- Un autre membre ne la voit plus.
SET LOCAL "request.jwt.claims" = '{"sub":"d3000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
SELECT is((SELECT count(*) FROM public.community_posts WHERE id = 'd3100000-0000-4000-8000-000000000001'),
  0::bigint, 'un membre ordinaire ne voit plus le contenu masqué');
SELECT is((SELECT count(*) FROM public.community_posts WHERE id = 'd3100000-0000-4000-8000-000000000002'),
  1::bigint, 'le contenu visible reste visible');

-- L''auteur le voit encore (il doit pouvoir lire la décision).
SET LOCAL "request.jwt.claims" = '{"sub":"d3000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
SELECT is((SELECT count(*) FROM public.community_posts WHERE id = 'd3100000-0000-4000-8000-000000000001'),
  1::bigint, 'l''auteur voit toujours sa publication masquée');

-- L''auteur ne peut pas se réafficher.
SELECT throws_ok(
  $$UPDATE public.community_posts SET moderation_state = 'visible' WHERE id = 'd3100000-0000-4000-8000-000000000001'$$,
  '42501', NULL, 'l''auteur ne peut pas remettre son contenu en visible');
SELECT throws_ok(
  $$UPDATE public.community_posts SET moderated_by = 'd3000000-0000-4000-8000-000000000001' WHERE id = 'd3100000-0000-4000-8000-000000000002'$$,
  '42501', NULL, 'l''auteur ne peut pas écrire les colonnes de modération');

-- Le contenu visible reste modifiable par son auteur (aucune régression).
SELECT lives_ok(
  $$UPDATE public.community_posts SET content = '[TEST CRM] publication visible (éditée)' WHERE id = 'd3100000-0000-4000-8000-000000000002'$$,
  'l''auteur édite son contenu visible sans être bloqué par le verrou');

-- La file de modération est réservée à l''équipe.
SET LOCAL "request.jwt.claims" = '{"sub":"d3000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
SELECT throws_ok('SELECT admin.moderation_inbox()', '42501', NULL,
  'la file de modération est refusée à un membre ordinaire');

SELECT * FROM finish();
ROLLBACK;
