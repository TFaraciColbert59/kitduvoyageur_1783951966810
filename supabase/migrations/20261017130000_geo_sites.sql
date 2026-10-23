-- Référentiel des sites d'escalade et de ski (plan 3.5).
--
-- ⚠ NE PAS APPLIQUER sans vérifier la place en base (≤ 250 Mo, plan 1.1), comme `geo_pois`.
-- OpenStreetMap (ODbL) : falaises et secteurs (`sport=climbing` + `climbing=crag|area`), via ferrata
-- (`highway=via_ferrata`, `climbing=via_ferrata`), domaines skiables (`landuse=winter_sports`) et gares
-- de remontée nommées (`aerialway=station`). Une ligne par objet : nature, nom, position (centre pour un
-- chemin ou une relation), altitude saisie. Choix des étiquettes : en-tête de
-- `src/features/compas/engine/geoSites.ts`. Importée hors Vercel par `scripts/geo/import_geo_sites.ts`,
-- tuile par tuile, sur la même grille que `geo_pois`.
--
-- Même règle de lecture que `geo_pois` : réservée à la clé de service (RLS sans politique, aucun
-- droit pour `anon` ni `authenticated`). Servir au public une base OSM impose de la proposer sous
-- ODbL ; ici seul le serveur du Compas lit.
create table if not exists public.geo_sites (
  -- « n123 » (nœud), « w456 » (chemin), « r789 » (relation).
  osm_id text primary key check (osm_id ~ '^[nwr][0-9]+$'),
  kind text not null check (kind in ('crag', 'climbing_area', 'via_ferrata', 'winter_sports', 'aerialway_station')),
  -- Toujours un nom propre : un site sans nom (ou au nom commun) n'est pas importé.
  name text not null check (length(name) between 1 and 140),
  lat real not null check (lat between -90 and 90),
  lon real not null check (lon between -180 and 180),
  -- Altitude saisie dans OSM (`ele`), null sinon : jamais devinée.
  ele_m smallint check (ele_m between -500 and 9000),
  -- Dernier import où l'objet était dans OSM, et imports consécutifs où il manquait (retiré à deux).
  seen_on date not null default current_date,
  missed smallint not null default 0
);

-- Recherche par boîte autour d'un point : point GiST, sans colonne (comme `geo_pois`).
create index if not exists geo_sites_pt_idx on public.geo_sites using gist (point(lon, lat));

-- Tuiles importées en entier : [west, east[ × [south, north[ (même grille que `geo_pois_coverage`).
create table if not exists public.geo_sites_coverage (
  west real not null,
  south real not null,
  east real not null,
  north real not null,
  rows integer not null check (rows >= 0),
  done_on date not null default current_date,
  primary key (west, south, east, north),
  check (west < east and south < north and west >= -180 and east <= 180 and south >= -90 and north <= 90)
);

alter table public.geo_sites enable row level security;
alter table public.geo_sites_coverage enable row level security;
-- Aucune politique : seule la clé de service (qui contourne la RLS) lit et écrit.
revoke all on public.geo_sites from anon, authenticated;
revoke all on public.geo_sites_coverage from anon, authenticated;
grant select, insert, update, delete on public.geo_sites to service_role;
grant select, insert, update, delete on public.geo_sites_coverage to service_role;

-- Les sites autour d'un point, et la zone est-elle couverte ? Rend {"covered": bool, "rows": [...]},
-- chaque ligne avec sa distance `distance_km`. Distance approchée (plan local, à ±1 % à ces échelles).
-- Rayon plafonné à 20 km (une île comme Kalymnos, un massif autour d'une base). La boîte peut alors
-- dépasser une tuile : « couverte » est vérifié sur 25 points (grille 5 × 5, coins compris, ≤ 10 km
-- d'écart, moins qu'une tuile de 0,25°), chacun doit tomber dans une tuile importée depuis moins de
-- 400 jours. Non couverte : aucune ligne rendue (le Compas ne conclut pas « rien ici »).
create or replace function public.geo_sites_around(
  p_lat double precision,
  p_lon double precision,
  p_radius_m integer default 10000,
  p_kinds text[] default null,
  p_limit integer default 300
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with bx as (
    select
      p_lat as clat,
      p_lon as clon,
      least(greatest(coalesce(p_radius_m, 10000), 100), 20000)::double precision as r,
      cos(radians(least(greatest(p_lat, -85), 85))) as kx
  ), box_ll as (
    select
      clat, clon, r, kx,
      clat - r / 110574.0 as s,
      clat + r / 110574.0 as n,
      clon - r / (111320.0 * kx) as w,
      clon + r / (111320.0 * kx) as e
    from bx
  ), samples as (
    select b.s + (b.n - b.s) * i / 4.0 as la, b.w + (b.e - b.w) * j / 4.0 as lo
    from box_ll b, generate_series(0, 4) as i, generate_series(0, 4) as j
  ), cov as (
    select coalesce(bool_and(exists (
      select 1 from public.geo_sites_coverage c
      where c.west <= k.lo and k.lo < c.east and c.south <= k.la and k.la < c.north
        and c.done_on > current_date - 400
    )), false) as covered
    from samples k
  ), hits as (
    select
      g.osm_id, g.kind, g.name, g.lat, g.lon, g.ele_m,
      sqrt(power((g.lon - b.clon) * b.kx * 111320.0, 2) + power((g.lat - b.clat) * 110574.0, 2)) as d,
      b.r
    from box_ll b, public.geo_sites g
    where point(g.lon, g.lat) <@ box(point(b.w, b.s), point(b.e, b.n))
      and (p_kinds is null or g.kind = any (p_kinds))
  ), kept as (
    select * from hits where d <= r order by d, osm_id
    limit least(greatest(coalesce(p_limit, 300), 1), 1000)
  )
  select jsonb_build_object(
    'covered', (select covered from cov),
    'rows', case when (select covered from cov) then coalesce((
      select jsonb_agg(jsonb_build_object(
        'osm_id', osm_id, 'kind', kind, 'name', name, 'lat', lat, 'lon', lon, 'ele_m', ele_m,
        'distance_km', round((d / 1000.0)::numeric, 2)
      ) order by d, osm_id)
      from kept
    ), '[]'::jsonb) else '[]'::jsonb end
  );
$$;

-- Fin d'une tuile importée en entier (appelée par le script, dans la même transaction que les
-- écritures) : compte une absence aux sites de la tuile non revus par cet import (position dans la
-- tuile), retire ceux absents deux fois de suite, note la tuile comme couverte. Les absences ne sont
-- comptées qu'une fois par cycle (20 jours au moins) ; `p_count_misses = false` quand la réponse
-- d'OSM semble vide ou tronquée.
create or replace function public.geo_sites_finish_tile(
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
  select done_on into v_prev from public.geo_sites_coverage
  where west = p_west and south = p_south and east = p_east and north = p_north;

  if p_count_misses and (v_prev is null or p_run - v_prev >= 20) then
    update public.geo_sites
       set missed = missed + 1
     where seen_on < p_run
       and lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;
    get diagnostics v_missed = row_count;
    delete from public.geo_sites
     where missed >= 2
       and lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;
    get diagnostics v_deleted = row_count;
  end if;

  select count(*) into v_rows from public.geo_sites
  where lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;

  insert into public.geo_sites_coverage (west, south, east, north, rows, done_on)
  values (p_west, p_south, p_east, p_north, v_rows, p_run)
  on conflict (west, south, east, north) do update set rows = excluded.rows, done_on = excluded.done_on;

  return jsonb_build_object('missed', v_missed, 'deleted', v_deleted, 'rows', v_rows);
end;
$$;

revoke all on function public.geo_sites_around(double precision, double precision, integer, text[], integer) from public, anon, authenticated;
revoke all on function public.geo_sites_finish_tile(real, real, real, real, date, boolean) from public, anon, authenticated;
grant execute on function public.geo_sites_around(double precision, double precision, integer, text[], integer) to service_role;
grant execute on function public.geo_sites_finish_tile(real, real, real, real, date, boolean) to service_role;
