-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: A-124 — annulation d'événement (état, gardes, compteurs)
-- Chantier communauté (audit 2026-10-12) — P1 sorties
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Constat (audit A-124) : les événements ne connaissaient que
-- upcoming/full/past — une sortie annulée restait inscriptible et le
-- recount des participants pouvait ressusciter un statut « ouvert ».
--
-- Correctif : ajout de l'état `cancelled` ; l'inscription (RPC et voie
-- directe) est refusée sur un événement annulé ; le recount ne réécrit ni
-- `past` ni `cancelled`. L'organisateur bascule l'état via la policy
-- `auth_update_events` existante.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_status_check CHECK (status IN ('upcoming', 'full', 'past', 'cancelled'));

-- ── Inscription : refus si annulé (RPC) ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.join_event(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
  v_max integer;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentification requise' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(current_participants, 0), COALESCE(max_participants, 0), status
    INTO v_count, v_max, v_status
    FROM public.events
   WHERE id = p_event_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'événement introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_status = 'past' THEN
    RAISE EXCEPTION 'événement terminé' USING ERRCODE = 'P0001';
  END IF;
  IF v_status = 'cancelled' THEN
    RAISE EXCEPTION 'événement annulé' USING ERRCODE = 'P0001';
  END IF;
  IF v_max > 0 AND v_count >= v_max THEN
    RAISE EXCEPTION 'événement complet' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.event_participants (event_id, user_id)
  VALUES (p_event_id, v_uid)
  ON CONFLICT (event_id, user_id) DO NOTHING;

  IF FOUND THEN
    v_count := v_count + 1;
    v_status := CASE WHEN v_max > 0 AND v_count >= v_max THEN 'full' ELSE 'upcoming' END;
    UPDATE public.events
       SET current_participants = v_count,
           status = v_status
     WHERE id = p_event_id;
  ELSE
    v_status := COALESCE(v_status, 'upcoming');
  END IF;

  RETURN jsonb_build_object(
    'registered', true,
    'current_participants', v_count,
    'status', v_status
  );
END;
$function$;

-- ── Inscription : refus si annulé (voie directe, garde du trigger) ─────────
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
  IF v_status = 'cancelled' THEN
    RAISE EXCEPTION 'événement annulé' USING ERRCODE = 'P0001';
  END IF;
  IF v_max > 0 AND v_count >= v_max THEN
    RAISE EXCEPTION 'événement complet' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

-- ── Recount : ne ressuscite jamais un événement annulé ou passé ────────────
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
     AND status NOT IN ('past', 'cancelled');

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.guard_event_participant_insert() IS
  'F-008 + A-124 : capacité/statut (terminé, annulé, complet) vérifiés à l''insertion, quel que soit le chemin.';
