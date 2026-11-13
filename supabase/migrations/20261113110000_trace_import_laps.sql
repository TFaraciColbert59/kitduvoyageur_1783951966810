-- ==============================================================================
-- A03 / K6.02 / S2.05 — persistance privée des tours source FIT/TCX
--
-- Constat fermé : les parseurs extraient les tours (`NormalizedTraceLap`),
-- l'aperçu les affiche, mais aucun contrat ne les conservait. Une sortie
-- rechargée ne pouvait donc pas restituer les tours lus dans le fichier.
--
-- Cette migration additive :
--   • crée `public.trace_import_laps`, une ligne par tour source, rattachée à
--     la provenance `trace_imports` et à la sortie `hike_sessions` ;
--   • distingue strictement `device` (lap réellement déclaré par la montre ou
--     le fichier TCX) de `synthetic` (tour unique reconstruit depuis la
--     session FIT quand aucun message `lap` n'existe) ;
--   • n'accepte AUCUN split calculé (km/mile) ni tour manuel Explorer : ces
--     objets restent dans leur contrat `ActivitySplit`, séparé ;
--   • borne chaque champ (index, durées, distances, vitesses, FC, cadence,
--     puissance, calories, compteurs, textes) et le nombre de tours à 10 000 ;
--   • ajoute `record_trace_import_with_laps(...)`, RPC transactionnelle qui
--     réutilise `record_trace_import` puis écrit les tours dans la même
--     transaction. Un rejeu du même contenu retourne la sortie existante sans
--     réécrire ni compléter ses tours ;
--   • applique une RLS propriétaire et retire tout accès d'écriture directe.
--
-- Aucune colonne de `hike_sessions` n'est ajoutée ou modifiée. Aucune donnée
-- originale, aucun point dupliqué, aucun split calculé n'est stocké.
--
-- Prérequis : 20261112123000_trace_import_dedupe.sql (table `trace_imports` et
-- fonction `record_trace_import`). Voir `docs/import/A03-S2.05-persistance.md`.
-- ==============================================================================

begin;

-- ── 1. Clé de portée propriétaire pour la FK composite des tours ───────────
-- `id` est déjà unique ; le triplet l'est donc aussi. Il permet à la table de
-- tours de vérifier en une seule FK qu'import, sortie et propriétaire
-- appartiennent bien au même objet, sans jointure applicative.
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

-- ── 2. Tours source, séparés des splits calculés ───────────────────────────
create table if not exists public.trace_import_laps (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null,
  session_id uuid not null,
  owner_id uuid not null,
  lap_index integer not null,
  -- `device` : lap de montre / élément TCX. `synthetic` : tour unique déduit
  -- du message FIT `session`. Aucune valeur `computed` ou `manual`.
  lap_origin text not null,
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
  max_power_w double precision,
  intensity text,
  trigger_method text,
  point_count integer not null default 0,
  track_count integer not null default 0,
  constraint trace_import_laps_scope_fkey
    foreign key (import_id, session_id, owner_id)
    references public.trace_imports (id, session_id, owner_id)
    on delete cascade,
  constraint trace_import_laps_session_index_key
    unique (session_id, lap_index),
  constraint trace_import_laps_index_check
    check (lap_index between 0 and 9999),
  constraint trace_import_laps_origin_check
    check (lap_origin in ('device', 'synthetic')),
  constraint trace_import_laps_started_at_check
    check (
      started_at is null
      or started_at between timestamptz '1900-01-01 00:00:00+00'
                        and timestamptz '2100-01-01 00:00:00+00'
    ),
  constraint trace_import_laps_elapsed_check
    check (elapsed_seconds is null or elapsed_seconds between 0 and 31536000),
  constraint trace_import_laps_distance_check
    check (distance_m is null or distance_m between 0 and 100000000),
  constraint trace_import_laps_average_speed_check
    check (average_speed_mps is null or average_speed_mps between 0 and 1000),
  constraint trace_import_laps_max_speed_check
    check (max_speed_mps is null or max_speed_mps between 0 and 1000),
  constraint trace_import_laps_calories_check
    check (calories_kcal is null or calories_kcal between 0 and 1000000),
  constraint trace_import_laps_average_hr_check
    check (average_heart_rate_bpm is null or average_heart_rate_bpm between 0 and 300),
  constraint trace_import_laps_max_hr_check
    check (max_heart_rate_bpm is null or max_heart_rate_bpm between 0 and 300),
  constraint trace_import_laps_average_cadence_rpm_check
    check (average_cadence_rpm is null or average_cadence_rpm between 0 and 500),
  constraint trace_import_laps_average_cadence_spm_check
    check (average_cadence_spm is null or average_cadence_spm between 0 and 500),
  constraint trace_import_laps_max_power_check
    check (max_power_w is null or max_power_w between 0 and 10000),
  constraint trace_import_laps_intensity_check
    check (
      intensity is null
      or (
        char_length(intensity) between 1 and 64
        and intensity !~ '[[:cntrl:]<>]'
      )
    ),
  constraint trace_import_laps_trigger_method_check
    check (
      trigger_method is null
      or (
        char_length(trigger_method) between 1 and 64
        and trigger_method !~ '[[:cntrl:]<>]'
      )
    ),
  constraint trace_import_laps_point_count_check
    check (point_count between 0 and 100000),
  constraint trace_import_laps_track_count_check
    check (track_count between 0 and 100000)
);

comment on table public.trace_import_laps is
  'A03/S2.05 — tours source lus dans un fichier FIT/TCX, propriétaire seul. '
  'Une ligne par tour réel (`device`) ou reconstruit depuis la session FIT '
  '(`synthetic`). Aucun split calculé, aucun point dupliqué, aucun contenu '
  'original. Suppression en cascade avec la provenance, la sortie ou le compte.';
comment on column public.trace_import_laps.import_id is
  'Provenance `trace_imports.id` ; la FK composite garantit le même '
  'propriétaire et la même sortie que la provenance.';
comment on column public.trace_import_laps.session_id is
  'Sortie dérivée `hike_sessions.id`, supprimée en cascade avec la provenance.';
comment on column public.trace_import_laps.owner_id is
  'Propriétaire de l''import ; toujours `auth.uid()` à l''écriture, jamais un '
  'identifiant fourni par le client.';
comment on column public.trace_import_laps.lap_index is
  'Rang 0-based du tour dans le fichier, unique par sortie.';
comment on column public.trace_import_laps.lap_origin is
  '`device` pour un lap réellement déclaré, `synthetic` pour le tour unique '
  'reconstruit depuis le message FIT `session`. Jamais `computed` ni `manual`.';
comment on column public.trace_import_laps.started_at is
  'Début UTC du tour, ou NULL si le fichier ne portait pas d''instant '
  'qualifié. Aucune heure civile n''est convertie sans fuseau.';
comment on column public.trace_import_laps.intensity is
  'Chaîne d''intensité source, nettoyée et bornée ; rendue comme du texte.';
comment on column public.trace_import_laps.trigger_method is
  'Chaîne de déclenchement source, nettoyée et bornée ; rendue comme du texte.';

create index if not exists idx_trace_import_laps_scope
  on public.trace_import_laps (import_id, session_id, owner_id);
create index if not exists idx_trace_import_laps_owner
  on public.trace_import_laps (owner_id, session_id, lap_index);

-- ── 3. RLS : lecture propriétaire, écriture par la RPC uniquement ──────────
alter table public.trace_import_laps enable row level security;

drop policy if exists trace_import_laps_select_owner on public.trace_import_laps;
create policy trace_import_laps_select_owner on public.trace_import_laps
  for select to authenticated
  using (owner_id = (select auth.uid()));

comment on policy trace_import_laps_select_owner on public.trace_import_laps is
  'Tours lisibles par leur seul propriétaire. Aucune policy INSERT/UPDATE/'
  'DELETE : `record_trace_import_with_laps` est la seule porte d''écriture.';

revoke all on table public.trace_import_laps from public, anon, authenticated;
grant select on table public.trace_import_laps to authenticated;
grant all on table public.trace_import_laps to service_role;

-- ── 4. RPC versionnée : sortie + provenance + tours, même transaction ──────
drop function if exists public.record_trace_import_with_laps(
  timestamptz, timestamptz, numeric, integer, numeric, integer, jsonb, jsonb,
  jsonb, text, text, text, text, text, integer, uuid, jsonb
);

create or replace function public.record_trace_import_with_laps(
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
  p_laps jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_user uuid := auth.uid();
  v_laps jsonb := coalesce(p_laps, '[]'::jsonb);
  v_result jsonb;
  v_session_id uuid;
  v_import_id uuid;
  v_lap_count bigint;
begin
  if v_user is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;

  if jsonb_typeof(v_laps) is distinct from 'array' then
    raise exception 'tours du fichier invalides' using errcode = '22023';
  end if;
  if jsonb_array_length(v_laps) > 10000 then
    raise exception 'trop de tours dans le fichier' using errcode = '22023';
  end if;
  if jsonb_array_length(v_laps) > 0
     and lower(btrim(coalesce(p_source, ''))) not in ('fit', 'tcx') then
    raise exception 'tours réservés aux imports FIT/TCX' using errcode = '22023';
  end if;

  -- Forme minimale avant tout cast. Les bornes fines sont portées par les
  -- contraintes de la table ; ce contrôle évite un cast ambigu et un message
  -- d'erreur interne pour un appel direct à la RPC.
  if exists (
    select 1
      from jsonb_array_elements(v_laps) with ordinality as e(lap, ord)
     where jsonb_typeof(lap) is distinct from 'object'
        or not (lap ? 'index')
        or not (lap ? 'origin')
        or not (lap ? 'pointCount')
        or not (lap ? 'trackCount')
        or jsonb_typeof(lap -> 'index') is distinct from 'number'
        or jsonb_typeof(lap -> 'origin') is distinct from 'string'
        or jsonb_typeof(lap -> 'pointCount') is distinct from 'number'
        or jsonb_typeof(lap -> 'trackCount') is distinct from 'number'
        or (lap ->> 'origin') not in ('device', 'synthetic')
        or (lap ->> 'index')::numeric not between 0 and 9999
        or (lap ->> 'index')::numeric <> trunc((lap ->> 'index')::numeric)
        or (lap ->> 'index')::numeric <> (ord - 1)
        or (lap ->> 'pointCount')::numeric not between 0 and 100000
        or (lap ->> 'pointCount')::numeric <> trunc((lap ->> 'pointCount')::numeric)
        or (lap ->> 'trackCount')::numeric not between 0 and 100000
        or (lap ->> 'trackCount')::numeric <> trunc((lap ->> 'trackCount')::numeric)
        or (lap ? 'startedAt' and jsonb_typeof(lap -> 'startedAt') not in ('string', 'null'))
        or (lap ? 'intensity' and jsonb_typeof(lap -> 'intensity') not in ('string', 'null'))
        or (lap ? 'triggerMethod' and jsonb_typeof(lap -> 'triggerMethod') not in ('string', 'null'))
  ) then
    raise exception 'tours du fichier invalides' using errcode = '22023';
  end if;

  -- La RPC historique reste la seule à créer la sortie et la provenance. Elle
  -- est appelée dans la même transaction : si l'insertion des tours échoue,
  -- la sortie et la provenance sont annulées avec elle.
  v_result := public.record_trace_import(
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
    p_correlation_id => p_correlation_id
  );

  if v_result is null or (v_result ->> 'session_id') is null then
    raise exception 'import sans sortie' using errcode = '22023';
  end if;
  v_session_id := (v_result ->> 'session_id')::uuid;

  -- Un rejeu du même contenu ne réécrit rien et ne complète pas les tours d'un
  -- import antérieur : aucun backfill n'est possible sans les données source.
  if coalesce((v_result ->> 'existing')::boolean, false) then
    select count(*)
      into v_lap_count
      from public.trace_import_laps
     where session_id = v_session_id
       and owner_id = v_user;
    return v_result || jsonb_build_object('lap_count', coalesce(v_lap_count, 0));
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

  insert into public.trace_import_laps (
    import_id,
    session_id,
    owner_id,
    lap_index,
    lap_origin,
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
    max_power_w,
    intensity,
    trigger_method,
    point_count,
    track_count
  )
  select
    v_import_id,
    v_session_id,
    v_user,
    lap."index",
    lap."origin",
    lap."startedAt",
    lap."elapsedSeconds",
    lap."distanceM",
    lap."averageSpeedMps",
    lap."maxSpeedMps",
    lap."caloriesKcal",
    lap."averageHeartRateBpm",
    lap."maxHeartRateBpm",
    lap."averageCadenceRpm",
    lap."averageCadenceSpm",
    lap."maxPowerW",
    nullif(btrim(left(
      regexp_replace(coalesce(lap."intensity", ''), '[[:cntrl:]<>]', '', 'g'),
      64
    )), ''),
    nullif(btrim(left(
      regexp_replace(coalesce(lap."triggerMethod", ''), '[[:cntrl:]<>]', '', 'g'),
      64
    )), ''),
    lap."pointCount",
    lap."trackCount"
  from jsonb_to_recordset(v_laps) as lap(
    "index" integer,
    "origin" text,
    "startedAt" timestamptz,
    "elapsedSeconds" double precision,
    "distanceM" double precision,
    "averageSpeedMps" double precision,
    "maxSpeedMps" double precision,
    "caloriesKcal" double precision,
    "averageHeartRateBpm" double precision,
    "maxHeartRateBpm" double precision,
    "averageCadenceRpm" double precision,
    "averageCadenceSpm" double precision,
    "maxPowerW" double precision,
    "intensity" text,
    "triggerMethod" text,
    "pointCount" integer,
    "trackCount" integer
  );

  get diagnostics v_lap_count = row_count;
  return v_result || jsonb_build_object('lap_count', coalesce(v_lap_count, 0));
end;
$fn$;

comment on function public.record_trace_import_with_laps(
  timestamptz, timestamptz, numeric, integer, numeric, integer, jsonb, jsonb,
  jsonb, text, text, text, text, text, integer, uuid, jsonb
) is
  'A03/S2.05 — enregistre un import et ses tours source dans une seule '
  'transaction. Réutilise record_trace_import (sortie privée + provenance), '
  'puis insère les tours bornés dans trace_import_laps. Un rejeu du même '
  'contenu retourne la sortie existante sans réécrire ses tours. '
  'SECURITY DEFINER, propriétaire issu de auth.uid(), aucun paramètre '
  'propriétaire.';

revoke all on function public.record_trace_import_with_laps(
  timestamptz, timestamptz, numeric, integer, numeric, integer, jsonb, jsonb,
  jsonb, text, text, text, text, text, integer, uuid, jsonb
) from public, anon, authenticated;

grant execute on function public.record_trace_import_with_laps(
  timestamptz, timestamptz, numeric, integer, numeric, integer, jsonb, jsonb,
  jsonb, text, text, text, text, text, integer, uuid, jsonb
) to authenticated;

commit;
