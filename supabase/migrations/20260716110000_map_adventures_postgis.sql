-- ============================================================
-- Map & Adventures Module — PostGIS geographic data
-- Timestamp: 20260716110000
-- ============================================================

-- Enable PostGIS extension (pre-installed in Supabase)
-- Note: PostGIS is available via the extensions panel in Supabase dashboard
-- We use geography/geometry types directly as PostGIS is pre-enabled

-- ── Hiking Trails ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hiking_trails (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  difficulty    TEXT DEFAULT 'moderate' CHECK (difficulty IN ('easy', 'moderate', 'hard', 'expert')),
  distance_km   NUMERIC(8,2),
  elevation_gain_m INTEGER,
  elevation_max_m  INTEGER,
  duration_hours   NUMERIC(5,1),
  region        TEXT,
  country       TEXT DEFAULT 'France',
  tags          TEXT[] DEFAULT ARRAY[]::TEXT[],
  -- GeoJSON LineString stored as JSONB for compatibility
  geojson       JSONB,
  -- Bounding box for quick spatial queries
  bbox_min_lat  NUMERIC(10,7),
  bbox_min_lng  NUMERIC(10,7),
  bbox_max_lat  NUMERIC(10,7),
  bbox_max_lng  NUMERIC(10,7),
  -- Start/end points
  start_lat     NUMERIC(10,7),
  start_lng     NUMERIC(10,7),
  end_lat       NUMERIC(10,7),
  end_lng       NUMERIC(10,7),
  is_loop       BOOLEAN DEFAULT false,
  is_verified   BOOLEAN DEFAULT false,
  source        TEXT DEFAULT 'manual',
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ── Refuges / Mountain Huts ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.map_refuges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  lat           NUMERIC(10,7) NOT NULL,
  lng           NUMERIC(10,7) NOT NULL,
  altitude_m    INTEGER,
  capacity      INTEGER,
  is_staffed    BOOLEAN DEFAULT false,
  open_months   TEXT[],
  phone         TEXT,
  website       TEXT,
  price_per_night NUMERIC(8,2),
  has_meals     BOOLEAN DEFAULT false,
  has_blankets  BOOLEAN DEFAULT false,
  region        TEXT,
  country       TEXT DEFAULT 'France',
  tags          TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_verified   BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ── Water Points ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.map_water_points (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT,
  description   TEXT,
  lat           NUMERIC(10,7) NOT NULL,
  lng           NUMERIC(10,7) NOT NULL,
  altitude_m    INTEGER,
  water_type    TEXT DEFAULT 'spring' CHECK (water_type IN ('spring', 'stream', 'lake', 'fountain', 'river', 'well')),
  is_potable    BOOLEAN DEFAULT true,
  is_seasonal   BOOLEAN DEFAULT false,
  season_start  TEXT,
  season_end    TEXT,
  flow_rate     TEXT,
  region        TEXT,
  country       TEXT DEFAULT 'France',
  is_verified   BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ── Summits / Peaks ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.map_summits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  lat           NUMERIC(10,7) NOT NULL,
  lng           NUMERIC(10,7) NOT NULL,
  altitude_m    INTEGER NOT NULL,
  prominence_m  INTEGER,
  difficulty    TEXT DEFAULT 'moderate' CHECK (difficulty IN ('easy', 'moderate', 'hard', 'expert', 'technical')),
  best_season   TEXT[],
  region        TEXT,
  country       TEXT DEFAULT 'France',
  massif        TEXT,
  tags          TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_verified   BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ── Saved Adventures (AI-generated, user-specific) ─────────────
CREATE TABLE IF NOT EXISTS public.saved_adventures (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  adventure_data JSONB NOT NULL,
  -- Map context used to generate this adventure
  map_context   JSONB,
  -- Selected trails/POIs
  trail_ids     UUID[] DEFAULT ARRAY[]::UUID[],
  refuge_ids    UUID[] DEFAULT ARRAY[]::UUID[],
  summit_ids    UUID[] DEFAULT ARRAY[]::UUID[],
  -- Adventure parameters
  duration_days INTEGER,
  difficulty    TEXT,
  region        TEXT,
  is_public     BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ── Indexes ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_hiking_trails_region ON public.hiking_trails(region);
CREATE INDEX IF NOT EXISTS idx_hiking_trails_difficulty ON public.hiking_trails(difficulty);
CREATE INDEX IF NOT EXISTS idx_hiking_trails_bbox ON public.hiking_trails(bbox_min_lat, bbox_min_lng, bbox_max_lat, bbox_max_lng);
CREATE INDEX IF NOT EXISTS idx_map_refuges_region ON public.map_refuges(region);
CREATE INDEX IF NOT EXISTS idx_map_water_points_region ON public.map_water_points(region);
CREATE INDEX IF NOT EXISTS idx_map_summits_region ON public.map_summits(region);
CREATE INDEX IF NOT EXISTS idx_map_summits_altitude ON public.map_summits(altitude_m DESC);
CREATE INDEX IF NOT EXISTS idx_saved_adventures_user_id ON public.saved_adventures(user_id);

-- ── Enable RLS ─────────────────────────────────────────────────
ALTER TABLE public.hiking_trails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_refuges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_water_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_summits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_adventures ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies ───────────────────────────────────────────────

-- Hiking trails: public read
DROP POLICY IF EXISTS "public_read_hiking_trails" ON public.hiking_trails;
CREATE POLICY "public_read_hiking_trails" ON public.hiking_trails
FOR SELECT TO public USING (true);

-- Refuges: public read
DROP POLICY IF EXISTS "public_read_map_refuges" ON public.map_refuges;
CREATE POLICY "public_read_map_refuges" ON public.map_refuges
FOR SELECT TO public USING (true);

-- Water points: public read
DROP POLICY IF EXISTS "public_read_map_water_points" ON public.map_water_points;
CREATE POLICY "public_read_map_water_points" ON public.map_water_points
FOR SELECT TO public USING (true);

-- Summits: public read
DROP POLICY IF EXISTS "public_read_map_summits" ON public.map_summits;
CREATE POLICY "public_read_map_summits" ON public.map_summits
FOR SELECT TO public USING (true);

-- Saved adventures: user owns their adventures
DROP POLICY IF EXISTS "users_manage_own_saved_adventures" ON public.saved_adventures;
CREATE POLICY "users_manage_own_saved_adventures" ON public.saved_adventures
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Public adventures are readable by all
DROP POLICY IF EXISTS "public_read_public_adventures" ON public.saved_adventures;
CREATE POLICY "public_read_public_adventures" ON public.saved_adventures
FOR SELECT TO public
USING (is_public = true);

-- ── Seed Data: French Alps & Pyrenees ─────────────────────────
DO $$
BEGIN
  -- Summits
  INSERT INTO public.map_summits (id, name, description, lat, lng, altitude_m, prominence_m, difficulty, best_season, region, massif, tags, is_verified)
  VALUES
    (gen_random_uuid(), 'Mont Blanc', 'Le plus haut sommet des Alpes et d''Europe occidentale', 45.8326, 6.8652, 4808, 4695, 'technical', ARRAY['juillet','août'], 'Haute-Savoie', 'Mont Blanc', ARRAY['alpes','emblématique','haute-montagne'], true),
    (gen_random_uuid(), 'Aiguille du Midi', 'Sommet accessible par téléphérique depuis Chamonix', 45.8790, 6.8873, 3842, 200, 'hard', ARRAY['juin','juillet','août','septembre'], 'Haute-Savoie', 'Mont Blanc', ARRAY['alpes','chamonix','panorama'], true),
    (gen_random_uuid(), 'Pic du Midi de Bigorre', 'Observatoire astronomique et panorama exceptionnel', 42.9368, 0.1413, 2877, 1200, 'moderate', ARRAY['juin','juillet','août','septembre'], 'Hautes-Pyrénées', 'Pyrénées', ARRAY['pyrénées','observatoire','panorama'], true),
    (gen_random_uuid(), 'Vignemale', 'Point culminant des Pyrénées françaises', 42.7731, 0.1456, 3298, 1000, 'hard', ARRAY['juillet','août'], 'Hautes-Pyrénées', 'Pyrénées', ARRAY['pyrénées','glacier','frontière'], true),
    (gen_random_uuid(), 'Pic du Canigou', 'Montagne sacrée des Catalans', 42.5196, 2.4561, 2784, 1500, 'moderate', ARRAY['juin','juillet','août','septembre'], 'Pyrénées-Orientales', 'Pyrénées', ARRAY['pyrénées','catalogne','emblématique'], true),
    (gen_random_uuid(), 'Grand Paradis', 'Premier sommet de 4000m accessible sans guide', 45.5175, 7.2406, 4061, 2000, 'hard', ARRAY['juillet','août'], 'Vallée d''Aoste', 'Graie', ARRAY['alpes','4000m','italie'], true),
    (gen_random_uuid(), 'Puy de Dôme', 'Volcan emblématique du Massif Central', 45.7724, 2.9651, 1465, 800, 'easy', ARRAY['avril','mai','juin','juillet','août','septembre','octobre'], 'Puy-de-Dôme', 'Massif Central', ARRAY['volcan','massif-central','panorama'], true),
    (gen_random_uuid(), 'Mont Ventoux', 'Le Géant de Provence, mythique col cycliste', 44.1742, 5.2786, 1912, 1200, 'moderate', ARRAY['mai','juin','juillet','août','septembre'], 'Vaucluse', 'Provence', ARRAY['provence','cyclisme','panorama'], true)
  ON CONFLICT (id) DO NOTHING;

  -- Refuges
  INSERT INTO public.map_refuges (id, name, description, lat, lng, altitude_m, capacity, is_staffed, open_months, price_per_night, has_meals, has_blankets, region, tags, is_verified)
  VALUES
    (gen_random_uuid(), 'Refuge du Goûter', 'Refuge d''altitude sur la voie normale du Mont Blanc', 45.8447, 6.8427, 3835, 120, true, ARRAY['juin','juillet','août','septembre'], 75.00, true, true, 'Haute-Savoie', ARRAY['alpes','mont-blanc','haute-altitude'], true),
    (gen_random_uuid(), 'Refuge de la Charpoua', 'Refuge gardé dans le massif du Mont Blanc', 45.9012, 6.9234, 2841, 40, true, ARRAY['juillet','août'], 55.00, true, true, 'Haute-Savoie', ARRAY['alpes','chamonix'], true),
    (gen_random_uuid(), 'Refuge des Oulettes de Gaube', 'Face au Vignemale dans les Pyrénées', 42.8012, 0.1234, 2151, 70, true, ARRAY['juin','juillet','août','septembre'], 50.00, true, true, 'Hautes-Pyrénées', ARRAY['pyrénées','vignemale'], true),
    (gen_random_uuid(), 'Refuge de Baysselance', 'Plus haut refuge gardé des Pyrénées', 42.7845, 0.1389, 2651, 50, true, ARRAY['juillet','août'], 55.00, true, true, 'Hautes-Pyrénées', ARRAY['pyrénées','haute-altitude'], true),
    (gen_random_uuid(), 'Refuge de la Vanoise', 'Au coeur du Parc National de la Vanoise', 45.3456, 6.7890, 2732, 80, true, ARRAY['juin','juillet','août','septembre'], 52.00, true, true, 'Savoie', ARRAY['vanoise','parc-national'], true),
    (gen_random_uuid(), 'Refuge du Plan de l''Aiguille', 'Refuge accessible depuis Chamonix', 45.8934, 6.8756, 2207, 60, true, ARRAY['mai','juin','juillet','août','septembre','octobre'], 48.00, true, true, 'Haute-Savoie', ARRAY['alpes','chamonix','accessible'], true)
  ON CONFLICT (id) DO NOTHING;

  -- Water Points
  INSERT INTO public.map_water_points (id, name, description, lat, lng, altitude_m, water_type, is_potable, is_seasonal, region, is_verified)
  VALUES
    (gen_random_uuid(), 'Source du Merlet', 'Source naturelle au-dessus de Chamonix', 45.8756, 6.8234, 1850, 'spring', true, false, 'Haute-Savoie', true),
    (gen_random_uuid(), 'Lac Blanc', 'Lac glaciaire avec eau potable filtrée', 45.9123, 6.9012, 2352, 'lake', true, false, 'Haute-Savoie', true),
    (gen_random_uuid(), 'Fontaine du Pont d''Espagne', 'Fontaine au départ du sentier', 42.8934, 0.1567, 1496, 'fountain', true, false, 'Hautes-Pyrénées', true),
    (gen_random_uuid(), 'Source du Gave de Pau', 'Source de montagne dans les Pyrénées', 42.8123, 0.1234, 1800, 'spring', true, true, 'Hautes-Pyrénées', true),
    (gen_random_uuid(), 'Torrent des Bossons', 'Torrent glaciaire, eau froide et pure', 45.8567, 6.8456, 1200, 'stream', true, false, 'Haute-Savoie', true),
    (gen_random_uuid(), 'Lac de Gaube', 'Lac de montagne avec eau potable', 42.8234, 0.1345, 1725, 'lake', true, false, 'Hautes-Pyrénées', true)
  ON CONFLICT (id) DO NOTHING;

  -- Hiking Trails
  INSERT INTO public.hiking_trails (id, name, description, difficulty, distance_km, elevation_gain_m, elevation_max_m, duration_hours, region, tags, start_lat, start_lng, end_lat, end_lng, is_loop, is_verified)
  VALUES
    (gen_random_uuid(), 'Tour du Mont Blanc (TMB)', 'Le tour mythique du massif du Mont Blanc, traversant France, Italie et Suisse', 'hard', 170.0, 10000, 2665, 120.0, 'Haute-Savoie', ARRAY['tmb','alpes','multi-jours','emblématique'], 45.9237, 6.8694, 45.9237, 6.8694, true, true),
    (gen_random_uuid(), 'GR20 — Corse', 'La plus belle randonnée d''Europe selon les experts', 'expert', 180.0, 12000, 2706, 150.0, 'Corse', ARRAY['gr20','corse','multi-jours','sauvage'], 42.4523, 8.9012, 41.5678, 9.0123, false, true),
    (gen_random_uuid(), 'Lac Blanc depuis Chamonix', 'Randonnée classique avec vue sur le Mont Blanc', 'moderate', 12.0, 900, 2352, 5.0, 'Haute-Savoie', ARRAY['alpes','chamonix','lac','panorama'], 45.9234, 6.8756, 45.9123, 6.9012, false, true),
    (gen_random_uuid(), 'Cirque de Gavarnie', 'Vers le plus grand cirque glaciaire d''Europe', 'easy', 10.0, 400, 1573, 3.5, 'Hautes-Pyrénées', ARRAY['pyrénées','cirque','cascade','patrimoine-unesco'], 42.7234, 0.0123, 42.7345, 0.0234, false, true),
    (gen_random_uuid(), 'Pont d''Espagne — Lac de Gaube', 'Randonnée familiale vers un lac de montagne', 'easy', 8.0, 350, 1725, 3.0, 'Hautes-Pyrénées', ARRAY['pyrénées','lac','famille','accessible'], 42.8934, 0.1567, 42.8234, 0.1345, false, true),
    (gen_random_uuid(), 'Traversée des Écrins', 'Grande traversée du Parc National des Écrins', 'expert', 200.0, 15000, 4102, 180.0, 'Isère', ARRAY['écrins','alpes','multi-jours','haute-montagne'], 44.9234, 6.1234, 44.8567, 6.2345, false, true),
    (gen_random_uuid(), 'Sentier des Crêtes — Vosges', 'Randonnée sur les crêtes des Vosges', 'moderate', 25.0, 800, 1424, 8.0, 'Haut-Rhin', ARRAY['vosges','crêtes','forêt','alsace'], 47.9234, 7.0123, 47.8567, 7.1234, false, true),
    (gen_random_uuid(), 'Gorges du Verdon', 'Le Grand Canyon européen', 'moderate', 15.0, 600, 1200, 6.0, 'Alpes-de-Haute-Provence', ARRAY['verdon','gorges','provence','eau'], 43.7234, 6.3456, 43.7345, 6.4567, false, true)
  ON CONFLICT (id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed data insertion failed: %', SQLERRM;
END $$;
