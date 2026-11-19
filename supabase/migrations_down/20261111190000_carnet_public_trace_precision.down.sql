-- Retour à la vue publique d'origine : échantillonnage 1/5, arrondi 3 décimales.
create or replace view public.hike_sessions_public
with (security_invoker = false) as
select
  hs.id, hs.carnet_id, hs.route_id, hs.title, hs.started_at, hs.ended_at,
  hs.distance_km, hs.duration_seconds, hs.elevation_gain_m, hs.max_altitude_m, hs.created_at,
  case
    when jsonb_typeof(hs.positions_geojson) = 'object'
     and hs.positions_geojson ->> 'type' = 'LineString'
     and jsonb_typeof(hs.positions_geojson -> 'coordinates') = 'array'
    then jsonb_build_object('type', 'LineString', 'coordinates', (
      select jsonb_agg(jsonb_build_array(round((pt ->> 0)::numeric, 3), round((pt ->> 1)::numeric, 3)) order by ord)
      from jsonb_array_elements(hs.positions_geojson -> 'coordinates') with ordinality as t(pt, ord)
      where mod(ord, 5) = 1 or ord = jsonb_array_length(hs.positions_geojson -> 'coordinates')
    ))
  end as positions_geojson,
  case
    when jsonb_typeof(hs.positions_timed) = 'array'
    then (
      select jsonb_agg(jsonb_build_object('lat', round((elem ->> 'lat')::numeric, 3), 'lng', round((elem ->> 'lng')::numeric, 3), 'elevationM', elem -> 'elevationM') order by ord)
      from jsonb_array_elements(hs.positions_timed) with ordinality as t2(elem, ord)
      where mod(ord, 5) = 1 or ord = jsonb_array_length(hs.positions_timed)
    )
  end as positions_timed
from public.hike_sessions hs
where hs.carnet_id is not null
  and exists (select 1 from public.carnets c where c.id = hs.carnet_id and c.visibility = 'public');
revoke all on public.hike_sessions_public from public, anon, authenticated;
grant select on public.hike_sessions_public to anon, authenticated;
