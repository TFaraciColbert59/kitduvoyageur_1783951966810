BEGIN;
SELECT plan(23);

-- ═══════════════════════════════════════════════════════════════════════════
-- Communauté v2 — lot D : adhésion aux clubs (20261108130004)
-- Couvre : join_club open/closed/secret/banni + idempotence, answers stockées,
-- cancel_join_request, review_join_request (membre simple refusé, admin OK,
-- rejeu sans effet, refus), leave_club (dont dernier admin et banni),
-- members_count recalculé, invité refusé.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('c1b10000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'club_admin@test.local', 'x', '{}', '{}', now(), now()),
  ('c1b10000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'club_membre@test.local', 'x', '{}', '{}', now(), now()),
  ('c1b10000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'club_candidat@test.local', 'x', '{}', '{}', now(), now()),
  ('c1b10000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'club_banni@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('c1b10000-0000-4000-8000-000000000001', 'Léa Admin', 'club_admin@test.local'),
  ('c1b10000-0000-4000-8000-000000000002', 'Marc Membre', 'club_membre@test.local'),
  ('c1b10000-0000-4000-8000-000000000003', 'Nina Candidat', 'club_candidat@test.local'),
  ('c1b10000-0000-4000-8000-000000000004', 'Omar Banni', 'club_banni@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, slug, name, privacy, created_by, members_count, join_questions, activities, rules, location_label) VALUES
  ('c1b20000-0000-4000-8000-000000000001', 'v2-club-ouvert', 'Club ouvert v2', 'open',
   'c1b10000-0000-4000-8000-000000000001', 2, '[]'::jsonb, '{rando}', 'Respect et bienveillance.', 'Chamonix'),
  ('c1b20000-0000-4000-8000-000000000002', 'v2-club-validation', 'Club sur validation v2', 'closed',
   'c1b10000-0000-4000-8000-000000000001', 1, '["Pourquoi veux-tu rejoindre ?"]'::jsonb, '{trail}', NULL, 'Annecy'),
  ('c1b20000-0000-4000-8000-000000000003', 'v2-club-secret', 'Club secret v2', 'secret',
   'c1b10000-0000-4000-8000-000000000001', 1, '[]'::jsonb, '{}', NULL, NULL),
  ('c1b20000-0000-4000-8000-000000000004', 'v2-club-dernier-admin', 'Club dernier admin v2', 'open',
   'c1b10000-0000-4000-8000-000000000002', 1, '[]'::jsonb, '{}', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.club_members (club_id, user_id, role, status) VALUES
  ('c1b20000-0000-4000-8000-000000000001', 'c1b10000-0000-4000-8000-000000000001', 'admin', 'active'),
  ('c1b20000-0000-4000-8000-000000000001', 'c1b10000-0000-4000-8000-000000000002', 'member', 'active'),
  ('c1b20000-0000-4000-8000-000000000001', 'c1b10000-0000-4000-8000-000000000004', 'member', 'banned'),
  ('c1b20000-0000-4000-8000-000000000002', 'c1b10000-0000-4000-8000-000000000001', 'admin', 'active'),
  ('c1b20000-0000-4000-8000-000000000003', 'c1b10000-0000-4000-8000-000000000001', 'admin', 'active'),
  ('c1b20000-0000-4000-8000-000000000004', 'c1b10000-0000-4000-8000-000000000002', 'admin', 'active')
ON CONFLICT (club_id, user_id) DO NOTHING;

SET LOCAL ROLE authenticated;

-- ── 1-3 : club ouvert : adhésion + idempotence ────────────────────────────
SET LOCAL "request.jwt.claim.sub" = 'c1b10000-0000-4000-8000-000000000003';
SELECT is(
  (SELECT public.join_club('c1b20000-0000-4000-8000-000000000001')),
  'member',
  '1. join_club : club ouvert → membre direct'
);
SELECT is(
  (SELECT count(*)::int FROM public.club_members
    WHERE club_id = 'c1b20000-0000-4000-8000-000000000001'
      AND user_id = 'c1b10000-0000-4000-8000-000000000003'
      AND status = 'active'),
  1,
  '2. join_club : une seule adhésion active'
);
SELECT is(
  (SELECT public.join_club('c1b20000-0000-4000-8000-000000000001')),
  'member',
  '3. join_club : double appel idempotent (toujours membre)'
);
SELECT is(
  (SELECT count(*)::int FROM public.club_members
    WHERE club_id = 'c1b20000-0000-4000-8000-000000000001'
      AND user_id = 'c1b10000-0000-4000-8000-000000000003'),
  1,
  '4. join_club : aucune double adhésion créée'
);
SELECT is(
  (SELECT members_count FROM public.clubs WHERE id = 'c1b20000-0000-4000-8000-000000000001'),
  3,
  '5. join_club : members_count recalculé (2 + la nouvelle adhésion)'
);

-- ── 6-8 : club sur validation : demande + réponses ────────────────────────
SELECT is(
  (SELECT public.join_club('c1b20000-0000-4000-8000-000000000002', '["Parce que le trail"]'::jsonb)),
  'pending',
  '6. join_club : club sur validation → demande pending'
);
SELECT is(
  (SELECT answers FROM public.club_join_requests
    WHERE club_id = 'c1b20000-0000-4000-8000-000000000002'
      AND user_id = 'c1b10000-0000-4000-8000-000000000003'),
  '["Parce que le trail"]'::jsonb,
  '7. join_club : les réponses d''adhésion sont stockées'
);
SELECT is(
  (SELECT count(*)::int FROM public.club_join_requests
    WHERE club_id = 'c1b20000-0000-4000-8000-000000000002'
      AND user_id = 'c1b10000-0000-4000-8000-000000000003'),
  1,
  '8. join_club : une seule demande (upsert)'
);

-- ── 9-10 : annulation de demande ─────────────────────────────────────────
SELECT is(
  (SELECT public.cancel_join_request('c1b20000-0000-4000-8000-000000000002')),
  'cancelled',
  '9. cancel_join_request : la demande est annulée'
);
SELECT is(
  (SELECT public.cancel_join_request('c1b20000-0000-4000-8000-000000000002')),
  'none',
  '10. cancel_join_request : rejeu sans effet'
);

-- ── 11-13 : secret et banni refusés ──────────────────────────────────────
SELECT throws_ok(
  $$ SELECT public.join_club('c1b20000-0000-4000-8000-000000000003') $$,
  'P0001',
  NULL,
  '11. join_club : club secret refusé sans invitation'
);
SET LOCAL "request.jwt.claim.sub" = 'c1b10000-0000-4000-8000-000000000004';
SELECT throws_ok(
  $$ SELECT public.join_club('c1b20000-0000-4000-8000-000000000001') $$,
  'P0001',
  NULL,
  '12. join_club : un banni ne peut pas rejoindre'
);
SELECT throws_ok(
  $$ SELECT public.leave_club('c1b20000-0000-4000-8000-000000000001') $$,
  'P0001',
  NULL,
  '13. leave_club : un banni ne peut pas retirer son exclusion'
);

-- ── 14-18 : review_join_request ──────────────────────────────────────────
-- Nouvelle demande à traiter.
SET LOCAL "request.jwt.claim.sub" = 'c1b10000-0000-4000-8000-000000000003';
SELECT is(
  (SELECT public.join_club('c1b20000-0000-4000-8000-000000000002')),
  'pending',
  '14. Nouvelle demande pending pour la modération'
);

-- Un simple membre du club (Marc) ne peut pas traiter une demande.
SET LOCAL "request.jwt.claim.sub" = 'c1b10000-0000-4000-8000-000000000002';
SELECT throws_ok(
  $$ SELECT public.review_join_request(
       (SELECT id FROM public.club_join_requests
         WHERE club_id = 'c1b20000-0000-4000-8000-000000000002'
           AND user_id = 'c1b10000-0000-4000-8000-000000000003'),
       true) $$,
  'P0001',
  NULL,
  '15. review_join_request : refusé à un simple membre'
);

-- L'admin (Léa) approuve.
SET LOCAL "request.jwt.claim.sub" = 'c1b10000-0000-4000-8000-000000000001';
SELECT is(
  (SELECT public.review_join_request(
     (SELECT id FROM public.club_join_requests
       WHERE club_id = 'c1b20000-0000-4000-8000-000000000002'
         AND user_id = 'c1b10000-0000-4000-8000-000000000003'),
     true) ->> 'status'),
  'approved',
  '16. review_join_request : approuvée par un admin'
);
SELECT is(
  (SELECT status FROM public.club_members
    WHERE club_id = 'c1b20000-0000-4000-8000-000000000002'
      AND user_id = 'c1b10000-0000-4000-8000-000000000003'),
  'active',
  '17. review_join_request : l''adhésion est créée'
);
SELECT is(
  (SELECT members_count FROM public.clubs WHERE id = 'c1b20000-0000-4000-8000-000000000002'),
  2,
  '18. review_join_request : compteur recalculé (admin + approuvé)'
);
SELECT is(
  (SELECT public.review_join_request(
     (SELECT id FROM public.club_join_requests
       WHERE club_id = 'c1b20000-0000-4000-8000-000000000002'
         AND user_id = 'c1b10000-0000-4000-8000-000000000003'),
     true) ->> 'changed'),
  'false',
  '19. review_join_request : rejeu sans effet (changed = false)'
);

-- Refus d'une nouvelle demande : aucune adhésion créée.
SET LOCAL "request.jwt.claim.sub" = 'c1b10000-0000-4000-8000-000000000003';
SELECT public.leave_club('c1b20000-0000-4000-8000-000000000002');
SELECT is(
  (SELECT public.join_club('c1b20000-0000-4000-8000-000000000002')),
  'pending',
  '20. Nouvelle demande après départ'
);
SET LOCAL "request.jwt.claim.sub" = 'c1b10000-0000-4000-8000-000000000001';
SELECT is(
  (SELECT public.review_join_request(
     (SELECT id FROM public.club_join_requests
       WHERE club_id = 'c1b20000-0000-4000-8000-000000000002'
         AND user_id = 'c1b10000-0000-4000-8000-000000000003'),
     false) ->> 'status'),
  'rejected',
  '21. review_join_request : refus enregistré'
);
SELECT is(
  (SELECT count(*)::int FROM public.club_members
    WHERE club_id = 'c1b20000-0000-4000-8000-000000000002'
      AND user_id = 'c1b10000-0000-4000-8000-000000000003'),
  0,
  '22. review_join_request : un refus ne crée aucune adhésion'
);

-- ── 23 : dernier admin ───────────────────────────────────────────────────
SET LOCAL "request.jwt.claim.sub" = 'c1b10000-0000-4000-8000-000000000002';
SELECT throws_ok(
  $$ SELECT public.leave_club('c1b20000-0000-4000-8000-000000000004') $$,
  'P0001',
  NULL,
  '23. leave_club : le dernier admin ne peut pas quitter le club'
);

-- ── 24-25 : invité refusé + départ simple ────────────────────────────────
RESET ROLE;
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" = '';
SELECT throws_ok(
  $$ SELECT public.join_club('c1b20000-0000-4000-8000-000000000001') $$,
  '42501',
  NULL,
  '24. join_club : invité refusé'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'c1b10000-0000-4000-8000-000000000003';
SELECT is(
  (SELECT public.leave_club('c1b20000-0000-4000-8000-000000000001')),
  'left',
  '25. leave_club : un membre quitte le club ouvert'
);

SELECT * FROM finish();
ROLLBACK;
