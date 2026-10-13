-- ============================================================================
-- Compas — `geo_pois` et `geo_pois_coverage` (PLAN-100 3.4 et 3.9) : refuges,
-- cabanes, campings et points d'eau d'OpenStreetMap (ODbL). Servir au public une
-- base de lieux OSM impose de la proposer sous ODbL : la lecture est donc
-- réservée à la clé de service (le Compas lit côté serveur), comme les caches.
-- ----------------------------------------------------------------------------
-- Éprouvé : forme (RLS, droits), « zone couverte » par les quatre coins d'une
-- boîte, rayon, filtre de natures, comptage des absences (retrait à la deuxième
-- de suite, jamais deux fois dans un même cycle).
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public, extensions;
SELECT plan(16);

-- ----------------------------------------------------------------------------
-- 1 — Forme : RLS active, aucune politique, aucun droit pour les clients
-- ----------------------------------------------------------------------------
SELECT ok(
  (SELECT bool_and(c.relrowsecurity) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname IN ('geo_pois', 'geo_pois_coverage')),
  '1. RLS active sur geo_pois et geo_pois_coverage'
);
SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('geo_pois', 'geo_pois_coverage')),
  0,
  '2. aucune politique : seule la clé de service (qui contourne la RLS) y accède'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.geo_pois', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.geo_pois', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.geo_pois_coverage', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.geo_pois_coverage', 'SELECT'),
  '3. ni anonyme ni connecté ne lit les tables (base OSM non exposée)'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.geo_pois', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.geo_pois', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.geo_pois', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.geo_pois', 'DELETE')
  AND NOT has_table_privilege('authenticated', 'public.geo_pois_coverage', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.geo_pois_coverage', 'UPDATE'),
  '4. aucun client n''écrit : un faux refuge ou une fausse couverture empoisonnerait le Compas'
);
SELECT ok(
  has_table_privilege('service_role', 'public.geo_pois', 'SELECT')
  AND has_table_privilege('service_role', 'public.geo_pois', 'INSERT')
  AND has_table_privilege('service_role', 'public.geo_pois_coverage', 'INSERT'),
  '5. la clé de service lit et écrit'
);
SELECT ok(
  has_function_privilege('service_role', 'public.geo_pois_around(double precision, double precision, integer, text[], integer)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.geo_pois_finish_tile(real, real, real, real, date, boolean)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.geo_pois_around(double precision, double precision, integer, text[], integer)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.geo_pois_around(double precision, double precision, integer, text[], integer)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.geo_pois_finish_tile(real, real, real, real, date, boolean)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.geo_pois_finish_tile(real, real, real, real, date, boolean)', 'EXECUTE'),
  '6. les deux fonctions : service_role seul'
);

-- ----------------------------------------------------------------------------
-- 2 — Comportement : couverture, rayon, natures
-- ----------------------------------------------------------------------------
-- Autour de Villard-de-Lans (45,07 N, 5,555 E) : deux refuges, un camping et un
-- point d'eau tout près ; une source à 15 km. Dernière vue il y a 40 jours.
DO $$
BEGIN
  INSERT INTO public.geo_pois (osm_id, subtype, name, lat, lon, ele_m, staffed, capacity, potable, seen_on, missed) VALUES
    ('n1', 'alpine_hut', 'Refuge A', 45.07, 5.55, 1500, 'yes', 40, NULL, current_date - 40, 0),
    ('n2', 'alpine_hut', NULL, 45.072, 5.549, NULL, NULL, NULL, NULL, current_date - 40, 0),
    ('w3', 'camp_site', NULL, 45.075, 5.56, 1000, NULL, NULL, NULL, current_date - 40, 0),
    ('n4', 'drinking_water', NULL, 45.071, 5.552, NULL, NULL, NULL, true, current_date - 40, 0),
    ('n5', 'spring', 'Source loin', 45.2, 5.9, NULL, NULL, NULL, NULL, current_date - 40, 0);
END $$;

SELECT is(
  public.geo_pois_around(45.07, 5.555, 1500) ->> 'covered',
  'false',
  '7. zone non importée : non couverte (le Compas garde Overpass)'
);
SELECT is(
  jsonb_array_length(public.geo_pois_around(45.07, 5.555, 1500) -> 'rows'),
  0,
  '8. zone non couverte : aucune ligne rendue (un trou de couverture n''est pas « rien »)'
);

DO $$
BEGIN
  -- Tuile voisine (à l'ouest) seulement : la boîte de l'étape n'est pas dedans.
  PERFORM public.geo_pois_finish_tile(5, 45, 5.5, 45.5, current_date, true);
END $$;
SELECT is(
  public.geo_pois_around(45.07, 5.555, 1500) ->> 'covered',
  'false',
  '9. une tuile qui ne contient pas la boîte ne la couvre pas'
);

DO $$
BEGIN
  PERFORM public.geo_pois_finish_tile(5.5, 45, 6, 45.5, current_date, true);
END $$;
SELECT is(
  public.geo_pois_around(45.07, 5.555, 1500) ->> 'covered',
  'true',
  '10. tuile importée autour de l''étape : couverte'
);
SELECT is(
  (SELECT string_agg(r ->> 'osm_id', ',' ORDER BY ord)
     FROM jsonb_array_elements(public.geo_pois_around(45.07, 5.555, 1500) -> 'rows') WITH ORDINALITY AS t(r, ord)),
  'n4,n1,n2,w3',
  '11. dans 1 500 m, du plus proche au plus loin ; la source à 15 km est écartée'
);
SELECT is(
  (SELECT string_agg(r ->> 'osm_id', ',')
     FROM jsonb_array_elements(public.geo_pois_around(45.07, 5.555, 1500, ARRAY['camp_site']) -> 'rows') AS t(r)),
  'w3',
  '12. filtre de natures'
);

-- ----------------------------------------------------------------------------
-- 3 — Absences : comptées une fois par cycle, retrait à la deuxième de suite
-- ----------------------------------------------------------------------------
-- Premier import ci-dessus (aujourd'hui) : aucun objet revu, tous à une absence.
SELECT is(
  (SELECT string_agg(osm_id || ':' || missed, ',' ORDER BY osm_id) FROM public.geo_pois),
  'n1:1,n2:1,n4:1,n5:1,w3:1',
  '13. objets non revus par l''import : une absence chacun'
);

-- Un mois plus tard : quatre objets revus, la source lointaine manque encore.
DO $$
BEGIN
  UPDATE public.geo_pois SET seen_on = current_date + 30, missed = 0 WHERE osm_id IN ('n1', 'n2', 'w3', 'n4');
  PERFORM public.geo_pois_finish_tile(5.5, 45, 6, 45.5, current_date + 30, true);
END $$;
SELECT is(
  (SELECT string_agg(osm_id, ',' ORDER BY osm_id) FROM public.geo_pois),
  'n1,n2,n4,w3',
  '14. absent deux imports de suite : retiré ; les objets revus restent'
);

-- Relance le lendemain du même cycle : rien n'est compté ni retiré.
DO $$
BEGIN
  PERFORM public.geo_pois_finish_tile(5.5, 45, 6, 45.5, current_date + 31, true);
END $$;
SELECT is(
  (SELECT count(*)::int FROM public.geo_pois WHERE missed = 0),
  4,
  '15. un import relancé le même mois ne compte aucune absence'
);

-- Réponse suspecte (vide, tronquée) : le script coupe le comptage, rien n'est retiré.
DO $$
BEGIN
  PERFORM public.geo_pois_finish_tile(5.5, 45, 6, 45.5, current_date + 90, false);
END $$;
SELECT is(
  (SELECT count(*)::int FROM public.geo_pois),
  4,
  '16. comptage coupé (p_count_misses = false) : rien n''est retiré'
);

SELECT * FROM finish();
ROLLBACK;
