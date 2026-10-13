-- ============================================================================
-- T14 — Avancement des missions dérivé des événements canoniques.
--
-- L'avancement compte des RÉALISATIONS SOURCES DISTINCTES (événements
-- `progression_events`), par modèle publié et par période du modèle :
--   • un même événement avance plusieurs missions mais ne crée qu'un gain ;
--   • une cible multi-activités compte les identifiants métier distincts ;
--   • la fin d'une mission pose `completed_at` (DISTINCTION) et n'écrit AUCUN
--     PROGRESSION_AWARD — aucun XP n'est émis ici.
-- Recalcul idempotent à la lecture (génération sans boucle).
-- Exécution : service_role uniquement.
-- ============================================================================

ALTER TABLE public.progression_mission_assignments
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Table de correspondance modèle → actions sources (miroir SQL du catalogue
-- TS `missionCatalog.ts` pour les modèles PUBLIÉS uniquement).
CREATE TABLE IF NOT EXISTS public.progression_mission_model_actions (
  model_id text NOT NULL,
  action_type text NOT NULL,
  PRIMARY KEY (model_id, action_type)
);
ALTER TABLE public.progression_mission_model_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.progression_mission_model_actions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.progression_mission_model_actions TO service_role;

INSERT INTO public.progression_mission_model_actions (model_id, action_type) VALUES
  ('mission_discovery_first_activity', 'hike_session_processed'),
  ('mission_prep_departure_checks',    'checklist_completed'),
  ('mission_prep_kit_debrief',         'kit_field_report'),
  ('mission_community_carnet',         'carnet_published'),
  ('mission_community_review',         'place_review')
ON CONFLICT (model_id, action_type) DO NOTHING;

-- Recalcul idempotent des avancements du compte : renvoie le nombre de
-- missions mises à jour. Aucun XP, aucune transaction économique.
CREATE OR REPLACE FUNCTION public.refresh_progression_mission_progress(p_user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_updated integer := 0;
  v_season_start timestamptz;
  v_season_end timestamptz;
BEGIN
  SELECT s.starts_at, s.ends_at INTO v_season_start, v_season_end
  FROM public.progression_seasons s WHERE s.status = 'active' LIMIT 1;

  UPDATE public.progression_mission_assignments a
  SET progress = LEAST(c.cnt, a.target_count),
      completed_at = CASE
        WHEN c.cnt >= a.target_count AND a.completed_at IS NULL THEN now()
        ELSE a.completed_at
      END
  FROM (
    SELECT a2.id AS assignment_id, count(DISTINCT e.id)::int AS cnt
    FROM public.progression_mission_assignments a2
    JOIN public.progression_mission_model_actions mma ON mma.model_id = a2.model_id
    JOIN public.progression_events e
      ON e.user_id = a2.user_id AND e.action_type = mma.action_type
     AND (
       a2.period = 'ever'
       OR (a2.period = 'week'
           AND e.effective_at >= date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
       OR (a2.period = 'season'
           AND v_season_start IS NOT NULL
           AND e.effective_at >= v_season_start AND e.effective_at < v_season_end)
     )
    WHERE a2.user_id = p_user_id AND a2.state = 'active'
    GROUP BY a2.id
  ) c
  WHERE a.id = c.assignment_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END $$;
REVOKE ALL ON FUNCTION public.refresh_progression_mission_progress(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_progression_mission_progress(uuid) TO service_role;
