-- ============================================================================
-- Cycle de vie des saisons — ouverture contrôlée (service_role uniquement).
-- Complète `close_progression_season` : aucune saison n'est créée implicitement
-- par le moteur ; l'ouverture est une décision d'exploitation explicite.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.open_progression_season(
  p_season_id TEXT,
  p_season_number INTEGER,
  p_name TEXT,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing TEXT;
BEGIN
  -- Appel serveur uniquement : aucune session utilisateur ne doit ouvrir une saison.
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Ouverture de saison réservée au serveur';
  END IF;

  IF p_season_id IS NULL OR length(trim(p_season_id)) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_id');
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_name');
  END IF;
  IF p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at <= p_starts_at THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_dates');
  END IF;

  SELECT id INTO v_existing FROM public.progression_seasons WHERE id = p_season_id;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'created', false, 'seasonId', p_season_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.progression_seasons s
    WHERE p_starts_at < s.ends_at AND p_ends_at > s.starts_at
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'overlap');
  END IF;

  INSERT INTO public.progression_seasons (id, season_number, name, starts_at, ends_at, status)
  VALUES (p_season_id, p_season_number, trim(p_name), p_starts_at, p_ends_at, 'upcoming');

  RETURN jsonb_build_object('ok', true, 'created', true, 'seasonId', p_season_id);
END;
$$;

REVOKE ALL ON FUNCTION public.open_progression_season(text, integer, text, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_progression_season(text, integer, text, timestamptz, timestamptz)
  TO service_role;

COMMENT ON FUNCTION public.open_progression_season(text, integer, text, timestamptz, timestamptz) IS
  'Ouvre une saison future explicite (statut upcoming), refuse les chevauchements ; '
  'service_role uniquement, aucune création implicite par le moteur.';
