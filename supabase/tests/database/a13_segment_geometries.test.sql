-- ============================================================================
-- A13 (S1) — Géométries de segments pour l'ETA réelle
--   • TEST-A13-GEO-DB-01 : renvoie la géométrie/tags du segment fixture
--   • TEST-A13-GEO-DB-02 : filtre strictement par ids (= ANY), ids inconnus vides
--   • TEST-A13-GEO-DB-03 : entrée vide / NULL ⇒ 0 ligne sans erreur
--   • TEST-A13-GEO-DB-04 : borne 500 ids inclusive, > 500 refusé
--   • TEST-A13-GEO-DB-05 : RPC stable + SECURITY INVOKER (lecture seule)
--   • TEST-A13-GEO-DB-06 : EXECUTE ouvert à anon, authenticated, service_role
--   • TEST-A13-GEO-DB-07 : écriture refusée à anon (surface en lecture seule)
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
-- Replay local : grants explicites (défauts prod non garantis pour l'écriture).
GRANT SELECT ON public.trail_segments TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
SELECT plan(18);

-- ----------------------------------------------------------------------------
-- Fixtures — segments OSM stables (aucune donnée personnelle)
-- ----------------------------------------------------------------------------
INSERT INTO public.trail_segments (id, osm_id, name, highway, surface, sac_scale, geom)
VALUES
  (8813001, 991300000001, 'A13 segment test', 'path', 'ground', 'hiking',
   ST_GeomFromText('LINESTRING(6.0 44.0, 6.001 44.0)', 4326)),
  (8813002, 991300000002, 'A13 segment test 2', 'track', 'gravel', NULL,
   ST_GeomFromText('LINESTRING(6.1 44.1, 6.101 44.101)', 4326))
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- TEST-A13-GEO-DB-01 — géométrie et tags du fixture
-- ----------------------------------------------------------------------------
SELECT is(
  (SELECT count(*)::int FROM public.a13_segment_geometries(ARRAY[8813001::bigint])),
  1,
  '1. DB-01. Un id connu renvoie exactement sa géométrie'
);
SELECT is(
  (SELECT geojson->>'type' FROM public.a13_segment_geometries(ARRAY[8813001::bigint])),
  'LineString',
  '2. DB-01. Le GeoJSON renvoyé est un LineString'
);
SELECT is(
  (SELECT geojson->'coordinates' FROM public.a13_segment_geometries(ARRAY[8813001::bigint])),
  '[[6,44],[6.001,44]]'::jsonb,
  '3. DB-01. Les coordonnées GeoJSON correspondent au segment (lng, lat)'
);
SELECT is(
  (SELECT surface FROM public.a13_segment_geometries(ARRAY[8813001::bigint])),
  'ground',
  '4. DB-01. La surface OSM est renvoyée'
);
SELECT is(
  (SELECT sac_scale FROM public.a13_segment_geometries(ARRAY[8813001::bigint])),
  'hiking',
  '5. DB-01. Le sac_scale OSM est renvoyé'
);
SELECT is(
  (SELECT highway FROM public.a13_segment_geometries(ARRAY[8813001::bigint])),
  'path',
  '6. DB-01. Le highway OSM est renvoyé'
);
SELECT is(
  (SELECT sac_scale FROM public.a13_segment_geometries(ARRAY[8813002::bigint])),
  NULL,
  '7. DB-01. Un tag absent reste NULL (jamais inventé)'
);

-- ----------------------------------------------------------------------------
-- TEST-A13-GEO-DB-02 — filtrage par ids
-- ----------------------------------------------------------------------------
SELECT is(
  (SELECT count(*)::int FROM public.a13_segment_geometries(ARRAY[8813001::bigint, 8813002::bigint])),
  2,
  '8. DB-02. Un lot de deux ids renvoie deux segments'
);
SELECT is(
  (SELECT count(*)::int FROM public.a13_segment_geometries(ARRAY[8813001::bigint, 999999999::bigint])),
  1,
  '9. DB-02. Un id inconnu ne renvoie aucune ligne fantôme'
);
SELECT is(
  (SELECT count(*)::int FROM public.a13_segment_geometries(ARRAY[999999999::bigint])),
  0,
  '10. DB-02. Un id inconnu seul renvoie 0 ligne'
);

-- ----------------------------------------------------------------------------
-- TEST-A13-GEO-DB-03 — entrées vides
-- ----------------------------------------------------------------------------
SELECT is(
  (SELECT count(*)::int FROM public.a13_segment_geometries(ARRAY[]::bigint[])),
  0,
  '11. DB-03. Un tableau vide renvoie 0 ligne sans erreur'
);
SELECT is(
  (SELECT count(*)::int FROM public.a13_segment_geometries(NULL::bigint[])),
  0,
  '12. DB-03. Un tableau NULL renvoie 0 ligne sans erreur'
);

-- ----------------------------------------------------------------------------
-- TEST-A13-GEO-DB-04 — borne 500 ids
-- ----------------------------------------------------------------------------
SELECT is(
  (SELECT count(*)::int FROM public.a13_segment_geometries(
    ARRAY(SELECT g::bigint FROM generate_series(900000000, 900000499) AS g)
  )),
  0,
  '13. DB-04. 500 ids exactement : accepté (borne inclusive)'
);
SELECT throws_ok(
  $$ SELECT * FROM public.a13_segment_geometries(
       ARRAY(SELECT g::bigint FROM generate_series(900000000, 900000500) AS g)
     ) $$,
  'a13_segment_geometries: 500 ids maximum par appel (reçu 501)',
  '14. DB-04. 501 ids : refusé explicitement, jamais tronqué en silence'
);

-- ----------------------------------------------------------------------------
-- TEST-A13-GEO-DB-05 — lecture seule : STABLE + SECURITY INVOKER
-- ----------------------------------------------------------------------------
SELECT ok(
  (SELECT p.provolatile = 's' AND NOT p.prosecdef
   FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'a13_segment_geometries'),
  '15. DB-05. La RPC est STABLE (lecture seule) et SECURITY INVOKER'
);

-- ----------------------------------------------------------------------------
-- TEST-A13-GEO-DB-06 — privilèges de lecture sur données OSM publiques
-- ----------------------------------------------------------------------------
SELECT ok(
  has_function_privilege(
    'anon'::name, 'public.a13_segment_geometries(bigint[])'::text, 'EXECUTE'
  )
  AND has_function_privilege(
    'authenticated'::name, 'public.a13_segment_geometries(bigint[])'::text, 'EXECUTE'
  )
  AND has_function_privilege(
    'service_role'::name, 'public.a13_segment_geometries(bigint[])'::text, 'EXECUTE'
  ),
  '16. DB-06. anon, authenticated et service_role peuvent lire les géométries OSM'
);

-- ----------------------------------------------------------------------------
-- TEST-A13-GEO-DB-07 — anon : lecture via la RPC, écriture refusée
-- ----------------------------------------------------------------------------
SET LOCAL ROLE anon;
SELECT is(
  (SELECT count(*)::int FROM public.a13_segment_geometries(ARRAY[8813001::bigint])),
  1,
  '17a. DB-07. anon lit la géométrie via la RPC'
);
SELECT throws_ok(
  $$ INSERT INTO public.trail_segments (id, osm_id, geom)
     VALUES (8813999, 991399999999, ST_GeomFromText('LINESTRING(6.2 44.2, 6.201 44.2)', 4326)) $$,
  '42501'::char(5),
  NULL::text,
  '17b. DB-07. anon ne peut jamais écrire dans trail_segments (lecture seule)'
);

SELECT * FROM finish();
ROLLBACK;
