-- ==============================================================================
-- A5 — Terrain Live (Phase 5)
-- M10 : proximité terrain — colonne géographique générée, index GiST et RPC
-- de lecture publique sans identité.
--
-- Additif et idempotent. Aucune table, policy ou vue n'est recréée :
-- l'autorité DDL reste `20260911134000_a1_terrain_live.sql`.
--
--   • `terrain_reports.geog` : geography(Point,4326) STORED, dérivée de
--     (lng, lat) — jamais écrite par les clients.
--   • `terrain_reports.report_count` : corroboration de fusion (≥ 1), jamais
--     écrite par les clients.
--   • Index GiST `idx_terrain_reports_geog` pour les recherches de proximité.
--   • RPC `a5_terrain_reports_near(lat, lng, radius_m)` : filtres de la vue
--     publique appliqués en local (statuts `confirmed`/`active` non expirés),
--     colonnes publiques uniquement — jamais `reporter_id` — et `ST_DWithin`
--     sur la colonne générée `geog` (index GiST utilisé).
--   • Droits : anon/authenticated peuvent EXÉCUTER la fonction en lecture
--     seule ; aucune écriture n'est accordée. service_role inchangé.
-- ==============================================================================

-- ── 1. Colonne géographique générée (jamais exposée par la vue A1) ───────────
ALTER TABLE public.terrain_reports
  ADD COLUMN IF NOT EXISTS geog geography(Point, 4326)
  GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(lng::float8, lat::float8), 4326)::geography
  ) STORED;

COMMENT ON COLUMN public.terrain_reports.geog IS
  'A5 — position générée (lng, lat) en geography(Point,4326) STORED ; '
  'support des recherches de proximité (index GiST), jamais exposée directement.';

-- ── 1bis. Corroboration de fusion : nombre de signalements fusionnés ─────────
ALTER TABLE public.terrain_reports
  ADD COLUMN IF NOT EXISTS report_count integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'terrain_reports_report_count_positive'
      AND conrelid = 'public.terrain_reports'::regclass
  ) THEN
    ALTER TABLE public.terrain_reports
      ADD CONSTRAINT terrain_reports_report_count_positive CHECK (report_count >= 1);
  END IF;
END $$;

COMMENT ON COLUMN public.terrain_reports.report_count IS
  'A5 — nombre de signalements fusionnés dans cette entrée (déduplication), '
  'toujours ≥ 1 ; incrémenté par le serveur lors d''une fusion.';

-- ── 2. Index GiST de proximité ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_terrain_reports_geog
  ON public.terrain_reports USING gist (geog);

-- ── 3. RPC de proximité — vue publique sans identité ─────────────────────────
-- Le type de retour change (ajout `report_count`) : DROP indispensable pour
-- que la migration reste rejouable (CREATE OR REPLACE interdit de changer la
-- signature de sortie).
DROP FUNCTION IF EXISTS public.a5_terrain_reports_near(float8, float8, float8);

CREATE OR REPLACE FUNCTION public.a5_terrain_reports_near(
  p_lat float8,
  p_lng float8,
  p_radius_m float8 DEFAULT 2000
)
RETURNS TABLE (
  id uuid,
  segment_id bigint,
  category text,
  severity text,
  passability text,
  description text,
  photo_url text,
  lat numeric,
  lng numeric,
  gps_accuracy_m numeric,
  direction text,
  source_type text,
  status text,
  present_count integer,
  gone_count integer,
  unknown_count integer,
  report_count integer,
  created_at timestamptz,
  updated_at timestamptz,
  expires_at timestamptz,
  distance_m float8
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH search_point AS (
    SELECT ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography AS geog
  ),
  nearest AS (
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
      r.report_count,
      r.created_at,
      r.updated_at,
      r.expires_at,
      ST_Distance(r.geog, sp.geog) AS distance_m
    FROM public.terrain_reports r
    CROSS JOIN search_point sp
    WHERE r.status IN ('confirmed', 'active')
      AND (r.expires_at IS NULL OR r.expires_at > now())
      AND ST_DWithin(
        r.geog,
        sp.geog,
        least(greatest(p_radius_m, 1), 50000)
      )
  )
  SELECT * FROM nearest
  ORDER BY distance_m
  LIMIT 200;
$$;

COMMENT ON FUNCTION public.a5_terrain_reports_near(float8, float8, float8) IS
  'A5 — signalements Terrain Live confirmés/actifs non expirés autour d''un '
  'point (rayon borné 1 m – 50 km, max 200), colonnes publiques uniquement : '
  'aucune identité de contributeur (jamais reporter_id), triés par distance '
  'croissante, recherche indexée via terrain_reports.geog (GiST). '
  'STABLE, SECURITY INVOKER.';

-- ── 4. Droits explicites : lecture via la fonction uniquement ────────────────
REVOKE ALL ON FUNCTION public.a5_terrain_reports_near(float8, float8, float8) FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.a5_terrain_reports_near(float8, float8, float8) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.a5_terrain_reports_near(float8, float8, float8) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON FUNCTION public.a5_terrain_reports_near(float8, float8, float8) FROM service_role;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.a5_terrain_reports_near(float8, float8, float8)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.a5_terrain_reports_near(float8, float8, float8)
  TO service_role;

-- ── 5. Flag shadow — détection automatique jamais publiée en Phase 5 ─────────
INSERT INTO public.feature_flags (id, enabled)
VALUES ('terrain_auto_detection_shadow', false)
ON CONFLICT (id) DO NOTHING;
