-- Recherche d'un lieu SAISI dans le référentiel des lieux habités (plan 3.1 et 1.3, 17 octobre).
--
-- La destination, le départ ou le domicile que la personne écrit sont cherchés dans `geo_places`
-- (GeoNames cities500 + tous les lieux habités de FR, CH, IT, AT) avant la carte en ligne.
-- Le Compas (`referentialPlaceSearch`, interrupteur `COMPAS_GEO_PLACES_SEARCH`) ne garde qu'un
-- résultat sûr (`pickReferentialPlace`) ; la base ne fait que rendre les candidats.
--
-- Colonnes réelles de `geo_places` : `name` (nom GeoNames, souvent anglais : « Vienna »), pas de
-- nom ASCII ni de nom français. La comparaison se fait donc sur une forme repliée du nom
-- (minuscules, accents latins courants retirés, ponctuation en espaces), calculée ici.
--
-- Index : une clé de trois lettres repliées (`geo_places_search_key`), mesurée en production le
-- 17 octobre sur les 367 747 lignes : 6 191 clés distinctes, environ 2,6 Mo avec la déduplication
-- des index B-tree (PostgreSQL 17), 8,0 Mo au plus sans elle. Un index sur le nom entier aurait
-- pris environ 10 Mo et un index trigramme bien plus : écartés (plafond de 8 Mo, base à ~225 Mo
-- pour 250). Sans index, la même recherche lit toute la table (~400 à 480 ms mesurés).
--
-- NOMS FRANÇAIS (à venir, rien n'est créé ici) : GeoNames `alternateNamesV2` (isolanguage `fr`,
-- nom préféré d'abord) donnerait une colonne `name_fr text` (null si aucun nom français distinct
-- du nom GeoNames), remplie par l'import (`scripts/geo/prep_geo_places.py`), puis un second index
-- partiel `geo_places_search_key(name_fr) where name_fr is not null` et une condition `or` sur
-- cette colonne dans `geo_places_search`. Le Compas lit déjà un `name_fr` éventuel dans chaque
-- ligne (`GeoPlaceSearchRow.name_fr`) et le compare comme le nom GeoNames.
--
-- Lecture de la recherche réservée à la clé de service, comme les référentiels récents
-- (`geo_massifs_by_name`, `geo_areas`) : seul le serveur du Compas cherche.

-- Forme repliée d'un nom : minuscules, accents latins courants retirés, tout le reste en espaces.
create or replace function public.geo_places_search_norm(p text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as '
  select btrim(regexp_replace(
    translate(lower(coalesce(p, '''')),
      ''àáâãäåāăąçćčďèéêëēėęěğìíîïīįıłñńňòóôõöøōőŕřśşšţťùúûüūůűųýÿźżž'',
      ''aaaaaaaaacccdeeeeeeeegiiiiiiilnnnoooooooorrsssttuuuuuuuuyyzzz''),
    ''[^a-z0-9]+'', '' '', ''g''))
';

-- Clé d'index : les trois premières lettres ou chiffres de la forme repliée (sans espace).
create or replace function public.geo_places_search_key(p text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as '
  select left(replace(public.geo_places_search_norm(p), '' '', ''''), 3)
';

create index if not exists geo_places_search_key_idx
  on public.geo_places (public.geo_places_search_key(name));

-- Les lieux dont le nom replié est exactement celui cherché, puis ceux dont il commence par ce nom
-- suivi d'un mot (« bourg en » → « bourg en bresse »), dans un pays s'il est donné ; les noms
-- exacts d'abord, puis les plus peuplés. Au plus 50 lignes. Un nom de moins de trois lettres ou
-- chiffres (ou sans lettre latine) ne rend rien.
create or replace function public.geo_places_search(
  p_q text,
  p_cc text default null,
  p_limit integer default 8
)
returns setof public.geo_places
language sql
stable
security invoker
set search_path = ''
as '
  with q as (
    select public.geo_places_search_norm(left(coalesce(p_q, ''''), 80)) as norm,
           public.geo_places_search_key(left(coalesce(p_q, ''''), 80)) as key,
           upper(nullif(btrim(coalesce(p_cc, '''')), '''')) as cc
  )
  select (c.g).*
  from (
    select g, public.geo_places_search_norm(g.name) as norm
    from q, public.geo_places g
    where char_length(q.key) = 3
      and public.geo_places_search_key(g.name) = q.key
      and (q.cc is null or g.country_code = q.cc)
    offset 0
  ) c, q
  where c.norm = q.norm or c.norm like q.norm || '' %''
  order by (c.norm = q.norm) desc, (c.g).population desc, (c.g).geoname_id
  limit least(greatest(coalesce(p_limit, 8), 1), 50);
';

revoke all on function public.geo_places_search(text, text, integer) from public, anon, authenticated;
grant execute on function public.geo_places_search(text, text, integer) to service_role;
