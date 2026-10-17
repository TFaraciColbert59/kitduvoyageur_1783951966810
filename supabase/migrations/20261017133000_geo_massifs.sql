-- Référentiel des massifs, chaînes et régions naturelles (plan 3.3, GeoNames classes T et L).
--
-- GeoNames (CC BY 4.0, comme `geo_places`) : codes MTS (chaîne, massif), HLLS (groupe de collines),
-- PLAT (plateau), UPLD (hautes terres), PEN (presqu'île), MT seulement quand son nom dit « massif »,
-- et RGN (région naturelle). Une ligne par objet GeoNames : nom, clé de recherche, code, pays,
-- centre, altitude déclarée. AUCUNE emprise : GeoNames donne un point, et rien n'est fabriqué.
-- C'est pourquoi ces lignes ne vont pas dans `geo_areas` (emprise obligatoire, identifiant OSM) :
-- table à part, sans toucher à une table déjà en base.
-- Importée hors Vercel par `scripts/geo/import_geo_massifs.ts` (upsert idempotent sur geoname_id).
--
-- Même règle de lecture que `geo_areas` : réservée à la clé de service (RLS sans politique, aucun
-- droit pour `anon` ni `authenticated`). Seul le serveur du Compas lit.
create table if not exists public.geo_massifs (
  geoname_id integer primary key check (geoname_id > 0),
  feature_code text not null check (feature_code in ('MTS', 'MT', 'HLLS', 'PLAT', 'UPLD', 'PEN', 'RGN')),
  name text not null,
  -- Clé de recherche calculée par le Compas (`normalizeMassifName`) : « vosges », « cantal ».
  name_plain text not null check (name_plain ~ '^[a-z0-9]+( [a-z0-9]+)*$'),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  lat real not null check (lat between -90 and 90),
  lon real not null check (lon between -180 and 180),
  -- Altitude déclarée par GeoNames (colonne `elevation`), jamais celle du modèle de terrain.
  elevation_m smallint check (elevation_m is null or elevation_m between -500 and 9000),
  seen_on date not null default current_date
);

create index if not exists geo_massifs_name_plain_idx on public.geo_massifs (name_plain);

alter table public.geo_massifs enable row level security;
-- Aucune politique : seule la clé de service (qui contourne la RLS) lit et écrit.
revoke all on public.geo_massifs from anon, authenticated;
grant select, insert, update on public.geo_massifs to service_role;

-- Les lignes dont la clé est exactement celle-ci (normalisée par le Compas, `normalizeMassifName` :
-- la base ne fait que comparer), au plus 50, par identifiant. Le choix final (relief d'abord, puis
-- le plus proche du lieu visé, à 150 km au plus) est fait côté Compas (`pickMassif`).
create or replace function public.geo_massifs_by_name(p_name_plain text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as '
  select coalesce(jsonb_agg(to_jsonb(t) order by t.geoname_id), ''[]''::jsonb)
  from (
    select geoname_id, feature_code, name, name_plain, country_code, lat, lon, elevation_m
    from public.geo_massifs
    where name_plain = lower(btrim(coalesce(p_name_plain, '''')))
    order by geoname_id
    limit 50
  ) t;
';
revoke all on function public.geo_massifs_by_name(text) from public, anon, authenticated;
grant execute on function public.geo_massifs_by_name(text) to service_role;
