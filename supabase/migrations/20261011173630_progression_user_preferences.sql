-- ============================================================================
-- T16 — Préférences privées de progression (rythme choisi, pause).
--
-- Aucune conséquence économique : ni XP, ni mission retirée, ni distinction.
-- La pause est une préférence d'affichage et de notifications ; le serveur
-- n'impose jamais d'objectif quotidien ni de série.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.progression_user_preferences (
  user_id uuid PRIMARY KEY,
  weekly_rhythm text CHECK (weekly_rhythm IN ('leger', 'regulier', 'intense')),
  paused boolean NOT NULL DEFAULT false,
  paused_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.progression_user_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.progression_user_preferences FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.progression_user_preferences TO service_role;

-- Mise à jour idempotente et scopée utilisateur (service_role).
CREATE OR REPLACE FUNCTION public.update_progression_preferences(
  p_user_id uuid,
  p_weekly_rhythm text DEFAULT NULL,
  p_set_rhythm boolean DEFAULT false,
  p_paused boolean DEFAULT NULL,
  p_set_paused boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF p_set_rhythm AND p_weekly_rhythm IS NOT NULL
     AND p_weekly_rhythm NOT IN ('leger', 'regulier', 'intense') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rythme_invalide');
  END IF;

  INSERT INTO public.progression_user_preferences (user_id, weekly_rhythm, paused, paused_at, updated_at)
  VALUES (
    p_user_id,
    CASE WHEN p_set_rhythm THEN p_weekly_rhythm ELSE NULL END,
    COALESCE(CASE WHEN p_set_paused THEN p_paused ELSE false END, false),
    CASE WHEN p_set_paused AND p_paused THEN now() ELSE NULL END,
    now())
  ON CONFLICT (user_id) DO UPDATE SET
    weekly_rhythm = CASE WHEN p_set_rhythm THEN p_weekly_rhythm ELSE public.progression_user_preferences.weekly_rhythm END,
    paused = CASE WHEN p_set_paused THEN COALESCE(p_paused, false) ELSE public.progression_user_preferences.paused END,
    paused_at = CASE
      WHEN p_set_paused AND COALESCE(p_paused, false) THEN now()
      WHEN p_set_paused THEN NULL
      ELSE public.progression_user_preferences.paused_at END,
    updated_at = now();

  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.update_progression_preferences(uuid, text, boolean, boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_progression_preferences(uuid, text, boolean, boolean, boolean) TO service_role;
