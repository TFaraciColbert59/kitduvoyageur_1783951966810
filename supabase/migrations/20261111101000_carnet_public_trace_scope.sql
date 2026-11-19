-- RGPD / suivi en direct — le public ne lit plus les points GPS bruts (2026-11-11).
--
-- Constat (revue du 2026-11-10, docs/carnets/maquette-carnets-de-bord.html) :
-- la policy `hike_sessions_select_owner_or_public_carnet` laisse lire à tout
-- lecteur, anonyme compris, toutes les colonnes des sorties rattachées à un
-- carnet public, dont `positions_geojson` et `positions_timed` : la trace GPS
-- brute, horodatée, au mètre. Les propositions 37-46 du carnet (position
-- différée, suivi pendant le voyage) supposent l'inverse : le public ne reçoit
-- qu'un massif et un tracé simplifié.
--
-- Portée complète (reprise du 2026-11-11) :
--   1. retire au rôle `anon` tout accès direct à `public.hike_sessions` ;
--   2. retire au rôle `authenticated` la lecture directe des colonnes brûlantes
--      (`positions_geojson`, `positions_timed`, `poi_events`, `narratives`,
--      `notes`) — il garde les colonnes neutres (statistiques, kit, route,
--      traitement) dont dépendent le fil, les scores et la découverte de kits ;
--   3. expose `public.hike_sessions_public` aux visiteurs : carnets publics
--      seulement, tracé échantillonné (1 point sur 5) arrondi à 3 décimales
--      (~110 m), mesures d'altitude arrondies, sans horodatage ni `user_id` ;
--   4. expose `public.hike_sessions_participant` aux rôles authentifiés :
--      la ligne complète (points bruts compris) uniquement pour sa propre
--      sortie, un carnet où l'on participe, ou une sortie où l'on est présent.
--      C'est la source des écrans qui ont besoin des points : fiche carnet
--      (participant), sorties du compte, carte du compte, cockpit, synchro
--      hors ligne et machine de traitement.
--
-- Non appliquée en production au 2026-11-11 : le code actuellement déployé lit
-- la table brute pour les visiteurs et les sorties personnelles ; la migration
-- doit partir avec le déploiement du code adapté (branche claude/kind-bell-bfyt69).
--
-- Rollback : supabase/migrations_down/20261111101000_carnet_public_trace_scope.down.sql

-- 1) Plus aucun accès direct du rôle anonyme à la table --------------------
revoke select on public.hike_sessions from anon;

-- 2) Le rôle authenticated garde les colonnes neutres, pas les points bruts --
revoke select on public.hike_sessions from authenticated;
grant select (
  id, user_id, route_id, carnet_id, started_at, ended_at, distance_km,
  duration_seconds, elevation_gain_m, kit_id, processing_status,
  processor_version, processed_at, track_quality, visibility, updated_at,
  processing_started_at, processing_attempts, last_processing_error,
  next_retry_at, correlation_id, trip_id, title, max_altitude_m, weather,
  created_at
) on public.hike_sessions to authenticated;

-- 3) Vue publique : trace simplifiée, aucune donnée brûlante ----------------
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
  'Carnet v2 / RGPD : sorties des carnets publics, trace GPS échantillonnée (1 point sur 5, 3 décimales) sans horodatage ni identifiant. Lecture par le rôle anonyme autorisée ; la table hike_sessions reste réservée aux rôles authentifiés (colonnes neutres) et aux participants (vue hike_sessions_participant).';

-- Les privilèges par défaut de Supabase accordent les nouvelles relations à
-- anon/authenticated : on retire explicitement avant de rendre la vue publique,
-- sinon le rôle anonyme aurait aussi la vue participant (constaté en validation).
revoke all on public.hike_sessions_public from public, anon, authenticated;
grant select on public.hike_sessions_public to anon, authenticated;

-- 4) Vue participant : la ligne complète, pour ses propres sorties seulement --
create or replace view public.hike_sessions_participant
with (security_invoker = false) as
select hs.*
from public.hike_sessions hs
where hs.user_id = (select auth.uid())
   or (hs.carnet_id is not null and public.is_carnet_participant(hs.carnet_id))
   or exists (
     select 1
     from public.hike_session_participants p
     where p.session_id = hs.id
       and p.user_id = (select auth.uid())
   );

comment on view public.hike_sessions_participant is
  'Carnet v2 / RGPD : sortie complète (points bruts, événements, récits) pour sa propre sortie, un carnet où l’on participe, ou une sortie où l’on est présent. Le rôle anonyme n’y a pas accès.';

revoke all on public.hike_sessions_participant from public, anon, authenticated;
grant select on public.hike_sessions_participant to authenticated;
