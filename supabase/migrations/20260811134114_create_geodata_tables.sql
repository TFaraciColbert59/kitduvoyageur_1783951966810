CREATE TABLE IF NOT EXISTS public.countries_geo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iso_a2 TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  continent TEXT,
  geometry GEOMETRY(POLYGON, 4326),
  population INTEGER,
  capital TEXT,
  currency TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_regions_geo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID REFERENCES public.countries_geo(id),
  admin_code TEXT,
  name TEXT NOT NULL,
  level INTEGER,
  geometry GEOMETRY(POLYGON, 4326),
  population INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.places_geo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_region_id UUID REFERENCES public.admin_regions_geo(id),
  name TEXT NOT NULL,
  feature_code TEXT,
  geometry GEOMETRY(POINT, 4326),
  elevation INTEGER,
  population INTEGER,
  timezone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.place_names_geo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID REFERENCES public.places_geo(id),
  name TEXT NOT NULL,
  lang TEXT,
  is_preferred BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Spatial indexes
CREATE INDEX IF NOT EXISTS idx_countries_geo_geom ON public.countries_geo USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_admin_regions_geo_geom ON public.admin_regions_geo USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_places_geo_geom ON public.places_geo USING GIST (geometry);

-- Full‑text search indexes on name fields
CREATE INDEX IF NOT EXISTS idx_countries_geo_name ON public.countries_geo USING GIN (to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_admin_regions_geo_name ON public.admin_regions_geo USING GIN (to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_places_geo_name ON public.places_geo USING GIN (to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_place_names_geo_name ON public.place_names_geo USING GIN (to_tsvector('simple', name));
