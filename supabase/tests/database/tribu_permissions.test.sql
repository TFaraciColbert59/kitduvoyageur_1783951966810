-- ============================================================================
-- TRIBU — Permissions de groupe : capacites, policies, integrite des roles
-- ============================================================================
--   • 1..16  : couche capacites (matrice, overrides, search_path durci)
--   • 17..41 : policies par commande (observer muet, member self-only,
--              organizer complet, votes par appartenance)
--   • 42..44 : non-membre (isolation horizontale)
--   • 45..47 : inventaire (aucune policy large restante)
-- Execution : pgTAP, transaction annulee (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;

-- Replay local : grants explicites (defauts prod non garantis).
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.travel_groups, public.group_members, public.group_messages,
  public.group_expenses, public.group_kit_items, public.group_tasks,
  public.group_polls, public.group_poll_votes, public.group_album,
  public.user_profiles
TO authenticated, service_role;

SELECT plan(70);

-- ----------------------------------------------------------------------------
-- Fixtures — A organizer, B member, C observer, X non-membre, D pending
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('bd000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'tribu_a@test.local', 'x', '{}', '{}', now(), now()),
  ('bd000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'tribu_b@test.local', 'x', '{}', '{}', now(), now()),
  ('bd000000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'tribu_c@test.local', 'x', '{}', '{}', now(), now()),
  ('bd000000-0000-4000-8000-0000000000a4', 'authenticated', 'authenticated', 'tribu_x@test.local', 'x', '{}', '{}', now(), now()),
  ('bd000000-0000-4000-8000-0000000000a5', 'authenticated', 'authenticated', 'tribu_d@test.local', 'x', '{}', '{}', now(), now()),
  ('bd000000-0000-4000-8000-0000000000a6', 'authenticated', 'authenticated', 'tribu_y@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email, role, trust_score)
VALUES
  ('bd000000-0000-4000-8000-0000000000a1', 'TRIBU Organisateur', 'tribu_a@test.local', 'user', 50),
  ('bd000000-0000-4000-8000-0000000000a2', 'TRIBU Membre', 'tribu_b@test.local', 'user', 50),
  ('bd000000-0000-4000-8000-0000000000a3', 'TRIBU Observateur', 'tribu_c@test.local', 'user', 50),
  ('bd000000-0000-4000-8000-0000000000a4', 'TRIBU Externe', 'tribu_x@test.local', 'user', 50),
  ('bd000000-0000-4000-8000-0000000000a5', 'TRIBU En attente', 'tribu_d@test.local', 'user', 50),
  ('bd000000-0000-4000-8000-0000000000a6', 'TRIBU Nouveau', 'tribu_y@test.local', 'user', 50)
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

INSERT INTO public.travel_groups (id, name, owner_id, visibility)
VALUES
  ('bd000000-0000-4000-8000-0000000000f1', 'TRIBU Groupe Test', 'bd000000-0000-4000-8000-0000000000a1', 'private'),
  ('bd000000-0000-4000-8000-0000000000f2', 'TRIBU Groupe Tiers', 'bd000000-0000-4000-8000-0000000000a4', 'private')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.group_members (group_id, user_id, role, status)
VALUES
  ('bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a1', 'organizer', 'active'),
  ('bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a2', 'member', 'active'),
  ('bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a3', 'observer', 'active'),
  ('bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a5', 'member', 'pending')
ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- Lignes d'autrui (fixtures, inserees en postgres : RLS contournee)
INSERT INTO public.group_messages (id, group_id, user_id, content) VALUES
  ('bd000000-0000-4000-8000-0000000000e1', 'bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a1', 'msg A'),
  ('bd000000-0000-4000-8000-0000000000e2', 'bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a2', 'msg B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.group_album (id, group_id, uploaded_by, image_url)
VALUES ('bd000000-0000-4000-8000-0000000000e3', 'bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a1', 'img-a.jpg')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.group_kit_items (id, group_id, name, assigned_to)
VALUES ('bd000000-0000-4000-8000-0000000000e4', 'bd000000-0000-4000-8000-0000000000f1', 'Tente A', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.group_tasks (id, group_id, created_by, title) VALUES
  ('bd000000-0000-4000-8000-0000000000e5', 'bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a1', 'Tache A'),
  ('bd000000-0000-4000-8000-0000000000e6', 'bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a2', 'Tache B fixture')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.group_polls (id, group_id, created_by, question, options) VALUES
  ('bd000000-0000-4000-8000-0000000000e7', 'bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a1', 'Q1', '["a","b"]'::jsonb),
  ('bd000000-0000-4000-8000-0000000000e8', 'bd000000-0000-4000-8000-0000000000f2', 'bd000000-0000-4000-8000-0000000000a4', 'Q2', '["a"]'::jsonb),
  ('bd000000-0000-4000-8000-0000000000b1', 'bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a1', 'Q3', '["a","b"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.group_poll_votes (id, poll_id, user_id, option_index)
VALUES ('bd000000-0000-4000-8000-0000000000b2', 'bd000000-0000-4000-8000-0000000000b1', 'bd000000-0000-4000-8000-0000000000a2', 0)
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 1..16 — Couche capacites
-- ════════════════════════════════════════════════════════════════════════════
SELECT ok(
  public.group_member_has_capability('bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a1', 'manage_members'),
  '1. CAP-01. organizer : manage_members accorde'
);
SELECT ok(
  public.group_member_has_capability('bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a1', 'contribute'),
  '2. CAP-01. organizer : contribute accorde'
);
SELECT ok(
  public.group_member_has_capability('bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a2', 'contribute'),
  '3. CAP-02. member : contribute accorde'
);
SELECT ok(
  NOT public.group_member_has_capability('bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a2', 'manage_members'),
  '4. CAP-02. member : manage_members refuse'
);
SELECT ok(
  NOT public.group_member_has_capability('bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a3', 'contribute'),
  '5. CAP-03. observer : contribute refuse'
);
SELECT ok(
  NOT public.group_member_has_capability('bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a3', 'manage_info'),
  '6. CAP-03. observer : manage_info refuse'
);
SELECT ok(
  NOT public.group_member_has_capability('bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a4', 'contribute'),
  '7. CAP-04. non-membre : aucune capacite'
);
SELECT ok(
  NOT public.group_member_has_capability('bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a5', 'contribute'),
  '8. CAP-05. membre pending : aucune capacite'
);

INSERT INTO public.group_member_capability_overrides (group_id, user_id, capability, allowed)
VALUES
  ('bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a2', 'manage_kit', true),
  ('bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a1', 'manage_polls', false)
ON CONFLICT (group_id, user_id, capability) DO UPDATE SET allowed = EXCLUDED.allowed;

SELECT ok(
  public.group_member_has_capability('bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a2', 'manage_kit'),
  '9. CAP-06. override true : capacite accordee a un member'
);
SELECT ok(
  NOT public.group_member_has_capability('bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a1', 'manage_polls'),
  '10. CAP-06. override false : prioritaire sur le defaut organizer'
);

SELECT is(
  (SELECT count(*)::int FROM public.group_role_capability_defaults),
  40,
  '11. CAP-07. matrice complete : 10 capacites x 4 roles'
);
SELECT is(
  (SELECT count(*)::int FROM public.group_role_capability_defaults WHERE role = 'member' AND allowed),
  1,
  '12. CAP-07. member : contribute est sa seule capacite'
);
SELECT is(
  (SELECT count(*)::int FROM public.group_role_capability_defaults WHERE role = 'organizer' AND allowed),
  10,
  '13. CAP-07. organizer : toutes les capacites'
);
SELECT is(
  (SELECT count(*)::int FROM public.group_role_capability_defaults WHERE role = 'observer' AND allowed),
  0,
  '14. CAP-07. observer : aucune capacite par defaut'
);
SELECT ok(
  (SELECT proconfig @> ARRAY['search_path=public, pg_temp'] FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'group_member_has_capability'),
  '15. CAP-08. group_member_has_capability : search_path durci'
);
SELECT ok(
  (SELECT bool_and(p.proconfig @> ARRAY['search_path=public, pg_temp']) FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname IN ('lkv_can', 'is_moderateur', 'is_group_member', 'is_group_organizer')),
  '16. CAP-08. fonctions d''acces existantes : search_path durci'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 17..41 — Policies par commande
-- ════════════════════════════════════════════════════════════════════════════

-- Nettoyage : les overrides du test 9 ne doivent pas influencer les policies.
DELETE FROM public.group_member_capability_overrides
WHERE group_id = 'bd000000-0000-4000-8000-0000000000f1'
  AND user_id IN ('bd000000-0000-4000-8000-0000000000a1', 'bd000000-0000-4000-8000-0000000000a2');

-- Observer C : lecture seule, aucune ecriture nulle part
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a3';

SELECT throws_ok(
  $$ INSERT INTO public.group_tasks (group_id, created_by, title)
     VALUES ('bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a3', 'Observer pirate') $$,
  '42501', NULL,
  '17. POL-01. observer : INSERT tache refuse'
);
SELECT throws_ok(
  $$ INSERT INTO public.group_messages (group_id, user_id, content)
     VALUES ('bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a3', 'Observer pirate') $$,
  '42501', NULL,
  '18. POL-01. observer : INSERT message refuse'
);
UPDATE public.group_tasks SET title = 'Observer pirate'
WHERE id = 'bd000000-0000-4000-8000-0000000000e5';
SELECT is(
  (SELECT title FROM public.group_tasks WHERE id = 'bd000000-0000-4000-8000-0000000000e5'),
  'Tache A',
  '19. POL-01. observer : UPDATE tache d''autrui sans effet'
);
DELETE FROM public.group_messages
WHERE id = 'bd000000-0000-4000-8000-0000000000e1';
SELECT is(
  (SELECT count(*)::int FROM public.group_messages WHERE id = 'bd000000-0000-4000-8000-0000000000e1'),
  1,
  '20. POL-01. observer : DELETE message d''autrui sans effet'
);
SELECT is(
  (SELECT count(*)::int FROM public.travel_groups WHERE id = 'bd000000-0000-4000-8000-0000000000f1'),
  1,
  '21. POL-01. observer : lecture du groupe preservee'
);

-- Member B : self-only + contribute pour ses lignes
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a2';

SELECT lives_ok(
  $$ INSERT INTO public.group_tasks (id, group_id, created_by, title)
     VALUES ('bd000000-0000-4000-8000-0000000000e9', 'bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a2', 'Tache B') $$,
  '22. POL-02. member : INSERT tache sienne autorise'
);
SELECT lives_ok(
  $$ INSERT INTO public.group_expenses (id, group_id, paid_by, title, amount)
     VALUES ('bd000000-0000-4000-8000-0000000000ea', 'bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a2', 'Depense B', 10) $$,
  '23. POL-02. member : INSERT depense payee par soi autorise'
);
SELECT throws_ok(
  $$ INSERT INTO public.group_expenses (id, group_id, paid_by, title, amount)
     VALUES ('bd000000-0000-4000-8000-0000000000eb', 'bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a1', 'Depense pirate', 10) $$,
  '42501', NULL,
  '24. POL-02. member : INSERT depense payee par autrui refuse'
);
UPDATE public.group_tasks SET title = 'Pirate'
WHERE id = 'bd000000-0000-4000-8000-0000000000e5';
SELECT is(
  (SELECT title FROM public.group_tasks WHERE id = 'bd000000-0000-4000-8000-0000000000e5'),
  'Tache A',
  '25. POL-02. member : UPDATE tache d''autrui sans effet'
);
UPDATE public.group_tasks SET status = 'done'
WHERE id = 'bd000000-0000-4000-8000-0000000000e9';
SELECT is(
  (SELECT status::text FROM public.group_tasks WHERE id = 'bd000000-0000-4000-8000-0000000000e9'),
  'done',
  '26. POL-02. member : UPDATE de sa propre tache effectif'
);
DELETE FROM public.group_tasks
WHERE id = 'bd000000-0000-4000-8000-0000000000e5';
SELECT is(
  (SELECT count(*)::int FROM public.group_tasks WHERE id = 'bd000000-0000-4000-8000-0000000000e5'),
  1,
  '27. POL-02. member : DELETE tache d''autrui sans effet'
);
SELECT lives_ok(
  $$ INSERT INTO public.group_kit_items (id, group_id, name)
     VALUES ('bd000000-0000-4000-8000-0000000000ec', 'bd000000-0000-4000-8000-0000000000f1', 'Rechaud B') $$,
  '28. POL-02. member : INSERT materiel non assigne autorise'
);
UPDATE public.group_kit_items SET notes = 'Pirate'
WHERE id = 'bd000000-0000-4000-8000-0000000000e4';
SELECT is(
  (SELECT notes FROM public.group_kit_items WHERE id = 'bd000000-0000-4000-8000-0000000000e4'),
  NULL,
  '29. POL-02. member : UPDATE materiel d''autrui sans effet'
);
SELECT lives_ok(
  $$ INSERT INTO public.group_album (id, group_id, uploaded_by, image_url)
     VALUES ('bd000000-0000-4000-8000-0000000000ed', 'bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a2', 'img-b.jpg') $$,
  '30. POL-02. member : INSERT photo sienne autorise'
);
SELECT throws_ok(
  $$ INSERT INTO public.group_album (id, group_id, uploaded_by, image_url)
     VALUES ('bd000000-0000-4000-8000-0000000000ee', 'bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a1', 'img-pirate.jpg') $$,
  '42501', NULL,
  '31. POL-02. member : INSERT photo attribuee a autrui refuse'
);
SELECT throws_ok(
  $$ INSERT INTO public.group_messages (group_id, user_id, content)
     VALUES ('bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a1', 'Message pirate') $$,
  '42501', NULL,
  '32. POL-02. member : INSERT message au nom d''autrui refuse'
);
SELECT throws_ok(
  $$ INSERT INTO public.group_poll_votes (poll_id, user_id, option_index)
     VALUES ('bd000000-0000-4000-8000-0000000000e7', 'bd000000-0000-4000-8000-0000000000a1', 0) $$,
  '42501', NULL,
  '33. POL-02. member : vote au nom d''autrui refuse'
);
SELECT throws_ok(
  $$ INSERT INTO public.group_poll_votes (poll_id, user_id, option_index)
     VALUES ('bd000000-0000-4000-8000-0000000000e8', 'bd000000-0000-4000-8000-0000000000a2', 0) $$,
  '42501', NULL,
  '34. POL-02. member : vote sur un groupe tiers refuse'
);
SELECT lives_ok(
  $$ INSERT INTO public.group_poll_votes (id, poll_id, user_id, option_index)
     VALUES ('bd000000-0000-4000-8000-0000000000ef', 'bd000000-0000-4000-8000-0000000000e7', 'bd000000-0000-4000-8000-0000000000a2', 1) $$,
  '35. POL-02. member : vote pour soi dans son groupe autorise'
);
DELETE FROM public.group_poll_votes
WHERE id = 'bd000000-0000-4000-8000-0000000000ef';
SELECT is(
  (SELECT count(*)::int FROM public.group_poll_votes WHERE id = 'bd000000-0000-4000-8000-0000000000ef'),
  0,
  '36. POL-02. member : retrait de son propre vote effectif'
);

-- Organizer A : capacites completes, mais jamais les lignes d'autrui en self-only
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a1';

SELECT lives_ok(
  $$ INSERT INTO public.group_expenses (id, group_id, paid_by, title, amount)
     VALUES ('bd000000-0000-4000-8000-0000000000f4', 'bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a2', 'Depense avancee B', 25) $$,
  '37. POL-03. organizer : INSERT depense payee par un membre autorise'
);
UPDATE public.group_tasks SET title = 'Reassignee'
WHERE id = 'bd000000-0000-4000-8000-0000000000e6';
SELECT is(
  (SELECT title FROM public.group_tasks WHERE id = 'bd000000-0000-4000-8000-0000000000e6'),
  'Reassignee',
  '38. POL-03. organizer : UPDATE tache d''autrui effectif (manage_tasks)'
);
DELETE FROM public.group_messages
WHERE id = 'bd000000-0000-4000-8000-0000000000e2';
SELECT is(
  (SELECT count(*)::int FROM public.group_messages WHERE id = 'bd000000-0000-4000-8000-0000000000e2'),
  0,
  '39. POL-03. organizer : DELETE message d''autrui effectif (moderate_messages)'
);
UPDATE public.group_poll_votes SET option_index = 1
WHERE id = 'bd000000-0000-4000-8000-0000000000b2';
SELECT is(
  (SELECT option_index FROM public.group_poll_votes WHERE id = 'bd000000-0000-4000-8000-0000000000b2'),
  0,
  '40. POL-03. organizer : UPDATE du vote d''autrui sans effet (self-only)'
);
SELECT is(
  (SELECT count(*)::int FROM public.group_messages WHERE group_id = 'bd000000-0000-4000-8000-0000000000f1'),
  1,
  '41. POL-03. organizer : lecture des messages du groupe'
);

-- Non-membre X : isolation horizontale
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a4';

SELECT is(
  (SELECT count(*)::int FROM public.group_tasks WHERE group_id = 'bd000000-0000-4000-8000-0000000000f1'),
  0,
  '42. POL-04. non-membre : taches invisibles'
);
SELECT is(
  (SELECT count(*)::int FROM public.travel_groups WHERE id = 'bd000000-0000-4000-8000-0000000000f1'),
  0,
  '43. POL-04. non-membre : groupe prive invisible'
);
SELECT throws_ok(
  $$ INSERT INTO public.group_poll_votes (poll_id, user_id, option_index)
     VALUES ('bd000000-0000-4000-8000-0000000000e7', 'bd000000-0000-4000-8000-0000000000a4', 0) $$,
  '42501', NULL,
  '44. POL-04. non-membre : vote refuse'
);

-- Inventaire : aucune policy large restante
RESET ROLE;

SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname = 'public' AND policyname LIKE '%\_member\_all' ESCAPE '\'),
  0,
  '45. INV-01. zero policy `*_member_all` restante'
);
SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname = 'public' AND policyname LIKE '%\_select\_public\_or\_member' ESCAPE '\'),
  0,
  '46. INV-01. zero policy `*_select_public_or_member` restante'
);
SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname = 'public' AND policyname = 'invitations_public_read_by_token'),
  0,
  '47. INV-02. fuite `invitations_public_read_by_token` supprimee'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 48..53 — Integrite des roles (trigger enforce_group_role_change)
-- ════════════════════════════════════════════════════════════════════════════

-- Member B tente de s'auto-promouvoir
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a2';

SELECT throws_ok(
  $$ UPDATE public.group_members SET role = 'organizer'
     WHERE group_id = 'bd000000-0000-4000-8000-0000000000f1'
       AND user_id = 'bd000000-0000-4000-8000-0000000000a2' $$,
  '42501', NULL,
  '48. INT-01. member : auto-promotion de role refusee'
);
SELECT throws_ok(
  $$ UPDATE public.group_members SET status = 'left'
     WHERE group_id = 'bd000000-0000-4000-8000-0000000000f1'
       AND user_id = 'bd000000-0000-4000-8000-0000000000a2' $$,
  '42501', NULL,
  '49. INT-01. member : transition de statut non autorisee refusee'
);

-- Invite D accepte son invitation (pending -> active)
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a5';

SELECT lives_ok(
  $$ UPDATE public.group_members SET status = 'active'
     WHERE group_id = 'bd000000-0000-4000-8000-0000000000f1'
       AND user_id = 'bd000000-0000-4000-8000-0000000000a5' $$,
  '50. INT-02. invite : acceptation pending -> active autorisee'
);

-- Organizer A promeut B co-organisateur (manage_members)
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a1';

SELECT lives_ok(
  $$ UPDATE public.group_members SET role = 'co_organizer'
     WHERE group_id = 'bd000000-0000-4000-8000-0000000000f1'
       AND user_id = 'bd000000-0000-4000-8000-0000000000a2' $$,
  '51. INT-03. organizer : promotion d''un membre autorisee (manage_members)'
);

-- service / systeme (auth.uid() NULL) : changement de role tolere
RESET ROLE;
RESET "request.jwt.claim.sub";

SELECT lives_ok(
  $$ UPDATE public.group_members SET role = 'member'
     WHERE group_id = 'bd000000-0000-4000-8000-0000000000f1'
       AND user_id = 'bd000000-0000-4000-8000-0000000000a2' $$,
  '52. INT-03. systeme (auth.uid() NULL) : changement de role tolere'
);

-- Member B modifie un champ non protege (poids)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a2';

SELECT lives_ok(
  $$ UPDATE public.group_members SET weight_capacity = 12000
     WHERE group_id = 'bd000000-0000-4000-8000-0000000000f1'
       AND user_id = 'bd000000-0000-4000-8000-0000000000a2' $$,
  '53. INT-04. member : mise a jour d''un champ libre autorisee'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 54..67 — Revue Phase 0 : bootstrap, jointures, transferts, RPC publique
-- ════════════════════════════════════════════════════════════════════════════

-- Bootstrap (C1) : le createur d'un groupe devient organizer actif
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a1';

SELECT lives_ok(
  $$ INSERT INTO public.travel_groups (id, name, owner_id, visibility)
     VALUES ('bd000000-0000-4000-8000-0000000000f5', 'TRIBU Groupe Bootstrap',
             'bd000000-0000-4000-8000-0000000000a1', 'private') $$,
  '54. REV-01. creation de groupe par un utilisateur'
);
SELECT is(
  (SELECT count(*)::int FROM public.group_members
   WHERE group_id = 'bd000000-0000-4000-8000-0000000000f5'
     AND user_id = 'bd000000-0000-4000-8000-0000000000a1'
     AND role = 'organizer' AND status = 'active'),
  1,
  '55. REV-01. bootstrap : createur organizer actif immediat'
);

-- Jointure publique / privee (flux VoyageursCard / BouteilleALaMer)
SELECT lives_ok(
  $$ INSERT INTO public.travel_groups (id, name, owner_id, visibility)
     VALUES ('bd000000-0000-4000-8000-0000000000f4', 'TRIBU Groupe Public',
             'bd000000-0000-4000-8000-0000000000a1', 'public') $$,
  '56. REV-02. creation d''un groupe public'
);
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a4';

SELECT lives_ok(
  $$ INSERT INTO public.group_members (group_id, user_id, role, status)
     VALUES ('bd000000-0000-4000-8000-0000000000f4',
             'bd000000-0000-4000-8000-0000000000a4', 'member', 'pending') $$,
  '57. REV-02. self-join d''un groupe public autorise'
);
SELECT throws_ok(
  $$ INSERT INTO public.group_members (group_id, user_id, role, status)
     VALUES ('bd000000-0000-4000-8000-0000000000f1',
             'bd000000-0000-4000-8000-0000000000a4', 'member', 'pending') $$,
  '42501', NULL,
  '58. REV-02. self-join d''un groupe prive refuse'
);

-- invite_members borne (I1) : invitation OK, creation d'organizer refusee
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a1';

SELECT lives_ok(
  $$ INSERT INTO public.group_members (group_id, user_id, role, status)
     VALUES ('bd000000-0000-4000-8000-0000000000f1',
             'bd000000-0000-4000-8000-0000000000a4', 'member', 'pending') $$,
  '59. REV-03. organizer : invitation d''un membre autorisee'
);
SELECT throws_ok(
  $$ INSERT INTO public.group_members (group_id, user_id, role, status)
     VALUES ('bd000000-0000-4000-8000-0000000000f1',
             'bd000000-0000-4000-8000-0000000000a6', 'organizer', 'active') $$,
  '42501', NULL,
  '60. REV-03. organizer : forge d''un organizer refusee (invite_members borne)'
);

-- Transferts de propriete (I2)
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a2';

SELECT lives_ok(
  $$ INSERT INTO public.group_polls (id, group_id, created_by, question, options)
     VALUES ('bd000000-0000-4000-8000-0000000000b3',
             'bd000000-0000-4000-8000-0000000000f1',
             'bd000000-0000-4000-8000-0000000000a2', 'Q B', '["a","b"]'::jsonb) $$,
  '61. REV-04. member : creation de son propre sondage'
);
SELECT throws_ok(
  $$ UPDATE public.group_polls SET created_by = 'bd000000-0000-4000-8000-0000000000a1'
     WHERE id = 'bd000000-0000-4000-8000-0000000000b3' $$,
  '42501', NULL,
  '62. REV-04. member : transfert de propriete du sondage refuse'
);
SELECT lives_ok(
  $$ INSERT INTO public.group_album (id, group_id, uploaded_by, image_url)
     VALUES ('bd000000-0000-4000-8000-0000000000b4',
             'bd000000-0000-4000-8000-0000000000f1',
             'bd000000-0000-4000-8000-0000000000a2', 'img-b2.jpg') $$,
  '63. REV-04. member : ajout de sa propre photo'
);
SELECT throws_ok(
  $$ UPDATE public.group_album SET uploaded_by = 'bd000000-0000-4000-8000-0000000000a1'
     WHERE id = 'bd000000-0000-4000-8000-0000000000b4' $$,
  '42501', NULL,
  '64. REV-04. member : transfert de propriete de la photo refuse'
);

-- Membre pending : l'invitation reste visible (branche pending de groups_public_read)
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a4';

SELECT is(
  (SELECT count(*)::int FROM public.travel_groups
   WHERE id = 'bd000000-0000-4000-8000-0000000000f1'),
  1,
  '65. REV-05. membre pending : lecture de son groupe (invitation visible)'
);

-- RPC d'agregats publics : compteurs sans lecture de lignes
SELECT is(
  (SELECT count(*)::int FROM public.group_public_card_stats(ARRAY['bd000000-0000-4000-8000-0000000000f1']::uuid[])),
  0,
  '66. REV-06. RPC stats : groupe prive exclu'
);
SELECT is(
  (SELECT (active_members, pending_members)::text
     FROM public.group_public_card_stats(ARRAY['bd000000-0000-4000-8000-0000000000f4']::uuid[])),
  '(1,1)',
  '67. REV-06. RPC stats : compteurs du groupe public (1 actif, 1 pending)'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 68..70 — Contre-revue : cibles historiques, forge co_organizer
-- ════════════════════════════════════════════════════════════════════════════
RESET ROLE;
RESET "request.jwt.claim.sub";

-- Fixtures : Y rejoint f1, paie une depense, puis quitte le groupe.
INSERT INTO public.group_members (group_id, user_id, role, status)
VALUES ('bd000000-0000-4000-8000-0000000000f1',
        'bd000000-0000-4000-8000-0000000000a6', 'member', 'active')
ON CONFLICT (group_id, user_id) DO UPDATE SET role = 'member', status = 'active';

INSERT INTO public.group_expenses (id, group_id, paid_by, title, amount)
VALUES ('bd000000-0000-4000-8000-0000000000b5',
        'bd000000-0000-4000-8000-0000000000f1',
        'bd000000-0000-4000-8000-0000000000a6', 'Depense partant', 42);

UPDATE public.group_members SET status = 'removed'
WHERE group_id = 'bd000000-0000-4000-8000-0000000000f1'
  AND user_id = 'bd000000-0000-4000-8000-0000000000a6';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a1';

SELECT lives_ok(
  $$ UPDATE public.group_expenses SET status = 'settled'
     WHERE id = 'bd000000-0000-4000-8000-0000000000b5' $$,
  '68. REV-07. organizer : regler la depense d''un payeur parti reste possible'
);
SELECT throws_ok(
  $$ UPDATE public.group_expenses SET paid_by = 'bd000000-0000-4000-8000-0000000000a6'
     WHERE id = 'bd000000-0000-4000-8000-0000000000ea' $$,
  '42501', NULL,
  '69. REV-07. organizer : reaffectation a une cible non active refusee'
);

-- Forge co_organizer : Y n'a plus de ligne, l'insert doit etre refuse par la policy.
RESET ROLE;
DELETE FROM public.group_members
WHERE group_id = 'bd000000-0000-4000-8000-0000000000f1'
  AND user_id = 'bd000000-0000-4000-8000-0000000000a6';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a1';

SELECT throws_ok(
  $$ INSERT INTO public.group_members (group_id, user_id, role, status)
     VALUES ('bd000000-0000-4000-8000-0000000000f1',
             'bd000000-0000-4000-8000-0000000000a6', 'co_organizer', 'active') $$,
  '42501', NULL,
  '70. REV-08. organizer : forge d''un co_organizer refusee (invite_members borne)'
);

SELECT * FROM finish();
ROLLBACK;
