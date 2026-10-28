begin;

-- Itinéraires dont l'emprise intersecte la fenêtre demandée, géométrie
-- simplifiée pour l'affichage. Bornée en surface pour rester < 300 ms.
create or replace function public.explorer_routes(
  p_min_lat double precision,
  p_min_lng double precision,
  p_max_lat double precision,
  p_max_lng double precision,
  p_limit integer default 60
)
returns table (
  id bigint,
  name text,
  distance_km numeric,
  network text,
  ref text,
  geojson jsonb
)
language sql
stable
set statement_timeout = '2500ms'
as $$
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
$$;

grant execute on function public.explorer_routes(double precision, double precision, double precision, double precision, integer) to anon, authenticated;

commit;
