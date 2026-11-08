-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Communauté v2 — lot B : listes paginées, compteurs serveur, « Près de moi »
-- Phase 1 (ajouts purs : colonnes nullables, index, nouvelles fonctions de lecture).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Contenu :
--   1. Colonnes géographiques additives (aucune recopie de masse : les objets
--      existants restent à NULL et sont simplement absents de « Près de moi ») :
--      `carnets.start_geom`, `clubs.zone_geom`/`zone_radius_km`,
--      `events.location_geom`/`meeting_geom`, + index GiST.
--   2. `lkdv_carnet_is_live` : lecture « en direct » tolérante à l'absence de
--      `carnets.live_sharing` (colonne du chantier carnet-v2, non appliquée en
--      prod au 2026-11-08) — renvoie `false` tant que la colonne manque.
--   3. RPC de lecture paginées par curseur `(clé_de_tri, id)` :
--        - community_carnets_feed
--        - community_clubs_feed
--        - community_events_feed
--        - community_events_agenda
--      Toutes `security invoker` : la RLS des tables s'applique, l'invité lit
--      ce que `anon` peut lire, et un non-membre ne voit ni club `secret` ni
--      carnet privé. `p_limit` est borné à 30. Les compteurs (`likes_count`,
--      `comments_count`) sont ceux tenus par les triggers existants ; jamais
--      de recalcul côté client.
--
-- Contrat de curseur (identique aux 3 feeds) :
--   - la ligne renvoyée expose `sort_key` (numeric) et `id` (uuid) ;
--   - curseur de la page suivante = `jsonb_build_object('v', sort_key, 'id', id)`
--     de la dernière ligne ; `p_cursor` = `NULL` pour la première page ;
--   - tri `desc` (carnets récents/populaires/durée, clubs activité/taille) :
--     `(sort_key, id) < (v, id)` ; tri `asc` (distance, date de sortie) :
--     `(sort_key, id) > (v, id)`. Aucun doublon, aucune ligne sautée tant que
--     les données ne bougent pas entre deux pages.
--
-- Dépendance : les RPC ci-dessous lisent des colonnes ajoutées par les lots C
-- (events.starts_at, event_participants.status…) et D (clubs.activities,
-- clubs.location_label). En plpgsql, le corps n'est résolu qu'à l'exécution :
-- la migration s'applique seule, mais les RPC ne doivent être appelées
-- qu'une fois la phase 1 complète (fichiers 130001 → 130006).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Colonnes géographiques additives ────────────────────────────────────
alter table public.carnets
  add column if not exists start_geom geography(Point, 4326);

alter table public.clubs
  add column if not exists zone_geom geography(Point, 4326),
  add column if not exists zone_radius_km numeric;

alter table public.events
  add column if not exists location_geom geography(Point, 4326),
  add column if not exists meeting_geom geography(Point, 4326);

-- Rayon de zone d'un club : 1 à 500 km, NULL = 50 km par défaut dans les feeds.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'clubs_zone_radius_km_check'
       and conrelid = 'public.clubs'::regclass
  ) then
    alter table public.clubs
      add constraint clubs_zone_radius_km_check
      check (zone_radius_km is null or zone_radius_km between 1 and 500);
  end if;
end
$$;

create index if not exists idx_carnets_start_geom on public.carnets using gist (start_geom);
create index if not exists idx_clubs_zone_geom on public.clubs using gist (zone_geom);
create index if not exists idx_events_location_geom on public.events using gist (location_geom);
create index if not exists idx_events_meeting_geom on public.events using gist (meeting_geom);

-- ── 2. Lecture « en direct » tolérante à l'absence de live_sharing ─────────
create or replace function public.lkdv_carnet_is_live(p_carnet uuid)
returns boolean
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_live boolean := false;
begin
  if p_carnet is null or not public.lkdv_has_column('carnets', 'live_sharing') then
    return false;
  end if;

  execute 'select coalesce(live_sharing, false) from public.carnets where id = $1'
    into v_live
    using p_carnet;

  return coalesce(v_live, false);
end;
$$;

comment on function public.lkdv_carnet_is_live(uuid) is
  'Communauté v2 : état « en direct » d''un carnet. Renvoie false tant que la colonne carnets.live_sharing (chantier carnet-v2) n''est pas appliquée en base. RLS appliquée (security invoker).';

revoke all on function public.lkdv_carnet_is_live(uuid) from public;
grant execute on function public.lkdv_carnet_is_live(uuid) to authenticated, anon, service_role;

-- ── 3. Feed des carnets ────────────────────────────────────────────────────
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
  'Communauté v2 — volet Carnets : pagination par curseur (clé, id), filtres discover/mine/followed/near, tri recent/popular/near/duration, compteurs serveur, liked_by_me, voyageurs, en direct, distance. RLS appliquée.';

revoke all on function public.community_carnets_feed(text, text, double precision, double precision, jsonb, integer) from public;
grant execute on function public.community_carnets_feed(text, text, double precision, double precision, jsonb, integer) to authenticated, anon, service_role;

-- ── 4. Feed des clubs ──────────────────────────────────────────────────────
create or replace function public.community_clubs_feed(
  p_filter text default 'discover',
  p_sort text default 'activity',
  p_activity text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_cursor jsonb default null,
  p_limit integer default 12
)
returns table (
  id uuid,
  slug text,
  name text,
  emoji text,
  privacy text,
  cover_image text,
  cover_color text,
  category text,
  activities text[],
  location_label text,
  members_count integer,
  is_verified boolean,
  my_status text,
  events_this_month integer,
  last_post_at timestamptz,
  friends jsonb,
  lat double precision,
  lng double precision,
  distance_km double precision,
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
    when p_filter in ('discover', 'mine', 'near') then p_filter
    else 'discover'
  end;
  v_sort text := case
    when p_sort in ('activity', 'near', 'size') then p_sort
    else 'activity'
  end;
  v_activity text := nullif(btrim(coalesce(p_activity, '')), '');
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
        (
          select max(cp.created_at)
            from public.community_posts cp
           where cp.club_id = c.id
        ) as last_post_at,
        (
          select count(*)::integer
            from public.events e
           where e.club_id = c.id
             and coalesce(e.starts_at, e.event_date::timestamptz) >= date_trunc('month', now())
             and coalesce(e.starts_at, e.event_date::timestamptz) < date_trunc('month', now()) + interval '1 month'
        ) as events_this_month,
        case
          when v_pt is not null and c.zone_geom is not null
            then st_distance(c.zone_geom, v_pt) / 1000.0
        end as distance_from_me
      from public.clubs c
      where (
              c.privacy is distinct from 'secret'
              or (
                v_uid is not null
                and exists (
                  select 1 from public.club_members cm
                   where cm.club_id = c.id and cm.user_id = v_uid and cm.status = 'active'
                )
              )
            )
        and (
              v_filter = 'discover'
              or (v_filter = 'mine' and v_uid is not null and exists (
                    select 1 from public.club_members cm
                     where cm.club_id = c.id and cm.user_id = v_uid and cm.status = 'active'
                  ))
              or (
                v_filter = 'near'
                and c.zone_geom is not null
                and v_pt is not null
                and st_dwithin(c.zone_geom, v_pt, coalesce(c.zone_radius_km, 50)::double precision * 1000.0)
              )
            )
        and (
              v_activity is null
              or v_activity = any(coalesce(c.activities, '{}'::text[]))
              or lower(coalesce(c.category, '')) = lower(v_activity)
              or lower(coalesce(c.type, '')) = lower(v_activity)
            )
    ),
    ranked as (
      select
        b.*,
        case v_sort
          when 'size' then coalesce(b.members_count, 0)::numeric
          when 'near' then coalesce(b.distance_from_me, 1e9)::numeric
          else extract(epoch from coalesce(b.last_post_at, b.updated_at, b.created_at))::numeric
        end as sort_key
      from base b
    )
    select
      r.id,
      r.slug,
      r.name,
      r.emoji,
      r.privacy,
      r.cover_image,
      r.cover_color,
      r.category,
      coalesce(r.activities, '{}'::text[]),
      r.location_label,
      coalesce(r.members_count, 0),
      coalesce(r.is_verified, false),
      case
        when v_uid is null then 'none'
        when exists (
          select 1 from public.club_members cm
           where cm.club_id = r.id and cm.user_id = v_uid and cm.status = 'active' and cm.role = 'admin'
        ) then 'admin'
        when exists (
          select 1 from public.club_members cm
           where cm.club_id = r.id and cm.user_id = v_uid and cm.status = 'active'
        ) then 'member'
        when exists (
          select 1 from public.club_join_requests jr
           where jr.club_id = r.id and jr.user_id = v_uid and jr.status = 'pending'
        ) then 'pending'
        else 'none'
      end,
      coalesce(r.events_this_month, 0),
      r.last_post_at,
      jsonb_build_object(
        'total', (
          select count(*)
            from public.club_members cm
            join public.user_follows f
              on f.following_id = cm.user_id and f.follower_id = v_uid
           where cm.club_id = r.id and cm.status = 'active'
        ),
        'avatars', coalesce((
          select jsonb_agg(
                   jsonb_build_object('id', a.uid, 'name', a.name, 'avatar', a.avatar)
                   order by a.name
                 )
            from (
              select
                cm.user_id as uid,
                coalesce(pp2.full_name, '') as name,
                pp2.avatar_url as avatar
                from public.club_members cm
                join public.user_follows f
                  on f.following_id = cm.user_id and f.follower_id = v_uid
                left join public.public_profiles pp2 on pp2.id = cm.user_id
               where cm.club_id = r.id and cm.status = 'active'
               order by pp2.full_name
               limit 3
            ) a
        ), '[]'::jsonb)
      ),
      case when r.zone_geom is not null then st_y(r.zone_geom::geometry) end,
      case when r.zone_geom is not null then st_x(r.zone_geom::geometry) end,
      r.distance_from_me,
      r.sort_key
    from ranked r
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

comment on function public.community_clubs_feed(text, text, text, double precision, double precision, jsonb, integer) is
  'Communauté v2 — volet Clubs : pagination par curseur, filtres discover/mine/near + chip d''activité, tri activity/near/size, my_status, événements du mois, amis membres, distance. Clubs secret jamais renvoyés à un non-membre. RLS appliquée.';

revoke all on function public.community_clubs_feed(text, text, text, double precision, double precision, jsonb, integer) from public;
grant execute on function public.community_clubs_feed(text, text, text, double precision, double precision, jsonb, integer) to authenticated, anon, service_role;

-- ── 5. Feed des sorties ────────────────────────────────────────────────────
create or replace function public.community_events_feed(
  p_filter text default 'discover',
  p_day date default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_cursor jsonb default null,
  p_limit integer default 12
)
returns table (
  id uuid,
  title text,
  activity text,
  emoji text,
  organizer_id uuid,
  organizer_name text,
  organizer_avatar text,
  event_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  meeting_point text,
  level text,
  route_distance_km numeric,
  elevation_gain_m integer,
  max_participants integer,
  current_participants integer,
  spots_left integer,
  waitlist_enabled boolean,
  status text,
  cover_image text,
  my_status text,
  friends jsonb,
  lat double precision,
  lng double precision,
  distance_km double precision,
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
    when p_filter in ('discover', 'mine', 'near') then p_filter
    else 'discover'
  end;
  v_limit integer := least(greatest(coalesce(p_limit, 12), 1), 30);
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
        e.*,
        coalesce(e.starts_at, e.event_date::timestamptz) as effective_start,
        case
          when v_pt is not null and e.location_geom is not null
            then st_distance(e.location_geom, v_pt) / 1000.0
        end as distance_from_me
      from public.events e
      where coalesce(e.status, 'upcoming') <> 'cancelled'
        and (
              (
                v_filter = 'discover'
                and coalesce(e.status, 'upcoming') in ('upcoming', 'full')
                and coalesce(e.starts_at, e.event_date::timestamptz)::date >= current_date
              )
              or (
                v_filter = 'mine'
                and v_uid is not null
                and (
                  e.organizer_id = v_uid
                  or exists (
                    select 1 from public.event_participants ep
                     where ep.event_id = e.id and ep.user_id = v_uid
                  )
                )
              )
              or (
                v_filter = 'near'
                and e.location_geom is not null
                and v_pt is not null
                and st_dwithin(e.location_geom, v_pt, 100000)
              )
            )
        and (p_day is null or coalesce(e.starts_at, e.event_date::timestamptz)::date = p_day)
    ),
    ranked as (
      select
        b.*,
        extract(epoch from b.effective_start)::numeric as sort_key
      from base b
    )
    select
      r.id,
      r.title,
      coalesce(nullif(r.activity, ''), nullif(r.type, ''), ''),
      r.emoji,
      r.organizer_id,
      coalesce(pp.full_name, ''),
      pp.avatar_url,
      r.event_date,
      r.starts_at,
      r.ends_at,
      r.location,
      r.meeting_point,
      r.level,
      r.distance_km,
      r.elevation_gain_m,
      coalesce(r.max_participants, 0),
      coalesce(r.current_participants, 0),
      case
        when coalesce(r.max_participants, 0) = 0 then null
        else greatest(coalesce(r.max_participants, 0) - coalesce(r.current_participants, 0), 0)
      end,
      coalesce(r.waitlist_enabled, false),
      coalesce(r.status, 'upcoming'),
      r.cover_image,
      case
        when v_uid is null then 'none'
        when exists (
          select 1 from public.event_participants ep
           where ep.event_id = r.id and ep.user_id = v_uid and ep.status = 'waitlist'
        ) then 'waitlist'
        when exists (
          select 1 from public.event_participants ep
           where ep.event_id = r.id and ep.user_id = v_uid and ep.status = 'confirmed'
        ) then 'registered'
        when r.organizer_id = v_uid then 'registered'
        else 'none'
      end,
      jsonb_build_object(
        'total', (
          select count(*)
            from public.event_participants ep
            join public.user_follows f
              on f.following_id = ep.user_id and f.follower_id = v_uid
           where ep.event_id = r.id and ep.status = 'confirmed'
        ),
        'avatars', coalesce((
          select jsonb_agg(
                   jsonb_build_object('id', a.uid, 'name', a.name, 'avatar', a.avatar)
                   order by a.name
                 )
            from (
              select
                ep.user_id as uid,
                coalesce(pp2.full_name, '') as name,
                pp2.avatar_url as avatar
                from public.event_participants ep
                join public.user_follows f
                  on f.following_id = ep.user_id and f.follower_id = v_uid
                left join public.public_profiles pp2 on pp2.id = ep.user_id
               where ep.event_id = r.id and ep.status = 'confirmed'
               order by pp2.full_name
               limit 3
            ) a
        ), '[]'::jsonb)
      ),
      case when r.location_geom is not null then st_y(r.location_geom::geometry) end,
      case when r.location_geom is not null then st_x(r.location_geom::geometry) end,
      r.distance_from_me,
      r.sort_key
    from ranked r
    left join public.public_profiles pp on pp.id = r.organizer_id
    where (
      v_cursor_key is null
      or (r.sort_key > v_cursor_key or (r.sort_key = v_cursor_key and r.id > v_cursor_id))
    )
    order by r.sort_key asc nulls last, r.id asc
    limit v_limit;
end;
$$;

comment on function public.community_events_feed(text, date, double precision, double precision, jsonb, integer) is
  'Communauté v2 — volet Sorties : pagination par curseur chronologique, filtres discover/mine/near, jour p_day, my_status (registered/waitlist), places restantes, amis inscrits, distance. RLS appliquée.';

revoke all on function public.community_events_feed(text, date, double precision, double precision, jsonb, integer) from public;
grant execute on function public.community_events_feed(text, date, double precision, double precision, jsonb, integer) to authenticated, anon, service_role;

-- ── 6. Agenda 14 jours ─────────────────────────────────────────────────────
create or replace function public.community_events_agenda(
  p_from date default null,
  p_days integer default 14
)
returns table (day date, events_count integer)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_start date := coalesce(p_from, current_date);
  v_days integer := least(greatest(coalesce(p_days, 14), 1), 60);
begin
  return query
    with days as (
      select generate_series(v_start, v_start + (v_days - 1), interval '1 day')::date as day
    )
    select d.day, count(e.id)::integer
      from days d
      left join public.events e
        on coalesce(e.starts_at, e.event_date::timestamptz)::date = d.day
       and coalesce(e.status, 'upcoming') in ('upcoming', 'full')
     group by d.day
     order by d.day;
end;
$$;

comment on function public.community_events_agenda(date, integer) is
  'Communauté v2 — bande agenda du volet Sorties : nombre de sorties publiques par jour sur p_days (≤ 60) jours à partir de p_from. RLS appliquée.';

revoke all on function public.community_events_agenda(date, integer) from public;
grant execute on function public.community_events_agenda(date, integer) to authenticated, anon, service_role;
