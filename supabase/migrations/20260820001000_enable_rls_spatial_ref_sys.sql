-- Enable Row Level Security on spatial_ref_sys
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

-- Optional: add a permissive policy if needed (currently read‑only access)
-- CREATE POLICY "public_read" ON public.spatial_ref_sys FOR SELECT USING (true);
