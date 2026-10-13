-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: F-032 — compteurs de clubs maintenus côté base (recount)
-- Chantier communauté (audit 2026-10-12) — P1 cohérence des compteurs
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Constat (audit F-032) : /clubs/[id] ajoutait/retirait les likes de sujets et
-- les participations d'événements de club puis réécrivait les compteurs depuis
-- une valeur locale — deux appareils concurrents pouvaient perdre un incrément,
-- et un échec de l'une des deux écritures laissait un compteur faux.
--
-- Correctif : recount autoritaire par trigger AFTER INSERT/DELETE.
-- Le client ne réécrit plus les compteurs (mise à jour optimiste côté UI
-- uniquement, rollback sur refus).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_club_topic_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_topic uuid := COALESCE(NEW.topic_id, OLD.topic_id);
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.club_topic_likes WHERE topic_id = v_topic;
  UPDATE public.club_topics SET likes_count = v_count WHERE id = v_topic;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_club_topic_replies_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_topic uuid := COALESCE(NEW.topic_id, OLD.topic_id);
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.club_topic_replies WHERE topic_id = v_topic;
  UPDATE public.club_topics SET replies_count = v_count WHERE id = v_topic;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_club_event_participants_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event uuid := COALESCE(NEW.event_id, OLD.event_id);
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.club_event_participants WHERE event_id = v_event;
  UPDATE public.club_events SET participants_count = v_count WHERE id = v_event;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_club_topic_likes_count ON public.club_topic_likes;
CREATE TRIGGER sync_club_topic_likes_count
  AFTER INSERT OR DELETE ON public.club_topic_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_club_topic_likes_count();

DROP TRIGGER IF EXISTS sync_club_topic_replies_count ON public.club_topic_replies;
CREATE TRIGGER sync_club_topic_replies_count
  AFTER INSERT OR DELETE ON public.club_topic_replies
  FOR EACH ROW EXECUTE FUNCTION public.sync_club_topic_replies_count();

DROP TRIGGER IF EXISTS sync_club_event_participants_count ON public.club_event_participants;
CREATE TRIGGER sync_club_event_participants_count
  AFTER INSERT OR DELETE ON public.club_event_participants
  FOR EACH ROW EXECUTE FUNCTION public.sync_club_event_participants_count();

-- Réconciliation des compteurs existants (dérive possible avant ce correctif).
UPDATE public.club_topics t
   SET likes_count = (SELECT count(*) FROM public.club_topic_likes l WHERE l.topic_id = t.id)
 WHERE likes_count IS DISTINCT FROM (SELECT count(*) FROM public.club_topic_likes l WHERE l.topic_id = t.id);

UPDATE public.club_topics t
   SET replies_count = (SELECT count(*) FROM public.club_topic_replies r WHERE r.topic_id = t.id)
 WHERE replies_count IS DISTINCT FROM (SELECT count(*) FROM public.club_topic_replies r WHERE r.topic_id = t.id);

UPDATE public.club_events e
   SET participants_count = (SELECT count(*) FROM public.club_event_participants p WHERE p.event_id = e.id)
 WHERE participants_count IS DISTINCT FROM (SELECT count(*) FROM public.club_event_participants p WHERE p.event_id = e.id);
