-- ============================================================================
-- TRIBU — Phase 5 : journal d'activite (triggers, lecture membre)
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;

GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT ON public.group_activity_log TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.travel_groups, public.group_members,
  public.group_expenses, public.group_tasks, public.group_kit_items,
  public.group_polls, public.group_album, public.user_profiles
TO authenticated, service_role;

SELECT plan(10);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('bd000000-0000-4000-8000-0000000000c1', 'authenticated', 'authenticated', 'tribu_log_a@test.local', 'x', '{}', '{}', now(), now()),
  ('bd000000-0000-4000-8000-0000000000c2', 'authenticated', 'authenticated', 'tribu_log_b@test.local', 'x', '{}', '{}', now(), now()),
  ('bd000000-0000-4000-8000-0000000000c3', 'authenticated', 'authenticated', 'tribu_log_x@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email, role, trust_score)
VALUES
  ('bd000000-0000-4000-8000-0000000000c1', 'LOG Alice', 'tribu_log_a@test.local', 'user', 50),
  ('bd000000-0000-4000-8000-0000000000c2', 'LOG Bruno', 'tribu_log_b@test.local', 'user', 50),
  ('bd000000-0000-4000-8000-0000000000c3', 'LOG Ext', 'tribu_log_x@test.local', 'user', 50)
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

INSERT INTO public.travel_groups (id, name, owner_id, visibility)
VALUES ('bd000000-0000-4000-8000-0000000000e1', 'LOG Groupe',
        'bd000000-0000-4000-8000-0000000000c1', 'private')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.group_members (group_id, user_id, role, status)
VALUES
  ('bd000000-0000-4000-8000-0000000000e1', 'bd000000-0000-4000-8000-0000000000c1', 'organizer', 'active'),
  ('bd000000-0000-4000-8000-0000000000e1', 'bd000000-0000-4000-8000-0000000000c2', 'member', 'active')
ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- 6 mutations, une par table collaborative
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000c1';

INSERT INTO public.group_expenses (group_id, paid_by, title, amount)
VALUES ('bd000000-0000-4000-8000-0000000000e1', 'bd000000-0000-4000-8000-0000000000c1', 'LOG Depense', 10);
INSERT INTO public.group_tasks (group_id, created_by, title)
VALUES ('bd000000-0000-4000-8000-0000000000e1', 'bd000000-0000-4000-8000-0000000000c1', 'LOG Tache');
INSERT INTO public.group_kit_items (group_id, name)
VALUES ('bd000000-0000-4000-8000-0000000000e1', 'LOG Materiel');
INSERT INTO public.group_polls (group_id, created_by, question, options)
VALUES ('bd000000-0000-4000-8000-0000000000e1', 'bd000000-0000-4000-8000-0000000000c1', 'LOG Sondage', '["a","b"]'::jsonb);
INSERT INTO public.group_album (group_id, uploaded_by, image_url)
VALUES ('bd000000-0000-4000-8000-0000000000e1', 'bd000000-0000-4000-8000-0000000000c1', 'log.jpg');
UPDATE public.group_tasks SET status = 'done'
WHERE group_id = 'bd000000-0000-4000-8000-0000000000e1' AND title = 'LOG Tache';

RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.group_activity_log
    WHERE group_id = 'bd000000-0000-4000-8000-0000000000e1'
      AND actor_id = 'bd000000-0000-4000-8000-0000000000c1'),
  6,
  '1. LOG-01. 6 mutations applicatives → 6 lignes de journal'
);
SELECT is(
  (SELECT count(*)::int FROM public.group_activity_log
    WHERE group_id = 'bd000000-0000-4000-8000-0000000000e1'
      AND actor_id = 'bd000000-0000-4000-8000-0000000000c1'
      AND action_type = 'created'),
  5,
  '2. LOG-01. 5 creations tracees'
);
SELECT is(
  (SELECT count(*)::int FROM public.group_activity_log
    WHERE group_id = 'bd000000-0000-4000-8000-0000000000e1'
      AND actor_id = 'bd000000-0000-4000-8000-0000000000c1'
      AND action_type = 'updated'),
  1,
  '3. LOG-01. 1 modification tracee'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.group_activity_log
    WHERE entity_type = 'group_expenses'
      AND summary LIKE '%LOG Alice%'
      AND summary LIKE '%LOG Depense%'
  ),
  '4. LOG-02. resume avec acteur et libelle'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.group_activity_log
    WHERE entity_type = 'group_album' AND summary LIKE '%une photo%'
  ),
  '5. LOG-02. album resume sans titre'
);
SELECT is(
  (SELECT entity_type FROM public.group_activity_log
    WHERE entity_type = 'group_tasks' AND action_type = 'updated' LIMIT 1),
  'group_tasks',
  '6. LOG-02. entite correcte pour la modification'
);

-- Lecture : membre oui, non-membre non
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000c2';
SELECT is(
  (SELECT count(*)::int FROM public.group_activity_log
    WHERE group_id = 'bd000000-0000-4000-8000-0000000000e1' AND action_type = 'deleted'),
  0,
  '7. LOG-03. membre lit le journal (aucune suppression encore)'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000c3';
SELECT is(
  (SELECT count(*)::int FROM public.group_activity_log
    WHERE group_id = 'bd000000-0000-4000-8000-0000000000e1'),
  0,
  '8. LOG-03. non-membre : journal invisible'
);

-- Ecriture directe interdite (aucune policy INSERT)
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000c1';
SELECT throws_ok(
  $$ INSERT INTO public.group_activity_log (group_id, actor_id, action_type, entity_type, summary)
     VALUES ('bd000000-0000-4000-8000-0000000000e1', 'bd000000-0000-4000-8000-0000000000c1',
             'created', 'fake', 'Pirate') $$,
  '42501', NULL,
  '9. LOG-04. ecriture applicative directe refusee'
);

-- Suppression : tracee aussi
DELETE FROM public.group_expenses
WHERE group_id = 'bd000000-0000-4000-8000-0000000000e1' AND title = 'LOG Depense';

RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.group_activity_log
    WHERE group_id = 'bd000000-0000-4000-8000-0000000000e1' AND action_type = 'deleted'),
  1,
  '10. LOG-05. suppression tracee'
);

SELECT * FROM finish();
ROLLBACK;
