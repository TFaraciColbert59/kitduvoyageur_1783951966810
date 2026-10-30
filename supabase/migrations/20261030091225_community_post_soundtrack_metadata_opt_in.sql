-- Applied in Supabase on 2026-10-30. Optional metadata only: no automatic audio.
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS soundtrack_url text,
  ADD COLUMN IF NOT EXISTS soundtrack_title text,
  ADD COLUMN IF NOT EXISTS soundtrack_creator text,
  ADD COLUMN IF NOT EXISTS soundtrack_source_url text;

COMMENT ON COLUMN public.community_posts.soundtrack_url IS
  'Optional user-triggered audio URL. No automatic playback, no implicit licensing.';
COMMENT ON COLUMN public.community_posts.soundtrack_source_url IS
  'Original audio file license/source page; required by LKDV demo curation process.';
