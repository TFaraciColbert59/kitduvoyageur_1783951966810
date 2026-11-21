DROP FUNCTION IF EXISTS public.purge_expired_hub_ephemeral_data(timestamptz);
DROP FUNCTION IF EXISTS public.assign_trip_shared_item(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.get_trip_effective_party_size(uuid);
DROP INDEX IF EXISTS public.idx_hub_field_reports_trip;
DROP INDEX IF EXISTS public.idx_trip_safety_contacts_owner;
DROP INDEX IF EXISTS public.idx_trip_lifecycle_events_actor;
