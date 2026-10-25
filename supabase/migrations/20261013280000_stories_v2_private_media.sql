-- ═══════════════════════════════════════════════════════════════════════════
-- STORIES V2 — Phase 01 (P0) : média privé, ACL centrales, compat legacy
-- Chantier parité Instagram — ADR-017 — appliquée en production via MCP le
-- 2026-10-13 (SQL idempotent : rejouable sans effet par `supabase db push`).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- P0 : le bucket `carnet-media` est PUBLIC → une URL distribuée contourne toute
-- règle de visibilité. Les nouvelles stories vont dans `stories-private`
-- (privé) et ne sont servies que par /api/stories/:id/media après contrôle
-- `can_view_story()` (RLS réutilisée). Compat : les lignes legacy gardent
-- image_url ; media_type='image' par défaut ; aucune URL supprimée.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.post_stories
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS storage_bucket text,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS width int,
  ADD COLUMN IF NOT EXISTS height int,
  ADD COLUMN IF NOT EXISTS duration_ms int,
  ADD COLUMN IF NOT EXISTS poster_path text,
  ADD COLUMN IF NOT EXISTS composition_version int,
  ADD COLUMN IF NOT EXISTS composition jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS client_request_id text,
  ADD COLUMN IF NOT EXISTS reply_policy text NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS allow_reshare boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS moderation_state text NOT NULL DEFAULT 'visible',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.post_stories ALTER COLUMN image_url DROP NOT NULL;

ALTER TABLE public.post_stories DROP CONSTRAINT IF EXISTS post_stories_visibility_check;
ALTER TABLE public.post_stories ADD CONSTRAINT post_stories_visibility_check
  CHECK (visibility IN ('public', 'followers', 'close_friends', 'club', 'only_me'));

ALTER TABLE public.post_stories DROP CONSTRAINT IF EXISTS post_stories_media_type_check;
ALTER TABLE public.post_stories ADD CONSTRAINT post_stories_media_type_check
  CHECK (media_type IN ('image', 'video', 'text'));

ALTER TABLE public.post_stories DROP CONSTRAINT IF EXISTS post_stories_status_check;
ALTER TABLE public.post_stories ADD CONSTRAINT post_stories_status_check
  CHECK (status IN ('processing', 'ready', 'failed', 'removed'));

ALTER TABLE public.post_stories DROP CONSTRAINT IF EXISTS post_stories_moderation_state_check;
ALTER TABLE public.post_stories ADD CONSTRAINT post_stories_moderation_state_check
  CHECK (moderation_state IN ('visible', 'under_review', 'removed'));

ALTER TABLE public.post_stories DROP CONSTRAINT IF EXISTS post_stories_reply_policy_check;
ALTER TABLE public.post_stories ADD CONSTRAINT post_stories_reply_policy_check
  CHECK (reply_policy IN ('everyone', 'followers', 'off'));

ALTER TABLE public.post_stories DROP CONSTRAINT IF EXISTS post_stories_duration_check;
ALTER TABLE public.post_stories ADD CONSTRAINT post_stories_duration_check
  CHECK (duration_ms IS NULL OR (duration_ms > 0 AND duration_ms <= 60000));

ALTER TABLE public.post_stories DROP CONSTRAINT IF EXISTS post_stories_storage_pair_check;
ALTER TABLE public.post_stories ADD CONSTRAINT post_stories_storage_pair_check
  CHECK ((storage_bucket IS NULL) = (storage_path IS NULL));

CREATE UNIQUE INDEX IF NOT EXISTS post_stories_client_request_idx
  ON public.post_stories (author_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

-- ── Amis proches / masqués (nécessaires à can_view_story) ────────────────────
CREATE TABLE IF NOT EXISTS public.story_close_friends (
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, friend_id),
  CONSTRAINT story_close_friends_no_self CHECK (owner_id <> friend_id)
);
ALTER TABLE public.story_close_friends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS story_close_friends_owner_all ON public.story_close_friends;
CREATE POLICY story_close_friends_owner_all ON public.story_close_friends
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid() AND NOT public.is_anonymous_session());
REVOKE ALL ON public.story_close_friends FROM anon;
GRANT SELECT, INSERT, DELETE ON public.story_close_friends TO authenticated;

CREATE TABLE IF NOT EXISTS public.story_hidden_users (
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hidden_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, hidden_user_id),
  CONSTRAINT story_hidden_users_no_self CHECK (owner_id <> hidden_user_id)
);
ALTER TABLE public.story_hidden_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS story_hidden_users_owner_all ON public.story_hidden_users;
CREATE POLICY story_hidden_users_owner_all ON public.story_hidden_users
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid() AND NOT public.is_anonymous_session());
REVOKE ALL ON public.story_hidden_users FROM anon;
GRANT SELECT, INSERT, DELETE ON public.story_hidden_users TO authenticated;

-- ── Contrôle d'accès central : can_view_story(story, viewer) ────────────────
CREATE OR REPLACE FUNCTION public.can_view_story(p_story_id uuid, p_viewer uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.post_stories s
    WHERE s.id = p_story_id
      AND p_viewer IS NOT NULL
      AND s.status <> 'removed'
      AND s.moderation_state <> 'removed'
      AND (
        s.author_id = p_viewer -- l'auteur voit toujours sa story (archive incluse)
        OR (
          s.expires_at > now()
          AND NOT EXISTS (
            SELECT 1 FROM public.user_blocks b
            WHERE (b.blocker_id = s.author_id AND b.blocked_id = p_viewer)
               OR (b.blocker_id = p_viewer AND b.blocked_id = s.author_id)
          )
          AND NOT EXISTS (
            SELECT 1 FROM public.story_hidden_users h
            WHERE h.owner_id = s.author_id AND h.hidden_user_id = p_viewer
          )
          AND CASE s.visibility
            WHEN 'public' THEN true
            WHEN 'followers' THEN EXISTS (
              SELECT 1 FROM public.user_follows f
              WHERE f.follower_id = p_viewer AND f.following_id = s.author_id
            )
            WHEN 'close_friends' THEN EXISTS (
              SELECT 1 FROM public.story_close_friends cf
              WHERE cf.owner_id = s.author_id AND cf.friend_id = p_viewer
            )
            WHEN 'club' THEN s.club_id IS NOT NULL AND public.is_club_member(s.club_id, p_viewer)
            ELSE false
          END
        )
      )
  );
$$;
COMMENT ON FUNCTION public.can_view_story(uuid, uuid) IS
  'Stories V2 : source unique d''autorisation lecture (RLS + /api/stories/:id/media).';
REVOKE ALL ON FUNCTION public.can_view_story(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_story(uuid, uuid) TO authenticated;

-- ── RLS lecture unifiée + insertion multi-audiences ─────────────────────────
DROP POLICY IF EXISTS stories_read_public ON public.post_stories;
DROP POLICY IF EXISTS stories_read_own ON public.post_stories;
DROP POLICY IF EXISTS stories_read_club ON public.post_stories;
DROP POLICY IF EXISTS stories_read_visible ON public.post_stories;
CREATE POLICY stories_read_visible ON public.post_stories
  FOR SELECT TO authenticated
  USING (public.can_view_story(id, auth.uid()));

DROP POLICY IF EXISTS stories_insert_own ON public.post_stories;
CREATE POLICY stories_insert_own ON public.post_stories
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (visibility <> 'club' OR (club_id IS NOT NULL AND public.is_club_member(club_id, auth.uid())))
  );

-- ── Bucket privé + policies storage (chemin {uid}/{storyId}/{fichier}) ──────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'stories-private', 'stories-private', false, 26214400,
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/quicktime','video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "stories-private upload propriétaire" ON storage.objects;
CREATE POLICY "stories-private upload propriétaire" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'stories-private'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND NOT public.is_anonymous_session()
  );

DROP POLICY IF EXISTS "stories-private lecture propriétaire" ON storage.objects;
CREATE POLICY "stories-private lecture propriétaire" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'stories-private' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "stories-private suppression propriétaire" ON storage.objects;
CREATE POLICY "stories-private suppression propriétaire" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'stories-private' AND (storage.foldername(name))[1] = auth.uid()::text);

COMMENT ON TABLE public.post_stories IS
  'Stories 24 h — une slide = une ligne. Legacy : image_url publique ; V2 : storage_bucket/storage_path privés servis par /api/stories/:id/media.';
