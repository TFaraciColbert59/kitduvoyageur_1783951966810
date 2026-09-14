-- ============================================================
-- TRIBU Phase 7 — M13 : positions live (une seule par membre/session)
-- ============================================================
-- Zero historique : la derniere position ecrase la precedente (PK
-- session+user) et disparait a l'arret ou a l'expiration (cron).
-- Lecture reservee aux membres du groupe, session ouverte et
-- positions non expirees.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.group_live_positions (
  session_id UUID NOT NULL REFERENCES public.group_live_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy_m NUMERIC,
  heading NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (session_id, user_id)
);

DO $$ BEGIN
  ALTER TABLE public.group_live_positions
    ADD CONSTRAINT group_live_positions_lat_check
    CHECK (lat >= -90 AND lat <= 90);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.group_live_positions
    ADD CONSTRAINT group_live_positions_lng_check
    CHECK (lng >= -180 AND lng <= 180);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.group_live_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_positions_read_member_open_session" ON public.group_live_positions;
CREATE POLICY "live_positions_read_member_open_session" ON public.group_live_positions
  FOR SELECT TO authenticated
  USING (
    (
      user_id = auth.uid()
      OR expires_at > now()
    )
    AND EXISTS (
      SELECT 1 FROM public.group_live_sessions s
      WHERE s.id = session_id
        AND s.stopped_at IS NULL
        AND s.expires_at > now()
        AND public.is_group_member(s.group_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "live_positions_share_own" ON public.group_live_positions;
CREATE POLICY "live_positions_share_own" ON public.group_live_positions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND expires_at > now()
    AND expires_at <= now() + interval '15 minutes'
    AND EXISTS (
      SELECT 1 FROM public.group_live_sessions s
      WHERE s.id = session_id
        AND s.stopped_at IS NULL
        AND s.expires_at > now()
        AND public.is_group_member(s.group_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "live_positions_update_own" ON public.group_live_positions;
CREATE POLICY "live_positions_update_own" ON public.group_live_positions
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.group_live_sessions s
      WHERE s.id = session_id
        AND s.stopped_at IS NULL
        AND s.expires_at > now()
        AND public.is_group_member(s.group_id, auth.uid())
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND expires_at > now()
    AND expires_at <= now() + interval '15 minutes'
    AND EXISTS (
      SELECT 1 FROM public.group_live_sessions s
      WHERE s.id = session_id
        AND s.stopped_at IS NULL
        AND s.expires_at > now()
        AND public.is_group_member(s.group_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "live_positions_delete_own_or_manage" ON public.group_live_positions;
CREATE POLICY "live_positions_delete_own_or_manage" ON public.group_live_positions
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_live_sessions s
      WHERE s.id = session_id
        AND public.group_member_has_capability(s.group_id, auth.uid(), 'manage_members')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_live_positions TO authenticated, service_role;
