-- ============================================================================
-- Carnet v2 — les lignes brutes de hike_sessions restent privées
-- ============================================================================
-- Ce test protège la correction 20261112120000 : la lecture directe de
-- `hike_sessions` est réservée au propriétaire et aux participants inscrits.
-- Le partage masqué (carnet public/amis) passe par la fiche, pas par PostgREST.
--
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT ON
  public.hike_sessions, public.hike_session_participants,
  public.carnets, public.user_follows
TO authenticated, anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;

SELECT plan(7);

-- Fixtures : A propriétaire, B participant, C abonné, D tiers.
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('f8b90000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'trace_a@test.local', 'x', '{}', '{}', now(), now()),
  ('f8b90000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'trace_b@test.local', 'x', '{}', '{}', now(), now()),
  ('f8b90000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'trace_c@test.local', 'x', '{}', '{}', now(), now()),
  ('f8b90000-0000-4000-8000-0000000000a4', 'authenticated', 'authenticated', 'trace_d@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email, role, trust_score)
VALUES
  ('f8b90000-0000-4000-8000-0000000000a1', 'Propriétaire A', 'trace_a@test.local', 'user', 50),
  ('f8b90000-0000-4000-8000-0000000000a2', 'Participant B', 'trace_b@test.local', 'user', 50),
  ('f8b90000-0000-4000-8000-0000000000a3', 'Abonné C', 'trace_c@test.local', 'user', 50),
  ('f8b90000-0000-4000-8000-0000000000a4', 'Tiers D', 'trace_d@test.local', 'user', 50)
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

INSERT INTO public.carnets (id, author_id, title, visibility)
VALUES
  ('f8b90000-0000-4000-8000-0000000000c1', 'f8b90000-0000-4000-8000-0000000000a1', 'Carnet public', 'public'),
  ('f8b90000-0000-4000-8000-0000000000c2', 'f8b90000-0000-4000-8000-0000000000a1', 'Carnet privé', 'private'),
  ('f8b90000-0000-4000-8000-0000000000c3', 'f8b90000-0000-4000-8000-0000000000a1', 'Carnet amis', 'friends');

INSERT INTO public.hike_sessions
  (id, user_id, carnet_id, started_at, ended_at, distance_km, duration_seconds, visibility, positions_geojson)
VALUES
  ('f8b90000-0000-4000-8000-0000000000d1', 'f8b90000-0000-4000-8000-0000000000a1',
   'f8b90000-0000-4000-8000-0000000000c1', now() - interval '4 hours', now() - interval '2 hours',
   8.4, 7200, 'private', '{"type":"LineString","coordinates":[[6.86,45.83],[6.87,45.84]]}'::jsonb),
  ('f8b90000-0000-4000-8000-0000000000d2', 'f8b90000-0000-4000-8000-0000000000a1',
   'f8b90000-0000-4000-8000-0000000000c2', now() - interval '30 hours', now() - interval '26 hours',
   12.1, 14400, 'private', '{"type":"LineString","coordinates":[[6.9,45.85],[6.91,45.86]]}'::jsonb),
  ('f8b90000-0000-4000-8000-0000000000d3', 'f8b90000-0000-4000-8000-0000000000a1',
   'f8b90000-0000-4000-8000-0000000000c3', now() - interval '54 hours', now() - interval '50 hours',
   6.2, 9000, 'collective_anonymized', '{"type":"LineString","coordinates":[[6.95,45.9],[6.96,45.91]]}'::jsonb);

INSERT INTO public.hike_session_participants (session_id, user_id, role)
VALUES ('f8b90000-0000-4000-8000-0000000000d2', 'f8b90000-0000-4000-8000-0000000000a2', 'guest');

INSERT INTO public.user_follows (follower_id, following_id)
VALUES ('f8b90000-0000-4000-8000-0000000000a3', 'f8b90000-0000-4000-8000-0000000000a1');

-- 1. Anonyme : aucune ligne brute, même sur un carnet public.
SET LOCAL ROLE anon;
SELECT is(
  (SELECT count(*)::int FROM public.hike_sessions),
  0,
  '1. anon ne lit aucune ligne brute de hike_sessions'
);
RESET ROLE;

-- 2. Tiers authentifié non participant : aucune ligne.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f8b90000-0000-4000-8000-0000000000a4';
SELECT is(
  (SELECT count(*)::int FROM public.hike_sessions),
  0,
  '2. un tiers authentifié ne lit aucune ligne brute'
);
RESET ROLE;

-- 3. Propriétaire : toutes ses sorties.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f8b90000-0000-4000-8000-0000000000a1';
SELECT is(
  (SELECT count(*)::int FROM public.hike_sessions),
  3,
  '3. le propriétaire lit ses trois sorties'
);
RESET ROLE;

-- 4. Participant inscrit : sa sortie privée, et elle seule.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f8b90000-0000-4000-8000-0000000000a2';
SELECT is(
  (SELECT id FROM public.hike_sessions),
  'f8b90000-0000-4000-8000-0000000000d2'::uuid,
  '4. le participant lit la sortie à laquelle il est inscrit'
);
SELECT is(
  (SELECT count(*)::int FROM public.hike_sessions WHERE id = 'f8b90000-0000-4000-8000-0000000000d1'),
  0,
  '5. le participant ne lit pas la sortie privée non partagée'
);
RESET ROLE;

-- 6. Abonné : la visibilité du carnet ne suffit pas à lire la ligne brute.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f8b90000-0000-4000-8000-0000000000a3';
SELECT is(
  (SELECT count(*)::int FROM public.hike_sessions),
  0,
  '6. un abonné ne lit pas la ligne brute collective du carnet amis'
);
RESET ROLE;

-- 7. La policy historique ne subsiste pas.
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'hike_sessions'
      AND policyname IN ('hike_sessions_select_owner_or_public_carnet',
                         'hike_sessions_select_shared_carnet')
  ),
  '7. la policy historique de lecture par carnet public a disparu'
);

SELECT * FROM finish();
ROLLBACK;
