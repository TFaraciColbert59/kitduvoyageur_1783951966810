-- ============================================================
-- Migration: Admin Products Management
-- Timestamp: 20260715230000
-- ============================================================

-- ── 1. Add soft delete to shop_products ──────────────────────────────────────
ALTER TABLE public.shop_products
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;

-- ── 2. Table admin_audit_logs ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email TEXT NOT NULL DEFAULT 'admin',
  action TEXT NOT NULL,
  target_table TEXT NOT NULL DEFAULT 'shop_products',
  target_id TEXT NOT NULL,
  target_name TEXT DEFAULT '',
  old_data JSONB DEFAULT NULL,
  new_data JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.admin_audit_logs(target_table, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.admin_audit_logs(created_at DESC);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_audit_logs" ON public.admin_audit_logs;
CREATE POLICY "admin_read_audit_logs"
  ON public.admin_audit_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_audit_logs" ON public.admin_audit_logs;
CREATE POLICY "admin_insert_audit_logs"
  ON public.admin_audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ── 3. Table product_images ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  storage_path TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  alt TEXT DEFAULT '',
  is_primary BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images(product_id);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_product_images" ON public.product_images;
CREATE POLICY "public_read_product_images"
  ON public.product_images FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_manage_product_images" ON public.product_images;
CREATE POLICY "auth_manage_product_images"
  ON public.product_images FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 4. RLS policies for shop_products admin write ─────────────────────────────
DROP POLICY IF EXISTS "auth_admin_write_shop_products" ON public.shop_products;
CREATE POLICY "auth_admin_write_shop_products"
  ON public.shop_products FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 5. RLS policies for product_compatibilities admin write ───────────────────
DROP POLICY IF EXISTS "auth_admin_write_compatibilities" ON public.product_compatibilities;
CREATE POLICY "auth_admin_write_compatibilities"
  ON public.product_compatibilities FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 6. RLS policies for product_alternatives admin write ─────────────────────
DROP POLICY IF EXISTS "auth_admin_write_alternatives" ON public.product_alternatives;
CREATE POLICY "auth_admin_write_alternatives"
  ON public.product_alternatives FOR ALL TO authenticated USING (true) WITH CHECK (true);
