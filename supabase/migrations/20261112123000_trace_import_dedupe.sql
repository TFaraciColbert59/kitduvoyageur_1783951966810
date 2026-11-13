-- ==============================================================================
-- A03 / K6.02 / S1.15 — persistance et déduplication des imports FIT/TCX/GPX
--
-- Constat fermé : la route historique dédupliquait un import sur
-- `(user_id, started_at)`. Deux fichiers différents démarrant à la même seconde
-- étaient donc confondus, et deux imports identiques n'étaient reconnus que
-- parce que leur heure de départ coïncidait.
--
-- Cette migration additive :
--   • crée `public.trace_imports`, registre privé de provenance : une ligne par
--     couple (propriétaire, empreinte SHA-256 du contenu original) ;
--   • lie chaque ligne à la sortie dérivée `hike_sessions.id` (suppression en
--     cascade avec la sortie ou le compte) ;
--   • ajoute `record_trace_import(...)`, RPC transactionnelle qui réserve la
--     clé de déduplication, crée la sortie privée et écrit le registre dans la
--     même transaction. Un rejeu du même contenu retourne la sortie existante
--     sans réécriture ; deux contenus différents créent deux sorties même si
--     leurs départs sont identiques.
--
-- Aucune colonne, policy ou donnée de `public.hike_sessions` n'est modifiée.
-- Aucune donnée originale n'est conservée : le fichier reste sur l'appareil.
-- Aucune requête réseau n'est faite par cette migration.
--
-- Préfixe volontairement distinct de 20261112120000/121000/122000, utilisés
-- par les branches Explorer et Carnet en parallèle. Voir
-- `docs/import/A03-S1.15-persistance.md` pour les points de synchronisation.
-- ==============================================================================

begin;

-- ── 1. Registre privé de provenance ─────────────────────────────────────────
create table if not exists public.trace_imports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.hike_sessions (id) on delete cascade,
  source text not null,
  source_fingerprint text not null,
  source_file_name text,
  source_byte_length integer,
  correlation_id uuid,
  imported_at timestamptz not null default now(),
  constraint trace_imports_source_check
    check (source in ('fit', 'tcx', 'gpx')),
  -- Format produit par `src/features/hiking/import/fingerprint.ts`. Le préfixe
  -- rend explicite l'algorithme ; aucune valeur libre n'est acceptée.
  constraint trace_imports_fingerprint_check
    check (source_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  constraint trace_imports_file_name_check
    check (source_file_name is null or char_length(source_file_name) between 1 and 255),
  -- Même plafond que `TRACE_IMPORT_LIMITS.maxBytes` (16 Mio).
  constraint trace_imports_byte_length_check
    check (source_byte_length is null or source_byte_length between 1 and 16777216),
  constraint trace_imports_owner_fingerprint_key
    unique (owner_id, source_fingerprint),
  constraint trace_imports_session_key
    unique (session_id)
);

comment on table public.trace_imports is
  'A03/S1.15 — provenance privée d''un import FIT/TCX/GPX. Une ligne par '
  'couple (propriétaire, empreinte SHA-256) ; la trace dérivée reste dans '
  'hike_sessions. Aucun contenu original, aucune lecture publique.';
comment on column public.trace_imports.owner_id is
  'Propriétaire de l''import ; toujours la session authentifiée, jamais un '
  'identifiant fourni par le client.';
comment on column public.trace_imports.session_id is
  'Sortie dérivée privée (hike_sessions.id). Suppression en cascade avec la '
  'sortie ou le compte.';
comment on column public.trace_imports.source is
  'Format source réellement détecté : fit, tcx ou gpx.';
comment on column public.trace_imports.source_fingerprint is
  'SHA-256 du contenu original préfixé sha256:. Identifiant pseudonyme de '
  'déduplication ; il ne prouve pas l''auteur du fichier.';
comment on column public.trace_imports.source_file_name is
  'Nom de fichier d''origine, borné et assaini. Peut contenir des données '
  'personnelles : jamais journalisé, jamais exposé hors du propriétaire.';
comment on column public.trace_imports.source_byte_length is
  'Taille du fichier original, bornée à 16 Mio. Le contenu n''est pas conservé.';
comment on column public.trace_imports.correlation_id is
  'Identifiant technique de corrélation de la requête d''import.';
comment on column public.trace_imports.imported_at is
  'Date du premier import de cette empreinte par ce propriétaire.';

create index if not exists idx_trace_imports_owner_imported
  on public.trace_imports (owner_id, imported_at desc);
create index if not exists idx_trace_imports_correlation
  on public.trace_imports (correlation_id)
  where correlation_id is not null;

-- ── 2. RLS : lecture propriétaire, écriture par la RPC uniquement ───────────
alter table public.trace_imports enable row level security;

drop policy if exists trace_imports_select_owner on public.trace_imports;
create policy trace_imports_select_owner on public.trace_imports
  for select to authenticated
  using (owner_id = (select auth.uid()));

comment on policy trace_imports_select_owner on public.trace_imports is
  'Provenance lisible par son seul propriétaire. Aucune policy INSERT/UPDATE/'
  'DELETE : `record_trace_import` est la seule porte d''écriture.';

-- Aucun accès anonyme. `authenticated` ne reçoit que le SELECT (RLS ci-dessus) ;
-- `service_role` garde l'accès complet pour l'export et les opérations admin.
revoke all on table public.trace_imports from public, anon, authenticated;
grant select on table public.trace_imports to authenticated;
grant all on table public.trace_imports to service_role;

-- ── 3. RPC atomique : réserver, créer la sortie, écrire le registre ─────────
drop function if exists public.record_trace_import(
  timestamptz, timestamptz, numeric, integer, numeric, integer, jsonb, jsonb,
  jsonb, text, text, text, text, text, integer, uuid
);

create or replace function public.record_trace_import(
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
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_user uuid := auth.uid();
  v_source text;
  v_fingerprint text;
  v_file_name text;
  v_title text;
  v_notes text;
  v_session_id uuid;
  v_import_id uuid;
  v_existing_session uuid;
  v_existing_carnet uuid;
begin
  if v_user is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;

  v_source := lower(btrim(coalesce(p_source, '')));
  v_fingerprint := lower(btrim(coalesce(p_source_fingerprint, '')));

  if v_source not in ('fit', 'tcx', 'gpx') then
    raise exception 'source de trace non prise en charge' using errcode = '22023';
  end if;
  if v_fingerprint !~ '^sha256:[0-9a-f]{64}$' then
    raise exception 'empreinte de trace invalide' using errcode = '22023';
  end if;
  if p_started_at is null or p_ended_at is null or p_ended_at <= p_started_at then
    raise exception 'bornes de sortie invalides' using errcode = '22023';
  end if;
  if p_distance_km is null or p_distance_km < 0 or p_distance_km > 100000 then
    raise exception 'distance invalide' using errcode = '22023';
  end if;
  if p_duration_seconds is null
     or p_duration_seconds < 1
     or p_duration_seconds > 31536000 then
    raise exception 'durée invalide' using errcode = '22023';
  end if;
  if p_elevation_gain_m is not null
     and (p_elevation_gain_m < 0 or p_elevation_gain_m > 30000) then
    raise exception 'dénivelé invalide' using errcode = '22023';
  end if;
  if p_max_altitude_m is not null
     and (p_max_altitude_m < -500 or p_max_altitude_m > 9000) then
    raise exception 'altitude invalide' using errcode = '22023';
  end if;
  if p_source_byte_length is not null
     and (p_source_byte_length < 1 or p_source_byte_length > 16777216) then
    raise exception 'taille de fichier invalide' using errcode = '22023';
  end if;

  -- Bornes de forme avant stockage. La validation métrique complète est faite
  -- par le parseur et la route ; la RPC reste appelable directement par un
  -- propriétaire authentifié, donc elle ne fait jamais confiance au client.
  if p_positions_geojson is not null then
    if jsonb_typeof(p_positions_geojson) is distinct from 'object' then
      raise exception 'géométrie invalide' using errcode = '22023';
    end if;
    if p_positions_geojson ->> 'type' is distinct from 'LineString' then
      raise exception 'géométrie invalide' using errcode = '22023';
    end if;
    if jsonb_typeof(p_positions_geojson -> 'coordinates') is distinct from 'array' then
      raise exception 'géométrie invalide' using errcode = '22023';
    end if;
    if jsonb_array_length(p_positions_geojson -> 'coordinates') > 15000 then
      raise exception 'trop de points géolocalisés' using errcode = '22023';
    end if;
    if exists (
      select 1
        from jsonb_array_elements(p_positions_geojson -> 'coordinates') as c(coord)
       where jsonb_typeof(coord) is distinct from 'array'
    ) then
      raise exception 'coordonnées invalides' using errcode = '22023';
    end if;
    if exists (
      select 1
        from jsonb_array_elements(p_positions_geojson -> 'coordinates') as c(coord)
       where jsonb_array_length(coord) not between 2 and 3
          or jsonb_typeof(coord -> 0) is distinct from 'number'
          or jsonb_typeof(coord -> 1) is distinct from 'number'
    ) then
      raise exception 'coordonnées invalides' using errcode = '22023';
    end if;
    if exists (
      select 1
        from jsonb_array_elements(p_positions_geojson -> 'coordinates') as c(coord)
       where (coord ->> 0)::numeric not between -180 and 180
          or (coord ->> 1)::numeric not between -90 and 90
    ) then
      raise exception 'coordonnées hors bornes' using errcode = '22023';
    end if;
  end if;

  if p_positions_timed is not null then
    if jsonb_typeof(p_positions_timed) is distinct from 'array' then
      raise exception 'échantillons horodatés invalides' using errcode = '22023';
    end if;
    if jsonb_array_length(p_positions_timed) > 15000 then
      raise exception 'trop d''échantillons horodatés' using errcode = '22023';
    end if;
    if exists (
      select 1
        from jsonb_array_elements(p_positions_timed) as e(sample)
       where jsonb_typeof(sample) is distinct from 'object'
    ) then
      raise exception 'échantillons horodatés invalides' using errcode = '22023';
    end if;
    if exists (
      select 1
        from jsonb_array_elements(p_positions_timed) as e(sample)
       where jsonb_typeof(sample -> 'lat') is distinct from 'number'
          or jsonb_typeof(sample -> 'lng') is distinct from 'number'
          or jsonb_typeof(sample -> 'timestamp') is distinct from 'string'
          or length(sample ->> 'timestamp') = 0
    ) then
      raise exception 'échantillons horodatés invalides' using errcode = '22023';
    end if;
    if exists (
      select 1
        from jsonb_array_elements(p_positions_timed) as e(sample)
       where (sample ->> 'lat')::numeric not between -90 and 90
          or (sample ->> 'lng')::numeric not between -180 and 180
    ) then
      raise exception 'échantillons horodatés hors bornes' using errcode = '22023';
    end if;
  end if;

  if p_poi_events is not null then
    if jsonb_typeof(p_poi_events) is distinct from 'array' then
      raise exception 'points d''intérêt invalides' using errcode = '22023';
    end if;
    if jsonb_array_length(p_poi_events) > 1000 then
      raise exception 'trop de points d''intérêt' using errcode = '22023';
    end if;
  end if;

  -- Nettoyage borné. Le titre et le nom de fichier ne doivent jamais devenir
  -- du balisage ; le nom de fichier est réduit à son dernier segment.
  v_title := nullif(btrim(left(
    regexp_replace(coalesce(p_title, ''), '[[:cntrl:]<>]', '', 'g'),
    120
  )), '');
  v_notes := nullif(btrim(left(
    regexp_replace(coalesce(p_notes, ''), '[[:cntrl:]<>]', '', 'g'),
    2000
  )), '');
  v_file_name := regexp_replace(
    coalesce(p_source_file_name, ''),
    '[[:cntrl:]<>]',
    '',
    'g'
  );
  v_file_name := replace(v_file_name, chr(92), '/');
  v_file_name := regexp_replace(v_file_name, '^.*/', '');
  v_file_name := nullif(btrim(left(v_file_name, 255)), '');
  if v_file_name in ('.', '..') then
    v_file_name := null;
  end if;

  -- Sérialise les appels concurrents sur le même couple propriétaire +
  -- empreinte. L'index unique reste le garde-fou final ; ce verrou évite de
  -- dépendre du niveau d'isolation pour retrouver la ligne gagnante.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user::text || ':' || v_fingerprint, 0)
  );

  select ti.session_id
    into v_existing_session
    from public.trace_imports ti
   where ti.owner_id = v_user
     and ti.source_fingerprint = v_fingerprint;

  if v_existing_session is not null then
    select hs.carnet_id
      into v_existing_carnet
      from public.hike_sessions hs
     where hs.id = v_existing_session
       and hs.user_id = v_user;

    if found then
      return jsonb_build_object(
        'session_id', v_existing_session,
        'carnet_id', v_existing_carnet,
        'existing', true
      );
    end if;

    -- Ligne orpheline théoriquement impossible (FK ON DELETE CASCADE). On la
    -- retire pour ne pas bloquer une réimportation légitime du même contenu.
    delete from public.trace_imports
     where owner_id = v_user
       and source_fingerprint = v_fingerprint;
  end if;

  insert into public.hike_sessions (
    user_id,
    carnet_id,
    started_at,
    ended_at,
    distance_km,
    duration_seconds,
    elevation_gain_m,
    max_altitude_m,
    positions_geojson,
    positions_timed,
    poi_events,
    title,
    notes,
    visibility,
    correlation_id
  )
  values (
    v_user,
    null,
    p_started_at,
    p_ended_at,
    p_distance_km,
    p_duration_seconds,
    p_elevation_gain_m,
    p_max_altitude_m,
    p_positions_geojson,
    p_positions_timed,
    coalesce(p_poi_events, '[]'::jsonb),
    coalesce(v_title, 'Sortie importée'),
    v_notes,
    'private',
    p_correlation_id
  )
  returning id into v_session_id;

  insert into public.trace_imports (
    owner_id,
    session_id,
    source,
    source_fingerprint,
    source_file_name,
    source_byte_length,
    correlation_id
  )
  values (
    v_user,
    v_session_id,
    v_source,
    v_fingerprint,
    v_file_name,
    p_source_byte_length,
    p_correlation_id
  )
  returning id into v_import_id;

  return jsonb_build_object(
    'session_id', v_session_id,
    'carnet_id', null::uuid,
    'import_id', v_import_id,
    'existing', false
  );
end;
$fn$;

comment on function public.record_trace_import(
  timestamptz, timestamptz, numeric, integer, numeric, integer, jsonb, jsonb,
  jsonb, text, text, text, text, text, integer, uuid
) is
  'A03/S1.15 — enregistre un import de trace de façon atomique : réserve '
  '(propriétaire, empreinte SHA-256), crée une sortie hike_sessions privée '
  'sans carnet, puis écrit la provenance dans trace_imports. Un rejeu du même '
  'contenu retourne la sortie existante. SECURITY DEFINER, propriétaire issu '
  'de auth.uid(), aucun paramètre propriétaire.';

revoke all on function public.record_trace_import(
  timestamptz, timestamptz, numeric, integer, numeric, integer, jsonb, jsonb,
  jsonb, text, text, text, text, text, integer, uuid
) from public, anon, authenticated;

grant execute on function public.record_trace_import(
  timestamptz, timestamptz, numeric, integer, numeric, integer, jsonb, jsonb,
  jsonb, text, text, text, text, text, integer, uuid
) to authenticated;

commit;
