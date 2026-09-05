-- ==============================================================================
-- CHANTIER 4 — LIEUX COMMUNAUTAIRES (PLACES, TOPO, AVIS, SCORING, FLOUTAGE)
-- Migration: 20260905110000_community_places.sql
-- ==============================================================================

-- 1. Table places
CREATE TABLE IF NOT EXISTS public.places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'refuge', 'bivouac', 'water_source', 'viewpoint', 'pass',
    'campground', 'poi', 'summit', 'lake', 'cave', 'historical'
  )),
  country_code TEXT NOT NULL REFERENCES public.countries_geo(iso_a2) ON DELETE CASCADE,
  region TEXT,
  city TEXT,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  geom GEOGRAPHY(Point, 4326),
  altitude_m INT,
  description TEXT,
  sensitivity TEXT NOT NULL DEFAULT 'standard' CHECK (sensitivity IN ('standard', 'sensitive', 'protected')),
  source TEXT NOT NULL DEFAULT 'curated' CHECK (source IN ('curated', 'community', 'osm')),
  osm_id TEXT,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  practical_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  bayesian_rating NUMERIC(3, 2) NOT NULL DEFAULT 0.0,
  reviews_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Triggers pour synchroniser geom PostGIS
CREATE OR REPLACE FUNCTION public.sync_place_geom()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_place_geom ON public.places;
CREATE TRIGGER trg_sync_place_geom
  BEFORE INSERT OR UPDATE OF latitude, longitude ON public.places
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_place_geom();

-- Index spatiaux et recherche
CREATE INDEX IF NOT EXISTS idx_places_country ON public.places(country_code);
CREATE INDEX IF NOT EXISTS idx_places_category ON public.places(category);
CREATE INDEX IF NOT EXISTS idx_places_geom ON public.places USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_places_bayesian ON public.places(bayesian_rating DESC, reviews_count DESC);

-- 2. Table place_reviews
CREATE TABLE IF NOT EXISTS public.place_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  has_field_proof BOOLEAN NOT NULL DEFAULT false,
  visit_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_place_reviews_place_author UNIQUE (place_id, author_id)
);

CREATE INDEX IF NOT EXISTS idx_place_reviews_place ON public.place_reviews(place_id);
CREATE INDEX IF NOT EXISTS idx_place_reviews_author ON public.place_reviews(author_id);

-- Fonction de recalcul bayésien après avis
-- Bayesian formula: (C * m + sum(ratings * weight)) / (C + sum(weight))
-- avec C = 3 (poids a priori), m = 3.5 (moyenne a priori)
-- et poids x2 pour les avis certifiés terrain (has_field_proof = true)
CREATE OR REPLACE FUNCTION public.recalculate_place_rating()
RETURNS TRIGGER AS $$
DECLARE
  target_place_id UUID;
  v_count INT;
  v_weighted_sum NUMERIC;
  v_weighted_count NUMERIC;
  v_bayesian NUMERIC(3, 2);
  C CONSTANT NUMERIC := 3.0;
  m CONSTANT NUMERIC := 3.5;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_place_id := OLD.place_id;
  ELSE
    target_place_id := NEW.place_id;
  END IF;

  SELECT 
    COUNT(*),
    COALESCE(SUM(rating * (CASE WHEN has_field_proof THEN 2.0 ELSE 1.0 END)), 0),
    COALESCE(SUM(CASE WHEN has_field_proof THEN 2.0 ELSE 1.0 END), 0)
  INTO v_count, v_weighted_sum, v_weighted_count
  FROM public.place_reviews
  WHERE place_id = target_place_id;

  IF v_count = 0 THEN
    v_bayesian := 0.0;
  ELSE
    v_bayesian := ROUND(((C * m + v_weighted_sum) / (C + v_weighted_count))::numeric, 2);
  END IF;

  UPDATE public.places
  SET 
    reviews_count = v_count,
    bayesian_rating = v_bayesian,
    updated_at = now()
  WHERE id = target_place_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalculate_place_rating ON public.place_reviews;
CREATE TRIGGER trg_recalculate_place_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.place_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_place_rating();

-- 3. Table place_photos
CREATE TABLE IF NOT EXISTS public.place_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  has_exif_stripped BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_place_photos_place ON public.place_photos(place_id);

-- 4. Table place_reports (modération & sécurité environnementale/physique)
CREATE TABLE IF NOT EXISTS public.place_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'overcrowding', 'environmental_damage', 'safety_hazard', 'inaccurate_info', 'private_property', 'other'
  )),
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_place_reports_place ON public.place_reports(place_id);
CREATE INDEX IF NOT EXISTS idx_place_reports_status ON public.place_reports(status);

-- ==============================================================================
-- RLS (ROW LEVEL SECURITY) SUR LES 4 TABLES
-- ==============================================================================

ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_reports ENABLE ROW LEVEL SECURITY;

-- 1. Policies public.places
CREATE POLICY "places_select_public"
  ON public.places FOR SELECT TO public
  USING (true);

CREATE POLICY "places_insert_authenticated"
  ON public.places FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "places_update_author"
  ON public.places FOR UPDATE TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "places_all_service"
  ON public.places FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Policies public.place_reviews
CREATE POLICY "place_reviews_select_public"
  ON public.place_reviews FOR SELECT TO public
  USING (true);

CREATE POLICY "place_reviews_insert_authenticated"
  ON public.place_reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "place_reviews_update_author"
  ON public.place_reviews FOR UPDATE TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "place_reviews_delete_author"
  ON public.place_reviews FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

CREATE POLICY "place_reviews_all_service"
  ON public.place_reviews FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Policies public.place_photos
CREATE POLICY "place_photos_select_public"
  ON public.place_photos FOR SELECT TO public
  USING (true);

CREATE POLICY "place_photos_insert_authenticated"
  ON public.place_photos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "place_photos_delete_author"
  ON public.place_photos FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

CREATE POLICY "place_photos_all_service"
  ON public.place_photos FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Policies public.place_reports
CREATE POLICY "place_reports_insert_all"
  ON public.place_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id IS NULL OR reporter_id = auth.uid());

CREATE POLICY "place_reports_select_reporter"
  ON public.place_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

CREATE POLICY "place_reports_all_service"
  ON public.place_reports FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
