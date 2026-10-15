-- PRIVATE SOCIAL POSTS: audience must be enforced in PostgreSQL, never just in a React selector.
-- This migration is additive and must be applied to a TEST DB with pgTAP before production.
-- Historic posts default to 'public' (they were already readable to everyone).
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES public.clubs(id) ON DELETE SET NULL;

ALTER TABLE public.community_posts
  DROP CONSTRAINT IF EXISTS community_posts_audience_allowed;
ALTER TABLE public.community_posts
  ADD CONSTRAINT community_posts_audience_allowed
  CHECK (audience IN ('public', 'abonnies', 'club'));

CREATE INDEX IF NOT EXISTS community_posts_audience_club_index
  ON public.community_posts(club_id) WHERE audience = 'club';

-- A club post must come from a current member. Check this using the caller's
-- permissions, not service_role. No "audience=club, club_id=null" leaks.
CREATE OR REPLACE FUNCTION public.validate_community_post_audience()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public, pg_temp AS $guard$
BEGIN
  IF NEW.audience = 'club' THEN
    IF NEW.club_id IS NULL
      OR NEW.author_id IS DISTINCT FROM auth.uid()
      OR NOT EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.club_id = NEW.club_id AND cm.user_id = NEW.author_id AND cm.status = 'active'
      ) THEN
      RAISE EXCEPTION 'Cannot publish to a club without active membership';
    END IF;
  ELSIF NEW.club_id IS NOT NULL THEN
    RAISE EXCEPTION 'Club must be null for non-club audience';
  END IF;
  RETURN NEW;
END;
$guard$;

DROP TRIGGER IF EXISTS trg_community_post_audience ON public.community_posts;
CREATE TRIGGER trg_community_post_audience
  BEFORE INSERT OR UPDATE OF audience, club_id, author_id
  ON public.community_posts FOR EACH ROW
  EXECUTE FUNCTION public.validate_community_post_audience();

REVOKE ALL ON FUNCTION public.validate_community_post_audience() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_community_post_audience() TO authenticated, service_role;

-- CRITICAL: old policy "public_read_community_posts USING (true)" exposed
-- posts irrespective of audience. RLS policies are ORed; DROP the old one.
DROP POLICY IF EXISTS public_read_community_posts ON public.community_posts;
DROP POLICY IF EXISTS community_posts_select_audience ON public.community_posts;
CREATE POLICY community_posts_select_audience ON public.community_posts
FOR SELECT TO public USING (
  (
  audience = 'public'
  OR (auth.uid() IS NOT NULL AND author_id = auth.uid())
  OR (
    audience = 'abonnies'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_follows uf
      WHERE uf.following_id = community_posts.author_id AND uf.follower_id = auth.uid()
    )
  )
  OR (
    audience = 'club'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = community_posts.club_id
        AND cm.user_id = auth.uid() AND cm.status = 'active'
    )
  )
  )
  -- Block relationships take precedence over a follow or club membership.
  -- Anonymous public viewing is intentionally unchanged (auth.uid() = NULL).
  AND (
    auth.uid() IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = community_posts.author_id)
         OR (b.blocked_id = auth.uid() AND b.blocker_id = community_posts.author_id)
    )
  )
);

-- Related public SELECT policies must not let callers infer text or users from
-- hidden posts. Owner management policies remain unchanged.
DROP POLICY IF EXISTS public_read_post_comments ON public.post_comments;
DROP POLICY IF EXISTS post_comments_select_audience ON public.post_comments;
CREATE POLICY post_comments_select_audience ON public.post_comments
FOR SELECT TO public USING (
  EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = post_comments.post_id)
);

DROP POLICY IF EXISTS public_read_post_likes ON public.post_likes;
DROP POLICY IF EXISTS post_likes_select_audience ON public.post_likes;
CREATE POLICY post_likes_select_audience ON public.post_likes
FOR SELECT TO public USING (
  EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = post_likes.post_id)
);

DROP POLICY IF EXISTS post_comment_likes_read ON public.post_comment_likes;
DROP POLICY IF EXISTS post_comment_likes_select_audience ON public.post_comment_likes;
CREATE POLICY post_comment_likes_select_audience ON public.post_comment_likes
FOR SELECT TO public USING (
  EXISTS (SELECT 1 FROM public.post_comments c WHERE c.id = post_comment_likes.comment_id)
);

-- Do NOT call this migration proof of secure private MEDIA: existing bucket
-- "carnet-media" uses public URLs. The publisher refuses restricted media
-- until an authenticated signed-media pipeline has been implemented.
