-- Sessions d'essai anonymes (plan 2.3, audit du 8 octobre) : chaque visiteur
-- a son propre espace au lieu du compte démo partagé. Inerte tant que les
-- connexions anonymes sont éteintes dans Supabase Auth. La purge des essais
-- (suppression de comptes) est dans la migration suivante, lancée par Tony.

-- 1. Un compte anonyme n'a pas d'e-mail : le profil reçoit une adresse
--    réservée et jamais délivrable (.invalid, RFC 2606), unique par compte
--    (user_profiles.email est NOT NULL UNIQUE).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_email text := coalesce(NEW.email, NEW.id::text || '@essai.invalid');
begin
  insert into public.user_profiles (
    id, email, full_name, avatar_url, trust_score, loyalty_points,
    loyalty_level, bio, location, xp, level
  ) values (
    NEW.id,
    v_email,
    coalesce(
      NEW.raw_user_meta_data->>'full_name',
      case when NEW.email is null then 'Voyageur à l''essai' else split_part(NEW.email, '@', 1) end
    ),
    coalesce(NEW.raw_user_meta_data->>'avatar_url', ''),
    50, 0, 'Explorateur', '', '', 0, 1
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = case when public.user_profiles.full_name = '' then excluded.full_name else public.user_profiles.full_name end,
    updated_at = current_timestamp;
  return NEW;
end;
$function$;

-- 2. Un compte d'essai qui devient un vrai compte (e-mail ajouté) : le profil
--    prend la vraie adresse.
create or replace function public.handle_user_email_set()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if NEW.email is not null and NEW.email is distinct from OLD.email then
    update public.user_profiles
      set email = NEW.email, updated_at = current_timestamp
      where id = NEW.id and email like '%@essai.invalid';
  end if;
  return NEW;
end;
$$;

revoke all on function public.handle_user_email_set() from public, anon, authenticated;

create or replace trigger on_auth_user_email_set
  after update of email on auth.users
  for each row execute function public.handle_user_email_set();

-- 3. Session anonyme ? (jeton Supabase : `is_anonymous`).
create or replace function public.is_anonymous_session()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

-- 4. Rien de public ni de social depuis un essai : contenus communautaires,
--    messagerie, avis, signalements, invitations. Le Compas (voyages, étapes,
--    kit, budget) reste entier.
do $$
declare
  t text;
begin
  foreach t in array array[
    'carnet_comments', 'carnets', 'club_challenge_entries', 'club_event_participants',
    'club_events', 'club_join_requests', 'club_members', 'club_reports',
    'club_topic_likes', 'club_topic_replies', 'club_topics', 'clubs',
    'comment_reports', 'community_posts', 'conversation_members',
    'event_participants', 'events', 'group_members', 'group_messages',
    'message_attachments', 'message_reactions', 'messages',
    'occasion_items', 'occasion_offers', 'place_photos', 'place_reports',
    'place_reviews', 'places', 'post_comments', 'post_likes', 'product_reviews',
    'review_helpful_votes', 'reviews', 'share_tokens', 'terrain_report_confirmations',
    'terrain_report_contributors', 'terrain_reports', 'trip_invitations'
  ] loop
    if to_regclass('public.' || t) is not null
       and not exists (
         select 1 from pg_policies
         where schemaname = 'public' and tablename = t and policyname = 'essai_sans_ecriture_publique'
       ) then
      execute format(
        'create policy essai_sans_ecriture_publique on public.%I as restrictive for insert to authenticated with check (not public.is_anonymous_session())',
        t
      );
    end if;
  end loop;
end;
$$;
