-- Explorer v2 — configuration privée et datée des seuils et zones
-- (S2.10, S2.11, S2.12).
--
-- Objectif : conserver l'historique des configurations de zones saisies par
-- l'utilisateur, sans aucune valeur par défaut et sans réécriture. Chaque
-- configuration porte sa date d'effet, sa date d'enregistrement, son seuil
-- explicite (ou `null`) et ses bornes fournies.
--
-- Portée strictement additive :
--   • une table propriétaire `activity_zone_configs`, clé (user_id, id) ;
--   • une RLS de lecture seule pour le propriétaire ; aucune écriture directe ;
--   • une RPC `save_activity_zone_config` idempotente, `SECURITY DEFINER`,
--     `search_path` verrouillé, `EXECUTE` réservé à `authenticated` ;
--   • aucun seed, aucune zone par défaut, aucun seuil par défaut.
--
-- RLS activée sans `FORCE` : la RPC (propriétaire de la table) écrit, mais les
-- rôles `anon` et `authenticated` n'ont aucun grant d'écriture. Le
-- propriétaire ne peut lire que ses lignes via la politique de lecture.
--
-- Aucun test, build, lint ni `tsc` n'est exécuté dans cette tranche.

begin;

-- 1. Table privée et append-only.
create table if not exists public.activity_zone_configs (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  version text not null,
  discipline text not null,
  metric text not null,
  basis text not null,
  unit text not null,
  threshold_kind text,
  threshold_value numeric,
  threshold_unit text,
  threshold_origin text,
  threshold_measured_at timestamptz,
  effective_from timestamptz not null,
  recorded_at timestamptz not null,
  bands jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id),

  constraint activity_zone_configs_id_check
    check (id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'),
  constraint activity_zone_configs_version_check
    check (version ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'),
  constraint activity_zone_configs_discipline_check
    check (discipline ~ '^[a-z0-9][a-z0-9_-]{0,31}$'),

  constraint activity_zone_configs_metric_check
    check (metric in ('heartRate', 'power', 'pace')),
  constraint activity_zone_configs_basis_check
    check (basis in ('absolute', 'percentOfThreshold')),
  constraint activity_zone_configs_unit_check
    check (unit in ('bpm', 'watts', 'secondsPerKm', 'percent')),

  constraint activity_zone_configs_metric_unit_check
    check (
      (basis = 'percentOfThreshold' and unit = 'percent')
      or (
        basis = 'absolute'
        and (
          (metric = 'heartRate' and unit = 'bpm')
          or (metric = 'power' and unit = 'watts')
          or (metric = 'pace' and unit = 'secondsPerKm')
        )
      )
    ),

  constraint activity_zone_configs_threshold_complete_check
    check (
      (
        threshold_kind is null
        and threshold_value is null
        and threshold_unit is null
        and threshold_origin is null
        and threshold_measured_at is null
      )
      or (
        threshold_kind is not null
        and threshold_value is not null
        and threshold_unit is not null
        and threshold_origin is not null
      )
    ),
  constraint activity_zone_configs_threshold_value_check
    check (
      threshold_value is null
      or (
        threshold_value > 0
        and threshold_value::text not in ('NaN', 'Infinity', '-Infinity')
      )
    ),
  constraint activity_zone_configs_threshold_measured_at_check
    check (
      threshold_measured_at is null
      or (
        threshold_measured_at <> 'infinity'::timestamptz
        and threshold_measured_at <> '-infinity'::timestamptz
      )
    ),
  constraint activity_zone_configs_effective_from_check
    check (
      effective_from <> 'infinity'::timestamptz
      and effective_from <> '-infinity'::timestamptz
    ),
  constraint activity_zone_configs_recorded_at_check
    check (
      recorded_at <> 'infinity'::timestamptz
      and recorded_at <> '-infinity'::timestamptz
    ),
  constraint activity_zone_configs_threshold_kind_check
    check (
      threshold_kind is null
      or threshold_kind in (
        'maxHeartRate', 'lactateThreshold', 'ftp', 'paceThreshold', 'custom'
      )
    ),
  constraint activity_zone_configs_threshold_origin_check
    check (
      threshold_origin is null
      or threshold_origin in ('manual', 'device', 'tested', 'estimated')
    ),
  constraint activity_zone_configs_threshold_kind_metric_check
    check (
      threshold_kind is null
      or (metric = 'power' and threshold_kind = 'ftp')
      or (metric = 'pace' and threshold_kind = 'paceThreshold')
      or (
        metric = 'heartRate'
        and threshold_kind in ('maxHeartRate', 'lactateThreshold', 'custom')
      )
    ),
  constraint activity_zone_configs_threshold_unit_metric_check
    check (
      threshold_unit is null
      or (metric = 'heartRate' and threshold_unit = 'bpm')
      or (metric = 'power' and threshold_unit = 'watts')
      or (metric = 'pace' and threshold_unit = 'secondsPerKm')
    ),
  constraint activity_zone_configs_threshold_required_check
    check (basis <> 'percentOfThreshold' or threshold_value is not null),

  constraint activity_zone_configs_bands_check
    check (
      jsonb_typeof(bands) = 'array'
      and jsonb_array_length(bands) between 1 and 20
    )
);

comment on table public.activity_zone_configs is
  'S2.10–S2.12 — historique privé et daté des configurations de zones et de seuils. '
  'Append-only : une nouvelle configuration est une nouvelle ligne ; aucune mise à jour.';
comment on column public.activity_zone_configs.user_id is
  'Propriétaire de la configuration ; la RLS ne lit que user_id = auth.uid().';
comment on column public.activity_zone_configs.id is
  'Identifiant stable fourni par le client ; clé d''idempotence avec user_id.';
comment on column public.activity_zone_configs.version is
  'Version explicite de la configuration, fournie par le client.';
comment on column public.activity_zone_configs.effective_from is
  'Date d''effet de la configuration ; fournie, jamais calculée par le serveur.';
comment on column public.activity_zone_configs.recorded_at is
  'Date d''enregistrement déclarée par l''utilisateur ; fournie, jamais remplacée par now().';
comment on column public.activity_zone_configs.threshold_value is
  'Valeur du seuil dans son unité canonique ; NULL si aucun seuil n''a été fourni.';
comment on column public.activity_zone_configs.bands is
  'Bornes [lower, upper) fournies : id, label, lower, upper. Les trous sont permis, aucun comblement.';

create index if not exists activity_zone_configs_lookup_idx
  on public.activity_zone_configs (
    user_id, metric, discipline, effective_from desc, recorded_at desc
  );
create index if not exists activity_zone_configs_recorded_idx
  on public.activity_zone_configs (user_id, recorded_at desc);

alter table public.activity_zone_configs enable row level security;

drop policy if exists activity_zone_configs_owner_read on public.activity_zone_configs;
create policy activity_zone_configs_owner_read
  on public.activity_zone_configs
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists activity_zone_configs_service_all on public.activity_zone_configs;
create policy activity_zone_configs_service_all
  on public.activity_zone_configs
  for all to service_role
  using (true)
  with check (true);

revoke all on public.activity_zone_configs from public, anon, authenticated, service_role;
grant select on public.activity_zone_configs to authenticated;
grant select, insert on public.activity_zone_configs to service_role;

-- 2. RPC d'écriture : validation explicite puis insertion idempotente.
create or replace function public.save_activity_zone_config(
  p_id text,
  p_version text,
  p_discipline text,
  p_metric text,
  p_basis text,
  p_unit text,
  p_threshold_kind text,
  p_threshold_value numeric,
  p_threshold_unit text,
  p_threshold_origin text,
  p_threshold_measured_at timestamptz,
  p_effective_from timestamptz,
  p_recorded_at timestamptz,
  p_bands jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_row public.activity_zone_configs%rowtype;
  v_created boolean := false;
  v_bands jsonb := '[]'::jsonb;
  v_band jsonb;
  v_index integer := 0;
  v_total integer;
  v_id text;
  v_label text;
  v_lower numeric;
  v_upper numeric;
  v_prev_upper numeric;
  v_prev_open boolean := false;
  v_seen text[] := array[]::text[];
begin
  if v_user is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;

  if p_id is null or p_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$' then
    raise exception 'identifiant de configuration invalide' using errcode = '22023';
  end if;
  if p_version is null or p_version !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$' then
    raise exception 'version de configuration invalide' using errcode = '22023';
  end if;
  if p_discipline is null or p_discipline !~ '^[a-z0-9][a-z0-9_-]{0,31}$' then
    raise exception 'discipline invalide' using errcode = '22023';
  end if;
  if p_metric is null or p_metric not in ('heartRate', 'power', 'pace') then
    raise exception 'métrique invalide' using errcode = '22023';
  end if;
  if p_basis is null or p_basis not in ('absolute', 'percentOfThreshold') then
    raise exception 'base de zones invalide' using errcode = '22023';
  end if;
  if p_unit is null or p_unit not in ('bpm', 'watts', 'secondsPerKm', 'percent') then
    raise exception 'unité de zone invalide' using errcode = '22023';
  end if;
  if p_effective_from is null or p_recorded_at is null
     or p_effective_from in ('infinity'::timestamptz, '-infinity'::timestamptz)
     or p_recorded_at in ('infinity'::timestamptz, '-infinity'::timestamptz) then
    raise exception 'dates de configuration requises' using errcode = '22023';
  end if;
  if p_threshold_measured_at is not null
     and p_threshold_measured_at in ('infinity'::timestamptz, '-infinity'::timestamptz) then
    raise exception 'date de mesure du seuil invalide' using errcode = '22023';
  end if;

  if p_basis = 'percentOfThreshold' then
    if p_unit <> 'percent' then
      raise exception 'unité de zone invalide pour un pourcentage' using errcode = '22023';
    end if;
  else
    if not (
      (p_metric = 'heartRate' and p_unit = 'bpm')
      or (p_metric = 'power' and p_unit = 'watts')
      or (p_metric = 'pace' and p_unit = 'secondsPerKm')
    ) then
      raise exception 'unité de zone invalide pour cette métrique' using errcode = '22023';
    end if;
  end if;

  if p_threshold_kind is null then
    if p_threshold_value is not null
       or p_threshold_unit is not null
       or p_threshold_origin is not null
       or p_threshold_measured_at is not null then
      raise exception 'seuil incomplet' using errcode = '22023';
    end if;
    if p_basis = 'percentOfThreshold' then
      raise exception 'seuil requis pour des zones en pourcentage' using errcode = '22023';
    end if;
  else
    if p_threshold_value is null
       or p_threshold_unit is null
       or p_threshold_origin is null then
      raise exception 'seuil incomplet' using errcode = '22023';
    end if;
    if p_threshold_value <= 0
       or p_threshold_value::text in ('NaN', 'Infinity', '-Infinity') then
      raise exception 'valeur de seuil invalide' using errcode = '22023';
    end if;
    if p_threshold_origin not in ('manual', 'device', 'tested', 'estimated') then
      raise exception 'origine de seuil invalide' using errcode = '22023';
    end if;
    if p_threshold_kind not in (
      'maxHeartRate', 'lactateThreshold', 'ftp', 'paceThreshold', 'custom'
    ) then
      raise exception 'type de seuil invalide' using errcode = '22023';
    end if;
    if not (
      (p_metric = 'power' and p_threshold_kind = 'ftp')
      or (p_metric = 'pace' and p_threshold_kind = 'paceThreshold')
      or (
        p_metric = 'heartRate'
        and p_threshold_kind in ('maxHeartRate', 'lactateThreshold', 'custom')
      )
    ) then
      raise exception 'type de seuil incompatible avec la métrique' using errcode = '22023';
    end if;
    if not (
      (p_metric = 'heartRate' and p_threshold_unit = 'bpm')
      or (p_metric = 'power' and p_threshold_unit = 'watts')
      or (p_metric = 'pace' and p_threshold_unit = 'secondsPerKm')
    ) then
      raise exception 'unité de seuil incompatible avec la métrique' using errcode = '22023';
    end if;
  end if;

  if p_bands is null or jsonb_typeof(p_bands) <> 'array' then
    raise exception 'zones invalides' using errcode = '22023';
  end if;
  v_total := jsonb_array_length(p_bands);
  if v_total < 1 or v_total > 20 then
    raise exception 'nombre de zones invalide' using errcode = '22023';
  end if;

  for v_band in select value from jsonb_array_elements(p_bands) loop
    v_index := v_index + 1;

    if jsonb_typeof(v_band) <> 'object' then
      raise exception 'zone % invalide', v_index using errcode = '22023';
    end if;
    if not (v_band ? 'id' and v_band ? 'label' and v_band ? 'lower' and v_band ? 'upper') then
      raise exception 'zone % incomplète', v_index using errcode = '22023';
    end if;
    if jsonb_typeof(v_band->'id') <> 'string'
       or jsonb_typeof(v_band->'label') <> 'string' then
      raise exception 'libellé de zone % invalide', v_index using errcode = '22023';
    end if;

    v_id := v_band->>'id';
    v_label := v_band->>'label';
    if v_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$' then
      raise exception 'identifiant de zone % invalide', v_index using errcode = '22023';
    end if;
    if v_id = any(v_seen) then
      raise exception 'identifiant de zone % en double', v_index using errcode = '22023';
    end if;
    if char_length(v_label) < 1
       or char_length(v_label) > 80
       or btrim(v_label) = '' then
      raise exception 'libellé de zone % invalide', v_index using errcode = '22023';
    end if;

    if jsonb_typeof(v_band->'lower') <> 'number' then
      raise exception 'borne basse de zone % invalide', v_index using errcode = '22023';
    end if;
    v_lower := (v_band->>'lower')::numeric;
    if v_lower < 0 then
      raise exception 'borne basse de zone % invalide', v_index using errcode = '22023';
    end if;

    if jsonb_typeof(v_band->'upper') = 'null' then
      v_upper := null;
    elsif jsonb_typeof(v_band->'upper') = 'number' then
      v_upper := (v_band->>'upper')::numeric;
    else
      raise exception 'borne haute de zone % invalide', v_index using errcode = '22023';
    end if;

    if v_upper is not null and v_upper <= v_lower then
      raise exception 'intervalle de zone % invalide', v_index using errcode = '22023';
    end if;
    if v_upper is null and v_index <> v_total then
      raise exception 'zone ouverte % non terminale', v_index using errcode = '22023';
    end if;
    if v_prev_open then
      raise exception 'zone % après une zone ouverte', v_index using errcode = '22023';
    end if;
    if v_prev_upper is not null and v_lower < v_prev_upper then
      raise exception 'chevauchement de zone %', v_index using errcode = '22023';
    end if;

    v_seen := array_append(v_seen, v_id);
    v_bands := v_bands || jsonb_build_array(
      jsonb_build_object(
        'id', v_id,
        'label', v_label,
        'lower', v_lower,
        'upper', v_upper
      )
    );

    if v_upper is null then
      v_prev_open := true;
      v_prev_upper := null;
    else
      v_prev_upper := v_upper;
    end if;
  end loop;

  -- Sérialise les rejeux concurrents de la même clé propriétaire.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user::text || ':' || p_id, 0)
  );

  insert into public.activity_zone_configs (
    user_id,
    id,
    version,
    discipline,
    metric,
    basis,
    unit,
    threshold_kind,
    threshold_value,
    threshold_unit,
    threshold_origin,
    threshold_measured_at,
    effective_from,
    recorded_at,
    bands
  ) values (
    v_user,
    p_id,
    p_version,
    p_discipline,
    p_metric,
    p_basis,
    p_unit,
    p_threshold_kind,
    p_threshold_value,
    p_threshold_unit,
    p_threshold_origin,
    p_threshold_measured_at,
    p_effective_from,
    p_recorded_at,
    v_bands
  )
  on conflict (user_id, id) do nothing
  returning * into v_row;

  if found then
    v_created := true;
  else
    select * into v_row
      from public.activity_zone_configs
     where user_id = v_user
       and id = p_id;

    if not found then
      raise exception 'configuration introuvable après conflit' using errcode = '40001';
    end if;

    if v_row.version is distinct from p_version
       or v_row.discipline is distinct from p_discipline
       or v_row.metric is distinct from p_metric
       or v_row.basis is distinct from p_basis
       or v_row.unit is distinct from p_unit
       or v_row.threshold_kind is distinct from p_threshold_kind
       or v_row.threshold_value is distinct from p_threshold_value
       or v_row.threshold_unit is distinct from p_threshold_unit
       or v_row.threshold_origin is distinct from p_threshold_origin
       or v_row.threshold_measured_at is distinct from p_threshold_measured_at
       or v_row.effective_from is distinct from p_effective_from
       or v_row.recorded_at is distinct from p_recorded_at
       or v_row.bands is distinct from v_bands then
      return jsonb_build_object('ok', false, 'reason', 'payload_mismatch');
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'created', v_created,
    'config', jsonb_build_object(
      'id', v_row.id,
      'version', v_row.version,
      'discipline', v_row.discipline,
      'metric', v_row.metric,
      'basis', v_row.basis,
      'unit', v_row.unit,
      'threshold_kind', v_row.threshold_kind,
      'threshold_value', v_row.threshold_value,
      'threshold_unit', v_row.threshold_unit,
      'threshold_origin', v_row.threshold_origin,
      'threshold_measured_at', v_row.threshold_measured_at,
      'effective_from', v_row.effective_from,
      'recorded_at', v_row.recorded_at,
      'bands', v_row.bands,
      'created_at', v_row.created_at
    )
  );
end;
$$;

revoke all on function public.save_activity_zone_config(
  text, text, text, text, text, text, text, numeric, text, text, timestamptz, timestamptz, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.save_activity_zone_config(
  text, text, text, text, text, text, text, numeric, text, text, timestamptz, timestamptz, timestamptz, jsonb
) to authenticated;

commit;
