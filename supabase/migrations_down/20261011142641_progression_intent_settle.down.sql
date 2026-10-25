-- T09 — Retour arrière : retire le délai de stabilisation.
-- Les intentions déjà émises gardent leur available_at (aucune donnée
-- supprimée) ; seul le comportement futur revient à un délai nul.
DROP FUNCTION IF EXISTS public.enqueue_progression_award_intent(uuid, text, text, text, timestamptz, jsonb, integer);

CREATE OR REPLACE FUNCTION public.enqueue_progression_award_intent(
  p_user_id uuid,
  p_action_type text,
  p_source_type text,
  p_source_id text,
  p_business_effective_at timestamptz DEFAULT now(),
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_inserted integer;
BEGIN
  IF p_user_id IS NULL OR p_action_type IS NULL OR p_source_type IS NULL OR p_source_id IS NULL THEN
    RAISE EXCEPTION 'intention incomplète';
  END IF;
  INSERT INTO public.progression_award_intents
    (user_id, action_type, source_type, source_id, business_effective_at, metadata)
  VALUES
    (p_user_id, p_action_type, p_source_type, p_source_id,
     COALESCE(p_business_effective_at, now()), COALESCE(p_metadata, '{}'::jsonb))
  ON CONFLICT (source_type, source_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted > 0;
END $$;

REVOKE ALL ON FUNCTION public.enqueue_progression_award_intent(uuid, text, text, text, timestamptz, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_progression_award_intent(uuid, text, text, text, timestamptz, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.progression_intent_kit_field_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_session RECORD;
BEGIN
  IF NEW.hike_session_id IS NULL THEN RETURN NEW; END IF;
  SELECT user_id, processing_status INTO v_session
  FROM public.hike_sessions WHERE id = NEW.hike_session_id;
  IF v_session.user_id IS NOT NULL
     AND v_session.user_id = NEW.user_id
     AND v_session.processing_status = 'processed' THEN
    PERFORM public.enqueue_progression_award_intent(
      NEW.user_id, 'kit_field_report', 'kit_report', NEW.hike_session_id::text, now());
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.progression_intent_kit_field_report() FROM PUBLIC, anon, authenticated;
