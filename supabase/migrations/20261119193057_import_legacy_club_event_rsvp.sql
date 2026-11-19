-- Une ligne du registre historique est un RSVP (« oui »), pas une présence.
-- Les évènements terminés peuvent être importés. Pour les autres, la vue
-- reflète les écritures historiques encore effectuées depuis /compte.
ALTER TABLE public.club_event_registrations
  ADD COLUMN IF NOT EXISTS imported_legacy_rsvp_at timestamptz;

INSERT INTO public.club_event_registrations (
  event_id, user_id, status, registered_at, updated_at, imported_legacy_rsvp_at
)
SELECT p.event_id, p.user_id, 'registered', stamp.rsvp_at, stamp.rsvp_at, stamp.rsvp_at
FROM public.club_event_participants AS p
JOIN public.club_events AS e ON e.id = p.event_id
CROSS JOIN LATERAL (
  SELECT COALESCE((to_jsonb(p) ->> 'joined_at')::timestamptz, (to_jsonb(p) ->> 'created_at')::timestamptz) AS rsvp_at
) AS stamp
WHERE stamp.rsvp_at IS NOT NULL
  AND GREATEST(e.ends_at, e.starts_at, e.event_date) < statement_timestamp()
ON CONFLICT (event_id, user_id) DO NOTHING;

CREATE OR REPLACE VIEW public.club_event_registrations_effective
WITH (security_invoker = true)
AS
SELECT r.event_id, r.user_id, r.status, r.pace_group_id, r.invited_by_user_id,
       r.invite_id, r.registered_at, r.updated_at
FROM public.club_event_registrations AS r
UNION ALL
SELECT p.event_id, p.user_id, 'registered'::text, NULL::text, NULL::uuid,
       NULL::uuid, stamp.rsvp_at, stamp.rsvp_at
FROM public.club_event_participants AS p
JOIN public.club_events AS e ON e.id = p.event_id
CROSS JOIN LATERAL (
  SELECT COALESCE((to_jsonb(p) ->> 'joined_at')::timestamptz, (to_jsonb(p) ->> 'created_at')::timestamptz) AS rsvp_at
) AS stamp
WHERE stamp.rsvp_at IS NOT NULL
  AND ((SELECT auth.uid()) = p.user_id OR public.lkdv_is_club_moderator(e.club_id))
  AND NOT EXISTS (
    SELECT 1 FROM public.club_event_registrations AS r
    WHERE r.event_id = p.event_id AND r.user_id = p.user_id
  );

REVOKE ALL ON public.club_event_registrations_effective FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.club_event_registrations_effective TO authenticated;
