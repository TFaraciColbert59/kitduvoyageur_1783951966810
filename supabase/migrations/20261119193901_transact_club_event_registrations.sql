-- Une transaction par sortie, commune aux inscriptions, invitations et retraits.
CREATE SCHEMA IF NOT EXISTS club_private;
REVOKE ALL ON SCHEMA club_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA club_private TO authenticated;

CREATE OR REPLACE FUNCTION club_private.club_event_registered_count(p_event_id uuid)
RETURNS integer LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT (
    (SELECT count(*) FROM public.club_event_registrations AS r
     WHERE r.event_id = p_event_id AND r.status = 'registered')
    +
    (SELECT count(*) FROM public.club_event_participants AS p
     WHERE p.event_id = p_event_id
       AND COALESCE(to_jsonb(p) ->> 'joined_at', to_jsonb(p) ->> 'created_at') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.club_event_registrations AS r
         WHERE r.event_id = p.event_id AND r.user_id = p.user_id
       ))
  )::integer;
$$;
REVOKE ALL ON FUNCTION club_private.club_event_registered_count(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION club_private.transact_club_event_registration(
  p_event_id uuid, p_attending boolean, p_pace_group_id text, p_invite_token text
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  e public.club_events%ROWTYPE;
  club public.clubs%ROWTYPE;
  invite public.club_invites%ROWTYPE;
  registration public.club_event_registrations%ROWTYPE;
  member_status text;
  legacy_joined_at timestamptz;
  starts timestamptz;
  changed_at timestamptz;
  next_status text;
  promoted uuid;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;
  IF p_attending IS NULL THEN
    RAISE EXCEPTION 'Réponse d’inscription invalide.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO e FROM public.club_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sortie introuvable.' USING ERRCODE = 'P0002';
  END IF;
  changed_at := clock_timestamp();
  starts := COALESCE(e.starts_at, e.event_date);

  SELECT * INTO registration FROM public.club_event_registrations
  WHERE event_id = e.id AND user_id = actor;
  SELECT COALESCE((to_jsonb(p) ->> 'joined_at')::timestamptz, (to_jsonb(p) ->> 'created_at')::timestamptz)
    INTO legacy_joined_at
  FROM public.club_event_participants AS p
  WHERE p.event_id = e.id AND p.user_id = actor AND registration.user_id IS NULL;

  IF p_attending THEN
    IF starts IS NOT NULL AND starts <= changed_at THEN
      RAISE EXCEPTION 'Cette sortie a déjà commencé.' USING ERRCODE = '55000';
    END IF;

    SELECT * INTO club FROM public.clubs WHERE id = e.club_id;
    SELECT status INTO member_status FROM public.club_members
    WHERE club_id = e.club_id AND user_id = actor;
    IF member_status = 'banned' OR EXISTS (
      SELECT 1 FROM public.user_blocks AS b
      WHERE (b.blocker_id = actor AND b.blocked_id = e.organizer_id)
         OR (b.blocked_id = actor AND b.blocker_id = e.organizer_id)
         OR (member_status IS DISTINCT FROM 'active' AND (
           (b.blocker_id = actor AND b.blocked_id = club.created_by)
           OR (b.blocked_id = actor AND b.blocker_id = club.created_by)
         ))
    ) THEN
      RAISE EXCEPTION 'Inscription indisponible.' USING ERRCODE = '42501';
    END IF;

    IF p_invite_token IS NOT NULL THEN
      SELECT * INTO invite FROM public.club_invites
      WHERE token = p_invite_token AND kind = 'event' AND target_id = e.id::text
        AND (club_id IS NULL OR club_id = e.club_id)
        AND (created_by = e.organizer_id OR (
          e.visibility IN ('public', 'club_only') AND EXISTS (
            SELECT 1 FROM public.club_members AS m
            WHERE m.club_id = e.club_id AND m.user_id = club_invites.created_by AND m.status = 'active'
          )
        ))
      FOR UPDATE;
      IF NOT FOUND OR invite.revoked_at IS NOT NULL OR
         (invite.expires_at IS NOT NULL AND invite.expires_at <= changed_at) THEN
        RAISE EXCEPTION 'Invitation invalide ou expirée.' USING ERRCODE = 'P0002';
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.user_blocks AS b
        WHERE (b.blocker_id = actor AND b.blocked_id = invite.created_by)
           OR (b.blocked_id = actor AND b.blocker_id = invite.created_by)
      ) THEN
        RAISE EXCEPTION 'Invitation indisponible.' USING ERRCODE = '42501';
      END IF;
    ELSIF NOT (
      (e.club_id IS NULL OR club.privacy IN ('open', 'public') OR member_status = 'active')
      AND (e.organizer_id = actor OR e.visibility = 'public' OR
           (e.visibility = 'club_only' AND member_status = 'active'))
    ) IS TRUE THEN
      RAISE EXCEPTION 'Adhésion ou invitation requise.' USING ERRCODE = '42501';
    END IF;

    IF registration.status IN ('registered', 'waitlist') THEN
      RETURN jsonb_build_object('registration', to_jsonb(registration) - 'imported_legacy_rsvp_at', 'uses_count', invite.uses_count);
    END IF;
    IF p_pace_group_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(e.pace_groups) = 'array' THEN e.pace_groups ELSE '[]'::jsonb END) AS g
      WHERE g ->> 'id' = p_pace_group_id
    ) THEN
      RAISE EXCEPTION 'Groupe d’allure inconnu.' USING ERRCODE = '22023';
    END IF;

    next_status := 'registered';
    IF legacy_joined_at IS NULL AND e.max_participants > 0
       AND club_private.club_event_registered_count(e.id) >= e.max_participants THEN
      IF NOT e.waitlist_enabled THEN
        RAISE EXCEPTION 'Cette sortie est complète.' USING ERRCODE = '23514';
      END IF;
      next_status := 'waitlist';
    END IF;
    IF invite.id IS NOT NULL AND legacy_joined_at IS NULL THEN
      IF invite.max_uses IS NOT NULL AND invite.uses_count >= invite.max_uses THEN
        RAISE EXCEPTION 'Invitation épuisée.' USING ERRCODE = 'P0002';
      END IF;
      UPDATE public.club_invites SET uses_count = uses_count + 1 WHERE id = invite.id
      RETURNING uses_count INTO invite.uses_count;
    END IF;

    INSERT INTO public.club_event_registrations
      (event_id, user_id, status, pace_group_id, invite_id, invited_by_user_id, registered_at, updated_at)
    VALUES (e.id, actor, next_status, p_pace_group_id, invite.id, invite.created_by,
            COALESCE(legacy_joined_at, changed_at), changed_at)
    ON CONFLICT (event_id, user_id) DO UPDATE SET
      status = EXCLUDED.status, pace_group_id = EXCLUDED.pace_group_id,
      invite_id = EXCLUDED.invite_id, invited_by_user_id = EXCLUDED.invited_by_user_id,
      registered_at = EXCLUDED.registered_at, updated_at = EXCLUDED.updated_at
    RETURNING * INTO registration;

  ELSIF registration.status IN ('registered', 'waitlist') OR legacy_joined_at IS NOT NULL THEN
    next_status := COALESCE(registration.status, 'registered');
    INSERT INTO public.club_event_registrations (event_id, user_id, status, registered_at, updated_at)
    VALUES (e.id, actor, 'cancelled', COALESCE(registration.registered_at, legacy_joined_at), changed_at)
    ON CONFLICT (event_id, user_id) DO UPDATE SET status = 'cancelled', updated_at = EXCLUDED.updated_at
    RETURNING * INTO registration;

    IF next_status = 'registered' AND (starts IS NULL OR starts > changed_at)
       AND (COALESCE(e.max_participants, 0) <= 0 OR club_private.club_event_registered_count(e.id) < e.max_participants) THEN
      SELECT r.user_id INTO promoted FROM public.club_event_registrations AS r
      WHERE r.event_id = e.id AND r.status = 'waitlist'
        AND NOT EXISTS (
          SELECT 1 FROM public.club_members AS m
          WHERE m.club_id = e.club_id AND m.user_id = r.user_id AND m.status = 'banned'
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.user_blocks AS b
          WHERE (b.blocker_id = r.user_id AND b.blocked_id = e.organizer_id)
             OR (b.blocked_id = r.user_id AND b.blocker_id = e.organizer_id)
        )
        AND (
          r.invite_id IS NOT NULL OR r.user_id = e.organizer_id OR
          (e.visibility = 'public' AND (e.club_id IS NULL OR EXISTS (
            SELECT 1 FROM public.clubs AS c WHERE c.id = e.club_id AND c.privacy IN ('open', 'public')
          ))) OR
          (e.visibility IN ('club_only', 'public') AND EXISTS (
            SELECT 1 FROM public.club_members AS m
            WHERE m.club_id = e.club_id AND m.user_id = r.user_id AND m.status = 'active'
          ))
        )
      ORDER BY r.registered_at, r.user_id LIMIT 1;
      IF promoted IS NOT NULL THEN
        UPDATE public.club_event_registrations SET status = 'registered', updated_at = changed_at
        WHERE event_id = e.id AND user_id = promoted;
      END IF;
    END IF;
  ELSE
    RETURN jsonb_build_object(
      'registration', CASE WHEN registration.user_id IS NOT NULL THEN to_jsonb(registration) - 'imported_legacy_rsvp_at' END
    );
  END IF;

  UPDATE public.club_events SET participants_count = club_private.club_event_registered_count(e.id)
  WHERE id = e.id;
  RETURN jsonb_build_object(
    'registration', CASE WHEN registration.user_id IS NOT NULL THEN to_jsonb(registration) - 'imported_legacy_rsvp_at' END,
    'promoted_user_id', CASE WHEN public.lkdv_is_club_moderator(e.club_id) THEN promoted END,
    'uses_count', invite.uses_count
  );
END;
$$;

REVOKE ALL ON FUNCTION club_private.transact_club_event_registration(uuid, boolean, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION club_private.transact_club_event_registration(uuid, boolean, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.transact_club_event_registration(
  p_event_id uuid, p_attending boolean, p_pace_group_id text DEFAULT NULL, p_invite_token text DEFAULT NULL
)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT club_private.transact_club_event_registration(p_event_id, p_attending, p_pace_group_id, p_invite_token);
$$;
REVOKE ALL ON FUNCTION public.transact_club_event_registration(uuid, boolean, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transact_club_event_registration(uuid, boolean, text, text) TO authenticated;

-- Les clients ne peuvent plus contourner le verrou de la sortie.
REVOKE INSERT, UPDATE, DELETE ON public.club_event_registrations FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.club_event_participants FROM PUBLIC, anon, authenticated;

UPDATE public.club_events AS e
SET participants_count = club_private.club_event_registered_count(e.id)
WHERE e.participants_count IS DISTINCT FROM club_private.club_event_registered_count(e.id);

-- Une invitation de sortie est comptée par la transaction d’inscription.
create or replace function public.lkdv_redeem_club_invite(p_token text)
returns table (uses_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;

  update public.club_invites i
     set uses_count = i.uses_count + 1
   where i.token = p_token
     and i.kind <> 'event'
     and i.revoked_at is null
     and (i.expires_at is null or i.expires_at > now())
     and (i.max_uses is null or i.uses_count < i.max_uses)
  returning i.uses_count into v_count;

  if v_count is null then
    raise exception 'Invitation invalide, expirée ou épuisée.' using errcode = 'P0002';
  end if;

  return query select v_count;
end;
$$;
