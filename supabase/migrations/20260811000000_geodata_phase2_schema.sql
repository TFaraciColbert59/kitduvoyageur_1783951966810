-- ============================================================
-- Phase 2 — Architecture BDD & modélisation géographique GeoNames
-- Consolidation du schéma de base créé par
-- 20230801000200_create_geodata_tables.sql
--
-- Ce que cette migration apporte :
--   • types + colonnes alignés sur les fichiers officiels GeoNames
--     (countryInfo.txt, admin1CodesASCII.txt, allCountries.txt,
--      alternateNamesV2.txt, hierarchy.txt)
--   • clés de référence GeoNames en texte (stable, sans JOIN)
--   • RLS lecture publique + écriture service_role (référentiel)
--   • index GiST / GIN / trigramme adaptés aux requêtes du globe
--   • triggers de mise à jour updated_at
-- ============================================================

-- ── 1. PostgreSQL / PostGIS guards ────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── 2. Types énumérés du référentiel ──────────────────────────
DO $$
BEGIN
  CREATE TYPE public.geo_feature_class AS ENUM ('A','H','L','P','R','S','T','U','V');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.geo_feature_code AS ENUM (
    'PCLI','PCL','PCLD','PCLF','PCLIX','PCLS','TERR','PCLX',
    'ADM1','ADM2','ADM3','ADM4','ADMD','PRK','H','PPL','PPLA','PPLA2','PPLA3','PPLA4','PPLC','PPLCH','PPLF','PPLG','PPLH','PPLL','PPLQ','PPLR','PPLS','PPLW','PPLX','STLMT','PSCL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.geo_country_geometry_source AS ENUM (
    'natural_earth','geonames','osm','manual'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 3. countries_geo ──────────────────────────────────────────
ALTER TABLE public.countries_geo
  ADD COLUMN IF NOT EXISTS geoname_id bigint UNIQUE,
  ADD COLUMN IF NOT EXISTS iso_a3 text,
  ADD COLUMN IF NOT EXISTS iso_numeric text,
  ADD COLUMN IF NOT EXISTS fips_code text,
  ADD COLUMN IF NOT EXISTS tld text,
  ADD COLUMN IF NOT EXISTS phone_code text,
  ADD COLUMN IF NOT EXISTS currency_code text,
  ADD COLUMN IF NOT EXISTS currency_name text,
  ADD COLUMN IF NOT EXISTS postal_code_format text,
  ADD COLUMN IF NOT EXISTS postal_code_regex text,
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS neighbours text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS area_km2 double precision,
  ADD COLUMN IF NOT EXISTS name_ascii text,
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS name_short text,
  ADD COLUMN IF NOT EXISTS geometry_source public.geo_country_geometry_source NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS is_sovereign boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_countries_geo_iso_a3 ON public.countries_geo (iso_a3);
CREATE INDEX IF NOT EXISTS idx_countries_geo_continent ON public.countries_geo (continent);
CREATE INDEX IF NOT EXISTS idx_countries_geo_geoname_id ON public.countries_geo (geoname_id);
-- Recherche floue/libre sur les noms (ILOVEYOU / auto-complétion du globe)
CREATE INDEX IF NOT EXISTS idx_countries_geo_name_trgm ON public.countries_geo USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_countries_geo_name_trgm_ascii ON public.countries_geo USING GIN (name_ascii gin_trgm_ops);

-- Géométrie : le référentiel mélange POINT (capitales GeoNames,
-- seed Natural Earth) et POLYGON (contours Natural Earth 1:50m,
-- importés en Phase 6). On lève la contrainte de type POLYGON du
-- schéma initial pour accepter les deux ; l'index GiST existant
-- (idx_countries_geo_geom) couvre les requêtes spatiales.
ALTER TABLE public.countries_geo
  ALTER COLUMN geometry TYPE GEOMETRY(GEOMETRY, 4326)
  USING geometry::geometry;

-- ── 4. admin_regions_geo ─────────────────────────────────────
ALTER TABLE public.admin_regions_geo
  ADD COLUMN IF NOT EXISTS geoname_id bigint UNIQUE,
  ADD COLUMN IF NOT EXISTS country_iso_a2 text,
  ADD COLUMN IF NOT EXISTS admin_code_full text,
  ADD COLUMN IF NOT EXISTS name_ascii text,
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS admin_parent_id uuid REFERENCES public.admin_regions_geo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_admin_regions_geo_country_iso ON public.admin_regions_geo (country_iso_a2);
CREATE INDEX IF NOT EXISTS idx_admin_regions_geo_admin_code ON public.admin_regions_geo (admin_code);
CREATE INDEX IF NOT EXISTS idx_admin_regions_geo_admin_code_full ON public.admin_regions_geo (admin_code_full);
CREATE INDEX IF NOT EXISTS idx_admin_regions_geo_name_trgm ON public.admin_regions_geo USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_admin_regions_geo_geoname_id ON public.admin_regions_geo (geoname_id);

-- ── 5. places_geo (cités/villes GeoNames, données allCountries.txt) ──
ALTER TABLE public.places_geo
  ADD COLUMN IF NOT EXISTS geoname_id bigint UNIQUE,
  ADD COLUMN IF NOT EXISTS country_iso_a2 text,
  ADD COLUMN IF NOT EXISTS feature_class public.geo_feature_class,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS name_ascii text,
  ADD COLUMN IF NOT EXISTS population_rank integer,
  ADD COLUMN IF NOT EXISTS is_capital boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_major_city boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_places_geo_country_iso ON public.places_geo (country_iso_a2);
CREATE INDEX IF NOT EXISTS idx_places_geo_country_population ON public.places_geo (country_iso_a2, population DESC);
CREATE INDEX IF NOT EXISTS idx_places_geo_feature_code ON public.places_geo (feature_code);
CREATE INDEX IF NOT EXISTS idx_places_geo_geoname_id ON public.places_geo (geoname_id);
CREATE INDEX IF NOT EXISTS idx_places_geo_name_trgm ON public.places_geo USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_places_geo_capital ON public.places_geo (is_capital) WHERE is_capital = true;

-- ── 6. place_names_geo = alternateNamesV2.txt ────────────────
ALTER TABLE public.place_names_geo
  ADD COLUMN IF NOT EXISTS alternate_name_id bigint,
  ADD COLUMN IF NOT EXISTS geoname_id bigint,
  ADD COLUMN IF NOT EXISTS country_iso_a2 text,
  ADD COLUMN IF NOT EXISTS is_short_name boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_colloquial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_historic boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_place_names_geo_geoname_id ON public.place_names_geo (geoname_id);
CREATE INDEX IF NOT EXISTS idx_place_names_geo_country_iso ON public.place_names_geo (country_iso_a2);
CREATE INDEX IF NOT EXISTS idx_place_names_geo_lang ON public.place_names_geo (lang);
CREATE INDEX IF NOT EXISTS idx_place_names_geo_name_trgm ON public.place_names_geo USING GIN (name gin_trgm_ops);

-- ── 7. RLS : référentiel public en lecture, écriture service_role ──
ALTER TABLE public.countries_geo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_regions_geo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places_geo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_names_geo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "geo_countries_public_read" ON public.countries_geo;
DROP POLICY IF EXISTS "geo_countries_service_write" ON public.countries_geo;
DROP POLICY IF EXISTS "geo_admin_regions_public_read" ON public.admin_regions_geo;
DROP POLICY IF EXISTS "geo_admin_regions_service_write" ON public.admin_regions_geo;
DROP POLICY IF EXISTS "geo_places_public_read" ON public.places_geo;
DROP POLICY IF EXISTS "geo_places_service_write" ON public.places_geo;
DROP POLICY IF EXISTS "geo_place_names_public_read" ON public.place_names_geo;
DROP POLICY IF EXISTS "geo_place_names_service_write" ON public.place_names_geo;

CREATE POLICY "geo_countries_public_read" ON public.countries_geo
  FOR SELECT USING (true);
CREATE POLICY "geo_countries_service_write" ON public.countries_geo
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "geo_admin_regions_public_read" ON public.admin_regions_geo
  FOR SELECT USING (true);
CREATE POLICY "geo_admin_regions_service_write" ON public.admin_regions_geo
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "geo_places_public_read" ON public.places_geo
  FOR SELECT USING (true);
CREATE POLICY "geo_places_service_write" ON public.places_geo
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "geo_place_names_public_read" ON public.place_names_geo
  FOR SELECT USING (true);
CREATE POLICY "geo_place_names_service_write" ON public.place_names_geo
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ── 8. Droits d'accès API (PostgREST) ────────────────────────
GRANT SELECT ON public.countries_geo TO anon, authenticated;
GRANT SELECT ON public.admin_regions_geo TO anon, authenticated;
GRANT SELECT ON public.places_geo TO anon, authenticated;
GRANT SELECT ON public.place_names_geo TO anon, authenticated;
GRANT ALL ON public.countries_geo TO service_role;
GRANT ALL ON public.admin_regions_geo TO service_role;
GRANT ALL ON public.places_geo TO service_role;
GRANT ALL ON public.place_names_geo TO service_role;

-- ── 9. Triggers updated_at (pattern standard du reste du schéma) ──
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_countries_geo_updated_at ON public.countries_geo;
CREATE TRIGGER trg_countries_geo_updated_at
  BEFORE UPDATE ON public.countries_geo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_admin_regions_geo_updated_at ON public.admin_regions_geo;
CREATE TRIGGER trg_admin_regions_geo_updated_at
  BEFORE UPDATE ON public.admin_regions_geo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_places_geo_updated_at ON public.places_geo;
CREATE TRIGGER trg_places_geo_updated_at
  BEFORE UPDATE ON public.places_geo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_place_names_geo_updated_at ON public.place_names_geo;
CREATE TRIGGER trg_place_names_geo_updated_at
  BEFORE UPDATE ON public.place_names_geo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

