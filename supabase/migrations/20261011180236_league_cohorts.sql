-- ============================================================================
-- T36 — Cohortes de ligues : gelées pour la saison, minimum 20 participants
-- éligibles RÉELS (hors comptes de démonstration, hors non opt-in).
--
-- Aucune ligue fantôme : population insuffisante → refus explicite. La
-- promotion ne modifie ni XP permanents ni permissions (aucun gain ici).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.progression_league_cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id text NOT NULL,
  cohort_index integer NOT NULL CHECK (cohort_index >= 1),
  member_ids uuid[] NOT NULL,
  frozen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, cohort_index)
);

ALTER TABLE public.progression_league_cohorts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.progression_league_cohorts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.progression_league_cohorts TO service_role;

CREATE OR REPLACE FUNCTION public.create_league_cohorts(
  p_season_id text,
  p_size integer DEFAULT 30
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_eligible uuid[]; v_total integer; v_size integer := GREATEST(10, LEAST(COALESCE(p_size, 30), 100));
  v_index integer := 1; v_slice uuid[];
BEGIN
  IF EXISTS (SELECT 1 FROM public.progression_league_cohorts c WHERE c.season_id = p_season_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'saison_deja_gelee');
  END IF;

  SELECT array_agg(usp.user_id ORDER BY usp.season_points DESC, usp.user_id ASC)
    INTO v_eligible
  FROM public.user_season_progress usp
  JOIN public.user_profiles p ON p.id = usp.user_id
  LEFT JOIN public.progression_user_preferences pref ON pref.user_id = usp.user_id
  WHERE usp.season_id = p_season_id
    AND COALESCE(p.is_demo, false) = false
    AND COALESCE(pref.competition_opt_in, false) = true;

  v_total := COALESCE(array_length(v_eligible, 1), 0);
  IF v_total < 20 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'population_insuffisante', 'eligible', v_total);
  END IF;

  WHILE v_index <= CEIL(v_total::numeric / v_size) LOOP
    v_slice := v_eligible[((v_index - 1) * v_size + 1) : LEAST(v_index * v_size, v_total)];
    INSERT INTO public.progression_league_cohorts (season_id, cohort_index, member_ids)
    VALUES (p_season_id, v_index, v_slice);
    v_index := v_index + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'cohorts', CEIL(v_total::numeric / v_size), 'eligible', v_total);
END $$;
REVOKE ALL ON FUNCTION public.create_league_cohorts(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_league_cohorts(text, integer) TO service_role;
