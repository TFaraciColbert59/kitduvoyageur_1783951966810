-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Communauté v2 — lot E : créations atomiques (RPC) + idempotence
-- Phase 1 (ajouts purs : colonnes nullables, index partiels, nouvelles fonctions).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Constat prod (2026-11-08) : aucune création n'est atomique — les 6
-- formulaires v1 enchaînent des `insert` clients séquentiels, les posts
-- « pont » échouent dans des try/catch muets, et `community_posts.creation_meta`
-- n'existe pas en prod (migration 20261026130000 absente du registre).
--
-- Ce lot fournit :
--   - les colonnes d'idempotence `client_request_id` (+ index uniques partiels
--     sur l'auteur, pour rejouer un envoi sans doublon) ;
--   - les colonnes de lieu/tags du post et `creation_meta` (idempotent) ;
--   - `check_club_slug` (lecture, `security invoker`, ouverte à anon) ;
--   - les RPC `security definer` : create_club_with_admin, create_event_with_post,
--     create_kit_with_items, create_carnet_v2, create_community_post.
--
-- Garanties communes :
--   * `auth.uid()` non nul et non anonyme (`lkdv_require_actor`, lot D) ;
--   * une seule transaction : la moindre erreur annule tout (aucun objet
--     orphelin, aucun post « pont » à moitié créé) ;
--   * `p_client_request_id` : même valeur → même résultat (`idempotent: true`),
--     garanti par un index unique + relecture, y compris en cas de course
--     (handler `unique_violation`) ;
--   * erreurs applicatives au format JSON `{code, message, field?}` lisible par
--     l'UI (SQLSTATE P0001 ; 42501 pour l'identité) ;
--   * validation longueurs/énumérations côté serveur (mêmes règles que les
--     schémas zod du moteur de création V2) ;
--   * post « pont » uniquement si l'objet est public (les triggers existants
--     refusent un post non public avec média/lien) ;
--   * les téléversements Storage restent côté client AVANT l'appel : les RPC
--     reçoivent des chemins et ne suppriment rien (le client nettoie en cas
--     d'échec, comme la story).
--
-- Dépendances : lot C (colonnes events, event_participants.status), lot D
-- (clubs.rules/join_questions/activities/location_label, helpers lkdv_*) et
-- lot B (colonnes géographiques : `start_geom`, `location_geom`). Les RPC ne
-- doivent être appelées qu'une fois la phase 1 complète (130001 → 130006).
-- `carnet_nights` est écrite **seulement si la table existe** (chantier
-- carnet-v2 non appliqué en prod au 2026-11-08) — SQL dynamique borné.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Helpers de validation (internes aux RPC, non exposés au client) ─────
create or replace function public.lkdv_slugify(p_text text)
returns text
language sql
immutable
parallel safe
security invoker
set search_path = public
as $$
  select btrim(
    regexp_replace(
      lower(public.unaccent_lower(coalesce(p_text, ''))),
      '[^a-z0-9]+', '-', 'g'
    ),
    '-'
  )
$$;

revoke all on function public.lkdv_slugify(text) from public;
revoke all on function public.lkdv_slugify(text) from anon, authenticated;

create or replace function public.lkdv_json_text_array(p_value jsonb)
returns text[]
language sql
immutable
parallel safe
security invoker
set search_path = public
as $$
  select case
    when p_value is null or jsonb_typeof(p_value) <> 'array' then '{}'::text[]
    else coalesce(
      array(select jsonb_array_elements_text(p_value)),
      '{}'::text[]
    )
  end
$$;

revoke all on function public.lkdv_json_text_array(jsonb) from public;
revoke all on function public.lkdv_json_text_array(jsonb) from anon, authenticated;

create or replace function public.lkdv_json_uuid_array(p_value jsonb)
returns uuid[]
language sql
immutable
parallel safe
security invoker
set search_path = public
as $$
  select case
    when p_value is null or jsonb_typeof(p_value) <> 'array' then '{}'::uuid[]
    else coalesce(
      array(
        select s.value::uuid
          from (
            select t.value
              from jsonb_array_elements_text(p_value) as t(value)
             where t.value ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
          ) s
      ),
      '{}'::uuid[]
    )
  end
$$;

revoke all on function public.lkdv_json_uuid_array(jsonb) from public;
revoke all on function public.lkdv_json_uuid_array(jsonb) from anon, authenticated;

create or replace function public.lkdv_bool(p_value jsonb, p_key text)
returns boolean
language sql
immutable
parallel safe
security invoker
set search_path = public
as $$
  select case lower(coalesce(p_value ->> p_key, ''))
    when 'true' then true
    when 't' then true
    when '1' then true
    when 'on' then true
    else false
  end
$$;

revoke all on function public.lkdv_bool(jsonb, text) from public;
revoke all on function public.lkdv_bool(jsonb, text) from anon, authenticated;

create or replace function public.lkdv_num(p_value jsonb, p_key text)
returns numeric
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_raw text := nullif(btrim(coalesce(p_value ->> p_key, '')), '');
begin
  if v_raw is null then
    return null;
  end if;
  if v_raw !~ '^-?[0-9]+(\.[0-9]+)?$' then
    perform public.lkdv_raise('validation_failed', 'Valeur numérique invalide.', p_key);
  end if;
  return v_raw::numeric;
end;
$$;

revoke all on function public.lkdv_num(jsonb, text) from public;
revoke all on function public.lkdv_num(jsonb, text) from anon, authenticated;

create or replace function public.lkdv_int(p_value jsonb, p_key text)
returns integer
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_num numeric := public.lkdv_num(p_value, p_key);
begin
  if v_num is null then
    return null;
  end if;
  if v_num <> trunc(v_num) then
    perform public.lkdv_raise('validation_failed', 'Nombre entier attendu.', p_key);
  end if;
  return v_num::integer;
end;
$$;

revoke all on function public.lkdv_int(jsonb, text) from public;
revoke all on function public.lkdv_int(jsonb, text) from anon, authenticated;

create or replace function public.lkdv_uuid(p_value jsonb, p_key text)
returns uuid
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_raw text := nullif(btrim(coalesce(p_value ->> p_key, '')), '');
begin
  if v_raw is null then
    return null;
  end if;
  if v_raw !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    perform public.lkdv_raise('validation_failed', 'Identifiant invalide.', p_key);
  end if;
  return v_raw::uuid;
end;
$$;

revoke all on function public.lkdv_uuid(jsonb, text) from public;
revoke all on function public.lkdv_uuid(jsonb, text) from anon, authenticated;

create or replace function public.lkdv_timestamptz(p_value jsonb, p_key text)
returns timestamptz
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_raw text := nullif(btrim(coalesce(p_value ->> p_key, '')), '');
begin
  if v_raw is null then
    return null;
  end if;
  begin
    return v_raw::timestamptz;
  exception
    when others then
      perform public.lkdv_raise('validation_failed', 'Date ou heure invalide.', p_key);
  end;
end;
$$;

revoke all on function public.lkdv_timestamptz(jsonb, text) from public;
revoke all on function public.lkdv_timestamptz(jsonb, text) from anon, authenticated;

create or replace function public.lkdv_date(p_value jsonb, p_key text)
returns date
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_raw text := nullif(btrim(coalesce(p_value ->> p_key, '')), '');
begin
  if v_raw is null then
    return null;
  end if;
  begin
    return v_raw::date;
  exception
    when others then
      perform public.lkdv_raise('validation_failed', 'Date invalide.', p_key);
  end;
end;
$$;

revoke all on function public.lkdv_date(jsonb, text) from public;
revoke all on function public.lkdv_date(jsonb, text) from anon, authenticated;

-- ── 2. Colonnes d'idempotence (aucune donnée existante touchée) ────────────
alter table public.clubs add column if not exists client_request_id text;
alter table public.events add column if not exists client_request_id text;
alter table public.materiel_kits add column if not exists client_request_id text;
alter table public.carnets add column if not exists client_request_id text;

create unique index if not exists uq_clubs_client_req
  on public.clubs (created_by, client_request_id)
  where client_request_id is not null;
create unique index if not exists uq_events_client_req
  on public.events (organizer_id, client_request_id)
  where client_request_id is not null;
create unique index if not exists uq_kits_client_req
  on public.materiel_kits (user_id, client_request_id)
  where client_request_id is not null;
create unique index if not exists uq_carnets_client_req
  on public.carnets (author_id, client_request_id)
  where client_request_id is not null;

-- ── 3. Colonnes du post : lieu, tags, métadonnées de création ──────────────
alter table public.community_posts
  add column if not exists place_label text
    check (place_label is null or char_length(place_label) <= 120),
  add column if not exists place_geom geography(Point, 4326),
  add column if not exists tags text[] not null default '{}'
    check (cardinality(tags) <= 10);

-- `creation_meta` est créée par la migration 20261026130000 dans certains
-- environnements (CI), absente en prod au 2026-11-08 : `if not exists`.
alter table public.community_posts
  add column if not exists creation_meta jsonb;

create index if not exists idx_community_posts_tags
  on public.community_posts using gin (tags);
create index if not exists idx_community_posts_place_geom
  on public.community_posts using gist (place_geom);

comment on column public.community_posts.place_label is
  'Communauté v2 — libellé du lieu du post (saisi, ≤ 120), affiché sur la tuile.';
comment on column public.community_posts.place_geom is
  'Communauté v2 — point géographique du post (facultatif, jamais exposé brut : distance seulement).';
comment on column public.community_posts.tags is
  'Communauté v2 — jusqu''à 10 tags de post (GIN).';
comment on column public.community_posts.creation_meta is
  'Communauté v2 — options de création structurées (type de pont, media_alts, lieu, event_id/kit_id…). Le trigger snapshot_community_post_carnet ne touche pas cette colonne.';

-- ── 4. Disponibilité d'un slug de club (lecture, invoker) ──────────────────
create or replace function public.check_club_slug(p_slug text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select case
    when btrim(coalesce(p_slug, '')) = '' then false
    when btrim(p_slug) !~ '^[a-z0-9][a-z0-9-]{1,59}$' then false
    else not exists (
      select 1 from public.clubs
       where lower(slug) = lower(btrim(p_slug))
    )
  end
$$;

comment on function public.check_club_slug(text) is
  'Communauté v2 — Club#5 : vrai si le slug est syntaxiquement valide et libre. Lecture seule, security invoker (open à anon) ; un club secret invisible par RLS est rattrapé par uq/clubs_slug_key à la création (erreur slug_taken).';

revoke all on function public.check_club_slug(text) from public;
grant execute on function public.check_club_slug(text) to authenticated, anon, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. create_club_with_admin
-- p : {name*, slug?, privacy ('open'|'closed', défaut 'open'), type?,
--      emoji?, description?, category?, cover_image?, cover_color?,
--      country_iso?, rules?, location_label?, activities?: string[],
--      join_questions?: string[≤3], welcome_post?: bool,
--      welcome_post_content?, client_request_id?}
-- Retour : {id, slug, privacy, post_id|null, members_count, idempotent}
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.create_club_with_admin(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.lkdv_require_actor();
  v_req text;
  v_name text;
  v_slug text;
  v_privacy text;
  v_type text;
  v_emoji text;
  v_description text;
  v_category text;
  v_cover_image text;
  v_cover_color text;
  v_country text;
  v_rules text;
  v_location text;
  v_join_questions jsonb;
  v_activities text[];
  v_welcome boolean;
  v_welcome_content text;
  v_club_id uuid;
  v_post_id uuid;
  v_existing_id uuid;
  v_existing_slug text;
  v_constraint text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    perform public.lkdv_raise('validation_failed', 'Données de création manquantes.');
  end if;

  v_req := nullif(btrim(coalesce(p ->> 'client_request_id', '')), '');
  if char_length(coalesce(v_req, '')) > 200 then
    perform public.lkdv_raise('validation_failed', 'Identifiant de requête trop long.', 'client_request_id');
  end if;

  -- Idempotence : un envoi rejoué ne crée pas un second club.
  if v_req is not null then
    select id, slug into v_existing_id, v_existing_slug
      from public.clubs
     where created_by = v_uid and client_request_id = v_req;
    if found then
      return jsonb_build_object('id', v_existing_id, 'slug', v_existing_slug, 'idempotent', true);
    end if;
  end if;

  v_name := btrim(coalesce(p ->> 'name', ''));
  if v_name = '' then
    perform public.lkdv_raise('validation_failed', 'Le nom du club est requis.', 'name');
  end if;
  if char_length(v_name) > 80 then
    perform public.lkdv_raise('validation_failed', 'Le nom du club est trop long (80 caractères).', 'name');
  end if;

  v_privacy := coalesce(nullif(btrim(coalesce(p ->> 'privacy', '')), ''), 'open');
  if v_privacy not in ('open', 'closed') then
    perform public.lkdv_raise('validation_failed', 'Choisis un mode d''adhésion valide.', 'privacy');
  end if;

  v_type := coalesce(nullif(btrim(coalesce(p ->> 'type', '')), ''), 'activite');
  v_emoji := nullif(btrim(coalesce(p ->> 'emoji', '')), '');
  v_description := nullif(btrim(coalesce(p ->> 'description', '')), '');
  v_category := nullif(btrim(coalesce(p ->> 'category', '')), '');
  v_cover_image := nullif(btrim(coalesce(p ->> 'cover_image', '')), '');
  v_cover_color := nullif(btrim(coalesce(p ->> 'cover_color', '')), '');
  v_country := nullif(btrim(coalesce(p ->> 'country_iso', '')), '');
  v_rules := nullif(btrim(coalesce(p ->> 'rules', '')), '');
  v_location := nullif(btrim(coalesce(p ->> 'location_label', '')), '');

  if char_length(coalesce(v_description, '')) > 2000 then
    perform public.lkdv_raise('validation_failed', 'La description est trop longue (2000 caractères).', 'description');
  end if;
  if char_length(coalesce(v_rules, '')) > 1000 then
    perform public.lkdv_raise('validation_failed', 'Le règlement est trop long (1000 caractères).', 'rules');
  end if;
  if char_length(coalesce(v_location, '')) > 120 then
    perform public.lkdv_raise('validation_failed', 'Le lieu est trop long (120 caractères).', 'location_label');
  end if;
  if char_length(coalesce(v_cover_image, '')) > 2048 then
    perform public.lkdv_raise('validation_failed', 'Adresse d''image invalide.', 'cover_image');
  end if;

  v_activities := public.lkdv_json_text_array(p -> 'activities');
  if cardinality(v_activities) > 10 then
    perform public.lkdv_raise('validation_failed', 'Dix activités au maximum.', 'activities');
  end if;
  if exists (select 1 from unnest(v_activities) a where char_length(coalesce(a, '')) > 40) then
    perform public.lkdv_raise('validation_failed', 'Une activité est trop longue (40 caractères).', 'activities');
  end if;

  v_join_questions := case
    when p ? 'join_questions' and jsonb_typeof(p -> 'join_questions') = 'array'
      then p -> 'join_questions'
    else '[]'::jsonb
  end;
  if jsonb_array_length(v_join_questions) > 3 then
    perform public.lkdv_raise('validation_failed', 'Trois questions d''adhésion au maximum.', 'join_questions');
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(v_join_questions) q
     where char_length(coalesce(q, '')) > 200
  ) then
    perform public.lkdv_raise('validation_failed', 'Une question est trop longue (200 caractères).', 'join_questions');
  end if;

  v_slug := public.lkdv_slugify(coalesce(p ->> 'slug', ''));
  if v_slug = '' then
    v_slug := public.lkdv_slugify(v_name);
  end if;
  if v_slug = '' then
    v_slug := 'club';
  end if;
  v_slug := left(v_slug, 60);

  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,59}$' then
    perform public.lkdv_raise('validation_failed', 'Le lien du club est invalide.', 'slug');
  end if;
  if exists (select 1 from public.clubs where lower(slug) = v_slug) then
    perform public.lkdv_raise('slug_taken', 'Ce lien de club est déjà pris.', 'slug');
  end if;

  insert into public.clubs (
    slug, name, type, emoji, description, cover_color, cover_image, category,
    privacy, members_count, active_this_month, is_verified, created_by, country_iso,
    rules, join_questions, activities, location_label, client_request_id
  ) values (
    v_slug, v_name, v_type, v_emoji, v_description, v_cover_color, v_cover_image, v_category,
    v_privacy, 0, 0, false, v_uid, v_country,
    v_rules, v_join_questions, v_activities, v_location, v_req
  )
  returning id into v_club_id;

  insert into public.club_members (club_id, user_id, role, status)
  values (v_club_id, v_uid, 'admin', 'active');

  perform public.lkdv_recount_club_members(v_club_id);

  -- Post de bienvenue : uniquement club ouvert ET explicitement demandé.
  v_welcome := public.lkdv_bool(p, 'welcome_post');
  if v_welcome and v_privacy = 'open' then
    v_welcome_content := coalesce(
      nullif(btrim(coalesce(p ->> 'welcome_post_content', '')), ''),
      'Bienvenue dans ' || v_name || ' !'
    );
    if char_length(v_welcome_content) > 20000 then
      perform public.lkdv_raise('validation_failed', 'Le message de bienvenue est trop long.', 'welcome_post_content');
    end if;

    insert into public.community_posts (author_id, content, post_type, audience, club_id, creation_meta)
    values (
      v_uid, v_welcome_content, 'post', 'club', v_club_id,
      jsonb_build_object('created_from', 'create_club_with_admin', 'club_slug', v_slug)
    )
    returning id into v_post_id;
  end if;

  return jsonb_build_object(
    'id', v_club_id,
    'slug', v_slug,
    'privacy', v_privacy,
    'post_id', v_post_id,
    'members_count', 1,
    'idempotent', false
  );
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'uq_clubs_client_req' and v_req is not null then
      select id, slug into v_existing_id, v_existing_slug
        from public.clubs
       where created_by = v_uid and client_request_id = v_req;
      if found then
        return jsonb_build_object('id', v_existing_id, 'slug', v_existing_slug, 'idempotent', true);
      end if;
    end if;
    if v_constraint = 'clubs_slug_key' then
      perform public.lkdv_raise('slug_taken', 'Ce lien de club est déjà pris.', 'slug');
    end if;
    raise;
end;
$$;

comment on function public.create_club_with_admin(jsonb) is
  'Communauté v2 — Clubs#15 : club + adhésion admin dans une seule transaction, slug vérifié (slug_taken), post de bienvenue optionnel si open, idempotence client_request_id.';

revoke all on function public.create_club_with_admin(jsonb) from public;
grant execute on function public.create_club_with_admin(jsonb) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. create_event_with_post
-- p : {title*, starts_at*, ends_at?, event_date?, activity?, type?, emoji?,
--      description?, location?, country?, location_lat?, location_lng?,
--      meeting_point?, meeting_lat?, meeting_lng?, level?,
--      distance_km?, elevation_gain_m?, max_participants?, waitlist_enabled?,
--      safety_notes?, safety_checklist?: string[], recurrence?,
--      club_id?, kit_id?, cover_image?, cover_alt?, announce? (défaut true),
--      announce_content?, client_request_id?}
-- Retour : {id, event_date, starts_at, status, current_participants,
--           waitlist_enabled, post_id|null, idempotent}
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.create_event_with_post(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.lkdv_require_actor();
  v_req text;
  v_title text;
  v_activity text;
  v_type text;
  v_emoji text;
  v_description text;
  v_location text;
  v_country text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_event_date date;
  v_location_lat double precision;
  v_location_lng double precision;
  v_meeting_point text;
  v_meeting_lat double precision;
  v_meeting_lng double precision;
  v_level text;
  v_distance numeric;
  v_elevation integer;
  v_max integer;
  v_waitlist boolean;
  v_safety_notes text;
  v_safety_checklist text[];
  v_recurrence text;
  v_club_id uuid;
  v_kit_id uuid;
  v_cover_image text;
  v_cover_alt text;
  v_announce boolean;
  v_announce_content text;
  v_event_id uuid;
  v_post_id uuid;
  v_current integer;
  v_status text;
  v_existing_id uuid;
  v_existing_date date;
  v_existing_status text;
  v_existing_current integer;
  v_existing_post uuid;
  v_constraint text;
  v_event_geom geography;
  v_meeting_geom geography;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    perform public.lkdv_raise('validation_failed', 'Données de création manquantes.');
  end if;

  v_req := nullif(btrim(coalesce(p ->> 'client_request_id', '')), '');
  if char_length(coalesce(v_req, '')) > 200 then
    perform public.lkdv_raise('validation_failed', 'Identifiant de requête trop long.', 'client_request_id');
  end if;

  if v_req is not null then
    select id, event_date, status, coalesce(current_participants, 0)
      into v_existing_id, v_existing_date, v_existing_status, v_existing_current
      from public.events
     where organizer_id = v_uid and client_request_id = v_req;
    if found then
      select id into v_existing_post
        from public.community_posts
       where author_id = v_uid
         and creation_meta ->> 'event_id' = v_existing_id::text
       limit 1;
      return jsonb_build_object(
        'id', v_existing_id,
        'event_date', v_existing_date,
        'status', v_existing_status,
        'current_participants', v_existing_current,
        'post_id', v_existing_post,
        'idempotent', true
      );
    end if;
  end if;

  v_title := btrim(coalesce(p ->> 'title', ''));
  if v_title = '' then
    perform public.lkdv_raise('validation_failed', 'Le titre de la sortie est requis.', 'title');
  end if;
  if char_length(v_title) > 120 then
    perform public.lkdv_raise('validation_failed', 'Le titre est trop long (120 caractères).', 'title');
  end if;

  v_starts_at := public.lkdv_timestamptz(p, 'starts_at');
  if v_starts_at is null then
    perform public.lkdv_raise('validation_failed', 'La date et l''heure de départ sont requises.', 'starts_at');
  end if;
  if v_starts_at < now() - interval '1 hour' then
    perform public.lkdv_raise('validation_failed', 'La sortie doit commencer dans le futur.', 'starts_at');
  end if;

  v_ends_at := public.lkdv_timestamptz(p, 'ends_at');
  if v_ends_at is not null then
    if v_ends_at <= v_starts_at then
      perform public.lkdv_raise('validation_failed', 'La fin doit être après le début.', 'ends_at');
    end if;
    if v_ends_at > v_starts_at + interval '30 days' then
      perform public.lkdv_raise('validation_failed', 'La sortie ne peut pas durer plus de 30 jours.', 'ends_at');
    end if;
  end if;

  v_event_date := coalesce(
    public.lkdv_date(p, 'event_date'),
    (v_starts_at at time zone 'Europe/Paris')::date
  );

  v_activity := nullif(btrim(coalesce(p ->> 'activity', '')), '');
  if char_length(coalesce(v_activity, '')) > 60 then
    perform public.lkdv_raise('validation_failed', 'L''activité est trop longue (60 caractères).', 'activity');
  end if;
  v_type := coalesce(nullif(btrim(coalesce(p ->> 'type', '')), ''), 'rando');
  v_emoji := nullif(btrim(coalesce(p ->> 'emoji', '')), '');
  v_description := nullif(btrim(coalesce(p ->> 'description', '')), '');
  if char_length(coalesce(v_description, '')) > 5000 then
    perform public.lkdv_raise('validation_failed', 'La description est trop longue (5000 caractères).', 'description');
  end if;

  v_location := nullif(btrim(coalesce(p ->> 'location', '')), '');
  if char_length(coalesce(v_location, '')) > 160 then
    perform public.lkdv_raise('validation_failed', 'Le lieu est trop long (160 caractères).', 'location');
  end if;
  v_country := nullif(btrim(coalesce(p ->> 'country', '')), '');

  v_location_lat := public.lkdv_num(p, 'location_lat')::double precision;
  v_location_lng := public.lkdv_num(p, 'location_lng')::double precision;
  if (v_location_lat is null) <> (v_location_lng is null) then
    perform public.lkdv_raise('validation_failed', 'Latitude et longitude vont ensemble.', 'location_lat');
  end if;
  if v_location_lat is not null and (v_location_lat < -90 or v_location_lat > 90) then
    perform public.lkdv_raise('validation_failed', 'Latitude hors bornes.', 'location_lat');
  end if;
  if v_location_lng is not null and (v_location_lng < -180 or v_location_lng > 180) then
    perform public.lkdv_raise('validation_failed', 'Longitude hors bornes.', 'location_lng');
  end if;
  if v_location_lat is not null and v_location_lng is not null then
    v_event_geom := st_setsrid(st_makepoint(v_location_lng, v_location_lat), 4326)::geography;
  end if;

  v_meeting_point := nullif(btrim(coalesce(p ->> 'meeting_point', '')), '');
  if char_length(coalesce(v_meeting_point, '')) > 200 then
    perform public.lkdv_raise('validation_failed', 'Le point de rendez-vous est trop long (200 caractères).', 'meeting_point');
  end if;
  v_meeting_lat := public.lkdv_num(p, 'meeting_lat')::double precision;
  v_meeting_lng := public.lkdv_num(p, 'meeting_lng')::double precision;
  if (v_meeting_lat is null) <> (v_meeting_lng is null) then
    perform public.lkdv_raise('validation_failed', 'Latitude et longitude du RDV vont ensemble.', 'meeting_lat');
  end if;
  if v_meeting_lat is not null and (v_meeting_lat < -90 or v_meeting_lat > 90) then
    perform public.lkdv_raise('validation_failed', 'Latitude du RDV hors bornes.', 'meeting_lat');
  end if;
  if v_meeting_lng is not null and (v_meeting_lng < -180 or v_meeting_lng > 180) then
    perform public.lkdv_raise('validation_failed', 'Longitude du RDV hors bornes.', 'meeting_lng');
  end if;
  if v_meeting_lat is not null and v_meeting_lng is not null then
    v_meeting_geom := st_setsrid(st_makepoint(v_meeting_lng, v_meeting_lat), 4326)::geography;
  end if;

  v_level := nullif(btrim(coalesce(p ->> 'level', '')), '');
  if v_level is not null and v_level not in ('facile', 'moyen', 'difficile') then
    perform public.lkdv_raise('validation_failed', 'Niveau de sortie invalide.', 'level');
  end if;

  v_distance := public.lkdv_num(p, 'distance_km');
  if v_distance is not null and (v_distance < 0 or v_distance > 500) then
    perform public.lkdv_raise('validation_failed', 'Distance hors bornes (0 à 500 km).', 'distance_km');
  end if;

  v_elevation := public.lkdv_int(p, 'elevation_gain_m');
  if v_elevation is not null and (v_elevation < 0 or v_elevation > 20000) then
    perform public.lkdv_raise('validation_failed', 'Dénivelé hors bornes (0 à 20 000 m).', 'elevation_gain_m');
  end if;

  v_max := coalesce(public.lkdv_int(p, 'max_participants'), 10);
  if v_max < 0 or v_max > 500 then
    perform public.lkdv_raise('validation_failed', 'Capacité hors bornes (0 à 500).', 'max_participants');
  end if;
  v_waitlist := public.lkdv_bool(p, 'waitlist_enabled') and v_max > 0;

  v_safety_notes := nullif(btrim(coalesce(p ->> 'safety_notes', '')), '');
  if char_length(coalesce(v_safety_notes, '')) > 500 then
    perform public.lkdv_raise('validation_failed', 'Les consignes de sécurité sont trop longues (500 caractères).', 'safety_notes');
  end if;
  v_safety_checklist := public.lkdv_json_text_array(p -> 'safety_checklist');
  if cardinality(v_safety_checklist) > 10 then
    perform public.lkdv_raise('validation_failed', 'Dix points de sécurité au maximum.', 'safety_checklist');
  end if;
  if exists (select 1 from unnest(v_safety_checklist) c where char_length(coalesce(c, '')) > 120) then
    perform public.lkdv_raise('validation_failed', 'Un point de sécurité est trop long (120 caractères).', 'safety_checklist');
  end if;

  v_recurrence := nullif(btrim(coalesce(p ->> 'recurrence', '')), '');
  if v_recurrence is not null and v_recurrence not in ('weekly', 'monthly') then
    perform public.lkdv_raise('validation_failed', 'Récurrence invalide.', 'recurrence');
  end if;

  v_club_id := public.lkdv_uuid(p, 'club_id');
  if v_club_id is not null then
    if not exists (select 1 from public.clubs where id = v_club_id) then
      perform public.lkdv_raise('validation_failed', 'Club introuvable.', 'club_id');
    end if;
    if not exists (
      select 1 from public.club_members
       where club_id = v_club_id and user_id = v_uid and status = 'active'
    ) then
      perform public.lkdv_raise('club_not_member', 'Tu dois être membre du club pour y rattacher une sortie.', 'club_id');
    end if;
  end if;

  v_kit_id := public.lkdv_uuid(p, 'kit_id');
  if v_kit_id is not null then
    if not exists (
      select 1 from public.materiel_kits
       where id = v_kit_id and (user_id = v_uid or is_public = true)
    ) then
      perform public.lkdv_raise('kit_not_accessible', 'Ce kit n''est pas accessible.', 'kit_id');
    end if;
  end if;

  v_cover_image := nullif(btrim(coalesce(p ->> 'cover_image', '')), '');
  if char_length(coalesce(v_cover_image, '')) > 2048 then
    perform public.lkdv_raise('validation_failed', 'Adresse de couverture invalide.', 'cover_image');
  end if;
  v_cover_alt := nullif(btrim(coalesce(p ->> 'cover_alt', '')), '');

  insert into public.events (
    title, type, emoji, organizer_id, event_date, starts_at, ends_at, duration,
    location, country, max_participants, current_participants, description,
    cover_image, cover_alt, shared_kitty, kitty_goal, min_trust_to_organize, status,
    level, distance_km, elevation_gain_m, meeting_point, waitlist_enabled,
    safety_notes, safety_checklist, recurrence, activity, club_id, kit_id,
    location_geom, meeting_geom, client_request_id
  ) values (
    v_title, v_type, v_emoji, v_uid, v_event_date, v_starts_at, v_ends_at, null,
    v_location, coalesce(v_country, 'France'), v_max, 0, v_description,
    v_cover_image, v_cover_alt, 0, 0, null, 'upcoming',
    v_level, v_distance, v_elevation, v_meeting_point, v_waitlist,
    v_safety_notes, v_safety_checklist, v_recurrence, v_activity, v_club_id, v_kit_id,
    v_event_geom, v_meeting_geom, v_req
  )
  returning id into v_event_id;

  -- L'organisateur est inscrit confirmé (compteur tenu par le trigger).
  insert into public.event_participants (event_id, user_id, status)
  values (v_event_id, v_uid, 'confirmed')
  on conflict (event_id, user_id) do nothing;

  select coalesce(current_participants, 0), coalesce(status, 'upcoming')
    into v_current, v_status
    from public.events
   where id = v_event_id;

  -- Post d'annonce : les sorties sont publiques en lecture, le post est public.
  v_announce := coalesce(
    case when p ? 'announce' then public.lkdv_bool(p, 'announce') else true end,
    true
  );
  if v_announce then
    v_announce_content := coalesce(
      nullif(btrim(coalesce(p ->> 'announce_content', '')), ''),
      v_title || ' · ' || to_char(v_event_date, 'DD/MM/YYYY')
    );
    if char_length(v_announce_content) > 20000 then
      perform public.lkdv_raise('validation_failed', 'Le message d''annonce est trop long.', 'announce_content');
    end if;

    insert into public.community_posts (author_id, content, post_type, audience, creation_meta)
    values (
      v_uid, v_announce_content, 'share', 'public',
      jsonb_build_object(
        'created_from', 'create_event_with_post',
        'source', 'event',
        'event_id', v_event_id,
        'event_date', v_event_date,
        'starts_at', v_starts_at,
        'location', v_location
      )
    )
    returning id into v_post_id;
  end if;

  return jsonb_build_object(
    'id', v_event_id,
    'event_date', v_event_date,
    'starts_at', v_starts_at,
    'status', v_status,
    'current_participants', v_current,
    'waitlist_enabled', v_waitlist,
    'post_id', v_post_id,
    'idempotent', false
  );
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'uq_events_client_req' and v_req is not null then
      select id, event_date, status, coalesce(current_participants, 0)
        into v_existing_id, v_existing_date, v_existing_status, v_existing_current
        from public.events
       where organizer_id = v_uid and client_request_id = v_req;
      if found then
        return jsonb_build_object(
          'id', v_existing_id,
          'event_date', v_existing_date,
          'status', v_existing_status,
          'current_participants', v_existing_current,
          'idempotent', true
        );
      end if;
    end if;
    raise;
end;
$$;

comment on function public.create_event_with_post(jsonb) is
  'Communauté v2 — Sortie#15 : sortie (vraies colonnes + géométries) + organisateur confirmé + post d''annonce public dans une seule transaction, idempotence client_request_id.';

revoke all on function public.create_event_with_post(jsonb) from public;
grant execute on function public.create_event_with_post(jsonb) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. create_kit_with_items
-- p : {name*, description?, season?, is_public?, cover_image_url?, tags?: string[],
--      items*: [{name*, category?, weight_g?, quantity?, is_checked?,
--                product_ownership_id?, product_id?, item_key?,
--                slot_id?, slot_order?}], share_content?,
--      client_request_id?}
-- Retour : {id, items_count, total_weight_g, is_public, post_id|null, idempotent}
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.create_kit_with_items(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.lkdv_require_actor();
  v_req text;
  v_name text;
  v_description text;
  v_season text;
  v_is_public boolean;
  v_cover text;
  v_tags text[];
  v_items jsonb;
  v_item jsonb;
  v_item_name text;
  v_item_weight integer;
  v_item_quantity integer;
  v_item_ownership uuid;
  v_total integer := 0;
  v_count integer := 0;
  v_kit_id uuid;
  v_post_id uuid;
  v_share_content text;
  v_existing_id uuid;
  v_existing_weight integer;
  v_existing_public boolean;
  v_existing_post uuid;
  v_constraint text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    perform public.lkdv_raise('validation_failed', 'Données de création manquantes.');
  end if;

  v_req := nullif(btrim(coalesce(p ->> 'client_request_id', '')), '');
  if char_length(coalesce(v_req, '')) > 200 then
    perform public.lkdv_raise('validation_failed', 'Identifiant de requête trop long.', 'client_request_id');
  end if;

  if v_req is not null then
    select id, coalesce(total_weight_g, 0), coalesce(is_public, false)
      into v_existing_id, v_existing_weight, v_existing_public
      from public.materiel_kits
     where user_id = v_uid and client_request_id = v_req;
    if found then
      select id into v_existing_post
        from public.community_posts
       where author_id = v_uid and creation_meta ->> 'kit_id' = v_existing_id::text
       limit 1;
      return jsonb_build_object(
        'id', v_existing_id,
        'total_weight_g', v_existing_weight,
        'is_public', v_existing_public,
        'post_id', v_existing_post,
        'idempotent', true
      );
    end if;
  end if;

  v_name := btrim(coalesce(p ->> 'name', ''));
  if v_name = '' then
    perform public.lkdv_raise('validation_failed', 'Le nom du kit est requis.', 'name');
  end if;
  if char_length(v_name) > 120 then
    perform public.lkdv_raise('validation_failed', 'Le nom du kit est trop long (120 caractères).', 'name');
  end if;

  v_description := nullif(btrim(coalesce(p ->> 'description', '')), '');
  if char_length(coalesce(v_description, '')) > 2000 then
    perform public.lkdv_raise('validation_failed', 'La description est trop longue (2000 caractères).', 'description');
  end if;

  v_season := nullif(btrim(coalesce(p ->> 'season', '')), '');
  if v_season is not null and v_season not in ('printemps', 'ete', 'automne', 'hiver', 'toute_saison') then
    perform public.lkdv_raise('validation_failed', 'Saison invalide.', 'season');
  end if;

  v_is_public := public.lkdv_bool(p, 'is_public');
  v_cover := nullif(btrim(coalesce(p ->> 'cover_image_url', '')), '');
  if char_length(coalesce(v_cover, '')) > 2048 then
    perform public.lkdv_raise('validation_failed', 'Adresse de couverture invalide.', 'cover_image_url');
  end if;

  v_tags := public.lkdv_json_text_array(p -> 'tags');
  if cardinality(v_tags) > 10 then
    perform public.lkdv_raise('validation_failed', 'Dix tags au maximum.', 'tags');
  end if;

  v_items := case
    when p ? 'items' and jsonb_typeof(p -> 'items') = 'array' then p -> 'items'
    else '[]'::jsonb
  end;
  if jsonb_array_length(v_items) > 100 then
    perform public.lkdv_raise('validation_failed', 'Cent articles au maximum.', 'items');
  end if;

  -- Validation exhaustive AVANT toute écriture (aucun kit vide partiel).
  for v_item in select value from jsonb_array_elements(v_items) loop
    v_item_name := btrim(coalesce(v_item ->> 'name', ''));
    if v_item_name = '' then
      perform public.lkdv_raise('validation_failed', 'Chaque article doit avoir un nom.', 'items');
    end if;
    if char_length(v_item_name) > 120 then
      perform public.lkdv_raise('validation_failed', 'Un nom d''article est trop long (120 caractères).', 'items');
    end if;

    v_item_weight := public.lkdv_int(v_item, 'weight_g');
    if v_item_weight is not null and (v_item_weight < 0 or v_item_weight > 50000) then
      perform public.lkdv_raise('validation_failed', 'Poids d''article hors bornes (0 à 50 000 g).', 'items');
    end if;

    v_item_quantity := coalesce(public.lkdv_int(v_item, 'quantity'), 1);
    if v_item_quantity < 1 or v_item_quantity > 99 then
      perform public.lkdv_raise('validation_failed', 'Quantité hors bornes (1 à 99).', 'items');
    end if;

    v_item_ownership := public.lkdv_uuid(v_item, 'product_ownership_id');
    if v_item_ownership is not null then
      if not exists (
        select 1 from public.product_ownership
         where id = v_item_ownership and user_id = v_uid
      ) then
        perform public.lkdv_raise('validation_failed', 'Objet de l''inventaire introuvable.', 'items');
      end if;
    end if;

    if public.lkdv_uuid(v_item, 'product_id') is not null
       and not exists (
         select 1 from public.shop_products
          where id = public.lkdv_uuid(v_item, 'product_id')
       ) then
      perform public.lkdv_raise('validation_failed', 'Produit du catalogue introuvable.', 'items');
    end if;

    v_total := v_total + coalesce(v_item_weight, 0) * v_item_quantity;
    v_count := v_count + 1;
  end loop;

  insert into public.materiel_kits (
    user_id, name, description, season, total_weight_g, is_public,
    cover_image_url, tags, origin, client_request_id
  ) values (
    v_uid, v_name, v_description, v_season, v_total, v_is_public,
    v_cover, v_tags, 'manuel', v_req
  )
  returning id into v_kit_id;

  insert into public.materiel_kit_items (
    kit_id, user_id, name, category, weight_g, quantity, is_checked,
    product_ownership_id, product_id, item_key, slot_id, slot_order
  )
  select
    v_kit_id,
    v_uid,
    btrim(item ->> 'name'),
    nullif(btrim(coalesce(item ->> 'category', '')), ''),
    public.lkdv_int(item, 'weight_g'),
    coalesce(public.lkdv_int(item, 'quantity'), 1),
    public.lkdv_bool(item, 'is_checked'),
    public.lkdv_uuid(item, 'product_ownership_id'),
    public.lkdv_uuid(item, 'product_id'),
    nullif(btrim(coalesce(item ->> 'item_key', '')), ''),
    nullif(btrim(coalesce(item ->> 'slot_id', '')), ''),
    public.lkdv_int(item, 'slot_order')
  from jsonb_array_elements(v_items) as item;

  insert into public.materiel_kit_history (kit_id, user_id, action, payload)
  values (
    v_kit_id, v_uid, 'created',
    jsonb_build_object('items', v_count, 'total_weight_g', v_total)
  );

  -- Post pont uniquement kit public (le trigger exige is_public = true).
  if v_is_public then
    v_share_content := coalesce(
      nullif(btrim(coalesce(p ->> 'share_content', '')), ''),
      'Mon kit « ' || v_name || ' » · ' || v_total || ' g'
    );
    if char_length(v_share_content) > 20000 then
      perform public.lkdv_raise('validation_failed', 'Le message de partage est trop long.', 'share_content');
    end if;

    insert into public.community_posts (author_id, content, post_type, audience, linked_kit_id, creation_meta)
    values (
      v_uid, v_share_content, 'share', 'public', v_kit_id,
      jsonb_build_object('created_from', 'create_kit_with_items', 'kit_id', v_kit_id, 'kit_name', v_name)
    )
    returning id into v_post_id;
  end if;

  return jsonb_build_object(
    'id', v_kit_id,
    'items_count', v_count,
    'total_weight_g', v_total,
    'is_public', v_is_public,
    'post_id', v_post_id,
    'idempotent', false
  );
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'uq_kits_client_req' and v_req is not null then
      select id, coalesce(total_weight_g, 0), coalesce(is_public, false)
        into v_existing_id, v_existing_weight, v_existing_public
        from public.materiel_kits
       where user_id = v_uid and client_request_id = v_req;
      if found then
        return jsonb_build_object(
          'id', v_existing_id,
          'total_weight_g', v_existing_weight,
          'is_public', v_existing_public,
          'idempotent', true
        );
      end if;
    end if;
    raise;
end;
$$;

comment on function public.create_kit_with_items(jsonb) is
  'Communauté v2 — Kit : kit + articles + historique + post pont (kit public) dans une seule transaction ; poids total calculé en SQL ; validation exhaustive avant écriture ; idempotence client_request_id.';

revoke all on function public.create_kit_with_items(jsonb) from public;
grant execute on function public.create_kit_with_items(jsonb) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. create_carnet_v2
-- p : {title*, destination*, description?, visibility ('public'|'private'|
--      'friends', défaut 'private'), start_date?, end_date?, cover_image?,
--      cover_image_alt?, tags?: string[], distance_km?, denivele_m?,
--      nb_nuits?, nb_voyageurs?, lieu_depart?, lieu_arrivee?, country_iso?,
--      map_points?: object, start_lat?, start_lng?, is_collaborative?,
--      collaborators?: uuid[], moments?: [{jour_numero?, heure?, citation*,
--      auteur_nom?, lieu?, image_url?, moment_timestamp?, source?}],
--      media?: [{url*, type? ('image'|'video'), caption?, position?}],
--      nights?: [{jour_numero*, nom*, type* ('refuge'|'gite'|'bivouac'|
--      'hotel'|'camping'|'autre'), altitude_m?, infos?, lat?, lng?}],
--      post?: {enabled?: bool, content?}, client_request_id?}
-- Retour : {id, visibility, moments_count, media_count, nights_count,
--           collaborators_count, post_id|null, idempotent}
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.create_carnet_v2(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.lkdv_require_actor();
  v_req text;
  v_title text;
  v_destination text;
  v_description text;
  v_visibility text;
  v_start_date date;
  v_end_date date;
  v_cover text;
  v_cover_alt text;
  v_tags text[];
  v_distance numeric;
  v_denivele integer;
  v_nb_nuits integer;
  v_nb_voyageurs integer;
  v_lieu_depart text;
  v_lieu_arrivee text;
  v_country text;
  v_map_points jsonb;
  v_start_lat double precision;
  v_start_lng double precision;
  v_start_geom geography;
  v_is_collaborative boolean;
  v_collaborators uuid[];
  v_moments jsonb;
  v_media jsonb;
  v_nights jsonb;
  v_moment jsonb;
  v_media_item jsonb;
  v_night jsonb;
  v_carnet_id uuid;
  v_post_id uuid;
  v_moments_count integer := 0;
  v_media_count integer := 0;
  v_nights_count integer := 0;
  v_collaborators_count integer := 0;
  v_nights_exist boolean := to_regclass('public.carnet_nights') is not null;
  v_post_enabled boolean;
  v_post_content text;
  v_existing_id uuid;
  v_existing_visibility text;
  v_constraint text;
  v_night_jour integer;
  v_night_nom text;
  v_night_type text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    perform public.lkdv_raise('validation_failed', 'Données de création manquantes.');
  end if;

  v_req := nullif(btrim(coalesce(p ->> 'client_request_id', '')), '');
  if char_length(coalesce(v_req, '')) > 200 then
    perform public.lkdv_raise('validation_failed', 'Identifiant de requête trop long.', 'client_request_id');
  end if;

  if v_req is not null then
    select id, visibility into v_existing_id, v_existing_visibility
      from public.carnets
     where author_id = v_uid and client_request_id = v_req;
    if found then
      select id into v_post_id
        from public.community_posts
       where author_id = v_uid and creation_meta ->> 'carnet_id' = v_existing_id::text
       limit 1;
      return jsonb_build_object(
        'id', v_existing_id,
        'visibility', v_existing_visibility,
        'post_id', v_post_id,
        'idempotent', true
      );
    end if;
  end if;

  v_title := btrim(coalesce(p ->> 'title', ''));
  if v_title = '' then
    perform public.lkdv_raise('validation_failed', 'Le titre du carnet est requis.', 'title');
  end if;
  if char_length(v_title) > 140 then
    perform public.lkdv_raise('validation_failed', 'Le titre est trop long (140 caractères).', 'title');
  end if;

  v_destination := btrim(coalesce(p ->> 'destination', ''));
  if v_destination = '' then
    perform public.lkdv_raise('validation_failed', 'La destination est requise.', 'destination');
  end if;
  if char_length(v_destination) > 120 then
    perform public.lkdv_raise('validation_failed', 'La destination est trop longue (120 caractères).', 'destination');
  end if;

  v_visibility := coalesce(nullif(btrim(coalesce(p ->> 'visibility', '')), ''), 'private');
  if v_visibility = 'prive' then
    v_visibility := 'private';
  end if;
  if v_visibility not in ('public', 'private', 'friends', 'followers') then
    perform public.lkdv_raise('validation_failed', 'Visibilité invalide.', 'visibility');
  end if;

  v_description := nullif(btrim(coalesce(p ->> 'description', '')), '');
  v_cover := nullif(btrim(coalesce(p ->> 'cover_image', '')), '');
  v_cover_alt := nullif(btrim(coalesce(p ->> 'cover_image_alt', '')), '');
  v_lieu_depart := nullif(btrim(coalesce(p ->> 'lieu_depart', '')), '');
  v_lieu_arrivee := nullif(btrim(coalesce(p ->> 'lieu_arrivee', '')), '');
  v_country := nullif(btrim(coalesce(p ->> 'country_iso', '')), '');

  if char_length(coalesce(v_cover, '')) > 2048 then
    perform public.lkdv_raise('validation_failed', 'Adresse de couverture invalide.', 'cover_image');
  end if;
  if char_length(coalesce(v_description, '')) > 10000 then
    perform public.lkdv_raise('validation_failed', 'La description est trop longue (10 000 caractères).', 'description');
  end if;

  v_tags := public.lkdv_json_text_array(p -> 'tags');
  if cardinality(v_tags) > 10 then
    perform public.lkdv_raise('validation_failed', 'Dix tags au maximum.', 'tags');
  end if;

  v_start_date := public.lkdv_date(p, 'start_date');
  v_end_date := public.lkdv_date(p, 'end_date');
  if v_start_date is not null and v_end_date is not null and v_end_date < v_start_date then
    perform public.lkdv_raise('validation_failed', 'La date de fin précède le début.', 'end_date');
  end if;

  v_distance := public.lkdv_num(p, 'distance_km');
  if v_distance is not null and v_distance < 0 then
    perform public.lkdv_raise('validation_failed', 'Distance invalide.', 'distance_km');
  end if;
  v_denivele := public.lkdv_int(p, 'denivele_m');
  v_nb_nuits := public.lkdv_int(p, 'nb_nuits');
  if v_nb_nuits is not null and (v_nb_nuits < 0 or v_nb_nuits > 120) then
    perform public.lkdv_raise('validation_failed', 'Nombre de nuits hors bornes.', 'nb_nuits');
  end if;
  v_nb_voyageurs := public.lkdv_int(p, 'nb_voyageurs');
  if v_nb_voyageurs is not null and (v_nb_voyageurs < 1 or v_nb_voyageurs > 100) then
    perform public.lkdv_raise('validation_failed', 'Nombre de voyageurs hors bornes.', 'nb_voyageurs');
  end if;

  v_map_points := case
    when p ? 'map_points' and jsonb_typeof(p -> 'map_points') = 'object' then p -> 'map_points'
    else null
  end;

  v_start_lat := public.lkdv_num(p, 'start_lat')::double precision;
  v_start_lng := public.lkdv_num(p, 'start_lng')::double precision;
  if (v_start_lat is null) <> (v_start_lng is null) then
    perform public.lkdv_raise('validation_failed', 'Latitude et longitude vont ensemble.', 'start_lat');
  end if;
  if v_start_lat is not null and (v_start_lat < -90 or v_start_lat > 90) then
    perform public.lkdv_raise('validation_failed', 'Latitude hors bornes.', 'start_lat');
  end if;
  if v_start_lng is not null and (v_start_lng < -180 or v_start_lng > 180) then
    perform public.lkdv_raise('validation_failed', 'Longitude hors bornes.', 'start_lng');
  end if;
  if v_start_lat is not null and v_start_lng is not null then
    v_start_geom := st_setsrid(st_makepoint(v_start_lng, v_start_lat), 4326)::geography;
  end if;

  v_is_collaborative := public.lkdv_bool(p, 'is_collaborative');
  v_collaborators := public.lkdv_json_uuid_array(p -> 'collaborators');
  if cardinality(v_collaborators) > 20 then
    perform public.lkdv_raise('validation_failed', 'Vingt collaborateurs au maximum.', 'collaborators');
  end if;

  v_moments := case
    when p ? 'moments' and jsonb_typeof(p -> 'moments') = 'array' then p -> 'moments'
    else '[]'::jsonb
  end;
  v_media := case
    when p ? 'media' and jsonb_typeof(p -> 'media') = 'array' then p -> 'media'
    else '[]'::jsonb
  end;
  v_nights := case
    when p ? 'nights' and jsonb_typeof(p -> 'nights') = 'array' then p -> 'nights'
    else '[]'::jsonb
  end;

  if jsonb_array_length(v_moments) > 200 then
    perform public.lkdv_raise('validation_failed', 'Deux cents moments au maximum.', 'moments');
  end if;
  if jsonb_array_length(v_media) > 200 then
    perform public.lkdv_raise('validation_failed', 'Deux cents médias au maximum.', 'media');
  end if;
  if jsonb_array_length(v_nights) > 120 then
    perform public.lkdv_raise('validation_failed', 'Cent vingt nuits au maximum.', 'nights');
  end if;
  if jsonb_array_length(v_nights) > 0 and not v_nights_exist then
    -- La table appartient au chantier carnet-v2 : on ignore les nuits plutôt
    -- que d'échouer (l'UI masque déjà l'étape quand la table n'existe pas).
    v_nights := '[]'::jsonb;
  end if;

  insert into public.carnets (
    author_id, title, destination, description, cover_image, cover_image_alt,
    start_date, end_date, visibility, tags, map_points, is_collaborative,
    distance_km, denivele_m, nb_nuits, nb_voyageurs, lieu_depart, lieu_arrivee,
    country_iso, start_geom, client_request_id
  ) values (
    v_uid, v_title, v_destination, v_description, v_cover, v_cover_alt,
    v_start_date, v_end_date, v_visibility, v_tags, coalesce(v_map_points, '{}'::jsonb), v_is_collaborative,
    v_distance, v_denivele, v_nb_nuits, v_nb_voyageurs, v_lieu_depart, v_lieu_arrivee,
    v_country, v_start_geom, v_req
  )
  returning id into v_carnet_id;

  -- Moments (citation NOT NULL en base : chaîne vide si absente).
  for v_moment in select value from jsonb_array_elements(v_moments) loop
    insert into public.carnet_moments (
      carnet_id, jour_numero, heure, citation, auteur_nom, auteur_id,
      lieu, image_url, moment_timestamp, source
    ) values (
      v_carnet_id,
      public.lkdv_int(v_moment, 'jour_numero'),
      nullif(btrim(coalesce(v_moment ->> 'heure', '')), ''),
      coalesce(nullif(btrim(coalesce(v_moment ->> 'citation', '')), ''), ''),
      nullif(btrim(coalesce(v_moment ->> 'auteur_nom', '')), ''),
      v_uid,
      nullif(btrim(coalesce(v_moment ->> 'lieu', '')), ''),
      nullif(btrim(coalesce(v_moment ->> 'image_url', '')), ''),
      public.lkdv_timestamptz(v_moment, 'moment_timestamp'),
      case
        when (v_moment ->> 'source') in ('manuel', 'auto') then v_moment ->> 'source'
        else 'manuel'
      end
    );
    v_moments_count := v_moments_count + 1;
  end loop;

  -- Médias (toujours écrits, même sans couverture).
  for v_media_item in select value from jsonb_array_elements(v_media) loop
    if nullif(btrim(coalesce(v_media_item ->> 'url', '')), '') is null then
      perform public.lkdv_raise('validation_failed', 'Chaque média doit avoir une URL.', 'media');
    end if;
    if char_length(v_media_item ->> 'url') > 2048 then
      perform public.lkdv_raise('validation_failed', 'URL de média trop longue.', 'media');
    end if;

    insert into public.carnet_media (carnet_id, url, type, caption, position)
    values (
      v_carnet_id,
      btrim(v_media_item ->> 'url'),
      case
        when (v_media_item ->> 'type') in ('image', 'video') then v_media_item ->> 'type'
        else 'image'
      end,
      nullif(btrim(coalesce(v_media_item ->> 'caption', '')), ''),
      public.lkdv_int(v_media_item, 'position')
    );
    v_media_count := v_media_count + 1;
  end loop;

  -- Nuits : uniquement si la table existe (SQL dynamique borné, schéma connu
  -- du dépôt : carnet_id, jour_numero, nom, type, altitude_m, infos, lat, lng,
  -- created_by).
  if v_nights_exist and jsonb_array_length(v_nights) > 0 then
    for v_night in select value from jsonb_array_elements(v_nights) loop
      v_night_jour := public.lkdv_int(v_night, 'jour_numero');
      v_night_nom := btrim(coalesce(v_night ->> 'nom', ''));
      v_night_type := nullif(btrim(coalesce(v_night ->> 'type', '')), '');

      if v_night_jour is null or v_night_jour < 1 then
        perform public.lkdv_raise('validation_failed', 'Numéro de jour de nuit invalide.', 'nights');
      end if;
      if v_night_nom = '' then
        perform public.lkdv_raise('validation_failed', 'Chaque nuit doit avoir un nom.', 'nights');
      end if;
      if v_night_type not in ('refuge', 'gite', 'bivouac', 'hotel', 'camping', 'autre') then
        perform public.lkdv_raise('validation_failed', 'Type d''hébergement invalide.', 'nights');
      end if;

      execute
        'insert into public.carnet_nights
           (carnet_id, jour_numero, nom, type, altitude_m, infos, lat, lng, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)'
        using
          v_carnet_id,
          v_night_jour,
          v_night_nom,
          v_night_type,
          public.lkdv_int(v_night, 'altitude_m'),
          nullif(btrim(coalesce(v_night ->> 'infos', '')), ''),
          public.lkdv_num(v_night, 'lat')::double precision,
          public.lkdv_num(v_night, 'lng')::double precision,
          v_uid;

      v_nights_count := v_nights_count + 1;
    end loop;
  end if;

  -- Collaborateurs invités (jamais l'auteur lui-même).
  if cardinality(v_collaborators) > 0 then
    insert into public.carnet_collaborators (carnet_id, user_id, role)
    select v_carnet_id, c.uid, 'contributor'
      from unnest(v_collaborators) as c(uid)
     where c.uid <> v_uid
       and exists (select 1 from public.user_profiles up where up.id = c.uid)
       and not exists (
         select 1 from public.carnet_collaborators cc
          where cc.carnet_id = v_carnet_id and cc.user_id = c.uid
       );
    get diagnostics v_collaborators_count = row_count;
  end if;

  -- Post pont uniquement si le carnet est public (jamais de fuite d'un carnet
  -- privé : le trigger refuserait, et le bundle interdit le post non public).
  v_post_enabled := case
    when p ? 'post' and jsonb_typeof(p -> 'post') = 'object' and (p -> 'post') ? 'enabled'
      then public.lkdv_bool(p -> 'post', 'enabled')
    else v_visibility = 'public'
  end;
  if v_post_enabled and v_visibility = 'public' then
    v_post_content := coalesce(
      nullif(btrim(coalesce(p #>> '{post,content}', '')), ''),
      'Nouveau carnet : ' || v_title
    );
    if char_length(v_post_content) > 20000 then
      perform public.lkdv_raise('validation_failed', 'Le message de partage est trop long.', 'post');
    end if;

    insert into public.community_posts (author_id, content, post_type, audience, linked_carnet_id, creation_meta)
    values (
      v_uid, v_post_content, 'share', 'public', v_carnet_id,
      jsonb_build_object('created_from', 'create_carnet_v2', 'carnet_id', v_carnet_id, 'carnet_title', v_title)
    )
    returning id into v_post_id;
  end if;

  return jsonb_build_object(
    'id', v_carnet_id,
    'visibility', v_visibility,
    'moments_count', v_moments_count,
    'media_count', v_media_count,
    'nights_count', v_nights_count,
    'collaborators_count', v_collaborators_count,
    'post_id', v_post_id,
    'idempotent', false
  );
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'uq_carnets_client_req' and v_req is not null then
      select id, visibility into v_existing_id, v_existing_visibility
        from public.carnets
       where author_id = v_uid and client_request_id = v_req;
      if found then
        return jsonb_build_object('id', v_existing_id, 'visibility', v_existing_visibility, 'idempotent', true);
      end if;
    end if;
    raise;
end;
$$;

comment on function public.create_carnet_v2(jsonb) is
  'Communauté v2 — Carnet : carnet + moments + médias + collaborateurs + nuits (seulement si carnet_nights existe) + post pont si public, en une transaction ; couverture et start_geom ; idempotence client_request_id.';

revoke all on function public.create_carnet_v2(jsonb) from public;
grant execute on function public.create_carnet_v2(jsonb) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. create_community_post
-- p : {content*, post_type? ('post'|'tip'|'question'|'share'), audience?
--      ('public'|'abonnies'|'club', défaut 'public'), club_id?,
--      image_url?, media_urls?: string[≤10], creation_meta?: object,
--      place_label?, place_lat?, place_lng?, tags?: string[≤10],
--      linked_carnet_id? (carnet de l'auteur uniquement), client_request_id?}
-- Retour : {id, audience, post_id (= id), created_at, idempotent}
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.create_community_post(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.lkdv_require_actor();
  v_request text;
  v_request_uuid uuid;
  v_content text;
  v_post_type text;
  v_audience text;
  v_club_id uuid;
  v_image_url text;
  v_media_urls jsonb;
  v_creation_meta jsonb;
  v_place_label text;
  v_place_lat double precision;
  v_place_lng double precision;
  v_place_geom geography;
  v_tags text[];
  v_linked_carnet uuid;
  v_post_id uuid;
  v_created_at timestamptz;
  v_existing_id uuid;
  v_existing_audience text;
  v_constraint text;
  v_media_count integer;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    perform public.lkdv_raise('validation_failed', 'Données de création manquantes.');
  end if;

  -- Idempotence : la colonne community_posts.client_request_id est un uuid.
  v_request := nullif(btrim(coalesce(p ->> 'client_request_id', '')), '');
  if v_request is not null then
    if v_request !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      perform public.lkdv_raise('validation_failed', 'Identifiant de requête invalide.', 'client_request_id');
    end if;
    v_request_uuid := v_request::uuid;

    select id, audience into v_existing_id, v_existing_audience
      from public.community_posts
     where author_id = v_uid and client_request_id = v_request_uuid;
    if found then
      select created_at into v_created_at from public.community_posts where id = v_existing_id;
      return jsonb_build_object(
        'id', v_existing_id,
        'audience', v_existing_audience,
        'created_at', v_created_at,
        'idempotent', true
      );
    end if;
  end if;

  v_content := btrim(coalesce(p ->> 'content', ''));
  if v_content = '' then
    perform public.lkdv_raise('validation_failed', 'Le contenu de la publication est requis.', 'content');
  end if;
  if char_length(v_content) > 20000 then
    perform public.lkdv_raise('validation_failed', 'Le contenu est trop long (20 000 caractères).', 'content');
  end if;

  v_post_type := coalesce(nullif(btrim(coalesce(p ->> 'post_type', '')), ''), 'post');
  if v_post_type not in ('post', 'tip', 'question', 'share') then
    perform public.lkdv_raise('validation_failed', 'Type de publication invalide.', 'post_type');
  end if;

  v_audience := coalesce(nullif(btrim(coalesce(p ->> 'audience', '')), ''), 'public');
  if v_audience not in ('public', 'abonnies', 'club') then
    perform public.lkdv_raise('validation_failed', 'Audience invalide.', 'audience');
  end if;

  v_club_id := public.lkdv_uuid(p, 'club_id');
  if v_audience = 'club' then
    if v_club_id is null then
      perform public.lkdv_raise('validation_failed', 'Choisis un club pour cette audience.', 'club_id');
    end if;
    if not exists (
      select 1 from public.club_members
       where club_id = v_club_id and user_id = v_uid and status = 'active'
    ) then
      perform public.lkdv_raise('club_not_member', 'Tu dois être membre du club pour y publier.', 'club_id');
    end if;
  elsif v_club_id is not null then
    perform public.lkdv_raise('validation_failed', 'Un club n''est accepté que pour l''audience club.', 'club_id');
  end if;

  v_image_url := nullif(btrim(coalesce(p ->> 'image_url', '')), '');
  if char_length(coalesce(v_image_url, '')) > 2048 then
    perform public.lkdv_raise('validation_failed', 'Adresse d''image invalide.', 'image_url');
  end if;

  v_media_urls := case
    when p ? 'media_urls' and jsonb_typeof(p -> 'media_urls') = 'array' then p -> 'media_urls'
    else '[]'::jsonb
  end;
  v_media_count := jsonb_array_length(v_media_urls);
  if v_media_count > 10 then
    perform public.lkdv_raise('validation_failed', 'Dix médias au maximum.', 'media_urls');
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(v_media_urls) m
     where char_length(coalesce(m, '')) > 2048
  ) then
    perform public.lkdv_raise('validation_failed', 'URL de média trop longue.', 'media_urls');
  end if;

  v_linked_carnet := public.lkdv_uuid(p, 'linked_carnet_id');
  if v_linked_carnet is not null then
    -- Le trigger de snapshot lit le carnet : on n'accepte que le sien (sous
    -- security definer, la RLS serait contournée : garde explicite).
    if not exists (
      select 1 from public.carnets
       where id = v_linked_carnet and author_id = v_uid
    ) then
      perform public.lkdv_raise('validation_failed', 'Carnet introuvable ou non publiable.', 'linked_carnet_id');
    end if;
  end if;

  -- Cohérence média/audience, doublée avant les triggers (message propre).
  if v_audience <> 'public'
     and (
       coalesce(v_image_url, '') <> ''
       or v_media_count > 0
       or v_linked_carnet is not null
     ) then
    perform public.lkdv_raise(
      'validation_failed',
      'Une publication non publique ne peut pas contenir de média ni de carnet lié.',
      'audience'
    );
  end if;

  v_creation_meta := case
    when p ? 'creation_meta' and jsonb_typeof(p -> 'creation_meta') = 'object' then p -> 'creation_meta'
    else null
  end;
  if v_creation_meta is not null and length(v_creation_meta::text) > 20000 then
    perform public.lkdv_raise('validation_failed', 'Métadonnées de création trop volumineuses.', 'creation_meta');
  end if;

  v_place_label := nullif(btrim(coalesce(p ->> 'place_label', '')), '');
  if char_length(coalesce(v_place_label, '')) > 120 then
    perform public.lkdv_raise('validation_failed', 'Le lieu est trop long (120 caractères).', 'place_label');
  end if;

  v_place_lat := public.lkdv_num(p, 'place_lat')::double precision;
  v_place_lng := public.lkdv_num(p, 'place_lng')::double precision;
  if (v_place_lat is null) <> (v_place_lng is null) then
    perform public.lkdv_raise('validation_failed', 'Latitude et longitude vont ensemble.', 'place_lat');
  end if;
  if v_place_lat is not null and (v_place_lat < -90 or v_place_lat > 90) then
    perform public.lkdv_raise('validation_failed', 'Latitude hors bornes.', 'place_lat');
  end if;
  if v_place_lng is not null and (v_place_lng < -180 or v_place_lng > 180) then
    perform public.lkdv_raise('validation_failed', 'Longitude hors bornes.', 'place_lng');
  end if;
  if v_place_lat is not null and v_place_lng is not null then
    v_place_geom := st_setsrid(st_makepoint(v_place_lng, v_place_lat), 4326)::geography;
  end if;

  v_tags := public.lkdv_json_text_array(p -> 'tags');
  if cardinality(v_tags) > 10 then
    perform public.lkdv_raise('validation_failed', 'Dix tags au maximum.', 'tags');
  end if;
  if exists (select 1 from unnest(v_tags) t where char_length(coalesce(t, '')) > 40) then
    perform public.lkdv_raise('validation_failed', 'Un tag est trop long (40 caractères).', 'tags');
  end if;

  insert into public.community_posts (
    author_id, content, post_type, audience, club_id, image_url, media_urls,
    creation_meta, place_label, place_geom, tags, linked_carnet_id, client_request_id
  ) values (
    v_uid, v_content, v_post_type, v_audience, v_club_id, v_image_url, v_media_urls,
    v_creation_meta, v_place_label, v_place_geom, v_tags, v_linked_carnet, v_request_uuid
  )
  returning id, created_at into v_post_id, v_created_at;

  return jsonb_build_object(
    'id', v_post_id,
    'audience', v_audience,
    'created_at', v_created_at,
    'idempotent', false
  );
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_request_uuid is not null then
      select id, audience, created_at
        into v_existing_id, v_existing_audience, v_created_at
        from public.community_posts
       where author_id = v_uid and client_request_id = v_request_uuid;
      if found then
        return jsonb_build_object(
          'id', v_existing_id,
          'audience', v_existing_audience,
          'created_at', v_created_at,
          'idempotent', true
        );
      end if;
    end if;
    raise;
end;
$$;

comment on function public.create_community_post(jsonb) is
  'Communauté v2 — Publication : un seul insert, audience/lieu/tags/creation_meta, cohérence média↔audience vérifiée avant les triggers, idempotence client_request_id (uuid).';

revoke all on function public.create_community_post(jsonb) from public;
grant execute on function public.create_community_post(jsonb) to authenticated;
