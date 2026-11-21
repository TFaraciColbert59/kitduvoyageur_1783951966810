-- Retour arrière réversible de 20261121120000_hub_live_safety_and_field_reports.sql
-- Refuse la suppression si des données réelles de sécurité ou de cycle de vie existent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.trip_lifecycle_events LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.trip_safety_contacts LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.hub_field_reports LIMIT 1) THEN
    RAISE EXCEPTION 'ROLLBACK_BLOCKED_NON_EMPTY_TABLES';
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.confirm_hub_field_report(uuid);
DROP TABLE IF EXISTS public.hub_field_report_confirmations;
DROP TABLE IF EXISTS public.hub_field_reports;
DROP TABLE IF EXISTS public.trip_safety_contacts;
DROP FUNCTION IF EXISTS public.read_trip_live_positions(uuid);
DROP FUNCTION IF EXISTS public.upsert_trip_live_position(uuid, double precision, double precision, timestamptz, double precision, integer, double precision, smallint, boolean, integer);
DROP TABLE IF EXISTS public.trip_live_positions;
DROP FUNCTION IF EXISTS public.transition_trip_lifecycle(uuid, text, uuid, text);
DROP TABLE IF EXISTS public.trip_lifecycle_events;
