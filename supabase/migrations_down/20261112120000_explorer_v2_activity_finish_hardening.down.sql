-- Rollback de 20261112120000_explorer_v2_activity_finish_hardening.
--
-- ROLLBACK DE SÉCURITÉ NON DESTRUCTIF, PAS BYTE-FOR-BYTE.
--
-- Ce down restaure le comportement antérieur des fonctions (une nouvelle fin
-- ne crée plus de lien séance ↔ résumé), mais il NE SUPPRIME PAS le lien
-- durable déjà écrit :
--   • `hike_sessions.activity_session_id`, son index unique et sa FK restent
--     en place, avec toutes les valeurs existantes ;
--   • un re-up après down retrouve donc les liens, sans backfill ni perte ;
--   • les policies `offline_sync_operations_{select,insert}_finish_rpc` sont
--     conservées : les retirer réintroduirait l'incident RLS que le up ferme
--     (sous FORCE RLS, le propriétaire SECURITY DEFINER ne peut plus lire ni
--     écrire la ligne `activity.finish`) ;
--   • la lecture de secours JSON, la validation du résumé (propriétaire ET
--     séance) et l'interdiction d'insérer directement `activity.finish`
--     restent en place ;
--   • les résumés déjà liés restent retrouvés par la RPC : le down lit
--     `hike_sessions.activity_session_id` même s'il n'en crée plus. Un rejeu
--     ne répond donc pas « aucun résumé » alors que le bilan existe.
--
-- Si la policy RPC elle-même est la cause d'un incident (propriétaire
-- `authenticated`, changement d'owner, catalogue incohérent), ce down ne la
-- retire pas : la retirer réintroduirait l'incident RLS initial. Corriger le
-- propriétaire (jamais `authenticated`) ou appliquer un correctif ciblé ; un
-- retrait complet est un geste séparé, manuel et destructif.
--
-- Un retrait complet de la colonne est un geste séparé, manuel et destructif :
-- il n'est pas dans ce fichier. Le proof local teste down → liens conservés →
-- re-up → liens toujours présents, sur une base peuplée.

begin;

-- 1. Le résumé n'a plus de lien direct avec la séance, mais la colonne de
--    lien est conservée : la validation ci-dessous continue de vérifier que le
--    résumé désigne bien cette séance (ou, pour l'historique sans lien, que son
--    départ et son itinéraire correspondent).
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

  -- La colonne de lien est CONSERVÉE par ce down : un résumé lié doit donc
  -- toujours désigner cette séance. Un résumé historique sans lien (créé
  -- pendant la fenêtre de down ou avant la colonne) est accepté si son départ
  -- et son itinéraire correspondent à la séance.
  return exists (
    select 1
      from public.hike_sessions h
      join public.activity_sessions s on s.id = p_session
     where h.id = p_summary::uuid
       and h.user_id = p_user
       and s.user_id = p_user
       and (
         h.activity_session_id = p_session
         or (
           h.activity_session_id is null
           and h.started_at = s.started_at
           and h.route_id is not distinct from s.route_id
         )
       )
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
    -- Un résumé lié avant le down doit rester retrouvable par la RPC
    -- historique : on le relit sans créer ni réécrire de lien.
    select h.id into v_summary_id
      from public.hike_sessions h
     where h.user_id = s.user_id
       and h.activity_session_id = p_session
     limit 1;
    return v_summary_id;
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

-- 3. Fin idempotente : on conserve les verrous, la lecture de secours JSON,
--    la validation du résumé et la lecture de `hike_sessions.
--    activity_session_id` (la colonne est conservée). Une nouvelle fin ne crée
--    plus de lien, mais un résumé déjà lié reste retrouvé après le down.
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
  if p_idempotency_key is null
     or length(p_idempotency_key) < 8
     or length(p_idempotency_key) > 400 then
    raise exception 'clé d''idempotence invalide' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user::text || ':finish:' || p_idempotency_key, 0)
  );

  -- Le lien séance ↔ résumé est conservé par le down : le relire permet de
  -- retrouver un bilan créé avant le retour arrière, même sans ligne de
  -- registre (fin directe). Aucun nouveau lien n'est écrit plus bas.
  select h.id into v_summary
    from public.hike_sessions h
   where h.user_id = v_user
     and h.activity_session_id = p_session
   limit 1;

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
      if v_summary is not null then
        return jsonb_build_object('status', 'duplicate', 'summaryId', v_summary);
      end if;
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
      if v_summary is not null then
        return jsonb_build_object('status', 'duplicate', 'summaryId', v_summary);
      end if;
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
      if v_summary is not null then
        return jsonb_build_object('status', 'duplicate', 'summaryId', v_summary);
      end if;
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

  -- Fin directe rejouée après le down : le résumé lié existe, ne pas le perdre.
  if v_summary is not null then
    return jsonb_build_object(
      'status', 'already_finished',
      'reason', 'session_already_finished',
      'summaryId', v_summary
    );
  end if;

  v_summary := public.finish_activity_session(p_session);

  if v_summary is null then
    -- Course possible avec une autre transaction : relire le lien conservé.
    select h.id into v_summary
      from public.hike_sessions h
     where h.user_id = v_user
       and h.activity_session_id = p_session
     limit 1;

    return jsonb_build_object(
      'status', 'already_finished',
      'reason', 'session_already_finished',
      'summaryId', v_summary
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
        if v_summary is not null then
          return jsonb_build_object('status', 'duplicate', 'summaryId', v_summary);
        end if;
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
        if v_summary is not null then
          return jsonb_build_object('status', 'duplicate', 'summaryId', v_summary);
        end if;
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
        if v_summary is not null then
          return jsonb_build_object('status', 'duplicate', 'summaryId', v_summary);
        end if;
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

    select h.id into v_summary
      from public.hike_sessions h
     where h.user_id = v_user
       and h.activity_session_id = p_session
     limit 1;

    if v_summary is not null then
      return jsonb_build_object(
        'status', 'already_finished',
        'reason', 'session_already_finished',
        'summaryId', v_summary
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

-- Valide les FK restaurées seulement si l'historique le permet. Sans ce bloc,
-- le down laisserait des contraintes NOT VALID alors que l'état antérieur
-- pouvait les avoir validées.
do $$
begin
  if not exists (
    select 1
      from public.activity_sessions s
     where not exists (
       select 1 from public.explorer_sport_map m where m.sport = s.sport
     )
  ) then
    alter table public.activity_sessions
      validate constraint activity_sessions_sport_fkey;
  end if;

  if not exists (
    select 1
      from public.activity_sessions s
     where s.variant_id is not null
       and not exists (
         select 1
           from public.explorer_sport_variants v
          where v.sport = s.sport
            and v.variant_id = s.variant_id
       )
  ) then
    alter table public.activity_sessions
      validate constraint activity_sessions_variant_pair_fkey;
  end if;
end $$;

-- 5. Le lien durable est CONSERVÉ : colonne, index unique, FK et valeurs.
--    Un down destructif perdrait l'association séance ↔ résumé sans pouvoir la
--    reconstruire au re-up. La policy RPC de l'étape 8 du up est également
--    conservée : c'est elle qui empêche le retour de l'incident RLS.
--    Rien n'est supprimé ici ; le rollback est volontairement non destructif.

commit;
