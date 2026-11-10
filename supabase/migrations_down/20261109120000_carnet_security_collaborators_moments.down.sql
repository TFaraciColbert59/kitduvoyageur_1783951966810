-- Rollback de 20261109120000 : remet les règles telles qu'en production au
-- 2026-11-09 (baseline prod_schema_20260911 + lot D carnet v2). Rejouable.
-- Attention : ce retour arrière rouvre les deux élévations de privilège
-- décrites dans la migration ; à n'utiliser qu'en cas de casse avérée.

drop policy if exists carnet_collab_insert_by_author on public.carnet_collaborators;
drop policy if exists carnet_collab_update_by_author on public.carnet_collaborators;
drop policy if exists carnet_collab_delete_by_author_or_self on public.carnet_collaborators;

drop policy if exists "carnet_collab_manage" on public.carnet_collaborators;
create policy "carnet_collab_manage" on public.carnet_collaborators
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists carnet_moments_select_viewable on public.carnet_moments;

drop policy if exists "carnet_moments_read_scoped" on public.carnet_moments;
create policy "carnet_moments_read_scoped" on public.carnet_moments
  for select
  using (
    exists (
      select 1 from public.carnets c
      where c.id = carnet_moments.carnet_id
        and (c.visibility = 'public' or c.author_id = auth.uid())
    )
  );

drop policy if exists "auth_manage_carnet_moments" on public.carnet_moments;
create policy "auth_manage_carnet_moments" on public.carnet_moments
  for all to authenticated
  using (auth.uid() = auteur_id)
  with check (auth.uid() = auteur_id);

-- is_carnet_participant : corps du lot A (20261108100001)
create or replace function public.is_carnet_participant(p_carnet uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select auth.uid()) is not null and (
    exists (
      select 1 from public.carnets c
      where c.id = p_carnet and c.author_id = (select auth.uid())
    )
    or exists (
      select 1 from public.carnet_collaborators cc
      where cc.carnet_id = p_carnet
        and cc.user_id = (select auth.uid())
        and cc.role in ('owner', 'contributor')
    )
    or exists (
      select 1 from public.hike_sessions hs
      join public.hike_session_participants hp on hp.session_id = hs.id
      where hs.carnet_id = p_carnet and hp.user_id = (select auth.uid())
    )
  );
$$;

revoke all on function public.is_carnet_participant(uuid) from public;
grant execute on function public.is_carnet_participant(uuid) to authenticated, anon;

-- hike_sessions : politiques de phase 8 (20260911550000)
drop policy if exists hike_sessions_insert_owner on public.hike_sessions;
create policy hike_sessions_insert_owner on public.hike_sessions
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists hike_sessions_update_owner on public.hike_sessions;
create policy hike_sessions_update_owner on public.hike_sessions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
