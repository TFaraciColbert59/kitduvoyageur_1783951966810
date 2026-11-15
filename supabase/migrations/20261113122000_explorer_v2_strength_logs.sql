-- Explorer v2 — carnet de musculation privé (S2.32).
--
-- Pourquoi une migration :
--   la première tranche du carnet musculation ne persistait que dans
--   `localStorage`. Ce fichier ajoute le contrat serveur minimal :
--     • un carnet par propriétaire, identifié par l'identifiant stable fourni
--       par le client (le brouillon hors ligne garde ainsi son identité) ;
--     • les exercices et les séries réellement saisis, sans catalogue ni
--       valeur déduite ;
--     • une RPC de synchronisation atomique qui remplace le contenu du carnet
--       et supprime les lignes retirées par l'utilisateur ;
--     • une RPC de lecture et une RPC de suppression, toutes deux bornées au
--       propriétaire par `auth.uid()`.
--
-- Portée strictement additive :
--   trois tables nouvelles, leurs index, leurs policies RLS et trois
--   fonctions. Aucune table, colonne, policy ou donnée existante n'est
--   modifiée ou supprimée. Aucun accès réseau n'est effectué ici.
--
-- Intégration activité :
--   `strength_logs.activity_session_id` est une colonne nullable qui pourra
--   lier un carnet à une séance `activity_sessions` du même propriétaire. La
--   RPC vérifie cette propriété quand la valeur est fournie. L'interface de
--   cette tranche ne renseigne pas encore la colonne : un carnet n'est jamais
--   présenté comme une sortie GPS ni comme une ligne de `hike_sessions`.
--
-- RGPD :
--   données privées, accessibles uniquement au propriétaire via RLS et RPC ;
--   aucune policy publique, aucun partage, aucun export implicite. La
--   suppression du carnet est explicite (RPC) et la suppression du compte
--   entraîne celle des carnets par la FK `auth.users(id) on delete cascade`.
--   Le détail figure dans `docs/explorer-v2/S2.32-CARNET-MUSCULATION.md`.
--
-- Version volontairement distincte des migrations séance/points déjà
-- présentes sur la branche (`20261113090000`).

begin;

-- 1. Carnet : une ligne par brouillon client et par propriétaire.
create table if not exists public.strength_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_log_id text not null
    check (client_log_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  started_at timestamptz not null,
  revision integer not null default 1 check (revision > 0),
  activity_session_id uuid references public.activity_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strength_logs_user_client_key unique (user_id, client_log_id)
);

comment on table public.strength_logs is
  'S2.32 — carnet de musculation privé, un par identifiant client et propriétaire ; aucune donnée partagée.';
comment on column public.strength_logs.client_log_id is
  'S2.32 — identifiant stable du brouillon local, conservé pour retrouver le même carnet après reconnexion.';
comment on column public.strength_logs.revision is
  'S2.32 — compteur serveur incrémenté à chaque synchronisation réussie ; sert de repère de fraîcheur, pas de contrôle de concurrence.';
comment on column public.strength_logs.activity_session_id is
  'S2.32 — séance d''activité facultative du même propriétaire ; NULL tant que l''interface ne rattache pas le carnet à une sortie.';

create index if not exists strength_logs_user_updated_idx
  on public.strength_logs (user_id, updated_at desc);

create index if not exists strength_logs_activity_session_idx
  on public.strength_logs (activity_session_id)
  where activity_session_id is not null;

-- 2. Exercices : nom libre saisi par l'utilisateur, ordre d'affichage stable.
create table if not exists public.strength_exercises (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.strength_logs(id) on delete cascade,
  client_exercise_id text not null
    check (client_exercise_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  position integer not null check (position >= 0),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strength_exercises_log_client_key unique (log_id, client_exercise_id)
);

comment on table public.strength_exercises is
  'S2.32 — exercice nommé manuellement dans un carnet privé ; aucun catalogue ni préremplissage.';

create index if not exists strength_exercises_log_position_idx
  on public.strength_exercises (log_id, position);

-- 3. Séries : répétitions et charge réellement saisies.
create table if not exists public.strength_sets (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.strength_exercises(id) on delete cascade,
  client_set_id text not null
    check (client_set_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  position integer not null check (position >= 0),
  reps integer not null check (reps between 1 and 999),
  load numeric check (load is null or (load >= 0 and load <= 10000)),
  unit text not null check (unit in ('kg', 'lb')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strength_sets_exercise_client_key unique (exercise_id, client_set_id)
);

comment on table public.strength_sets is
  'S2.32 — série saisie manuellement ; `load` NULL signifie poids du corps, jamais une charge estimée.';

create index if not exists strength_sets_exercise_position_idx
  on public.strength_sets (exercise_id, position);

-- 4. RLS : le propriétaire est le seul acteur autorisé, sur les trois niveaux.
alter table public.strength_logs enable row level security;
alter table public.strength_exercises enable row level security;
alter table public.strength_sets enable row level security;

drop policy if exists strength_logs_owner_select on public.strength_logs;
create policy strength_logs_owner_select on public.strength_logs
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists strength_logs_owner_insert on public.strength_logs;
create policy strength_logs_owner_insert on public.strength_logs
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (
      activity_session_id is null
      or exists (
        select 1 from public.activity_sessions s
        where s.id = strength_logs.activity_session_id
          and s.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists strength_logs_owner_update on public.strength_logs;
create policy strength_logs_owner_update on public.strength_logs
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      activity_session_id is null
      or exists (
        select 1 from public.activity_sessions s
        where s.id = strength_logs.activity_session_id
          and s.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists strength_logs_owner_delete on public.strength_logs;
create policy strength_logs_owner_delete on public.strength_logs
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists strength_exercises_owner_select on public.strength_exercises;
create policy strength_exercises_owner_select on public.strength_exercises
  for select to authenticated using (
    exists (
      select 1 from public.strength_logs l
      where l.id = strength_exercises.log_id and l.user_id = (select auth.uid())
    )
  );

drop policy if exists strength_exercises_owner_insert on public.strength_exercises;
create policy strength_exercises_owner_insert on public.strength_exercises
  for insert to authenticated with check (
    exists (
      select 1 from public.strength_logs l
      where l.id = strength_exercises.log_id and l.user_id = (select auth.uid())
    )
  );

drop policy if exists strength_exercises_owner_update on public.strength_exercises;
create policy strength_exercises_owner_update on public.strength_exercises
  for update to authenticated
  using (
    exists (
      select 1 from public.strength_logs l
      where l.id = strength_exercises.log_id and l.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.strength_logs l
      where l.id = strength_exercises.log_id and l.user_id = (select auth.uid())
    )
  );

drop policy if exists strength_exercises_owner_delete on public.strength_exercises;
create policy strength_exercises_owner_delete on public.strength_exercises
  for delete to authenticated using (
    exists (
      select 1 from public.strength_logs l
      where l.id = strength_exercises.log_id and l.user_id = (select auth.uid())
    )
  );

drop policy if exists strength_sets_owner_select on public.strength_sets;
create policy strength_sets_owner_select on public.strength_sets
  for select to authenticated using (
    exists (
      select 1
        from public.strength_exercises e
        join public.strength_logs l on l.id = e.log_id
       where e.id = strength_sets.exercise_id and l.user_id = (select auth.uid())
    )
  );

drop policy if exists strength_sets_owner_insert on public.strength_sets;
create policy strength_sets_owner_insert on public.strength_sets
  for insert to authenticated with check (
    exists (
      select 1
        from public.strength_exercises e
        join public.strength_logs l on l.id = e.log_id
       where e.id = strength_sets.exercise_id and l.user_id = (select auth.uid())
    )
  );

drop policy if exists strength_sets_owner_update on public.strength_sets;
create policy strength_sets_owner_update on public.strength_sets
  for update to authenticated
  using (
    exists (
      select 1
        from public.strength_exercises e
        join public.strength_logs l on l.id = e.log_id
       where e.id = strength_sets.exercise_id and l.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
        from public.strength_exercises e
        join public.strength_logs l on l.id = e.log_id
       where e.id = strength_sets.exercise_id and l.user_id = (select auth.uid())
    )
  );

drop policy if exists strength_sets_owner_delete on public.strength_sets;
create policy strength_sets_owner_delete on public.strength_sets
  for delete to authenticated using (
    exists (
      select 1
        from public.strength_exercises e
        join public.strength_logs l on l.id = e.log_id
       where e.id = strength_sets.exercise_id and l.user_id = (select auth.uid())
    )
  );

revoke all on table public.strength_logs from public;
revoke all on table public.strength_exercises from public;
revoke all on table public.strength_sets from public;
revoke all on table public.strength_logs from anon, authenticated;
revoke all on table public.strength_exercises from anon, authenticated;
revoke all on table public.strength_sets from anon, authenticated;

grant select, insert, update, delete on table public.strength_logs to authenticated;
grant select, insert, update, delete on table public.strength_exercises to authenticated;
grant select, insert, update, delete on table public.strength_sets to authenticated;

-- 5. Synchronisation atomique d'un carnet complet.
--    Le client envoie l'état complet de son brouillon. La fonction :
--      • vérifie l'acteur (`auth.uid()`), les bornes et l'appartenance de la
--        séance d'activité éventuelle ;
--      • crée ou met à jour le carnet et incrémente sa révision ;
--      • remplace les exercices et séries, en supprimant ceux qui ne sont plus
--        dans le payload (suppression explicite de l'utilisateur) ;
--      • ne modifie aucune autre ligne.
--    Les identifiants client sont conservés : un rejeu du même brouillon est
--    idempotent, et le hors-ligne peut repousser son état sans créer de doublon.
create or replace function public.sync_strength_log(
  p_log jsonb,
  p_activity_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_log public.strength_logs%rowtype;
  v_exercise jsonb;
  v_set jsonb;
  v_exercise_id uuid;
  v_position integer;
  v_set_position integer;
  v_name text;
  v_started_at timestamptz;
  v_exercise_count integer;
  v_set_count integer := 0;
begin
  if v_user is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;

  if p_log is null or jsonb_typeof(p_log) <> 'object' then
    raise exception 'carnet invalide' using errcode = '22023';
  end if;
  if jsonb_typeof(p_log->'version') is distinct from 'number'
     or (p_log->>'version') is distinct from '1' then
    raise exception 'version de carnet inconnue' using errcode = '22023';
  end if;
  if jsonb_typeof(p_log->'id') is distinct from 'string'
     or coalesce(p_log->>'id', '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'identifiant de carnet invalide' using errcode = '22023';
  end if;
  if jsonb_typeof(p_log->'exercises') is distinct from 'array' then
    raise exception 'exercices invalides' using errcode = '22023';
  end if;

  v_exercise_count := jsonb_array_length(p_log->'exercises');
  if v_exercise_count > 100 then
    raise exception 'trop d''exercices' using errcode = '22023';
  end if;

  if jsonb_typeof(p_log->'startedAt') is distinct from 'number'
     or jsonb_typeof(p_log->'updatedAt') is distinct from 'number'
     or (case
           when jsonb_typeof(p_log->'startedAt') = 'number' then
             (p_log->>'startedAt')::numeric < 946684800000
             or (p_log->>'startedAt')::numeric > 4102444800000
           else false
         end)
     or (case
           when jsonb_typeof(p_log->'updatedAt') = 'number' then
             (p_log->>'updatedAt')::numeric < 946684800000
             or (p_log->>'updatedAt')::numeric > 4102444800000
           else false
         end) then
    raise exception 'horodatage de carnet invalide' using errcode = '22023';
  end if;
  v_started_at := to_timestamp((p_log->>'startedAt')::double precision / 1000.0);

  if p_activity_session_id is not null and not exists (
    select 1
      from public.activity_sessions s
     where s.id = p_activity_session_id
       and s.user_id = v_user
  ) then
    raise exception 'séance d''activité introuvable ou non autorisée' using errcode = '42501';
  end if;

  -- Validation défensive des exercices. La route valide déjà, mais la RPC est
  -- appelable directement avec un jeton utilisateur.
  if exists (
    select 1
      from jsonb_array_elements(p_log->'exercises') as e
     where jsonb_typeof(e) is distinct from 'object'
        or jsonb_typeof(e->'id') is distinct from 'string'
        or jsonb_typeof(e->'name') is distinct from 'string'
        or coalesce(e->>'id', '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
        or coalesce(btrim(e->>'name'), '') = ''
        or length(e->>'name') > 320
        or char_length(
             btrim(regexp_replace(e->>'name', '[[:space:]]+', ' ', 'g'))
           ) > 80
        or jsonb_typeof(e->'sets') is distinct from 'array'
  ) then
    raise exception 'exercice invalide' using errcode = '22023';
  end if;

  select coalesce(sum(jsonb_array_length(e->'sets')), 0)::integer
    into v_set_count
    from jsonb_array_elements(p_log->'exercises') as e;

  if v_set_count > 1000 then
    raise exception 'trop de séries' using errcode = '22023';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_log->'exercises') as e
      cross join lateral jsonb_array_elements(e->'sets') as s
     where jsonb_typeof(s) is distinct from 'object'
        or jsonb_typeof(s->'id') is distinct from 'string'
        or jsonb_typeof(s->'unit') is distinct from 'string'
        or coalesce(s->>'id', '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
        or coalesce(s->>'unit', '') not in ('kg', 'lb')
        or case
             when jsonb_typeof(s->'reps') = 'number' then
               (s->>'reps')::numeric < 1
               or (s->>'reps')::numeric > 999
               or (s->>'reps')::numeric <> trunc((s->>'reps')::numeric)
             else false
           end
        or jsonb_typeof(s->'reps') is distinct from 'number'
        or coalesce(jsonb_typeof(s->'load'), 'null') not in ('null', 'number')
        or case
             when jsonb_typeof(s->'load') = 'number' then
               (s->>'load')::numeric < 0
               or (s->>'load')::numeric > 10000
             else false
           end
  ) then
    raise exception 'série invalide' using errcode = '22023';
  end if;

  -- Les identifiants client sont uniques dans un carnet et dans un exercice.
  -- La route le vérifie déjà ; la RPC refuse aussi un appel direct ambigu.
  if exists (
    select 1
      from jsonb_array_elements(p_log->'exercises') as e
     group by e->>'id'
    having count(*) > 1
  ) then
    raise exception 'identifiant d''exercice dupliqué' using errcode = '22023';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_log->'exercises') as e
      cross join lateral jsonb_array_elements(e->'sets') as s
     group by e->>'id', s->>'id'
    having count(*) > 1
  ) then
    raise exception 'identifiant de série dupliqué' using errcode = '22023';
  end if;

  -- Création ou mise à jour de l'en-tête. La révision n'est jamais fournie par
  -- le client : elle est incrémentée côté serveur à chaque écriture acceptée.
  insert into public.strength_logs (
    user_id, client_log_id, started_at, activity_session_id
  ) values (
    v_user, p_log->>'id', v_started_at, p_activity_session_id
  )
  on conflict (user_id, client_log_id) do update
    set started_at = excluded.started_at,
        activity_session_id = coalesce(
          excluded.activity_session_id,
          strength_logs.activity_session_id
        ),
        revision = strength_logs.revision + 1,
        updated_at = now()
  returning * into v_log;

  -- Suppression des exercices retirés du brouillon. Les séries suivent par
  -- cascade ; aucune autre ligne n'est touchée.
  delete from public.strength_exercises e
   where e.log_id = v_log.id
     and not exists (
       select 1
         from jsonb_array_elements(p_log->'exercises') as x
        where x->>'id' = e.client_exercise_id
     );

  for v_exercise, v_position in
    select value, (ordinality - 1)::integer
      from jsonb_array_elements(p_log->'exercises') with ordinality
     order by ordinality
  loop
    v_name := btrim(regexp_replace(v_exercise->>'name', '[[:space:]]+', ' ', 'g'));
    if v_name = '' or char_length(v_name) > 80 then
      raise exception 'nom d''exercice invalide' using errcode = '22023';
    end if;

    insert into public.strength_exercises (
      log_id, client_exercise_id, position, name
    ) values (
      v_log.id, v_exercise->>'id', v_position, v_name
    )
    on conflict (log_id, client_exercise_id) do update
      set position = excluded.position,
          name = excluded.name,
          updated_at = now()
    returning id into v_exercise_id;

    delete from public.strength_sets s
     where s.exercise_id = v_exercise_id
       and not exists (
         select 1
           from jsonb_array_elements(v_exercise->'sets') as y
          where y->>'id' = s.client_set_id
       );

    for v_set, v_set_position in
      select value, (ordinality - 1)::integer
        from jsonb_array_elements(v_exercise->'sets') with ordinality
       order by ordinality
    loop
      insert into public.strength_sets (
        exercise_id, client_set_id, position, reps, load, unit
      ) values (
        v_exercise_id,
        v_set->>'id',
        v_set_position,
        (v_set->>'reps')::integer,
        case
          when jsonb_typeof(v_set->'load') = 'number' then (v_set->>'load')::numeric
          else null
        end,
        v_set->>'unit'
      )
      on conflict (exercise_id, client_set_id) do update
        set position = excluded.position,
            reps = excluded.reps,
            load = excluded.load,
            unit = excluded.unit,
            updated_at = now();
    end loop;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'logId', v_log.id,
    'clientLogId', v_log.client_log_id,
    'revision', v_log.revision,
    'updatedAt', v_log.updated_at,
    'exerciseCount', v_exercise_count,
    'setCount', v_set_count,
    'activitySessionId', v_log.activity_session_id
  );
end;
$$;

revoke all on function public.sync_strength_log(jsonb, uuid) from public;
grant execute on function public.sync_strength_log(jsonb, uuid) to authenticated;

-- 6. Lecture du carnet du propriétaire. `p_client_log_id` NULL renvoie le
--    carnet le plus récemment modifié ; l'interface l'utilise pour restaurer
--    un brouillon absent de l'appareil.
create or replace function public.read_strength_log(p_client_log_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_log public.strength_logs%rowtype;
begin
  if v_user is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;

  select * into v_log
    from public.strength_logs l
   where l.user_id = v_user
     and (p_client_log_id is null or l.client_log_id = p_client_log_id)
   order by l.updated_at desc
   limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'version', 1,
    'id', v_log.client_log_id,
    'startedAt', (extract(epoch from v_log.started_at) * 1000)::bigint,
    'updatedAt', (extract(epoch from v_log.updated_at) * 1000)::bigint,
    'serverUpdatedAt', v_log.updated_at,
    'revision', v_log.revision,
    'activitySessionId', v_log.activity_session_id,
    'exercises', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', e.client_exercise_id,
            'name', e.name,
            'sets', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'id', s.client_set_id,
                    'reps', s.reps,
                    'load', s.load,
                    'unit', s.unit
                  )
                  order by s.position
                )
                from public.strength_sets s
                where s.exercise_id = e.id
              ),
              '[]'::jsonb
            )
          )
          order by e.position
        )
        from public.strength_exercises e
        where e.log_id = v_log.id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.read_strength_log(text) from public;
grant execute on function public.read_strength_log(text) to authenticated;

-- 7. Suppression explicite. Une ligne d'un autre propriétaire n'est jamais
--    visible : la fonction renvoie simplement `deleted: false`.
create or replace function public.delete_strength_log(p_client_log_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_deleted integer := 0;
begin
  if v_user is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;
  if p_client_log_id is null or p_client_log_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'identifiant de carnet invalide' using errcode = '22023';
  end if;

  delete from public.strength_logs l
   where l.user_id = v_user
     and l.client_log_id = p_client_log_id;

  get diagnostics v_deleted = row_count;
  return jsonb_build_object('deleted', v_deleted > 0);
end;
$$;

revoke all on function public.delete_strength_log(text) from public;
grant execute on function public.delete_strength_log(text) to authenticated;

commit;
