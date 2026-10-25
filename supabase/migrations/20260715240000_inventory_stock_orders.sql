-- ============================================================
-- INVENTORY & STOCK MANAGEMENT
-- Timestamp: 20260715240000
-- ============================================================

-- 1. Orders table (tracks purchases from checkout)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT NOT NULL DEFAULT 'card',
  shipping_address JSONB NOT NULL DEFAULT '{}',
  items JSONB NOT NULL DEFAULT '[]',
  subtotal_eur NUMERIC NOT NULL DEFAULT 0,
  shipping_eur NUMERIC NOT NULL DEFAULT 0,
  total_eur NUMERIC NOT NULL DEFAULT 0,
  loyalty_points_earned INTEGER NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Order items table (individual line items)
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.shop_products(id) ON DELETE SET NULL,
  product_slug TEXT NOT NULL DEFAULT '',
  product_name TEXT NOT NULL DEFAULT '',
  product_brand TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_eur NUMERIC NOT NULL DEFAULT 0,
  total_price_eur NUMERIC NOT NULL DEFAULT 0,
  transaction_type TEXT NOT NULL DEFAULT 'achat',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Stock movements table (full audit trail)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.shop_products(id) ON DELETE CASCADE,
  product_slug TEXT NOT NULL DEFAULT '',
  product_name TEXT NOT NULL DEFAULT '',
  movement_type TEXT NOT NULL,
  quantity_change INTEGER NOT NULL,
  quantity_before INTEGER NOT NULL DEFAULT 0,
  quantity_after INTEGER NOT NULL DEFAULT 0,
  reference_type TEXT DEFAULT NULL,
  reference_id TEXT DEFAULT NULL,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Ensure stock column exists on shop_products (already added in previous migration, safe to re-add)
ALTER TABLE public.shop_products
  ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON public.stock_movements(reference_type, reference_id);

-- 6. Function: decrement stock on order (called from app layer)
CREATE OR REPLACE FUNCTION public.decrement_stock_on_order(
  p_product_id UUID,
  p_quantity INTEGER,
  p_order_id TEXT,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_stock INTEGER;
  v_product_name TEXT;
  v_product_slug TEXT;
BEGIN
  SELECT stock, name, slug
    INTO v_current_stock, v_product_name, v_product_slug
    FROM public.shop_products
   WHERE id = p_product_id;

  IF v_current_stock IS NULL THEN
    RETURN;
  END IF;

  -- Update stock (floor at 0)
  UPDATE public.shop_products
     SET stock = GREATEST(0, stock - p_quantity),
         updated_at = CURRENT_TIMESTAMP
   WHERE id = p_product_id;

  -- Record movement
  INSERT INTO public.stock_movements (
    product_id, product_slug, product_name,
    movement_type, quantity_change,
    quantity_before, quantity_after,
    reference_type, reference_id, user_id, notes
  ) VALUES (
    p_product_id, v_product_slug, v_product_name,
    'sale', -p_quantity,
    v_current_stock, GREATEST(0, v_current_stock - p_quantity),
    'order', p_order_id, p_user_id,
    'Vente via commande'
  );
END;
$$;

-- 7. Function: increment stock (restocking / purchase)
CREATE OR REPLACE FUNCTION public.increment_stock(
  p_product_id UUID,
  p_quantity INTEGER,
  p_reference_type TEXT,
  p_reference_id TEXT,
  p_user_id UUID,
  p_notes TEXT DEFAULT 'Réapprovisionnement'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_stock INTEGER;
  v_product_name TEXT;
  v_product_slug TEXT;
BEGIN
  SELECT stock, name, slug
    INTO v_current_stock, v_product_name, v_product_slug
    FROM public.shop_products
   WHERE id = p_product_id;

  IF v_current_stock IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.shop_products
     SET stock = stock + p_quantity,
         updated_at = CURRENT_TIMESTAMP
   WHERE id = p_product_id;

  INSERT INTO public.stock_movements (
    product_id, product_slug, product_name,
    movement_type, quantity_change,
    quantity_before, quantity_after,
    reference_type, reference_id, user_id, notes
  ) VALUES (
    p_product_id, v_product_slug, v_product_name,
    p_reference_type, p_quantity,
    v_current_stock, v_current_stock + p_quantity,
    p_reference_type, p_reference_id, p_user_id,
    p_notes
  );
END;
$$;

-- 8. Function: update order timestamp
CREATE OR REPLACE FUNCTION public.update_order_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- 9. Trigger on orders
DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_order_updated_at();

-- 10. Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- 11. RLS Policies — orders
DROP POLICY IF EXISTS "users_manage_own_orders" ON public.orders;
CREATE POLICY "users_manage_own_orders"
  ON public.orders FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "anon_insert_orders" ON public.orders;
CREATE POLICY "anon_insert_orders"
  ON public.orders FOR INSERT TO anon
  WITH CHECK (true);

-- 12. RLS Policies — order_items
DROP POLICY IF EXISTS "users_view_own_order_items" ON public.order_items;
CREATE POLICY "users_view_own_order_items"
  ON public.order_items FOR SELECT TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.orders WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "users_insert_order_items" ON public.order_items;
CREATE POLICY "users_insert_order_items"
  ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_insert_order_items" ON public.order_items;
CREATE POLICY "anon_insert_order_items"
  ON public.order_items FOR INSERT TO anon
  WITH CHECK (true);

-- 13. RLS Policies — stock_movements (admin read, system write via SECURITY DEFINER)
DROP POLICY IF EXISTS "public_read_stock_movements" ON public.stock_movements;
CREATE POLICY "public_read_stock_movements"
  ON public.stock_movements FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "system_insert_stock_movements" ON public.stock_movements;
CREATE POLICY "system_insert_stock_movements"
  ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (true);

-- 14. Initialize stock for existing products (set to 10 if currently 0)
DO $$
BEGIN
  UPDATE public.shop_products
     SET stock = 10
   WHERE stock = 0 AND is_active = true AND deleted_at IS NULL;
  RAISE NOTICE 'Stock initialized for existing products';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Stock init skipped: %', SQLERRM;
END $$;
