-- ==============================================================================
-- A1 — M5 : Terrain Live (signalements, confirmations, événements consolidés)
-- Aucune identité de contributeur dans les surfaces publiques.
-- Cycle de vie : pending -> confirmed -> active -> stale -> verify -> resolved/expired/rejected
-- ==============================================================================

-- ── 1. Signalements ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.terrain_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id bigint REFERENCES public.trail_segments(id) ON DELETE SET NULL,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN (
    'obstacle', 'closure', 'mud', 'snow_ice', 'water', 'danger',
    'bridge', 'flood', 'marking', 'shelter', 'crowding', 'animal', 'rockfall'
  )),
  severity text NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info', 'warning', 'critical')),
  passability text NOT NULL DEFAULT 'unknown'
    CHECK (passability IN ('passable', 'difficult', 'impassable', 'unknown')),
  description text CHECK (description IS NULL OR char_length(description) <= 1000),
  photo_url text,
  lat numeric(9, 6) NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng numeric(9, 6) NOT NULL CHECK (lng BETWEEN -180 AND 180),
  gps_accuracy_m numeric CHECK (gps_accuracy_m IS NULL OR gps_accuracy_m >= 0),
  direction text CHECK (direction IS NULL OR direction IN ('forward', 'reverse', 'unknown')),
  source_type text NOT NULL DEFAULT 'user'
    CHECK (source_type IN ('user', 'official', 'auto')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'active', 'stale', 'verify', 'resolved', 'expired', 'rejected'
  )),
  present_count integer NOT NULL DEFAULT 0 CHECK (present_count >= 0),
  gone_count integer NOT NULL DEFAULT 0 CHECK (gone_count >= 0),
  unknown_count integer NOT NULL DEFAULT 0 CHECK (unknown_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

COMMENT ON TABLE public.terrain_reports IS
  'Terrain Live — signalement géolocalisé. La base n''est jamais exposée publiquement '
  '(peut contenir reporter_id) ; la lecture publique passe par terrain_reports_public.';

CREATE INDEX IF NOT EXISTS idx_terrain_reports_segment
  ON public.terrain_reports(segment_id);
CREATE INDEX IF NOT EXISTS idx_terrain_reports_status
  ON public.terrain_reports(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_terrain_reports_reporter
  ON public.terrain_reports(reporter_id);

ALTER TABLE public.terrain_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "terrain_reports_select_own" ON public.terrain_reports;
CREATE POLICY "terrain_reports_select_own"
  ON public.terrain_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS "terrain_reports_insert_own" ON public.terrain_reports;
CREATE POLICY "terrain_reports_insert_own"
  ON public.terrain_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND status = 'pending' AND source_type = 'user');

DROP POLICY IF EXISTS "terrain_reports_update_own_pending" ON public.terrain_reports;
CREATE POLICY "terrain_reports_update_own_pending"
  ON public.terrain_reports FOR UPDATE TO authenticated
  USING (reporter_id = auth.uid() AND status = 'pending')
  WITH CHECK (reporter_id = auth.uid() AND status = 'pending' AND source_type = 'user');

DROP POLICY IF EXISTS "terrain_reports_all_service" ON public.terrain_reports;
CREATE POLICY "terrain_reports_all_service"
  ON public.terrain_reports FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_terrain_reports_updated_at ON public.terrain_reports;
CREATE TRIGGER trg_terrain_reports_updated_at
  BEFORE UPDATE ON public.terrain_reports
  FOR EACH ROW EXECUTE FUNCTION public.adventure_touch_updated_at();

-- ── 2. Confirmations (1 seule par utilisateur et par rapport) ────────────────
CREATE TABLE IF NOT EXISTS public.terrain_report_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.terrain_reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  confirmation text NOT NULL CHECK (confirmation IN ('present', 'gone', 'unknown')),
  location_distance_m numeric CHECK (location_distance_m IS NULL OR location_distance_m >= 0),
  gps_quality numeric CHECK (gps_quality IS NULL OR gps_quality BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT terrain_report_confirmations_unique UNIQUE (report_id, user_id)
);

COMMENT ON TABLE public.terrain_report_confirmations IS
  'Confirmations Terrain Live — un utilisateur ne compte qu''une fois par rapport. '
  'Les compteurs dénormalisés (present/gone/unknown) sont maintenus par trigger.';

CREATE INDEX IF NOT EXISTS idx_terrain_report_confirmations_report
  ON public.terrain_report_confirmations(report_id);

ALTER TABLE public.terrain_report_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terrain_report_confirmations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "terrain_confirmations_select_own" ON public.terrain_report_confirmations;
CREATE POLICY "terrain_confirmations_select_own"
  ON public.terrain_report_confirmations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "terrain_confirmations_insert_own" ON public.terrain_report_confirmations;
CREATE POLICY "terrain_confirmations_insert_own"
  ON public.terrain_report_confirmations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "terrain_confirmations_update_own" ON public.terrain_report_confirmations;
CREATE POLICY "terrain_confirmations_update_own"
  ON public.terrain_report_confirmations FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "terrain_confirmations_all_service" ON public.terrain_report_confirmations;
CREATE POLICY "terrain_confirmations_all_service"
  ON public.terrain_report_confirmations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── 3. Compteurs dénormalisés maintenus par trigger ──────────────────────────
CREATE OR REPLACE FUNCTION public.a1_sync_terrain_report_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.terrain_reports SET
      present_count = present_count + (CASE WHEN NEW.confirmation = 'present' THEN 1 ELSE 0 END),
      gone_count = gone_count + (CASE WHEN NEW.confirmation = 'gone' THEN 1 ELSE 0 END),
      unknown_count = unknown_count + (CASE WHEN NEW.confirmation = 'unknown' THEN 1 ELSE 0 END),
      updated_at = now()
    WHERE id = NEW.report_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.terrain_reports SET
      present_count = present_count
        - (CASE WHEN OLD.confirmation = 'present' THEN 1 ELSE 0 END)
        + (CASE WHEN NEW.confirmation = 'present' THEN 1 ELSE 0 END),
      gone_count = gone_count
        - (CASE WHEN OLD.confirmation = 'gone' THEN 1 ELSE 0 END)
        + (CASE WHEN NEW.confirmation = 'gone' THEN 1 ELSE 0 END),
      unknown_count = unknown_count
        - (CASE WHEN OLD.confirmation = 'unknown' THEN 1 ELSE 0 END)
        + (CASE WHEN NEW.confirmation = 'unknown' THEN 1 ELSE 0 END),
      updated_at = now()
    WHERE id = NEW.report_id;
    RETURN NEW;
  ELSE
    UPDATE public.terrain_reports SET
      present_count = present_count - (CASE WHEN OLD.confirmation = 'present' THEN 1 ELSE 0 END),
      gone_count = gone_count - (CASE WHEN OLD.confirmation = 'gone' THEN 1 ELSE 0 END),
      unknown_count = unknown_count - (CASE WHEN OLD.confirmation = 'unknown' THEN 1 ELSE 0 END),
      updated_at = now()
    WHERE id = OLD.report_id;
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_terrain_confirmations_counts ON public.terrain_report_confirmations;
CREATE TRIGGER trg_terrain_confirmations_counts
  AFTER INSERT OR UPDATE OR DELETE ON public.terrain_report_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.a1_sync_terrain_report_counts();

-- ── 4. Événements consolidés (fusion de signalements proches) ────────────────
CREATE TABLE IF NOT EXISTS public.terrain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id bigint REFERENCES public.trail_segments(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN (
    'obstacle', 'closure', 'mud', 'snow_ice', 'water', 'danger',
    'bridge', 'flood', 'marking', 'shelter', 'crowding', 'animal', 'rockfall'
  )),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'resolved', 'expired')),
  merged_report_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  confidence_score numeric CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1),
  first_reported_at timestamptz NOT NULL,
  last_confirmed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.terrain_events IS
  'Événement Terrain Live consolidé (plusieurs signalements fusionnés). Aucune identité.';

CREATE INDEX IF NOT EXISTS idx_terrain_events_segment
  ON public.terrain_events(segment_id, status, expires_at);

ALTER TABLE public.terrain_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "terrain_events_select_public" ON public.terrain_events;
CREATE POLICY "terrain_events_select_public"
  ON public.terrain_events FOR SELECT TO public
  USING (status = 'active' AND (expires_at IS NULL OR expires_at > now()));

DROP POLICY IF EXISTS "terrain_events_all_service" ON public.terrain_events;
CREATE POLICY "terrain_events_all_service"
  ON public.terrain_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_terrain_events_updated_at ON public.terrain_events;
CREATE TRIGGER trg_terrain_events_updated_at
  BEFORE UPDATE ON public.terrain_events
  FOR EACH ROW EXECUTE FUNCTION public.adventure_touch_updated_at();

-- ── 5. Vue publique des rapports — sans reporter_id ──────────────────────────
-- Vue SECURITY DEFINER volontaire : la table de base n'a AUCUNE policy publique
-- (reporter_id reste privé) ; la vue filtre statuts/expiration et projette les
-- colonnes publiques uniquement.
CREATE OR REPLACE VIEW public.terrain_reports_public AS
SELECT
  r.id,
  r.segment_id,
  r.category,
  r.severity,
  r.passability,
  r.description,
  r.photo_url,
  r.lat,
  r.lng,
  r.gps_accuracy_m,
  r.direction,
  r.source_type,
  r.status,
  r.present_count,
  r.gone_count,
  r.unknown_count,
  r.created_at,
  r.updated_at,
  r.expires_at
FROM public.terrain_reports r
WHERE r.status IN ('confirmed', 'active')
  AND (r.expires_at IS NULL OR r.expires_at > now());

COMMENT ON VIEW public.terrain_reports_public IS
  'Vue publique Terrain Live — rapports confirmés/actifs non expirés, sans identité du contributeur.';

GRANT SELECT ON public.terrain_reports_public TO anon, authenticated;
