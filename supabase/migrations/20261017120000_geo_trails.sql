-- Référentiel des grands itinéraires de randonnée (plan 3.7).
--
-- OpenStreetMap (ODbL) : les relations `route=hiking` des réseaux `iwn` et `nwn` (GR, E, sentiers
-- nationaux). Une ligne par relation : référence normalisée, nom, centre et emprise du tracé entier,
-- jamais la géométrie (quelques centaines d'octets par ligne). Importée hors Vercel par
-- `scripts/geo/import_geo_trails.ts`, tuile par tuile, comme `geo_pois`.
--
-- Même règle de lecture que `geo_pois` : réservée à la clé de service (RLS sans politique, aucun
-- droit pour `anon` ni `authenticated`). Servir au public une base OSM impose de la proposer sous
-- ODbL ; ici seul le serveur du Compas lit.
create table if not exists public.geo_trails (
  -- « r123 » : une relation OSM.
  osm_id text primary key check (osm_id ~ '^r[0-9]+$'),
  -- Référence normalisée (« GR34 », « E5 »), null quand OSM n'en donne pas (Kungsleden).
  ref text check (ref is null or ref ~ '^[A-Z0-9]{1,12}$'),
  name text,
  network text not null check (network in ('iwn', 'nwn')),
  lat real not null check (lat between -90 and 90),
  lon real not null check (lon between -180 and 180),
  west real not null check (west between -180 and 180),
  south real not null check (south between -90 and 90),
  east real not null check (east between -180 and 180),
  north real not null check (north between -90 and 90),
  check (west <= east and south <= north),
  check (ref is not null or name is not null),
  seen_on date not null default current_date,
  missed smallint not null default 0
);

create index if not exists geo_trails_ref_idx on public.geo_trails (ref) where ref is not null;

-- Tuiles importées en entier (même grille que `geo_pois_coverage`) : sert à reprendre un import
-- interrompu et à dire si une zone est couverte.
create table if not exists public.geo_trails_coverage (
  west real not null,
  south real not null,
  east real not null,
  north real not null,
  rows integer not null check (rows >= 0),
  done_on date not null default current_date,
  primary key (west, south, east, north),
  check (west < east and south < north and west >= -180 and east <= 180 and south >= -90 and north <= 90)
);

alter table public.geo_trails enable row level security;
alter table public.geo_trails_coverage enable row level security;
-- Aucune politique : seule la clé de service (qui contourne la RLS) lit et écrit.
revoke all on public.geo_trails from anon, authenticated;
revoke all on public.geo_trails_coverage from anon, authenticated;
grant select, insert, update, delete on public.geo_trails to service_role;
grant select, insert, update, delete on public.geo_trails_coverage to service_role;

-- Les lignes qui portent exactement cette référence (jamais « GR5 » pour « GR50 »), au plus 50, les
-- plus étendues d'abord. Le choix du tracé entier est fait côté Compas (`pickTrail`).
create or replace function public.geo_trails_by_ref(p_ref text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(t) order by t.span desc, t.osm_id), '[]'::jsonb)
  from (
    select osm_id, ref, name, network, lat, lon, west, south, east, north,
           (east - west) * (north - south) as span
    from public.geo_trails
    where ref = upper(regexp_replace(coalesce(p_ref, ''), '[^A-Za-z0-9]', '', 'g'))
      and ref is not null
    order by (east - west) * (north - south) desc, osm_id
    limit 50
  ) t;
$$;
revoke all on function public.geo_trails_by_ref(text) from public, anon, authenticated;
grant execute on function public.geo_trails_by_ref(text) to service_role;

-- Fin d'une tuile importée en entier (appelée par le script, dans la même transaction que les
-- écritures) : compte une absence aux relations de la tuile non revues par cet import (centre dans
-- la tuile), retire celles absentes deux fois de suite, note la tuile comme couverte. Les absences ne
-- sont comptées qu'une fois par cycle (20 jours au moins) ; `p_count_misses = false` quand la réponse
-- d'OSM semble vide ou tronquée.
create or replace function public.geo_trails_finish_tile(
  p_west real,
  p_south real,
  p_east real,
  p_north real,
  p_run date default current_date,
  p_count_misses boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_prev date;
  v_missed integer := 0;
  v_deleted integer := 0;
  v_rows integer;
begin
  select done_on into v_prev from public.geo_trails_coverage
  where west = p_west and south = p_south and east = p_east and north = p_north;

  if p_count_misses and (v_prev is null or p_run - v_prev >= 20) then
    update public.geo_trails
       set missed = missed + 1
     where seen_on < p_run
       and lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;
    get diagnostics v_missed = row_count;
    delete from public.geo_trails
     where missed >= 2
       and lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;
    get diagnostics v_deleted = row_count;
  end if;

  select count(*) into v_rows from public.geo_trails
  where lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;

  insert into public.geo_trails_coverage (west, south, east, north, rows, done_on)
  values (p_west, p_south, p_east, p_north, v_rows, p_run)
  on conflict (west, south, east, north) do update set rows = excluded.rows, done_on = excluded.done_on;

  return jsonb_build_object('missed', v_missed, 'deleted', v_deleted, 'rows', v_rows);
end;
$$;
revoke all on function public.geo_trails_finish_tile(real, real, real, real, date, boolean) from public, anon, authenticated;
grant execute on function public.geo_trails_finish_tile(real, real, real, real, date, boolean) to service_role;
