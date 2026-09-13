-- ============================================================
-- TRIBU Phase 7 — M12 : sessions de partage de position
-- ============================================================
-- Une session est ouverte explicitement (jamais automatique), bornee
-- (1 a 72 h) et unique par groupe. Elle survit comme trace minimale
-- (aucune position conservee) ; le cron ferme les sessions expirees.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.group_live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.travel_groups(id) ON DELETE CASCADE,
  started_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  stopped_at TIMESTAMPTZ
);

DO $$ BEGIN
  ALTER TABLE public.group_live_sessions
    ADD CONSTRAINT group_live_sessions_window
    CHECK (
      expires_at > started_at
      AND expires_at <= started_at + interval '72 hours'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_group_live_sessions_open
  ON public.group_live_sessions(group_id)
  WHERE stopped_at IS NULL;

ALTER TABLE public.group_live_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_sessions_read_member" ON public.group_live_sessions;
CREATE POLICY "live_sessions_read_member" ON public.group_live_sessions
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "live_sessions_start_own" ON public.group_live_sessions;
CREATE POLICY "live_sessions_start_own" ON public.group_live_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    started_by = auth.uid()
    AND public.is_group_member(group_id, auth.uid())
  );

DROP POLICY IF EXISTS "live_sessions_stop_own_or_manage" ON public.group_live_sessions;
CREATE POLICY "live_sessions_stop_own_or_manage" ON public.group_live_sessions
  FOR UPDATE TO authenticated
  USING (
    started_by = auth.uid()
    OR public.group_member_has_capability(group_id, auth.uid(), 'manage_members')
  )
  WITH CHECK (
    started_by = auth.uid()
    OR public.group_member_has_capability(group_id, auth.uid(), 'manage_members')
  );

GRANT SELECT, INSERT, UPDATE ON public.group_live_sessions TO authenticated, service_role;
