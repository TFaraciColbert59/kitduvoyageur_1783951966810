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
-- Contrôles de données AVANT suppression. Le bloc est rejouable : chaque
-- colonne n'est contrôlée que si elle existe encore (un second passage ne
-- casse rien), et le rollback s'arrête si une seule contient des données.
do $$
declare
  v_check record;
  v_count bigint;
begin
  for v_check in
    select * from (values
    ('clubs', 'client_request_id', 'client_request_id is not null'),
    ('events', 'client_request_id', 'client_request_id is not null'),
    ('materiel_kits', 'client_request_id', 'client_request_id is not null'),
    ('carnets', 'client_request_id', 'client_request_id is not null'),
    ('community_posts', 'place_label', 'place_label is not null'),
    ('community_posts', 'place_geom', 'place_geom is not null'),
    ('community_posts', 'tags', 'cardinality(coalesce(tags, ''{}''::text[])) > 0'),
    ('community_posts', 'creation_meta', 'creation_meta is not null')
    ) as t(table_name, column_name, condition)
  loop
    if exists (
      select 1 from information_schema.columns ic
       where ic.table_schema = 'public'
         and ic.table_name = v_check.table_name
         and ic.column_name = v_check.column_name
    ) then
      execute format('select count(*) from public.%I where %s', v_check.table_name, v_check.condition)
        into v_count;
      if v_count > 0 then
        raise exception 'Rollback refusé : public.%.% contient % valeur(s). Ne rien supprimer après le premier usage réel (06 § 3.5).',
          v_check.table_name, v_check.column_name, v_count;
      end if;
    end if;
  end loop;
end $$;

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
