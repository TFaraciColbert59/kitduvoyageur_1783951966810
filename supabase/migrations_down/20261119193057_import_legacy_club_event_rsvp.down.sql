DROP VIEW IF EXISTS public.club_event_registrations_effective;

-- Conserver toute inscription dont l'état ou les métadonnées ont été modifiés.
DELETE FROM public.club_event_registrations
WHERE imported_legacy_rsvp_at IS NOT NULL
  AND status = 'registered'
  AND registered_at = imported_legacy_rsvp_at
  AND updated_at = imported_legacy_rsvp_at
  AND pace_group_id IS NULL AND invited_by_user_id IS NULL AND invite_id IS NULL;

ALTER TABLE public.club_event_registrations DROP COLUMN imported_legacy_rsvp_at;
