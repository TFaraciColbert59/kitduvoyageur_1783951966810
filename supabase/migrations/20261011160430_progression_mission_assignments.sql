-- ============================================================================
-- T13 — Trois missions choisies (assignations utilisateur).
--
-- Réutilise le catalogue versionné (`missionCatalog.ts`) et la publication
-- `progression_challenge_models` : seuls les modèles PUBLIÉS (producteurs
-- disponibles) peuvent être choisis. L'ancien `current_challenge_id` reste
-- lisible (compatibilité) ; rien n'est supprimé.
--
-- Garanties serveur :
--   • maximum 3 missions actives, vérifié sous verrou par utilisateur ;
--   • remplacement/abandon sans perte d'XP ni dette (aucune écriture XP ici) ;
--   • chaque opération est scopée `user_id` : un compte ne peut ni lire ni
--     modifier les missions d'un autre (les fonctions refusent).
-- Exécution : service_role uniquement.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.progression_mission_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  model_id text NOT NULL,
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'replaced', 'abandoned')),
  target_count integer NOT NULL DEFAULT 1 CHECK (target_count >= 1),
  period text NOT NULL DEFAULT 'ever' CHECK (period IN ('ever', 'week', 'season')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS progression_mission_assignments_user_idx
  ON public.progression_mission_assignments (user_id, state);

ALTER TABLE public.progression_mission_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.progression_mission_assignments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.progression_mission_assignments TO service_role;

-- Un modèle n'est sélectionnable que s'il est publié (producteur disponible).
CREATE OR REPLACE FUNCTION public.is_published_mission_model(p_model_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.progression_challenge_models m
    WHERE m.model_id = p_model_id AND m.provenance = 'canonical_v2'
  );
$$;
REVOKE ALL ON FUNCTION public.is_published_mission_model(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_published_mission_model(text) TO service_role;

-- Choix : maximum 3 actives, verrou par utilisateur, modèle publié exigé.
CREATE OR REPLACE FUNCTION public.choose_progression_mission(
  p_user_id uuid,
  p_model_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_active integer; v_id uuid;
BEGIN
  IF NOT public.is_published_mission_model(p_model_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'modele_non_publie');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('missions:' || p_user_id::text, 0));
  SELECT count(*) INTO v_active FROM public.progression_mission_assignments
    WHERE user_id = p_user_id AND state = 'active';
  IF v_active >= 3 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'limite_atteinte');
  END IF;
  INSERT INTO public.progression_mission_assignments (user_id, model_id)
  VALUES (p_user_id, p_model_id)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'assignmentId', v_id);
END $$;
REVOKE ALL ON FUNCTION public.choose_progression_mission(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.choose_progression_mission(uuid, text) TO service_role;

-- Remplacement : marque l'ancienne puis crée la nouvelle dans la même transaction.
CREATE OR REPLACE FUNCTION public.replace_progression_mission(
  p_user_id uuid,
  p_assignment_id uuid,
  p_model_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_published_mission_model(p_model_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'modele_non_publie');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('missions:' || p_user_id::text, 0));
  UPDATE public.progression_mission_assignments
    SET state = 'replaced', resolved_at = now()
    WHERE id = p_assignment_id AND user_id = p_user_id AND state = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'assignation_introuvable');
  END IF;
  INSERT INTO public.progression_mission_assignments (user_id, model_id)
  VALUES (p_user_id, p_model_id)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'assignmentId', v_id);
END $$;
REVOKE ALL ON FUNCTION public.replace_progression_mission(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_progression_mission(uuid, uuid, text) TO service_role;

-- Abandon : sans perte d'XP ni dette (aucune écriture de progression ici).
CREATE OR REPLACE FUNCTION public.abandon_progression_mission(
  p_user_id uuid,
  p_assignment_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public.progression_mission_assignments
    SET state = 'abandoned', resolved_at = now()
    WHERE id = p_assignment_id AND user_id = p_user_id AND state = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'assignation_introuvable');
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.abandon_progression_mission(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.abandon_progression_mission(uuid, uuid) TO service_role;
