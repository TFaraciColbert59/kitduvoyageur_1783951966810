-- ============================================================================
-- Phase 3 — Finaliser la création de voyage (parcours réellement navigables)
--   • TEST-PHASE3-DB-01 : fonctions présentes, INVOKER/STABLE, search_path,
--     privilèges authenticated (anon révoqué).
--   • TEST-PHASE3-DB-02 : prédicat de navigabilité identique à celui exigé par
--     select_adventure_plan_route (NULL, vide, dégénérée, inconnue refusées).
--   • TEST-PHASE3-DB-03 : recherche bornée (≤ 3), filtre géométrie réelle,
--     rayon, termes nom/ref/région, distance en mètres, métadonnées jointes.
--   • TEST-PHASE3-DB-04 : aucune invention — zéro coordonnée ET zéro terme
--     ⇒ zéro résultat ; aucun parcours sans géométrie navigable retourné.
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
-- Replay local : grants explicites (défauts prod non garantis).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hiking_routes, public.trail_metadata TO service_role, authenticated;
GRANT USAGE ON SCHEMA public TO service_role, authenticated;
SELECT plan(30);

-- ----------------------------------------------------------------------------
-- Fixtures — parcours réels et invalides, métadonnées jointes (aucune donnée
-- personnelle : uniquement de la géographie de test).
-- ----------------------------------------------------------------------------
INSERT INTO public.hiking_routes (id, osm_relation_id, name, ref, region, distance_km, geom)
VALUES
  (930000001, 993000000001, 'Phase 3 — Parcours navigable départ', 'PR-TEST-1', NULL, 12.5,
   ST_GeomFromText('MULTILINESTRING((6.0 45.0, 6.1 45.05, 6.2 45.0))', 4326)),
  (930000002, 993000000002, 'Phase 3 — Traversée des Vosges', 'PR-TEST-2', 'Vosges', 18.0,
   ST_GeomFromText('MULTILINESTRING((6.5 45.5, 6.6 45.55))', 4326)),
  (930000003, 993000000003, 'Phase 3 — Parcours proche 3', NULL, NULL, 8.0,
   ST_GeomFromText('MULTILINESTRING((6.6 45.6, 6.7 45.65))', 4326)),
  (930000004, 993000000004, 'Phase 3 — Parcours lointain', NULL, NULL, 10.0,
   ST_GeomFromText('MULTILINESTRING((7.0 46.0, 7.1 46.1))', 4326)),
  (930000005, 993000000005, 'Phase 3 — Sans géométrie', NULL, NULL, 5.0, NULL),
  (930000006, 993000000006, 'Phase 3 — Géométrie vide', NULL, NULL, 5.0,
   ST_GeomFromText('MULTILINESTRING EMPTY', 4326)),
  (930000007, 993000000007, 'Phase 3 — Géométrie dégénérée', NULL, NULL, 0.0,
   ST_GeomFromText('MULTILINESTRING((6.0 45.0, 6.0 45.0))', 4326));

INSERT INTO public.trail_metadata (id, trail_id, difficulty, duration_hours, elevation_gain)
VALUES (930000001, 930000001, 'moderate', 5.5, 850);

-- ----------------------------------------------------------------------------
-- TEST-PHASE3-DB-01 — signatures, propriétés, privilèges
-- ----------------------------------------------------------------------------
SELECT ok(
  to_regprocedure('public.phase3_route_navigable(bigint)') IS NOT NULL,
  '1. DB-01. phase3_route_navigable(bigint) existe'
);
SELECT ok(
  to_regprocedure(
    'public.phase3_search_navigable_routes(double precision,double precision,double precision,text[],integer)'
  ) IS NOT NULL,
  '2. DB-01. phase3_search_navigable_routes(…, text[], integer) existe'
);
SELECT ok(
  (SELECT NOT p.prosecdef AND p.provolatile = 's'
   FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'phase3_route_navigable')
  AND
  (SELECT NOT p.prosecdef AND p.provolatile = 's'
   FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'phase3_search_navigable_routes'),
  '3. DB-01. Les deux fonctions sont SECURITY INVOKER et STABLE'
);
SELECT ok(
  (SELECT EXISTS (
     SELECT 1 FROM pg_proc p, unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS c
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname IN ('phase3_route_navigable', 'phase3_search_navigable_routes')
       AND c LIKE 'search_path=%'
     GROUP BY p.proname
     HAVING count(*) >= 1
   ))
  AND (SELECT count(DISTINCT p.proname) = 2
       FROM pg_proc p, unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS c
       WHERE p.pronamespace = 'public'::regnamespace
         AND p.proname IN ('phase3_route_navigable', 'phase3_search_navigable_routes')
         AND c LIKE 'search_path=%'),
  '4. DB-01. search_path verrouillé sur les deux fonctions'
);
SELECT ok(
  has_function_privilege(
    'authenticated'::name, 'public.phase3_route_navigable(bigint)'::text, 'EXECUTE'
  )
  AND NOT has_function_privilege(
    'anon'::name, 'public.phase3_route_navigable(bigint)'::text, 'EXECUTE'
  ),
  '5. DB-01. phase3_route_navigable : authenticated seulement'
);
SELECT ok(
  has_function_privilege(
    'authenticated'::name,
    'public.phase3_search_navigable_routes(double precision,double precision,double precision,text[],integer)'::text,
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'anon'::name,
    'public.phase3_search_navigable_routes(double precision,double precision,double precision,text[],integer)'::text,
    'EXECUTE'
  ),
  '6. DB-01. phase3_search_navigable_routes : authenticated seulement'
);

-- ----------------------------------------------------------------------------
-- TEST-PHASE3-DB-02 — prédicat de navigabilité (identique à Phase 2)
-- ----------------------------------------------------------------------------
SELECT is(public.phase3_route_navigable(930000001::bigint), true,
  '7. DB-02. Géométrie réelle valide ⇒ navigable');
SELECT is(public.phase3_route_navigable(930000005::bigint), false,
  '8. DB-02. Géométrie NULL ⇒ non navigable');
SELECT is(public.phase3_route_navigable(930000006::bigint), false,
  '9. DB-02. Géométrie vide ⇒ non navigable');
SELECT is(public.phase3_route_navigable(930000007::bigint), false,
  '10. DB-02. Géométrie dégénérée/invalide ⇒ non navigable');
SELECT is(public.phase3_route_navigable(999999999::bigint), false,
  '11. DB-02. Parcours inconnu ⇒ non navigable (jamais d''invention)');

-- ----------------------------------------------------------------------------
-- TEST-PHASE3-DB-03 — recherche bornée, ordonnée, filtrée
-- ----------------------------------------------------------------------------
SELECT is(
  (SELECT count(*)::int FROM public.phase3_search_navigable_routes(45.0, 6.0, 50, NULL, 3)),
  1,
  '12. DB-03. Rayon 50 km ⇒ seul le parcours sur place est retourné'
);
SELECT is(
  (SELECT route_id FROM public.phase3_search_navigable_routes(45.0, 6.0, 50, NULL, 3)),
  930000001::bigint,
  '13. DB-03. Le parcours retourné est le bon'
);
SELECT is(
  (SELECT count(*)::int FROM public.phase3_search_navigable_routes(45.0, 6.0, 200, NULL, 3)),
  3,
  '14. DB-03. Défaut p_limit=3 : la recherche reste bornée à 3'
);
SELECT is(
  (SELECT count(*)::int FROM public.phase3_search_navigable_routes(45.0, 6.0, 200, NULL, 10)),
  3,
  '15. DB-03. p_limit=10 est ramené à 3 (borne dure)'
);
SELECT is(
  (SELECT route_id FROM public.phase3_search_navigable_routes(45.0, 6.0, 200, NULL, 1)),
  930000001::bigint,
  '16. DB-03. p_limit=1 retourne le parcours le plus proche'
);
SELECT ok(
  (SELECT distance_m FROM public.phase3_search_navigable_routes(45.0, 6.0, 200, NULL, 3)
   ORDER BY distance_m ASC LIMIT 1)
  <
  (SELECT distance_m FROM public.phase3_search_navigable_routes(45.0, 6.0, 200, NULL, 3)
   ORDER BY distance_m ASC LIMIT 1 OFFSET 1),
  '17. DB-03. Les résultats sont ordonnés par distance croissante'
);
SELECT is(
  (SELECT count(*)::int FROM public.phase3_search_navigable_routes(45.0, 6.0, 10, NULL, 3)),
  1,
  '18. DB-03. Rayon 10 km exclut les parcours lointains'
);
SELECT is(
  (SELECT count(*)::int FROM public.phase3_search_navigable_routes(45.0, 6.0, 0, NULL, 3)),
  1,
  '19. DB-03. Rayon 0 est ramené à 1 km (jamais de rayon infini)'
);
SELECT is(
  (SELECT count(*)::int FROM public.phase3_search_navigable_routes(NULL, NULL, 50, ARRAY['Vosges'], 3)),
  1,
  '20. DB-03. Termes région/nom sans coordonnées ⇒ cohérence par le texte'
);
SELECT is(
  (SELECT route_id FROM public.phase3_search_navigable_routes(NULL, NULL, 50, ARRAY['Vosges'], 3)),
  930000002::bigint,
  '21. DB-03. Le parcours dont le nom/région matche est retourné'
);
SELECT is(
  (SELECT match_count FROM public.phase3_search_navigable_routes(NULL, NULL, 50, ARRAY['Vosges'], 3)),
  2,
  '22. DB-03. match_count compte nom + région'
);
SELECT is(
  (SELECT count(*)::int FROM public.phase3_search_navigable_routes(NULL, NULL, 50, ARRAY['zzz-inexistant'], 3)),
  0,
  '23. DB-03. Terme sans correspondance ⇒ zéro résultat'
);
SELECT is(
  (SELECT elevation_gain_m::int FROM public.phase3_search_navigable_routes(45.0, 6.0, 50, NULL, 3)),
  850,
  '24. DB-03. Les métadonnées réelles du parcours sont jointes'
);
SELECT ok(
  (SELECT abs(start_lat - 45.0) < 0.001 AND abs(start_lng - 6.0) < 0.001
   FROM public.phase3_search_navigable_routes(45.0, 6.0, 50, NULL, 3)),
  '25. DB-03. Le point de départ réel du tracé est exposé'
);
SELECT is(
  (SELECT count(*)::int
   FROM public.phase3_search_navigable_routes(45.0, 6.0, 200, ARRAY['Vosges'], 3)),
  1,
  '26. DB-03. Coordonnées + termes : les deux filtres s''appliquent'
);
SELECT is(
  (SELECT distance_m IS NOT NULL
   FROM public.phase3_search_navigable_routes(45.0, 6.0, 50, NULL, 3)),
  true,
  '27. DB-03. distance_m est fournie quand des coordonnées sont passées'
);
SELECT is(
  (SELECT distance_m IS NULL
   FROM public.phase3_search_navigable_routes(NULL, NULL, 50, ARRAY['Vosges'], 3)),
  true,
  '28. DB-03. distance_m reste NULL sans coordonnées (aucune valeur inventée)'
);

-- ----------------------------------------------------------------------------
-- TEST-PHASE3-DB-04 — aucune invention, aucune géométrie non navigable
-- ----------------------------------------------------------------------------
SELECT is(
  (SELECT count(*)::int FROM public.phase3_search_navigable_routes(NULL, NULL, 50, NULL, 3)),
  0,
  '29. DB-04. Zéro coordonnée ET zéro terme ⇒ zéro résultat'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.phase3_search_navigable_routes(45.0, 6.0, 500, NULL, 3) s
    WHERE s.route_id IN (930000005, 930000006, 930000007)
  ),
  '30. DB-04. Aucun parcours sans géométrie navigable n''est jamais retourné'
);

SELECT * FROM finish();
ROLLBACK;
