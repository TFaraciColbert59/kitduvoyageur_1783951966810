-- Migration Lot D : nuits, verdicts du kit et position en direct pour Carnet v2

-- 1. Nuits / hébergements
create table if not exists public.carnet_nights (
  id uuid primary key default gen_random_uuid(),
  carnet_id uuid not null references public.carnets(id) on delete cascade,
  jour_numero int not null check (jour_numero >= 1),
  nom text not null,
  type text not null check (type in ('refuge','gite','bivouac','hotel','camping','autre')),
  altitude_m int,
  infos text,
  lat double precision,
  lng double precision,
  map_refuge_id uuid references public.map_refuges(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (carnet_id, jour_numero)
);

create index if not exists carnet_nights_carnet_idx
  on public.carnet_nights (carnet_id, jour_numero);

create index if not exists carnet_nights_map_refuge_idx
  on public.carnet_nights (map_refuge_id);

alter table public.carnet_nights enable row level security;

drop policy if exists carnet_nights_select on public.carnet_nights;
create policy carnet_nights_select on public.carnet_nights
  for select using (public.can_view_carnet(carnet_id));

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

-- 2. Verdicts du kit
alter table public.carnet_kit_items
  add column if not exists verdict text check (verdict in ('essentiel','utile','jamais_servi','defaillant','manquait')),
  add column if not exists verdict_note text check (char_length(verdict_note) <= 500),
  add column if not exists jours_utilises int[];

-- Harmonisation des droits de gestion des items de kit pour tous les participants
drop policy if exists carnet_kit_items_participant_manage on public.carnet_kit_items;
create policy carnet_kit_items_participant_manage on public.carnet_kit_items
  for all to authenticated
  using (public.is_carnet_participant(carnet_id))
  with check (public.is_carnet_participant(carnet_id));

drop policy if exists carnet_kit_items_select on public.carnet_kit_items;
create policy carnet_kit_items_select on public.carnet_kit_items
  for select using (public.can_view_carnet(carnet_id));

-- Harmonisation des droits de gestion des moments pour tous les participants
drop policy if exists carnet_moments_participant_manage on public.carnet_moments;
create policy carnet_moments_participant_manage on public.carnet_moments
  for all to authenticated
  using (public.is_carnet_participant(carnet_id))
  with check (public.is_carnet_participant(carnet_id));

-- 3. Position en direct
alter table public.carnets
  add column if not exists live_sharing boolean not null default false;

create table if not exists public.carnet_live_positions (
  carnet_id uuid not null references public.carnets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy_m numeric,
  recorded_at timestamptz not null default now(),
  primary key (carnet_id, user_id)
);

create index if not exists carnet_live_positions_carnet_idx
  on public.carnet_live_positions (carnet_id);

alter table public.carnet_live_positions enable row level security;

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

-- Fonction publique pour visiteurs : zone floue arrondie à 0.05° (~5 km) et différée de >= 3h
create or replace function public.carnet_public_position(p_carnet uuid)
returns table (
  zone_label text,
  lat_approx numeric,
  lng_approx numeric,
  recorded_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(c.destination, 'En chemin') as zone_label,
    (round((lp.lat / 0.05)::numeric) * 0.05)::numeric(8,4) as lat_approx,
    (round((lp.lng / 0.05)::numeric) * 0.05)::numeric(8,4) as lng_approx,
    lp.recorded_at
  from public.carnets c
  join public.carnet_live_positions lp on lp.carnet_id = c.id
  where c.id = p_carnet
    and c.live_sharing = true
    and public.can_view_carnet(p_carnet)
    and lp.recorded_at <= now() - interval '3 hours'
  order by lp.recorded_at desc
  limit 1;
$$;

revoke all on function public.carnet_public_position(uuid) from public;
grant execute on function public.carnet_public_position(uuid) to authenticated, anon;
