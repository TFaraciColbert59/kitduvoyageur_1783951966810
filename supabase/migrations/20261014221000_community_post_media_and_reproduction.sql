-- Additive, opt-in: existing community posts and immutable carnet snapshots remain unchanged.
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS media_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS linked_kit_id uuid REFERENCES public.materiel_kits(id) ON DELETE SET NULL;

ALTER TABLE public.community_posts
  DROP CONSTRAINT IF EXISTS community_posts_media_urls_array;
ALTER TABLE public.community_posts
  ADD CONSTRAINT community_posts_media_urls_array
  CHECK (jsonb_typeof(media_urls) = 'array' AND jsonb_array_length(media_urls) <= 10);

CREATE INDEX IF NOT EXISTS idx_community_posts_linked_kit ON public.community_posts(linked_kit_id)
  WHERE linked_kit_id IS NOT NULL;

-- Linked kits must be public, owned by the post author, and not changed after posting.
-- The fork endpoint enforces its own auth / public checks at import time.
CREATE OR REPLACE FUNCTION public.validate_community_post_shared_kit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.linked_kit_id IS DISTINCT FROM OLD.linked_kit_id THEN
    RAISE EXCEPTION 'A published kit link is immutable';
  END IF;
  IF TG_OP = 'UPDATE' THEN RETURN NEW; END IF;
  IF NEW.linked_kit_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.materiel_kits
    WHERE id = NEW.linked_kit_id AND user_id = NEW.author_id AND is_public = true
  ) THEN
    RAISE EXCEPTION 'The linked kit must be public and belong to the author';
  END IF;
  RETURN NEW;
END; $fn$;
DROP TRIGGER IF EXISTS trg_validate_community_post_shared_kit ON public.community_posts;
CREATE TRIGGER trg_validate_community_post_shared_kit
  BEFORE INSERT OR UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.validate_community_post_shared_kit();
