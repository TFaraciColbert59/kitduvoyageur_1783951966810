DROP FUNCTION IF EXISTS public.transact_club_event_registration(uuid, boolean, text, text);
DROP FUNCTION IF EXISTS club_private.transact_club_event_registration(uuid, boolean, text, text);
DROP FUNCTION IF EXISTS club_private.club_event_registered_count(uuid);
DROP SCHEMA IF EXISTS club_private;

GRANT INSERT, UPDATE, DELETE ON public.club_event_registrations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.club_event_participants TO anon, authenticated;

UPDATE public.club_events AS e
SET participants_count = (SELECT count(*) FROM public.club_event_participants AS p WHERE p.event_id = e.id)
WHERE e.participants_count IS DISTINCT FROM (
  SELECT count(*) FROM public.club_event_participants AS p WHERE p.event_id = e.id
);

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
