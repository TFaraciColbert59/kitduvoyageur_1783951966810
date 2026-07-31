-- Chantier 5: clubs table had RLS enabled but NO SELECT policy.
-- 20260728160000_fix_permissive_rls_policies.sql assumed "clubs_read"/"public_read_clubs"
-- already existed (they had been dropped), so it only created auth_update_clubs / auth_delete_clubs.
-- Result: every client SELECT on clubs returned zero rows (list empty on mobile/desktop,
-- detail page fell back to FAKE club data).

DROP POLICY IF EXISTS "clubs_read" ON public.clubs;
DROP POLICY IF EXISTS "public_read_clubs" ON public.clubs;

CREATE POLICY "clubs_read" ON public.clubs
  FOR SELECT TO public
  USING (true);
