-- Référentiel des parcs et espaces protégés (plan 3.3).
--
-- OpenStreetMap (ODbL) : relations `boundary=national_park`, relations `boundary=protected_area`
-- de classe UICN 1 à 6 (1a et 1b comprises ; un parc naturel régional est de classe 5), et
-- `leisure=nature_reserve` nommées (relations ou chemins fermés). Une ligne par objet : nature, nom,
-- clé de recherche, classe, centre et emprise rectangulaire, jamais le contour. Importée hors Vercel
-- par `scripts/geo/import_geo_areas.ts`, tuile par tuile, comme `geo_trails`. Les massifs de
-- GeoNames (classes T et L) viendront d'un import de fichiers séparé.
--
-- Même règle de lecture que `geo_pois` et `geo_trails` : réservée à la clé de service (RLS sans
-- politique, aucun droit pour `anon` ni `authenticated`). Servir au public une base OSM impose de la
-- proposer sous ODbL ; ici seul le serveur du Compas lit.
create table if not exists public.geo_areas (
  -- « r123 » (relation) ou « w123 » (chemin fermé).
  osm_id text primary key check (osm_id ~ '^[wr][0-9]+$'),
  kind text not null check (kind in ('national_park', 'protected_area', 'nature_reserve')),
  name text not null,
  -- Clé de recherche calculée par le Compas (`normalizeAreaName`) : « vanoise », « calanques ».
  name_plain text not null check (name_plain ~ '^[a-z0-9]+( [a-z0-9]+)*$'),
  protect_class text check (protect_class is null or protect_class in ('1a', '1b', '1', '2', '3', '4', '5', '6')),
  lat real not null check (lat between -90 and 90),
  lon real not null check (lon between -180 and 180),
  west real not null check (west between -180 and 180),
  south real not null check (south between -90 and 90),
  east real not null check (east between -180 and 180),
  north real not null check (north between -90 and 90),
  check (west <= east and south <= north),
  -- Aire du rectangle d'emprise (majorant de la surface réelle), null quand l'emprise est éclatée.
  area_km2 real check (area_km2 is null or area_km2 >= 0),
  seen_on date not null default current_date,
  missed smallint not null default 0
);

create index if not exists geo_areas_name_plain_idx on public.geo_areas (name_plain);

-- Tuiles importées en entier (même grille que `geo_pois_coverage`) : sert à reprendre un import
-- interrompu et à dire si une zone est couverte.
create table if not exists public.geo_areas_coverage (
  west real not null,
  south real not null,
  east real not null,
  north real not null,
  rows integer not null check (rows >= 0),
  done_on date not null default current_date,
  primary key (west, south, east, north),
  check (west < east and south < north and west >= -180 and east <= 180 and south >= -90 and north <= 90)
);

alter table public.geo_areas enable row level security;
alter table public.geo_areas_coverage enable row level security;
-- Aucune politique : seule la clé de service (qui contourne la RLS) lit et écrit.
revoke all on public.geo_areas from anon, authenticated;
revoke all on public.geo_areas_coverage from anon, authenticated;
grant select, insert, update, delete on public.geo_areas to service_role;
grant select, insert, update, delete on public.geo_areas_coverage to service_role;

-- Les lignes dont la clé est exactement celle-ci (normalisée par le Compas, `normalizeAreaName` :
-- la base ne fait que comparer), au plus 50, les plus étendues d'abord (emprise en degrés, la
-- largeur corrigée de la latitude). Le choix final est fait côté Compas (`pickArea`).
create or replace function public.geo_areas_by_name(p_name_plain text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(t) - 'span' order by t.span desc, t.osm_id), '[]'::jsonb)
  from (
    select osm_id, kind, name, name_plain, protect_class, lat, lon, west, south, east, north, area_km2,
           (east - west) * cos(radians(lat)) * (north - south) as span
    from public.geo_areas
    where name_plain = lower(btrim(coalesce(p_name_plain, '')))
    order by (east - west) * cos(radians(lat)) * (north - south) desc, osm_id
    limit 50
  ) t;
$$;
revoke all on function public.geo_areas_by_name(text) from public, anon, authenticated;
grant execute on function public.geo_areas_by_name(text) to service_role;

-- Fin d'une tuile importée en entier (appelée par le script, dans la même transaction que les
-- écritures) : compte une absence aux espaces de la tuile non revus par cet import (centre dans la
-- tuile), retire ceux absents deux fois de suite, note la tuile comme couverte. Les absences ne sont
-- comptées qu'une fois par cycle (20 jours au moins) ; `p_count_misses = false` quand la réponse
-- d'OSM semble vide ou tronquée.
create or replace function public.geo_areas_finish_tile(
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
  select done_on into v_prev from public.geo_areas_coverage
  where west = p_west and south = p_south and east = p_east and north = p_north;

  if p_count_misses and (v_prev is null or p_run - v_prev >= 20) then
    update public.geo_areas
       set missed = missed + 1
     where seen_on < p_run
       and lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;
    get diagnostics v_missed = row_count;
    delete from public.geo_areas
     where missed >= 2
       and lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;
    get diagnostics v_deleted = row_count;
  end if;

  select count(*) into v_rows from public.geo_areas
  where lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;

  insert into public.geo_areas_coverage (west, south, east, north, rows, done_on)
  values (p_west, p_south, p_east, p_north, v_rows, p_run)
  on conflict (west, south, east, north) do update set rows = excluded.rows, done_on = excluded.done_on;

  return jsonb_build_object('missed', v_missed, 'deleted', v_deleted, 'rows', v_rows);
end;
$$;
revoke all on function public.geo_areas_finish_tile(real, real, real, real, date, boolean) from public, anon, authenticated;
grant execute on function public.geo_areas_finish_tile(real, real, real, real, date, boolean) to service_role;
