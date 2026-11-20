-- Rollback for 20261120224000_perf_explorer_pois_routes_gist.sql

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

CREATE OR REPLACE FUNCTION public.explorer_routes(
  p_min_lat double precision,
  p_min_lng double precision,
  p_max_lat double precision,
  p_max_lng double precision,
  p_limit integer DEFAULT 60
)
 RETURNS TABLE(
   id bigint,
   name text,
   distance_km numeric,
   network text,
   ref text,
   geojson jsonb
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET statement_timeout TO '2500ms'
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with win as (
    select st_setsrid(
      st_makeenvelope(
        least(p_min_lng, p_max_lng),
        least(p_min_lat, p_max_lat),
        greatest(p_min_lng, p_max_lng),
        greatest(p_min_lat, p_max_lat),
        4326
      ), 4326) as g
  )
  select h.id,
         h.name,
         h.distance_km,
         h.network,
         h.ref,
         st_asgeojson(st_simplifypreservetopology(h.geom, 0.0008))::jsonb as geojson
    from public.hiking_routes h, win w
   where h.geom is not null
     and h.geom && w.g
     and (st_ymax(w.g) - st_ymin(w.g)) <= 2
     and (st_xmax(w.g) - st_xmin(w.g)) <= 3
   order by coalesce(h.distance_km, 0) asc
   limit least(coalesce(p_limit, 60), 120);
$function$;
