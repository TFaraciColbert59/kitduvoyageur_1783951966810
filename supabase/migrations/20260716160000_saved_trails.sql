-- saved_trails: simple trail bookmarking (separate from saved_adventures)
CREATE TABLE IF NOT EXISTS public.saved_trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  trail_id TEXT NOT NULL,
  trail_name TEXT,
  trail_data JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_trails_user_trail
  ON public.saved_trails (user_id, trail_id);

CREATE INDEX IF NOT EXISTS idx_saved_trails_user_id
  ON public.saved_trails (user_id);

ALTER TABLE public.saved_trails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_saved_trails" ON public.saved_trails;
CREATE POLICY "users_manage_own_saved_trails"
  ON public.saved_trails
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
