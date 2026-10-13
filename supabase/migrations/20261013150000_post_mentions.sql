-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: F-022 — mentions structurées (IDs) + notifications serveur
-- Chantier communauté (audit 2026-10-12) — P1 composeur
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Constat (audit F-022) : les mentions étaient saisies librement et n'étaient
-- PAS utilisées dans le payload publié — mentionner quelqu'un ne produisait
-- strictement rien.
--
-- Correctif : colonne `mentions uuid[]` sur community_posts et club_topics ;
-- un trigger serveur AFTER INSERT crée une notification 'mention' pour chaque
-- personne mentionnée (jamais l'auteur, jamais un compte bloqué dans un sens
-- ou l'autre, jamais un id sans profil). Le client résout les noms saisis vers
-- des identifiants réels avant publication.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS mentions uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.club_topics
  ADD COLUMN IF NOT EXISTS mentions uuid[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.notify_post_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mentioned uuid;
  v_author uuid;
  v_label text;
  v_link text;
BEGIN
  v_author := COALESCE(NEW.author_id, auth.uid());
  v_label := CASE
    WHEN TG_TABLE_NAME = 'community_posts' THEN 'publication'
    ELSE 'discussion de club'
  END;
  v_link := CASE
    WHEN TG_TABLE_NAME = 'community_posts' THEN '/communaute?post=' || NEW.id::text
    ELSE '/clubs'
  END;

  FOR v_mentioned IN
    SELECT DISTINCT m
      FROM unnest(COALESCE(NEW.mentions, '{}'::uuid[])) AS m
     WHERE m IS NOT NULL
       AND m <> v_author
  LOOP
    -- La personne mentionnée doit exister (profil)…
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = v_mentioned) THEN
      CONTINUE;
    END IF;
    -- …et ne pas être bloquée dans un sens ou dans l'autre.
    IF EXISTS (
      SELECT 1 FROM public.user_blocks b
       WHERE (b.blocker_id = v_mentioned AND b.blocked_id = v_author)
          OR (b.blocker_id = v_author AND b.blocked_id = v_mentioned)
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, message, actor_id, related_type, related_id, link)
    VALUES (
      v_mentioned,
      'mention',
      'Vous êtes mentionné·e',
      'Dans une ' || v_label,
      v_author,
      CASE WHEN TG_TABLE_NAME = 'community_posts' THEN 'community_post' ELSE 'club_topic' END,
      NEW.id,
      v_link
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_post_mentions ON public.community_posts;
CREATE TRIGGER notify_post_mentions
  AFTER INSERT ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_mentions();

DROP TRIGGER IF EXISTS notify_club_topic_mentions ON public.club_topics;
CREATE TRIGGER notify_club_topic_mentions
  AFTER INSERT ON public.club_topics
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_mentions();

COMMENT ON FUNCTION public.notify_post_mentions() IS
  'F-022 : notifie chaque personne mentionnée (IDs résolus par le client), hors auteur, comptes bloqués et ids sans profil.';
