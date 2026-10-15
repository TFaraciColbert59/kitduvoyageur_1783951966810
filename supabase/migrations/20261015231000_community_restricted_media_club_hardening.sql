-- Additive, RLS-preserving guard: PUBLIC storage URLs cannot be private.
-- This migration requires validation in an ephemeral DB before any release.
CREATE OR REPLACE FUNCTION public.reject_public_media_on_restricted_post()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $guard$
BEGIN
  IF NEW.audience <> 'public' AND (
    NULLIF(btrim(coalesce(NEW.image_url, '')), '') IS NOT NULL
    OR jsonb_array_length(coalesce(NEW.media_urls, '[]'::jsonb)) > 0
    OR NEW.linked_carnet_id IS NOT NULL
    OR NEW.snapshot_payload IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Restricted Community posts cannot reference public media or snapshots'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$guard$;

DROP TRIGGER IF EXISTS trg_community_post_restricted_media ON public.community_posts;
CREATE TRIGGER trg_community_post_restricted_media
  BEFORE INSERT OR UPDATE OF audience, image_url, media_urls, linked_carnet_id, snapshot_payload
  ON public.community_posts FOR EACH ROW
  EXECUTE FUNCTION public.reject_public_media_on_restricted_post();

REVOKE ALL ON FUNCTION public.reject_public_media_on_restricted_post() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_public_media_on_restricted_post() TO authenticated, service_role;

-- Existing FOR ALL owner policies might otherwise bypass parent audience
-- protection for comments and reactions. RESTRICTIVE policies compose as AND.
DROP POLICY IF EXISTS post_comments_parent_visibility_guard ON public.post_comments;
CREATE POLICY post_comments_parent_visibility_guard AS RESTRICTIVE
  ON public.post_comments FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.community_posts p WHERE p.id = post_comments.post_id
  ));

DROP POLICY IF EXISTS post_likes_parent_visibility_guard ON public.post_likes;
CREATE POLICY post_likes_parent_visibility_guard AS RESTRICTIVE
  ON public.post_likes FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.community_posts p WHERE p.id = post_likes.post_id
  ));

DROP POLICY IF EXISTS post_comment_likes_parent_visibility_guard ON public.post_comment_likes;
CREATE POLICY post_comment_likes_parent_visibility_guard AS RESTRICTIVE
  ON public.post_comment_likes FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.post_comments c WHERE c.id = post_comment_likes.comment_id
  ));

-- Legacy club_topics used public SELECT on is_approved regardless of a
-- closed/secret club. Preserve public club topics, restrict closed/secret.
DROP POLICY IF EXISTS club_topics_parent_privacy_guard ON public.club_topics;
CREATE POLICY club_topics_parent_privacy_guard AS RESTRICTIVE
  ON public.club_topics FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.id = club_topics.club_id
      AND (
        c.privacy IS NULL OR c.privacy = 'open'
        OR c.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.club_members cm
          WHERE cm.club_id = c.id AND cm.user_id = auth.uid() AND cm.status = 'active'
        )
      )
  ));


-- Child rows historically had unconditional public SELECT policies.
-- Their SELECT must inherit the parent's full visibility checks.
DROP POLICY IF EXISTS club_topic_replies_parent_visibility_guard ON public.club_topic_replies;
CREATE POLICY club_topic_replies_parent_visibility_guard AS RESTRICTIVE
  ON public.club_topic_replies FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.club_topics t WHERE t.id = club_topic_replies.topic_id
  ));

DROP POLICY IF EXISTS club_topic_likes_parent_visibility_guard ON public.club_topic_likes;
CREATE POLICY club_topic_likes_parent_visibility_guard AS RESTRICTIVE
  ON public.club_topic_likes FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.club_topics t WHERE t.id = club_topic_likes.topic_id
  ));


-- Hidden posts must not accept comments or likes by ID enumeration.
-- These restrictive INSERT policies AND together with legacy owner and
-- anonymous-session policies, preserving existing auth rules.
DROP POLICY IF EXISTS post_comments_visible_parent_insert_guard ON public.post_comments;
CREATE POLICY post_comments_visible_parent_insert_guard AS RESTRICTIVE
  ON public.post_comments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.community_posts p WHERE p.id = post_comments.post_id
  ));

DROP POLICY IF EXISTS post_likes_visible_parent_insert_guard ON public.post_likes;
CREATE POLICY post_likes_visible_parent_insert_guard AS RESTRICTIVE
  ON public.post_likes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.community_posts p WHERE p.id = post_likes.post_id
  ));

DROP POLICY IF EXISTS post_comment_likes_visible_parent_insert_guard ON public.post_comment_likes;
CREATE POLICY post_comment_likes_visible_parent_insert_guard AS RESTRICTIVE
  ON public.post_comment_likes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.post_comments c WHERE c.id = post_comment_likes.comment_id
  ));

DROP POLICY IF EXISTS club_topic_replies_visible_parent_insert_guard ON public.club_topic_replies;
CREATE POLICY club_topic_replies_visible_parent_insert_guard AS RESTRICTIVE
  ON public.club_topic_replies FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.club_topics t WHERE t.id = club_topic_replies.topic_id
  ));

DROP POLICY IF EXISTS club_topic_likes_visible_parent_insert_guard ON public.club_topic_likes;
CREATE POLICY club_topic_likes_visible_parent_insert_guard AS RESTRICTIVE
  ON public.club_topic_likes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.club_topics t WHERE t.id = club_topic_likes.topic_id
  ));
