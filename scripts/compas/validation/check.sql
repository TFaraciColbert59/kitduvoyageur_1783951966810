-- ============================================================================
-- Compas — contrôle en base d'un passage de validation en ligne (PLAN-100, phase 7).
--
-- LECTURE SEULE : un seul SELECT, aucune écriture, aucune fonction créée. Une ligne par voyage.
-- Les colonnes viennent de supabase/baseline/prod_schema_20260911.sql et des migrations
-- (trips, trip_steps, trip_items, trip_expenses, ops_preparation_events, app_errors) ;
-- `trip_steps` n'a pas de colonne `place_id` : le lieu d'une étape est son nom (`location_name`,
-- sinon la fin du titre « Jour N · nom » que le Compas écrit), d'où `steps_no_place`.
--
-- PARAMÈTRES : variables de session, posées avant le script (rien n'est écrit en base). Au choix :
--   (a) une liste de voyages          lkdv.check_trip_ids = 'uuid,uuid,…'
--   (b) une fenêtre + le créateur     lkdv.check_since    = '2026-10-14T08:00:00Z'
--                                     lkdv.check_until    = '2026-10-14T13:00:00Z'  (facultatif)
--                                     lkdv.check_user_id  = 'uuid de la personne qui a lancé le passage'
-- Sans (a) ni (b) complet, aucune ligne : jamais « tous les voyages ».
--
--   psql "$DATABASE_URL" -X -q --csv \
--     -c "set default_transaction_read_only = on" \
--     -c "set lkdv.check_user_id = '…'" -c "set lkdv.check_since = '2026-10-14T08:00:00Z'" \
--     -f scripts/compas/validation/check.sql > check.csv
-- Dans un éditeur SQL qui n'a que des instructions : placer les `set …;` en tête du script.
--
-- DURÉE DE PRÉPARATION. Aucune table ne garde le début et la fin d'une préparation PAR VOYAGE :
--   - `ops_preparation_events` (id, at, kind) : une ligne par issue, sans voyage ni début ;
--   - `adventure_domain_events` : file des événements RGPD (consent.revoked), rien du Compas ;
--   - `app_errors` (at, scope, code, message) : erreurs serveur, sans voyage.
-- La durée est donc lue sur le voyage : `trips.created_at` (le clic sur « Préparer mon aventure »
-- crée le voyage) jusqu'à `metadata.compas.autofill_result.at` (heure serveur de l'issue). Le
-- journal `ops_preparation_events` corrobore la fin (`ops_event_kind` : ligne la plus proche de
-- l'issue, à 30 s près) ; `app_errors_during` compte les erreurs serveur écrites pendant la
-- préparation (sans voyage : exact quand les demandes sont espacées, comme le fait le passage).
--
-- RAYON. `anchor_radius_km` reprend `destinationRadiusKm` (engine/places.ts) : emprise de l'ancre
-- (diagonale / 2 + 30 km, entre 60 et 1 500 km), sinon 400 km pour un pays ou une région, 60 km
-- sinon. `steps_beyond_radius` est nul quand l'ancre ou ses coordonnées manquent.
-- ============================================================================
with
params as (
  select
    nullif(btrim(current_setting('lkdv.check_trip_ids', true)), '') as trip_ids_txt,
    nullif(btrim(current_setting('lkdv.check_since', true)), '')::timestamptz as since_at,
    nullif(btrim(current_setting('lkdv.check_until', true)), '')::timestamptz as until_at,
    nullif(btrim(current_setting('lkdv.check_user_id', true)), '')::uuid as user_id
),
picked as (
  select t.*
    from public.trips t
   cross join params p
   where (
           p.trip_ids_txt is not null
       and t.id = any (regexp_split_to_array(p.trip_ids_txt, '\s*,\s*')::uuid[])
         )
      or (
           p.since_at is not null
       and p.user_id is not null
       and t.user_id = p.user_id
       and t.created_at >= p.since_at
       and (p.until_at is null or t.created_at < p.until_at)
         )
),
-- L'ancre (lieu de la destination) rangée par le Compas sur le voyage, et son rayon.
anchor_raw as (
  select
    t.id as trip_id,
    t.metadata #>> '{compas,anchor,name}' as name,
    t.metadata #>> '{compas,anchor,kind}' as kind,
    t.metadata #>> '{compas,anchor,countryCode}' as country,
    case when jsonb_typeof(t.metadata #> '{compas,anchor,lat}') = 'number'
         then (t.metadata #>> '{compas,anchor,lat}')::float8 end as lat,
    case when jsonb_typeof(t.metadata #> '{compas,anchor,lon}') = 'number'
         then (t.metadata #>> '{compas,anchor,lon}')::float8 end as lon,
    -- Emprise [ouest, nord, est, sud] : quatre nombres, sinon aucune.
    case when jsonb_typeof(t.metadata #> '{compas,anchor,extent}') = 'array'
          and jsonb_array_length(t.metadata #> '{compas,anchor,extent}') = 4
          and jsonb_typeof(t.metadata #> '{compas,anchor,extent,0}') = 'number'
          and jsonb_typeof(t.metadata #> '{compas,anchor,extent,1}') = 'number'
          and jsonb_typeof(t.metadata #> '{compas,anchor,extent,2}') = 'number'
          and jsonb_typeof(t.metadata #> '{compas,anchor,extent,3}') = 'number'
         then (t.metadata #>> '{compas,anchor,extent,0}')::float8 end as w,
    case when jsonb_typeof(t.metadata #> '{compas,anchor,extent}') = 'array'
          and jsonb_array_length(t.metadata #> '{compas,anchor,extent}') = 4
          and jsonb_typeof(t.metadata #> '{compas,anchor,extent,1}') = 'number'
         then (t.metadata #>> '{compas,anchor,extent,1}')::float8 end as n,
    case when jsonb_typeof(t.metadata #> '{compas,anchor,extent}') = 'array'
          and jsonb_array_length(t.metadata #> '{compas,anchor,extent}') = 4
          and jsonb_typeof(t.metadata #> '{compas,anchor,extent,2}') = 'number'
         then (t.metadata #>> '{compas,anchor,extent,2}')::float8 end as e,
    case when jsonb_typeof(t.metadata #> '{compas,anchor,extent}') = 'array'
          and jsonb_array_length(t.metadata #> '{compas,anchor,extent}') = 4
          and jsonb_typeof(t.metadata #> '{compas,anchor,extent,3}') = 'number'
         then (t.metadata #>> '{compas,anchor,extent,3}')::float8 end as s
  from picked t
),
anchor as (
  select
    a.trip_id, a.name, a.kind, a.country, a.lat, a.lon,
    case
      when a.lat is null or a.lon is null then null
      when a.w is not null and a.n is not null and a.e is not null and a.s is not null then
        least(1500, greatest(60, 30 + 6371 * asin(least(1, sqrt(
          power(sin(radians(a.s - a.n) / 2), 2)
          + cos(radians(a.n)) * cos(radians(a.s)) * power(sin(radians(a.e - a.w) / 2), 2)
        )))))
      when a.kind in ('country', 'state', 'region', 'county', 'district') then 400
      else 60
    end as radius_km
  from anchor_raw a
),
-- Étapes : le lieu, les coordonnées, le voisin d'avant dans l'ordre du voyage.
steps0 as (
  select
    s.trip_id, s.id, s.day_number, s.order_index, s.created_at,
    s.latitude::float8 as lat,
    s.longitude::float8 as lon,
    coalesce(
      nullif(btrim(s.location_name), ''),
      nullif(btrim(regexp_replace(s.title, '^\s*Jour\s+\d+\s*[·:–-]?\s*', '', 'i')), '')
    ) as place,
    (s.metadata ->> 'aiProposed') = 'true' as ai_proposed
  from public.trip_steps s
  where s.trip_id in (select id from picked)
),
steps1 as (
  select
    s.*,
    (s.lat is null or s.lon is null
      or (s.lat = 0 and s.lon = 0) or abs(s.lat) > 90 or abs(s.lon) > 180) as no_coords,
    lag(s.place) over w as prev_place,
    lag(s.lat) over w as prev_lat,
    lag(s.lon) over w as prev_lon
  from steps0 s
  window w as (partition by s.trip_id order by s.day_number, s.order_index, s.created_at, s.id)
),
steps2 as (
  select
    s.*,
    -- Même nom, ou même point à ~200 m près, que l'étape d'avant.
    (
      (s.place is not null and s.prev_place is not null and lower(s.place) = lower(s.prev_place))
      or (not s.no_coords and s.prev_lat is not null and s.prev_lon is not null
          and abs(s.lat - s.prev_lat) < 0.002 and abs(s.lon - s.prev_lon) < 0.002)
    ) as dup_prev,
    case
      when s.no_coords or a.radius_km is null then null
      else 2 * 6371 * asin(least(1, sqrt(
        power(sin(radians(s.lat - a.lat) / 2), 2)
        + cos(radians(a.lat)) * cos(radians(s.lat)) * power(sin(radians(s.lon - a.lon) / 2), 2)
      )))
    end as dist_anchor_km,
    a.radius_km
  from steps1 s
  left join anchor a on a.trip_id = s.trip_id
),
step_stats as (
  select
    s.trip_id,
    count(*) as step_count,
    count(*) filter (where s.place is null) as no_place,
    count(*) filter (where s.no_coords) as no_coords,
    count(*) filter (where s.dup_prev) as dup_consecutive,
    count(*) filter (where s.dist_anchor_km is not null and s.dist_anchor_km > s.radius_km) as beyond_radius,
    count(*) filter (where s.ai_proposed) as ai_proposed,
    max(s.day_number) as max_day,
    min(s.lat) filter (where not s.no_coords) as lat_min,
    max(s.lat) filter (where not s.no_coords) as lat_max,
    min(s.lon) filter (where not s.no_coords) as lon_min,
    max(s.lon) filter (where not s.no_coords) as lon_max
  from steps2 s
  group by s.trip_id
),
kit_stats as (
  select i.trip_id, count(*) as kit_items
    from public.trip_items i
   where i.trip_id in (select id from picked)
   group by i.trip_id
),
budget_stats as (
  select x.trip_id,
         count(*) as budget_lines,
         coalesce(sum(x.amount) filter (where x.is_planned), 0) as planned_total
    from public.trip_expenses x
   where x.trip_id in (select id from picked)
   group by x.trip_id
),
-- Issue de la préparation, écrite sur le voyage par le serveur (heure en millisecondes).
prep as (
  select
    t.id as trip_id,
    t.created_at as started_at,
    case when (t.metadata #>> '{compas,autofill_result,at}') ~ '^[0-9]{12,14}$'
         then to_timestamp(((t.metadata #>> '{compas,autofill_result,at}')::bigint) / 1000.0) end as finished_at,
    case
      when (t.metadata #>> '{compas,autofill_result,success}') = 'false' then false
      when (t.metadata #>> '{compas,autofill_result,success}') = 'true'
       and coalesce((t.metadata #>> '{compas,autofill_result,pending}'), 'false') <> 'true' then true
    end as ok,
    left(t.metadata #>> '{compas,autofill_result,error}', 200) as error_text,
    case (t.metadata #>> '{compas,autofill_result,summary,usedAi}')
      when 'true' then true when 'false' then false end as used_ai
  from picked t
)
select
  t.id as trip_id,
  t.slug,
  t.created_at,
  t.title,
  t.destination_name as destination,
  t.destination_country_code as country,
  t.primary_activity::text as activity,
  t.start_date,
  t.end_date,
  coalesce((t.end_date - t.start_date) + 1, st.max_day) as days,
  t.party_size,
  t.metadata #>> '{compas,origin,name}' as origin_name,
  t.metadata #>> '{compas,origin,countryCode}' as origin_country,
  case (t.metadata #>> '{compas,prefs,carFree}') when 'true' then true end as car_free,
  t.metadata #>> '{compas,prefs,nights}' as nights,
  t.estimated_budget,
  t.budget_currency::text as budget_currency,
  t.metadata #>> '{compas,start_say}' as start_say_pending,
  a.name as anchor_name,
  a.kind as anchor_kind,
  a.country as anchor_country,
  a.lat as anchor_lat,
  a.lon as anchor_lon,
  round(a.radius_km::numeric, 1) as anchor_radius_km,
  coalesce(st.step_count, 0) as step_count,
  coalesce(st.no_place, 0) as steps_no_place,
  coalesce(st.no_coords, 0) as steps_no_coords,
  coalesce(st.dup_consecutive, 0) as steps_dup_consecutive,
  case when a.radius_km is null then null else coalesce(st.beyond_radius, 0) end as steps_beyond_radius,
  coalesce(st.ai_proposed, 0) as steps_ai_proposed,
  st.lat_min as steps_lat_min,
  st.lat_max as steps_lat_max,
  st.lon_min as steps_lon_min,
  st.lon_max as steps_lon_max,
  coalesce(k.kit_items, 0) as kit_items,
  coalesce(b.budget_lines, 0) as budget_lines,
  coalesce(b.planned_total, 0) as budget_planned_total,
  p.ok as prep_ok,
  p.error_text as prep_error,
  p.used_ai as prep_used_ai,
  p.started_at as prep_started_at,
  p.finished_at as prep_finished_at,
  round(extract(epoch from (p.finished_at - p.started_at))::numeric, 1) as prep_seconds,
  ev.kind as ops_event_kind,
  ev.gap_s as ops_event_gap_s,
  coalesce(er.n, 0) as app_errors_during,
  er.scopes as app_error_scopes
from picked t
left join anchor a on a.trip_id = t.id
left join step_stats st on st.trip_id = t.id
left join kit_stats k on k.trip_id = t.id
left join budget_stats b on b.trip_id = t.id
left join prep p on p.trip_id = t.id
left join lateral (
  select e.kind, round(extract(epoch from (e.at - p.finished_at))::numeric, 1) as gap_s
    from public.ops_preparation_events e
   where p.finished_at is not null
     and e.at between p.finished_at - interval '30 seconds' and p.finished_at + interval '30 seconds'
   order by abs(extract(epoch from (e.at - p.finished_at))) asc, e.id desc
   limit 1
) ev on true
left join lateral (
  select count(*)::int as n,
         string_agg(distinct (x.scope || coalesce(':' || x.code, '')), ', '
                    order by (x.scope || coalesce(':' || x.code, ''))) as scopes
    from public.app_errors x
   where x.at >= p.started_at
     and x.at <= coalesce(p.finished_at, least(now(), p.started_at + interval '330 seconds'))
                 + interval '5 seconds'
) er on true
order by t.created_at, t.id;
