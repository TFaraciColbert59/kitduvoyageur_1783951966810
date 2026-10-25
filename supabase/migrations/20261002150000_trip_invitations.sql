-- Invitations à rejoindre un voyage (Compas · Nous · Qui).
-- Une personne invitée n'accède au voyage qu'APRÈS avoir accepté :
-- l'acceptation (fonction ci-dessous) crée alors sa ligne trip_collaborators.
-- Lien externe : `token` (personne sans compte ou hors de l'app).
create table if not exists public.trip_invitations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  invitee_id uuid references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  role public.trip_collaborator_role not null default 'viewer',
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  source text not null default 'direct'
    check (source in ('direct', 'friend', 'club', 'group', 'message', 'comment', 'link')),
  token text unique default replace(gen_random_uuid()::text, '-', ''),
  expires_at timestamptz not null default (now() + interval '30 days'),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  check (role in ('editor', 'viewer'))
);

create index if not exists trip_invitations_trip_idx on public.trip_invitations (trip_id, status);
create index if not exists trip_invitations_invitee_idx on public.trip_invitations (invitee_id, status);
create unique index if not exists trip_invitations_pending_uniq
  on public.trip_invitations (trip_id, invitee_id) where status = 'pending' and invitee_id is not null;

alter table public.trip_invitations enable row level security;

-- Lecture : l'invité, ou qui peut lire le voyage (compteur de l'équipe).
create policy trip_invitations_select on public.trip_invitations
  for select using (invitee_id = auth.uid() or public.can_read_trip(trip_id));
-- Création / annulation : qui peut modifier le voyage, en son nom.
create policy trip_invitations_insert on public.trip_invitations
  for insert with check (invited_by = auth.uid() and public.can_edit_trip(trip_id));
create policy trip_invitations_update_editor on public.trip_invitations
  for update using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));

-- Réponse de l'invité (ou via le lien) : seule voie qui ouvre l'accès au voyage.
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
  -- Invitation nominative : seul l'invité répond. Lien : quiconque l'a.
  if v_inv.invitee_id is not null and v_inv.invitee_id <> v_uid then
    raise exception 'not invitee';
  end if;
  update public.trip_invitations
     set status = case when p_accept then 'accepted' else 'declined' end,
         responded_at = now(),
         invitee_id = coalesce(invitee_id, v_uid)
   where id = v_inv.id;
  if p_accept then
    insert into public.trip_collaborators (trip_id, user_id, role, invited_by)
    values (v_inv.trip_id, v_uid, v_inv.role, v_inv.invited_by)
    on conflict do nothing;
  end if;
  return v_inv.trip_id;
end;
$$;

revoke all on function public.respond_trip_invitation(uuid, text, boolean) from public, anon;
grant execute on function public.respond_trip_invitation(uuid, text, boolean) to authenticated;
