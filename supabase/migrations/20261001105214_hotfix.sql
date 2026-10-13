-- Hotfix appliqué historiquement en direct sur le projet (supabase_migrations).
-- Reconstruit depuis l'historique distant le 13/10/2026 — version 20261001105214.
-- Conservé tel quel : source de vérité pour la rejouabilité.
create or replace function public.compas_route_pois(
  p_route_id bigint,
  p_radius_m double precision default 1000
)
returns table (
  id bigint,
  name text,
  category text,
  lat double precision,
  lon double precision,
  distance_m double precision,
  elevation_m text
)
language sql
stable
set search_path = public, extensions
as $$
  with near as (
    select
      tp.id,
      tp.name,
      tp.category,
      st_y(tp.geom::geometry) as lat,
      st_x(tp.geom::geometry) as lon,
      st_distance(tp.geom::geography, r.geom::geography) as distance_m,
      tp.tags->>'ele' as elevation_m
    from public.trail_pois tp
    join public.hiking_routes r on r.id = p_route_id
    where tp.category in ('water', 'refuge', 'viewpoint', 'camping', 'peak', 'parking')
      and st_dwithin(
        tp.geom::geography,
        r.geom::geography,
        least(greatest(coalesce(p_radius_m, 1000), 50), 3000)
      )
  ),
  ranked as (
    select near.*, row_number() over (partition by category order by distance_m) as rn
      from near
  )
  select id, name, category, lat, lon, distance_m, elevation_m
    from ranked
   where rn <= 20
   order by
     case category
       when 'water' then 0 when 'refuge' then 1 when 'camping' then 2
       when 'viewpoint' then 3 when 'peak' then 4 else 5
     end,
     distance_m;
$$;

revoke all on function public.compas_route_pois(bigint, double precision) from public;
grant execute on function public.compas_route_pois(bigint, double precision) to anon, authenticated, service_role;
