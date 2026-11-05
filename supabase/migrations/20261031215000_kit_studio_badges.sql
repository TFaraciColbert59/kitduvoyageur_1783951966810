-- Migration: 20261031215000_kit_studio_badges.sql
-- Description: Insignes épinglés sur un sac dans le Kit Studio (Lot L7-5 / SEC-08).
-- RÈGLE ABSOLUE : Poser un insigne ne l'attribue JAMAIS. L'attribution reste au ledger
-- serveur de progression. Le trigger serveur refuse toute pose d'un badge non possédé
-- dans public.user_badges ou sur un kit n'appartenant pas à l'utilisateur.

create table if not exists public.kit_placed_badges (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references public.materiel_kits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  anchor_id text not null check (char_length(anchor_id) between 1 and 64),
  scale real not null default 1.0 check (scale >= 0.5 and scale <= 3.0),
  created_at timestamptz not null default now(),
  unique (kit_id, anchor_id)
);

create index if not exists idx_kit_placed_badges_kit_id
  on public.kit_placed_badges (kit_id);

create index if not exists idx_kit_placed_badges_user_id
  on public.kit_placed_badges (user_id);

alter table public.kit_placed_badges enable row level security;

drop policy if exists "kit_placed_badges_select_own" on public.kit_placed_badges;
create policy "kit_placed_badges_select_own" on public.kit_placed_badges
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "kit_placed_badges_insert_own" on public.kit_placed_badges;
create policy "kit_placed_badges_insert_own" on public.kit_placed_badges
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "kit_placed_badges_update_own" on public.kit_placed_badges;
create policy "kit_placed_badges_update_own" on public.kit_placed_badges
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "kit_placed_badges_delete_own" on public.kit_placed_badges;
create policy "kit_placed_badges_delete_own" on public.kit_placed_badges
  for delete to authenticated
  using (user_id = auth.uid());

-- Garde-fou serveur SEC-08 : vérifie que le kit appartient à user_id ET que le badge
-- est réellement possédé dans public.user_badges avant d'autoriser INSERT ou UPDATE.
create or replace function public.trg_enforce_kit_badge_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.materiel_kits k
    where k.id = new.kit_id
      and k.user_id = new.user_id
  ) then
    raise exception 'kit introuvable ou non détenu par cet utilisateur'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.user_badges ub
    where ub.user_id = new.user_id
      and ub.badge_id = new.badge_id
  ) then
    raise exception 'pose refusée : insigne non possédé par cet utilisateur'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.trg_enforce_kit_badge_ownership() from public, anon;

drop trigger if exists trg_kit_placed_badges_ownership on public.kit_placed_badges;
create trigger trg_kit_placed_badges_ownership
  before insert or update on public.kit_placed_badges
  for each row execute function public.trg_enforce_kit_badge_ownership();
