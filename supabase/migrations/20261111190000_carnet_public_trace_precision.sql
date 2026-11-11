-- RGPD / fidélité — tracé public du carnet : densité réelle, précision ~10 m.
--
-- Constat de recette (2026-11-11) : la vue publique échantillonnait 1 point sur 5
-- et arrondissait à 3 décimales (~110 m). Sur une sortie réelle de 326 points,
-- le visiteur ne voyait que 66 sommets, une longueur gonflée de 9 % et un écart
-- maximal de 58 m : le tracé quittait visiblement les sentiers.
--
-- Décision : on conserve la densité réelle et l'arrondi passe à 4 décimales
-- (~11 m ; erreur maximale ~7 m). Les protections restent identiques : pas
-- d'horodatage, pas d'identifiant, vue réservée aux carnets publics, rôle
-- `authenticated` conservé pour la lecture, `authenticated` sans accès aux
-- colonnes brutes de `hike_sessions`.
create or replace view public.hike_sessions_public
with (security_invoker = false) as
select
  hs.id,
  hs.carnet_id,
  hs.route_id,
  hs.title,
  hs.started_at,
  hs.ended_at,
  hs.distance_km,
  hs.duration_seconds,
  hs.elevation_gain_m,
  hs.max_altitude_m,
  hs.created_at,
  case
    when jsonb_typeof(hs.positions_geojson) = 'object'
     and hs.positions_geojson ->> 'type' = 'LineString'
     and jsonb_typeof(hs.positions_geojson -> 'coordinates') = 'array'
    then jsonb_build_object('type', 'LineString', 'coordinates', (
      select jsonb_agg(
               jsonb_build_array(
                 round((pt ->> 0)::numeric, 4),
                 round((pt ->> 1)::numeric, 4)
               )
               order by ord
             )
      from jsonb_array_elements(hs.positions_geojson -> 'coordinates')
        with ordinality as t(pt, ord)
    ))
  end as positions_geojson,
  case
    when jsonb_typeof(hs.positions_timed) = 'array'
    then (
      select jsonb_agg(
               jsonb_build_object(
                 'lat', round((elem ->> 'lat')::numeric, 4),
                 'lng', round((elem ->> 'lng')::numeric, 4),
                 'elevationM', elem -> 'elevationM'
               )
               order by ord
             )
      from jsonb_array_elements(hs.positions_timed)
        with ordinality as t2(elem, ord)
    )
  end as positions_timed
from public.hike_sessions hs
where hs.carnet_id is not null
  and exists (
    select 1 from public.carnets c
     where c.id = hs.carnet_id and c.visibility = 'public'
  );

comment on view public.hike_sessions_public is
  'Carnet v2 / RGPD : sorties des carnets publics, tracé à densité réelle arrondi à 4 décimales (~11 m), sans horodatage ni identifiant. Aucun accès anonyme à la table brute.';

revoke all on public.hike_sessions_public from public, anon, authenticated;
grant select on public.hike_sessions_public to anon, authenticated;
