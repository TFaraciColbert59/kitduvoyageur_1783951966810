-- Rollback du lot E Communauté v2 (20261108130005) :
-- RPC de création atomiques, idempotence, colonnes lieu/tags/meta du post.
-- Règle 06 § 3.5 : refus si une colonne supprimée contient des données.
--
-- `community_posts.creation_meta` : la colonne existe aussi dans la migration
-- 20261026130000 (CI). En production elle a été créée par ce lot ; le .down ne
-- la retire que si elle est vide. Ne pas exécuter ce fichier si un autre
-- chantier l'utilise déjà.

-- ── RPC ────────────────────────────────────────────────────────────────────
drop function if exists public.create_community_post(jsonb);
drop function if exists public.create_carnet_v2(jsonb);
drop function if exists public.create_kit_with_items(jsonb);
drop function if exists public.create_event_with_post(jsonb);
drop function if exists public.create_club_with_admin(jsonb);
drop function if exists public.check_club_slug(text);

-- ── Contrôles de données ───────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from public.clubs where client_request_id is not null) then
    raise exception 'Rollback lot E refusé : clubs.client_request_id contient des données.';
  end if;
  if exists (select 1 from public.events where client_request_id is not null) then
    raise exception 'Rollback lot E refusé : events.client_request_id contient des données.';
  end if;
  if exists (select 1 from public.materiel_kits where client_request_id is not null) then
    raise exception 'Rollback lot E refusé : materiel_kits.client_request_id contient des données.';
  end if;
  if exists (select 1 from public.carnets where client_request_id is not null) then
    raise exception 'Rollback lot E refusé : carnets.client_request_id contient des données.';
  end if;

  if exists (
    select 1 from public.community_posts
     where place_label is not null or place_geom is not null
  ) then
    raise exception 'Rollback lot E refusé : community_posts.place_label / place_geom contiennent des données.';
  end if;
  if exists (select 1 from public.community_posts where cardinality(coalesce(tags, '{}'::text[])) > 0) then
    raise exception 'Rollback lot E refusé : community_posts.tags contient des données.';
  end if;
  if exists (select 1 from public.community_posts where creation_meta is not null) then
    raise exception 'Rollback lot E refusé : community_posts.creation_meta contient des données.';
  end if;
end
$$;

-- ── Index uniques d'idempotence ────────────────────────────────────────────
drop index if exists public.uq_carnets_client_req;
drop index if exists public.uq_kits_client_req;
drop index if exists public.uq_events_client_req;
drop index if exists public.uq_clubs_client_req;

-- ── Colonnes du post ───────────────────────────────────────────────────────
drop index if exists public.idx_community_posts_place_geom;
drop index if exists public.idx_community_posts_tags;

alter table public.community_posts
  drop column if exists creation_meta,
  drop column if exists tags,
  drop column if exists place_geom,
  drop column if exists place_label;

-- ── Colonnes d'idempotence ─────────────────────────────────────────────────
alter table public.carnets drop column if exists client_request_id;
alter table public.materiel_kits drop column if exists client_request_id;
alter table public.events drop column if exists client_request_id;
alter table public.clubs drop column if exists client_request_id;

-- ── Helpers de validation ──────────────────────────────────────────────────
drop function if exists public.lkdv_date(jsonb, text);
drop function if exists public.lkdv_timestamptz(jsonb, text);
drop function if exists public.lkdv_uuid(jsonb, text);
drop function if exists public.lkdv_int(jsonb, text);
drop function if exists public.lkdv_num(jsonb, text);
drop function if exists public.lkdv_bool(jsonb, text);
drop function if exists public.lkdv_json_uuid_array(jsonb);
drop function if exists public.lkdv_json_text_array(jsonb);
drop function if exists public.lkdv_slugify(text);
