-- CHANTIER ATLAS — Phase 1 — Observabilité temporaire (service_role uniquement)
--
-- Objectif : capturer les PREUVES brutes exigées par le chantier (ATLAS-R8) :
--   1. plan EXPLAIN ANALYZE de la requête viewport (usage de l'index GIST)
--   2. policies RLS réelles sur hiking_routes / trail_metadata / trail_scores
--   3. outil one-shot d'import des polygones pays depuis le GeoJSON statique
--
-- ⚠️ Ces fonctions sont TEMPORAIRES : elles sont supprimées par la migration
-- 20260912020000_atlas_drop_debug_functions.sql une fois les preuves capturées.
-- Toutes sont REVOKE PUBLIC et GRANT service_role uniquement.

-- 1) EXPLAIN ANALYZE arbitraire (service_role uniquement, temporaire)
CREATE OR REPLACE FUNCTION public.atlas_debug_explain(p_query text)
RETURNS SETOF text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ' || p_query;
END;
$$;

REVOKE ALL ON FUNCTION public.atlas_debug_explain(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atlas_debug_explain(text) TO service_role;

-- 2) Policies RLS réelles (service_role uniquement, temporaire)
CREATE OR REPLACE FUNCTION public.atlas_debug_policies()
RETURNS TABLE (
  schemaname text,
  tablename text,
  policyname text,
  roles text,
  cmd text,
  qual text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.schemaname::text,
         p.tablename::text,
         p.policyname::text,
         p.roles::text,
         p.cmd::text,
         p.qual::text
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename IN ('hiking_routes', 'trail_metadata', 'trail_scores')
  ORDER BY p.tablename, p.policyname;
$$;

REVOKE ALL ON FUNCTION public.atlas_debug_policies() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atlas_debug_policies() TO service_role;

-- 3) Statut RLS réel (relrowsecurity / relforcerowsecurity)
CREATE OR REPLACE FUNCTION public.atlas_debug_rls_status()
RETURNS TABLE (tablename text, rls_enabled boolean, rls_forced boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT c.relname::text,
         c.relrowsecurity,
         c.relforcerowsecurity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('hiking_routes', 'trail_metadata', 'trail_scores')
  ORDER BY c.relname;
$$;

REVOKE ALL ON FUNCTION public.atlas_debug_rls_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atlas_debug_rls_status() TO service_role;

-- 4) Import one-shot des polygones pays (jamais d'écrasement de géométrie existante)
CREATE OR REPLACE FUNCTION public.atlas_set_country_geometry(p_iso_a2 text, p_geojson jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.countries_geo
  SET geometry = ST_SetSRID(ST_GeomFromGeoJSON(p_geojson::text), 4326),
      updated_at = now()
  WHERE upper(iso_a2) = upper(p_iso_a2)
    AND geometry IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.atlas_set_country_geometry(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atlas_set_country_geometry(text, jsonb) TO service_role;
