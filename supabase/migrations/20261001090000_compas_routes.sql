-- Compas — choix et découpage d'un parcours du catalogue.
--
-- 1. compas_search_routes : recherche dans le catalogue (texte et/ou distance
--    à un point) avec le nombre de sorties PUBLIQUES de la communauté sur
--    chaque parcours. Seul un compteur agrégé sort de hike_sessions : jamais
--    une trace, un horaire ni un auteur. D'où SECURITY DEFINER, borné.
-- 2. compas_route_stages : découpe la géométrie réelle d'un parcours en N
--    jours de longueur égale (points de départ et d'arrivée, distance mesurée).
--    Le dénivelé du parcours est réparti à parts égales : sans modèle
--    numérique de terrain, on ne prétend pas le connaître jour par jour.

create or replace function public.compas_search_routes(
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km double precision default 80,
  p_query text default null,
  p_limit integer default 12
)
returns table (
  route_id bigint,
  name text,
  ref text,
  region text,
  distance_km numeric,
  elevation_gain_m integer,
  elevation_loss_m integer,
  duration_hours numeric,
  difficulty text,
  distance_from_m double precision,
  start_lat double precision,
  start_lng double precision,
  community_sessions integer
)
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select
      least(greatest(coalesce(p_limit, 12), 1), 20) as lim,
      least(greatest(coalesce(p_radius_km, 80), 1), 500)::double precision as radius_km,
      nullif(btrim(coalesce(p_query, '')), '') as q,
      (p_lat is not null and p_lng is not null
        and p_lat between -90 and 90 and p_lng between -180 and 180) as has_point
  ),
  terms as (
    select distinct lower(t) as term
      from params, unnest(regexp_split_to_array(coalesce(params.q, ''), '\s+')) as t
     where length(t) >= 3
  ),
  candidates as (
    select
      r.id, r.name, r.ref, r.region, r.distance_km, r.geom,
      m.elevation_gain, m.elevation_loss, m.duration_hours, m.difficulty,
      case when (select has_point from params)
        then st_distance(r.geom::geography, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)
      end as dist_m,
      (select count(*) from terms t
        where r.name ilike '%' || t.term || '%'
           or r.ref ilike '%' || t.term || '%'
           or r.region ilike '%' || t.term || '%')::integer as matches
    from public.hiking_routes r
    left join public.trail_metadata m on m.trail_id = r.id
    cross join params p
    where r.geom is not null
      and not st_isempty(r.geom)
      and st_npoints(r.geom) >= 2
      and (
        not p.has_point
        or (
          r.geom && st_expand(st_setsrid(st_makepoint(p_lng, p_lat), 4326), p.radius_km / 111.32)
          and st_dwithin(r.geom::geography, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p.radius_km * 1000)
        )
      )
  )
  select
    c.id,
    c.name,
    c.ref,
    c.region,
    round(c.distance_km, 1),
    c.elevation_gain,
    c.elevation_loss,
    c.duration_hours,
    c.difficulty,
    c.dist_m,
    st_y(st_startpoint(st_geometryn(c.geom, 1))),
    st_x(st_startpoint(st_geometryn(c.geom, 1))),
    (select count(*) from public.hike_sessions s
      where s.route_id = c.id and s.visibility = 'public')::integer
  from candidates c, params p
  where (p.q is null or c.matches > 0)
    and (p.has_point or p.q is not null)
  order by c.matches desc, c.dist_m asc nulls last, c.distance_km asc
  limit (select lim from params);
$$;

revoke all on function public.compas_search_routes(double precision, double precision, double precision, text, integer) from public, anon;
grant execute on function public.compas_search_routes(double precision, double precision, double precision, text, integer) to authenticated;

create or replace function public.compas_route_stages(p_route_id bigint, p_days integer)
returns table (
  day integer,
  start_lat double precision,
  start_lng double precision,
  end_lat double precision,
  end_lng double precision,
  distance_km numeric,
  elevation_gain_m integer,
  elevation_loss_m integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with route as (
    select r.id, m.elevation_gain, m.elevation_loss,
           (select g.geom from st_dump(st_linemerge(r.geom)) g
             order by st_length(g.geom::geography) desc limit 1) as line
      from public.hiking_routes r
      left join public.trail_metadata m on m.trail_id = r.id
     where r.id = p_route_id and r.geom is not null
  ),
  n as (select least(greatest(coalesce(p_days, 1), 1), 30) as days)
  select
    d,
    st_y(st_lineinterpolatepoint(route.line, (d - 1)::double precision / n.days)),
    st_x(st_lineinterpolatepoint(route.line, (d - 1)::double precision / n.days)),
    st_y(st_lineinterpolatepoint(route.line, d::double precision / n.days)),
    st_x(st_lineinterpolatepoint(route.line, d::double precision / n.days)),
    round((st_length(st_linesubstring(route.line, (d - 1)::double precision / n.days, d::double precision / n.days)::geography) / 1000)::numeric, 1),
    case when route.elevation_gain is null then null else round(route.elevation_gain::numeric / n.days)::integer end,
    case when route.elevation_loss is null then null else round(route.elevation_loss::numeric / n.days)::integer end
  from route, n, generate_series(1, n.days) as d
  where route.line is not null
  order by d;
$$;

grant execute on function public.compas_route_stages(bigint, integer) to authenticated;
