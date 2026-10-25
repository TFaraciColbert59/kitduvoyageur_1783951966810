-- Prompt #5 — Timeline interactive automatique
-- Migration: hike_sessions + colonnes carnet_moments

-- ── 1. Table hike_sessions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hike_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id bigint REFERENCES public.hiking_routes(id),
  carnet_id uuid REFERENCES public.carnets(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  distance_km numeric NOT NULL,
  duration_seconds integer NOT NULL,
  elevation_gain_m numeric,
  positions_geojson jsonb,
  poi_events jsonb DEFAULT '[]'::jsonb,
  narratives jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.hike_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_sessions" ON public.hike_sessions;
CREATE POLICY "own_sessions" ON public.hike_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_hike_sessions_user_id ON public.hike_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_hike_sessions_route_id ON public.hike_sessions(route_id);
CREATE INDEX IF NOT EXISTS idx_hike_sessions_carnet_id ON public.hike_sessions(carnet_id);

-- ── 2. Colonnes supplémentaires pour carnet_moments ──────────────────────────
-- (sans rien casser de l'existant, ADD COLUMN IF NOT EXISTS)
ALTER TABLE public.carnet_moments
  ADD COLUMN IF NOT EXISTS moment_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manuel',
  ADD COLUMN IF NOT EXISTS hike_session_id uuid
    REFERENCES public.hike_sessions(id) ON DELETE SET NULL;

-- Contrainte sur source (manuel / auto) — ajout safe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'carnet_moments_source_check'
      AND conrelid = 'public.carnet_moments'::regclass
  ) THEN
    ALTER TABLE public.carnet_moments
      ADD CONSTRAINT carnet_moments_source_check
      CHECK (source IN ('manuel', 'auto'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_carnet_moments_hike_session_id
  ON public.carnet_moments(hike_session_id);
CREATE INDEX IF NOT EXISTS idx_carnet_moments_moment_timestamp
  ON public.carnet_moments(moment_timestamp);

-- ── 3. Fonction agrégation stats (Prompt #7) ─────────────────────────────────
-- Incluse ici car dépend de hike_sessions
CREATE OR REPLACE FUNCTION public.get_user_hiking_stats(p_user_id uuid)
RETURNS TABLE(
  total_sessions integer,
  total_distance_km numeric,
  avg_distance_km numeric,
  avg_pace_min_per_km numeric,
  avg_elevation_gain_m numeric,
  favorite_difficulty text,
  most_active_weekday text
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    COUNT(*)::integer,
    COALESCE(SUM(hs.distance_km), 0),
    COALESCE(AVG(hs.distance_km), 0),
    COALESCE(AVG(hs.duration_seconds / 60.0 / NULLIF(hs.distance_km, 0)), 0),
    COALESCE(AVG(hs.elevation_gain_m), 0),
    MODE() WITHIN GROUP (ORDER BY hr.network),
    MODE() WITHIN GROUP (ORDER BY to_char(hs.started_at, 'Day'))
  FROM public.hike_sessions hs
  LEFT JOIN public.hiking_routes hr ON hr.id = hs.route_id
  WHERE hs.user_id = p_user_id;
$$;
