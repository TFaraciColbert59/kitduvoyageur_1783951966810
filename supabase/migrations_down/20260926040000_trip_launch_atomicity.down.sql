-- ============================================================================
-- Rollback du lancement atomique d'activite.
-- ============================================================================

BEGIN;

REVOKE ALL ON FUNCTION public.fail_trip_launch(uuid, bigint, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.complete_trip_launch(uuid, bigint, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_trip_launch(uuid, bigint) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.trip_launches_touch_updated_at() FROM PUBLIC, anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.fail_trip_launch(uuid, bigint, uuid, text);
DROP FUNCTION IF EXISTS public.complete_trip_launch(uuid, bigint, uuid);
DROP FUNCTION IF EXISTS public.claim_trip_launch(uuid, bigint);
DROP FUNCTION IF EXISTS public.trip_launches_touch_updated_at();

DROP TRIGGER IF EXISTS trg_trip_launches_updated_at ON public.trip_launches;

DROP TABLE IF EXISTS public.trip_launches;

COMMIT;