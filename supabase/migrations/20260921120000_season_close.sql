-- ============================================================================
-- P1 — Clôture de saison reproductible : fige la saison (statut `completed`)
-- sans aucune remise à zéro destructive des agrégats.
-- Exécution : service_role uniquement. Réexécution idempotente.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.close_progression_season(p_season_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status TEXT;
  v_participants INT;
BEGIN
  -- Un appel utilisateur (session) n'est jamais autorisé ici : la clôture est
  -- une opération serveur explicite, jamais déclenchée par un client.
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Clôture de saison réservée au rôle serveur';
  END IF;

  SELECT status INTO v_status
  FROM public.progression_seasons
  WHERE id = p_season_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'season_not_found');
  END IF;

  -- Idempotence : une saison déjà close n'est jamais réécrite, ses agrégats
  -- (user_season_progress, progression_events) restent intacts.
  IF v_status = 'completed' THEN
    RETURN jsonb_build_object('ok', true, 'seasonId', p_season_id, 'alreadyClosed', true);
  END IF;

  SELECT count(*) INTO v_participants
  FROM public.user_season_progress
  WHERE season_id = p_season_id;

  UPDATE public.progression_seasons
  SET status = 'completed'
  WHERE id = p_season_id;

  RETURN jsonb_build_object(
    'ok', true,
    'seasonId', p_season_id,
    'participants', COALESCE(v_participants, 0),
    'archivedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.close_progression_season(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_progression_season(text) TO service_role;
