-- Enable Row Level Security on spatial_ref_sys
-- La table appartient au superuser PostGIS ; l'activation RLS peut échouer
-- selon le rôle de connexion. Garde-fou idempotent et résilient.
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'spatial_ref_sys RLS skipped (insufficient privilege)';
  END;
END $$;

-- Optional: add a permissive policy if needed (currently read‑only access)
-- CREATE POLICY "public_read" ON public.spatial_ref_sys FOR SELECT USING (true);
