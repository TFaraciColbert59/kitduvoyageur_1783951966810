-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: F-008 — invariants d'inscription aux événements sur TOUS les chemins
-- Chantier communauté (audit 2026-10-12) — P0 capacité et compteurs
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Constat (audit F-008, statuts C + D) : le hub communauté écrivait un upsert
-- direct dans event_participants alors que /evenements passe par la RPC
-- atomique join_event (verrou d'événement + capacité + compteur). Deux
-- parcours, deux comportements.
--
-- Correctif (défense serveur, tous les chemins) :
--   1) BEFORE INSERT : capacité et statut vérifiés sous verrou — même une
--      insertion directe ne peut plus dépasser la capacité ni viser un
--      événement terminé ;
--   2) AFTER INSERT OR DELETE : recount autoritaire de current_participants
--      (le compteur ne peut pas dériver) et statut full/upcoming recalculé ;
--   3) BEFORE UPDATE : event_id et user_id immuables (« déplacer » une
--      inscription contournerait les compteurs des deux événements).
-- Le hub est basculé sur la RPC join_event côté client (même contrat + erreurs).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.guard_event_participant_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_max integer;
  v_count integer;
  v_status text;
BEGIN
  SELECT COALESCE(max_participants, 0), COALESCE(current_participants, 0), status
    INTO v_max, v_count, v_status
    FROM public.events
   WHERE id = NEW.event_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'événement introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_status = 'past' THEN
    RAISE EXCEPTION 'événement terminé' USING ERRCODE = 'P0001';
  END IF;
  IF v_max > 0 AND v_count >= v_max THEN
    RAISE EXCEPTION 'événement complet' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_event_participants_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event uuid := COALESCE(NEW.event_id, OLD.event_id);
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
    FROM public.event_participants
   WHERE event_id = v_event;

  UPDATE public.events
     SET current_participants = v_count,
         status = CASE
           WHEN COALESCE(max_participants, 0) > 0 AND v_count >= max_participants THEN 'full'
           ELSE 'upcoming'
         END
   WHERE id = v_event
     AND status <> 'past';

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_event_participant_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.event_id IS DISTINCT FROM OLD.event_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'event_participants: une inscription ne se déplace pas (quitter puis rejoindre)'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_event_participant_insert ON public.event_participants;
CREATE TRIGGER guard_event_participant_insert
  BEFORE INSERT ON public.event_participants
  FOR EACH ROW EXECUTE FUNCTION public.guard_event_participant_insert();

DROP TRIGGER IF EXISTS sync_event_participants_count ON public.event_participants;
CREATE TRIGGER sync_event_participants_count
  AFTER INSERT OR DELETE ON public.event_participants
  FOR EACH ROW EXECUTE FUNCTION public.sync_event_participants_count();

DROP TRIGGER IF EXISTS guard_event_participant_identity ON public.event_participants;
CREATE TRIGGER guard_event_participant_identity
  BEFORE UPDATE ON public.event_participants
  FOR EACH ROW EXECUTE FUNCTION public.guard_event_participant_identity();

COMMENT ON FUNCTION public.guard_event_participant_insert() IS
  'F-008 : capacité et statut vérifiés à l''insertion, quel que soit le chemin (direct ou RPC).';
COMMENT ON FUNCTION public.sync_event_participants_count() IS
  'F-008 : recount autoritaire de events.current_participants et du statut full/upcoming.';
