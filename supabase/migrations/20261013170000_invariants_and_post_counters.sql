-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: A-211 + A-212 — invariants de références + compteur de likes du fil
-- Chantier communauté (audit 2026-10-12) — P1 intégrité des données
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A-211 : une référence valide techniquement ne doit pas pouvoir lier un
-- contenu extérieur :
--   - `post_comments.parent_id` doit désigner un commentaire DU MÊME post ;
--   - `messages.reply_to_id` doit désigner un message DE LA MÊME conversation.
--
-- A-212 : `community_posts.likes_count` était maintenu uniquement par la RPC
-- « toggle » — une insertion directe dans post_likes (policy ALL personnelle
-- existante) laissait le compteur faux. Recount autoritaire + réconciliation.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── A-211 / post_comments ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_post_comment_parent_same_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parent_post uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT post_id INTO v_parent_post
    FROM public.post_comments
   WHERE id = NEW.parent_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'post_comments : commentaire parent introuvable' USING ERRCODE = 'P0002';
  END IF;

  IF v_parent_post IS DISTINCT FROM NEW.post_id THEN
    RAISE EXCEPTION 'post_comments : le parent doit appartenir au même post'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_post_comment_parent_same_post ON public.post_comments;
CREATE TRIGGER guard_post_comment_parent_same_post
  BEFORE INSERT OR UPDATE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.guard_post_comment_parent_same_post();

-- ── A-211 / messages ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_message_reply_same_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reply_conversation uuid;
BEGIN
  IF NEW.reply_to_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT conversation_id INTO v_reply_conversation
    FROM public.messages
   WHERE id = NEW.reply_to_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'messages : message cité introuvable' USING ERRCODE = 'P0002';
  END IF;

  IF v_reply_conversation IS DISTINCT FROM NEW.conversation_id THEN
    RAISE EXCEPTION 'messages : la réponse doit citer un message de la même conversation'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_message_reply_same_conversation ON public.messages;
CREATE TRIGGER guard_message_reply_same_conversation
  BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_message_reply_same_conversation();

-- ── A-212 / recount des likes du fil ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_community_post_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_post uuid := COALESCE(NEW.post_id, OLD.post_id);
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.post_likes WHERE post_id = v_post;
  UPDATE public.community_posts SET likes_count = v_count WHERE id = v_post;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_community_post_likes_count ON public.post_likes;
CREATE TRIGGER sync_community_post_likes_count
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_community_post_likes_count();

-- Réconciliation des compteurs existants (dérive possible avant ce correctif).
UPDATE public.community_posts p
   SET likes_count = (SELECT count(*) FROM public.post_likes l WHERE l.post_id = p.id)
 WHERE p.likes_count IS DISTINCT FROM (SELECT count(*) FROM public.post_likes l WHERE l.post_id = p.id);

COMMENT ON FUNCTION public.guard_post_comment_parent_same_post() IS
  'A-211 : le parent d''un commentaire appartient obligatoirement au même post.';
COMMENT ON FUNCTION public.guard_message_reply_same_conversation() IS
  'A-211 : une réponse cite obligatoirement un message de la même conversation.';
COMMENT ON FUNCTION public.sync_community_post_likes_count() IS
  'A-212 : recount autoritaire de community_posts.likes_count à chaque like/délike.';
