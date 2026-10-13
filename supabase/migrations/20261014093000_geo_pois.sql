-- Référentiel des refuges, cabanes, campings et points d'eau (plan 3.4 et 3.9, lot AG).
--
-- ⚠ NE PAS APPLIQUER avant que Tony ait supprimé `places_geo` (base ≤ 250 Mo,
-- plan 1.1). Table compacte, sur le modèle de `geo_places` (lot E) : OpenStreetMap
-- (ODbL) pour `tourism=alpine_hut|wilderness_hut|camp_site`, `amenity=drinking_water|shelter`,
-- `natural=spring`. Importée hors Vercel par `scripts/geo/import_geo_pois.ts`
-- (Overpass private.coffee, tuile par tuile), relue chaque mois (`.github/workflows/geo-pois-monthly.yml`).
--
-- DIFFÉRENCE AVEC `geo_places` : lecture réservée à la clé de service (RLS sans
-- politique, aucun droit à `anon` ni `authenticated`). Servir au public une base
-- de lieux OSM impose de la proposer sous ODbL (`SERVICES-GRATUITS.md`, points de
-- vigilance) : ici seul le serveur du Compas lit, le public ne voit que des
-- œuvres produites (un point d'eau sur une carte, avec l'attribution).
--
-- `geo_pois_coverage` dit quelles tuiles ont été importées en entier : une étape
-- n'est « couverte » que si les quatre coins de sa boîte tombent dans une tuile
-- importée ; sinon le Compas garde Overpass (secours d'une zone absente). Une zone
-- couverte et vide veut dire « rien ici », pas « on ne sait pas ».
create table if not exists public.geo_pois (
  -- « n123 » (nœud), « w456 » (chemin), « r789 » (relation) : l'identifiant OSM et son type.
  osm_id text primary key check (osm_id ~ '^[nwr][0-9]+$'),
  subtype text not null check (subtype in ('alpine_hut', 'wilderness_hut', 'shelter', 'camp_site', 'drinking_water', 'spring')),
  name text,
  lat real not null check (lat between -90 and 90),
  lon real not null check (lon between -180 and 180),
  ele_m smallint check (ele_m between -500 and 9000),
  -- Places (`beds` d'un refuge, sinon `capacity`), telles que saisies dans OSM ; null sinon.
  capacity smallint check (capacity between 1 and 9999),
  -- Eau potable : vrai si OSM le dit (`drinking_water=yes`, ou `amenity=drinking_water`) ; null : OSM ne dit
  -- rien. Jamais faux : l'eau dite non potable n'est pas importée (un « point d'eau » doit être buvable ou inconnu).
  potable boolean,
  -- Dernier import où l'objet était dans OSM, et nombre d'imports consécutifs où il manquait
  -- (retiré à deux : un objet absent une fois peut venir d'une réponse tronquée).
  seen_on date not null default current_date,
  missed smallint not null default 0
);

-- Recherche par boîte autour d'une étape : point GiST, sans colonne (comme `geo_places`).
create index if not exists geo_pois_pt_idx on public.geo_pois using gist (point(lon, lat));

-- Tuiles importées en entier : [west, east[ × [south, north[ (grille alignée sur des multiples
-- du pas, 0,5° ou 1°), avec la date et le nombre de lignes de l'import.
create table if not exists public.geo_pois_coverage (
  west real not null,
  south real not null,
  east real not null,
  north real not null,
  rows integer not null check (rows >= 0),
  done_on date not null default current_date,
  primary key (west, south, east, north),
  check (west < east and south < north and west >= -180 and east <= 180 and south >= -90 and north <= 90)
);

alter table public.geo_pois enable row level security;
alter table public.geo_pois_coverage enable row level security;
-- Aucune politique : seule la clé de service (qui contourne la RLS) lit et écrit.
revoke all on public.geo_pois from anon, authenticated;
revoke all on public.geo_pois_coverage from anon, authenticated;
grant select, insert, update, delete on public.geo_pois to service_role;
grant select, insert, update, delete on public.geo_pois_coverage to service_role;

-- Les refuges, campings et points d'eau autour d'un point, et la zone est-elle couverte ?
-- Rend {"covered": bool, "rows": [...]}. Distance approchée (plan local, à ±1 % à ces
-- échelles) ; rayon plafonné à 5 km (la boîte reste plus petite qu'une tuile, ce que la
-- vérification des quatre coins suppose). Une tuile importée depuis plus de 400 jours
-- (tâche mensuelle arrêtée) ne compte plus : le Compas retourne à Overpass.
create or replace function public.geo_pois_around(
  p_lat double precision,
  p_lon double precision,
  p_radius_m integer default 1500,
  p_subtypes text[] default null,
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
      least(greatest(coalesce(p_radius_m, 1500), 50), 5000)::double precision as r,
      cos(radians(least(greatest(p_lat, -85), 85))) as kx
  ), box_ll as (
    select
      clat, clon, r, kx,
      clat - r / 110574.0 as s,
      clat + r / 110574.0 as n,
      clon - r / (111320.0 * kx) as w,
      clon + r / (111320.0 * kx) as e
    from bx
  ), corners as (
    select s as la, w as lo from box_ll union all select s, e from box_ll
    union all select n, w from box_ll union all select n, e from box_ll
  ), cov as (
    select coalesce(bool_and(exists (
      select 1 from public.geo_pois_coverage c
      where c.west <= k.lo and k.lo < c.east and c.south <= k.la and k.la < c.north
        and c.done_on > current_date - 400
    )), false) as covered
    from corners k
  ), hits as (
    select
      g.osm_id, g.subtype, g.name, g.lat, g.lon, g.ele_m, g.capacity, g.potable,
      sqrt(power((g.lon - b.clon) * b.kx * 111320.0, 2) + power((g.lat - b.clat) * 110574.0, 2)) as d,
      b.r
    from box_ll b, public.geo_pois g
    where point(g.lon, g.lat) <@ box(point(b.w, b.s), point(b.e, b.n))
      and (p_subtypes is null or g.subtype = any (p_subtypes))
  ), kept as (
    select * from hits where d <= r order by d, osm_id
    limit least(greatest(coalesce(p_limit, 300), 1), 1000)
  )
  select jsonb_build_object(
    'covered', (select covered from cov),
    'rows', case when (select covered from cov) then coalesce((
      select jsonb_agg(jsonb_build_object(
        'osm_id', osm_id, 'subtype', subtype, 'name', name, 'lat', lat, 'lon', lon,
        'ele_m', ele_m, 'capacity', capacity, 'potable', potable
      ) order by d, osm_id)
      from kept
    ), '[]'::jsonb) else '[]'::jsonb end
  );
$$;

-- Fin d'une tuile importée en entier (appelée par le script, dans la même transaction que
-- les écritures) : compte une absence aux objets de la tuile non revus par cet import, retire
-- ceux absents deux fois de suite, note la tuile comme couverte. Les absences ne sont comptées
-- qu'une fois par cycle (20 jours au moins depuis la dernière fois), pour qu'un import relancé
-- le même mois ne retire rien ; `p_count_misses = false` quand la réponse d'OSM semble vide ou
-- tronquée (le script le décide).
create or replace function public.geo_pois_finish_tile(
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
  select done_on into v_prev from public.geo_pois_coverage
   where west = p_west and south = p_south and east = p_east and north = p_north;

  if p_count_misses and (v_prev is null or v_prev <= p_run - 20) then
    update public.geo_pois
       set missed = missed + 1
     where seen_on < p_run
       and lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;
    get diagnostics v_missed = row_count;
    delete from public.geo_pois
     where missed >= 2 and seen_on < p_run
       and lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;
    get diagnostics v_deleted = row_count;
  end if;

  select count(*)::integer into v_rows from public.geo_pois
   where lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;

  insert into public.geo_pois_coverage (west, south, east, north, rows, done_on)
  values (p_west, p_south, p_east, p_north, v_rows, p_run)
  on conflict (west, south, east, north) do update set rows = excluded.rows, done_on = excluded.done_on;

  return jsonb_build_object('missed', v_missed, 'deleted', v_deleted, 'rows', v_rows);
end;
$$;

revoke all on function public.geo_pois_around(double precision, double precision, integer, text[], integer) from public, anon, authenticated;
revoke all on function public.geo_pois_finish_tile(real, real, real, real, date, boolean) from public, anon, authenticated;
grant execute on function public.geo_pois_around(double precision, double precision, integer, text[], integer) to service_role;
grant execute on function public.geo_pois_finish_tile(real, real, real, real, date, boolean) to service_role;
