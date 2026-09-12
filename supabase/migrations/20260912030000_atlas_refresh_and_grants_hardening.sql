-- CHANTIER ATLAS — Phase 6 — Durcissement des fonctions SECURITY DEFINER.
--
-- 1) `refresh_atlas_density` : single-flight (advisory lock), timeout de statement,
--    fallback non-concurrent EXPLICITEMENT journalisé (jamais silencieux), et
--    ACL stricte service_role (les default privileges Supabase accordent EXECUTE
--    à anon/authenticated sur les nouvelles fonctions — preuve repo :
--    20260911138000_a1_grants_hardening.sql).
-- 2) Sonde TEMPORAIRE `atlas_debug_function_privileges` (service_role uniquement)
--    pour capturer la preuve brute has_function_privilege, supprimée par
--    20260912040000_atlas_drop_grant_probe.sql après capture.

CREATE OR REPLACE FUNCTION public.refresh_atlas_density()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT pg_try_advisory_lock(hashtext('atlas.refresh_atlas_density')) THEN
    RAISE WARNING 'refresh_atlas_density ignoré : un rafraîchissement est déjà en cours';
    RETURN;
  END IF;

  BEGIN
    PERFORM set_config('statement_timeout', '60000', true);

    BEGIN
      REFRESH MATERIALIZED VIEW CONCURRENTLY public.country_centroids;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'CONCURRENTLY country_centroids indisponible (%), bascule non-concurrente', SQLERRM;
      REFRESH MATERIALIZED VIEW public.country_centroids;
    END;

    BEGIN
      REFRESH MATERIALIZED VIEW CONCURRENTLY public.country_trail_density;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'CONCURRENTLY country_trail_density indisponible (%), bascule non-concurrente', SQLERRM;
      REFRESH MATERIALIZED VIEW public.country_trail_density;
    END;

    BEGIN
      REFRESH MATERIALIZED VIEW CONCURRENTLY public.trail_density_geohash5;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'CONCURRENTLY trail_density_geohash5 indisponible (%), bascule non-concurrente', SQLERRM;
      REFRESH MATERIALIZED VIEW public.trail_density_geohash5;
    END;

    PERFORM pg_advisory_unlock(hashtext('atlas.refresh_atlas_density'));
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_advisory_unlock(hashtext('atlas.refresh_atlas_density'));
    RAISE;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_atlas_density() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_atlas_density() TO service_role;

-- Sonde temporaire de privilèges (service_role uniquement)
CREATE OR REPLACE FUNCTION public.atlas_debug_function_privileges()
RETURNS TABLE (function_name text, role_name text, can_execute boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.proname::text,
         r.rolname::text,
         has_function_privilege(r.rolname, p.oid, 'EXECUTE')
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(rolname)
  WHERE n.nspname = 'public'
    AND p.proname IN ('refresh_atlas_density', 'trails_in_viewport')
  ORDER BY p.proname, r.rolname;
$$;

REVOKE ALL ON FUNCTION public.atlas_debug_function_privileges() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atlas_debug_function_privileges() TO service_role;
