-- Rollback de 20261111120000_explorer_v2_activity_start.
--
-- ROLLBACK DE SÉCURITÉ, PAS BYTE-FOR-BYTE.
--
-- Retire les objets ajoutés par la migration (colonnes, table de référence,
-- index, FK, trigger, RPC de démarrage) et restaure le contrat de
-- `finish_activity_session` sans variante. Les séances et les résumés
-- historiques restent intacts ; seules les valeurs des colonnes ajoutées
-- (`client_session_id`, `variant_id`, `activity_session_id`) sont perdues avec
-- elles.
--
-- Écarts volontaires avec l'état antérieur, pour ne pas réintroduire les
-- défauts corrigés :
--   1. `finish_activity_session` garde `auth.uid() is null`, le
--      `search_path = public, pg_temp` et la clôture concurrente
--      (`status <> 'finished'`) ; il ne copie plus `variant_id`, colonne
--      retirée ;
--   2. `finish_activity_session_idempotent` garde le verrou de clé, le verrou
--      de séance, la liaison de la clé à `result.sessionId` et le statut
--      `already_finished`. Il ne référence pas `activity_session_id`, qui est
--      retirée : la relecture par séance passe par `result ->> 'sessionId'`.
--
-- Pour un retour strict à l'état antérieur, réappliquer les corps de
-- `20261101_explorer_v2_data.sql` (finish) et
-- `20261107_explorer_v2_offline_activity.sql` (idempotent), en assumant la
-- réintroduction de leurs défauts. Les états intermédiaires 0a81228/1a5f3bd ne
-- sont pas des cibles de rollback : le CHECK de format qu'ils portaient est
-- retiré avec la colonne qu'il protégeait.
--
-- Ordre impératif : restaurer l'ancien `finish_activity_session` et la fin
-- idempotente avant de retirer `hike_sessions.variant_id` et
-- `offline_sync_operations.activity_session_id`, retirer les dépendances
-- (trigger, FK, index, table de référence) avant les colonnes, et supprimer la
-- fonction `start_activity_session` avant la table qu'elle référence.
--
-- Runbook : désactiver la route/le flag, déployer le code sans l'appel start,
-- sauvegarder `activity_sessions.(client_session_id, variant_id)`,
-- `hike_sessions.variant_id` et `offline_sync_operations.activity_session_id`,
-- puis appliquer ce down. Les valeurs de ces colonnes sont perdues ; les
-- lignes et les résumés eux-mêmes sont conservés.

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

-- 1 bis. Fin idempotente : version de sécurité conservée après rollback. Elle
--        ne référence aucune colonne retirée ; la séance est relue dans le
--        JSON `result.sessionId` du registre. Le contrat de réponse reste
--        identique à celui de la version up (`applied`, `duplicate`,
--        `already_finished`, `conflict`).
create or replace function public.finish_activity_session_idempotent(
  p_session uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_existing public.offline_sync_operations%rowtype;
  v_summary uuid;
begin
  if v_user is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'clé d''idempotence invalide' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user::text || ':finish:' || p_idempotency_key, 0)
  );

  select * into v_existing
    from public.offline_sync_operations
   where user_id = v_user and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.kind is distinct from 'activity.finish'
       or v_existing.status is distinct from 'applied'
       or (v_existing.result ->> 'sessionId') is distinct from p_session::text then
      return jsonb_build_object(
        'status', 'conflict',
        'reason', 'idempotency_key_reused',
        'summaryId', null
      );
    end if;

    if (v_existing.result ->> 'summaryId') is null then
      return jsonb_build_object(
        'status', 'already_finished',
        'reason', 'session_already_finished',
        'summaryId', null
      );
    end if;

    return jsonb_build_object(
      'status', 'duplicate',
      'summaryId', v_existing.result ->> 'summaryId'
    );
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user::text || ':finish-session:' || p_session::text, 0)
  );

  select * into v_existing
    from public.offline_sync_operations
   where user_id = v_user
     and kind = 'activity.finish'
     and status = 'applied'
     and (result ->> 'sessionId') = p_session::text;

  if found then
    if (v_existing.result ->> 'summaryId') is null then
      return jsonb_build_object(
        'status', 'already_finished',
        'reason', 'session_already_finished',
        'summaryId', null
      );
    end if;

    return jsonb_build_object(
      'status', 'duplicate',
      'summaryId', v_existing.result ->> 'summaryId'
    );
  end if;

  v_summary := public.finish_activity_session(p_session);

  if v_summary is null then
    return jsonb_build_object(
      'status', 'already_finished',
      'reason', 'session_already_finished',
      'summaryId', null
    );
  end if;

  insert into public.offline_sync_operations (user_id, idempotency_key, store, kind, status, result)
  values (
    v_user,
    p_idempotency_key,
    'explorer',
    'activity.finish',
    'applied',
    jsonb_build_object('summaryId', v_summary, 'sessionId', p_session)
  )
  on conflict (user_id, idempotency_key) do nothing;

  if not found then
    select * into v_existing
      from public.offline_sync_operations
     where user_id = v_user and idempotency_key = p_idempotency_key;

    if found then
      if v_existing.kind is distinct from 'activity.finish'
         or v_existing.status is distinct from 'applied'
         or (v_existing.result ->> 'sessionId') is distinct from p_session::text then
        return jsonb_build_object(
          'status', 'conflict',
          'reason', 'idempotency_key_reused',
          'summaryId', null
        );
      end if;

      if (v_existing.result ->> 'summaryId') is null then
        return jsonb_build_object(
          'status', 'already_finished',
          'reason', 'session_already_finished',
          'summaryId', null
        );
      end if;

      return jsonb_build_object(
        'status', 'duplicate',
        'summaryId', v_existing.result ->> 'summaryId'
      );
    end if;

    select * into v_existing
      from public.offline_sync_operations
     where user_id = v_user
       and kind = 'activity.finish'
       and status = 'applied'
       and (result ->> 'sessionId') = p_session::text;

    if found then
      if (v_existing.result ->> 'summaryId') is null then
        return jsonb_build_object(
          'status', 'already_finished',
          'reason', 'session_already_finished',
          'summaryId', null
        );
      end if;

      return jsonb_build_object(
        'status', 'duplicate',
        'summaryId', v_existing.result ->> 'summaryId'
      );
    end if;

    raise exception 'fin de séance concurrente introuvable' using errcode = '40001';
  end if;

  return jsonb_build_object('status', 'applied', 'summaryId', v_summary);
end;
$$;

revoke all on function public.finish_activity_session_idempotent(uuid, text) from public;
grant execute on function public.finish_activity_session_idempotent(uuid, text) to authenticated;

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

-- 6. Retirer la liaison du registre de fin à la séance. La fonction restaurée
--    ci-dessus relit `result.sessionId`, elle ne dépend donc plus de ces objets.
drop index if exists public.offline_sync_activity_finish_session_idx;

alter table public.offline_sync_operations
  drop column if exists activity_session_id;

commit;
