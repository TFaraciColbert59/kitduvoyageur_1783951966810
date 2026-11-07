-- Migration Lot E : suivi des reprises de kit (kit_forks) pour Carnet v2

create table if not exists public.kit_forks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_carnet_id uuid not null references public.carnets(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists kit_forks_user_idx
  on public.kit_forks (user_id);

create index if not exists kit_forks_source_carnet_idx
  on public.kit_forks (source_carnet_id);

alter table public.kit_forks enable row level security;

drop policy if exists kit_forks_select_own on public.kit_forks;
create policy kit_forks_select_own on public.kit_forks
  for select using (user_id = (select auth.uid()));

drop policy if exists kit_forks_insert_own on public.kit_forks;
create policy kit_forks_insert_own on public.kit_forks
  for insert with check (
    user_id = (select auth.uid())
    and public.can_view_carnet(source_carnet_id)
  );

drop policy if exists kit_forks_delete_own on public.kit_forks;
create policy kit_forks_delete_own on public.kit_forks
  for delete using (user_id = (select auth.uid()));
