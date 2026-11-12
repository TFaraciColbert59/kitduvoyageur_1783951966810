-- ============================================================================
-- Carnet v2 — un participant de sortie n'est pas éditeur du carnet
-- ============================================================================
-- Protège 20261112122000_carnet_v2_participant_scope.sql :
--   • lecture du carnet : éditeur OU participant d'une sortie liée ;
--   • écritures moments/kit/nuits : éditeur seulement ;
--   • positions live : l'éditeur lit tout, un participant ne lit que sa ligne.
--
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.carnets, public.hike_sessions, public.hike_session_participants,
  public.carnet_moments, public.carnet_kit_items, public.carnet_nights,
  public.carnet_live_positions
TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

SELECT plan(11);

-- A éditeur, B participant d'une seule sortie, C tiers.
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('c2a00000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'scope_a@test.local', 'x', '{}', '{}', now(), now()),
  ('c2a00000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'scope_b@test.local', 'x', '{}', '{}', now(), now()),
  ('c2a00000-0000-4000-8000-0000000000c1', 'authenticated', 'authenticated', 'scope_c@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email, role, trust_score)
VALUES
  ('c2a00000-0000-4000-8000-0000000000a1', 'Éditeur A', 'scope_a@test.local', 'user', 50),
  ('c2a00000-0000-4000-8000-0000000000b1', 'Participant B', 'scope_b@test.local', 'user', 50),
  ('c2a00000-0000-4000-8000-0000000000c1', 'Tiers C', 'scope_c@test.local', 'user', 50)
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

INSERT INTO public.carnets (id, author_id, title, visibility)
VALUES (
  'c2a00000-0000-4000-8000-0000000000f1',
  'c2a00000-0000-4000-8000-0000000000a1',
  'Carnet privé A',
  'private'
);

INSERT INTO public.hike_sessions
  (id, user_id, carnet_id, started_at, ended_at, distance_km, duration_seconds, visibility)
VALUES (
  'c2a00000-0000-4000-8000-0000000000d1',
  'c2a00000-0000-4000-8000-0000000000a1',
  'c2a00000-0000-4000-8000-0000000000f1',
  now() - interval '4 hours',
  now() - interval '2 hours',
  8.4,
  7200,
  'private'
);

INSERT INTO public.hike_session_participants (session_id, user_id, role)
VALUES (
  'c2a00000-0000-4000-8000-0000000000d1',
  'c2a00000-0000-4000-8000-0000000000b1',
  'guest'
);

INSERT INTO public.carnet_moments (id, carnet_id, jour_numero, citation, auteur_id)
VALUES (
  'c2a00000-0000-4000-8000-0000000000e1',
  'c2a00000-0000-4000-8000-0000000000f1',
  1,
  'Moment de A',
  'c2a00000-0000-4000-8000-0000000000a1'
);

INSERT INTO public.carnet_kit_items (id, carnet_id, nom, poids_g)
VALUES (
  'c2a00000-0000-4000-8000-0000000000e2',
  'c2a00000-0000-4000-8000-0000000000f1',
  'Tente de A',
  1200
);

INSERT INTO public.carnet_nights (carnet_id, jour_numero, nom, type)
VALUES (
  'c2a00000-0000-4000-8000-0000000000f1',
  1,
  'Refuge de A',
  'refuge'
);

INSERT INTO public.carnet_live_positions (carnet_id, user_id, lat, lng, recorded_at)
VALUES
  ('c2a00000-0000-4000-8000-0000000000f1', 'c2a00000-0000-4000-8000-0000000000a1', 45.83, 6.86, now() - interval '4 hours'),
  ('c2a00000-0000-4000-8000-0000000000f1', 'c2a00000-0000-4000-8000-0000000000b1', 45.84, 6.87, now() - interval '4 hours');

-- ----------------------------------------------------------------------------
-- 1..4 — Helpers : édition, lecture, visibilité
-- ----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'c2a00000-0000-4000-8000-0000000000a1';
SELECT is(
  public.is_carnet_editor('c2a00000-0000-4000-8000-0000000000f1'),
  true,
  '1. l''auteur est éditeur du carnet'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'c2a00000-0000-4000-8000-0000000000b1';
SELECT is(
  public.is_carnet_editor('c2a00000-0000-4000-8000-0000000000f1'),
  false,
  '2. le participant de sortie n''est pas éditeur'
);
SELECT is(
  public.is_carnet_participant('c2a00000-0000-4000-8000-0000000000f1'),
  true,
  '3. le participant de sortie garde la lecture du carnet'
);
SELECT is(
  public.can_view_carnet('c2a00000-0000-4000-8000-0000000000f1'),
  true,
  '4. la lecture du carnet privé reste ouverte au participant invité'
);

-- ----------------------------------------------------------------------------
-- 5..7 — Écritures réservées à l'éditeur
-- ----------------------------------------------------------------------------
SELECT throws_ok(
  'INSERT INTO public.carnet_nights (carnet_id, jour_numero, nom, type) VALUES (''c2a00000-0000-4000-8000-0000000000f1'', 2, ''Nuit B'', ''bivouac'')',
  '42501',
  NULL,
  '5. le participant ne peut pas insérer une nuit'
);
SELECT throws_ok(
  'INSERT INTO public.carnet_moments (id, carnet_id, jour_numero, citation, auteur_id) VALUES (''c2a00000-0000-4000-8000-0000000000e3'', ''c2a00000-0000-4000-8000-0000000000f1'', 2, ''Moment B'', ''c2a00000-0000-4000-8000-0000000000b1'')',
  '42501',
  NULL,
  '6. le participant ne peut pas insérer un moment'
);
SELECT throws_ok(
  'INSERT INTO public.carnet_kit_items (id, carnet_id, nom, poids_g) VALUES (''c2a00000-0000-4000-8000-0000000000e4'', ''c2a00000-0000-4000-8000-0000000000f1'', ''Kit B'', 500)',
  '42501',
  NULL,
  '7. le participant ne peut pas insérer un item de kit'
);

-- ----------------------------------------------------------------------------
-- 8..9 — Positions live : soi-même, jamais les autres
-- ----------------------------------------------------------------------------
SELECT is(
  (
    SELECT array_agg(user_id ORDER BY user_id)
    FROM public.carnet_live_positions
  ),
  ARRAY['c2a00000-0000-4000-8000-0000000000b1']::uuid[],
  '8. le participant ne lit que sa propre position live'
);
SELECT lives_ok(
  'UPDATE public.carnet_live_positions SET lat = 45.90 WHERE user_id = ''c2a00000-0000-4000-8000-0000000000b1''',
  '9. le participant peut mettre à jour sa propre position'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'c2a00000-0000-4000-8000-0000000000a1';
SELECT is(
  (SELECT count(*)::int FROM public.carnet_live_positions),
  2,
  '10. l''éditeur lit les positions de tous les participants'
);
SELECT lives_ok(
  'INSERT INTO public.carnet_nights (carnet_id, jour_numero, nom, type) VALUES (''c2a00000-0000-4000-8000-0000000000f1'', 2, ''Nuit A'', ''bivouac'')',
  '11. l''éditeur peut insérer une nuit'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
