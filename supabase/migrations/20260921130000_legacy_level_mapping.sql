-- ============================================================================
-- P1 — Correspondance versionnée des niveaux hérités (préparée, NON appliquée).
--
-- `progression_legacy_mapping` trace chaque application ; le niveau atteint
-- hérité (`user_profiles.level`) est converti en plancher honorifique de points
-- à vie, en réutilisant les seuils réels de `progression_level_for`.
-- Aucune saison rétroactive, aucune compétence inventée, aucun cumul abaissé.
--
-- DÉFAUT : `apply_legacy_level_mapping` n'est appelée par AUCUN trigger, cron
-- ni route. « À activer après revue » : l'activation se fera par une décision
-- d'exploitation explicite (appel service_role).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.progression_legacy_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  legacy_source TEXT NOT NULL CHECK (legacy_source IN ('xp', 'level', 'loyalty')),
  legacy_value INTEGER NOT NULL,
  mapped_lifetime_points INTEGER NOT NULL CHECK (mapped_lifetime_points >= 0),
  mapping_version TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, legacy_source, mapping_version)
);

CREATE INDEX IF NOT EXISTS progression_legacy_mapping_user_idx
  ON public.progression_legacy_mapping (user_id);

ALTER TABLE public.progression_legacy_mapping ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.progression_legacy_mapping FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_legacy_level_mapping(
  p_user_id UUID,
  p_mapping_version TEXT DEFAULT 'legacy-xp-v1'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_version TEXT;
  v_xp INT;
  v_level INT;
  v_floor INT;
  v_already INT;
  v_after INT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Identité non concordante';
  END IF;

  v_version := COALESCE(NULLIF(btrim(p_mapping_version), ''), 'legacy-xp-v1');

  SELECT COALESCE(xp, 0), COALESCE(level, 1) INTO v_xp, v_level
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'profile_not_found');
  END IF;

  v_level := GREATEST(1, v_level);

  -- Idempotence par version : une version déjà appliquée ne réécrit rien.
  SELECT mapped_lifetime_points INTO v_already
  FROM public.progression_legacy_mapping
  WHERE user_id = p_user_id AND legacy_source = 'level' AND mapping_version = v_version;

  IF FOUND THEN
    SELECT lifetime_points INTO v_after
    FROM public.user_progression
    WHERE user_id = p_user_id;
    RETURN jsonb_build_object(
      'ok', true,
      'alreadyApplied', true,
      'mappingVersion', v_version,
      'legacyLevel', v_level,
      'legacyXp', v_xp,
      'mappedLifetimePoints', v_already,
      'lifetimePoints', COALESCE(v_after, 0)
    );
  END IF;

  -- Plancher honorifique : seuil réel du niveau atteint dans les règles actives.
  SELECT t.min_points INTO v_floor
  FROM public.progression_rules r,
       jsonb_to_recordset(r.payload->'levels') AS t(level int, min_points int, title text)
  WHERE r.active AND t.level <= v_level
  ORDER BY t.level DESC
  LIMIT 1;
  v_floor := COALESCE(v_floor, 0);

  -- La projection peut ne pas exister : elle est créée neutre (saison 0,
  -- compétences 0), jamais enrichie d'une saison ou d'une compétence inventée.
  INSERT INTO public.user_progression (user_id, lifetime_points, season_points, level, level_title)
  SELECT p_user_id, 0, 0, lv.level, lv.level_title
  FROM public.progression_level_for(0) lv
  ON CONFLICT (user_id) DO NOTHING;

  -- Jamais de baisse d'un cumul existant.
  UPDATE public.user_progression
  SET lifetime_points = GREATEST(lifetime_points, v_floor),
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING lifetime_points INTO v_after;

  UPDATE public.user_progression up
  SET level = lv.level, level_title = lv.level_title
  FROM public.progression_level_for(
    (SELECT lifetime_points FROM public.user_progression WHERE user_id = p_user_id)
  ) lv
  WHERE up.user_id = p_user_id;

  INSERT INTO public.progression_legacy_mapping
    (user_id, legacy_source, legacy_value, mapped_lifetime_points, mapping_version)
  VALUES (p_user_id, 'level', v_level, v_floor, v_version)
  ON CONFLICT (user_id, legacy_source, mapping_version) DO NOTHING;

  RETURN jsonb_build_object(
    'ok', true,
    'alreadyApplied', false,
    'mappingVersion', v_version,
    'legacyLevel', v_level,
    'legacyXp', v_xp,
    'mappedLifetimePoints', v_floor,
    'lifetimePoints', v_after
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_legacy_level_mapping(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_legacy_level_mapping(uuid, text) TO service_role;
