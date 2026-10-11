-- ============================================================================
-- T06 — Intention durable d'attribution, écrite atomiquement avec la source.
--
-- Une transition finale de source (session traitée, carnet publié, voyage
-- terminé, checklist complétée, débrief terrain, avis de lieu, préparation
-- depuis un sentier) écrit une intention unique dans la même transaction.
-- Une panne après le commit de source conserve l'intention ; le consommateur
-- (T07) revérifie la preuve côté serveur et délègue à l'attribution
-- canonique existante (`award_progression_gain`). Aucun montant, poids ou
-- point n'est porté par l'intention : uniquement la référence au fait.
--
-- Les demandes clientes best-effort restent un accélérateur facultatif ;
-- elles ne sont plus la seule source de vérité.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.progression_award_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  source_type text NOT NULL,
  source_id text NOT NULL,
  business_effective_at timestamptz NOT NULL DEFAULT now(),
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'processing', 'processed', 'refused', 'failed', 'dead')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  resolved_at timestamptz,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  reward_transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id)
);

CREATE INDEX IF NOT EXISTS progression_award_intents_pending_idx
  ON public.progression_award_intents (state, available_at)
  WHERE state IN ('pending', 'failed');

ALTER TABLE public.progression_award_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.progression_award_intents FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.progression_award_intents TO service_role;

-- Écriture d'intention : idempotente par réalisation, jamais de doublon.
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

-- ----------------------------------------------------------------------------
-- Capteurs de transition : l'intention est écrite dans la transaction de la
-- source. Chaque capteur ne fait qu'appeler l'enqueue idempotent.
-- ----------------------------------------------------------------------------

-- 1. Session de randonnée réellement traitée.
CREATE OR REPLACE FUNCTION public.progression_intent_hike_processed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.processing_status = 'processed' AND OLD.processing_status IS DISTINCT FROM 'processed' THEN
    PERFORM public.enqueue_progression_award_intent(
      NEW.user_id, 'hike_session_processed', 'hike_session', NEW.id::text,
      COALESCE(NEW.ended_at, now()));
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.progression_intent_hike_processed() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_prog_intent_hike ON public.hike_sessions;
CREATE TRIGGER trg_prog_intent_hike
  AFTER UPDATE ON public.hike_sessions
  FOR EACH ROW EXECUTE FUNCTION public.progression_intent_hike_processed();

-- 2. Carnet réellement publié (visibilité public/amis).
CREATE OR REPLACE FUNCTION public.progression_intent_carnet_published()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.visibility IN ('public', 'friends') AND NEW.author_id IS NOT NULL THEN
    PERFORM public.enqueue_progression_award_intent(
      NEW.author_id, 'carnet_published', 'carnet', NEW.id::text,
      COALESCE(NEW.updated_at, NEW.created_at, now()));
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.progression_intent_carnet_published() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_prog_intent_carnet ON public.carnets;
CREATE TRIGGER trg_prog_intent_carnet
  AFTER INSERT OR UPDATE ON public.carnets
  FOR EACH ROW EXECUTE FUNCTION public.progression_intent_carnet_published();

-- 3. Voyage réellement terminé.
CREATE OR REPLACE FUNCTION public.progression_intent_trip_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    PERFORM public.enqueue_progression_award_intent(
      NEW.user_id, 'trip_completed', 'trip', NEW.id::text,
      COALESCE(NEW.updated_at, now()));
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.progression_intent_trip_completed() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_prog_intent_trip ON public.trips;
CREATE TRIGGER trg_prog_intent_trip
  AFTER UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.progression_intent_trip_completed();

-- 4. Checklist de départ complétée (voyage en préparation, aucun item restant).
CREATE OR REPLACE FUNCTION public.progression_intent_checklist_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_trip_id uuid := COALESCE(NEW.trip_id, OLD.trip_id);
  v_trip RECORD; v_last_done timestamptz; v_remaining integer;
BEGIN
  IF v_trip_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT id, user_id, status INTO v_trip FROM public.trips WHERE id = v_trip_id;
  IF v_trip.id IS NULL OR v_trip.status NOT IN ('planned', 'active') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT count(*) INTO v_remaining
  FROM public.trip_checklist_items i
  WHERE i.trip_id = v_trip_id AND i.done IS NOT TRUE;
  IF v_remaining = 0 THEN
    SELECT max(i.done_at) INTO v_last_done
    FROM public.trip_checklist_items i
    WHERE i.trip_id = v_trip_id AND i.done IS TRUE;
    PERFORM public.enqueue_progression_award_intent(
      v_trip.user_id, 'checklist_completed', 'checklist', v_trip_id::text,
      COALESCE(v_last_done, now()));
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
REVOKE ALL ON FUNCTION public.progression_intent_checklist_completed() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_prog_intent_checklist ON public.trip_checklist_items;
CREATE TRIGGER trg_prog_intent_checklist
  AFTER INSERT OR UPDATE OR DELETE ON public.trip_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.progression_intent_checklist_completed();

-- 5. Débrief terrain du kit (rapport lié à une session traitée du même compte).
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
DROP TRIGGER IF EXISTS trg_prog_intent_kit_report ON public.kit_field_reports;
CREATE TRIGGER trg_prog_intent_kit_report
  AFTER INSERT ON public.kit_field_reports
  FOR EACH ROW EXECUTE FUNCTION public.progression_intent_kit_field_report();

-- 6. Avis de lieu publié (clé auteur:lieu, identique à l'attribution).
CREATE OR REPLACE FUNCTION public.progression_intent_place_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.author_id IS NOT NULL AND NEW.place_id IS NOT NULL THEN
    PERFORM public.enqueue_progression_award_intent(
      NEW.author_id, 'place_review', 'place_review',
      NEW.author_id::text || ':' || NEW.place_id::text, now());
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.progression_intent_place_review() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_prog_intent_place_review ON public.place_reviews;
CREATE TRIGGER trg_prog_intent_place_review
  AFTER INSERT ON public.place_reviews
  FOR EACH ROW EXECUTE FUNCTION public.progression_intent_place_review();

-- 7. Préparation d'aventure depuis un sentier : appelé par le service serveur
-- qui crée l'activité (`prepareActivityFromTrail`), clé identique à
-- l'attribution `trail_prep:<user>:<route>`.
