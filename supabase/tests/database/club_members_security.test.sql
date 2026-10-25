BEGIN;
SELECT plan(17);

-- ----------------------------------------------------------------------------
-- F-001 — club_members : fin de l'escalade de privilèges
-- Vérifie que les voies ALL permissives sont fermées, que les policies de
-- commande tiennent, et que le trigger de protection des colonnes
-- privilégiées (rôle, statut, club, utilisateur, joined_at) s'applique.
-- ----------------------------------------------------------------------------

-- ── Fixtures (superuser, transaction annulée en fin de test) ────────────────
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('aaaa1111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'clubs_a@test.local', 'x', '{}', '{}', now(), now()),
  ('bbbb2222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'clubs_b@test.local', 'x', '{}', '{}', now(), now()),
  ('cccc3333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'clubs_c@test.local', 'x', '{}', '{}', now(), now()),
  ('dddd4444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'clubs_d@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('aaaa1111-1111-1111-1111-111111111111', 'Alice Créatrice', 'clubs_a@test.local'),
  ('bbbb2222-2222-2222-2222-222222222222', 'Bruno Membre', 'clubs_b@test.local'),
  ('cccc3333-3333-3333-3333-333333333333', 'Chloé Bannie', 'clubs_c@test.local'),
  ('dddd4444-4444-4444-4444-444444444444', 'David Nouveau', 'clubs_d@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, slug, name, privacy, created_by) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'club-ouvert-test', 'Club ouvert test', 'open', 'aaaa1111-1111-1111-1111-111111111111'),
  ('d2222222-2222-2222-2222-222222222222', 'club-ferme-test', 'Club fermé test', 'closed', 'aaaa1111-1111-1111-1111-111111111111'),
  ('d3333333-3333-3333-3333-333333333333', 'club-neuf-test', 'Club neuf test', 'open', 'aaaa1111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.club_members (id, club_id, user_id, role, status) VALUES
  ('e1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'aaaa1111-1111-1111-1111-111111111111', 'admin', 'active'),
  ('e2222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 'bbbb2222-2222-2222-2222-222222222222', 'member', 'active'),
  ('e3333333-3333-3333-3333-333333333333', 'd1111111-1111-1111-1111-111111111111', 'cccc3333-3333-3333-3333-333333333333', 'member', 'banned')
ON CONFLICT (id) DO NOTHING;

-- ── 1-3 : un membre ne peut pas muter sa propre adhésion ────────────────────
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bbbb2222-2222-2222-2222-222222222222';

UPDATE public.club_members SET role = 'admin'
 WHERE club_id = 'd1111111-1111-1111-1111-111111111111'
   AND user_id = 'bbbb2222-2222-2222-2222-222222222222';
SELECT is(
  (SELECT role FROM public.club_members WHERE club_id = 'd1111111-1111-1111-1111-111111111111' AND user_id = 'bbbb2222-2222-2222-2222-222222222222'),
  'member',
  '1. Un membre ne peut pas se promouvoir admin (role inchangé)'
);

UPDATE public.club_members SET status = 'banned'
 WHERE club_id = 'd1111111-1111-1111-1111-111111111111'
   AND user_id = 'bbbb2222-2222-2222-2222-222222222222';
SELECT is(
  (SELECT status FROM public.club_members WHERE club_id = 'd1111111-1111-1111-1111-111111111111' AND user_id = 'bbbb2222-2222-2222-2222-222222222222'),
  'active',
  '2. Un membre ne peut pas se bannir lui-même (statut inchangé)'
);

UPDATE public.club_members SET club_id = 'd2222222-2222-2222-2222-222222222222'
 WHERE club_id = 'd1111111-1111-1111-1111-111111111111'
   AND user_id = 'bbbb2222-2222-2222-2222-222222222222';
SELECT is(
  (SELECT club_id FROM public.club_members WHERE user_id = 'bbbb2222-2222-2222-2222-222222222222'),
  'd1111111-1111-1111-1111-111111111111'::uuid,
  '3. Un membre ne peut pas déplacer son adhésion vers un autre club'
);

-- ── 4 : un utilisateur banni ne peut pas se réactiver ───────────────────────
SET LOCAL "request.jwt.claim.sub" = 'cccc3333-3333-3333-3333-333333333333';
UPDATE public.club_members SET status = 'active'
 WHERE club_id = 'd1111111-1111-1111-1111-111111111111'
   AND user_id = 'cccc3333-3333-3333-3333-333333333333';
SELECT is(
  (SELECT status FROM public.club_members WHERE club_id = 'd1111111-1111-1111-1111-111111111111' AND user_id = 'cccc3333-3333-3333-3333-333333333333'),
  'banned',
  '4. Un membre banni ne peut pas se réactiver'
);

-- ── 5-8 : insertion : auto-adhésion simple uniquement, club ouvert ──────────
SET LOCAL "request.jwt.claim.sub" = 'dddd4444-4444-4444-4444-444444444444';
SELECT throws_ok(
  $$ INSERT INTO public.club_members (club_id, user_id, role, status)
     VALUES ('d1111111-1111-1111-1111-111111111111', 'dddd4444-4444-4444-4444-444444444444', 'admin', 'active') $$,
  '42501', NULL,
  '5. Impossible de s''insérer admin dans un club (policy + trigger)'
);
SELECT throws_ok(
  $$ INSERT INTO public.club_members (club_id, user_id, role, status)
     VALUES ('d1111111-1111-1111-1111-111111111111', 'dddd4444-4444-4444-4444-444444444444', 'moderator', 'active') $$,
  '42501', NULL,
  '6. Impossible de s''insérer modérateur dans un club'
);
SELECT throws_ok(
  $$ INSERT INTO public.club_members (club_id, user_id, role, status)
     VALUES ('d2222222-2222-2222-2222-222222222222', 'dddd4444-4444-4444-4444-444444444444', 'member', 'active') $$,
  '42501', NULL,
  '7. Impossible de rejoindre directement un club fermé (dossier club_join_requests requis)'
);
SELECT lives_ok(
  $$ INSERT INTO public.club_members (club_id, user_id, role, status)
     VALUES ('d1111111-1111-1111-1111-111111111111', 'dddd4444-4444-4444-4444-444444444444', 'member', 'active') $$,
  '8. Auto-adhésion simple acceptée dans un club ouvert'
);

-- ── 9 : le créateur peut s'auto-adhérer admin ───────────────────────────────
SET LOCAL "request.jwt.claim.sub" = 'aaaa1111-1111-1111-1111-111111111111';
SELECT lives_ok(
  $$ INSERT INTO public.club_members (club_id, user_id, role, status)
     VALUES ('d3333333-3333-3333-3333-333333333333', 'aaaa1111-1111-1111-1111-111111111111', 'admin', 'active') $$,
  '9. Le créateur du club peut s''auto-adhérer admin'
);

-- ── 10 : un membre ne peut pas modérer un autre membre ──────────────────────
SET LOCAL "request.jwt.claim.sub" = 'bbbb2222-2222-2222-2222-222222222222';
UPDATE public.club_members SET status = 'banned'
 WHERE club_id = 'd1111111-1111-1111-1111-111111111111'
   AND user_id = 'dddd4444-4444-4444-4444-444444444444';
SELECT is(
  (SELECT status FROM public.club_members WHERE club_id = 'd1111111-1111-1111-1111-111111111111' AND user_id = 'dddd4444-4444-4444-4444-444444444444'),
  'active',
  '10. Un membre ne peut pas bannir un autre membre'
);

-- ── 11-12 : un admin promeut, le modérateur bannit ──────────────────────────
SET LOCAL "request.jwt.claim.sub" = 'aaaa1111-1111-1111-1111-111111111111';
UPDATE public.club_members SET role = 'moderator'
 WHERE club_id = 'd1111111-1111-1111-1111-111111111111'
   AND user_id = 'bbbb2222-2222-2222-2222-222222222222';
SELECT is(
  (SELECT role FROM public.club_members WHERE club_id = 'd1111111-1111-1111-1111-111111111111' AND user_id = 'bbbb2222-2222-2222-2222-222222222222'),
  'moderator',
  '11. Un admin peut promouvoir un membre modérateur'
);

SET LOCAL "request.jwt.claim.sub" = 'bbbb2222-2222-2222-2222-222222222222';
UPDATE public.club_members SET status = 'banned'
 WHERE club_id = 'd1111111-1111-1111-1111-111111111111'
   AND user_id = 'dddd4444-4444-4444-4444-444444444444';
SELECT is(
  (SELECT status FROM public.club_members WHERE club_id = 'd1111111-1111-1111-1111-111111111111' AND user_id = 'dddd4444-4444-4444-4444-444444444444'),
  'banned',
  '12. Un modérateur actif peut bannir un membre'
);

-- ── 13-14 : trigger de protection des colonnes immuables (même pour admin) ──
SET LOCAL "request.jwt.claim.sub" = 'aaaa1111-1111-1111-1111-111111111111';
SELECT throws_ok(
  $$ UPDATE public.club_members SET joined_at = now() + interval '1 day'
     WHERE club_id = 'd1111111-1111-1111-1111-111111111111'
       AND user_id = 'dddd4444-4444-4444-4444-444444444444' $$,
  '42501', NULL,
  '13. La date d''adhésion est immuable, même pour un admin (trigger)'
);
SELECT throws_ok(
  $$ UPDATE public.club_members SET user_id = 'cccc3333-3333-3333-3333-333333333333'
     WHERE club_id = 'd1111111-1111-1111-1111-111111111111'
       AND user_id = 'dddd4444-4444-4444-4444-444444444444' $$,
  '42501', NULL,
  '14. L''utilisateur d''une adhésion est immuable (trigger)'
);

-- ── 15 : quitter un club = supprimer sa propre adhésion ─────────────────────
SET LOCAL "request.jwt.claim.sub" = 'bbbb2222-2222-2222-2222-222222222222';
DELETE FROM public.club_members
 WHERE club_id = 'd1111111-1111-1111-1111-111111111111'
   AND user_id = 'bbbb2222-2222-2222-2222-222222222222';
SELECT is_empty(
  $$ SELECT 1 FROM public.club_members
     WHERE club_id = 'd1111111-1111-1111-1111-111111111111'
       AND user_id = 'bbbb2222-2222-2222-2222-222222222222' $$,
  '15. Un membre peut quitter un club (DELETE de sa propre adhésion)'
);

-- ── 16-17 : inventaire : plus aucune voie ALL + trigger présent ─────────────
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'club_members'
      AND permissive = 'PERMISSIVE' AND cmd = 'ALL'),
  0,
  '16. Plus aucune policy ALL PERMISSIVE sur club_members'
);
SELECT has_trigger('public', 'club_members', 'guard_club_member_privileged_columns',
  '17. Le trigger de protection des colonnes privilégiées est actif'
);

SELECT * FROM finish();
ROLLBACK;
