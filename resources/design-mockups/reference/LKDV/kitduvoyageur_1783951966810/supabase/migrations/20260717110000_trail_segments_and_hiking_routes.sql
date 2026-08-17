-- ============================================================
-- OSM Trail Data — Clean Import Schema
-- Timestamp: 20260717110000
--
-- CONTEXT: The original public.trails table was already dropped
-- in migration 20260717090000_drop_trails_table.sql.
-- This migration creates:
--   1. trails_raw_v1  — placeholder table preserving the original
--      schema structure (data was lost in prior drop migration)
--   2. trail_segments — dense OSM path network (fond de carte)
--   3. hiking_routes  — named official itineraries (GR/GRP/PR)
--
-- After creating these tables, import data via osm2pgsql flex mode:
--   osm2pgsql --slim -d $DATABASE_URL --output=flex \
--     --style=lkdv_trails.lua france-latest.osm.pbf
-- ============================================================

-- ── 1. trails_raw_v1 — Placeholder for original trails data ───
-- NOTE: The original trails table was dropped before renaming was
-- possible. This table preserves the schema for reference.
-- The 502 000 rows from the original import are no longer available
-- in the database; re-import from france-latest.osm.pbf if needed.
CREATE TABLE IF NOT EXISTS public.trails_raw_v1 (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT,
  -- Placeholder columns matching the original hiking_trails schema
  -- (the actual trails table had been dropped; this is a schema stub)
  description   TEXT,
  difficulty    TEXT,
  distance_km   NUMERIC(8,2),
  elevation_gain_m INTEGER,
  region        TEXT,
  country       TEXT DEFAULT 'France',
  tags          TEXT[] DEFAULT ARRAY[]::TEXT[],
  geojson       JSONB,
  source        TEXT DEFAULT 'trails_raw_v1_placeholder',
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  -- Marker so the app can distinguish this stub from real data
  is_placeholder BOOLEAN DEFAULT true
);

COMMENT ON TABLE public.trails_raw_v1 IS
  'Schema stub — original trails table was dropped in migration 20260717090000. '
  'Re-import raw OSM data here if needed before processing into trail_segments.';

-- ── 2. trail_segments — Dense OSM path network ────────────────
-- Source: osm2pgsql flex import of france-latest.osm.pbf
-- Filter: highway IN (''path'',''footway'',''track'',''bridleway'')
--         AND footway != ''sidewalk''
--         AND NOT surrounded by landuse=residential
-- Geometry: LineString, SRID 4326
CREATE TABLE IF NOT EXISTS public.trail_segments (
  id            BIGSERIAL PRIMARY KEY,
  osm_id        BIGINT NOT NULL,
  name          TEXT,
  highway       TEXT,           -- path | footway | track | bridleway
  sac_scale     TEXT,           -- hiking | mountain_hiking | demanding_mountain_hiking | …
  surface       TEXT,           -- ground | grass | gravel | rock | paved | …
  tags          JSONB,          -- full OSM tags preserved for post-import filtering
  geom          geometry(LineString, 4326) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.trail_segments IS
  'Dense OSM hiking path network for map background layer. '
  'Populated via osm2pgsql flex import from france-latest.osm.pbf. '
  'Filter applied: highway IN (path,footway,track,bridleway) '
  'excluding sidewalks and residential areas.';

COMMENT ON COLUMN public.trail_segments.tags IS
  'Full OSM tags as JSONB — allows post-import filtering without re-importing.';

-- Unique index on osm_id for upsert deduplication during re-imports
CREATE UNIQUE INDEX IF NOT EXISTS idx_trail_segments_osm_id
  ON public.trail_segments (osm_id);

-- GIST spatial index (mandatory for bbox queries and map rendering)
CREATE INDEX IF NOT EXISTS idx_trail_segments_geom
  ON public.trail_segments USING GIST (geom);

-- Functional indexes for common filter queries
CREATE INDEX IF NOT EXISTS idx_trail_segments_highway
  ON public.trail_segments (highway);

CREATE INDEX IF NOT EXISTS idx_trail_segments_sac_scale
  ON public.trail_segments (sac_scale)
  WHERE sac_scale IS NOT NULL;

-- ── 3. hiking_routes — Named official itineraries ─────────────
-- Source: OSM relations with type=route AND route=hiking
-- Includes: GR (grande randonnée), GRP (grande randonnée de pays),
--           PR (petite randonnée), and international/national/regional/local
-- Geometry: MultiLineString assembled from member ways, SRID 4326
CREATE TABLE IF NOT EXISTS public.hiking_routes (
  id                BIGSERIAL PRIMARY KEY,
  osm_relation_id   BIGINT NOT NULL,
  name              TEXT,
  ref               TEXT,       -- e.g. "GR 20", "GR 34", "PR 12"
  network           TEXT,       -- iwn | nwn | rwn | lwn
  distance_km       NUMERIC(10,3),  -- calculated from geometry length
  tags              JSONB,      -- full OSM relation tags
  geom              geometry(MultiLineString, 4326),
  created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.hiking_routes IS
  'Named official hiking itineraries (GR/GRP/PR and international routes). '
  'Populated from OSM relations: type=route AND route=hiking. '
  'distance_km is auto-calculated from geometry using ST_Length.';

COMMENT ON COLUMN public.hiking_routes.network IS
  'OSM network tag: iwn=international, nwn=national (GR), '
  'rwn=regional (GRP), lwn=local (PR).';

COMMENT ON COLUMN public.hiking_routes.distance_km IS
  'Route length in km, calculated automatically during import via '
  'ST_Length(geom::geography) / 1000.';

-- Unique index on osm_relation_id for upsert deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_hiking_routes_osm_relation_id
  ON public.hiking_routes (osm_relation_id);

-- GIST spatial index (mandatory — routes are clickable on the map)
CREATE INDEX IF NOT EXISTS idx_hiking_routes_geom
  ON public.hiking_routes USING GIST (geom);

-- Index on ref for quick GR/PR lookups
CREATE INDEX IF NOT EXISTS idx_hiking_routes_ref
  ON public.hiking_routes (ref)
  WHERE ref IS NOT NULL;

-- Index on network for filtering by route category
CREATE INDEX IF NOT EXISTS idx_hiking_routes_network
  ON public.hiking_routes (network)
  WHERE network IS NOT NULL;

-- ── 4. Enable RLS ──────────────────────────────────────────────
ALTER TABLE public.trails_raw_v1  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trail_segments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiking_routes   ENABLE ROW LEVEL SECURITY;

-- ── 5. RLS Policies — Public read (non-sensitive geographic data) ──

-- trails_raw_v1: public read (schema stub, no sensitive data)
DROP POLICY IF EXISTS "public_read_trails_raw_v1" ON public.trails_raw_v1;
CREATE POLICY "public_read_trails_raw_v1"
  ON public.trails_raw_v1
  FOR SELECT TO public
  USING (true);

-- trail_segments: public read (OSM open data)
DROP POLICY IF EXISTS "public_read_trail_segments" ON public.trail_segments;
CREATE POLICY "public_read_trail_segments"
  ON public.trail_segments
  FOR SELECT TO public
  USING (true);

-- hiking_routes: public read (OSM open data)
DROP POLICY IF EXISTS "public_read_hiking_routes" ON public.hiking_routes;
CREATE POLICY "public_read_hiking_routes"
  ON public.hiking_routes
  FOR SELECT TO public
  USING (true);

-- ── 6. Verification queries (run after osm2pgsql import) ───────
-- Execute these manually after importing france-latest.osm.pbf:
--
-- Row counts:
--   SELECT COUNT(*) FROM public.trail_segments;
--   SELECT COUNT(*) FROM public.hiking_routes;
--
-- Sample GR/PR routes (verify no street names):
--   SELECT osm_relation_id, name, ref, network, distance_km
--   FROM public.hiking_routes
--   ORDER BY RANDOM()
--   LIMIT 10;
--
-- Confirm trails_raw_v1 placeholder is intact:
--   SELECT COUNT(*), MAX(created_at) FROM public.trails_raw_v1;
--   -- Expected: 0 rows (placeholder stub, no data imported yet)
