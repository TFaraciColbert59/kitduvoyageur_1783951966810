-- ============================================================================
-- TRIBU — Phase 6 : modeles de checklist par club
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;

GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clubs, public.club_members,
  public.group_task_templates, public.group_task_template_items, public.user_profiles
TO authenticated, service_role;

SELECT plan(11);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('bd000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'tribu_tpl_a@test.local', 'x', '{}', '{}', now(), now()),
  ('bd000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'tribu_tpl_b@test.local', 'x', '{}', '{}', now(), now()),
  ('bd000000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'tribu_tpl_x@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email, role, trust_score)
VALUES
  ('bd000000-0000-4000-8000-0000000000a1', 'TPL Admin', 'tribu_tpl_a@test.local', 'user', 50),
  ('bd000000-0000-4000-8000-0000000000a2', 'TPL Membre', 'tribu_tpl_b@test.local', 'user', 50),
  ('bd000000-0000-4000-8000-0000000000a3', 'TPL Externe', 'tribu_tpl_x@test.local', 'user', 50)
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

INSERT INTO public.clubs (id, name, slug, privacy, created_by)
VALUES ('bd000000-0000-4000-8000-0000000000b1', 'TPL Club', 'tribu-tpl-club', 'public',
        'bd000000-0000-4000-8000-0000000000a1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.club_members (club_id, user_id, role, status)
VALUES
  ('bd000000-0000-4000-8000-0000000000b1', 'bd000000-0000-4000-8000-0000000000a1', 'admin', 'active'),
  ('bd000000-0000-4000-8000-0000000000b1', 'bd000000-0000-4000-8000-0000000000a2', 'member', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO public.group_task_templates (id, club_id, title, source, created_by)
VALUES
  ('bd000000-0000-4000-8000-0000000000c1', 'bd000000-0000-4000-8000-0000000000b1',
   'Checklist club été', 'club', 'bd000000-0000-4000-8000-0000000000a1'),
  ('bd000000-0000-4000-8000-0000000000c2', NULL, 'Checklist officielle', 'official', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.group_task_template_items (template_id, title, position)
VALUES
  ('bd000000-0000-4000-8000-0000000000c1', 'Réserver refuges', 0),
  ('bd000000-0000-4000-8000-0000000000c1', 'Vérifier météo', 1)
ON CONFLICT DO NOTHING;

-- 1..4 — lecture
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a1';
SELECT is(
  (SELECT count(*)::int FROM public.group_task_templates WHERE id = 'bd000000-0000-4000-8000-0000000000c1'),
  1,
  '1. TPL-01. admin du club : modele visible'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a2';
SELECT is(
  (SELECT count(*)::int FROM public.group_task_templates WHERE id = 'bd000000-0000-4000-8000-0000000000c1'),
  1,
  '2. TPL-01. membre du club : modele visible'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a3';
SELECT is(
  (SELECT count(*)::int FROM public.group_task_templates WHERE id = 'bd000000-0000-4000-8000-0000000000c1'),
  0,
  '3. TPL-01. non-membre : modele de club invisible'
);
SELECT is(
  (SELECT count(*)::int FROM public.group_task_templates WHERE id = 'bd000000-0000-4000-8000-0000000000c2'),
  1,
  '4. TPL-01. modele officiel visible par tous'
);
SELECT is(
  (SELECT count(*)::int FROM public.group_task_template_items
    WHERE template_id = 'bd000000-0000-4000-8000-0000000000c1'),
  0,
  '5. TPL-02. items du modele de club invisibles au non-membre'
);

-- 6..9 — ecriture
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a2';
SELECT lives_ok(
  $$ INSERT INTO public.group_task_templates (club_id, title, source, created_by)
     VALUES ('bd000000-0000-4000-8000-0000000000b1', 'Modele de Bruno', 'club',
             'bd000000-0000-4000-8000-0000000000a2') $$,
  '6. TPL-03. membre actif : publication autorisee'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a3';
SELECT throws_ok(
  $$ INSERT INTO public.group_task_templates (club_id, title, source, created_by)
     VALUES ('bd000000-0000-4000-8000-0000000000b1', 'Pirate', 'club',
             'bd000000-0000-4000-8000-0000000000a3') $$,
  '42501', NULL,
  '7. TPL-03. non-membre : publication refusee'
);
SELECT throws_ok(
  $$ INSERT INTO public.group_task_templates (club_id, title, source, created_by)
     VALUES ('bd000000-0000-4000-8000-0000000000b1', 'Officiel pirate', 'official',
             'bd000000-0000-4000-8000-0000000000a3') $$,
  '42501', NULL,
  '8. TPL-03. source officielle refusee aux utilisateurs'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a1';
SELECT lives_ok(
  $$ INSERT INTO public.group_task_template_items (template_id, title, position)
     VALUES ('bd000000-0000-4000-8000-0000000000c1', 'Imprimer les cartes', 2) $$,
  '9. TPL-04. auteur : ajout d''item autorise'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a2';
SELECT throws_ok(
  $$ INSERT INTO public.group_task_template_items (template_id, title, position)
     VALUES ('bd000000-0000-4000-8000-0000000000c1', 'Item pirate', 3) $$,
  '42501', NULL,
  '10. TPL-04. non-auteur : ajout d''item refuse'
);

-- 11 — suppression : membre non auteur/non admin sans effet
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a2';
DELETE FROM public.group_task_templates WHERE id = 'bd000000-0000-4000-8000-0000000000c1';

RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.group_task_templates WHERE id = 'bd000000-0000-4000-8000-0000000000c1'),
  1,
  '11. TPL-05. suppression par un simple membre sans effet'
);

SELECT * FROM finish();
ROLLBACK;
