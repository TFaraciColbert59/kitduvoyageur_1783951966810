-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Fix admin RLS + missing role column + shop_products policies
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Problems fixed:
--   1. user_profiles has no `role` column → middleware admin check broken
--   2. shop_products allows ALL authenticated users full write access (P0)
--   3. carnet_gear_links has RLS disabled
-- ═══════════════════════════════════════════════════════════════════════════

-- ── PART A: Add role column to user_profiles ──────────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin', 'moderator'));

-- ── PART B: is_admin helper function ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

-- ── PART C: Fix shop_products RLS policies ────────────────────────────────
-- Drop the overly permissive policies that allow ANY authenticated user to write
DROP POLICY IF EXISTS "admin_manage_shop_products" ON public.shop_products;
DROP POLICY IF EXISTS "auth_admin_write_shop_products" ON public.shop_products;

-- Re-create admin-only write policy
CREATE POLICY "admin_write_shop_products" ON public.shop_products
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── PART D: Enable RLS on carnet_gear_links ───────────────────────────────
ALTER TABLE public.carnet_gear_links ENABLE ROW LEVEL SECURITY;

-- Public read policy for carnet_gear_links (matching other content tables)
CREATE POLICY "public_read_carnet_gear_links" ON public.carnet_gear_links
  FOR SELECT
  TO public
  USING (true);

-- ── PART E: Set existing admin users ──────────────────────────────────────
-- NOTE: After running this migration, run the following SQL to promote users:
-- UPDATE public.user_profiles SET role = 'admin' WHERE email = 'admin@example.com';
-- This is left as a manual step since we don't know which users should be admin.
