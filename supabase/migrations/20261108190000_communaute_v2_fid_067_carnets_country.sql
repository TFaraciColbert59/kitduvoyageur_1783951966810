-- ═══════════════════════════════════════════════════════════════════════════
-- FID-067 — Visa pays des carnets : `country_iso` exposé par le feed.
--
-- Contexte : la maquette (`maquette-communaute.html` L2321) affiche
-- « FR · 4 J · 62,4 KM » dans le visa de la tuile carnet. La colonne
-- `public.carnets.country_iso` existe (baseline prod 2026-09-11, index
-- `idx_carnets_country_iso`) et est déjà écrite par `create_carnet_v2`
-- (lot E), mais le feed ne la renvoyait pas : l'UI ne pouvait pas l'afficher.
--
-- Idempotence : colonne et index en `if not exists` ; la fonction est
-- recréée avec `drop function if exists` + `create`, seul moyen de changer
-- la liste `returns table` (PostgreSQL refuse `create or replace` quand le
-- type de retour change). Aucune donnée n'est touchée, les droits sont
-- immédiatement rétablis. Rollback : `migrations_down/…_fid_067….down.sql`.
-- Rien n'est appliqué en production (J-08). La migration ne dépend d'aucun
-- objet absent du dépôt : `carnets` et `country_iso` sont recréés au besoin.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Colonne pays (défensive : absente d'un rejeu complet du dépôt) ──────
alter table public.carnets
  add column if not exists country_iso text;

create index if not exists idx_carnets_country_iso
  on public.carnets (country_iso);

-- ── 2. Feed des carnets : `country_iso` ajouté au contrat ─────────────────
-- La normalisation (`upper(btrim(...))`) fige le format du visa (« FR ») ;
-- une valeur absente ou vide reste NULL et l'UI applique son repli.
drop function if exists public.community_carnets_feed(text, text, double precision, double precision, jsonb, integer);

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

comment on function public.community_carnets_feed(text, text, double precision, double precision, jsonb, integer) is
  'Communauté v2 — volet Carnets : pagination par curseur (clé, id), filtres discover/mine/followed/near, tri recent/popular/near/duration, compteurs serveur, liked_by_me, voyageurs, en direct, distance, pays (country_iso, normalisé en majuscules). RLS appliquée.';

revoke all on function public.community_carnets_feed(text, text, double precision, double precision, jsonb, integer) from public;
grant execute on function public.community_carnets_feed(text, text, double precision, double precision, jsonb, integer) to authenticated, anon, service_role;
