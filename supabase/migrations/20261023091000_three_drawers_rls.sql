-- RLS des trois drawers. Idempotent : drop policy if exists avant create.

-- Helper : une sortie est visible par son propriétaire, les participants,
-- les abonnés (visibility='followers') ou tout le monde (visibility='public').
create or replace function public.can_view_hike_session(p_session uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.hike_sessions s
    where s.id = p_session
      and (
        s.user_id = auth.uid()
        or s.visibility = 'public'
        or (
          s.visibility = 'followers'
          and exists (
            select 1 from public.user_follows f
            where f.follower_id = auth.uid()
              and f.following_id = s.user_id
          )
        )
        or exists (
          select 1 from public.hike_session_participants p
          where p.session_id = s.id and p.user_id = auth.uid()
        )
      )
  );
$$;

revoke all on function public.can_view_hike_session(uuid) from public;
grant execute on function public.can_view_hike_session(uuid) to authenticated;

-- follow_requests
alter table public.follow_requests enable row level security;
drop policy if exists follow_requests_select_own on public.follow_requests;
create policy follow_requests_select_own on public.follow_requests
  for select using (auth.uid() = requester_id or auth.uid() = target_id);
drop policy if exists follow_requests_insert_self on public.follow_requests;
create policy follow_requests_insert_self on public.follow_requests
  for insert with check (auth.uid() = requester_id and auth.uid() <> target_id);
drop policy if exists follow_requests_update_target on public.follow_requests;
create policy follow_requests_update_target on public.follow_requests
  for update using (auth.uid() = target_id) with check (auth.uid() = target_id);
drop policy if exists follow_requests_delete_own on public.follow_requests;
create policy follow_requests_delete_own on public.follow_requests
  for delete using (auth.uid() = requester_id or auth.uid() = target_id);

-- hike_session_participants
alter table public.hike_session_participants enable row level security;
drop policy if exists hike_participants_select on public.hike_session_participants;
create policy hike_participants_select on public.hike_session_participants
  for select using (public.can_view_hike_session(session_id));
drop policy if exists hike_participants_owner_write on public.hike_session_participants;
create policy hike_participants_owner_write on public.hike_session_participants
  for all using (
    exists (select 1 from public.hike_sessions s where s.id = session_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.hike_sessions s where s.id = session_id and s.user_id = auth.uid())
  );

-- hike_session_kudos
alter table public.hike_session_kudos enable row level security;
drop policy if exists hike_kudos_select on public.hike_session_kudos;
create policy hike_kudos_select on public.hike_session_kudos
  for select using (public.can_view_hike_session(session_id));
drop policy if exists hike_kudos_insert_self on public.hike_session_kudos;
create policy hike_kudos_insert_self on public.hike_session_kudos
  for insert with check (auth.uid() = user_id and public.can_view_hike_session(session_id));
drop policy if exists hike_kudos_delete_self on public.hike_session_kudos;
create policy hike_kudos_delete_self on public.hike_session_kudos
  for delete using (auth.uid() = user_id);

-- hike_session_comments
alter table public.hike_session_comments enable row level security;
drop policy if exists hike_comments_select on public.hike_session_comments;
create policy hike_comments_select on public.hike_session_comments
  for select using (public.can_view_hike_session(session_id));
drop policy if exists hike_comments_insert_self on public.hike_session_comments;
create policy hike_comments_insert_self on public.hike_session_comments
  for insert with check (auth.uid() = user_id and public.can_view_hike_session(session_id));
drop policy if exists hike_comments_delete_author on public.hike_session_comments;
create policy hike_comments_delete_author on public.hike_session_comments
  for delete using (auth.uid() = user_id);

-- hike_session_gear
alter table public.hike_session_gear enable row level security;
drop policy if exists hike_gear_select on public.hike_session_gear;
create policy hike_gear_select on public.hike_session_gear
  for select using (public.can_view_hike_session(session_id));
drop policy if exists hike_gear_owner_write on public.hike_session_gear;
create policy hike_gear_owner_write on public.hike_session_gear
  for all using (
    exists (select 1 from public.hike_sessions s where s.id = session_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.hike_sessions s where s.id = session_id and s.user_id = auth.uid())
  );

-- profile_share_links : propriétaire uniquement (résolution publique via service role)
alter table public.profile_share_links enable row level security;
drop policy if exists profile_share_links_owner on public.profile_share_links;
create policy profile_share_links_owner on public.profile_share_links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- profile_views : le visiteur insère sa vue, le propriétaire lit les agrégats
alter table public.profile_views enable row level security;
drop policy if exists profile_views_insert_self on public.profile_views;
create policy profile_views_insert_self on public.profile_views
  for insert with check (auth.uid() = viewer_id);
drop policy if exists profile_views_owner_select on public.profile_views;
create policy profile_views_owner_select on public.profile_views
  for select using (auth.uid() = profile_id);

-- user_sessions : propriétaire uniquement
alter table public.user_sessions enable row level security;
drop policy if exists user_sessions_owner on public.user_sessions;
create policy user_sessions_owner on public.user_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
