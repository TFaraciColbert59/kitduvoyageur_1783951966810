-- ============================================================================
-- P1 — Consommateur d'outbox atomique et projections par saison.
-- Chaque gain : journal, cumuls, saison, niveau — tout réussit ensemble.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_season_progress (
  user_id UUID NOT NULL,
  season_id TEXT NOT NULL REFERENCES public.progression_seasons(id),
  season_points INTEGER NOT NULL DEFAULT 0 CHECK (season_points >= 0),
  skill_explorer_points INTEGER NOT NULL DEFAULT 0 CHECK (skill_explorer_points >= 0),
  skill_preparer_points INTEGER NOT NULL DEFAULT 0 CHECK (skill_preparer_points >= 0),
  skill_partager_points INTEGER NOT NULL DEFAULT 0 CHECK (skill_partager_points >= 0),
  skill_entraider_points INTEGER NOT NULL DEFAULT 0 CHECK (skill_entraider_points >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, season_id)
);
ALTER TABLE public.user_season_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_season_progress FROM anon, authenticated;

ALTER TABLE public.progression_events
  ADD COLUMN IF NOT EXISTS reward_transaction_id UUID UNIQUE REFERENCES public.reward_transactions(id),
  ADD COLUMN IF NOT EXISTS effective_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rules_version TEXT,
  ADD COLUMN IF NOT EXISTS skill_allocations JSONB;
ALTER TABLE public.progression_events ALTER COLUMN season_id DROP NOT NULL;

ALTER TABLE public.user_progression ADD COLUMN IF NOT EXISTS current_season_id TEXT;

CREATE OR REPLACE FUNCTION public.process_progression_outbox(p_limit INTEGER DEFAULT 50)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row RECORD; v_processed INT := 0; v_failed INT := 0;
  v_active_season TEXT; v_alloc JSONB;
  v_p_explorer INT; v_p_preparer INT; v_p_partager INT; v_p_entraider INT;
  v_w_explorer NUMERIC; v_w_preparer NUMERIC; v_w_partager NUMERIC; v_w_entraider NUMERIC;
  v_abs INT;
BEGIN
  SELECT id INTO v_active_season FROM public.progression_seasons WHERE status = 'active' LIMIT 1;

  FOR v_row IN
    SELECT o.id AS outbox_id, o.attempts, t.*
    FROM public.progression_outbox o
    JOIN public.reward_transactions t ON t.id = o.reward_transaction_id
    WHERE o.status IN ('pending','failed') AND o.available_at <= now()
    ORDER BY o.created_at
    LIMIT p_limit
    FOR UPDATE OF o SKIP LOCKED
  LOOP
    BEGIN
      UPDATE public.progression_outbox
      SET status = 'processing', locked_at = now(), attempts = v_row.attempts + 1
      WHERE id = v_row.outbox_id;

      IF EXISTS (SELECT 1 FROM public.progression_events WHERE reward_transaction_id = v_row.id) THEN
        UPDATE public.progression_outbox
        SET status = 'processed', processed_at = now(), last_error = NULL, locked_at = NULL
        WHERE id = v_row.outbox_id;
        CONTINUE;
      END IF;

      v_alloc := v_row.skill_allocations;
      v_p_explorer := COALESCE((SELECT (e->>'points')::int FROM jsonb_array_elements(v_alloc) e WHERE e->>'skill' = 'explorer'), 0);
      v_p_preparer := COALESCE((SELECT (e->>'points')::int FROM jsonb_array_elements(v_alloc) e WHERE e->>'skill' = 'preparer'), 0);
      v_p_partager := COALESCE((SELECT (e->>'points')::int FROM jsonb_array_elements(v_alloc) e WHERE e->>'skill' = 'partager'), 0);
      v_p_entraider := COALESCE((SELECT (e->>'points')::int FROM jsonb_array_elements(v_alloc) e WHERE e->>'skill' = 'entraider'), 0);
      v_abs := GREATEST(1, ABS(v_row.points));
      v_w_explorer := ABS(v_p_explorer)::numeric / v_abs;
      v_w_preparer := ABS(v_p_preparer)::numeric / v_abs;
      v_w_partager := ABS(v_p_partager)::numeric / v_abs;
      v_w_entraider := ABS(v_p_entraider)::numeric / v_abs;

      INSERT INTO public.progression_events
        (idempotency_key, user_id, season_id, action_type, points_total,
         weight_explorer, weight_preparer, weight_partager, weight_entraider, explanation,
         reward_transaction_id, effective_at, rules_version, skill_allocations)
      VALUES
        ('reward_tx:' || v_row.id, v_row.user_id, v_row.season_id,
         COALESCE(v_row.metadata->>'action_type', 'gain'), v_row.points,
         v_w_explorer, v_w_preparer, v_w_partager, v_w_entraider,
         COALESCE(v_row.metadata->>'explanation', 'Gain validé'),
         v_row.id, COALESCE(v_row.effective_at, v_row.created_at), v_row.rules_version, v_alloc);

      INSERT INTO public.user_progression
        (user_id, lifetime_points, season_points, level, level_title,
         skill_explorer_points, skill_preparer_points, skill_partager_points, skill_entraider_points,
         current_season_id, updated_at)
      SELECT
        v_row.user_id, GREATEST(0, v_row.points),
        CASE WHEN v_row.season_id = v_active_season THEN GREATEST(0, v_row.points) ELSE 0 END,
        lv.level, lv.level_title,
        GREATEST(0, v_p_explorer), GREATEST(0, v_p_preparer), GREATEST(0, v_p_partager), GREATEST(0, v_p_entraider),
        CASE WHEN v_row.season_id = v_active_season THEN v_active_season ELSE NULL END, now()
      FROM public.progression_level_for(GREATEST(0, v_row.points)) lv
      ON CONFLICT (user_id) DO UPDATE SET
        lifetime_points = GREATEST(0, public.user_progression.lifetime_points + v_row.points),
        season_points = CASE WHEN v_row.season_id = v_active_season
          THEN GREATEST(0, public.user_progression.season_points + v_row.points)
          ELSE public.user_progression.season_points END,
        skill_explorer_points = GREATEST(0, public.user_progression.skill_explorer_points + v_p_explorer),
        skill_preparer_points = GREATEST(0, public.user_progression.skill_preparer_points + v_p_preparer),
        skill_partager_points = GREATEST(0, public.user_progression.skill_partager_points + v_p_partager),
        skill_entraider_points = GREATEST(0, public.user_progression.skill_entraider_points + v_p_entraider),
        current_season_id = COALESCE(CASE WHEN v_row.season_id = v_active_season THEN v_active_season END, public.user_progression.current_season_id),
        updated_at = now();

      IF v_row.season_id IS NOT NULL THEN
        INSERT INTO public.user_season_progress
          (user_id, season_id, season_points, skill_explorer_points, skill_preparer_points, skill_partager_points, skill_entraider_points, updated_at)
        VALUES
          (v_row.user_id, v_row.season_id, GREATEST(0, v_row.points),
           GREATEST(0, v_p_explorer), GREATEST(0, v_p_preparer), GREATEST(0, v_p_partager), GREATEST(0, v_p_entraider), now())
        ON CONFLICT (user_id, season_id) DO UPDATE SET
          season_points = GREATEST(0, public.user_season_progress.season_points + v_row.points),
          skill_explorer_points = GREATEST(0, public.user_season_progress.skill_explorer_points + v_p_explorer),
          skill_preparer_points = GREATEST(0, public.user_season_progress.skill_preparer_points + v_p_preparer),
          skill_partager_points = GREATEST(0, public.user_season_progress.skill_partager_points + v_p_partager),
          skill_entraider_points = GREATEST(0, public.user_season_progress.skill_entraider_points + v_p_entraider),
          updated_at = now();
      END IF;

      UPDATE public.user_progression up
      SET level = lv.level, level_title = lv.level_title
      FROM public.progression_level_for(
        (SELECT lifetime_points FROM public.user_progression WHERE user_id = v_row.user_id)
      ) AS lv
      WHERE up.user_id = v_row.user_id;

      UPDATE public.progression_outbox
      SET status = 'processed', processed_at = now(), last_error = NULL, locked_at = NULL
      WHERE id = v_row.outbox_id;
      v_processed := v_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.progression_outbox
      SET status = CASE WHEN v_row.attempts + 1 >= 5 THEN 'dead' ELSE 'failed' END,
          attempts = v_row.attempts + 1,
          last_error = SQLERRM,
          locked_at = NULL,
          available_at = now() + (interval '1 minute' * power(2, LEAST(v_row.attempts + 1, 6)))
      WHERE id = v_row.outbox_id;
      v_failed := v_failed + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('processed', v_processed, 'failed', v_failed);
END;
$$;

REVOKE ALL ON FUNCTION public.process_progression_outbox(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_progression_outbox(integer) TO service_role;
