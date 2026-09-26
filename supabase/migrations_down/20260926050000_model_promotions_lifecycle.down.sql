-- ============================================================================
-- Rollback du cycle de vie model_promotions (evaluate -> promote).
-- ============================================================================

BEGIN;

REVOKE ALL ON FUNCTION public.promote_model_version(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.evaluate_model_promotion(text, numeric, jsonb, boolean) FROM PUBLIC, anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.promote_model_version(text);
DROP FUNCTION IF EXISTS public.evaluate_model_promotion(text, numeric, jsonb, boolean);

DROP INDEX IF EXISTS public.model_promotions_single_promoted;

ALTER TABLE public.model_promotions
  DROP CONSTRAINT IF EXISTS model_promotions_status_chk;
ALTER TABLE public.model_promotions
  DROP COLUMN IF EXISTS promoted_by;
ALTER TABLE public.model_promotions
  DROP COLUMN IF EXISTS status;

COMMIT;