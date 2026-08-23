-- Historique des versions / activités des kits utilisateur (W-K-8).
-- Décision D4 : table dédiée pour persister l'historique de chaque kit.
create table if not exists public.materiel_kit_history (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references public.materiel_kits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('created','updated','deleted','restored','forked','optimized','compared')),
  payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_materiel_kit_history_kit_id on public.materiel_kit_history(kit_id);
create index if not exists idx_materiel_kit_history_user_id on public.materiel_kit_history(user_id, created_at desc);

alter table public.materiel_kit_history enable row level security;

create policy "materiel_kit_history_select_own" on public.materiel_kit_history
  for select using (auth.uid() = user_id);
create policy "materiel_kit_history_insert_own" on public.materiel_kit_history
  for insert with check (auth.uid() = user_id);
create policy "materiel_kit_history_delete_own" on public.materiel_kit_history
  for delete using (auth.uid() = user_id);
