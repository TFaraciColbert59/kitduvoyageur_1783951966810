-- ============================================================================
-- Migration additive et rétrocompatible : Tables normalisées des sources et révisions
-- Socle randonnée LKDV & Explorer Mobile OSM
-- Remplace tout stockage JSON caché par un modèle relationnel explicite et auditable :
-- hiking_routes (id canonique) -> hiking_route_sources -> hiking_route_revisions
-- ============================================================================

-- 1. Nettoyage de la donnée aberrante et contrainte d'intégrité
DELETE FROM public.trail_metadata WHERE id = 1322 AND trail_id = 140;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trail_metadata_trail_id_key'
  ) THEN
    ALTER TABLE public.trail_metadata ADD CONSTRAINT trail_metadata_trail_id_key UNIQUE (trail_id);
  END IF;
END $$;

DELETE FROM public.hiking_routes WHERE id = 1790027540898 AND osm_relation_id = 990027540898;

-- 2. Garantit la séquence RouteId sur hiking_routes.id
DO $$
DECLARE
  v_max_id bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'hiking_routes_id_seq' AND relkind = 'S') THEN
    SELECT coalesce(max(id), 0) + 1 INTO v_max_id FROM public.hiking_routes;
    EXECUTE 'CREATE SEQUENCE IF NOT EXISTS public.hiking_routes_id_seq START WITH ' || v_max_id;
    ALTER TABLE public.hiking_routes ALTER COLUMN id SET DEFAULT nextval('public.hiking_routes_id_seq');
    ALTER SEQUENCE public.hiking_routes_id_seq OWNED BY public.hiking_routes.id;
  END IF;
END $$;

-- 3. Table normalisée des sources externes (multi-fournisseurs : OSM, IGN, etc.)
CREATE TABLE IF NOT EXISTS public.hiking_route_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id bigint NOT NULL REFERENCES public.hiking_routes(id) ON DELETE CASCADE,
  provider text NOT NULL,                    -- ex: 'openstreetmap', 'ign'
  external_type text NOT NULL DEFAULT 'relation', -- ex: 'relation', 'way'
  external_id text NOT NULL,                 -- identifiant string pour flexibilité multi-fournisseur
  source_version text,                       -- version amont (OSM version)
  source_timestamp timestamptz,              -- timestamp amont du changeset
  license text DEFAULT 'ODbL-1.0',
  fetched_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_hiking_route_sources_provider_external UNIQUE (provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_hiking_route_sources_route_id ON public.hiking_route_sources(route_id);
CREATE INDEX IF NOT EXISTS idx_hiking_route_sources_lookup ON public.hiking_route_sources(provider, external_id);

ALTER TABLE public.hiking_route_sources ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'public_read_hiking_route_sources' AND polrelid = 'public.hiking_route_sources'::regclass
  ) THEN
    CREATE POLICY "public_read_hiking_route_sources" ON public.hiking_route_sources FOR SELECT USING (true);
  END IF;
END $$;

-- 4. Table normalisée des révisions géométriques et statut de qualité
CREATE TABLE IF NOT EXISTS public.hiking_route_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id bigint NOT NULL REFERENCES public.hiking_routes(id) ON DELETE CASCADE,
  revision_number integer NOT NULL DEFAULT 1,
  geometry_hash text NOT NULL,
  source_version text,
  quality text NOT NULL DEFAULT 'complete',  -- 'complete' | 'partial' | 'unavailable' | 'source_deleted'
  is_current boolean NOT NULL DEFAULT true,
  geom geometry(MultiLineString, 4326),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_hiking_route_revisions_route_rev UNIQUE (route_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_hiking_route_revisions_route_id ON public.hiking_route_revisions(route_id);
CREATE INDEX IF NOT EXISTS idx_hiking_route_revisions_current ON public.hiking_route_revisions(route_id) WHERE is_current = true;

ALTER TABLE public.hiking_route_revisions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'public_read_hiking_route_revisions' AND polrelid = 'public.hiking_route_revisions'::regclass
  ) THEN
    CREATE POLICY "public_read_hiking_route_revisions" ON public.hiking_route_revisions FOR SELECT USING (true);
  END IF;
END $$;

-- 5. Backfill initial des sources et révisions existantes
INSERT INTO public.hiking_route_sources (route_id, provider, external_type, external_id, source_version, source_timestamp, fetched_at)
SELECT 
  id, 
  'openstreetmap', 
  'relation', 
  osm_relation_id::text, 
  NULL, 
  created_at, 
  created_at
FROM public.hiking_routes
WHERE osm_relation_id IS NOT NULL
ON CONFLICT (provider, external_id) DO NOTHING;

INSERT INTO public.hiking_route_revisions (route_id, revision_number, geometry_hash, quality, is_current, geom, created_at)
SELECT 
  id,
  1,
  COALESCE(md5(ST_AsBinary(geom)), 'no_geom'),
  CASE WHEN geom IS NULL THEN 'unavailable' ELSE 'complete' END,
  true,
  geom,
  created_at
FROM public.hiking_routes
ON CONFLICT (route_id, revision_number) DO NOTHING;
