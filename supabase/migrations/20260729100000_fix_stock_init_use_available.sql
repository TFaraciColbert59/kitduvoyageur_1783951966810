-- ============================================================
-- Corrective: Stock init uses `available` instead of `is_active`
-- Timestamp: 20260729100000
--
-- Context: The DO block in migration 20260715240000 used
-- `is_active = true AND deleted_at IS NULL` to select which
-- products to initialize stock for. The project's actual column
-- for product availability is `available` (defined in migration
-- 20260715200000). Columns `is_active`/`deleted_at` exist on
-- shop_products (added by migration 20260715230000 for the admin
-- soft-delete workflow only) but the public-facing availability
-- flag is `available`.
--
-- This migration re-runs the stock init using the correct column
-- to catch any products that may have been missed.
-- ============================================================

-- Re-initialize stock for active products that are still at 0
DO $$
BEGIN
  UPDATE public.shop_products
     SET stock = 10
   WHERE stock = 0 AND available = true;
  RAISE NOTICE 'Corrective stock init completed for available products';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Corrective stock init skipped: %', SQLERRM;
END $$;
