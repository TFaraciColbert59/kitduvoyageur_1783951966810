-- ============================================================================
-- TRIBU — Phase 1 : pont Club -> Groupe (parent_club_id, club_only)
-- ============================================================================
--   • 1..4  : is_club_member (actif uniquement)
--   • 5..7  : structure (enum, colonne FK, index)
--   • 8..12 : RLS club_only (membres du club oui, autres non)
--   • 13..14: controles negatifs (public inchangé, club_only sans parent ferme)
-- Execution : pgTAP, transaction annulee (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;

GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clubs, public.club_members,
  public.travel_groups, public.group_members, public.user_profiles
TO authenticated, service_role;

SELECT plan(14);

-- Fixtures
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('bd000000-0000-4000-8000-0000000000c1', 'authenticated', 'authenticated', 'tribu_ca@test.local', 'x', '{}', '{}', now(), now()),
  ('bd000000-0000-4000-8000-0000000000c2', 'authenticated', 'authenticated', 'tribu_cb@test.local', 'x', '{}', '{}', now(), now()),
  ('bd000000-0000-4000-8000-0000000000c3', 'authenticated', 'authenticated', 'tribu_cc@test.local', 'x', '{}', '{}', now(), now()),
  ('bd000000-0000-4000-8000-0000000000c4', 'authenticated', 'authenticated', 'tribu_cx@test.local', 'x', '{}', '{}', now(), now()),
  ('bd000000-0000-4000-8000-0000000000c5', 'authenticated', 'authenticated', 'tribu_cd@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email, role, trust_score)
VALUES
  ('bd000000-0000-4000-8000-0000000000c1', 'TRIBU Club Admin', 'tribu_ca@test.local', 'user', 50),
  ('bd000000-0000-4000-8000-0000000000c2', 'TRIBU Club Membre', 'tribu_cb@test.local', 'user', 50),
  ('bd000000-0000-4000-8000-0000000000c3', 'TRIBU Hors Club', 'tribu_cc@test.local', 'user', 50),
  ('bd000000-0000-4000-8000-0000000000c4', 'TRIBU Autre Club', 'tribu_cx@test.local', 'user', 50),
  ('bd000000-0000-4000-8000-0000000000c5', 'TRIBU Club Parti', 'tribu_cd@test.local', 'user', 50)
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

INSERT INTO public.clubs (id, name, slug, privacy, created_by)
VALUES
  ('bd000000-0000-4000-8000-0000000000d1', 'TRIBU Club Test', 'tribu-club-test', 'public', 'bd000000-0000-4000-8000-0000000000c1'),
  ('bd000000-0000-4000-8000-0000000000d2', 'TRIBU Club Autre', 'tribu-club-autre', 'public', 'bd000000-0000-4000-8000-0000000000c4')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.club_members (club_id, user_id, role, status)
VALUES
  ('bd000000-0000-4000-8000-0000000000d1', 'bd000000-0000-4000-8000-0000000000c1', 'admin', 'active'),
  ('bd000000-0000-4000-8000-0000000000d1', 'bd000000-0000-4000-8000-0000000000c2', 'member', 'active'),
  ('bd000000-0000-4000-8000-0000000000d1', 'bd000000-0000-4000-8000-0000000000c5', 'member', 'banned'),
  ('bd000000-0000-4000-8000-0000000000d2', 'bd000000-0000-4000-8000-0000000000c4', 'admin', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO public.travel_groups (id, name, owner_id, visibility, parent_club_id)
VALUES
  ('bd000000-0000-4000-8000-0000000000e1', 'TRIBU Groupe du Club',
   'bd000000-0000-4000-8000-0000000000c1', 'club_only', 'bd000000-0000-4000-8000-0000000000d1'),
  ('bd000000-0000-4000-8000-0000000000e2', 'TRIBU Groupe Public Club',
   'bd000000-0000-4000-8000-0000000000c1', 'public', NULL),
  ('bd000000-0000-4000-8000-0000000000e3', 'TRIBU Groupe Club Sans Parent',
   'bd000000-0000-4000-8000-0000000000c1', 'club_only', NULL)
ON CONFLICT (id) DO NOTHING;

-- 1..4 — is_club_member
SELECT ok(
  public.is_club_member('bd000000-0000-4000-8000-0000000000d1', 'bd000000-0000-4000-8000-0000000000c1'),
  '1. CLUB-01. admin actif : membre'
);
SELECT ok(
  NOT public.is_club_member('bd000000-0000-4000-8000-0000000000d1', 'bd000000-0000-4000-8000-0000000000c3'),
  '2. CLUB-01. hors club : non membre'
);
SELECT ok(
  NOT public.is_club_member('bd000000-0000-4000-8000-0000000000d1', 'bd000000-0000-4000-8000-0000000000c5'),
  '3. CLUB-01. membre non actif (banned) : non membre'
);
SELECT ok(
  NOT public.is_club_member('bd000000-0000-4000-8000-0000000000d1', 'bd000000-0000-4000-8000-0000000000c4'),
  '4. CLUB-01. membre d''un autre club : non membre'
);

-- 5..7 — structure
SELECT ok(
  EXISTS (
    SELECT 1 FROM unnest(enum_range(NULL::public.group_visibility)) AS e
    WHERE e::text = 'club_only'
  ),
  '5. CLUB-02. enum group_visibility enrichie de club_only'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'travel_groups'
      AND column_name = 'parent_club_id' AND data_type = 'uuid'
  )
  AND EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'travel_groups_parent_club_id_fkey'
      AND confrelid = 'public.clubs'::regclass
  ),
  '6. CLUB-02. parent_club_id uuid + FK clubs'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_travel_groups_parent_club'
  ),
  '7. CLUB-02. index parent_club_id present'
);

-- 8..12 — RLS club_only
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000c1';

SELECT is(
  (SELECT count(*)::int FROM public.travel_groups WHERE id = 'bd000000-0000-4000-8000-0000000000e1'),
  1,
  '8. CLUB-03. admin du club : groupe club_only visible'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000c2';

SELECT is(
  (SELECT count(*)::int FROM public.travel_groups WHERE id = 'bd000000-0000-4000-8000-0000000000e1'),
  1,
  '9. CLUB-03. membre du club : groupe club_only visible'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000c3';

SELECT is(
  (SELECT count(*)::int FROM public.travel_groups WHERE id = 'bd000000-0000-4000-8000-0000000000e1'),
  0,
  '10. CLUB-03. non-membre du club : groupe club_only invisible'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000c4';

SELECT is(
  (SELECT count(*)::int FROM public.travel_groups WHERE id = 'bd000000-0000-4000-8000-0000000000e1'),
  0,
  '11. CLUB-03. membre d''un autre club : invisible'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000c5';

SELECT is(
  (SELECT count(*)::int FROM public.travel_groups WHERE id = 'bd000000-0000-4000-8000-0000000000e1'),
  0,
  '12. CLUB-03. membre non actif : invisible'
);

-- 13..14 — controles negatifs
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000c3';

SELECT is(
  (SELECT count(*)::int FROM public.travel_groups WHERE id = 'bd000000-0000-4000-8000-0000000000e2'),
  1,
  '13. CLUB-04. groupe public sans club : lecture conservee'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000c2';

SELECT is(
  (SELECT count(*)::int FROM public.travel_groups WHERE id = 'bd000000-0000-4000-8000-0000000000e3'),
  0,
  '14. CLUB-04. club_only sans parent : ferme aux membres du club'
);

SELECT * FROM finish();
ROLLBACK;
