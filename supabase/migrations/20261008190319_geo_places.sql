-- Référentiel des lieux habités (plan 3.1 et 3.2, lot E, 8 octobre).
--
-- `places_geo` (import du 11 août interrompu dans l'ordre alphabétique) ne
-- connaît que les villes de plus de 15 000 habitants en France (692 lieux) :
-- inutilisable pour les villages d'étape. `geo_places` est compacte (sans
-- géométrie PostGIS ni trigrammes) : GeoNames `cities500` pour le monde, et
-- tous les lieux habités de France, Suisse, Italie et Autriche, soit environ
-- 368 000 lieux. Lecture publique, écriture par la clé de service seulement.
-- Licence GeoNames CC BY 4.0 (citée dans les mentions légales).
create table if not exists public.geo_places (
  geoname_id integer primary key,
  name text not null,
  kind text not null check (kind in ('city', 'town', 'village', 'hamlet')),
  country_code text not null check (char_length(country_code) = 2),
  admin1 text,
  lat real not null check (lat between -90 and 90),
  lon real not null check (lon between -180 and 180),
  ele_m smallint,
  population integer not null default 0,
  timezone text,
  updated_at date not null default current_date
);

-- Recherche par emprise (zone d'une préparation) : point GiST, sans colonne.
create index if not exists geo_places_pt_idx on public.geo_places using gist (point(lon, lat));
-- Pages Pays : les lieux principaux d'un pays (seulement les plus peuplés).
create index if not exists geo_places_country_pop_idx
  on public.geo_places (country_code, population desc) where population >= 1000;

alter table public.geo_places enable row level security;
create policy geo_places_read on public.geo_places for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.geo_places from anon, authenticated;

-- Les lieux d'une emprise [ouest, sud, est, nord], par natures, les plus peuplés d'abord.
create or replace function public.geo_places_in_box(
  p_west double precision,
  p_south double precision,
  p_east double precision,
  p_north double precision,
  p_kinds text[] default null,
  p_limit integer default 500
)
returns setof public.geo_places
language sql
stable
security invoker
set search_path = ''
as $$
  select g.*
  from public.geo_places g
  where point(g.lon, g.lat) <@ box(point(p_west, p_south), point(p_east, p_north))
    and (p_kinds is null or g.kind = any (p_kinds))
  order by g.population desc, g.geoname_id
  limit least(greatest(coalesce(p_limit, 500), 1), 2000);
$$;

grant execute on function public.geo_places_in_box(double precision, double precision, double precision, double precision, text[], integer) to anon, authenticated;
