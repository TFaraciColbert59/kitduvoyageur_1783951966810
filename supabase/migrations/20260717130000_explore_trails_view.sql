-- ============================================================
-- Explorer: explore_trails view + adventure score columns
-- Timestamp: 20260717130000
-- ============================================================

-- Add adventure score columns to hiking_trails if not present
ALTER TABLE public.hiking_trails
ADD COLUMN IF NOT EXISTS adventure_score   INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS nature_score      INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS panorama_score    INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS accessibility_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS challenge_score   INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS services_score    INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_description    TEXT,
ADD COLUMN IF NOT EXISTS terrain_type      TEXT,
ADD COLUMN IF NOT EXISTS family_friendly   BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS season            TEXT,
ADD COLUMN IF NOT EXISTS activity_type     TEXT DEFAULT 'hiking',
ADD COLUMN IF NOT EXISTS ref               TEXT,
ADD COLUMN IF NOT EXISTS network           TEXT,
ADD COLUMN IF NOT EXISTS has_water         BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_refuge        BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_camping       BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_peak          BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_viewpoint     BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_parking       BOOLEAN DEFAULT false;

-- Create the explore_trails view
CREATE OR REPLACE VIEW public.explore_trails AS
SELECT
  id,
  name,
  ref,
  network,
  geojson                                                    AS geometry,
  COALESCE(distance_km, 0)                                   AS distance_km,
  COALESCE(duration_hours, 0)                                AS duration_hours,
  COALESCE(difficulty, 'moderate')                           AS difficulty,
  COALESCE(elevation_gain_m, 0)                              AS elevation_gain,
  terrain_type,
  COALESCE(family_friendly, false)                           AS family_friendly,
  season,
  ai_description,
  -- Adventure scores (computed if zero)
  CASE WHEN adventure_score > 0 THEN adventure_score
       ELSE GREATEST(20, LEAST(100,
         CASE difficulty
           WHEN 'easy'     THEN 55
           WHEN 'moderate' THEN 70
           WHEN 'hard'     THEN 82
           WHEN 'expert'   THEN 92
           ELSE 65
         END
         + COALESCE(elevation_gain_m, 0) / 100
       ))
  END                                                        AS adventure_score,
  CASE WHEN nature_score > 0 THEN nature_score
       ELSE GREATEST(40, LEAST(100, 60 + COALESCE(elevation_gain_m, 0) / 80))
  END                                                        AS nature_score,
  CASE WHEN panorama_score > 0 THEN panorama_score
       ELSE GREATEST(30, LEAST(100, 50 + COALESCE(elevation_gain_m, 0) / 60))
  END                                                        AS panorama_score,
  CASE WHEN accessibility_score > 0 THEN accessibility_score
       ELSE CASE difficulty
              WHEN 'easy'     THEN 90
              WHEN 'moderate' THEN 70
              WHEN 'hard'     THEN 45
              WHEN 'expert'   THEN 25
              ELSE 60
            END
  END                                                        AS accessibility_score,
  CASE WHEN challenge_score > 0 THEN challenge_score
       ELSE CASE difficulty
              WHEN 'easy'     THEN 30
              WHEN 'moderate' THEN 55
              WHEN 'hard'     THEN 78
              WHEN 'expert'   THEN 95
              ELSE 50
            END
  END                                                        AS challenge_score,
  CASE WHEN services_score > 0 THEN services_score
       ELSE 50
  END                                                        AS services_score,
  -- POI flags
  COALESCE(has_water, false)     AS water,
  COALESCE(has_refuge, false)    AS refuge,
  COALESCE(has_camping, false)   AS camping,
  COALESCE(has_peak, false)      AS peak,
  COALESCE(has_viewpoint, false) AS viewpoint,
  COALESCE(has_parking, false)   AS parking,
  -- Coordinates for map centering
  start_lat,
  start_lng,
  bbox_min_lat,
  bbox_min_lng,
  bbox_max_lat,
  bbox_max_lng
FROM public.hiking_trails
WHERE geojson IS NOT NULL;

-- Grant public read access on the view
GRANT SELECT ON public.explore_trails TO anon, authenticated;

-- Seed a few sample trails with GeoJSON so the map has data to display
DO $$
BEGIN
  -- Only insert if table is empty or has no geojson data
  IF NOT EXISTS (SELECT 1 FROM public.hiking_trails WHERE geojson IS NOT NULL LIMIT 1) THEN
    INSERT INTO public.hiking_trails (
      id, name, difficulty, distance_km, elevation_gain_m, duration_hours,
      region, country, geojson, start_lat, start_lng, end_lat, end_lng,
      bbox_min_lat, bbox_min_lng, bbox_max_lat, bbox_max_lng,
      is_loop, source, terrain_type, family_friendly, season,
      ai_description, adventure_score, nature_score, panorama_score,
      accessibility_score, challenge_score, services_score,
      has_water, has_refuge, has_viewpoint, has_peak
    ) VALUES
    (
      gen_random_uuid(),
      'Tour du Mont Blanc — Étape Chamonix',
      'hard',
      19.5, 1400, 7.5,
      'Haute-Savoie', 'France',
      '{"type":"LineString","coordinates":[[6.8694,45.9237],[6.8750,45.9300],[6.8820,45.9380],[6.8900,45.9450],[6.9000,45.9520],[6.9100,45.9600],[6.9200,45.9680],[6.9300,45.9750],[6.9400,45.9820],[6.9500,45.9900]]}',
      45.9237, 6.8694, 45.9900, 6.9500,
      45.9237, 6.8694, 45.9900, 6.9500,
      false, 'manual', 'Alpin', false, 'Juin–Septembre',
      'Une étape mythique du Tour du Mont Blanc offrant des panoramas à couper le souffle sur les glaciers et les aiguilles de Chamonix.',
      88, 85, 95, 40, 82, 65,
      true, true, true, true
    ),
    (
      gen_random_uuid(),
      'Sentier des Crêtes — Vosges',
      'moderate',
      14.2, 520, 4.5,
      'Vosges', 'France',
      '{"type":"LineString","coordinates":[[7.0500,48.0200],[7.0600,48.0280],[7.0700,48.0360],[7.0800,48.0440],[7.0900,48.0520],[7.1000,48.0600],[7.1100,48.0680],[7.1200,48.0750]]}',
      48.0200, 7.0500, 48.0750, 7.1200,
      48.0200, 7.0500, 48.0750, 7.1200,
      false, 'manual', 'Forêt & Crêtes', true, 'Avril–Octobre',
      'Le sentier des crêtes des Vosges traverse des forêts de sapins et offre des vues panoramiques sur la plaine d''Alsace et les Alpes par temps clair.',
      72, 80, 75, 75, 55, 70,
      true, false, true, false
    ),
    (
      gen_random_uuid(),
      'GR 20 — Traversée de la Corse (Nord)',
      'expert',
      45.0, 3200, 18.0,
      'Haute-Corse', 'France',
      '{"type":"LineString","coordinates":[[9.1500,42.4500],[9.1600,42.4600],[9.1700,42.4700],[9.1800,42.4800],[9.1900,42.4900],[9.2000,42.5000],[9.2100,42.5100],[9.2200,42.5200],[9.2300,42.5300],[9.2400,42.5400],[9.2500,42.5500]]}',
      42.4500, 9.1500, 42.5500, 9.2500,
      42.4500, 9.1500, 42.5500, 9.2500,
      false, 'manual', 'Haute montagne', false, 'Juin–Septembre',
      'Le GR 20 est considéré comme l''un des sentiers de grande randonnée les plus difficiles d''Europe. Une aventure sauvage au cœur des montagnes corses.',
      96, 92, 98, 20, 98, 45,
      true, true, true, true
    ),
    (
      gen_random_uuid(),
      'Boucle du Lac d''Annecy',
      'easy',
      42.0, 350, 10.0,
      'Haute-Savoie', 'France',
      '{"type":"LineString","coordinates":[[6.1200,45.8800],[6.1300,45.8850],[6.1400,45.8900],[6.1500,45.8950],[6.1600,45.9000],[6.1700,45.9050],[6.1800,45.9100],[6.1900,45.9150],[6.2000,45.9200],[6.2100,45.9150],[6.2200,45.9100],[6.2100,45.9000],[6.2000,45.8950],[6.1900,45.8900],[6.1800,45.8850],[6.1700,45.8800],[6.1600,45.8750],[6.1500,45.8700],[6.1400,45.8750],[6.1300,45.8800],[6.1200,45.8800]]}',
      45.8800, 6.1200, 45.9200, 6.2200,
      45.8700, 6.1200, 45.9200, 6.2200,
      true, 'manual', 'Lac & Plaine', true, 'Toute l''année',
      'Le tour du lac d''Annecy est une randonnée accessible à tous, longeant les rives du plus beau lac des Alpes avec des vues constantes sur les montagnes environnantes.',
      62, 88, 80, 95, 28, 85,
      true, false, true, false
    ),
    (
      gen_random_uuid(),
      'Chemin de Stevenson — GR 70',
      'moderate',
      22.0, 680, 7.0,
      'Lozère', 'France',
      '{"type":"LineString","coordinates":[[3.8800,44.5200],[3.8900,44.5280],[3.9000,44.5360],[3.9100,44.5440],[3.9200,44.5520],[3.9300,44.5600],[3.9400,44.5680],[3.9500,44.5750],[3.9600,44.5820]]}',
      44.5200, 3.8800, 44.5820, 3.9600,
      44.5200, 3.8800, 44.5820, 3.9600,
      false, 'manual', 'Causses & Cévennes', true, 'Avril–Octobre',
      'Sur les traces de Robert Louis Stevenson et son âne Modestine, ce chemin traverse les paysages sauvages des Cévennes classés au patrimoine mondial de l''UNESCO.',
      74, 82, 70, 72, 58, 68,
      true, false, true, false
    ),
    (
      gen_random_uuid(),
      'Pic du Midi d''Ossau',
      'hard',
      12.5, 1100, 6.0,
      'Pyrénées-Atlantiques', 'France',
      '{"type":"LineString","coordinates":[[-0.4400,42.8400],[-0.4350,42.8450],[-0.4300,42.8500],[-0.4250,42.8550],[-0.4200,42.8600],[-0.4150,42.8650],[-0.4100,42.8700],[-0.4050,42.8750]]}',
      42.8400, -0.4400, 42.8750, -0.4050,
      42.8400, -0.4400, 42.8750, -0.4050,
      false, 'manual', 'Haute montagne', false, 'Juillet–Septembre',
      'Le Pic du Midi d''Ossau est l''emblème des Pyrénées béarnaises. Son ascension récompense les randonneurs aguerris par des panoramas exceptionnels sur la chaîne pyrénéenne.',
      86, 88, 92, 38, 85, 55,
      true, true, true, true
    ),
    (
      gen_random_uuid(),
      'Gorges du Verdon — Sentier Martel',
      'moderate',
      15.0, 650, 6.5,
      'Alpes-de-Haute-Provence', 'France',
      '{"type":"LineString","coordinates":[[6.3200,43.7500],[6.3300,43.7550],[6.3400,43.7600],[6.3500,43.7650],[6.3600,43.7700],[6.3700,43.7750],[6.3800,43.7800],[6.3900,43.7850],[6.4000,43.7900]]}',
      43.7500, 6.3200, 43.7900, 6.4000,
      43.7500, 6.3200, 43.7900, 6.4000,
      false, 'manual', 'Canyon & Rivière', false, 'Avril–Octobre',
      'Le sentier Martel est la randonnée emblématique des Gorges du Verdon, le plus grand canyon d''Europe. Un parcours spectaculaire entre falaises calcaires et eaux turquoise.',
      80, 90, 88, 55, 68, 60,
      true, false, true, false
    ),
    (
      gen_random_uuid(),
      'Traversée du Massif des Écrins',
      'expert',
      38.0, 2800, 16.0,
      'Hautes-Alpes', 'France',
      '{"type":"LineString","coordinates":[[6.3500,44.9200],[6.3600,44.9300],[6.3700,44.9400],[6.3800,44.9500],[6.3900,44.9600],[6.4000,44.9700],[6.4100,44.9800],[6.4200,44.9900],[6.4300,45.0000],[6.4400,45.0100]]}',
      44.9200, 6.3500, 45.0100, 6.4400,
      44.9200, 6.3500, 45.0100, 6.4400,
      false, 'manual', 'Haute montagne & Glacier', false, 'Juillet–Août',
      'La traversée du massif des Écrins est une aventure alpine de haute volée, entre glaciers, cols d''altitude et sommets à plus de 4000 mètres. Réservée aux alpinistes expérimentés.',
      98, 94, 97, 15, 99, 40,
      true, true, true, true
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Sample trail seeding skipped: %', SQLERRM;
END $$;
