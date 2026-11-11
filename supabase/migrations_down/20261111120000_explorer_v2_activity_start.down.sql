-- Rollback de 20261111120000_explorer_v2_activity_start.
--
-- Retire uniquement les objets ajoutés par la migration. Les séances et les
-- résumés historiques restent intacts ; seules les valeurs des colonnes
-- ajoutées (`client_session_id`, `variant_id`) sont perdues avec elles.
--
-- Le down restaure le contrat de `finish_activity_session` sans variante, mais
-- conserve le durcissement d'authentification (`auth.uid() is null`,
-- `search_path = public, pg_temp`) et la clôture concurrente : ils ne dépendent
-- pas des colonnes retirées et ne doivent pas réintroduire les défauts
-- corrigés. `finish_activity_session_idempotent` n'est pas modifiée par ce
-- down : elle n'utilise aucune colonne retirée et garde son verrou de clé.
--
-- Ordre impératif : restaurer l'ancien `finish_activity_session` avant de
-- retirer `hike_sessions.variant_id`, retirer les dépendances (trigger, FK,
-- index, table de référence) avant les colonnes, et supprimer la fonction
-- `start_activity_session` avant la table qu'elle référence.
--
-- Runbook : désactiver la route/le flag, déployer le code sans l'appel start,
-- sauvegarder `activity_sessions.(client_session_id, variant_id)` et
-- `hike_sessions.variant_id`, puis appliquer ce down. Les valeurs de ces
-- colonnes sont perdues ; les lignes et les résumés eux-mêmes sont conservés.

begin;

-- 1. Restaurer le contrat historique de fin de sortie (sans variante), en
--    gardant le contrôle d'acteur explicite et la clôture concurrente.
create or replace function public.finish_activity_session(p_session uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  s public.activity_sessions;
  v_summary_id uuid;
  v_track jsonb;
begin
  select * into s from public.activity_sessions where id = p_session;
  if not found then
    raise exception 'session introuvable' using errcode = 'P0002';
  end if;
  if v_user is null or s.user_id <> v_user then
    raise exception 'session d''un autre utilisateur' using errcode = '42501';
  end if;
  if s.status = 'finished' then
    return null;
  end if;

  update public.activity_sessions
     set status = 'finished',
         ended_at = coalesce(ended_at, now()),
         updated_at = now()
   where id = p_session
     and status <> 'finished'
  returning * into s;

  if not found then
    return null;
  end if;

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

-- 3. Retirer les invariants de variante et de sport, puis la table de
--    référence. Les fonctions qui la référencent sont retirées avant elle.
alter table public.activity_sessions
  drop constraint if exists activity_sessions_variant_pair_fkey;

alter table public.activity_sessions
  drop constraint if exists activity_sessions_sport_fkey;

drop index if exists public.activity_sessions_sport_variant_idx;

-- Compatibilité avec un état antérieur de la migration (CHECK de format seul).
alter table public.activity_sessions
  drop constraint if exists activity_sessions_variant_id_check;

drop function if exists public.start_activity_session(uuid, text, text, bigint);

-- Pas de CASCADE : une dépendance inattendue doit bloquer le rollback plutôt
-- que d'être supprimée silencieusement.
drop table if exists public.explorer_sport_variants;

-- 4. Retirer la variante de l'historique après restauration de finish.
alter table public.hike_sessions
  drop constraint if exists hike_sessions_variant_id_check;

alter table public.hike_sessions
  drop column if exists variant_id;

-- 5. Retirer les colonnes d'idempotence.
drop index if exists public.activity_sessions_user_client_idx;

alter table public.activity_sessions
  drop column if exists client_session_id;

alter table public.activity_sessions
  drop column if exists variant_id;

commit;
