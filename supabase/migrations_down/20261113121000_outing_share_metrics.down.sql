-- Rollback de S6.15 — stockage des choix de visibilité par métrique.
-- Version : 20261113121000.
--
-- La table ne contient que des booléens de partage. Sa suppression ne détruit
-- aucune trace, aucune métrique et aucune donnée de santé. On refuse toutefois
-- de la retirer si des choix réels existent : le propriétaire doit d'abord
-- réinitialiser ses réglages, afin qu'un rollback ne fasse pas disparaître
-- silencieusement une décision de confidentialité.
do $$
declare
  v_count bigint;
begin
  if to_regclass('public.outing_share_metrics') is not null then
    execute 'select count(*) from public.outing_share_metrics' into v_count;
    if v_count > 0 then
      raise exception 'Rollback refusé : public.outing_share_metrics contient des choix réels. Réinitialiser les réglages avant de retirer la fonctionnalité (S6.15).';
    end if;
  end if;
end $$;

-- La table emporte ses policies et ses triggers. On ne les supprime pas
-- séparément : un second passage du rollback resterait sinon bloqué par
-- l'absence de la table.
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
      r.distance_km,
      r.denivele_m,
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

revoke all on function public.community_carnets_feed(text, text, double precision, double precision, jsonb, integer) from public;
grant execute on function public.community_carnets_feed(text, text, double precision, double precision, jsonb, integer)
  to authenticated, anon, service_role;

create or replace function public.get_kit_journal(p_kit_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_kit  public.materiel_kits%rowtype;
  v_out  jsonb;
begin
  select * into v_kit from public.materiel_kits where id = p_kit_id;
  if not found then
    return null;
  end if;

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
                     round(coalesce((select sum(distance_km) from public.hike_sessions
                                     where kit_id = v_kit.id), 0)::numeric, 1),
                   'total_elevation_gain_m',
                     (select coalesce(sum(elevation_gain_m), 0) from public.hike_sessions
                      where kit_id = v_kit.id),
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

drop function if exists public.carnet_aggregate_elevation_m(uuid, integer, uuid);
drop function if exists public.carnet_aggregate_distance_km(uuid, numeric, uuid);
drop function if exists public.outing_session_metric_visible(uuid, uuid, text);

drop table if exists public.outing_share_metrics;

drop function if exists public.outing_share_metrics_guard();
drop function if exists public.outing_metric_visibility_is_valid(jsonb);
