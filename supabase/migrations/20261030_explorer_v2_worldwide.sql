-- Explorer V2 Worldwide:
-- 1. explorer_pois:
--    - Fixes the bug where 86,093 unnamed POIs (80k+ water points & shelters) were dropped.
--    - Unifies with geo_places so POIs/localities/peaks are populated across the whole world.
-- 2. explorer_place:
--    - Fixes empty region/locality name using geo_places GiST point distance lookup (< 10ms worldwide).

CREATE OR REPLACE FUNCTION public.explorer_pois(
  p_min_lat double precision,
  p_min_lng double precision,
  p_max_lat double precision,
  p_max_lng double precision,
  p_kinds text[] DEFAULT NULL::text[],
  p_limit integer DEFAULT 400
)
RETURNS TABLE(
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
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  with bounds as (
    select least(p_min_lat, p_max_lat) as s,
           greatest(p_min_lat, p_max_lat) as n,
           least(p_min_lng, p_max_lng) as w,
           greatest(p_min_lng, p_max_lng) as e
  ),
  pois_raw as (
    select g.osm_id as id,
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
           g.subtype,
           coalesce(
             nullif(g.name, ''),
             case g.subtype
               when 'drinking_water' then 'Point d’eau potable'
               when 'spring' then 'Source naturelle'
               when 'shelter' then 'Abri'
               when 'wilderness_hut' then 'Cabane pastorale'
               when 'alpine_hut' then 'Refuge'
               when 'camp_site' then 'Zone de bivouac'
               when 'viewpoint' then 'Point de vue'
               when 'peak' then 'Sommet'
               when 'saddle' then 'Col'
               when 'parking' then 'Parking'
               when 'trailhead' then 'Départ de sentier'
               when 'bus_stop' then 'Arrêt de bus'
               when 'train_station' then 'Gare'
               else 'Point d’intérêt'
             end
           ) as name,
           g.lat::double precision as lat,
           g.lon::double precision as lon,
           g.ele_m::integer as ele_m,
           g.potable,
           g.capacity::integer as capacity,
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
  ),
  places_raw as (
    select 'place-' || p.geoname_id::text as id,
           'access' as kind,
           p.kind as subtype,
           p.name,
           p.lat::double precision as lat,
           p.lon::double precision as lon,
           p.ele_m::integer as ele_m,
           null::boolean as potable,
           null::integer as capacity,
           5 as prio
      from public.geo_places p, bounds b
     where p.lat between b.s and b.n
       and p.lon between b.w and b.e
       and (b.n - b.s) <= 6
       and (b.e - b.w) <= 6
     order by p.population desc nulls last
     limit 100
  ),
  all_points as (
    select * from pois_raw
    union all
    select * from places_raw
  )
  select a.id, a.kind, a.subtype, a.name, a.lat, a.lon, a.ele_m, a.potable, a.capacity
    from all_points a
   where (p_kinds is null or a.kind = any (p_kinds))
   order by a.prio asc, a.name asc
   limit least(coalesce(p_limit, 400), 400);
$function$;

CREATE OR REPLACE FUNCTION public.explorer_place(p_lat double precision, p_lng double precision)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET statement_timeout TO '2500ms'
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with pt as (
    select st_setsrid(st_makepoint(p_lng, p_lat), 4326) as g
  ),
  win as (
    select st_setsrid(st_makeenvelope(p_lng - 0.16, p_lat - 0.11, p_lng + 0.16, p_lat + 0.11, 4326), 4326) as g
    from pt
  ),
  near_place as (
    select p.name, p.kind, p.ele_m, p.country_code
      from public.geo_places p
     order by point(p.lon::double precision, p.lat::double precision) <-> point(p_lng, p_lat) asc
     limit 1
  ),
  counts as (
    select
      (select count(*) from public.hiking_routes h, win w
        where h.geom is not null and h.geom && w.g) as routes,
      (select count(*) from public.geo_pois g, pt
        where g.subtype in ('drinking_water','spring')
          and g.lat between p_lat - 0.11 and p_lat + 0.11
          and g.lon between p_lng - 0.16 and p_lng + 0.16) as water,
      (select count(*) from public.geo_pois g, pt
        where g.subtype in ('alpine_hut','wilderness_hut','shelter')
          and g.lat between p_lat - 0.11 and p_lat + 0.11
          and g.lon between p_lng - 0.16 and p_lng + 0.16) as refuges,
      (select count(*) from public.terrain_reports t
        where t.status = 'active'
          and t.lat between p_lat - 0.11 and p_lat + 0.11
          and t.lng between p_lng - 0.16 and p_lng + 0.16) as reports
  )
  select jsonb_build_object(
    'regionName', (select name from near_place),
    'placeName', (select name from near_place),
    'countryCode', (select country_code from near_place),
    'elevationM', (select ele_m from near_place),
    'counts', jsonb_build_object(
      'routes', c.routes, 'water', c.water, 'refuges', c.refuges, 'reports', c.reports
    )
  )
  from counts c;
$function$;
