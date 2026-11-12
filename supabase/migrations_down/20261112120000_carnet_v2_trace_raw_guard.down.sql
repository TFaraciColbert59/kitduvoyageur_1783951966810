-- Rollback de 20261112120000_carnet_v2_trace_raw_guard.sql
drop policy if exists hike_sessions_select_owner_or_participant on public.hike_sessions;

-- Restaure l'état antérieur (phase 8 + 20261112090000).
drop policy if exists hike_sessions_select_owner_or_public_carnet on public.hike_sessions;
create policy hike_sessions_select_owner_or_public_carnet on public.hike_sessions
  for select
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.carnets c
      where c.id = hike_sessions.carnet_id
        and (c.visibility = 'public' or c.author_id = auth.uid())
    )
  );

drop policy if exists hike_sessions_select_shared_carnet on public.hike_sessions;
create policy hike_sessions_select_shared_carnet on public.hike_sessions
  for select to public
  using (
    carnet_id is not null
    and public.can_view_carnet(carnet_id)
    and visibility in ('public', 'collective_anonymized')
  );
