-- ============================================================
-- Outdoor World Engine — Global adventure data at scale
-- Timestamp: 20260716120000
-- ============================================================

-- ── Extended Trails Table (world-scale) ───────────────────────
CREATE TABLE IF NOT EXISTS public.trails (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  osm_id          BIGINT,
  name            TEXT NOT NULL,
  trail_type      TEXT DEFAULT 'hiking' CHECK (trail_type IN ('hiking','trek','trail_running','cycling','bivouac','via_ferrata','ski_touring','kayak','road_trip')),
  country         TEXT,
  region          TEXT,
  distance_km     NUMERIC(10,2),
  duration_hours  NUMERIC(6,1),
  difficulty      TEXT DEFAULT 'moderate' CHECK (difficulty IN ('easy','moderate','hard','expert')),
  elevation_gain  INTEGER,
  elevation_loss  INTEGER,
  altitude_max    INTEGER,
  surface         TEXT,
  waymarking      TEXT,
  description     TEXT,
  geojson         JSONB,
  start_lat       NUMERIC(10,7),
  start_lng       NUMERIC(10,7),
  end_lat         NUMERIC(10,7),
  end_lng         NUMERIC(10,7),
  bbox_min_lat    NUMERIC(10,7),
  bbox_min_lng    NUMERIC(10,7),
  bbox_max_lat    NUMERIC(10,7),
  bbox_max_lng    NUMERIC(10,7),
  is_loop         BOOLEAN DEFAULT false,
  source          TEXT DEFAULT 'manual',
  synced_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ── Outdoor Points of Interest (world-scale) ──────────────────
CREATE TABLE IF NOT EXISTS public.outdoor_points (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  osm_id          BIGINT,
  category        TEXT NOT NULL CHECK (category IN ('refuge','water','summit','camping','waterfall','viewpoint','cave','forest','col','lake','spring')),
  name            TEXT,
  description     TEXT,
  lat             NUMERIC(10,7) NOT NULL,
  lng             NUMERIC(10,7) NOT NULL,
  altitude        INTEGER,
  country         TEXT,
  region          TEXT,
  -- Category-specific metadata stored as JSONB
  metadata        JSONB DEFAULT '{}'::JSONB,
  source          TEXT DEFAULT 'manual',
  synced_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ── Overpass Sync Log (cache management) ──────────────────────
CREATE TABLE IF NOT EXISTS public.overpass_sync_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type       TEXT NOT NULL,
  bbox            TEXT,
  country         TEXT,
  region          TEXT,
  records_fetched INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','running','success','error')),
  error_message   TEXT,
  started_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  completed_at    TIMESTAMPTZ
);

-- ── Indexes for spatial queries ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_trails_bbox ON public.trails(bbox_min_lat, bbox_min_lng, bbox_max_lat, bbox_max_lng);
CREATE INDEX IF NOT EXISTS idx_trails_country ON public.trails(country);
CREATE INDEX IF NOT EXISTS idx_trails_region ON public.trails(region);
CREATE INDEX IF NOT EXISTS idx_trails_difficulty ON public.trails(difficulty);
CREATE INDEX IF NOT EXISTS idx_trails_type ON public.trails(trail_type);
CREATE INDEX IF NOT EXISTS idx_trails_osm_id ON public.trails(osm_id);
CREATE INDEX IF NOT EXISTS idx_outdoor_points_lat_lng ON public.outdoor_points(lat, lng);
CREATE INDEX IF NOT EXISTS idx_outdoor_points_category ON public.outdoor_points(category);
CREATE INDEX IF NOT EXISTS idx_outdoor_points_country ON public.outdoor_points(country);
CREATE INDEX IF NOT EXISTS idx_outdoor_points_osm_id ON public.outdoor_points(osm_id);

-- ── Enable RLS ─────────────────────────────────────────────────
ALTER TABLE public.trails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outdoor_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overpass_sync_log ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies ───────────────────────────────────────────────
DROP POLICY IF EXISTS "public_read_trails" ON public.trails;
CREATE POLICY "public_read_trails" ON public.trails
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "public_read_outdoor_points" ON public.outdoor_points;
CREATE POLICY "public_read_outdoor_points" ON public.outdoor_points
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "public_read_overpass_sync_log" ON public.overpass_sync_log;
CREATE POLICY "public_read_overpass_sync_log" ON public.overpass_sync_log
FOR SELECT TO public USING (true);

-- ── Seed Data: World-scale trails & POIs ──────────────────────
DO $$
BEGIN
  -- World trails seed
  INSERT INTO public.trails (id, name, trail_type, country, region, distance_km, duration_hours, difficulty, elevation_gain, elevation_loss, altitude_max, description, start_lat, start_lng, end_lat, end_lng, is_loop, source)
  VALUES
    (gen_random_uuid(), 'Tour du Mont Blanc', 'trek', 'France/Italie/Suisse', 'Alpes', 170.0, 120.0, 'hard', 10000, 10000, 2665, 'Le tour mythique du massif du Mont Blanc traversant 3 pays', 45.9237, 6.8694, 45.9237, 6.8694, true, 'seed'),
    (gen_random_uuid(), 'GR20 Corse', 'trek', 'France', 'Corse', 180.0, 150.0, 'expert', 12000, 12000, 2706, 'La plus belle randonnee d Europe selon les experts', 42.4523, 8.9012, 41.5678, 9.0123, false, 'seed'),
    (gen_random_uuid(), 'Camino de Santiago', 'hiking', 'Espagne', 'Galice', 800.0, 300.0, 'moderate', 15000, 15000, 1430, 'Le chemin de Compostelle, pelerinage mondial', 43.2630, -1.9000, 42.8782, -8.5448, false, 'seed'),
    (gen_random_uuid(), 'Appalachian Trail', 'trek', 'USA', 'Est USA', 3500.0, 1200.0, 'hard', 160000, 160000, 2037, 'Le sentier mythique de la cote est americaine', 34.6270, -84.1940, 44.9226, -68.9213, false, 'seed'),
    (gen_random_uuid(), 'Annapurna Circuit', 'trek', 'Nepal', 'Himalaya', 230.0, 180.0, 'hard', 16000, 16000, 5416, 'Tour classique autour du massif Annapurna', 28.3949, 84.1240, 28.3949, 84.1240, true, 'seed'),
    (gen_random_uuid(), 'Inca Trail', 'trek', 'Perou', 'Andes', 43.0, 32.0, 'hard', 2400, 2400, 4215, 'Sentier inca vers le Machu Picchu', -13.5170, -71.9785, -13.1631, -72.5450, false, 'seed'),
    (gen_random_uuid(), 'Overland Track', 'trek', 'Australie', 'Tasmanie', 65.0, 48.0, 'moderate', 4500, 4500, 1617, 'Traversee sauvage de la Tasmanie', -41.6400, 145.9500, -42.0300, 146.0700, false, 'seed'),
    (gen_random_uuid(), 'Haute Route Chamonix-Zermatt', 'trek', 'France/Suisse', 'Alpes', 180.0, 120.0, 'expert', 12000, 12000, 3554, 'La haute route alpine entre Chamonix et Zermatt', 45.9237, 6.8694, 46.0207, 7.7491, false, 'seed'),
    (gen_random_uuid(), 'Lac Blanc depuis Chamonix', 'hiking', 'France', 'Haute-Savoie', 12.0, 5.0, 'moderate', 900, 900, 2352, 'Randonnee classique avec vue sur le Mont Blanc', 45.9234, 6.8756, 45.9123, 6.9012, false, 'seed'),
    (gen_random_uuid(), 'Cirque de Gavarnie', 'hiking', 'France', 'Hautes-Pyrenees', 10.0, 3.5, 'easy', 400, 400, 1573, 'Vers le plus grand cirque glaciaire d Europe', 42.7234, 0.0123, 42.7345, 0.0234, false, 'seed'),
    (gen_random_uuid(), 'Sentier des Cretes Vosges', 'hiking', 'France', 'Haut-Rhin', 25.0, 8.0, 'moderate', 800, 800, 1424, 'Randonnee sur les cretes des Vosges', 47.9234, 7.0123, 47.8567, 7.1234, false, 'seed'),
    (gen_random_uuid(), 'Gorges du Verdon', 'hiking', 'France', 'Alpes-de-Haute-Provence', 15.0, 6.0, 'moderate', 600, 600, 1200, 'Le Grand Canyon europeen', 43.7234, 6.3456, 43.7345, 6.4567, false, 'seed'),
    (gen_random_uuid(), 'Tour des Ecrins', 'trek', 'France', 'Isere', 200.0, 180.0, 'expert', 15000, 15000, 4102, 'Grande traversee du Parc National des Ecrins', 44.9234, 6.1234, 44.8567, 6.2345, false, 'seed'),
    (gen_random_uuid(), 'Kungsleden', 'trek', 'Suede', 'Laponie', 440.0, 240.0, 'moderate', 8000, 8000, 1690, 'Le chemin royal suedois en Laponie', 68.4200, 18.5600, 65.0700, 17.7200, false, 'seed'),
    (gen_random_uuid(), 'Milford Track', 'trek', 'Nouvelle-Zelande', 'Fiordland', 53.5, 32.0, 'moderate', 1154, 1154, 1154, 'La plus belle randonnee du monde selon certains', -44.6700, 167.9200, -44.9800, 167.8900, false, 'seed')
  ON CONFLICT (id) DO NOTHING;

  -- World outdoor points seed
  INSERT INTO public.outdoor_points (id, category, name, description, lat, lng, altitude, country, region, metadata, source)
  VALUES
    -- Summits
    (gen_random_uuid(), 'summit', 'Mont Blanc', 'Le plus haut sommet des Alpes', 45.8326, 6.8652, 4808, 'France', 'Haute-Savoie', '{"prominence":4695,"difficulty":"technical","massif":"Mont Blanc"}'::JSONB, 'seed'),
    (gen_random_uuid(), 'summit', 'Vignemale', 'Point culminant des Pyrenees francaises', 42.7731, 0.1456, 3298, 'France', 'Hautes-Pyrenees', '{"prominence":1000,"difficulty":"hard","massif":"Pyrenees"}'::JSONB, 'seed'),
    (gen_random_uuid(), 'summit', 'Puy de Dome', 'Volcan emblematique du Massif Central', 45.7724, 2.9651, 1465, 'France', 'Puy-de-Dome', '{"prominence":800,"difficulty":"easy","massif":"Massif Central"}'::JSONB, 'seed'),
    (gen_random_uuid(), 'summit', 'Mont Ventoux', 'Le Geant de Provence', 44.1742, 5.2786, 1912, 'France', 'Vaucluse', '{"prominence":1200,"difficulty":"moderate","massif":"Provence"}'::JSONB, 'seed'),
    (gen_random_uuid(), 'summit', 'Matterhorn', 'Sommet iconique des Alpes suisses', 45.9766, 7.6586, 4478, 'Suisse', 'Valais', '{"prominence":1042,"difficulty":"technical","massif":"Pennines"}'::JSONB, 'seed'),
    (gen_random_uuid(), 'summit', 'Everest Base Camp', 'Camp de base du toit du monde', 28.0026, 86.8528, 5364, 'Nepal', 'Himalaya', '{"prominence":0,"difficulty":"hard","massif":"Himalaya"}'::JSONB, 'seed'),
    (gen_random_uuid(), 'summit', 'Kilimanjaro', 'Le toit de l Afrique', -3.0674, 37.3556, 5895, 'Tanzanie', 'Kilimanjaro', '{"prominence":5885,"difficulty":"hard","massif":"Kilimanjaro"}'::JSONB, 'seed'),
    (gen_random_uuid(), 'summit', 'Pic du Canigou', 'Montagne sacree des Catalans', 42.5196, 2.4561, 2784, 'France', 'Pyrenees-Orientales', '{"prominence":1500,"difficulty":"moderate","massif":"Pyrenees"}'::JSONB, 'seed'),
    -- Refuges
    (gen_random_uuid(), 'refuge', 'Refuge du Gouter', 'Refuge d altitude sur la voie normale du Mont Blanc', 45.8447, 6.8427, 3835, 'France', 'Haute-Savoie', '{"capacity":120,"is_staffed":true,"price_per_night":75,"has_meals":true}'::JSONB, 'seed'),
    (gen_random_uuid(), 'refuge', 'Refuge des Oulettes de Gaube', 'Face au Vignemale dans les Pyrenees', 42.8012, 0.1234, 2151, 'France', 'Hautes-Pyrenees', '{"capacity":70,"is_staffed":true,"price_per_night":50,"has_meals":true}'::JSONB, 'seed'),
    (gen_random_uuid(), 'refuge', 'Refuge de la Vanoise', 'Au coeur du Parc National de la Vanoise', 45.3456, 6.7890, 2732, 'France', 'Savoie', '{"capacity":80,"is_staffed":true,"price_per_night":52,"has_meals":true}'::JSONB, 'seed'),
    (gen_random_uuid(), 'refuge', 'Refuge du Plan de l Aiguille', 'Refuge accessible depuis Chamonix', 45.8934, 6.8756, 2207, 'France', 'Haute-Savoie', '{"capacity":60,"is_staffed":true,"price_per_night":48,"has_meals":true}'::JSONB, 'seed'),
    (gen_random_uuid(), 'refuge', 'Rifugio Torino', 'Refuge franco-italien au Col du Geant', 45.8634, 6.9876, 3375, 'Italie', 'Val d Aoste', '{"capacity":100,"is_staffed":true,"price_per_night":65,"has_meals":true}'::JSONB, 'seed'),
    -- Water points
    (gen_random_uuid(), 'water', 'Source du Merlet', 'Source naturelle au-dessus de Chamonix', 45.8756, 6.8234, 1850, 'France', 'Haute-Savoie', '{"water_type":"spring","is_potable":true,"is_seasonal":false}'::JSONB, 'seed'),
    (gen_random_uuid(), 'water', 'Lac Blanc', 'Lac glaciaire avec eau potable filtree', 45.9123, 6.9012, 2352, 'France', 'Haute-Savoie', '{"water_type":"lake","is_potable":true,"is_seasonal":false}'::JSONB, 'seed'),
    (gen_random_uuid(), 'water', 'Fontaine du Pont d Espagne', 'Fontaine au depart du sentier', 42.8934, 0.1567, 1496, 'France', 'Hautes-Pyrenees', '{"water_type":"fountain","is_potable":true,"is_seasonal":false}'::JSONB, 'seed'),
    (gen_random_uuid(), 'water', 'Lac de Gaube', 'Lac de montagne avec eau potable', 42.8234, 0.1345, 1725, 'France', 'Hautes-Pyrenees', '{"water_type":"lake","is_potable":true,"is_seasonal":false}'::JSONB, 'seed'),
    -- Viewpoints
    (gen_random_uuid(), 'viewpoint', 'Aiguille du Midi', 'Panorama exceptionnel sur le Mont Blanc', 45.8790, 6.8873, 3842, 'France', 'Haute-Savoie', '{"accessible_by_cable_car":true}'::JSONB, 'seed'),
    (gen_random_uuid(), 'viewpoint', 'Pic du Midi de Bigorre', 'Observatoire et panorama 360 degres', 42.9368, 0.1413, 2877, 'France', 'Hautes-Pyrenees', '{"accessible_by_cable_car":true,"has_observatory":true}'::JSONB, 'seed'),
    -- Waterfalls
    (gen_random_uuid(), 'waterfall', 'Cascade du Cirque de Gavarnie', 'La plus haute cascade d Europe', 42.7345, 0.0234, 1573, 'France', 'Hautes-Pyrenees', '{"height_m":423}'::JSONB, 'seed'),
    (gen_random_uuid(), 'waterfall', 'Cascade de Skogafoss', 'Cascade islandaise mythique', 63.5320, -19.5118, 60, 'Islande', 'Sud', '{"height_m":60,"width_m":25}'::JSONB, 'seed'),
    -- Camping
    (gen_random_uuid(), 'camping', 'Bivouac Lac Blanc', 'Zone de bivouac autorisee au Lac Blanc', 45.9100, 6.9000, 2340, 'France', 'Haute-Savoie', '{"is_authorized":true,"max_nights":1}'::JSONB, 'seed'),
    (gen_random_uuid(), 'camping', 'Camping Pont d Espagne', 'Camping au pied des Pyrenees', 42.8900, 0.1550, 1490, 'France', 'Hautes-Pyrenees', '{"is_authorized":true,"has_facilities":true}'::JSONB, 'seed'),
    -- Cols
    (gen_random_uuid(), 'col', 'Col du Galibier', 'Col mythique du Tour de France', 45.0640, 6.4080, 2642, 'France', 'Savoie', '{"is_road_pass":true,"cycling_famous":true}'::JSONB, 'seed'),
    (gen_random_uuid(), 'col', 'Col de la Bonette', 'La plus haute route d Europe', 44.3220, 6.8060, 2802, 'France', 'Alpes-Maritimes', '{"is_road_pass":true,"cycling_famous":true}'::JSONB, 'seed')
  ON CONFLICT (id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Outdoor world engine seed failed: %', SQLERRM;
END $$;
