-- ============================================================================
-- Rollback du moteur unifié — additive, sans toucher activities/trips.
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.activities_by_scope(
  public.activity_logistics_scope
);

DROP TRIGGER IF EXISTS cart_lines_validate_reference ON public.cart_lines;
DROP FUNCTION IF EXISTS public.validate_cart_line_reference();

DROP TRIGGER IF EXISTS trg_cart_lines_updated_at ON public.cart_lines;
DROP TRIGGER IF EXISTS trg_bookings_updated_at ON public.bookings;
DROP TRIGGER IF EXISTS trg_activity_catalog_metrics_updated_at
  ON public.activity_catalog_metrics;
DROP TRIGGER IF EXISTS trg_activity_catalog_updated_at ON public.activity_catalog;

DROP TABLE IF EXISTS public.cart_lines;
DROP TABLE IF EXISTS public.bookings;
DROP TABLE IF EXISTS public.model_promotions;
DROP TABLE IF EXISTS public.activity_catalog_metrics;
DROP TABLE IF EXISTS public.activity_catalog;

DROP TYPE IF EXISTS public.cart_line_kind;
DROP TYPE IF EXISTS public.booking_checkout_mode;
DROP TYPE IF EXISTS public.booking_status;
DROP TYPE IF EXISTS public.booking_provider;
DROP TYPE IF EXISTS public.booking_vertical;
DROP TYPE IF EXISTS public.activity_metric_kind;
DROP TYPE IF EXISTS public.activity_logistics_scope;

COMMIT;
