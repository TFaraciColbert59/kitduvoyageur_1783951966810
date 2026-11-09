-- Rollback de la PHASE 2 Communauté v2 (20261108130007) :
-- restauration exacte des corps précédents de join_event, leave_event,
-- guard_event_participant_insert, guard_event_participant_identity et
-- sync_event_participants_count, copiés depuis `pg_proc` de la production le
-- 2026-11-08 (avant réécriture). Aucune donnée n'est supprimée : la colonne
-- event_participants.status reste en place (c'est le lot C/phase 1 qui la gère).
--
-- ⚠ Les événements passés en phase 2 avec des lignes `status = 'waitlist'`
-- conserveront ces lignes : elles ne seront simplement plus promues et
-- resteront exclues des compteurs par le corps d'origine ? NON — le corps
-- d'origine compte toutes les lignes. Ce .down doit donc être réservé au cas
-- « aucun usage réel de la liste d'attente » (06 § 3.5) ; sinon, garder la
-- phase 2 et seulement passer le drapeau V2 à false.

-- ── 1. join_event (corps d'origine) ───────────────────────────────────────
create or replace function public.join_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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

-- ── 2. leave_event (corps d'origine) ──────────────────────────────────────
create or replace function public.leave_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentification requise' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.event_participants
   WHERE event_id = p_event_id AND user_id = v_uid;

  IF FOUND THEN
    UPDATE public.events
       SET current_participants = GREATEST(COALESCE(current_participants, 1) - 1, 0),
           status = CASE WHEN status = 'full' THEN 'upcoming' ELSE status END
     WHERE id = p_event_id
    RETURNING current_participants, status INTO v_count, v_status;
  ELSE
    SELECT COALESCE(current_participants, 0), COALESCE(status, 'upcoming')
      INTO v_count, v_status
      FROM public.events
     WHERE id = p_event_id;
  END IF;

  IF v_count IS NULL THEN
    RAISE EXCEPTION 'événement introuvable' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'registered', false,
    'current_participants', v_count,
    'status', v_status
  );
END;
$function$;

-- ── 3. guard_event_participant_insert (corps d'origine) ───────────────────
create or replace function public.guard_event_participant_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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

comment on function public.guard_event_participant_insert() is
  'F-008 + A-124 : capacité/statut (terminé, annulé, complet) vérifiés à l''insertion, quel que soit le chemin.';

-- ── 4. guard_event_participant_identity (corps d'origine) ─────────────────
create or replace function public.guard_event_participant_identity()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
BEGIN
  IF NEW.event_id IS DISTINCT FROM OLD.event_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'event_participants: une inscription ne se déplace pas (quitter puis rejoindre)'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

-- ── 5. sync_event_participants_count (corps d'origine) ────────────────────
create or replace function public.sync_event_participants_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
