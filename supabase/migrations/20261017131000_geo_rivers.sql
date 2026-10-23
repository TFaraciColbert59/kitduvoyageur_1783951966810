-- Référentiel des rivières navigables (plan 3.6).
--
-- OpenStreetMap (ODbL) : les relations `waterway=river` nommées (la rivière entière) et les tronçons
-- `waterway=river` qui portent `canoe=*` ou `whitewater=*`. Une ligne par objet OSM : nom, nom de
-- recherche normalisé (sans accent, article ni mot générique : « Le Tarn » → « tarn », « Río Colorado »
-- et « Colorado River » → « colorado »), autres noms normalisés, accès en canoë, difficulté d'eau vive,
-- centre et emprise ; jamais la géométrie. Importée hors Vercel par `scripts/geo/import_geo_rivers.ts`,
-- tuile par tuile, comme `geo_pois` et `geo_trails`. La normalisation est faite côté Compas
-- (`engine/geoRivers.ts`, `normalizeRiverName`) : la base compare des clés déjà prêtes.
--
-- Même règle de lecture que `geo_pois` : réservée à la clé de service (RLS sans politique, aucun
-- droit pour `anon` ni `authenticated`). Servir au public une base OSM impose de la proposer sous
-- ODbL ; ici seul le serveur du Compas lit.
create table if not exists public.geo_rivers (
  -- « r123 » (relation) ou « w123 » (tronçon).
  osm_id text primary key check (osm_id ~ '^[rw][0-9]+$'),
  name text not null check (length(name) between 1 and 140),
  name_plain text not null check (length(name_plain) between 2 and 80 and name_plain = lower(name_plain)),
  alt_plain text[] not null default '{}' check (cardinality(alt_plain) <= 8),
  -- Accès en canoë lu dans OSM ; null = inconnu (`canoe=no` n'est jamais importé).
  canoe text check (canoe is null or canoe in ('yes', 'permissive', 'portage')),
  -- Difficulté d'eau vive (échelle internationale, 0 à 6), null si OSM ne la donne pas.
  whitewater_grade smallint check (whitewater_grade is null or whitewater_grade between 0 and 6),
  -- Longueur déclarée dans OSM (tag `distance`), jamais estimée.
  length_km real check (length_km is null or (length_km > 0 and length_km <= 7000)),
  lat real not null check (lat between -90 and 90),
  lon real not null check (lon between -180 and 180),
  west real not null check (west between -180 and 180),
  south real not null check (south between -90 and 90),
  east real not null check (east between -180 and 180),
  north real not null check (north between -90 and 90),
  check (west <= east and south <= north),
  seen_on date not null default current_date,
  missed smallint not null default 0
);

create index if not exists geo_rivers_name_plain_idx on public.geo_rivers (name_plain);
create index if not exists geo_rivers_alt_plain_idx on public.geo_rivers using gin (alt_plain);

-- Tuiles importées en entier (même grille que `geo_pois_coverage`) : sert à reprendre un import
-- interrompu et à dire si une zone est couverte.
create table if not exists public.geo_rivers_coverage (
  west real not null,
  south real not null,
  east real not null,
  north real not null,
  rows integer not null check (rows >= 0),
  done_on date not null default current_date,
  primary key (west, south, east, north),
  check (west < east and south < north and west >= -180 and east <= 180 and south >= -90 and north <= 90)
);

alter table public.geo_rivers enable row level security;
alter table public.geo_rivers_coverage enable row level security;
-- Aucune politique : seule la clé de service (qui contourne la RLS) lit et écrit.
revoke all on public.geo_rivers from anon, authenticated;
revoke all on public.geo_rivers_coverage from anon, authenticated;
grant select, insert, update, delete on public.geo_rivers to service_role;
grant select, insert, update, delete on public.geo_rivers_coverage to service_role;

-- Les lignes dont le nom de recherche (ou un autre nom) est exactement cette clé, déjà normalisée par
-- le Compas ; au plus 50, les rivières entières puis les plus étendues d'abord. Le choix final (lieu
-- visé, relation, étendue) est fait côté Compas (`pickRiver`).
create or replace function public.geo_rivers_by_name(p_plain text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(t) - 'span' - 'is_rel' order by t.is_rel desc, t.span desc, t.osm_id), '[]'::jsonb)
  from (
    select osm_id, name, name_plain, alt_plain, canoe, whitewater_grade, length_km,
           lat, lon, west, south, east, north,
           (east - west) * (north - south) as span,
           (osm_id like 'r%') as is_rel
    from public.geo_rivers
    where p_plain is not null
      and length(p_plain) between 2 and 80
      and (name_plain = p_plain or alt_plain @> array[p_plain])
    order by (osm_id like 'r%') desc, (east - west) * (north - south) desc, osm_id
    limit 50
  ) t;
$$;
revoke all on function public.geo_rivers_by_name(text) from public, anon, authenticated;
grant execute on function public.geo_rivers_by_name(text) to service_role;

-- Fin d'une tuile importée en entier (appelée par le script, dans la même transaction que les
-- écritures) : compte une absence aux lignes de la tuile non revues par cet import (centre dans
-- la tuile), retire celles absentes deux fois de suite, note la tuile comme couverte. Les absences ne
-- sont comptées qu'une fois par cycle (20 jours au moins) ; `p_count_misses = false` quand la réponse
-- d'OSM semble vide ou tronquée.
create or replace function public.geo_rivers_finish_tile(
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
  select done_on into v_prev from public.geo_rivers_coverage
  where west = p_west and south = p_south and east = p_east and north = p_north;

  if p_count_misses and (v_prev is null or p_run - v_prev >= 20) then
    update public.geo_rivers
       set missed = missed + 1
     where seen_on < p_run
       and lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;
    get diagnostics v_missed = row_count;
    delete from public.geo_rivers
     where missed >= 2
       and lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;
    get diagnostics v_deleted = row_count;
  end if;

  select count(*) into v_rows from public.geo_rivers
  where lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;

  insert into public.geo_rivers_coverage (west, south, east, north, rows, done_on)
  values (p_west, p_south, p_east, p_north, v_rows, p_run)
  on conflict (west, south, east, north) do update set rows = excluded.rows, done_on = excluded.done_on;

  return jsonb_build_object('missed', v_missed, 'deleted', v_deleted, 'rows', v_rows);
end;
$$;
revoke all on function public.geo_rivers_finish_tile(real, real, real, real, date, boolean) from public, anon, authenticated;
grant execute on function public.geo_rivers_finish_tile(real, real, real, real, date, boolean) to service_role;
