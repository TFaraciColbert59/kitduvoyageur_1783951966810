-- Explorer v2 — données, RPC et sécurité (05_DONNEES.md §3).
-- Idempotente : rejouable sans effet de bord.
-- Aucune suppression de table, aucune donnée détruite.

begin;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. geo_pois : lecture publique (points OSM publics) + sous-types étendus
-- ───────────────────────────────────────────────────────────────────────────
alter table public.geo_pois enable row level security;

drop policy if exists geo_pois_public_read on public.geo_pois;
create policy geo_pois_public_read on public.geo_pois
  for select to anon, authenticated using (true);

grant select on public.geo_pois to anon, authenticated;

-- Extension des sous-types exigés par l'Explorer v2 (sommets, belvédères, cols,
-- parkings, arrêts). L'ancienne contrainte est remplacée, jamais la table.
alter table public.geo_pois drop constraint if exists geo_pois_subtype_check;
alter table public.geo_pois add constraint geo_pois_subtype_check check (
  subtype = any (array[
    'alpine_hut','wilderness_hut','shelter','camp_site','drinking_water','spring',
    'peak','viewpoint','saddle','parking','trailhead','bus_stop','train_station'
  ])
);

create index if not exists geo_pois_latlon_idx on public.geo_pois (lat, lon);
create index if not exists geo_pois_subtype_idx on public.geo_pois (subtype);

-- ───────────────────────────────────────────────────────────────────────────
-- 2. country_practical — urgences, prises, conduite, unités (Wikidata CC0)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.country_practical (
  iso_a2 text primary key,
  emergency_numbers jsonb not null default '{}'::jsonb,
  plug_types text[],
  driving_side text check (driving_side in ('left','right')),
  units text check (units in ('metric','imperial')),
  source text not null default 'wikidata',
  license text not null default 'CC0',
  updated_at timestamptz not null default now()
);

alter table public.country_practical enable row level security;
drop policy if exists country_practical_public_read on public.country_practical;
create policy country_practical_public_read on public.country_practical
  for select to anon, authenticated using (true);
grant select on public.country_practical to anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. activity_sessions + activity_points (direct, multi-sport)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.activity_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sport text not null,
  route_id bigint references public.hiking_routes(id) on delete set null,
  status text not null default 'live' check (status in ('live','paused','finished','abandoned')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  distance_m integer not null default 0,
  elev_gain_m integer not null default 0,
  moving_s integer not null default 0,
  share_level text not null default 'none' check (share_level in ('none','followers','group')),
  last_lat numeric(8,5),
  last_lng numeric(8,5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists activity_sessions_user_idx on public.activity_sessions (user_id, started_at desc);
create index if not exists activity_sessions_live_idx on public.activity_sessions (status) where status = 'live';

create table if not exists public.activity_points (
  id bigserial primary key,
  session_id uuid not null references public.activity_sessions(id) on delete cascade,
  t timestamptz not null default now(),
  lat numeric(9,6) not null,
  lng numeric(9,6) not null,
  ele numeric(7,1),
  acc numeric(6,1),
  speed numeric(6,2)
);

create index if not exists activity_points_session_idx on public.activity_points (session_id, t);

alter table public.activity_sessions enable row level security;
alter table public.activity_points enable row level security;

drop policy if exists activity_sessions_owner_read on public.activity_sessions;
create policy activity_sessions_owner_read on public.activity_sessions
  for select to authenticated using (
    user_id = auth.uid()
    or (
      share_level = 'followers'
      and status = 'live'
      and exists (
        select 1 from public.user_follows f
        where f.follower_id = auth.uid()
          and f.following_id = activity_sessions.user_id
      )
      and exists (
        select 1 from public.user_follows f2
        where f2.follower_id = activity_sessions.user_id
          and f2.following_id = auth.uid()
      )
    )
  );

drop policy if exists activity_sessions_owner_write on public.activity_sessions;
create policy activity_sessions_owner_write on public.activity_sessions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists activity_sessions_owner_update on public.activity_sessions;
create policy activity_sessions_owner_update on public.activity_sessions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists activity_points_owner_read on public.activity_points;
create policy activity_points_owner_read on public.activity_points
  for select to authenticated using (
    exists (
      select 1 from public.activity_sessions s
      where s.id = activity_points.session_id and s.user_id = auth.uid()
    )
  );

drop policy if exists activity_points_owner_write on public.activity_points;
create policy activity_points_owner_write on public.activity_points
  for insert to authenticated with check (
    exists (
      select 1 from public.activity_sessions s
      where s.id = activity_points.session_id and s.user_id = auth.uid()
    )
  );

grant select, insert, update on public.activity_sessions to authenticated;
grant select, insert on public.activity_points to authenticated;
grant usage, select on sequence public.activity_points_id_seq to authenticated;

-- Résumé de fin de sortie : écrit la compatibilité hike_sessions.
create or replace function public.finish_activity_session(p_session uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.activity_sessions;
  v_summary_id uuid;
  v_track jsonb;
begin
  select * into s from public.activity_sessions where id = p_session;
  if not found then
    raise exception 'session introuvable' using errcode = 'P0002';
  end if;
  if s.user_id <> auth.uid() then
    raise exception 'session d''un autre utilisateur' using errcode = '42501';
  end if;
  if s.status = 'finished' then
    return null;
  end if;

  update public.activity_sessions
     set status = 'finished',
         ended_at = coalesce(ended_at, now()),
         updated_at = now()
   where id = p_session;

  select jsonb_build_object(
    'type', 'LineString',
    'coordinates', coalesce(
      jsonb_agg(jsonb_build_array(lng, lat) order by t),
      '[]'::jsonb
    )
  )
  into v_track
  from public.activity_points
  where session_id = p_session;

  insert into public.hike_sessions (
    user_id, route_id, started_at, ended_at, distance_km, duration_seconds,
    elevation_gain_m, positions_geojson, processing_status, visibility, title
  ) values (
    s.user_id,
    s.route_id,
    s.started_at,
    coalesce(s.ended_at, now()),
    round((s.distance_m::numeric / 1000.0), 2),
    greatest(s.moving_s, extract(epoch from (coalesce(s.ended_at, now()) - s.started_at))::int),
    s.elev_gain_m,
    case when jsonb_array_length(coalesce(v_track->'coordinates', '[]'::jsonb)) > 1 then v_track else null end,
    'pending',
    'private',
    null
  )
  returning id into v_summary_id;

  return v_summary_id;
end;
$$;

grant execute on function public.finish_activity_session(uuid) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. sos_alerts : précision, batterie, session, pays, statuts
-- ───────────────────────────────────────────────────────────────────────────
alter table public.sos_alerts add column if not exists accuracy_m numeric(6,1);
alter table public.sos_alerts add column if not exists battery smallint;
alter table public.sos_alerts add column if not exists session_id uuid references public.activity_sessions(id) on delete set null;
alter table public.sos_alerts add column if not exists country_iso_a2 text;
alter table public.sos_alerts add column if not exists cancelled_at timestamptz;
alter table public.sos_alerts add column if not exists resolved_at timestamptz;
alter table public.sos_alerts add column if not exists updated_at timestamptz not null default now();

alter table public.sos_alerts enable row level security;

drop policy if exists sos_alerts_owner_rw on public.sos_alerts;
create policy sos_alerts_owner_rw on public.sos_alerts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update on public.sos_alerts to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. activity_catalog : escalade en voie + mapping des 9 sports UI
-- ───────────────────────────────────────────────────────────────────────────
insert into public.activity_catalog (slug, label, family, description, logistics_scope, sport_tags, metrics)
values (
  'escalade-voie',
  'Escalade en voie',
  'montagne',
  'Escalade sportive ou trad en voie, approche et retour au pied de la falaise.',
  'stages',
  array['escalade','montagne'],
  '{"distance":true,"elevation":true,"duration":true}'::jsonb
)
on conflict (slug) do nothing;

create table if not exists public.explorer_sport_map (
  sport text primary key,
  catalog_slug text not null references public.activity_catalog(slug) on delete restrict,
  label text not null,
  icon text not null
);

alter table public.explorer_sport_map enable row level security;
drop policy if exists explorer_sport_map_read on public.explorer_sport_map;
create policy explorer_sport_map_read on public.explorer_sport_map
  for select to anon, authenticated using (true);
grant select on public.explorer_sport_map to anon, authenticated;

insert into public.explorer_sport_map (sport, catalog_slug, label, icon) values
  ('course',    'course-5k',        'Course',            'run'),
  ('rando',     'rando-journee',    'Randonnée',         'hike'),
  ('velo',      'velo-route',       'Vélo',              'bike'),
  ('kayak',     'canoe-journee',    'Kayak',             'kayak'),
  ('trail',     'trail-10k',        'Trail',             'run'),
  ('ski',       'ski-randonnee',    'Ski de rando',      'ski'),
  ('escalade',  'escalade-voie',    'Escalade',          'climb'),
  ('famille',   'rando-famille',    'Balade en famille', 'walk'),
  ('bivouac',   'bivouac-1n',       'Bivouac',           'tent')
on conflict (sport) do update
  set catalog_slug = excluded.catalog_slug,
      label = excluded.label,
      icon = excluded.icon;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. RPC explorer_pois / explorer_place
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.explorer_pois(
  p_min_lat double precision,
  p_min_lng double precision,
  p_max_lat double precision,
  p_max_lng double precision,
  p_kinds text[] default null,
  p_limit integer default 400
)
returns table (
  id text,
  kind text,
  subtype text,
  name text,
  lat double precision,
  lon double precision,
  ele_m integer,
  potable boolean,
  capacity integer
)
language sql
stable
as $$
  with bounds as (
    select least(p_min_lat, p_max_lat) as s,
           greatest(p_min_lat, p_max_lat) as n,
           least(p_min_lng, p_max_lng) as w,
           greatest(p_min_lng, p_max_lng) as e
  ),
  mapped as (
    select g.osm_id,
           case g.subtype
             when 'peak' then 'summit'
             when 'saddle' then 'summit'
             when 'viewpoint' then 'viewpoint'
             when 'drinking_water' then 'water'
             when 'spring' then 'water'
             when 'alpine_hut' then 'refuge'
             when 'wilderness_hut' then 'refuge'
             when 'shelter' then 'refuge'
             when 'camp_site' then 'bivouac'
             when 'parking' then 'access'
             when 'trailhead' then 'access'
             when 'bus_stop' then 'access'
             when 'train_station' then 'access'
             else 'access'
           end as kind,
           g.subtype, g.name, g.lat::double precision as lat, g.lon::double precision as lon,
           g.ele_m::integer as ele_m, g.potable, g.capacity::integer as capacity,
           case g.subtype
             when 'peak' then 1
             when 'drinking_water' then 1
             when 'spring' then 1
             when 'alpine_hut' then 1
             when 'viewpoint' then 2
             when 'wilderness_hut' then 2
             when 'shelter' then 2
             when 'camp_site' then 3
             else 4
           end as prio
      from public.geo_pois g, bounds b
     where g.lat between b.s and b.n
       and g.lon between b.w and b.e
       and (b.n - b.s) <= 6
       and (b.e - b.w) <= 6
  )
  select m.osm_id, m.kind, m.subtype, coalesce(m.name, ''), m.lat, m.lon, m.ele_m, m.potable, m.capacity
    from mapped m
   where m.name is not null and m.name <> ''
     and (p_kinds is null or m.kind = any (p_kinds))
   order by m.prio asc, m.name asc
   limit least(coalesce(p_limit, 400), 400);
$$;

grant execute on function public.explorer_pois(double precision, double precision, double precision, double precision, text[], integer) to anon, authenticated;

create or replace function public.explorer_place(p_lat double precision, p_lng double precision)
returns jsonb
language sql
stable
as $$
  with pt as (
    select st_setsrid(st_makepoint(p_lng, p_lat), 4326) as g
  ),
  near_region as (
    select r.name
      from public.admin_regions_geo r, pt
     where r.country_iso_a2 is not null
       and r.geometry is not null
       and st_dwithin(r.geometry, pt.g, 0.5)
     order by st_distance(r.geometry, pt.g) asc
     limit 1
  ),
  box as (
    select st_setsrid(st_buffer(pt.g::geography, 12000)::geometry, 4326) as g from pt
  ),
  counts as (
    select
      (select count(*) from public.hiking_routes h, box
        where h.geom is not null and st_intersects(h.geom, st_transform(box.g, st_srid(h.geom)))) as routes,
      (select count(*) from public.geo_pois g, box
        where g.subtype in ('drinking_water','spring')
          and st_dwithin(st_setsrid(st_makepoint(g.lon, g.lat), 4326)::geography, box.g::geography, 12000)) as water,
      (select count(*) from public.geo_pois g, box
        where g.subtype in ('alpine_hut','wilderness_hut','shelter')
          and st_dwithin(st_setsrid(st_makepoint(g.lon, g.lat), 4326)::geography, box.g::geography, 12000)) as refuges,
      (select count(*) from public.terrain_reports t, pt
        where t.status = 'active'
          and st_dwithin(st_setsrid(st_makepoint(t.lng, t.lat), 4326)::geography, pt.g::geography, 12000)) as reports
  )
  select jsonb_build_object(
    'regionName', (select name from near_region),
    'counts', jsonb_build_object(
      'routes', c.routes,
      'water', c.water,
      'refuges', c.refuges,
      'reports', c.reports
    )
  )
  from counts c;
$$;

grant execute on function public.explorer_place(double precision, double precision) to anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 7. Flag explorer_v2_enabled (0 % puis 100 % en phase 10)
-- ───────────────────────────────────────────────────────────────────────────
insert into public.feature_flags (id, enabled, scope)
values ('explorer_v2_enabled', false, 'global')
on conflict (id) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- 8. Cache Overpass (sommets, belvédères, cols, parkings, arrêts)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.osm_poi_cache (
  cache_key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table public.osm_poi_cache enable row level security;
-- Aucune politique : lecture et écriture réservées au serveur (service_role).

commit;
