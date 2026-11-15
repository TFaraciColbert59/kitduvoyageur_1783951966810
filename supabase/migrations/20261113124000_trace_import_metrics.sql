-- ==============================================================================
-- A03 / K6.02 / S1.15 — métriques et séries FIT/TCX réellement disponibles
--
-- Constat fermé : les parseurs lisaient déjà, pour chaque point, la FC, la
-- cadence, la puissance, la température et la distance source, ainsi que le
-- résumé `session` FIT (calories, FC, cadence, vitesses, puissance, minuteur).
-- Aucun contrat ne les conservait : après import, seuls la trace, les tours et
-- la provenance survivaient. Une sortie rechargée ne pouvait donc pas restituer
-- ces mesures, pourtant présentes dans le fichier.
--
-- Cette migration additive :
--   • crée `public.trace_import_summaries`, une ligne par import, réservée au
--     message `session` FIT (origine `fit_session`). Aucune moyenne n'est
--     recalculée depuis les points ;
--   • crée `public.trace_import_samples`, une ligne par point portant au moins
--     une mesure source (FC, cadence, puissance, température, distance). Aucune
--     coordonnée n'est dupliquée : la trace reste dans `hike_sessions` ;
--   • ajoute `average_power_w` à `trace_import_laps` (champ FIT `avg_power`),
--     sans modifier la migration des tours déjà livrée ;
--   • ajoute `record_trace_import_with_metrics(...)`, RPC transactionnelle qui
--     réutilise `record_trace_import_with_laps`, puis écrit le résumé et les
--     mesures dans la même transaction. Un rejeu du même contenu retourne la
--     sortie existante sans réécrire ni compléter ses métriques ;
--   • applique une RLS propriétaire et retire tout accès d'écriture directe.
--
-- Bornes : 10 000 mesures par import, une ligne de résumé, valeurs numériques
-- bornées par des `check`. `null` (absence) et `0` (mesure réelle) sont deux
-- états distincts. Aucun contenu original n'est conservé.
--
-- Prérequis : 20261112123000_trace_import_dedupe.sql et
-- 20261113110000_trace_import_laps.sql. Voir
-- `docs/import/A03-S1.15-metriques.md`.
-- ==============================================================================

begin;

-- ── 1. Clé de portée propriétaire (déjà posée par la migration des tours) ───
-- Le bloc rend cette migration lisible même si la clé a été posée autrement.
do $$
begin
  if not exists (
    select 1
      from pg_catalog.pg_constraint
     where conname = 'trace_imports_lap_scope_key'
       and conrelid = 'public.trace_imports'::regclass
  ) then
    alter table public.trace_imports
      add constraint trace_imports_lap_scope_key
      unique (id, session_id, owner_id);
  end if;
end $$;

-- ── 2. Puissance moyenne de tour, sans toucher à la migration des tours ─────
alter table public.trace_import_laps
  add column if not exists average_power_w double precision;

do $$
begin
  if not exists (
    select 1
      from pg_catalog.pg_constraint
     where conname = 'trace_import_laps_average_power_check'
       and conrelid = 'public.trace_import_laps'::regclass
  ) then
    alter table public.trace_import_laps
      add constraint trace_import_laps_average_power_check
      check (average_power_w is null or average_power_w between 0 and 10000);
  end if;
end $$;

comment on column public.trace_import_laps.average_power_w is
  'A03/S1.15 — puissance moyenne du tour en watts (FIT lap.avg_power), NULL '
  'si le fichier ne la porte pas. Jamais dérivée des points.';

-- ── 3. Résumé `session` FIT, une ligne par import ──────────────────────────
create table if not exists public.trace_import_summaries (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null,
  session_id uuid not null,
  owner_id uuid not null,
  -- `fit_session` : valeurs recopiées du message FIT `session`. Aucune autre
  -- origine n'est admise ; un TCX n'a pas de résumé de session.
  summary_origin text not null,
  started_at timestamptz,
  elapsed_seconds double precision,
  distance_m double precision,
  average_speed_mps double precision,
  max_speed_mps double precision,
  calories_kcal double precision,
  average_heart_rate_bpm double precision,
  max_heart_rate_bpm double precision,
  average_cadence_rpm double precision,
  average_cadence_spm double precision,
  average_power_w double precision,
  max_power_w double precision,
  activity_timer_seconds double precision,
  constraint trace_import_summaries_scope_fkey
    foreign key (import_id, session_id, owner_id)
    references public.trace_imports (id, session_id, owner_id)
    on delete cascade,
  constraint trace_import_summaries_import_key
    unique (import_id),
  constraint trace_import_summaries_origin_check
    check (summary_origin in ('fit_session')),
  constraint trace_import_summaries_started_at_check
    check (
      started_at is null
      or started_at between timestamptz '1900-01-01 00:00:00+00'
                        and timestamptz '2100-01-01 00:00:00+00'
    ),
  constraint trace_import_summaries_elapsed_check
    check (elapsed_seconds is null or elapsed_seconds between 0 and 31536000),
  constraint trace_import_summaries_distance_check
    check (distance_m is null or distance_m between 0 and 100000000),
  constraint trace_import_summaries_average_speed_check
    check (average_speed_mps is null or average_speed_mps between 0 and 1000),
  constraint trace_import_summaries_max_speed_check
    check (max_speed_mps is null or max_speed_mps between 0 and 1000),
  constraint trace_import_summaries_calories_check
    check (calories_kcal is null or calories_kcal between 0 and 1000000),
  constraint trace_import_summaries_average_hr_check
    check (average_heart_rate_bpm is null or average_heart_rate_bpm between 0 and 300),
  constraint trace_import_summaries_max_hr_check
    check (max_heart_rate_bpm is null or max_heart_rate_bpm between 0 and 300),
  constraint trace_import_summaries_average_cadence_rpm_check
    check (average_cadence_rpm is null or average_cadence_rpm between 0 and 500),
  constraint trace_import_summaries_average_cadence_spm_check
    check (average_cadence_spm is null or average_cadence_spm between 0 and 500),
  constraint trace_import_summaries_average_power_check
    check (average_power_w is null or average_power_w between 0 and 10000),
  constraint trace_import_summaries_max_power_check
    check (max_power_w is null or max_power_w between 0 and 10000),
  constraint trace_import_summaries_timer_check
    check (activity_timer_seconds is null or activity_timer_seconds between 0 and 31536000),
  -- Une ligne sans aucune mesure serait un faux résumé : elle est refusée.
  constraint trace_import_summaries_has_metric_check
    check (
      num_nonnulls(
        elapsed_seconds, distance_m, average_speed_mps, max_speed_mps,
        calories_kcal, average_heart_rate_bpm, max_heart_rate_bpm,
        average_cadence_rpm, average_cadence_spm, average_power_w,
        max_power_w, activity_timer_seconds
      ) > 0
    )
);

comment on table public.trace_import_summaries is
  'A03/S1.15 — résumé `session` FIT d''un import, propriétaire seul. Une ligne '
  'par import, valeurs recopiées du fichier (calories, FC, cadence, vitesses, '
  'puissance, minuteur). Aucune moyenne calculée, aucun contenu original.';
comment on column public.trace_import_summaries.summary_origin is
  'Origine du résumé : `fit_session` uniquement. Un TCX n''a pas de résumé de '
  'session et ne produit donc aucune ligne.';
comment on column public.trace_import_summaries.average_power_w is
  'Puissance moyenne de session en watts (FIT session.avg_power), NULL si absente.';
comment on column public.trace_import_summaries.max_power_w is
  'Puissance maximale de session en watts (FIT session.max_power), NULL si absente.';
comment on column public.trace_import_summaries.activity_timer_seconds is
  '`activity.total_timer_time` FIT en secondes, NULL si absent.';

create index if not exists idx_trace_import_summaries_owner
  on public.trace_import_summaries (owner_id, session_id);

-- ── 4. Mesures de point, sans coordonnées dupliquées ───────────────────────
create table if not exists public.trace_import_samples (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null,
  session_id uuid not null,
  owner_id uuid not null,
  sample_index integer not null,
  -- `device` : valeur recopiée d'un point du fichier. Aucune valeur calculée.
  sample_origin text not null,
  recorded_at timestamptz,
  lap_index integer,
  distance_m double precision,
  altitude_m double precision,
  speed_mps double precision,
  heart_rate_bpm double precision,
  cadence_rpm double precision,
  cadence_spm double precision,
  power_w double precision,
  temperature_c double precision,
  constraint trace_import_samples_scope_fkey
    foreign key (import_id, session_id, owner_id)
    references public.trace_imports (id, session_id, owner_id)
    on delete cascade,
  constraint trace_import_samples_session_index_key
    unique (session_id, sample_index),
  constraint trace_import_samples_index_check
    check (sample_index between 0 and 9999),
  constraint trace_import_samples_origin_check
    check (sample_origin in ('device')),
  constraint trace_import_samples_recorded_at_check
    check (
      recorded_at is null
      or recorded_at between timestamptz '1900-01-01 00:00:00+00'
                         and timestamptz '2100-01-01 00:00:00+00'
    ),
  constraint trace_import_samples_lap_index_check
    check (lap_index is null or lap_index between 0 and 9999),
  constraint trace_import_samples_distance_check
    check (distance_m is null or distance_m between 0 and 100000000),
  constraint trace_import_samples_altitude_check
    check (altitude_m is null or altitude_m between -1000 and 10000),
  constraint trace_import_samples_speed_check
    check (speed_mps is null or speed_mps between 0 and 1000),
  constraint trace_import_samples_heart_rate_check
    check (heart_rate_bpm is null or heart_rate_bpm between 0 and 300),
  constraint trace_import_samples_cadence_rpm_check
    check (cadence_rpm is null or cadence_rpm between 0 and 500),
  constraint trace_import_samples_cadence_spm_check
    check (cadence_spm is null or cadence_spm between 0 and 500),
  constraint trace_import_samples_power_check
    check (power_w is null or power_w between 0 and 10000),
  constraint trace_import_samples_temperature_check
    check (temperature_c is null or temperature_c between -100 and 100),
  -- Un point sans mesure ne doit pas être stocké : `null` seul n'est pas une
  -- série. Un zéro réel passe cette contrainte.
  constraint trace_import_samples_has_metric_check
    check (
      num_nonnulls(
        distance_m, altitude_m, speed_mps, heart_rate_bpm,
        cadence_rpm, cadence_spm, power_w, temperature_c
      ) > 0
    )
);

comment on table public.trace_import_samples is
  'A03/S1.15 — mesures de point d''un import FIT/TCX, propriétaire seul. Une '
  'ligne par point portant au moins une mesure source (FC, cadence, puissance, '
  'température, distance). Aucune coordonnée, aucun contenu original, aucune '
  'valeur calculée. Suppression en cascade avec la provenance, la sortie ou le '
  'compte.';
comment on column public.trace_import_samples.sample_origin is
  'Origine de la mesure : `device` uniquement, valeur recopiée d''un point du '
  'fichier. Aucune mesure calculée n''est admise.';
comment on column public.trace_import_samples.recorded_at is
  'Instant UTC du point, NULL si la source n''avait pas de fuseau. Aucune '
  'heure civile n''est convertie sans fuseau.';
comment on column public.trace_import_samples.lap_index is
  'Tour source qui contient le point, NULL quand il n''est pas connu. -1 du '
  'modèle normalisé (aucun tour) n''est jamais stocké comme un tour 0.';
comment on column public.trace_import_samples.distance_m is
  'Distance cumulée source du point en mètres, NULL si absente.';
comment on column public.trace_import_samples.heart_rate_bpm is
  'Fréquence cardiaque source en bpm, NULL si absente. Mesure potentiellement '
  'sensible : jamais partagée hors du propriétaire.';
comment on column public.trace_import_samples.cadence_rpm is
  'Cadence vélo source en tours par minute, NULL si absente.';
comment on column public.trace_import_samples.cadence_spm is
  'Cadence course/marche source en pas par minute, NULL si absente.';
comment on column public.trace_import_samples.power_w is
  'Puissance source en watts, NULL si absente.';
comment on column public.trace_import_samples.temperature_c is
  'Température source en degrés Celsius, NULL si absente.';

create index if not exists idx_trace_import_samples_scope
  on public.trace_import_samples (import_id, session_id, owner_id);
create index if not exists idx_trace_import_samples_owner
  on public.trace_import_samples (owner_id, session_id, sample_index);

-- ── 5. RLS : lecture propriétaire, écriture par la RPC uniquement ──────────
alter table public.trace_import_summaries enable row level security;
alter table public.trace_import_samples enable row level security;

drop policy if exists trace_import_summaries_select_owner on public.trace_import_summaries;
create policy trace_import_summaries_select_owner on public.trace_import_summaries
  for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists trace_import_samples_select_owner on public.trace_import_samples;
create policy trace_import_samples_select_owner on public.trace_import_samples
  for select to authenticated
  using (owner_id = (select auth.uid()));

comment on policy trace_import_summaries_select_owner on public.trace_import_summaries is
  'Résumé FIT lisible par son seul propriétaire. Aucune policy INSERT/UPDATE/'
  'DELETE : `record_trace_import_with_metrics` est la seule porte d''écriture.';
comment on policy trace_import_samples_select_owner on public.trace_import_samples is
  'Mesures de point lisibles par leur seul propriétaire. Aucune policy INSERT/'
  'UPDATE/DELETE : `record_trace_import_with_metrics` est la seule porte '
  'd''écriture.';

revoke all on table public.trace_import_summaries from public, anon, authenticated;
revoke all on table public.trace_import_samples from public, anon, authenticated;
grant select on table public.trace_import_summaries to authenticated;
grant select on table public.trace_import_samples to authenticated;
grant all on table public.trace_import_summaries to service_role;
grant all on table public.trace_import_samples to service_role;

-- ── 6. RPC versionnée : sortie + provenance + tours + métriques ────────────
drop function if exists public.record_trace_import_with_metrics(
  timestamptz, timestamptz, numeric, integer, numeric, integer, jsonb, jsonb,
  jsonb, text, text, text, text, text, integer, uuid, jsonb, jsonb, jsonb
);

create or replace function public.record_trace_import_with_metrics(
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_distance_km numeric,
  p_duration_seconds integer,
  p_elevation_gain_m numeric default null,
  p_max_altitude_m integer default null,
  p_positions_geojson jsonb default null,
  p_positions_timed jsonb default null,
  p_poi_events jsonb default '[]'::jsonb,
  p_title text default null,
  p_notes text default null,
  p_source text default null,
  p_source_fingerprint text default null,
  p_source_file_name text default null,
  p_source_byte_length integer default null,
  p_correlation_id uuid default null,
  p_laps jsonb default '[]'::jsonb,
  p_summary jsonb default null,
  p_samples jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_user uuid := auth.uid();
  v_laps jsonb := coalesce(p_laps, '[]'::jsonb);
  v_samples jsonb := coalesce(p_samples, '[]'::jsonb);
  v_summary jsonb := p_summary;
  v_result jsonb;
  v_session_id uuid;
  v_import_id uuid;
  v_sample_count bigint := 0;
  v_summary_count bigint := 0;
  v_bad bigint := 0;
begin
  if v_user is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;

  -- PostgREST peut transmettre un JSON `null` comme jsonb 'null' plutôt que
  -- comme SQL NULL. Les deux formes signifient « absent » pour ce contrat.
  if v_laps is null or jsonb_typeof(v_laps) = 'null' then
    v_laps := '[]'::jsonb;
  end if;
  if v_samples is null or jsonb_typeof(v_samples) = 'null' then
    v_samples := '[]'::jsonb;
  end if;
  if v_summary is not null and jsonb_typeof(v_summary) = 'null' then
    v_summary := null;
  end if;

  if jsonb_typeof(v_laps) is distinct from 'array' then
    raise exception 'tours du fichier invalides' using errcode = '22023';
  end if;
  if jsonb_typeof(v_samples) is distinct from 'array' then
    raise exception 'mesures du fichier invalides' using errcode = '22023';
  end if;
  if jsonb_array_length(v_samples) > 10000 then
    raise exception 'trop de mesures dans le fichier' using errcode = '22023';
  end if;
  if (jsonb_array_length(v_laps) > 0 or jsonb_array_length(v_samples) > 0)
     and lower(btrim(coalesce(p_source, ''))) not in ('fit', 'tcx') then
    raise exception 'métriques réservées aux imports FIT/TCX' using errcode = '22023';
  end if;

  -- Forme minimale : aucun cast n'est tenté avant ces contrôles de type.
  if v_summary is not null then
    if jsonb_typeof(v_summary) is distinct from 'object' then
      raise exception 'résumé de séance invalide' using errcode = '22023';
    end if;
    if (v_summary ->> 'origin') is distinct from 'fit_session' then
      raise exception 'origine du résumé invalide' using errcode = '22023';
    end if;
    if v_summary ? 'startedAt'
       and jsonb_typeof(v_summary -> 'startedAt') not in ('string', 'null') then
      raise exception 'début du résumé invalide' using errcode = '22023';
    end if;
    if exists (
      select 1
        from jsonb_each(v_summary) as e(key, value)
       where e.key in (
         'elapsedSeconds', 'distanceM', 'averageSpeedMps', 'maxSpeedMps',
         'caloriesKcal', 'averageHeartRateBpm', 'maxHeartRateBpm',
         'averageCadenceRpm', 'averageCadenceSpm', 'averagePowerW',
         'maxPowerW', 'activityTimerSeconds'
       )
         and jsonb_typeof(e.value) not in ('number', 'null')
    ) then
      raise exception 'mesure du résumé invalide' using errcode = '22023';
    end if;
  end if;

  if jsonb_array_length(v_samples) > 0 then
    select count(*)
      into v_bad
      from jsonb_array_elements(v_samples) with ordinality as e(sample, ord)
     where jsonb_typeof(sample) is distinct from 'object'
        or jsonb_typeof(sample -> 'index') is distinct from 'number'
        or jsonb_typeof(sample -> 'origin') is distinct from 'string'
        or (sample ->> 'origin') is distinct from 'device'
        or (sample ? 'recordedAt' and jsonb_typeof(sample -> 'recordedAt') not in ('string', 'null'))
        or (sample ? 'lapIndex' and jsonb_typeof(sample -> 'lapIndex') not in ('number', 'null'))
        or (sample ? 'distanceM' and jsonb_typeof(sample -> 'distanceM') not in ('number', 'null'))
        or (sample ? 'altitudeM' and jsonb_typeof(sample -> 'altitudeM') not in ('number', 'null'))
        or (sample ? 'speedMps' and jsonb_typeof(sample -> 'speedMps') not in ('number', 'null'))
        or (sample ? 'heartRateBpm' and jsonb_typeof(sample -> 'heartRateBpm') not in ('number', 'null'))
        or (sample ? 'cadenceRpm' and jsonb_typeof(sample -> 'cadenceRpm') not in ('number', 'null'))
        or (sample ? 'cadenceSpm' and jsonb_typeof(sample -> 'cadenceSpm') not in ('number', 'null'))
        or (sample ? 'powerW' and jsonb_typeof(sample -> 'powerW') not in ('number', 'null'))
        or (sample ? 'temperatureC' and jsonb_typeof(sample -> 'temperatureC') not in ('number', 'null'));
    if v_bad > 0 then
      raise exception 'mesures du fichier invalides' using errcode = '22023';
    end if;

    -- Index entiers et séquentiels ; `lapIndex` entier ou NULL. Ces casts sont
    -- sûrs : les types ont été vérifiés ci-dessus.
    select count(*)
      into v_bad
      from jsonb_array_elements(v_samples) with ordinality as e(sample, ord)
     where (sample ->> 'index')::numeric <> ord - 1
        or (sample ->> 'index')::numeric <> trunc((sample ->> 'index')::numeric)
        or (
          jsonb_typeof(sample -> 'lapIndex') = 'number'
          and (sample ->> 'lapIndex')::numeric <> trunc((sample ->> 'lapIndex')::numeric)
        );
    if v_bad > 0 then
      raise exception 'index de mesure invalide' using errcode = '22023';
    end if;
  end if;

  -- La RPC des tours reste la seule à créer la sortie et la provenance. Elle
  -- est appelée dans la même transaction : une erreur des métriques annule
  -- la sortie, la provenance et les tours.
  v_result := public.record_trace_import_with_laps(
    p_started_at => p_started_at,
    p_ended_at => p_ended_at,
    p_distance_km => p_distance_km,
    p_duration_seconds => p_duration_seconds,
    p_elevation_gain_m => p_elevation_gain_m,
    p_max_altitude_m => p_max_altitude_m,
    p_positions_geojson => p_positions_geojson,
    p_positions_timed => p_positions_timed,
    p_poi_events => p_poi_events,
    p_title => p_title,
    p_notes => p_notes,
    p_source => p_source,
    p_source_fingerprint => p_source_fingerprint,
    p_source_file_name => p_source_file_name,
    p_source_byte_length => p_source_byte_length,
    p_correlation_id => p_correlation_id,
    p_laps => v_laps
  );

  if v_result is null or (v_result ->> 'session_id') is null then
    raise exception 'import sans sortie' using errcode = '22023';
  end if;
  v_session_id := (v_result ->> 'session_id')::uuid;

  -- Un rejeu du même contenu ne réécrit rien et ne complète pas les métriques
  -- d'un import antérieur : aucun backfill n'est possible sans les données
  -- source. On retourne seulement les compteurs réellement présents.
  if coalesce((v_result ->> 'existing')::boolean, false) then
    select count(*)
      into v_sample_count
      from public.trace_import_samples
     where session_id = v_session_id
       and owner_id = v_user;
    select count(*)
      into v_summary_count
      from public.trace_import_summaries
     where session_id = v_session_id
       and owner_id = v_user;
    return v_result || jsonb_build_object(
      'sample_count', coalesce(v_sample_count, 0),
      'summary_stored', coalesce(v_summary_count, 0) > 0
    );
  end if;

  v_import_id := nullif(v_result ->> 'import_id', '')::uuid;
  if v_import_id is null then
    select id
      into v_import_id
      from public.trace_imports
     where session_id = v_session_id
       and owner_id = v_user;
  end if;
  if v_import_id is null then
    raise exception 'provenance d''import introuvable' using errcode = '22023';
  end if;

  if v_summary is not null then
    insert into public.trace_import_summaries (
      import_id,
      session_id,
      owner_id,
      summary_origin,
      started_at,
      elapsed_seconds,
      distance_m,
      average_speed_mps,
      max_speed_mps,
      calories_kcal,
      average_heart_rate_bpm,
      max_heart_rate_bpm,
      average_cadence_rpm,
      average_cadence_spm,
      average_power_w,
      max_power_w,
      activity_timer_seconds
    )
    select
      v_import_id,
      v_session_id,
      v_user,
      summary.origin,
      summary.started_at,
      summary.elapsed_seconds,
      summary.distance_m,
      summary.average_speed_mps,
      summary.max_speed_mps,
      summary.calories_kcal,
      summary.average_heart_rate_bpm,
      summary.max_heart_rate_bpm,
      summary.average_cadence_rpm,
      summary.average_cadence_spm,
      summary.average_power_w,
      summary.max_power_w,
      summary.activity_timer_seconds
    from jsonb_to_recordset(jsonb_build_array(v_summary)) as summary(
      origin text,
      started_at timestamptz,
      elapsed_seconds double precision,
      distance_m double precision,
      average_speed_mps double precision,
      max_speed_mps double precision,
      calories_kcal double precision,
      average_heart_rate_bpm double precision,
      max_heart_rate_bpm double precision,
      average_cadence_rpm double precision,
      average_cadence_spm double precision,
      average_power_w double precision,
      max_power_w double precision,
      activity_timer_seconds double precision
    );
    get diagnostics v_summary_count = row_count;
  end if;

  -- La RPC des tours ne connaissait pas `avg_power` : la valeur est complétée
  -- ici, dans la même transaction, uniquement pour un nouvel import.
  if jsonb_array_length(v_laps) > 0 then
    update public.trace_import_laps as lap_row
       set average_power_w = lap."averagePowerW"
      from jsonb_to_recordset(v_laps) as lap(
        "index" integer,
        "averagePowerW" double precision
      )
     where lap_row.import_id = v_import_id
       and lap_row.session_id = v_session_id
       and lap_row.owner_id = v_user
       and lap_row.lap_index = lap."index";
  end if;

  if jsonb_array_length(v_samples) > 0 then
    insert into public.trace_import_samples (
      import_id,
      session_id,
      owner_id,
      sample_index,
      sample_origin,
      recorded_at,
      lap_index,
      distance_m,
      altitude_m,
      speed_mps,
      heart_rate_bpm,
      cadence_rpm,
      cadence_spm,
      power_w,
      temperature_c
    )
    select
      v_import_id,
      v_session_id,
      v_user,
      sample."index",
      sample."origin",
      sample."recordedAt",
      sample."lapIndex",
      sample."distanceM",
      sample."altitudeM",
      sample."speedMps",
      sample."heartRateBpm",
      sample."cadenceRpm",
      sample."cadenceSpm",
      sample."powerW",
      sample."temperatureC"
    from jsonb_to_recordset(v_samples) as sample(
      "index" integer,
      "origin" text,
      "recordedAt" timestamptz,
      "lapIndex" integer,
      "distanceM" double precision,
      "altitudeM" double precision,
      "speedMps" double precision,
      "heartRateBpm" double precision,
      "cadenceRpm" double precision,
      "cadenceSpm" double precision,
      "powerW" double precision,
      "temperatureC" double precision
    );
    get diagnostics v_sample_count = row_count;
  end if;

  return v_result || jsonb_build_object(
    'sample_count', coalesce(v_sample_count, 0),
    'summary_stored', coalesce(v_summary_count, 0) > 0
  );
end;
$fn$;

comment on function public.record_trace_import_with_metrics(
  timestamptz, timestamptz, numeric, integer, numeric, integer, jsonb, jsonb,
  jsonb, text, text, text, text, text, integer, uuid, jsonb, jsonb, jsonb
) is
  'A03/S1.15 — enregistre un import, ses tours, son résumé FIT et ses mesures '
  'de point dans une seule transaction. Réutilise '
  'record_trace_import_with_laps (sortie privée + provenance + tours), puis '
  'écrit trace_import_summaries et trace_import_samples. Un rejeu du même '
  'contenu retourne la sortie existante sans réécrire ses métriques. '
  'SECURITY DEFINER, propriétaire issu de auth.uid(), aucun paramètre '
  'propriétaire.';

revoke all on function public.record_trace_import_with_metrics(
  timestamptz, timestamptz, numeric, integer, numeric, integer, jsonb, jsonb,
  jsonb, text, text, text, text, text, integer, uuid, jsonb, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.record_trace_import_with_metrics(
  timestamptz, timestamptz, numeric, integer, numeric, integer, jsonb, jsonb,
  jsonb, text, text, text, text, text, integer, uuid, jsonb, jsonb, jsonb
) to authenticated;

commit;
