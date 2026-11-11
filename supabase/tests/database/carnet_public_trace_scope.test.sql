-- pgTAP — 20261111101000_carnet_public_trace_scope
-- RGPD / suivi en direct : le public ne lit plus les points GPS bruts.
-- 1. anon ne lit plus la table hike_sessions ; il lit la vue publique.
-- 2. La vue publique échantillonne et arrondit le tracé, sans horodatage ni user_id.
-- 3. authenticated garde les colonnes neutres de la table, pas les points bruts.
-- 4. La vue participant rend la ligne complète aux seuls participants (et à soi).
-- 5. Un visiteur connecté non participant ne voit ni la vue participant ni les bruts.
BEGIN;
SET LOCAL search_path = public;
SELECT plan(16);

-- Fixtures -------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('cd000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'trace_author@test.local', 'x', '{}', '{}', now(), now()),
  ('cd000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'trace_participant@test.local', 'x', '{}', '{}', now(), now()),
  ('cd000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'trace_visitor@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, email, full_name, created_at)
VALUES
  ('cd000000-0000-4000-8000-000000000001', 'trace_author@test.local', 'Auteur', now()),
  ('cd000000-0000-4000-8000-000000000002', 'trace_participant@test.local', 'Participant', now()),
  ('cd000000-0000-4000-8000-000000000003', 'trace_visitor@test.local', 'Visiteur', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.carnets (id, author_id, title, destination, visibility)
VALUES
  ('cd100000-0000-4000-8000-000000000001', 'cd000000-0000-4000-8000-000000000001', 'Carnet trace public', 'Écrins', 'public'),
  ('cd100000-0000-4000-8000-000000000002', 'cd000000-0000-4000-8000-000000000001', 'Carnet trace privé', 'Vercors', 'private')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.carnet_collaborators (carnet_id, user_id, role)
VALUES ('cd100000-0000-4000-8000-000000000001', 'cd000000-0000-4000-8000-000000000002', 'contributor')
ON CONFLICT DO NOTHING;

-- 12 points : l'échantillonnage 1 point sur 5 + le dernier doit en garder 4.
INSERT INTO public.hike_sessions (id, user_id, carnet_id, started_at, distance_km, elevation_gain_m, positions_geojson, positions_timed)
VALUES (
  'cd200000-0000-4000-8000-000000000001',
  'cd000000-0000-4000-8000-000000000001',
  'cd100000-0000-4000-8000-000000000001',
  '2026-07-13T06:30:00Z', 12.4, 980,
  jsonb_build_object('type', 'LineString', 'coordinates', (
    select jsonb_agg(jsonb_build_array(6.10000 + (i * 0.00123), 45.10000 + (i * 0.00123)) order by i)
    from generate_series(1, 12) as i
  )),
  (
    select jsonb_agg(jsonb_build_object('lat', 45.10000 + (i * 0.00123), 'lng', 6.10000 + (i * 0.00123), 'timestamp', '2026-07-13T07:00:00Z', 'elevationM', 1500 + i) order by i)
    from generate_series(1, 12) as i
  )
);

INSERT INTO public.hike_sessions (id, user_id, carnet_id, started_at, distance_km, positions_geojson)
VALUES (
  'cd200000-0000-4000-8000-000000000002',
  'cd000000-0000-4000-8000-000000000001',
  'cd100000-0000-4000-8000-000000000002',
  '2026-08-01T06:30:00Z', 8,
  jsonb_build_object('type', 'LineString', 'coordinates', jsonb_build_array(jsonb_build_array(5.5, 44.5), jsonb_build_array(5.6, 44.6)))
);

-- 1-5. anon : table fermée, vue publique ouverte -----------------------------
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" = '{"role": "anon"}';

SELECT throws_ok(
  $$SELECT positions_geojson FROM public.hike_sessions LIMIT 1$$,
  '42501', NULL, 'anon ne lit plus les points GPS bruts de la table hike_sessions'
);
SELECT ok(
  NOT has_column_privilege('anon', 'public.hike_sessions', 'positions_geojson', 'SELECT'),
  'anon n''a aucun privilège SELECT sur positions_geojson'
);
SELECT ok(
  has_table_privilege('anon', 'public.hike_sessions_public', 'SELECT'),
  'anon lit la vue publique'
);
SELECT isnt_empty(
  $$SELECT 1 FROM public.hike_sessions_public WHERE carnet_id = 'cd100000-0000-4000-8000-000000000001'$$,
  'anon voit les sorties d''un carnet public via la vue'
);
SELECT is_empty(
  $$SELECT 1 FROM public.hike_sessions_public WHERE carnet_id = 'cd100000-0000-4000-8000-000000000002'$$,
  'anon ne voit pas les sorties d''un carnet privé via la vue'
);
SELECT throws_ok(
  $$SELECT 1 FROM public.hike_sessions_participant LIMIT 1$$,
  '42501', NULL, 'anon ne lit pas la vue participant'
);

-- 6-9. La vue publique échantillonne, arrondit, ne publie rien de brûlant ----
SELECT results_eq(
  $$SELECT jsonb_array_length(positions_geojson -> 'coordinates')
    FROM public.hike_sessions_public WHERE id = 'cd200000-0000-4000-8000-000000000001'$$,
  $$VALUES (12)$$,
  'le tracé public garde la densité réelle (12 points → 12)'
);
SELECT results_eq(
  $$SELECT positions_geojson -> 'coordinates' -> 0
    FROM public.hike_sessions_public WHERE id = 'cd200000-0000-4000-8000-000000000001'$$,
  $$VALUES ('[6.1012, 45.1012]'::jsonb)$$,
  'les coordonnées publiques sont arrondies à 4 décimales (~11 m)'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hike_sessions_public' AND column_name = 'user_id'
  ),
  'la vue publique n''expose pas user_id'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.hike_sessions_public v,
         jsonb_array_elements(v.positions_timed) AS sample
    WHERE v.id = 'cd200000-0000-4000-8000-000000000001'
      AND sample ? 'timestamp'
  ),
  'les mesures publiques ne portent aucun horodatage'
);

-- 10-11. authenticated : colonnes neutres oui, bruts non --------------------
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "cd000000-0000-4000-8000-000000000002", "role": "authenticated"}';
SELECT ok(
  has_table_privilege('authenticated', 'public.hike_sessions', 'SELECT'),
  'authenticated garde le SELECT table (colonnes neutres)'
);
SELECT ok(
  NOT has_column_privilege('authenticated', 'public.hike_sessions', 'positions_geojson', 'SELECT'),
  'authenticated n''a pas le privilège sur positions_geojson'
);

-- 12-14. Vue participant : participant oui, visiteur non ---------------------
SELECT isnt_empty(
  $$SELECT positions_geojson FROM public.hike_sessions_participant
    WHERE id = 'cd200000-0000-4000-8000-000000000001'$$,
  'un collaborateur voit la ligne complète de la sortie du carnet'
);

SET LOCAL "request.jwt.claims" = '{"sub": "cd000000-0000-4000-8000-000000000003", "role": "authenticated"}';
SELECT is_empty(
  $$SELECT 1 FROM public.hike_sessions_participant
    WHERE id = 'cd200000-0000-4000-8000-000000000001'$$,
  'un visiteur connecté non participant ne voit pas la vue participant'
);
SELECT throws_ok(
  $$SELECT positions_geojson FROM public.hike_sessions WHERE id = 'cd200000-0000-4000-8000-000000000001'$$,
  '42501', NULL, 'un visiteur connecté ne lit pas les bruts sur la table'
);

-- 15-16. L'auteur lit sa propre sortie --------------------------------------
SET LOCAL "request.jwt.claims" = '{"sub": "cd000000-0000-4000-8000-000000000001", "role": "authenticated"}';
SELECT isnt_empty(
  $$SELECT positions_timed FROM public.hike_sessions_participant
    WHERE id = 'cd200000-0000-4000-8000-000000000002'$$,
  'l''auteur lit sa sortie privée par la vue participant'
);
SELECT is_empty(
  $$SELECT 1 FROM public.hike_sessions_participant
    WHERE id = 'cd200000-0000-4000-8000-000000000001' AND user_id <> 'cd000000-0000-4000-8000-000000000001'$$,
  'la vue participant ne rend pas les sorties des autres'
);

SELECT * FROM finish();
ROLLBACK;
