-- ==============================================================================
-- P01 — Confidentialité : zones privées (K7.05 / S6.14), masquage de trace par
-- sortie, liens de partage révocables et visibilité par sortie (K7.04 / S6.13).
-- Additif et idempotent. Fail-closed : les zones privées ne sont jamais
-- lisibles par des tiers ; seul le service serveur projette les géométries.
-- ==============================================================================

-- ── 1. Zones de confidentialité de l'utilisateur (K7.05) ────────────────────
CREATE TABLE IF NOT EXISTS public.user_privacy_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 60),
  center_lat double precision NOT NULL CHECK (center_lat BETWEEN -90 AND 90),
  center_lng double precision NOT NULL CHECK (center_lng BETWEEN -180 AND 180),
  radius_m integer NOT NULL DEFAULT 500 CHECK (radius_m BETWEEN 200 AND 5000),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_privacy_zones_user_id
  ON public.user_privacy_zones(user_id);

DROP TRIGGER IF EXISTS trg_user_privacy_zones_updated_at ON public.user_privacy_zones;
CREATE TRIGGER trg_user_privacy_zones_updated_at
  BEFORE UPDATE ON public.user_privacy_zones
  FOR EACH ROW EXECUTE FUNCTION public.adventure_touch_updated_at();

ALTER TABLE public.user_privacy_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_privacy_zones FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_privacy_zones_select_own ON public.user_privacy_zones;
CREATE POLICY user_privacy_zones_select_own
  ON public.user_privacy_zones FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_privacy_zones_insert_own ON public.user_privacy_zones;
CREATE POLICY user_privacy_zones_insert_own
  ON public.user_privacy_zones FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_privacy_zones_update_own ON public.user_privacy_zones;
CREATE POLICY user_privacy_zones_update_own
  ON public.user_privacy_zones FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_privacy_zones_delete_own ON public.user_privacy_zones;
CREATE POLICY user_privacy_zones_delete_own
  ON public.user_privacy_zones FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_privacy_zones_all_service ON public.user_privacy_zones;
CREATE POLICY user_privacy_zones_all_service
  ON public.user_privacy_zones FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.user_privacy_zones FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_privacy_zones TO authenticated;
GRANT ALL ON public.user_privacy_zones TO service_role;

-- ── 2. Règles de masquage de tracé par sortie (S6.14) ───────────────────────
CREATE TABLE IF NOT EXISTS public.outing_trace_privacy (
  session_id uuid PRIMARY KEY REFERENCES public.hike_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hide_start_m integer NOT NULL DEFAULT 0 CHECK (hide_start_m BETWEEN 0 AND 5000),
  hide_end_m integer NOT NULL DEFAULT 0 CHECK (hide_end_m BETWEEN 0 AND 5000),
  hide_all boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outing_trace_privacy_user_id
  ON public.outing_trace_privacy(user_id);

DROP TRIGGER IF EXISTS trg_outing_trace_privacy_updated_at ON public.outing_trace_privacy;
CREATE TRIGGER trg_outing_trace_privacy_updated_at
  BEFORE UPDATE ON public.outing_trace_privacy
  FOR EACH ROW EXECUTE FUNCTION public.adventure_touch_updated_at();

ALTER TABLE public.outing_trace_privacy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outing_trace_privacy FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS outing_trace_privacy_select_own ON public.outing_trace_privacy;
CREATE POLICY outing_trace_privacy_select_own
  ON public.outing_trace_privacy FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS outing_trace_privacy_insert_own ON public.outing_trace_privacy;
CREATE POLICY outing_trace_privacy_insert_own
  ON public.outing_trace_privacy FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.hike_sessions hs
      WHERE hs.id = outing_trace_privacy.session_id
        AND hs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS outing_trace_privacy_update_own ON public.outing_trace_privacy;
CREATE POLICY outing_trace_privacy_update_own
  ON public.outing_trace_privacy FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS outing_trace_privacy_delete_own ON public.outing_trace_privacy;
CREATE POLICY outing_trace_privacy_delete_own
  ON public.outing_trace_privacy FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS outing_trace_privacy_all_service ON public.outing_trace_privacy;
CREATE POLICY outing_trace_privacy_all_service
  ON public.outing_trace_privacy FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.outing_trace_privacy FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outing_trace_privacy TO authenticated;
GRANT ALL ON public.outing_trace_privacy TO service_role;

-- ── 3. Liens de partage révocables par sortie (K7.04) ───────────────────────
CREATE TABLE IF NOT EXISTS public.outing_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.hike_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outing_share_links_session_id
  ON public.outing_share_links(session_id);

ALTER TABLE public.outing_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outing_share_links FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS outing_share_links_select_own ON public.outing_share_links;
CREATE POLICY outing_share_links_select_own
  ON public.outing_share_links FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS outing_share_links_insert_own ON public.outing_share_links;
CREATE POLICY outing_share_links_insert_own
  ON public.outing_share_links FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.hike_sessions hs
      WHERE hs.id = outing_share_links.session_id
        AND hs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS outing_share_links_update_own ON public.outing_share_links;
CREATE POLICY outing_share_links_update_own
  ON public.outing_share_links FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS outing_share_links_delete_own ON public.outing_share_links;
CREATE POLICY outing_share_links_delete_own
  ON public.outing_share_links FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS outing_share_links_all_service ON public.outing_share_links;
CREATE POLICY outing_share_links_all_service
  ON public.outing_share_links FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.outing_share_links FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outing_share_links TO authenticated;
GRANT ALL ON public.outing_share_links TO service_role;

-- ── 4. Extension de hike_sessions.visibility (K7.04 / S6.13) ────────────────
ALTER TABLE public.hike_sessions
  DROP CONSTRAINT IF EXISTS hike_sessions_visibility_check;

ALTER TABLE public.hike_sessions
  ADD CONSTRAINT hike_sessions_visibility_check
  CHECK (visibility IN ('private', 'followers', 'public', 'collective_anonymized'));

-- Lecture RLS des sorties `followers` et `public` en excluant tout blocage
-- bidirectionnel (`user_blocks`) et tout profil privé pour `public`.
DROP POLICY IF EXISTS hike_sessions_select_followers ON public.hike_sessions;
CREATE POLICY hike_sessions_select_followers
  ON public.hike_sessions FOR SELECT TO authenticated
  USING (
    visibility = 'followers'
    AND EXISTS (
      SELECT 1 FROM public.user_follows uf
      WHERE uf.follower_id = auth.uid()
        AND uf.following_id = hike_sessions.user_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks ub
      WHERE (ub.blocker_id = auth.uid() AND ub.blocked_id = hike_sessions.user_id)
         OR (ub.blocker_id = hike_sessions.user_id AND ub.blocked_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS hike_sessions_select_public ON public.hike_sessions;
CREATE POLICY hike_sessions_select_public
  ON public.hike_sessions FOR SELECT TO authenticated
  USING (
    visibility = 'public'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = hike_sessions.user_id
        AND up.profile_visibility = 'prive'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks ub
      WHERE (ub.blocker_id = auth.uid() AND ub.blocked_id = hike_sessions.user_id)
         OR (ub.blocker_id = hike_sessions.user_id AND ub.blocked_id = auth.uid())
    )
  );

-- ── 5. Visibilité par défaut des nouvelles sorties (S6.13) ──────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS default_outing_visibility text NOT NULL DEFAULT 'private';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_profiles_default_outing_visibility_check'
      AND conrelid = 'public.user_profiles'::regclass
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_default_outing_visibility_check
      CHECK (default_outing_visibility IN ('private', 'followers', 'public', 'collective_anonymized'));
  END IF;
END $$;
