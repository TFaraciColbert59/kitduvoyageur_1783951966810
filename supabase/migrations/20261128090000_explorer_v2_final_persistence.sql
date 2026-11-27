-- Explorer v2 — Persistance finale (Pokédex, Favoris, Signalements, Bouteilles & Sorties)
-- Migration additive et idempotente.

begin;

-- ── 1. Observations Pokédex Naturaliste ─────────────────────────────────────
create table if not exists public.pokedex_observations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  taxon_id integer not null check (taxon_id > 0),
  common_name text not null,
  scientific_name text not null default '',
  kingdom text not null default 'faune',
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  place_label text,
  note text,
  photo_url text,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.pokedex_observations is
  'Explorer v2 — observations faune/flore/fungi enregistrées par les explorateurs.';

create index if not exists idx_pokedex_observations_user_taxon
  on public.pokedex_observations (user_id, taxon_id);

create index if not exists idx_pokedex_observations_lat_lng
  on public.pokedex_observations (lat, lng);

create index if not exists idx_pokedex_observations_user_observed
  on public.pokedex_observations (user_id, observed_at desc);

alter table public.pokedex_observations enable row level security;

drop policy if exists "pokedex_observations_select_own" on public.pokedex_observations;
create policy "pokedex_observations_select_own"
  on public.pokedex_observations
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "pokedex_observations_select_public" on public.pokedex_observations;
create policy "pokedex_observations_select_public"
  on public.pokedex_observations
  for select to anon, authenticated
  using (true);

drop policy if exists "pokedex_observations_insert_own" on public.pokedex_observations;
create policy "pokedex_observations_insert_own"
  on public.pokedex_observations
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "pokedex_observations_delete_own" on public.pokedex_observations;
create policy "pokedex_observations_delete_own"
  on public.pokedex_observations
  for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "pokedex_observations_all_service" on public.pokedex_observations;
create policy "pokedex_observations_all_service"
  on public.pokedex_observations
  for all to service_role
  using (true)
  with check (true);

grant select on public.pokedex_observations to anon;
grant select, insert, delete on public.pokedex_observations to authenticated;

-- ── 2. Lieux sauvegardés (favoris privés) ───────────────────────────────────
create table if not exists public.user_saved_places (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null,
  kind text not null default 'poi',
  name text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, place_id)
);

comment on table public.user_saved_places is
  'Explorer v2 — favoris de lieux privés, strictement isolés par utilisateur.';

create index if not exists idx_user_saved_places_user_created
  on public.user_saved_places (user_id, created_at desc);

alter table public.user_saved_places enable row level security;

drop policy if exists "user_saved_places_select_own" on public.user_saved_places;
create policy "user_saved_places_select_own"
  on public.user_saved_places
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "user_saved_places_insert_own" on public.user_saved_places;
create policy "user_saved_places_insert_own"
  on public.user_saved_places
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "user_saved_places_update_own" on public.user_saved_places;
create policy "user_saved_places_update_own"
  on public.user_saved_places
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "user_saved_places_delete_own" on public.user_saved_places;
create policy "user_saved_places_delete_own"
  on public.user_saved_places
  for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "user_saved_places_all_service" on public.user_saved_places;
create policy "user_saved_places_all_service"
  on public.user_saved_places
  for all to service_role
  using (true)
  with check (true);

grant select, insert, update, delete on public.user_saved_places to authenticated;

-- ── 3. Durcissement des signalements terrain ────────────────────────────────
-- Permet aux signalements vérifiés créés via /api/explorer/v2/reports d'être
-- insérés directement en statut 'active' (visibles immédiatement sur la carte
-- via a5_terrain_reports_near et terrain_reports_public).
drop policy if exists "terrain_reports_insert_own" on public.terrain_reports;
create policy "terrain_reports_insert_own"
  on public.terrain_reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and status in ('pending', 'active')
    and source_type = 'user'
  );

-- Corrige l'incrément infini sur « disparu » : un même utilisateur ne peut
-- incrémenter gone_count qu'une seule fois grâce au contrôle ROW_COUNT après
-- INSERT ... ON CONFLICT DO NOTHING dans terrain_report_contributors.
create or replace function public.explorer_mark_report_gone(p_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_inserted integer := 0;
  v_gone integer;
  v_status text;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;

  select r.gone_count, r.status
    into v_gone, v_status
    from public.terrain_reports r
   where r.id = p_report_id;

  if not found then
    raise exception 'signalement introuvable' using errcode = 'P0002';
  end if;

  insert into public.terrain_report_contributors (report_id, user_id, first_report_at)
  values (p_report_id, v_uid, now())
  on conflict (report_id, user_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    update public.terrain_reports r
       set gone_count = r.gone_count + 1,
           status = case when r.gone_count + 1 > r.present_count then 'stale' else r.status end,
           updated_at = now()
     where r.id = p_report_id
     returning r.gone_count, r.status into v_gone, v_status;
  end if;

  return jsonb_build_object(
    'status', v_status,
    'gone_count', v_gone,
    'already_voted', (v_inserted = 0)
  );
end;
$$;

revoke all on function public.explorer_mark_report_gone(uuid) from public;
grant execute on function public.explorer_mark_report_gone(uuid) to authenticated;

-- ── 4. Coordonnées de secteur sur travel_groups (Bouteilles à la mer) ───────
alter table public.travel_groups
  add column if not exists lat double precision;

alter table public.travel_groups
  add column if not exists lng double precision;

alter table public.travel_groups
  add column if not exists place_label text;

create index if not exists idx_travel_groups_lat_lng
  on public.travel_groups (lat, lng)
  where lat is not null and lng is not null;

-- ── 5. Enrichissement des résumés de sorties sur hike_sessions ──────────────
alter table public.hike_sessions
  add column if not exists kit_id uuid;

alter table public.hike_sessions
  add column if not exists title text;

alter table public.hike_sessions
  add column if not exists notes text;

alter table public.hike_sessions
  add column if not exists rpe smallint;

alter table public.hike_sessions
  add column if not exists waypoints_json jsonb;

commit;
