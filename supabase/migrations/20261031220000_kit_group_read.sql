-- Migration: 20261031220000_kit_group_read.sql
-- Description: Lecture SEULE des kits explicitement partagés au groupe (Lot L7-1 / L7-2 / D-24).
-- Garanties :
-- 1. Drapeau dédié `is_shared_with_group` (ne surcharge PAS `is_public`).
-- 2. Double condition : coéquipier actif (voyage ou équipage) ET `is_shared_with_group = true`.
-- 3. `SECURITY DEFINER` verrouillé (`SET search_path = public`, `REVOKE EXECUTE FROM PUBLIC, anon`).
-- 4. Lecture seule (`FOR SELECT`) : aucune policy INSERT/UPDATE/DELETE ajoutée (SEC-04).

alter table public.materiel_kits
  add column if not exists is_shared_with_group boolean not null default false;

comment on column public.materiel_kits.is_shared_with_group is
  'Partage restreint en lecture seule aux coéquipiers d un voyage ou équipage actif (D-24). Distinct de is_public.';

create index if not exists idx_materiel_kits_shared_group
  on public.materiel_kits (user_id, is_shared_with_group)
  where is_shared_with_group = true;

create or replace function public.can_read_member_kit(
  target_user uuid,
  target_kit uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and target_user is not null
    and target_kit is not null
    and auth.uid() <> target_user
    and exists (
      select 1
      from public.materiel_kits k
      where k.id = target_kit
        and k.user_id = target_user
        and k.is_shared_with_group is true
        and coalesce(k.is_trashed, false) is false
    )
    and (
      -- 1. Coéquipiers dans trip_collaborators
      exists (
        select 1
        from public.trip_collaborators a
        join public.trip_collaborators b on a.trip_id = b.trip_id
        where a.user_id = auth.uid()
          and b.user_id = target_user
      )
      -- 2. Participants confirmés ou propriétaire + participant dans trip_participants / trips
      or exists (
        select 1
        from public.trips t
        left join public.trip_participants tp_viewer
          on tp_viewer.trip_id = t.id and tp_viewer.user_id = auth.uid() and tp_viewer.status = 'confirmed'
        left join public.trip_participants tp_target
          on tp_target.trip_id = t.id and tp_target.user_id = target_user and tp_target.status = 'confirmed'
        where (t.user_id = auth.uid() or tp_viewer.user_id is not null)
          and (t.user_id = target_user or tp_target.user_id is not null)
      )
      -- 3. Membres actifs du même équipage (crew_members)
      or exists (
        select 1
        from public.crew_members cm_viewer
        join public.crew_members cm_target on cm_viewer.crew_id = cm_target.crew_id
        where cm_viewer.user_id = auth.uid()
          and cm_target.user_id = target_user
          and cm_viewer.status = 'active'
          and cm_target.status = 'active'
      )
    );
$$;

revoke all on function public.can_read_member_kit(uuid, uuid) from public, anon;
grant execute on function public.can_read_member_kit(uuid, uuid) to authenticated;

drop policy if exists "materiel_kits_select_group" on public.materiel_kits;
create policy "materiel_kits_select_group" on public.materiel_kits
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.can_read_member_kit(user_id, id)
  );

drop policy if exists "materiel_kit_items_select_group" on public.materiel_kit_items;
create policy "materiel_kit_items_select_group" on public.materiel_kit_items
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.can_read_member_kit(user_id, kit_id)
  );

drop policy if exists "kit_placed_badges_select_group" on public.kit_placed_badges;
create policy "kit_placed_badges_select_group" on public.kit_placed_badges
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.can_read_member_kit(user_id, kit_id)
  );
