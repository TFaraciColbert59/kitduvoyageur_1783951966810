-- RGPD / suivi en direct — le public ne lit plus les points GPS bruts (2026-11-11).
--
-- Constat (revue du 2026-11-10, docs/carnets/maquette-carnets-de-bord.html) :
-- la policy `hike_sessions_select_owner_or_public_carnet` laisse lire à TOUT
-- lecteur, y compris un anonyme, toutes les colonnes des sorties rattachées à
-- un carnet public, dont `positions_geojson` et `positions_timed` : la trace
-- GPS brute, horodatée, au mètre. Les propositions 37-46 du carnet (position
-- différée, suivi pendant le voyage) supposent l'inverse : le public ne reçoit
-- qu'un massif et un tracé simplifié.
--
-- Portée de cette migration (décision de reprise du 2026-11-11) :
--   1. retire au rôle `anon` tout accès direct à `public.hike_sessions`
--      (le trou anonyme nommé par la maquette) ;
--   2. expose `public.hike_sessions_public` : vue limitée aux carnets publics,
--      colonnes neutres, tracé échantillonné (1 point sur 5) et arrondi à
--      3 décimales (~110 m), sans horodatage ni identifiant de personne ;
--   3. le rôle `authenticated` garde l'accès à la table, y compris les points
--      bruts : c'est le RESTE CONNU de ce correctif. Le fermer exige des vues
--      « participant » et de migrer les lecteurs des sorties personnelles
--      (compte, cockpit, synchronisation hors ligne), hors du périmètre de la
--      reprise ; c'est inscrit dans docs/carnets/SUIVI-REPRISE-2026-11-11.md.
--
-- Non appliquée en production au 2026-11-11 : le code actuellement déployé lit
-- la table brute pour les visiteurs ; l'appliquer seule casserait leur carte.
-- À appliquer dans la même mise en production que le code adapté
-- (`getCarnetDetail` lit la vue pour un visiteur).
--
-- Rollback : supabase/migrations_down/20261111101000_carnet_public_trace_scope.down.sql

-- 1) Plus aucun accès direct du rôle anonyme à la table --------------------
revoke select on public.hike_sessions from anon;

-- 2) Vue publique : trace simplifiée, aucune donnée brûlante ----------------
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
    then jsonb_build_object(
      'type', 'LineString',
      'coordinates', (
        select jsonb_agg(
          jsonb_build_array(
            round((pt ->> 0)::numeric, 3),
            round((pt ->> 1)::numeric, 3)
          )
          order by ord
        )
        from jsonb_array_elements(hs.positions_geojson -> 'coordinates')
          with ordinality as t(pt, ord)
        where mod(ord, 5) = 1
           or ord = jsonb_array_length(hs.positions_geojson -> 'coordinates')
      )
    )
  end as positions_geojson,
  case
    when jsonb_typeof(hs.positions_timed) = 'array'
    then (
      select jsonb_agg(
        jsonb_build_object(
          'lat', round((elem ->> 'lat')::numeric, 3),
          'lng', round((elem ->> 'lng')::numeric, 3),
          'elevationM', elem -> 'elevationM'
        )
        order by ord
      )
      from jsonb_array_elements(hs.positions_timed)
        with ordinality as t2(elem, ord)
      where mod(ord, 5) = 1
         or ord = jsonb_array_length(hs.positions_timed)
    )
  end as positions_timed
from public.hike_sessions hs
where hs.carnet_id is not null
  and exists (
    select 1
    from public.carnets c
    where c.id = hs.carnet_id
      and c.visibility = 'public'
  );

comment on view public.hike_sessions_public is
  'Carnet v2 / RGPD : sorties des carnets publics, trace GPS échantillonnée (1 point sur 5, 3 décimales) sans horodatage ni identifiant. Lecture par le rôle anonyme autorisée ; la table hike_sessions reste réservée aux rôles authentifiés.';

revoke all on public.hike_sessions_public from public;
grant select on public.hike_sessions_public to anon, authenticated;
