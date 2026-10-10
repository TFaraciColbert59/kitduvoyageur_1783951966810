-- ============================================================================
-- DOWN — 20261010160000_phase1_demo_isolation
--   • `refresh_leaderboard_for_user` restauré SANS le garde `is_demo`
--     (corps exact de 20260920110000_hardening.sql:266-351) ;
--   • colonne `user_profiles.is_demo` supprimée.
-- NOTA : le rejeu canonique du compte démo n'est PAS défait — les projections
-- reconstruites restent canoniques (événements + cumuls cohérents) ; revenir en
-- arrière ne doit pas réintroduire une projection non adossée au ledger.
-- Aucune donnée métier n'est supprimée par ce down (hors colonne is_demo).
-- ============================================================================

-- 1. refresh_leaderboard_for_user — corps d'origine (sans garde is_demo) ------
CREATE OR REPLACE FUNCTION public.refresh_leaderboard_for_user(
  p_user_id UUID,
  p_season_id TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points INTEGER;
  v_level INTEGER;
  v_title TEXT;
  v_country TEXT;
  v_region TEXT;
  v_city TEXT;
BEGIN
  IF p_user_id IS NULL OR p_season_id IS NULL THEN
    RETURN;
  END IF;

  SELECT GREATEST(0, season_points) INTO v_points
  FROM public.user_season_progress
  WHERE user_id = p_user_id AND season_id = p_season_id;

  IF NOT FOUND THEN
    DELETE FROM public.progression_leaderboard_agg
    WHERE user_id = p_user_id AND season_id = p_season_id;
    RETURN;
  END IF;

  v_points := COALESCE(v_points, 0);

  SELECT up.level, up.level_title INTO v_level, v_title
  FROM public.user_progression up
  WHERE up.user_id = p_user_id;

  IF v_level IS NULL THEN
    SELECT lv.level, lv.level_title INTO v_level, v_title
    FROM public.progression_level_for(0) lv;
  END IF;

  SELECT ut.country_code, ut.region_code, ut.city_code
    INTO v_country, v_region, v_city
  FROM public.user_territory ut
  WHERE ut.user_id = p_user_id;

  DELETE FROM public.progression_leaderboard_agg
  WHERE user_id = p_user_id
    AND season_id = p_season_id
    AND scope_type IN ('world', 'country', 'region', 'city');

  INSERT INTO public.progression_leaderboard_agg
    (season_id, scope_type, scope_id, user_id, alias, level, level_title, season_points, updated_at)
  VALUES
    (p_season_id, 'world', '', p_user_id,
     public.leaderboard_alias(p_user_id, 'world', '', p_season_id), v_level, v_title, v_points, now());

  IF v_country IS NOT NULL AND v_country <> '' THEN
    INSERT INTO public.progression_leaderboard_agg
      (season_id, scope_type, scope_id, user_id, alias, level, level_title, season_points, updated_at)
    VALUES
      (p_season_id, 'country', v_country, p_user_id,
       public.leaderboard_alias(p_user_id, 'country', v_country, p_season_id), v_level, v_title, v_points, now());
  END IF;

  IF v_region IS NOT NULL AND v_region <> '' THEN
    INSERT INTO public.progression_leaderboard_agg
      (season_id, scope_type, scope_id, user_id, alias, level, level_title, season_points, updated_at)
    VALUES
      (p_season_id, 'region', v_region, p_user_id,
       public.leaderboard_alias(p_user_id, 'region', v_region, p_season_id), v_level, v_title, v_points, now());
  END IF;

  IF v_city IS NOT NULL AND v_city <> '' THEN
    INSERT INTO public.progression_leaderboard_agg
      (season_id, scope_type, scope_id, user_id, alias, level, level_title, season_points, updated_at)
    VALUES
      (p_season_id, 'city', v_city, p_user_id,
       public.leaderboard_alias(p_user_id, 'city', v_city, p_season_id), v_level, v_title, v_points, now());
  END IF;
END;
$$;

-- 2. Colonne is_demo supprimée ------------------------------------------------
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS is_demo;
