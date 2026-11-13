-- S6.15 — stockage des choix de visibilité par métrique d'une sortie.
--
-- La policy de partage d'une sortie (`private`, `collective_anonymized`) ne
-- dit pas quelles métriques d'effort le propriétaire accepte de publier. Sans
-- stockage serveur, un choix local serait un droit simulé : il ne changerait
-- pas ce que reçoit un tiers. Cette migration ajoute donc une table dédiée,
-- additive et indépendante de `hike_sessions` pour ne pas élargir la lecture
-- brute des traces.
--
-- Le contrat est volontairement fermé :
--   * une seule ligne par sortie (`session_id` primary key) ;
--   * `visibility` est un objet JSONB de booléens stricts ;
--   * les clés inconnues sont refusées par la base, pas seulement par l'API ;
--   * une clé absente vaut `false` à la lecture (`parseMetricVisibility`) ;
--   * aucune valeur de métrique (FC, puissance, calories…) n'est stockée ici.
--
-- Version dédiée : `20261113121000`, sans réutiliser `20261113090000`, déjà
-- réservé à un autre chantier.

-- ── 1. Validateur de la liste fermée ─────────────────────────────────────────
-- Fonction immuable utilisée par la contrainte CHECK. Elle ne lit aucune table
-- et ne dépend d'aucun rôle : seules la forme et les clés du JSON sont jugées.
create or replace function public.outing_metric_visibility_is_valid(p_visibility jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when jsonb_typeof(p_visibility) is distinct from 'object' then false
    else not exists (
      select 1
      from jsonb_each(p_visibility) as entry(key, value)
      where entry.key not in (
        'distance',
        'elevation',
        'elevationGain',
        'maxAltitude',
        'duration',
        'pace',
        'movingTime',
        'heartRate',
        'power',
        'cadence',
        'calories'
      )
      or jsonb_typeof(entry.value) <> 'boolean'
    )
  end;
$$;

revoke all on function public.outing_metric_visibility_is_valid(jsonb) from public;
grant execute on function public.outing_metric_visibility_is_valid(jsonb)
  to authenticated, service_role;

comment on function public.outing_metric_visibility_is_valid(jsonb) is
  'S6.15 — vrai si l''objet ne contient que les clés de métriques connues, '
  'toutes de type booléen. Une clé absente reste valide et vaut false à la lecture.';

-- ── 2. Table des choix du propriétaire ───────────────────────────────────────
create table if not exists public.outing_share_metrics (
  session_id uuid primary key references public.hike_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  visibility jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outing_share_metrics_object check (jsonb_typeof(visibility) = 'object'),
  constraint outing_share_metrics_closed_keys check (
    public.outing_metric_visibility_is_valid(visibility)
  )
);

comment on table public.outing_share_metrics is
  'S6.15 — choix explicites du propriétaire, par sortie, des métriques '
  'publiables à un tiers. Une ligne absente signifie « aucun choix enregistré » '
  'et laisse le socle agrégé par défaut. Aucune valeur de santé ou de capteur '
  'n''est stockée dans cette table : uniquement des booléens de visibilité.';

comment on column public.outing_share_metrics.visibility is
  'Objet JSONB fermé : distance, elevation, elevationGain, maxAltitude, '
  'duration, pace, movingTime, heartRate, power, cadence, calories. '
  'Toute valeur non booléenne ou toute clé inconnue est refusée par la base.';

create index if not exists idx_outing_share_metrics_user_id
  on public.outing_share_metrics(user_id);

-- ── 3. Cohérence propriétaire de la sortie ───────────────────────────────────
-- La RLS empêche déjà un tiers d'écrire. Ce trigger ferme le cas d'un appel
-- service_role qui aurait fourni un `user_id` différent du propriétaire réel de
-- la sortie, et interdit de déplacer une politique d'une sortie à une autre.
create or replace function public.outing_share_metrics_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.session_id is distinct from old.session_id then
    raise exception 'outing_share_metrics_session_immutable'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.hike_sessions s
    where s.id = new.session_id
      and s.user_id = new.user_id
  ) then
    raise exception 'outing_share_metrics_owner_mismatch'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.outing_share_metrics_guard() from public, anon, authenticated;

drop trigger if exists trg_outing_share_metrics_guard on public.outing_share_metrics;
create trigger trg_outing_share_metrics_guard
  before insert or update on public.outing_share_metrics
  for each row execute function public.outing_share_metrics_guard();

drop trigger if exists trg_outing_share_metrics_updated_at on public.outing_share_metrics;
create trigger trg_outing_share_metrics_updated_at
  before update on public.outing_share_metrics
  for each row execute function public.adventure_touch_updated_at();

-- ── 4. RLS et privilèges ─────────────────────────────────────────────────────
alter table public.outing_share_metrics enable row level security;
alter table public.outing_share_metrics force row level security;

drop policy if exists outing_share_metrics_select_own on public.outing_share_metrics;
create policy outing_share_metrics_select_own
  on public.outing_share_metrics for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.hike_sessions s
      where s.id = outing_share_metrics.session_id
        and s.user_id = (select auth.uid())
    )
  );

drop policy if exists outing_share_metrics_insert_own on public.outing_share_metrics;
create policy outing_share_metrics_insert_own
  on public.outing_share_metrics for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.hike_sessions s
      where s.id = outing_share_metrics.session_id
        and s.user_id = (select auth.uid())
    )
  );

drop policy if exists outing_share_metrics_update_own on public.outing_share_metrics;
create policy outing_share_metrics_update_own
  on public.outing_share_metrics for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.hike_sessions s
      where s.id = outing_share_metrics.session_id
        and s.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.hike_sessions s
      where s.id = outing_share_metrics.session_id
        and s.user_id = (select auth.uid())
    )
  );

drop policy if exists outing_share_metrics_delete_own on public.outing_share_metrics;
create policy outing_share_metrics_delete_own
  on public.outing_share_metrics for delete to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.hike_sessions s
      where s.id = outing_share_metrics.session_id
        and s.user_id = (select auth.uid())
    )
  );

drop policy if exists outing_share_metrics_all_service on public.outing_share_metrics;
create policy outing_share_metrics_all_service
  on public.outing_share_metrics for all to service_role
  using (true)
  with check (true);

revoke all on public.outing_share_metrics from anon;
grant select, insert, update, delete on public.outing_share_metrics to authenticated;
grant all on public.outing_share_metrics to service_role;

comment on policy outing_share_metrics_select_own on public.outing_share_metrics is
  'Le propriétaire lit ses choix. Les tiers ne lisent jamais cette table : la projection serveur la lit avec service_role après autorisation de la sortie.';
comment on policy outing_share_metrics_insert_own on public.outing_share_metrics is
  'Insertion réservée au propriétaire réel de la sortie. Aucun accès anon.';
comment on policy outing_share_metrics_update_own on public.outing_share_metrics is
  'Mise à jour réservée au propriétaire réel de la sortie. Le trigger vérifie aussi la cohérence session/user.';
comment on policy outing_share_metrics_delete_own on public.outing_share_metrics is
  'Suppression réservée au propriétaire : elle remet la sortie sur le socle par défaut.';

comment on policy outing_share_metrics_all_service on public.outing_share_metrics is
  'Lecture service_role après contrôle du rôle de lecture de la sortie. Aucune valeur de métrique, seulement la politique.';

-- ── 5. Projection SQL des métriques par sortie et durcissement des RPC ───────
-- Miroir SQL de `resolveOutingMetricVisibility` : propriétaire et participant
-- inscrit gardent toutes les métriques ; un tiers autorisé sur la sortie ne
-- reçoit que le socle par défaut (`distance`, `elevation`, `elevationGain`,
-- `maxAltitude`, `duration`) ou les booléens stricts enregistrés dans
-- `outing_share_metrics`. Toute sortie privée ou relation non vérifiée ferme.
create or replace function public.outing_session_metric_visible(
  p_session_id uuid,
  p_viewer_id uuid,
  p_metric text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.hike_sessions s
    left join public.outing_share_metrics osm
      on osm.session_id = s.id
    where s.id = p_session_id
      and (
        (
          p_viewer_id is not null
          and (
            s.user_id = p_viewer_id
            or exists (
              select 1
              from public.hike_session_participants hp
              where hp.session_id = s.id
                and hp.user_id = p_viewer_id
            )
          )
        )
        or (
          (
            s.visibility in ('collective_anonymized', 'public')
            or (
              s.visibility in ('friends', 'followers')
              and p_viewer_id is not null
              and exists (
                select 1
                from public.user_follows f
                where f.follower_id = p_viewer_id
                  and f.following_id = s.user_id
              )
            )
          )
          and case
            when osm.session_id is null then p_metric in (
              'distance',
              'elevation',
              'elevationGain',
              'maxAltitude',
              'duration'
            )
            else coalesce((osm.visibility ->> p_metric)::boolean, false)
          end
        )
      )
  );
$$;

revoke all on function public.outing_session_metric_visible(uuid, uuid, text) from public;
grant execute on function public.outing_session_metric_visible(uuid, uuid, text)
  to authenticated, anon, service_role;

create or replace function public.carnet_aggregate_distance_km(
  p_carnet_id uuid,
  p_fallback numeric,
  p_viewer_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when not exists (
      select 1
      from public.hike_sessions hs
      where hs.carnet_id = p_carnet_id
    ) then p_fallback
    when exists (
      select 1
      from public.hike_sessions hs
      where hs.carnet_id = p_carnet_id
        and not public.outing_session_metric_visible(hs.id, p_viewer_id, 'distance')
    ) then null::numeric
    else (
      select sum(hs.distance_km)::numeric
      from public.hike_sessions hs
      where hs.carnet_id = p_carnet_id
        and hs.distance_km is not null
    )
  end;
$$;

revoke all on function public.carnet_aggregate_distance_km(uuid, numeric, uuid) from public;
grant execute on function public.carnet_aggregate_distance_km(uuid, numeric, uuid)
  to authenticated, anon, service_role;

create or replace function public.carnet_aggregate_elevation_m(
  p_carnet_id uuid,
  p_fallback integer,
  p_viewer_id uuid
)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when not exists (
      select 1
      from public.hike_sessions hs
      where hs.carnet_id = p_carnet_id
    ) then p_fallback
    when exists (
      select 1
      from public.hike_sessions hs
      where hs.carnet_id = p_carnet_id
        and not public.outing_session_metric_visible(hs.id, p_viewer_id, 'elevationGain')
    ) then null::integer
    else (
      select sum(hs.elevation_gain_m)::integer
      from public.hike_sessions hs
      where hs.carnet_id = p_carnet_id
        and hs.elevation_gain_m is not null
    )
  end;
$$;

revoke all on function public.carnet_aggregate_elevation_m(uuid, integer, uuid) from public;
grant execute on function public.carnet_aggregate_elevation_m(uuid, integer, uuid)
  to authenticated, anon, service_role;

-- Durcissement de `community_carnets_feed` : les totaux `route_distance_km` et
-- `elevation_gain_m` passent par l'intersection des politiques de toutes les
-- sorties du carnet (fermé dès qu'une sortie est privée ou masque la métrique).
create or replace function public.community_carnets_feed(
  p_filter text default 'discover',
  p_sort text default 'recent',
  p_lat double precision default null,
  p_lng double precision default null,
  p_cursor jsonb default null,
  p_limit integer default 12
)
returns table (
  id uuid,
  title text,
  destination text,
  cover_image text,
  author_id uuid,
  author_name text,
  author_avatar text,
  start_date date,
  end_date date,
  nb_nuits integer,
  route_distance_km numeric,
  elevation_gain_m integer,
  likes_count integer,
  comments_count integer,
  liked_by_me boolean,
  travelers jsonb,
  is_live boolean,
  lat double precision,
  lng double precision,
  distance_km double precision,
  visibility text,
  country_iso text,
  sort_key numeric
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_filter text := case
    when p_filter in ('discover', 'mine', 'followed', 'near') then p_filter
    else 'discover'
  end;
  v_sort text := case
    when p_sort in ('recent', 'popular', 'near', 'duration') then p_sort
    else 'recent'
  end;
  v_limit integer := least(greatest(coalesce(p_limit, 12), 1), 30);
  v_desc boolean := v_sort <> 'near';
  v_pt geography := case
    when p_lat is not null and p_lng is not null
      then st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  end;
  v_cursor_key numeric;
  v_cursor_id uuid;
begin
  if p_cursor is not null and p_cursor <> 'null'::jsonb then
    v_cursor_key := nullif(p_cursor ->> 'v', '')::numeric;
    v_cursor_id := nullif(p_cursor ->> 'id', '')::uuid;
  end if;

  return query
    with base as (
      select
        c.*,
        case
          when v_pt is not null and c.start_geom is not null
            then st_distance(c.start_geom, v_pt) / 1000.0
        end as distance_from_me
      from public.carnets c
      where (
              (v_filter = 'discover' and c.visibility = 'public')
              or (v_filter = 'mine' and c.author_id = v_uid)
              or (
                v_filter = 'followed'
                and c.visibility = 'public'
                and v_uid is not null
                and exists (
                  select 1 from public.user_follows f
                   where f.follower_id = v_uid and f.following_id = c.author_id
                )
              )
              or (
                v_filter = 'near'
                and c.start_geom is not null
                and v_pt is not null
                and st_dwithin(c.start_geom, v_pt, 100000)
              )
            )
    ),
    ranked as (
      select
        b.*,
        case v_sort
          when 'popular' then coalesce(b.likes_count, 0)::numeric
          when 'near' then coalesce(b.distance_from_me, 1e9)::numeric
          when 'duration' then coalesce(nullif(b.nb_nuits, 0), (b.end_date - b.start_date), 0)::numeric
          else extract(epoch from coalesce(b.created_at, now()))::numeric
        end as sort_key
      from base b
    )
    select
      r.id,
      r.title,
      coalesce(r.destination, ''),
      r.cover_image,
      r.author_id,
      coalesce(pp.full_name, ''),
      pp.avatar_url,
      r.start_date,
      r.end_date,
      r.nb_nuits,
      public.carnet_aggregate_distance_km(r.id, r.distance_km, v_uid),
      public.carnet_aggregate_elevation_m(r.id, r.denivele_m, v_uid),
      coalesce(r.likes_count, 0),
      coalesce(r.comments_count, 0),
      (
        v_uid is not null and exists (
          select 1 from public.carnet_likes cl
           where cl.carnet_id = r.id and cl.user_id = v_uid
        )
      ),
      jsonb_build_object(
        'total', (
          select count(distinct u.uid)
            from (
              select r.author_id as uid
              union all
              select cc.user_id
                from public.carnet_collaborators cc
               where cc.carnet_id = r.id and cc.role in ('owner', 'contributor')
            ) u
           where u.uid is not null
        ),
        'avatars', coalesce((
          select jsonb_agg(
                   jsonb_build_object('id', a.uid, 'name', a.name, 'avatar', a.avatar)
                   order by a.ord, a.name
                 )
            from (
              select u.uid, u.ord, coalesce(pp2.full_name, '') as name, pp2.avatar_url as avatar
                from (
                  select r.author_id as uid, 0 as ord
                  union all
                  select cc.user_id, 1
                    from public.carnet_collaborators cc
                   where cc.carnet_id = r.id and cc.role in ('owner', 'contributor')
                ) u
                left join public.public_profiles pp2 on pp2.id = u.uid
               where u.uid is not null
               order by u.ord, pp2.full_name
               limit 3
            ) a
        ), '[]'::jsonb)
      ),
      public.lkdv_carnet_is_live(r.id),
      case when r.start_geom is not null then st_y(r.start_geom::geometry) end,
      case when r.start_geom is not null then st_x(r.start_geom::geometry) end,
      r.distance_from_me,
      r.visibility,
      nullif(upper(btrim(r.country_iso)), ''),
      r.sort_key
    from ranked r
    left join public.public_profiles pp on pp.id = r.author_id
    where (
      v_cursor_key is null
      or (
        v_desc
        and (r.sort_key < v_cursor_key or (r.sort_key = v_cursor_key and r.id < v_cursor_id))
      )
      or (
        not v_desc
        and (r.sort_key > v_cursor_key or (r.sort_key = v_cursor_key and r.id > v_cursor_id))
      )
    )
    order by
      case when v_desc then r.sort_key end desc nulls last,
      case when not v_desc then r.sort_key end asc nulls last,
      case when v_desc then r.id end desc,
      case when not v_desc then r.id end asc
    limit v_limit;
end;
$$;

comment on function public.community_carnets_feed(text, text, double precision, double precision, jsonb, integer) is
  'Communauté v2 — volet Carnets : pagination par curseur, filtres discover/mine/followed/near, tri recent/popular/near/duration, totaux distance/dénivelé filtrés par outing_share_metrics (S6.15).';

revoke all on function public.community_carnets_feed(text, text, double precision, double precision, jsonb, integer) from public;
grant execute on function public.community_carnets_feed(text, text, double precision, double precision, jsonb, integer)
  to authenticated, anon, service_role;

-- Durcissement de `get_kit_journal` : les totaux d'effort (`total_km`,
-- `total_elevation_gain_m`) ne sont exposés que si le lecteur est propriétaire
-- du kit ou si toutes les sorties rattachées au kit autorisent la métrique.
create or replace function public.get_kit_journal(p_kit_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_kit public.materiel_kits%rowtype;
  v_allow_distance boolean;
  v_allow_elevation boolean;
  v_out jsonb;
begin
  select * into v_kit from public.materiel_kits where id = p_kit_id;
  if not found then
    return null;
  end if;

  v_allow_distance := (
    v_uid is not null and v_uid = v_kit.user_id
  ) and not exists (
    select 1
    from public.hike_sessions hs
    where hs.kit_id = v_kit.id
      and not public.outing_session_metric_visible(hs.id, v_uid, 'distance')
  );

  v_allow_elevation := (
    v_uid is not null and v_uid = v_kit.user_id
  ) and not exists (
    select 1
    from public.hike_sessions hs
    where hs.kit_id = v_kit.id
      and not public.outing_session_metric_visible(hs.id, v_uid, 'elevationGain')
  );

  select jsonb_build_object(
    'kit_id',    v_kit.id,
    'birth',     jsonb_build_object(
                   'origin',      v_kit.origin,
                   'created_at',  v_kit.created_at,
                   'generation',  v_kit.generation
                 ),
    'lineage',   jsonb_build_object(
                   'fork_count',     (select count(*) from public.materiel_kits
                                      where lineage_root_id = v_kit.lineage_root_id
                                        and id <> v_kit.id),
                   'max_generation', (select max(generation) from public.materiel_kits
                                      where lineage_root_id = v_kit.lineage_root_id)
                 ),
    'field',     jsonb_build_object(
                   'session_count',
                     (select count(*) from public.hike_sessions where kit_id = v_kit.id),
                   'total_km',
                     case
                       when v_allow_distance then round(coalesce((
                         select sum(distance_km) from public.hike_sessions
                         where kit_id = v_kit.id
                       ), 0)::numeric, 1)
                       else null
                     end,
                   'total_elevation_gain_m',
                     case
                       when v_allow_elevation then (
                         select coalesce(sum(elevation_gain_m), 0) from public.hike_sessions
                         where kit_id = v_kit.id
                       )
                       else null
                     end,
                   'seasons', (select jsonb_object_agg(s, c) from (
                                  select case
                                           when extract(month from started_at) in (12,1,2) then 'hiver'
                                           when extract(month from started_at) in (3,4,5) then 'printemps'
                                           when extract(month from started_at) in (6,7,8) then 'ete'
                                           else 'automne'
                                         end as s,
                                         count(*) as c
                                  from public.hike_sessions
                                  where kit_id = v_kit.id
                                  group by s) seasons),
                   'regions', (select jsonb_agg(row) from (
                                  select r.region, count(*) as sessions
                                  from public.hike_sessions s
                                  join public.hiking_routes r on r.id = s.route_id
                                  where s.kit_id = v_kit.id and r.region is not null
                                  group by r.region
                                  order by count(*) desc) row)
                 ),
    'ecosystem', jsonb_build_object(
                   'public_carnet_count',
                     (select count(*) from public.carnets
                      where author_id = v_kit.user_id and visibility = 'public'),
                   'public_carnet_moment_count',
                     (select count(*) from public.carnet_moments cm
                      join public.carnets c on c.id = cm.carnet_id
                      where c.author_id = v_kit.user_id and c.visibility = 'public')
                 )
  ) into v_out;

  return v_out;
end;
$$;

revoke all on function public.get_kit_journal(uuid) from public, anon;
grant execute on function public.get_kit_journal(uuid) to authenticated;
