-- Hotfix appliqué historiquement en direct sur le projet (supabase_migrations).
-- Reconstruit depuis l'historique distant le 13/10/2026 — version 20260930172335.
-- Conservé tel quel : source de vérité pour la rejouabilité.
DO $$ BEGIN
  CREATE TYPE public.trajectoire_zone AS ENUM ('run', 'journee', 'raid', 'expedition', 'monde');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.trajectoire_grain AS ENUM ('boucle', 'demi-journee', 'jour', 'journee', 'pays');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.trajectoire_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  trip_id         uuid REFERENCES public.trips (id) ON DELETE CASCADE,
  intention_raw   text NOT NULL,
  destination_id  text NOT NULL,
  constraints     jsonb NOT NULL DEFAULT '[]'::jsonb,
  t               double precision NOT NULL,
  hours           integer NOT NULL,
  zone            public.trajectoire_zone,
  grain           public.trajectoire_grain,
  plan_version    integer NOT NULL DEFAULT 1,
  sources_hash    text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trajectoire_snapshots_t_range_chk CHECK (t >= 0 AND t <= 1),
  CONSTRAINT trajectoire_snapshots_hours_range_chk CHECK (hours >= 1 AND hours <= 720),
  CONSTRAINT trajectoire_snapshots_version_chk CHECK (plan_version >= 1),
  CONSTRAINT trajectoire_snapshots_constraints_array_chk CHECK (jsonb_typeof(constraints) = 'array')
);

DROP TRIGGER IF EXISTS trg_trajectoire_snapshots_updated_at ON public.trajectoire_snapshots;
CREATE TRIGGER trg_trajectoire_snapshots_updated_at
  BEFORE UPDATE ON public.trajectoire_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS trajectoire_snapshots_user_recent_idx
  ON public.trajectoire_snapshots (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS trajectoire_snapshots_trip_idx
  ON public.trajectoire_snapshots (trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS trajectoire_snapshots_staleness_idx
  ON public.trajectoire_snapshots (user_id, sources_hash);

ALTER TABLE public.trajectoire_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trajectoire_snapshots_select_own" ON public.trajectoire_snapshots;
CREATE POLICY "trajectoire_snapshots_select_own" ON public.trajectoire_snapshots
  FOR SELECT USING (auth.uid() IS NOT NULL AND user_id = auth.uid());
DROP POLICY IF EXISTS "trajectoire_snapshots_insert_own" ON public.trajectoire_snapshots;
CREATE POLICY "trajectoire_snapshots_insert_own" ON public.trajectoire_snapshots
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
DROP POLICY IF EXISTS "trajectoire_snapshots_update_own" ON public.trajectoire_snapshots;
CREATE POLICY "trajectoire_snapshots_update_own" ON public.trajectoire_snapshots
  FOR UPDATE USING (auth.uid() IS NOT NULL AND user_id = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
DROP POLICY IF EXISTS "trajectoire_snapshots_delete_own" ON public.trajectoire_snapshots;
CREATE POLICY "trajectoire_snapshots_delete_own" ON public.trajectoire_snapshots
  FOR DELETE USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_latest_trajectoire(p_trip_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid, intention_raw text, destination_id text, t double precision,
  hours integer, zone public.trajectoire_zone, grain public.trajectoire_grain,
  plan_version integer, sources_hash text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.id, s.intention_raw, s.destination_id, s.t, s.hours, s.zone, s.grain,
         s.plan_version, s.sources_hash
  FROM public.trajectoire_snapshots s
  WHERE s.user_id = auth.uid()
    AND (p_trip_id IS NULL OR s.trip_id = p_trip_id)
  ORDER BY s.updated_at DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_latest_trajectoire(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_latest_trajectoire(uuid) TO authenticated;
