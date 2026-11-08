-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Communauté v2 — lot A : recherche tolérante (Recherche#9)
-- Phase 1 (ajouts purs : aucune fonction/trigger/contrainte existants modifiés).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Objectifs :
--   1. `lkdv_norm` : normalisation canonique (minuscules + accents retirés +
--      ponctuation remplacée par des espaces) ; c'est la clé des index trigram.
--   2. Index GIN trigram sur les expressions `lkdv_norm(colonne)` des colonnes
--      interrogées par la recherche de l'Explorer (aucun index `ilike` brut :
--      ils ne servent pas la normalisation).
--   3. `community_search` : une branche par type (carnet, club, sortie, post,
--      membre), `security invoker` (la RLS de chaque table s'applique : le
--      résultat est exactement ce que l'appelant peut lire), saisie échappée
--      (`%`, `_`, `\` ne sont jamais des jokers), tolérance aux fautes via
--      `%` (similarité trigram) bornée par un seuil local, distances PostGIS
--      quand lat/lng sont fournis, filtres `p_filters`.
--   4. `community_search_trending` : lieux et tags des 7 derniers jours, soumis
--      à la même RLS.
--
-- Dépendance douce : les distances et les lat/lng passent par `lkdv_geo_info`,
-- qui lit la colonne géographique *si elle existe* (`lkdv_has_column`). Ce lot
-- est donc appelable seul, avant le lot B (colonnes `start_geom`, `zone_geom`,
-- `location_geom`) : les distances valent alors `NULL`. Aucune référence
-- statique à une colonne d'un lot ultérieur n'est faite ici.
--
-- Aucun club `secret` n'est renvoyé à un non-membre : la politique `Public read
-- clubs` de la prod le filtre déjà (vérifié le 2026-11-08) ; la RLS s'applique
-- par construction puisque la fonction est `security invoker`.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Normalisation ───────────────────────────────────────────────────────
create or replace function public.lkdv_norm(t text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        public.unaccent_lower(coalesce(t, '')),
        '[[:punct:]]+', ' ', 'g'
      ),
      '\s+', ' ', 'g'
    )
  )
$$;

comment on function public.lkdv_norm(text) is
  'Communauté v2 : minuscules, accents retirés, ponctuation en espaces, espaces compactés. Base des index trigram et de la recherche tolérante.';

revoke all on function public.lkdv_norm(text) from public;
-- Exécutable par les rôles qui lisent/écrivent les tables indexées : les
-- expressions d'index sont évaluées avec les droits de la requête.
grant execute on function public.lkdv_norm(text) to authenticated, anon, service_role;

-- ── 2. Détection de colonne (pour les lots qui arrivent après) ─────────────
create or replace function public.lkdv_has_column(p_table text, p_column text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = p_table
       and a.attname = p_column
       and not a.attisdropped
  )
$$;

revoke all on function public.lkdv_has_column(text, text) from public;
grant execute on function public.lkdv_has_column(text, text) to authenticated, anon, service_role;

-- ── 3. Géolocalisation souple (NULL tant que le lot B n'a pas créé la colonne)
create or replace function public.lkdv_geo_info(
  p_kind text,
  p_id uuid,
  p_lng double precision default null,
  p_lat double precision default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_table text;
  v_column text;
  v_geography geography;
  v_lat double precision;
  v_lng double precision;
  v_distance double precision;
begin
  case p_kind
    when 'carnet' then v_table := 'carnets'; v_column := 'start_geom';
    when 'club'   then v_table := 'clubs';   v_column := 'zone_geom';
    when 'event'  then v_table := 'events';  v_column := 'location_geom';
    else return '{}'::jsonb;
  end case;

  if p_id is null or not public.lkdv_has_column(v_table, v_column) then
    return '{}'::jsonb;
  end if;

  execute format('select %I from public.%I where id = $1', v_column, v_table)
    into v_geography
    using p_id;

  if v_geography is null then
    return '{}'::jsonb;
  end if;

  v_lat := st_y(v_geography::geometry);
  v_lng := st_x(v_geography::geometry);

  if p_lat is not null and p_lng is not null then
    v_distance := st_distance(
      v_geography,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
    ) / 1000.0;
  end if;

  return jsonb_build_object(
    'lat', v_lat,
    'lng', v_lng,
    'distance_km', v_distance
  );
end;
$$;

comment on function public.lkdv_geo_info(text, uuid, double precision, double precision) is
  'Communauté v2 : lat/lng + distance (km) d''un objet, 100 % tolérant à l''absence des colonnes géographiques (lot B) et à la RLS (security invoker).';

revoke all on function public.lkdv_geo_info(text, uuid, double precision, double precision) from public;
grant execute on function public.lkdv_geo_info(text, uuid, double precision, double precision) to authenticated, anon, service_role;

-- ── 4. Index trigram (classe d'opérateurs qualifiée par le schéma réel) ────
-- `pg_trgm` vit dans `public` en production (vérifié) mais peut vivre dans
-- `extensions` ailleurs : on lit son schéma au lieu de le supposer.
do $$
declare
  v_schema text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_trgm') then
    if exists (select 1 from pg_namespace where nspname = 'extensions') then
      create extension if not exists pg_trgm with schema extensions;
    else
      create extension if not exists pg_trgm with schema public;
    end if;
  end if;

  select n.nspname into v_schema
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_trgm';

  execute format('create index if not exists idx_carnets_title_norm_trgm on public.carnets using gin (public.lkdv_norm(title) %I.gin_trgm_ops)', v_schema);
  execute format('create index if not exists idx_carnets_destination_norm_trgm on public.carnets using gin (public.lkdv_norm(destination) %I.gin_trgm_ops)', v_schema);
  execute format('create index if not exists idx_clubs_name_norm_trgm on public.clubs using gin (public.lkdv_norm(name) %I.gin_trgm_ops)', v_schema);
  execute format('create index if not exists idx_events_title_norm_trgm on public.events using gin (public.lkdv_norm(title) %I.gin_trgm_ops)', v_schema);
  execute format('create index if not exists idx_events_location_norm_trgm on public.events using gin (public.lkdv_norm(location) %I.gin_trgm_ops)', v_schema);
  execute format('create index if not exists idx_community_posts_content_norm_trgm on public.community_posts using gin (public.lkdv_norm(content) %I.gin_trgm_ops)', v_schema);
  execute format('create index if not exists idx_user_profiles_full_name_norm_trgm on public.user_profiles using gin (public.lkdv_norm(full_name) %I.gin_trgm_ops)', v_schema);
  execute format('create index if not exists idx_user_profiles_handle_norm_trgm on public.user_profiles using gin (public.lkdv_norm(handle) %I.gin_trgm_ops)', v_schema);
end
$$;

-- ── 5. Recherche ───────────────────────────────────────────────────────────
create or replace function public.community_search(
  p_q text,
  p_scope text default 'all',
  p_limit integer default 5,
  p_offset integer default 0,
  p_lat double precision default null,
  p_lng double precision default null,
  p_filters jsonb default '{}'::jsonb
)
returns table (
  kind text,
  id uuid,
  title text,
  subtitle text,
  cover text,
  href text,
  score real,
  lat double precision,
  lng double precision,
  distance_km double precision,
  starts_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_scope text := coalesce(nullif(btrim(p_scope), ''), 'all');
  v_limit integer := least(greatest(coalesce(p_limit, 5), 1), 30);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_norm text := public.lkdv_norm(coalesce(p_q, ''));
  v_pattern text;
  v_has_point boolean := p_lat is not null and p_lng is not null;
  v_filters jsonb := coalesce(p_filters, '{}'::jsonb);
  v_weekend boolean := coalesce((v_filters ->> 'weekend')::boolean, false);
  v_level text := nullif(btrim(coalesce(v_filters ->> 'level', '')), '');
  v_max_hours numeric := nullif(v_filters ->> 'max_hours', '')::numeric;
  v_near boolean := coalesce((v_filters ->> 'near')::boolean, false) and v_has_point;
  v_max_km numeric := coalesce(nullif(v_filters ->> 'max_km', '')::numeric, 100);
  v_uid uuid := (select auth.uid());
begin
  -- Requête de moins de 2 caractères normalisés : résultat vide, sans erreur.
  if length(v_norm) < 2 then
    return;
  end if;

  -- Échappement de la saisie : `%`, `_` et `\` restent des caractères.
  v_pattern := '%' || replace(replace(replace(v_norm, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  -- Seuil de similarité local à la transaction (jamais le réglage global).
  perform set_config('pg_trgm.similarity_threshold', '0.15', true);

  if v_scope not in ('all', 'posts', 'carnets', 'clubs', 'sorties', 'membres') then
    v_scope := 'all';
  end if;

  -- ── Carnets ───────────────────────────────────────────────────────────────
  if v_scope in ('all', 'carnets') then
    return query
      select
        'carnet'::text,
        c.id,
        c.title,
        coalesce(c.destination, ''),
        c.cover_image,
        '/carnets/' || c.id::text,
        greatest(
          similarity(public.lkdv_norm(c.title), v_norm),
          similarity(public.lkdv_norm(coalesce(c.destination, '')), v_norm)
        )::real,
        (g.info ->> 'lat')::double precision,
        (g.info ->> 'lng')::double precision,
        (g.info ->> 'distance_km')::double precision,
        null::timestamptz
      from public.carnets c
      left join lateral (
        select public.lkdv_geo_info('carnet', c.id, p_lng, p_lat) as info
      ) g on true
      where (
              public.lkdv_norm(c.title) like v_pattern escape '\'
              or public.lkdv_norm(coalesce(c.destination, '')) like v_pattern escape '\'
              or public.lkdv_norm(coalesce(c.description, '')) like v_pattern escape '\'
            )
        and (
              not v_weekend
              or (c.start_date is not null and extract(isodow from c.start_date) in (6, 7))
            )
        and (
              not v_near
              or coalesce((g.info ->> 'distance_km')::double precision, 1e9) <= v_max_km
            )
      order by
        greatest(
          similarity(public.lkdv_norm(c.title), v_norm),
          similarity(public.lkdv_norm(coalesce(c.destination, '')), v_norm)
        ) desc,
        (g.info ->> 'distance_km')::double precision asc nulls last,
        c.created_at desc
      limit v_limit offset v_offset;
  end if;

  -- ── Clubs ─────────────────────────────────────────────────────────────────
  if v_scope in ('all', 'clubs') then
    return query
      select
        'club'::text,
        c.id,
        c.name,
        coalesce(
          nullif(to_jsonb(c) ->> 'location_label', ''),
          nullif(c.category, ''),
          nullif(c.type, ''),
          ''
        ),
        c.cover_image,
        '/clubs/' || c.slug,
        greatest(
          similarity(public.lkdv_norm(c.name), v_norm),
          similarity(public.lkdv_norm(coalesce(c.description, '')), v_norm)
        )::real,
        (g.info ->> 'lat')::double precision,
        (g.info ->> 'lng')::double precision,
        (g.info ->> 'distance_km')::double precision,
        null::timestamptz
      from public.clubs c
      left join lateral (
        select public.lkdv_geo_info('club', c.id, p_lng, p_lat) as info
      ) g on true
      where (
              public.lkdv_norm(c.name) like v_pattern escape '\'
              or public.lkdv_norm(coalesce(c.description, '')) like v_pattern escape '\'
              or public.lkdv_norm(coalesce(c.category, '')) like v_pattern escape '\'
            )
        and (
              c.privacy is distinct from 'secret'
              or (v_uid is not null and exists (
                select 1 from public.club_members cm
                 where cm.club_id = c.id and cm.user_id = v_uid and cm.status = 'active'
              ))
            )
        and (
              not v_near
              or coalesce((g.info ->> 'distance_km')::double precision, 1e9) <= v_max_km
            )
      order by
        greatest(
          similarity(public.lkdv_norm(c.name), v_norm),
          similarity(public.lkdv_norm(coalesce(c.description, '')), v_norm)
        ) desc,
        (g.info ->> 'distance_km')::double precision asc nulls last,
        coalesce(c.members_count, 0) desc,
        c.id
      limit v_limit offset v_offset;
  end if;

  -- ── Sorties (events) ──────────────────────────────────────────────────────
  if v_scope in ('all', 'sorties') then
    return query
      select
        'sortie'::text,
        e.id,
        e.title,
        concat_ws(
          ' · ',
          nullif(e.location, ''),
          nullif(to_jsonb(e) ->> 'activity', ''),
          nullif(e.country, '')
        ),
        e.cover_image,
        '/sorties/' || e.id::text,
        similarity(public.lkdv_norm(e.title), v_norm)::real,
        (g.info ->> 'lat')::double precision,
        (g.info ->> 'lng')::double precision,
        (g.info ->> 'distance_km')::double precision,
        coalesce((to_jsonb(e) ->> 'starts_at')::timestamptz, e.event_date::timestamptz)
      from public.events e
      left join lateral (
        select public.lkdv_geo_info('event', e.id, p_lng, p_lat) as info
      ) g on true
      where (
              public.lkdv_norm(e.title) like v_pattern escape '\'
              or public.lkdv_norm(coalesce(e.location, '')) like v_pattern escape '\'
              or public.lkdv_norm(coalesce(e.description, '')) like v_pattern escape '\'
            )
        and coalesce(e.status, 'upcoming') <> 'cancelled'
        and (
              not v_weekend
              or extract(
                   isodow from coalesce((to_jsonb(e) ->> 'starts_at')::timestamptz, e.event_date::timestamptz)
                 ) in (6, 7)
            )
        and (
              v_level is null
              or (to_jsonb(e) ->> 'level') = v_level
            )
        and (
              v_max_hours is null
              or (to_jsonb(e) ->> 'starts_at') is null
              or (to_jsonb(e) ->> 'ends_at') is null
              or (
                extract(epoch from (
                  ((to_jsonb(e) ->> 'ends_at')::timestamptz - (to_jsonb(e) ->> 'starts_at')::timestamptz)
                )) / 3600.0
              ) <= v_max_hours
            )
        and (
              not v_near
              or coalesce((g.info ->> 'distance_km')::double precision, 1e9) <= v_max_km
            )
      order by
        similarity(public.lkdv_norm(e.title), v_norm) desc,
        (g.info ->> 'distance_km')::double precision asc nulls last,
        coalesce((to_jsonb(e) ->> 'starts_at')::timestamptz, e.event_date::timestamptz) asc
      limit v_limit offset v_offset;
  end if;

  -- ── Posts ─────────────────────────────────────────────────────────────────
  if v_scope in ('all', 'posts') then
    return query
      select
        'post'::text,
        p.id,
        coalesce(nullif(p.title, ''), left(btrim(p.content), 80)),
        coalesce(pp.full_name, ''),
        coalesce(nullif(p.image_url, ''), nullif(p.media_urls ->> 0, '')),
        '/communaute?post=' || p.id::text,
        similarity(public.lkdv_norm(p.content), v_norm)::real,
        null::double precision,
        null::double precision,
        null::double precision,
        p.created_at
      from public.community_posts p
      left join public.public_profiles pp on pp.id = p.author_id
      where (
              public.lkdv_norm(p.content) like v_pattern escape '\'
              or public.lkdv_norm(coalesce(p.title, '')) like v_pattern escape '\'
            )
        and (v_uid is null or not exists (
              select 1 from public.user_blocks b
               where (b.blocker_id = v_uid and b.blocked_id = p.author_id)
                  or (b.blocker_id = p.author_id and b.blocked_id = v_uid)
            ))
      order by
        similarity(public.lkdv_norm(p.content), v_norm) desc,
        p.created_at desc
      limit v_limit offset v_offset;
  end if;

  -- ── Membres ───────────────────────────────────────────────────────────────
  if v_scope in ('all', 'membres') then
    return query
      select
        'membre'::text,
        pp.id,
        coalesce(pp.full_name, ''),
        coalesce(nullif(pp.handle, ''), ''),
        pp.avatar_url,
        '/profil/' || coalesce(nullif(pp.handle, ''), pp.id::text),
        greatest(
          similarity(public.lkdv_norm(pp.full_name), v_norm),
          similarity(public.lkdv_norm(coalesce(pp.handle, '')), v_norm)
        )::real,
        null::double precision,
        null::double precision,
        null::double precision,
        null::timestamptz
      from public.public_profiles pp
      where (
              public.lkdv_norm(coalesce(pp.full_name, '')) like v_pattern escape '\'
              or public.lkdv_norm(coalesce(pp.handle, '')) like v_pattern escape '\'
            )
        and (v_uid is null or not exists (
              select 1 from public.user_blocks b
               where (b.blocker_id = v_uid and b.blocked_id = pp.id)
                  or (b.blocker_id = pp.id and b.blocked_id = v_uid)
            ))
      order by
        greatest(
          similarity(public.lkdv_norm(coalesce(pp.full_name, '')), v_norm),
          similarity(public.lkdv_norm(coalesce(pp.handle, '')), v_norm)
        ) desc,
        pp.full_name asc
      limit v_limit offset v_offset;
  end if;
end;
$$;

comment on function public.community_search(text, text, integer, integer, double precision, double precision, jsonb) is
  'Communauté v2 — Recherche#9 : recherche tolérante (accents, ponctuation, fautes) par branche, filtrée par la RLS (security invoker). Renvoie au plus p_limit (≤ 30) lignes par type.';

revoke all on function public.community_search(text, text, integer, integer, double precision, double precision, jsonb) from public;
grant execute on function public.community_search(text, text, integer, integer, double precision, double precision, jsonb) to authenticated, anon, service_role;

-- ── 6. Tendances de l'accueil recherche (Recherche#4) ──────────────────────
create or replace function public.community_search_trending(p_limit integer default 8)
returns table (kind text, label text, hits integer)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 8), 1), 20);
begin
  return query
    with recent as (
      select 'lieu'::text as kind, btrim(c.destination) as label
        from public.carnets c
       where c.created_at > now() - interval '7 days'
         and c.visibility = 'public'
         and btrim(coalesce(c.destination, '')) <> ''

      union all

      select 'lieu'::text, btrim(e.location)
        from public.events e
       where e.created_at > now() - interval '7 days'
         and coalesce(e.status, 'upcoming') <> 'cancelled'
         and btrim(coalesce(e.location, '')) <> ''

      union all

      select 'tag'::text, '#' || btrim(t.tag)
        from public.carnets c
        cross join lateral unnest(coalesce(c.tags, '{}'::text[])) as t(tag)
       where c.created_at > now() - interval '7 days'
         and c.visibility = 'public'
         and btrim(coalesce(t.tag, '')) <> ''
    )
    select r.kind, r.label, count(*)::integer as hits
      from recent r
     group by r.kind, r.label
     order by count(*) desc, r.label asc
     limit v_limit;
end;
$$;

comment on function public.community_search_trending(integer) is
  'Communauté v2 — Recherche#4 : lieux et tags des objets publics créés sur 7 jours, pondérés par leur fréquence ; RLS appliquée (security invoker).';

revoke all on function public.community_search_trending(integer) from public;
grant execute on function public.community_search_trending(integer) to authenticated, anon, service_role;
