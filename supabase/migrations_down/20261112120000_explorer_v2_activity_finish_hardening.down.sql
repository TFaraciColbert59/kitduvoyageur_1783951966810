-- Rollback de 20261112120000_explorer_v2_activity_finish_hardening.
--
-- ROLLBACK DE SÉCURITÉ, PAS BYTE-FOR-BYTE.
--
-- Retire le lien durable `hike_sessions.activity_session_id` (colonne, index,
-- FK), mais conserve les correctifs qui ne dépendent pas de cette colonne :
--   • la lecture de secours des lignes de registre historiques
--     (`activity_session_id` NULL, `result.sessionId`) et son index ;
--   • la validation du résumé (`activity_finish_summary_owned`), sans le
--     contrôle de séance qui nécessite la colonne retirée ;
--   • l'interdiction d'insérer directement `activity.finish` dans le registre.
--
-- Ainsi un rollback ne réintroduit ni le `duplicate` avec un résumé nul, ni la
-- confiance aveugle dans un `summaryId` fourni par le client. Les données
-- historiques ne sont ni supprimées ni réécrites : seule la colonne ajoutée
-- par cette migration disparaît.
--
-- Ordre impératif : restaurer les fonctions avant de retirer la colonne
-- qu'elles référencent, puis supprimer les index et la contrainte.

begin;

-- 1. Le résumé n'a plus de lien direct avec la séance. La fonction ne lit que
--    `hike_sessions.id` et `hike_sessions.user_id`, qui restent disponibles.
create or replace function public.activity_finish_summary_owned(
  p_user uuid,
  p_session uuid,
  p_summary text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user is null or p_session is null or p_summary is null then
    return false;
  end if;
  if p_summary !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  return exists (
    select 1
      from public.hike_sessions h
     where h.id = p_summary::uuid
       and h.user_id = p_user
  );
end;
$$;

revoke all on function public.activity_finish_summary_owned(uuid, uuid, text) from public;

-- 2. Restaurer la fin de séance sans `activity_session_id`, en gardant le
--    contrôle d'acteur et la clôture concurrente.
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
    user_id, route_id, variant_id, started_at, ended_at, distance_km, duration_seconds,
    elevation_gain_m, positions_geojson, processing_status, visibility, title
  ) values (
    s.user_id,
    s.route_id,
    case
      when s.variant_id ~ '^[a-z0-9][a-z0-9-]{0,63}$' then s.variant_id
      else null
    end,
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

-- 3. Fin idempotente : on conserve les verrous, la lecture de secours JSON et
--    la validation du résumé. Seule la lecture par `hike_sessions.
--    activity_session_id` disparaît avec la colonne.
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
  v_summary_text text;
begin
  if v_user is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;
  if p_session is null then
    raise exception 'séance invalide' using errcode = '22023';
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

    v_summary_text := v_existing.result ->> 'summaryId';

    if v_summary_text is null then
      return jsonb_build_object(
        'status', 'already_finished',
        'reason', 'session_already_finished',
        'summaryId', null
      );
    end if;

    if not public.activity_finish_summary_owned(v_user, p_session, v_summary_text) then
      return jsonb_build_object(
        'status', 'conflict',
        'reason', 'summary_not_owned',
        'summaryId', null
      );
    end if;

    return jsonb_build_object(
      'status', 'duplicate',
      'summaryId', v_summary_text
    );
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user::text || ':finish-session:' || p_session::text, 0)
  );

  select * into v_existing
    from public.offline_sync_operations
   where user_id = v_user
     and activity_session_id = p_session
     and kind = 'activity.finish'
     and status = 'applied';

  if found then
    v_summary_text := v_existing.result ->> 'summaryId';

    if v_summary_text is null then
      return jsonb_build_object(
        'status', 'already_finished',
        'reason', 'session_already_finished',
        'summaryId', null
      );
    end if;

    if not public.activity_finish_summary_owned(v_user, p_session, v_summary_text) then
      return jsonb_build_object(
        'status', 'conflict',
        'reason', 'summary_not_owned',
        'summaryId', null
      );
    end if;

    return jsonb_build_object(
      'status', 'duplicate',
      'summaryId', v_summary_text
    );
  end if;

  -- Lignes antérieures à `activity_session_id` : la séance est dans le JSON.
  select * into v_existing
    from public.offline_sync_operations
   where user_id = v_user
     and kind = 'activity.finish'
     and status = 'applied'
     and activity_session_id is null
     and (result ->> 'sessionId') = p_session::text
   order by ((result ->> 'summaryId') is not null) desc,
            applied_at desc,
            idempotency_key
   limit 1;

  if found then
    v_summary_text := v_existing.result ->> 'summaryId';

    if v_summary_text is null then
      return jsonb_build_object(
        'status', 'already_finished',
        'reason', 'session_already_finished',
        'summaryId', null
      );
    end if;

    if not public.activity_finish_summary_owned(v_user, p_session, v_summary_text) then
      return jsonb_build_object(
        'status', 'conflict',
        'reason', 'summary_not_owned',
        'summaryId', null
      );
    end if;

    return jsonb_build_object(
      'status', 'duplicate',
      'summaryId', v_summary_text
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

  insert into public.offline_sync_operations (user_id, idempotency_key, store, kind, status, result, activity_session_id)
  values (
    v_user,
    p_idempotency_key,
    'explorer',
    'activity.finish',
    'applied',
    jsonb_build_object('summaryId', v_summary, 'sessionId', p_session),
    p_session
  )
  on conflict do nothing;

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

      v_summary_text := v_existing.result ->> 'summaryId';

      if v_summary_text is null then
        return jsonb_build_object(
          'status', 'already_finished',
          'reason', 'session_already_finished',
          'summaryId', null
        );
      end if;

      if not public.activity_finish_summary_owned(v_user, p_session, v_summary_text) then
        return jsonb_build_object(
          'status', 'conflict',
          'reason', 'summary_not_owned',
          'summaryId', null
        );
      end if;

      return jsonb_build_object(
        'status', 'duplicate',
        'summaryId', v_summary_text
      );
    end if;

    select * into v_existing
      from public.offline_sync_operations
     where user_id = v_user
       and activity_session_id = p_session
       and kind = 'activity.finish'
       and status = 'applied';

    if found then
      v_summary_text := v_existing.result ->> 'summaryId';

      if v_summary_text is null then
        return jsonb_build_object(
          'status', 'already_finished',
          'reason', 'session_already_finished',
          'summaryId', null
        );
      end if;

      if not public.activity_finish_summary_owned(v_user, p_session, v_summary_text) then
        return jsonb_build_object(
          'status', 'conflict',
          'reason', 'summary_not_owned',
          'summaryId', null
        );
      end if;

      return jsonb_build_object(
        'status', 'duplicate',
        'summaryId', v_summary_text
      );
    end if;

    select * into v_existing
      from public.offline_sync_operations
     where user_id = v_user
       and kind = 'activity.finish'
       and status = 'applied'
       and activity_session_id is null
       and (result ->> 'sessionId') = p_session::text
     order by ((result ->> 'summaryId') is not null) desc,
              applied_at desc,
              idempotency_key
     limit 1;

    if found then
      v_summary_text := v_existing.result ->> 'summaryId';

      if v_summary_text is null then
        return jsonb_build_object(
          'status', 'already_finished',
          'reason', 'session_already_finished',
          'summaryId', null
        );
      end if;

      if not public.activity_finish_summary_owned(v_user, p_session, v_summary_text) then
        return jsonb_build_object(
          'status', 'conflict',
          'reason', 'summary_not_owned',
          'summaryId', null
        );
      end if;

      return jsonb_build_object(
        'status', 'duplicate',
        'summaryId', v_summary_text
      );
    end if;

    raise exception 'fin de séance concurrente introuvable' using errcode = '40001';
  end if;

  return jsonb_build_object('status', 'applied', 'summaryId', v_summary);
end;
$$;

revoke all on function public.finish_activity_session_idempotent(uuid, text) from public;
grant execute on function public.finish_activity_session_idempotent(uuid, text) to authenticated;

-- 4. Retirer le garde de compatibilité et restaurer les FK de la migration
--    précédente. Le rollback complet réintroduit donc la limite historique
--    connue (une FK est réévaluée sur tout UPDATE) ; c'est le prix du retour
--    à l'état antérieur.
drop trigger if exists activity_sessions_sport_pair_guard on public.activity_sessions;
drop function if exists public.guard_activity_session_sport_pair();

alter table public.activity_sessions
  drop constraint if exists activity_sessions_variant_pair_fkey;
alter table public.activity_sessions
  add constraint activity_sessions_variant_pair_fkey
  foreign key (sport, variant_id)
  references public.explorer_sport_variants (sport, variant_id)
  on delete restrict
  not valid;

alter table public.activity_sessions
  drop constraint if exists activity_sessions_sport_fkey;
alter table public.activity_sessions
  add constraint activity_sessions_sport_fkey
  foreign key (sport)
  references public.explorer_sport_map (sport)
  on delete restrict
  not valid;

-- 5. Retirer le lien durable, dans l'ordre des dépendances. La politique
--    d'insertion du registre et l'index de secours sont conservés : ils ne
--    dépendent pas de la colonne retirée.
drop index if exists public.hike_sessions_activity_session_idx;

alter table public.hike_sessions
  drop constraint if exists hike_sessions_activity_session_fkey;

alter table public.hike_sessions
  drop column if exists activity_session_id;

commit;
