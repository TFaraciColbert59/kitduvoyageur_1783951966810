-- ============================================================================
-- TRIBU Phase 7 — Sessions live et positions (RLS stricte, zero historique)
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;

GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.travel_groups, public.group_members,
  public.group_live_sessions, public.group_live_positions, public.user_profiles
TO authenticated, service_role;

SELECT plan(20);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('bd000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'tribu_live_a@test.local', 'x', '{}', '{}', now(), now()),
  ('bd000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'tribu_live_b@test.local', 'x', '{}', '{}', now(), now()),
  ('bd000000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'tribu_live_x@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email, role, trust_score)
VALUES
  ('bd000000-0000-4000-8000-0000000000a1', 'LIVE Alice', 'tribu_live_a@test.local', 'user', 50),
  ('bd000000-0000-4000-8000-0000000000a2', 'LIVE Bruno', 'tribu_live_b@test.local', 'user', 50),
  ('bd000000-0000-4000-8000-0000000000a3', 'LIVE Externe', 'tribu_live_x@test.local', 'user', 50)
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

INSERT INTO public.travel_groups (id, name, owner_id, visibility)
VALUES ('bd000000-0000-4000-8000-0000000000e1', 'LIVE Groupe',
        'bd000000-0000-4000-8000-0000000000a1', 'private')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.group_members (group_id, user_id, role, status)
VALUES
  ('bd000000-0000-4000-8000-0000000000e1', 'bd000000-0000-4000-8000-0000000000a1', 'organizer', 'active'),
  ('bd000000-0000-4000-8000-0000000000e1', 'bd000000-0000-4000-8000-0000000000a2', 'member', 'active')
ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

INSERT INTO public.group_live_sessions (id, group_id, started_by, expires_at)
VALUES ('bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000e1',
        'bd000000-0000-4000-8000-0000000000a1', now() + interval '2 hours')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.group_live_positions (session_id, user_id, lat, lng, expires_at)
VALUES ('bd000000-0000-4000-8000-0000000000f1', 'bd000000-0000-4000-8000-0000000000a1',
        45.1, 6.1, now() + interval '15 minutes')
ON CONFLICT (session_id, user_id) DO UPDATE SET expires_at = EXCLUDED.expires_at;

-- 1..4 — lecture
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a2';

SELECT is(
  (SELECT count(*)::int FROM public.group_live_sessions WHERE id = 'bd000000-0000-4000-8000-0000000000f1'),
  1,
  '1. LIVE-01. membre : session visible'
);
SELECT is(
  (SELECT count(*)::int FROM public.group_live_positions WHERE session_id = 'bd000000-0000-4000-8000-0000000000f1'),
  1,
  '2. LIVE-01. membre : position des pairs visible'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a3';
SELECT is(
  (SELECT count(*)::int FROM public.group_live_sessions WHERE id = 'bd000000-0000-4000-8000-0000000000f1'),
  0,
  '3. LIVE-01. non-membre : session invisible'
);
SELECT is(
  (SELECT count(*)::int FROM public.group_live_positions WHERE session_id = 'bd000000-0000-4000-8000-0000000000f1'),
  0,
  '4. LIVE-01. non-membre : positions invisibles'
);

-- 5..9 — ecriture self-only (upsert)
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a2';

SELECT lives_ok(
  $$ INSERT INTO public.group_live_positions (session_id, user_id, lat, lng, expires_at)
     VALUES ('bd000000-0000-4000-8000-0000000000f1',
             'bd000000-0000-4000-8000-0000000000a2', 45.2, 6.2, now() + interval '15 minutes') $$,
  '5. LIVE-02. membre : insertion de sa position autorisee'
);
SELECT throws_ok(
  $$ INSERT INTO public.group_live_positions (session_id, user_id, lat, lng, expires_at)
     VALUES ('bd000000-0000-4000-8000-0000000000f1',
             'bd000000-0000-4000-8000-0000000000a1', 45.3, 6.3, now() + interval '15 minutes') $$,
  '42501', NULL,
  '6. LIVE-02. ecriture pour autrui refusee'
);
SELECT lives_ok(
  $$ UPDATE public.group_live_positions SET lat = 45.25, lng = 6.25, updated_at = now(),
            expires_at = now() + interval '15 minutes'
     WHERE session_id = 'bd000000-0000-4000-8000-0000000000f1'
       AND user_id = 'bd000000-0000-4000-8000-0000000000a2' $$,
  '7. LIVE-02. mise a jour de sa position autorisee'
);
UPDATE public.group_live_positions SET lat = 99.9
WHERE session_id = 'bd000000-0000-4000-8000-0000000000f1'
  AND user_id = 'bd000000-0000-4000-8000-0000000000a1';
SELECT is(
  (SELECT lat::numeric FROM public.group_live_positions
    WHERE session_id = 'bd000000-0000-4000-8000-0000000000f1'
      AND user_id = 'bd000000-0000-4000-8000-0000000000a1'),
  45.1,
  '8. LIVE-02. modification de la position d''autrui sans effet'
);
DELETE FROM public.group_live_positions
WHERE session_id = 'bd000000-0000-4000-8000-0000000000f1'
  AND user_id = 'bd000000-0000-4000-8000-0000000000a2';
SELECT is(
  (SELECT count(*)::int FROM public.group_live_positions
    WHERE session_id = 'bd000000-0000-4000-8000-0000000000f1'
      AND user_id = 'bd000000-0000-4000-8000-0000000000a2'),
  0,
  '9. LIVE-02. arret de son propre partage effectif (zero historique)'
);

-- 10..13 — expiration et cloture
RESET ROLE;
UPDATE public.group_live_positions SET expires_at = now() - interval '1 minute'
WHERE session_id = 'bd000000-0000-4000-8000-0000000000f1'
  AND user_id = 'bd000000-0000-4000-8000-0000000000a1';
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a2';
SELECT is(
  (SELECT count(*)::int FROM public.group_live_positions
    WHERE session_id = 'bd000000-0000-4000-8000-0000000000f1'
      AND user_id = 'bd000000-0000-4000-8000-0000000000a1'),
  0,
  '10. LIVE-03. position expiree invisible'
);

RESET ROLE;
UPDATE public.group_live_positions SET expires_at = now() + interval '15 minutes'
WHERE session_id = 'bd000000-0000-4000-8000-0000000000f1'
  AND user_id = 'bd000000-0000-4000-8000-0000000000a1';
UPDATE public.group_live_sessions
SET started_at = now() - interval '3 hours', expires_at = now() - interval '1 hour'
WHERE id = 'bd000000-0000-4000-8000-0000000000f1';
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a2';
SELECT is(
  (SELECT count(*)::int FROM public.group_live_positions
    WHERE session_id = 'bd000000-0000-4000-8000-0000000000f1'),
  0,
  '11. LIVE-03. session expiree : positions invisibles'
);
SELECT throws_ok(
  $$ INSERT INTO public.group_live_positions (session_id, user_id, lat, lng, expires_at)
     VALUES ('bd000000-0000-4000-8000-0000000000f1',
             'bd000000-0000-4000-8000-0000000000a2', 45.4, 6.4, now() + interval '15 minutes') $$,
  '42501', NULL,
  '12. LIVE-03. session expiree : insertion refusee'
);

-- A (organizer) cloture la session
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a1';
SELECT lives_ok(
  $$ UPDATE public.group_live_sessions SET stopped_at = now()
     WHERE id = 'bd000000-0000-4000-8000-0000000000f1' $$,
  '13. LIVE-04. organisateur : cloture de session autorisee'
);

-- 14..17 — contraintes
RESET ROLE;
SELECT throws_ok(
  $$ INSERT INTO public.group_live_positions (session_id, user_id, lat, lng, expires_at)
     VALUES ('bd000000-0000-4000-8000-0000000000f1',
             'bd000000-0000-4000-8000-0000000000a1', 999, 6.1, now() + interval '15 minutes') $$,
  '23514', NULL,
  '14. LIVE-05. latitude hors bornes refusee'
);
SELECT throws_ok(
  $$ INSERT INTO public.group_live_sessions (group_id, started_by, expires_at)
     VALUES ('bd000000-0000-4000-8000-0000000000e1',
             'bd000000-0000-4000-8000-0000000000a1', now() + interval '100 hours') $$,
  '23514', NULL,
  '15. LIVE-05. duree > 72 h refusee'
);
INSERT INTO public.group_live_sessions (id, group_id, started_by, expires_at)
VALUES ('bd000000-0000-4000-8000-0000000000f2', 'bd000000-0000-4000-8000-0000000000e1',
        'bd000000-0000-4000-8000-0000000000a1', now() + interval '2 hours')
ON CONFLICT (id) DO NOTHING;
SELECT throws_ok(
  $$ INSERT INTO public.group_live_sessions (group_id, started_by, expires_at)
     VALUES ('bd000000-0000-4000-8000-0000000000e1',
             'bd000000-0000-4000-8000-0000000000a1', now() + interval '1 hour') $$,
  '23505', NULL,
  '16. LIVE-05. deuxieme session ouverte refusee (unicite partielle)'
);
SELECT is(
  (SELECT count(*)::int FROM public.group_live_sessions
    WHERE group_id = 'bd000000-0000-4000-8000-0000000000e1' AND stopped_at IS NULL),
  1,
  '17. LIVE-05. une seule session ouverte par groupe'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 18..20 — Contre-revue : TTL borne en base et ligne propre recupérable
-- ════════════════════════════════════════════════════════════════════════════
RESET ROLE;
UPDATE public.group_live_sessions SET stopped_at = now()
WHERE id = 'bd000000-0000-4000-8000-0000000000f2';
INSERT INTO public.group_live_sessions (id, group_id, started_by, expires_at)
VALUES ('bd000000-0000-4000-8000-0000000000f3', 'bd000000-0000-4000-8000-0000000000e1',
        'bd000000-0000-4000-8000-0000000000a1', now() + interval '2 hours')
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a2';

SELECT throws_ok(
  $$ INSERT INTO public.group_live_positions (session_id, user_id, lat, lng, expires_at)
     VALUES ('bd000000-0000-4000-8000-0000000000f3',
             'bd000000-0000-4000-8000-0000000000a2', 45.5, 6.5, now() + interval '60 minutes') $$,
  '42501', NULL,
  '18. LIVE-06. TTL > 15 min refuse en base'
);

SELECT lives_ok(
  $$ INSERT INTO public.group_live_positions (session_id, user_id, lat, lng, expires_at)
     VALUES ('bd000000-0000-4000-8000-0000000000f3',
             'bd000000-0000-4000-8000-0000000000a2', 45.5, 6.5, now() + interval '10 minutes') $$,
  '19. LIVE-06. TTL conforme accepte'
);

RESET ROLE;
UPDATE public.group_live_positions SET expires_at = now() - interval '1 minute'
WHERE session_id = 'bd000000-0000-4000-8000-0000000000f3'
  AND user_id = 'bd000000-0000-4000-8000-0000000000a2';
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bd000000-0000-4000-8000-0000000000a2';

DELETE FROM public.group_live_positions
WHERE session_id = 'bd000000-0000-4000-8000-0000000000f3'
  AND user_id = 'bd000000-0000-4000-8000-0000000000a2';

RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.group_live_positions
    WHERE session_id = 'bd000000-0000-4000-8000-0000000000f3'
      AND user_id = 'bd000000-0000-4000-8000-0000000000a2'),
  0,
  '20. LIVE-06. sa ligne expiree reste supprimable par son proprietaire'
);

SELECT * FROM finish();
ROLLBACK;
