-- Rollback de 20261111120000_explorer_v2_activity_start.
--
-- Retire uniquement les objets ajoutés par la migration. Les séances et les
-- résumés historiques restent intacts ; seules les valeurs des colonnes
-- ajoutées (`client_session_id`, `variant_id`) sont perdues avec elles.
--
-- Ordre impératif : restaurer l'ancien `finish_activity_session` avant de
-- retirer `hike_sessions.variant_id`, puis retirer les dépendances (trigger,
-- FK, table de référence) avant les colonnes.
--
-- Runbook : désactiver la route/le flag, déployer le code sans l'appel start,
-- sauvegarder `activity_sessions.(client_session_id, variant_id)` et
-- `hike_sessions.variant_id`, puis appliquer ce down. Les valeurs de ces
-- colonnes sont perdues ; les lignes et les résumés eux-mêmes sont conservés.

begin;

-- 1. Restaurer le contrat historique de fin de sortie (sans variante).
create or replace function public.finish_activity_session(p_session uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.activity_sessions;
  v_summary_id uuid;
  v_track jsonb;
begin
  select * into s from public.activity_sessions where id = p_session;
  if not found then
    raise exception 'session introuvable' using errcode = 'P0002';
  end if;
  if s.user_id <> auth.uid() then
    raise exception 'session d''un autre utilisateur' using errcode = '42501';
  end if;
  if s.status = 'finished' then
    return null;
  end if;

  update public.activity_sessions
     set status = 'finished',
         ended_at = coalesce(ended_at, now()),
         updated_at = now()
   where id = p_session;

  select jsonb_build_object(
    'type', 'LineString',
    'coordinates', coalesce(
      jsonb_agg(jsonb_build_array(lng, lat) order by t),
      '[]'::jsonb
    )
  )
  into v_track
  from public.activity_points
  where session_id = p_session;

  insert into public.hike_sessions (
    user_id, route_id, started_at, ended_at, distance_km, duration_seconds,
    elevation_gain_m, positions_geojson, processing_status, visibility, title
  ) values (
    s.user_id,
    s.route_id,
    s.started_at,
    coalesce(s.ended_at, now()),
    round((s.distance_m::numeric / 1000.0), 2),
    greatest(s.moving_s, extract(epoch from (coalesce(s.ended_at, now()) - s.started_at))::int),
    s.elev_gain_m,
    case when jsonb_array_length(coalesce(v_track->'coordinates', '[]'::jsonb)) > 1 then v_track else null end,
    'pending',
    'private',
    null
  )
  returning id into v_summary_id;

  return v_summary_id;
end;
$$;

revoke all on function public.finish_activity_session(uuid) from public;
grant execute on function public.finish_activity_session(uuid) to authenticated;

-- 2. Retirer la garde d'identité et son trigger.
drop trigger if exists activity_sessions_start_identity_guard on public.activity_sessions;
drop function if exists public.guard_activity_session_start_identity();

-- 3. Retirer les invariants de variante, puis la table de référence.
alter table public.activity_sessions
  drop constraint if exists activity_sessions_variant_pair_fkey;

-- Compatibilité avec un état antérieur de la migration (CHECK de format seul).
alter table public.activity_sessions
  drop constraint if exists activity_sessions_variant_id_check;

drop table if exists public.explorer_sport_variants;

-- 4. Retirer la variante de l'historique après restauration de finish.
alter table public.hike_sessions
  drop constraint if exists hike_sessions_variant_id_check;

alter table public.hike_sessions
  drop column if exists variant_id;

-- 5. Retirer le démarrage idempotent et ses colonnes.
drop function if exists public.start_activity_session(uuid, text, text, bigint);

drop index if exists public.activity_sessions_user_client_idx;

alter table public.activity_sessions
  drop column if exists client_session_id;

alter table public.activity_sessions
  drop column if exists variant_id;

commit;
