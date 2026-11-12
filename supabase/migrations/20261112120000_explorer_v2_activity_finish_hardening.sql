-- Explorer v2 — durcissement de la fin de séance (suite de 20261111120000).
--
-- Corrige les constats de la revue sans réécrire la migration précédente :
--   • une ligne de registre historique (`activity_session_id` NULL) reste
--     retrouvée par une autre clé grâce à `result.sessionId`, avec un index
--     d'expression dédié ;
--   • `hike_sessions.activity_session_id` lie durablement le résumé à sa
--     séance : une fin directe (RPC sans clé) peut être retrouvée ensuite ;
--   • le registre n'accepte plus d'insert `activity.finish` direct par un
--     client authentifié ; la RPC vérifie en plus que le résumé appartient
--     bien à l'utilisateur et à la séance ;
--   • aucune donnée historique n'est supprimée ni réécrite : pas de backfill
--     des lignes existantes, seulement une lecture de secours.
--
-- Migration additive et idempotente. Si 20261111120000 a été appliquée dans
-- une version antérieure, les colonnes dont ce fichier dépend sont recréées
-- ici (`add column if not exists`). Les index uniques ne sont pas
-- `CONCURRENTLY` : prévoir une fenêtre de maintenance sur une table
-- volumineuse. Le down est un rollback de sécurité documenté.
--
-- Aucun accès distant n'est effectué par cette migration.

begin;

-- 0. Filet de compatibilité avec une version antérieure de 20261111120000.
--    Ces colonnes sont normalement déjà présentes ; `if not exists` ne touche
--    pas les valeurs existantes.
alter table public.activity_sessions
  add column if not exists variant_id text;

alter table public.hike_sessions
  add column if not exists variant_id text;

alter table public.offline_sync_operations
  add column if not exists activity_session_id uuid;

alter table public.hike_sessions
  add column if not exists activity_session_id uuid;

-- 1. Compatibilité historique : les FK `(sport)` et `(sport, variant_id)` sont
--    remplacées par un trigger qui ne se déclenche que sur INSERT ou sur un
--    UPDATE des colonnes de clé. Une clôture (`status`, `ended_at`,
--    `updated_at`) d'une ligne historique hors taxonomie reste donc possible :
--    une FK PostgreSQL est réévaluée sur tout UPDATE, même quand la clé ne
--    change pas. L'intégrité des nouvelles écritures est conservée.
alter table public.activity_sessions
  drop constraint if exists activity_sessions_variant_pair_fkey;

alter table public.activity_sessions
  drop constraint if exists activity_sessions_sport_fkey;

-- Un état antérieur de la migration pouvait encore porter le CHECK de format
-- sur `activity_sessions.variant_id`. Il est remplacé par le trigger : une
-- ligne historique hors format reste closeable.
alter table public.activity_sessions
  drop constraint if exists activity_sessions_variant_id_check;

create or replace function public.guard_activity_session_sport_pair()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.sport is null or not exists (
    select 1 from public.explorer_sport_map m where m.sport = new.sport
  ) then
    raise exception 'sport inconnu' using errcode = '23503';
  end if;

  if new.variant_id is not null and not exists (
    select 1
      from public.explorer_sport_variants v
     where v.sport = new.sport
       and v.variant_id = new.variant_id
  ) then
    raise exception 'variante non démarrable' using errcode = '23503';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_activity_session_sport_pair() from public;

drop trigger if exists activity_sessions_sport_pair_guard on public.activity_sessions;
create trigger activity_sessions_sport_pair_guard
  before insert or update of sport, variant_id on public.activity_sessions
  for each row execute function public.guard_activity_session_sport_pair();

-- 2. Le résumé garde la trace de la séance qui l'a produit. La contrainte est
--    ajoutée NOT VALID pour ne jamais bloquer sur un historique incohérent ;
--    les nouvelles écritures sont contrôlées.
alter table public.hike_sessions
  drop constraint if exists hike_sessions_activity_session_fkey;

alter table public.hike_sessions
  add constraint hike_sessions_activity_session_fkey
  foreign key (activity_session_id)
  references public.activity_sessions (id)
  on delete set null
  not valid;

do $$
begin
  if exists (
    select 1
      from public.hike_sessions h
     where h.activity_session_id is not null
       and not exists (
         select 1 from public.activity_sessions s where s.id = h.activity_session_id
       )
  ) then
    raise warning 'hike_sessions: résumés historiques sans séance, contrainte hike_sessions_activity_session_fkey laissée NOT VALID';
  else
    alter table public.hike_sessions
      validate constraint hike_sessions_activity_session_fkey;
  end if;
end $$;

-- Un seul résumé par couple (propriétaire, séance). L'index est partiel pour
-- laisser les résumés historiques (colonne NULL) hors contrainte.
create unique index if not exists hike_sessions_activity_session_idx
  on public.hike_sessions (user_id, activity_session_id)
  where activity_session_id is not null;

comment on column public.hike_sessions.activity_session_id is
  'S1.02/K6.15 — séance source du résumé, renseignée par finish_activity_session ; NULL pour l''historique antérieur.';

-- 3. Index de secours pour les lignes de registre antérieures à la colonne
--    `activity_session_id`. Il ne réécrit aucune ligne.
create index if not exists offline_sync_activity_finish_legacy_session_idx
  on public.offline_sync_operations (user_id, ((result ->> 'sessionId')))
  where kind = 'activity.finish'
    and status = 'applied'
    and activity_session_id is null;

-- 4. Vérifie qu'un summaryId du registre désigne réellement un résumé de cet
--    utilisateur, et de cette séance lorsqu'un lien existe. Un client ne peut
--    donc pas fabriquer un `applied` crédible avec le résumé d'autrui.
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

  -- Un résumé lié doit désigner CETTE séance. Un résumé historique sans lien
  -- (créé avant la colonne) n'est accepté que si sa séance d'origine est
  -- cohérente : même départ, même itinéraire. On ne fait donc plus confiance
  -- au seul `result.sessionId` d'une ligne de registre historique.
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

-- 5. La fin de séance lie désormais le résumé à la séance et réutilise un
--    résumé déjà lié au lieu d'en créer un second.
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
  -- `auth.uid()` nul rend la comparaison nulle : le test explicite ferme le
  -- chemin non authentifié au lieu de laisser passer la séance.
  if v_user is null or s.user_id <> v_user then
    raise exception 'session d''un autre utilisateur' using errcode = '42501';
  end if;
  if s.status = 'finished' then
    return null;
  end if;

  -- Verrou de ligne par update conditionnel : deux fins concurrentes ne
  -- peuvent pas insérer deux résumés. La seconde voit 0 ligne et sort.
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

  -- Résumé déjà lié à cette séance (rejeu d'une fin directe) : le réutiliser
  -- plutôt que d'en créer un doublon.
  select h.id into v_summary_id
    from public.hike_sessions h
   where h.user_id = s.user_id
     and h.activity_session_id = p_session
   limit 1;

  if v_summary_id is not null then
    return v_summary_id;
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
    user_id, route_id, variant_id, activity_session_id, started_at, ended_at,
    distance_km, duration_seconds, elevation_gain_m, positions_geojson,
    processing_status, visibility, title
  ) values (
    s.user_id,
    s.route_id,
    case
      when s.variant_id ~ '^[a-z0-9][a-z0-9-]{0,63}$' then s.variant_id
      else null
    end,
    p_session,
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
  on conflict do nothing
  returning id into v_summary_id;

  -- Course perdue sur l'index unique : relire le résumé gagnant.
  if v_summary_id is null then
    select h.id into v_summary_id
      from public.hike_sessions h
     where h.user_id = s.user_id
       and h.activity_session_id = p_session
     limit 1;
  end if;

  return v_summary_id;
end;
$$;

revoke all on function public.finish_activity_session(uuid) from public;
grant execute on function public.finish_activity_session(uuid) to authenticated;

-- 6. Fin idempotente : en plus des verrous et de l'index existants, la lecture
--    de secours retrouve les lignes historiques (`activity_session_id` NULL)
--    et valide le résumé avant de le renvoyer.
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

  select * into v_existing
    from public.offline_sync_operations
   where user_id = v_user and idempotency_key = p_idempotency_key;

  if found then
    -- L'historique de 20261107/5ce8ef2 porte `kind = activity.finish`,
    -- `status = applied` et `result.sessionId`. Une ligne d'une autre
    -- opération ou d'une autre séance ne doit jamais servir de preuve.
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

    -- Ligne historique sans résumé dans le JSON, mais résumé désormais lié à
    -- la séance : le retrouver plutôt que de répondre un nul trompeur.
    if v_summary_text is null then
      select h.id into v_summary
        from public.hike_sessions h
       where h.user_id = v_user
         and h.activity_session_id = p_session
       limit 1;

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

  -- Deux clés différentes pour la même séance sont sérialisées ici : la
  -- seconde voit la ligne `applied` de la première et renvoie son résumé.
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
      select h.id into v_summary
        from public.hike_sessions h
       where h.user_id = v_user
         and h.activity_session_id = p_session
       limit 1;

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
  -- On préfère une ligne qui porte un résumé non nul.
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
      select h.id into v_summary
        from public.hike_sessions h
       where h.user_id = v_user
         and h.activity_session_id = p_session
       limit 1;

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

  -- Fin directe (RPC historique sans clé) : le résumé est lié à la séance.
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

  v_summary := public.finish_activity_session(p_session);

  -- La séance était déjà close (autre appareil, ancien client sans clé, ligne
  -- historique) : on ne prétend pas avoir appliqué une fin, et on n'écrit pas
  -- un `applied` sans résumé.
  if v_summary is null then
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

    return jsonb_build_object(
      'status', 'already_finished',
      'reason', 'session_already_finished',
      'summaryId', null
    );
  end if;

  insert into public.offline_sync_operations (
    user_id,
    idempotency_key,
    store,
    kind,
    status,
    result,
    activity_session_id
  )
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

  -- Une autre voie a acquitté la même clé, ou la même séance avec une autre
  -- clé, entre-temps : relire la ligne gagnante plutôt que de renvoyer un
  -- résumé qui n'est pas celui du registre.
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

-- 7. Intégrité du registre : le client ne peut plus écrire lui-même une ligne
--    `activity.finish` (elle doit passer par la RPC SECURITY DEFINER). Les
--    autres opérations hors-ligne A13 restent ouvertes au propriétaire.
drop policy if exists "offline_sync_operations_insert_own"
  on public.offline_sync_operations;

create policy "offline_sync_operations_insert_own"
  on public.offline_sync_operations
  for insert to authenticated
  with check (auth.uid() = user_id and kind <> 'activity.finish');

-- 8. La RPC SECURITY DEFINER doit pouvoir LIRE et ÉCRIRE ses propres lignes
--    d'acquittement alors que `offline_sync_operations` est en FORCE ROW LEVEL
--    SECURITY. Sous FORCE RLS, le propriétaire de la fonction est soumis aux
--    policies : les policies `TO authenticated` ne s'appliquent pas à un
--    propriétaire qui n'est pas membre de `authenticated`, et la policy
--    d'insertion `kind <> 'activity.finish'` refuse la ligne de fin.
--
--    Ces policies sont volontairement `TO public` : elles doivent s'appliquer
--    au rôle propriétaire quel qu'il soit. Leur condition vérifie que
--    l'opération est faite par le propriétaire courant de la RPC, jamais par un
--    client. `current_user` vaut le propriétaire à l'intérieur du SECURITY
--    DEFINER et redevient `authenticated` (ou `anon`) pour un accès direct.
--    Le nom du propriétaire est lu dans le catalogue : un changement de
--    propriétaire (migration rejouée par un autre rôle) reste couvert.
--    La lecture reste bornée aux lignes de l'appelant (`auth.uid()`).
drop policy if exists "offline_sync_operations_select_finish_rpc"
  on public.offline_sync_operations;

drop policy if exists "offline_sync_operations_insert_finish_rpc"
  on public.offline_sync_operations;

create policy "offline_sync_operations_select_finish_rpc"
  on public.offline_sync_operations
  for select to public
  using (
    auth.uid() = user_id
    and current_user = (
      select pg_catalog.pg_get_userbyid(p.proowner)
        from pg_catalog.pg_proc p
       where p.oid =
         'public.finish_activity_session_idempotent(uuid,text)'::regprocedure
    )
  );

create policy "offline_sync_operations_insert_finish_rpc"
  on public.offline_sync_operations
  for insert to public
  with check (
    kind = 'activity.finish'
    and auth.uid() = user_id
    and current_user = (
      select pg_catalog.pg_get_userbyid(p.proowner)
        from pg_catalog.pg_proc p
       where p.oid =
         'public.finish_activity_session_idempotent(uuid,text)'::regprocedure
    )
  );

-- 9. Interdit explicitement le seul propriétaire qui rendrait la policy
--    ci-dessus inutile : si la fonction appartenait à `authenticated`,
--    `current_user` matcherait pour un client authentifié, qui pourrait alors
--    écrire directement une ligne `activity.finish`. Un propriétaire
--    `service_role` ou `postgres` reste accepté (le cas normal des migrations).
do $$
declare
  v_owner text;
begin
  select r.rolname
    into v_owner
    from pg_catalog.pg_proc p
    join pg_catalog.pg_roles r on r.oid = p.proowner
   where p.oid =
     'public.finish_activity_session_idempotent(uuid,text)'::regprocedure;

  if v_owner is null then
    raise exception 'propriétaire de la RPC introuvable';
  end if;
  if v_owner = 'authenticated' then
    raise exception
      'finish_activity_session_idempotent ne doit pas appartenir à authenticated'
      using errcode = '42501';
  end if;
end $$;

commit;
