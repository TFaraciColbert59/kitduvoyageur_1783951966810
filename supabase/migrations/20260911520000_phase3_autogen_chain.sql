-- ==============================================================================
-- Phase 3 — Finaliser la création de voyage (parcours réellement navigables)
--
-- Chantier LANCEMENT_MONDIAL §Phase 3 :
--   • la génération IA cherche D'ABORD des randonnées disponibles dont la
--     géométrie est réelle et valide, cohérentes avec les coordonnées ou la
--     région du brief ;
--   • l'entrée « Démarrer la navigation » ne doit jamais s'appuyer sur une
--     estimation (`uniform_from_blueprint`) : le Hub a besoin du MÊME prédicat
--     de navigabilité que `select_adventure_plan_route` (Phase 2).
--
--   • phase3_route_navigable(p_route_id) : prédicat exact de navigabilité
--     (geom non nulle, non vide, ≥ 2 points, valide) — lecture pure.
--   • phase3_search_navigable_routes(...) : recherche bornée (≤ 3 résultats)
--     sur `hiking_routes`, filtre géométrie réelle, index GIST utilisé via
--     l'opérateur `&&`/`ST_Expand`, filtre texte optionnel (nom/ref/région),
--     distance en mètres quand des coordonnées sont fournies. Aucune donnée
--     inventée : zéro terme ET zéro coordonnée ⇒ zéro résultat.
--
-- Migration strictement additive et idempotente (CREATE OR REPLACE, gardes
-- pg_roles). Aucune écriture, aucun changement de schéma de table.
-- ==============================================================================

-- ── 1. Prédicat de navigabilité (identique à select_adventure_plan_route) ────
CREATE OR REPLACE FUNCTION public.phase3_route_navigable(p_route_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.hiking_routes r
    WHERE r.id = p_route_id
      AND r.geom IS NOT NULL
      AND NOT ST_IsEmpty(r.geom)
      AND ST_NPoints(r.geom) >= 2
      AND ST_IsValid(r.geom)
  );
$fn$;

COMMENT ON FUNCTION public.phase3_route_navigable(bigint) IS
  'Phase 3 — vrai si le parcours porte une géométrie BDD réelle et navigable '
  '(non nulle, non vide, ≥ 2 points, valide). Prédicat identique à celui exigé '
  'par select_adventure_plan_route : aucune navigation sur une estimation.';

REVOKE ALL ON FUNCTION public.phase3_route_navigable(bigint) FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.phase3_route_navigable(bigint) FROM anon;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.phase3_route_navigable(bigint)
  TO authenticated, service_role;

-- ── 2. Recherche bornée de parcours réels ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.phase3_search_navigable_routes(
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_radius_km double precision DEFAULT 50,
  p_terms text[] DEFAULT NULL,
  p_limit integer DEFAULT 3
)
RETURNS TABLE (
  route_id bigint,
  name text,
  ref text,
  region text,
  distance_km numeric,
  elevation_gain_m numeric,
  duration_hours numeric,
  difficulty text,
  distance_m double precision,
  start_lat double precision,
  start_lng double precision,
  match_count integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
  WITH bounds AS (
    SELECT LEAST(GREATEST(COALESCE(p_limit, 3), 1), 3)::integer AS lim,
           LEAST(GREATEST(COALESCE(p_radius_km, 50), 1), 500)::double precision AS radius_km
  ),
  terms AS (
    SELECT DISTINCT lower(btrim(t.term)) AS term
    FROM unnest(COALESCE(p_terms, ARRAY[]::text[])) AS t(term)
    WHERE btrim(t.term) <> ''
      AND length(btrim(t.term)) >= 3
  ),
  has_coords AS (
    SELECT (p_lat IS NOT NULL AND p_lng IS NOT NULL
            AND p_lat BETWEEN -90 AND 90 AND p_lng BETWEEN -180 AND 180) AS ok
  ),
  scored AS (
    SELECT
      r.id,
      r.name,
      r.ref,
      r.region,
      r.distance_km,
      r.geom,
      m.elevation_gain,
      m.duration_hours,
      m.difficulty,
      CASE
        WHEN (SELECT ok FROM has_coords)
          THEN ST_Distance(
            r.geom::geography,
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
          )
      END AS distance_m,
      CASE
        WHEN (SELECT count(*) FROM terms) = 0 THEN 0
        ELSE (
          SELECT COALESCE(sum(
            (CASE WHEN r.name ILIKE '%' || t.term || '%' THEN 1 ELSE 0 END)
            + (CASE WHEN r.ref ILIKE '%' || t.term || '%' THEN 1 ELSE 0 END)
            + (CASE WHEN r.region ILIKE '%' || t.term || '%' THEN 1 ELSE 0 END)
          ), 0) FROM terms t
        )
      END::integer AS match_count
    FROM public.hiking_routes r
    LEFT JOIN public.trail_metadata m ON m.trail_id = r.id
    CROSS JOIN bounds b
    WHERE r.geom IS NOT NULL
      AND NOT ST_IsEmpty(r.geom)
      AND ST_NPoints(r.geom) >= 2
      AND ST_IsValid(r.geom)
      -- Filtre spatial : `&&` borne par l'enveloppe (index GIST) puis
      -- ST_DWithin exact en géographie. Aucune coordonnée ⇒ pas de filtre.
      AND (
        NOT (SELECT ok FROM has_coords)
        OR (
          r.geom && ST_Expand(
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326),
            b.radius_km / 111.32
          )
          AND ST_DWithin(
            r.geom::geography,
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
            b.radius_km * 1000
          )
        )
      )
      -- Filtre texte optionnel : au moins un terme significatif doit matcher.
      AND (
        (SELECT count(*) FROM terms) = 0
        OR EXISTS (
          SELECT 1 FROM terms t
          WHERE r.name ILIKE '%' || t.term || '%'
             OR r.ref ILIKE '%' || t.term || '%'
             OR r.region ILIKE '%' || t.term || '%'
        )
      )
  )
  SELECT
    s.id,
    s.name,
    s.ref,
    s.region,
    s.distance_km,
    s.elevation_gain,
    s.duration_hours,
    s.difficulty,
    s.distance_m,
    ST_Y(ST_StartPoint(ST_GeometryN(s.geom, 1))),
    ST_X(ST_StartPoint(ST_GeometryN(s.geom, 1))),
    s.match_count
  FROM scored s
  -- Jamais de résultat sans cohérence : coordonnées présentes OU terme matché.
  WHERE (SELECT ok FROM has_coords) OR s.match_count > 0
  ORDER BY
    s.distance_m ASC NULLS LAST,
    s.match_count DESC,
    s.distance_km ASC NULLS LAST,
    s.id ASC
  LIMIT (SELECT lim FROM bounds);
$fn$;

COMMENT ON FUNCTION public.phase3_search_navigable_routes(
  double precision, double precision, double precision, text[], integer
) IS
  'Phase 3 — recherche bornée (≤ 3) de parcours navigables réels : géométrie '
  'non nulle/vide/invalide exclue, rayon ≤ 500 km (index GIST via &&), termes '
  'nom/ref/région optionnels, distance en mètres quand des coordonnées sont '
  'fournies. Zéro terme ET zéro coordonnée ⇒ zéro résultat (jamais d''invention).';

REVOKE ALL ON FUNCTION public.phase3_search_navigable_routes(
  double precision, double precision, double precision, text[], integer
) FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.phase3_search_navigable_routes(
      double precision, double precision, double precision, text[], integer
    ) FROM anon;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.phase3_search_navigable_routes(
  double precision, double precision, double precision, text[], integer
) TO authenticated, service_role;
