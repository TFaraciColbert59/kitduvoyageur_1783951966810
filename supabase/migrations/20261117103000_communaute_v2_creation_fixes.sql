-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Communauté v2 — Correctifs de création (15 médias, médias toutes
-- audiences, post photo sans légende, visibilité club sur carnet)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Autoriser les médias sur toutes les audiences (public, abonnies, club)
drop trigger if exists trg_community_post_restricted_media on public.community_posts;

-- 2. Étendre la limite de media_urls de 10 à 15 photos
alter table public.community_posts
  drop constraint if exists community_posts_media_urls_array;
alter table public.community_posts
  add constraint community_posts_media_urls_array
  check (jsonb_typeof(media_urls) = 'array' and jsonb_array_length(media_urls) <= 15);

-- 3. Mettre à jour create_community_post(jsonb)
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

  v_image_url := nullif(btrim(coalesce(p ->> 'image_url', '')), '');
  if char_length(coalesce(v_image_url, '')) > 2048 then
    perform public.lkdv_raise('validation_failed', 'Adresse d''image invalide.', 'image_url');
  end if;

  v_media_urls := case
    when p ? 'media_urls' and jsonb_typeof(p -> 'media_urls') = 'array' then p -> 'media_urls'
    else '[]'::jsonb
  end;
  v_media_count := jsonb_array_length(v_media_urls);
  if v_media_count > 15 then
    perform public.lkdv_raise('validation_failed', 'Quinze médias au maximum.', 'media_urls');
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(v_media_urls) m
     where char_length(coalesce(m, '')) > 2048
  ) then
    perform public.lkdv_raise('validation_failed', 'URL de média trop longue.', 'media_urls');
  end if;

  v_content := btrim(coalesce(p ->> 'content', ''));
  if v_content = '' and (v_image_url is not null or v_media_count > 0) then
    v_content := '📷';
  end if;
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

  v_linked_carnet := public.lkdv_uuid(p, 'linked_carnet_id');
  if v_linked_carnet is not null then
    if not exists (
      select 1 from public.carnets
       where id = v_linked_carnet and author_id = v_uid
    ) then
      perform public.lkdv_raise('validation_failed', 'Carnet introuvable ou non publiable.', 'linked_carnet_id');
    end if;
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

revoke all on function public.create_community_post(jsonb) from public;
grant execute on function public.create_community_post(jsonb) to authenticated;
