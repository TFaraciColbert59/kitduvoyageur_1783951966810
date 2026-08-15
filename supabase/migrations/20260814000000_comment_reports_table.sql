-- ============================================================
-- Comment reports table (used by CommentItem across the app)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.comment_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL,
  reporter_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reason TEXT DEFAULT 'Propos inappropriés',
  table_name TEXT NOT NULL DEFAULT 'post_comments',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comment_reports_comment ON public.comment_reports(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reports_status ON public.comment_reports(status);

ALTER TABLE public.comment_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comment_reports_insert_own" ON public.comment_reports;
CREATE POLICY "comment_reports_insert_own" ON public.comment_reports
  FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "comment_reports_select" ON public.comment_reports;
CREATE POLICY "comment_reports_select" ON public.comment_reports
  FOR SELECT TO public USING (true);
