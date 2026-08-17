-- Drop trails table and all dependent objects

-- Drop RLS policies first
DROP POLICY IF EXISTS "trails_public_read" ON public.trails;
DROP POLICY IF EXISTS "trails_authenticated_insert" ON public.trails;
DROP POLICY IF EXISTS "trails_authenticated_update" ON public.trails;
DROP POLICY IF EXISTS "trails_authenticated_delete" ON public.trails;
DROP POLICY IF EXISTS "public_can_read_trails" ON public.trails;
DROP POLICY IF EXISTS "users_manage_own_trails" ON public.trails;
DROP POLICY IF EXISTS "allow_read_trails" ON public.trails;
DROP POLICY IF EXISTS "allow_insert_trails" ON public.trails;
DROP POLICY IF EXISTS "allow_update_trails" ON public.trails;
DROP POLICY IF EXISTS "allow_delete_trails" ON public.trails;

-- Drop indexes
DROP INDEX IF EXISTS public.idx_trails_geojson;
DROP INDEX IF EXISTS public.idx_trails_activity_type;
DROP INDEX IF EXISTS public.idx_trails_difficulty;
DROP INDEX IF EXISTS public.idx_trails_source;
DROP INDEX IF EXISTS public.idx_trails_gps_points_count;
DROP INDEX IF EXISTS public.idx_trails_bbox;
DROP INDEX IF EXISTS public.idx_trails_name;
DROP INDEX IF EXISTS public.idx_trails_osm_id;

-- Drop foreign key references from saved_trails if they reference trails
ALTER TABLE IF EXISTS public.saved_trails
  DROP CONSTRAINT IF EXISTS saved_trails_trail_id_fkey;

-- Drop the trails table
DROP TABLE IF EXISTS public.trails CASCADE;
