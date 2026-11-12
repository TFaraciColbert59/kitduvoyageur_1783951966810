-- Rollback de 20261112122000_carnet_v2_participant_scope.sql
--
-- AVERTISSEMENT : ce down RESTAURE les droits élargis du participant de
-- sortie (écriture moments/kit/nuits, lecture de toutes les positions live).
-- À n'exécuter qu'avec le revert applicatif et une décision produit explicite.
-- L'état restauré est celui du dépôt avant cette migration, pas forcément
-- celui de la production.

-- 1. Restaurer les policies d'écriture historiques.
drop policy if exists carnet_kit_items_editor_manage on public.carnet_kit_items;
drop policy if exists carnet_kit_items_participant_manage on public.carnet_kit_items;
create policy carnet_kit_items_participant_manage on public.carnet_kit_items
  for all to authenticated
  using (public.is_carnet_participant(carnet_id))
  with check (public.is_carnet_participant(carnet_id));

drop policy if exists carnet_moments_editor_manage on public.carnet_moments;
drop policy if exists carnet_moments_participant_manage on public.carnet_moments;
create policy carnet_moments_participant_manage on public.carnet_moments
  for all to authenticated
  using (public.is_carnet_participant(carnet_id))
  with check (public.is_carnet_participant(carnet_id));

drop policy if exists carnet_nights_insert on public.carnet_nights;
create policy carnet_nights_insert on public.carnet_nights
  for insert with check (public.is_carnet_participant(carnet_id));

drop policy if exists carnet_nights_update on public.carnet_nights;
create policy carnet_nights_update on public.carnet_nights
  for update using (public.is_carnet_participant(carnet_id))
  with check (public.is_carnet_participant(carnet_id));

drop policy if exists carnet_nights_delete on public.carnet_nights;
create policy carnet_nights_delete on public.carnet_nights
  for delete using (public.is_carnet_participant(carnet_id));

-- 2. Restaurer la lecture historique des positions live.
drop policy if exists carnet_live_positions_select on public.carnet_live_positions;
create policy carnet_live_positions_select on public.carnet_live_positions
  for select using (public.is_carnet_participant(carnet_id));

drop policy if exists carnet_live_positions_insert on public.carnet_live_positions;
create policy carnet_live_positions_insert on public.carnet_live_positions
  for insert with check (
    user_id = (select auth.uid())
    and public.is_carnet_participant(carnet_id)
  );

drop policy if exists carnet_live_positions_update on public.carnet_live_positions;
create policy carnet_live_positions_update on public.carnet_live_positions
  for update using (
    user_id = (select auth.uid())
    and public.is_carnet_participant(carnet_id)
  )
  with check (
    user_id = (select auth.uid())
    and public.is_carnet_participant(carnet_id)
  );

drop policy if exists carnet_live_positions_delete on public.carnet_live_positions;
create policy carnet_live_positions_delete on public.carnet_live_positions
  for delete using (
    user_id = (select auth.uid())
    and public.is_carnet_participant(carnet_id)
  );

-- 3. Restaurer la définition historique de `is_carnet_participant`.
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

-- 4. Retirer le helper d'éditeur, qui n'existait pas avant cette migration.
drop function if exists public.is_carnet_editor(uuid);
