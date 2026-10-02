-- Invitations à un voyage : notification, lien réutilisable, aperçu pour l'invité.
-- Dépend de 20261002150000_trip_invitations.

-- 1. Réponse. Invitation nominative : l'invité accepte ou refuse, une fois.
--    Lien (invitee_id nul) : réutilisable jusqu'à expiration ou annulation ;
--    chaque personne qui l'accepte rejoint le voyage, le lien reste ouvert.
create or replace function public.respond_trip_invitation(
  p_invitation_id uuid,
  p_token text,
  p_accept boolean
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.trip_invitations%rowtype;
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;
  select * into v_inv from public.trip_invitations
   where (p_invitation_id is not null and id = p_invitation_id)
      or (p_invitation_id is null and p_token is not null and token = p_token)
   for update;
  if not found then
    raise exception 'invitation not found';
  end if;
  if v_inv.status <> 'pending' or v_inv.expires_at < now() then
    raise exception 'invitation closed';
  end if;
  if v_inv.invitee_id is not null and v_inv.invitee_id <> v_uid then
    raise exception 'not invitee';
  end if;

  if v_inv.invitee_id is not null then
    update public.trip_invitations
       set status = case when p_accept then 'accepted' else 'declined' end,
           responded_at = now()
     where id = v_inv.id;
  end if;

  if p_accept then
    select user_id into v_owner from public.trips where id = v_inv.trip_id;
    if v_owner is distinct from v_uid then
      insert into public.trip_collaborators (trip_id, user_id, role, invited_by)
      values (v_inv.trip_id, v_uid, v_inv.role, v_inv.invited_by)
      on conflict (trip_id, user_id) do nothing;
    end if;
    -- Une invitation nominative en attente pour la même personne devient sans objet.
    update public.trip_invitations
       set status = 'accepted', responded_at = now()
     where trip_id = v_inv.trip_id and invitee_id = v_uid and status = 'pending';
  end if;
  return v_inv.trip_id;
end;
$$;

revoke all on function public.respond_trip_invitation(uuid, text, boolean) from public, anon;
grant execute on function public.respond_trip_invitation(uuid, text, boolean) to authenticated;

-- 2. Notification à l'invité (nominative seulement), puis notification lue
--    dès que l'invitation n'est plus en attente.
create or replace function public.trip_invitation_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_from text;
  v_actor uuid;
begin
  if tg_op = 'INSERT' then
    if new.invitee_id is null or new.status <> 'pending' then
      return new;
    end if;
    select coalesce(nullif(trim(title), ''), 'un voyage') into v_title
      from public.trips where id = new.trip_id;
    select id, coalesce(nullif(trim(full_name), ''), 'Quelqu’un') into v_actor, v_from
      from public.user_profiles where id = new.invited_by;
    perform public.notify(
      new.invitee_id,
      'trip_invitation',
      'Invitation à un voyage',
      coalesce(v_from, 'Quelqu’un') || ' t’invite à « ' || coalesce(v_title, 'un voyage') || ' ».',
      v_actor,
      'trip_invitation',
      new.id,
      '/invitation/' || new.token
    );
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status <> 'pending' then
    update public.notifications
       set read = true, read_at = now(), updated_at = now()
     where related_type = 'trip_invitation' and related_id = new.id and read = false;
  end if;
  return new;
end;
$$;

revoke all on function public.trip_invitation_notify() from public, anon, authenticated;

drop trigger if exists trip_invitations_notify on public.trip_invitations;
create trigger trip_invitations_notify
  after insert or update of status on public.trip_invitations
  for each row execute function public.trip_invitation_notify();

-- 3. Aperçu : l'invité ne lit pas encore le voyage (RLS). Ces deux fonctions
--    exposent le strict nécessaire pour décider : titre, lieu, dates, organisateur.
create or replace function public.my_trip_invitations()
returns table (
  invitation_id uuid,
  trip_id uuid,
  token text,
  role text,
  trip_title text,
  destination text,
  start_date date,
  end_date date,
  inviter_name text,
  inviter_avatar text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.trip_id, i.token, i.role::text, t.title, t.destination_name,
         t.start_date, t.end_date, p.full_name, p.avatar_url, i.created_at
    from public.trip_invitations i
    join public.trips t on t.id = i.trip_id
    left join public.user_profiles p on p.id = i.invited_by
   where i.invitee_id = auth.uid()
     and i.status = 'pending'
     and i.expires_at > now()
   order by i.created_at desc
   limit 50;
$$;

revoke all on function public.my_trip_invitations() from public, anon;
grant execute on function public.my_trip_invitations() to authenticated;

create or replace function public.trip_invitation_preview(p_token text)
returns table (
  invitation_id uuid,
  trip_id uuid,
  role text,
  status text,
  is_link boolean,
  for_me boolean,
  already_member boolean,
  expired boolean,
  trip_title text,
  destination text,
  start_date date,
  end_date date,
  inviter_name text,
  inviter_avatar text
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.trip_id, i.role::text, i.status, i.invitee_id is null,
         i.invitee_id is null or i.invitee_id = auth.uid(),
         (t.user_id = auth.uid() or exists (
            select 1 from public.trip_collaborators c
             where c.trip_id = i.trip_id and c.user_id = auth.uid())),
         i.expires_at < now(),
         t.title, t.destination_name, t.start_date, t.end_date, p.full_name, p.avatar_url
    from public.trip_invitations i
    join public.trips t on t.id = i.trip_id
    left join public.user_profiles p on p.id = i.invited_by
   where auth.uid() is not null
     and p_token is not null
     and length(p_token) >= 16
     and i.token = p_token
   limit 1;
$$;

revoke all on function public.trip_invitation_preview(text) from public, anon;
grant execute on function public.trip_invitation_preview(text) to authenticated;
