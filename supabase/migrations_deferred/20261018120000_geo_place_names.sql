-- Noms par langue des lieux habités (PLAN-100 6.4, 18 octobre). MIGRATION DIFFÉRÉE : à appliquer à
-- la main (note dans supabase/migrations_deferred/README.md), après 20261017140000_geo_places_search.
--
-- `geo_places.name` est le nom GeoNames, souvent anglais ou local (« Vienna », « Firenze ») : un
-- voyageur qui écrit « Vienne », « Wien » ou « Вена » ne retrouvait pas le lieu dans le référentiel,
-- et l'écran l'affichait sous le nom GeoNames. GeoNames `alternateNamesV2` (CC BY 4.0, comme
-- `geo_places`) donne les noms par langue. Table À PART (aucune colonne ajoutée à `geo_places`) :
-- UNE ligne par lieu et par langue, le nom préféré de cette langue, seulement s'il diffère du nom
-- GeoNames (choix : `src/features/compas/engine/geoPlaceNames.ts`). Aucun nom n'est inventé ni
-- translittéré : sans ligne, le nom GeoNames, comme avant.
--
-- `name_key` : clé de recherche calculée par le Compas (`placeNameKey`) : la clé latine d'avant
-- quand le nom a une lettre latine (« vienne »), sinon l'écriture d'origine en minuscules (« вена »,
-- « 東京 ») ; collation "C" pour qu'un index B-tree serve aussi la recherche par préfixe de mots.
--
-- Taille : langues de l'interface (fr, en, es, de, it) par défaut ; l'import compte les lignes en
-- essai et refuse d'écrire au-dessus de --max-db-mb (scripts/geo/import_geo_place_names.ts).
--
-- Lecture réservée à la clé de service, comme les référentiels récents (`geo_massifs`, `geo_areas`,
-- `geo_places_search`) : RLS activée sans politique, aucun droit pour anon ni authenticated.
-- Aucune suppression, aucun retrait d'objet existant : rejouable telle quelle.

create table if not exists public.geo_place_names (
  place_id integer not null references public.geo_places (geoname_id),
  lang text not null check (lang ~ '^[a-z]{2,3}$'),
  name text not null check (char_length(name) between 1 and 200 and name = btrim(name)),
  name_key text collate "C" not null check (char_length(name_key) between 1 and 200 and name_key = btrim(name_key)),
  -- Ligne d'origine dans alternateNamesV2 (traçabilité, choix stable d'un mois à l'autre).
  alternate_name_id integer not null check (alternate_name_id > 0),
  is_preferred boolean not null default false,
  updated_at date not null default current_date,
  primary key (place_id, lang)
);

create index if not exists geo_place_names_key_idx on public.geo_place_names (name_key);

alter table public.geo_place_names enable row level security;
-- Aucune politique : seule la clé de service (qui contourne la RLS) lit et écrit.
revoke all on public.geo_place_names from public, anon, authenticated;
grant select, insert, update on public.geo_place_names to service_role;

-- Recherche d'un lieu saisi par son nom GeoNames (règles de `geo_places_search`, inchangées) OU par
-- un nom de `geo_place_names`, toute langue et toute écriture : la clé `p_key` est calculée par le
-- Compas (`placeNameKey`), la base ne fait que comparer. Nom exact, ou, pour un nom de plusieurs mots,
-- préfixe de mots (« san jose » → « san jose de … »). Rend aussi `name_local` (le nom dans `p_lang`,
-- s'il existe) et `name_match` (le nom de `geo_place_names` qui a répondu). Les noms exacts d'abord,
-- puis les plus peuplés ; au plus 50 lignes. Le choix final (sûr, sinon rien) est fait par le Compas
-- (`pickReferentialPlace`).
create or replace function public.geo_places_search_names(
  p_q text,
  p_key text,
  p_lang text default null,
  p_cc text default null,
  p_limit integer default 8
)
returns table (
  geoname_id integer,
  name text,
  kind text,
  country_code text,
  admin1 text,
  lat real,
  lon real,
  ele_m smallint,
  population integer,
  timezone text,
  updated_at date,
  name_local text,
  name_match text
)
language sql
stable
security invoker
set search_path = ''
as '
  with q as (
    select public.geo_places_search_norm(left(coalesce(p_q, ''''), 80)) as norm,
           public.geo_places_search_key(left(coalesce(p_q, ''''), 80)) as key,
           (btrim(left(coalesce(p_key, ''''), 80)) collate "C") as nkey,
           lower(nullif(btrim(coalesce(p_lang, '''')), '''')) as lang,
           upper(nullif(btrim(coalesce(p_cc, '''')), '''')) as cc
  ),
  by_name as (
    select c.id, (c.norm = q.norm) as exact, null::text as matched
    from (
      select g.geoname_id as id, public.geo_places_search_norm(g.name) as norm
      from q, public.geo_places g
      where char_length(q.key) = 3
        and public.geo_places_search_key(g.name) = q.key
        and (q.cc is null or g.country_code = q.cc)
      offset 0
    ) c, q
    where c.norm = q.norm or c.norm like q.norm || '' %''
  ),
  by_alt as (
    select n.place_id as id, (n.name_key = q.nkey) as exact, n.name as matched
    from q, public.geo_place_names n
    where char_length(q.nkey) >= 2
      and (
        n.name_key = q.nkey
        or (strpos(q.nkey, '' '') > 0
            and n.name_key >= q.nkey || '' ''
            and n.name_key < q.nkey || ''!'')
      )
  ),
  hits as (
    select h.id,
           bool_or(h.exact) as exact,
           (array_agg(h.matched order by h.exact desc, h.matched) filter (where h.matched is not null))[1] as matched
    from (select * from by_name union all select * from by_alt) h
    group by h.id
  )
  select g.geoname_id, g.name, g.kind, g.country_code, g.admin1, g.lat, g.lon, g.ele_m,
         g.population, g.timezone, g.updated_at, l.name, h.matched
  from hits h
  join public.geo_places g on g.geoname_id = h.id
  cross join q
  left join public.geo_place_names l on l.place_id = g.geoname_id and l.lang = q.lang
  where q.cc is null or g.country_code = q.cc
  order by h.exact desc, g.population desc, g.geoname_id
  limit least(greatest(coalesce(p_limit, 8), 1), 50);
';

revoke all on function public.geo_places_search_names(text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.geo_places_search_names(text, text, text, text, integer) to service_role;
