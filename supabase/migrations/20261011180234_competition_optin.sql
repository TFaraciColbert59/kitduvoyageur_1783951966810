-- ============================================================================
-- T35 — Opt-in de compétition, DISTINCT de la confidentialité générale.
--
-- Par défaut : aucune participation aux classements. Le retrait est EFFECTIF :
-- les lignes d'agrégat du compte sont supprimées immédiatement. La
-- réactivation recrée les agrégats au prochain rafraîchissement planifié.
-- Aucune coordonnée n'entre jamais dans les agrégats ; le 1 km reste fermé.
-- ============================================================================

ALTER TABLE public.progression_user_preferences
  ADD COLUMN IF NOT EXISTS competition_opt_in boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.set_competition_optin(
  p_user_id uuid,
  p_opt_in boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  INSERT INTO public.progression_user_preferences (user_id, competition_opt_in, updated_at)
  VALUES (p_user_id, COALESCE(p_opt_in, false), now())
  ON CONFLICT (user_id) DO UPDATE
    SET competition_opt_in = COALESCE(p_opt_in, false), updated_at = now();

  IF COALESCE(p_opt_in, false) = false THEN
    -- Retrait effectif : le compte disparaît des agrégats.
    DELETE FROM public.progression_leaderboard_agg WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'opted_in', COALESCE(p_opt_in, false));
END $$;
REVOKE ALL ON FUNCTION public.set_competition_optin(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_competition_optin(uuid, boolean) TO service_role;
