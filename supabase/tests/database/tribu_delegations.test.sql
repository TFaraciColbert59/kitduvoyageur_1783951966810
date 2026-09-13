-- ============================================================================
-- TRIBU — Phase 3 : delegations temporaires de role
-- ============================================================================
--   • 1..7  : resolution des capacites (fenetre, override, non-membre)
--   • 8..13 : RLS (qui peut creer/revoquer) + contraintes
-- Execution : pgTAP, transaction annulee (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;

GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.travel_groups, public.group_members,
  public.group_role_delegations, public.group_member_capability_overrides,
  public.user_profiles
TO authenticated, service_role;

SELECT plan(13);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('bd000000-0000-4000-8000-0000000000d1', 'authenticated', 'authenticated', 'tribu_del_a@test.local', 'x', '{}', '{}', now(), now()),
  ('bd000000-0000-4000-8000-0000000000d2', 'authenticated', 'authenticated', 'tribu_del_b@test.local', 'x', '{}', '{}', now(), now()),
  ('bd000000-0000-4000-8000-0000000000d3', 'authenticated', 'authenticated', 'tribu_del_d@test.local', 'x', '{}', '{}', now(), now()),
  ('bd000000-0000-4000-8000-0000000000d4', 'authenticated', 'authenticated', 'tribu_del_x@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email, role, trust_score)
VALUES
  ('bd000000-0000-4000-8000-0000000000d1', 'DEL Organisateur', 'tribu_del_a@test.local', 'user', 50),
  ('bd000000-0000-4000-8000-0000000000d2', 'DEL Membre', 'tribu_del_b@test.local', 'user', 50),
  ('bd000000-0000-4000-8000-0000000000d3', 'DEL Delegue', 'tribu_del_d@test.local', 'user', 50),
  ('bd000000-0000-4000-8000-0000000000d4', 'DEL Externe', 'tribu_del_x@test.local', 'user', 50)
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

INSERT INTO public.travel_groups (id, name, owner_id, visibility)
VALUES ('bd000000-0000-4000-8000-0000000000e1', 'DEL Groupe', 'bd000000-0000-4000-8000-0000000000d1', 'private')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.group_members (group_id, user_id, role, status)
VALUES
  ('bd000000-0000-4000-8000-0000000000e1', 'bd000000-0000-4000-8000-0000000000d1', 'organizer', 'active'),
  ('bd000000-0000-4000-8000-0000000000e1', 'bd000000-0000-4000-8000-0000000000d2', 'member', 'active'),
  ('bd000000-0000-4000-8000-0000000000e1', 'bd000000-0000-4000-8000-0000000000d3', 'member', 'active')
ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- A -> D : delegation organizer active
INSERT INTO public.group_role_delegations
  (id, group_id, from_user_id, to_user_id, delegated_role, starts_at, ends_at)
VALUES
  ('bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000e1',
   'bd000000-0000-4000-8000-0000000000d1', 'bd000000-0000-4000-8000-0000000000d3',
   'organizer', now() - interval '1 hour', now() + interval '2 hours')
ON CONFLICT (id) DO NOTHING;

-- 1..2 — capacites accordees par la delegation active
SELECT ok(
  public.group_member_has_capability('bd000000-0000-4000-8000-0000000000e1', 'bd000000-0000-4000-8000-0000000000d3', 'manage_tasks'),
  '1. DEL-01. delegue organizer : manage_tasks accorde'
);
SELECT ok(
  public.group_member_has_capability('bd000000-0000-4000-8000-0000000000e1', 'bd000000-0000-4000-8000-0000000000d3', 'manage_members'),
  '2. DEL-01. delegue organizer : manage_members accorde'
);

-- 3 — fenetre expiree
UPDATE public.group_role_delegations
SET ends_at = now() - interval '1 minute'
WHERE id = 'bd000000-0000-4000-8000-0000000000f1';

SELECT ok(
  NOT public.group_member_has_capability('bd000000-0000-4000-8000-0000000000e1', 'bd000000-0000-4000-8000-0000000000d3', 'manage_tasks'),
  '3. DEL-02. delegation expiree ignoree'
);

-- 4..5 — override explicite prioritaire sur la delegation (reactivee)
UPDATE public.group_role_delegations
SET ends_at = now() + interval '2 hours'
WHERE id = 'bd000000-0000-4000-8000-0000000000f1';

INSERT INTO public.group_member_capability_overrides (group_id, user_id, capability, allowed)
VALUES ('bd000000-0000-4000-8000-0000000000e1', 'bd000000-0000-4000-8000-0000000000d3', 'manage_tasks', false)
ON CONFLICT (group_id, user_id, capability) DO UPDATE SET allowed = EXCLUDED.allowed;

SELECT ok(
  NOT public.group_member_has_capability('bd000000-0000-4000-8000-0000000000e1', 'bd000000-0000-4000-8000-0000000000d3', 'manage_tasks'),
  '4. DEL-03. override false prioritaire sur la delegation'
);
SELECT ok(
  public.group_member_has_capability('bd000000-0000-4000-8000-0000000000e1', 'bd000000-0000-4000-8000-0000000000d3', 'manage_members'),
  '5. DEL-03. les autres capacites delegees restent actives'
);

-- 6 — delegation vers un non-membre : ignoree
SELECT ok(
  NOT public.group_member_has_capability('bd000000-0000-4000-8000-0000000000e1', 'bd000000-0000-4000-8000-0000000000d4', 'manage_tasks'),
  '6. DEL-04. non-membre : delegation sans effet'
);

-- 7..12 — RLS
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000d2';

SELECT throws_ok(
  $$ INSERT INTO public.group_role_delegations (group_id, from_user_id, to_user_id, delegated_role, ends_at)
     VALUES ('bd000000-0000-4000-8000-0000000000e1',
             'bd000000-0000-4000-8000-0000000000d1',
             'bd000000-0000-4000-8000-0000000000d3',
             'organizer', now() + interval '1 hour') $$,
  '42501', NULL,
  '7. DEL-05. membre : delegation au nom d''autrui refusee'
);
SELECT throws_ok(
  $$ INSERT INTO public.group_role_delegations (group_id, from_user_id, to_user_id, delegated_role, ends_at)
     VALUES ('bd000000-0000-4000-8000-0000000000e1',
             'bd000000-0000-4000-8000-0000000000d2',
             'bd000000-0000-4000-8000-0000000000d3',
             'organizer', now() + interval '1 hour') $$,
  '42501', NULL,
  '8. DEL-05. membre : delegation d''un role superieur refusee'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000d1';

SELECT lives_ok(
  $$ INSERT INTO public.group_role_delegations (id, group_id, from_user_id, to_user_id, delegated_role, ends_at)
     VALUES ('bd000000-0000-4000-8000-0000000000f2',
             'bd000000-0000-4000-8000-0000000000e1',
             'bd000000-0000-4000-8000-0000000000d1',
             'bd000000-0000-4000-8000-0000000000d3',
             'co_organizer', now() + interval '3 hours') $$,
  '9. DEL-06. organizer : delegation autorisee'
);
SELECT throws_ok(
  $$ INSERT INTO public.group_role_delegations (group_id, from_user_id, to_user_id, delegated_role, ends_at)
     VALUES ('bd000000-0000-4000-8000-0000000000e1',
             'bd000000-0000-4000-8000-0000000000d1',
             'bd000000-0000-4000-8000-0000000000d4',
             'member', now() + interval '1 hour') $$,
  '42501', NULL,
  '10. DEL-06. cible non membre actif refusee'
);
SELECT throws_ok(
  $$ INSERT INTO public.group_role_delegations (group_id, from_user_id, to_user_id, delegated_role, starts_at, ends_at)
     VALUES ('bd000000-0000-4000-8000-0000000000e1',
             'bd000000-0000-4000-8000-0000000000d1',
             'bd000000-0000-4000-8000-0000000000d3',
             'member', now(), now() - interval '1 hour') $$,
  '23514', NULL,
  '11. DEL-07. fenetre invalide refusee (contrainte)'
);

-- 12 — le delegataire peut reprendre la main (revoquer)
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000d3';

SELECT lives_ok(
  $$ DELETE FROM public.group_role_delegations
     WHERE id = 'bd000000-0000-4000-8000-0000000000f2' $$,
  '12. DEL-08. delegataire : revocation de sa delegation autorisee'
);

RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.group_role_delegations
   WHERE id = 'bd000000-0000-4000-8000-0000000000f2'),
  0,
  '13. DEL-08. delegation revoquee disparue'
);

SELECT * FROM finish();
ROLLBACK;
