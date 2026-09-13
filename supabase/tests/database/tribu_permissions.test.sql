-- ============================================================================
-- TRIBU — Permissions de groupe : capacites, policies, integrite des roles
-- ============================================================================
--   • 1..16  : couche capacites (matrice, overrides, search_path durci)
--   • 17..   : policies par commande (Member self-only, observer muet)
--   • ...    : integrite des roles (trigger) — ajoute en Task 3
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

SELECT plan(16);

-- ----------------------------------------------------------------------------
-- Fixtures — A organizer, B member, C observer, X non-membre, D pending
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('bd000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'tribu_a@test.local', 'x', '{}', '{}', now(), now()),
  ('bd000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'tribu_b@test.local', 'x', '{}', '{}', now(), now()),
  ('bd000000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'tribu_c@test.local', 'x', '{}', '{}', now(), now()),
  ('bd000000-0000-4000-8000-0000000000a4', 'authenticated', 'authenticated', 'tribu_x@test.local', 'x', '{}', '{}', now(), now()),
  ('bd000000-0000-4000-8000-0000000000a5', 'authenticated', 'authenticated', 'tribu_d@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email, role, trust_score)
VALUES
  ('bd000000-0000-4000-8000-0000000000a1', 'TRIBU Organisateur', 'tribu_a@test.local', 'user', 50),
  ('bd000000-0000-4000-8000-0000000000a2', 'TRIBU Membre', 'tribu_b@test.local', 'user', 50),
  ('bd000000-0000-4000-8000-0000000000a3', 'TRIBU Observateur', 'tribu_c@test.local', 'user', 50),
  ('bd000000-0000-4000-8000-0000000000a4', 'TRIBU Externe', 'tribu_x@test.local', 'user', 50),
  ('bd000000-0000-4000-8000-0000000000a5', 'TRIBU En attente', 'tribu_d@test.local', 'user', 50)
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

INSERT INTO public.travel_groups (id, name, owner_id, visibility)
VALUES ('bd000000-0000-4000-8000-0000000000f1', 'TRIBU Groupe Test', 'bd000000-0000-4000-8000-0000000000a1', 'private')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.group_members (group_id, user_id, role, status)
VALUES
  ('bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a1', 'organizer', 'active'),
  ('bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a2', 'member', 'active'),
  ('bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a3', 'observer', 'active'),
  ('bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a5', 'member', 'pending')
ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- --- Capacites ---------------------------------------------------------------
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

SELECT * FROM finish();
ROLLBACK;
