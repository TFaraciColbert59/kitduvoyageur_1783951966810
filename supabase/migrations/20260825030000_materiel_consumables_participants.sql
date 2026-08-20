-- W-D-5 Consommables (persistance) : colonne jsonb sur materiel_kits.
alter table public.materiel_kits add column if not exists consumables jsonb default '{}'::jsonb;

-- W-D-7 Participants : table des participants d'un départ (rattaché au kit assigné).
create table if not exists public.depart_participants (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references public.materiel_kits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_emergency_contact boolean not null default false,
  contact text,
  created_at timestamptz not null default now()
);

create index if not exists idx_depart_participants_kit_id on public.depart_participants(kit_id);
create index if not exists idx_depart_participants_user_id on public.depart_participants(user_id);

alter table public.depart_participants enable row level security;

create policy "depart_participants_select_own" on public.depart_participants
  for select using (auth.uid() = user_id);
create policy "depart_participants_insert_own" on public.depart_participants
  for insert with check (auth.uid() = user_id);
create policy "depart_participants_delete_own" on public.depart_participants
  for delete using (auth.uid() = user_id);
