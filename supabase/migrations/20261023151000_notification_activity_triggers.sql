-- Activité : les notifications hors messagerie portent leur groupe dès
-- l'émission. Les messages restent hors du flux d'activité côté lecture.
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create or replace function public.notify_activity(
  p_user_id uuid,
  p_type text,
  p_group text,
  p_title text,
  p_message text,
  p_actor_id uuid default null,
  p_related_type text default null,
  p_related_id uuid default null,
  p_link text default null
) returns uuid
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare v_id uuid;
begin
  if p_user_id is null or p_user_id = p_actor_id then return null; end if;
  insert into public.notifications
    (user_id, type, "group", title, message, actor_id, related_type, related_id, link)
  values
    (p_user_id, p_type, p_group, p_title, p_message, p_actor_id, p_related_type, p_related_id, p_link)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.on_follow_activity() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  perform public.notify_activity(
    new.following_id, 'new_follower', 'social',
    'Nouvel abonné', 'Quelqu''un te suit.',
    new.follower_id, 'profile', new.follower_id,
    '/profil/' || new.follower_id::text
  );
  return new;
end;
$$;
drop trigger if exists user_follows_activity on public.user_follows;
create trigger user_follows_activity after insert on public.user_follows
for each row execute function public.on_follow_activity();

create or replace function public.on_order_activity() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare v_type text; v_title text;
begin
  if new.status = old.status then return new; end if;
  v_type := case new.status when 'shipped' then 'order_shipped' when 'delivered' then 'order_delivered' when 'cancelled' then 'order_cancelled' else 'order_confirmed' end;
  v_title := case new.status when 'shipped' then 'Ta commande a été expédiée' when 'delivered' then 'Ta commande est livrée' when 'cancelled' then 'Ta commande a été annulée' else 'Ta commande est confirmée' end;
  perform public.notify_activity(new.user_id, v_type, 'orders', v_title, coalesce(new.order_number, 'Commande LKDV'), null, 'order', new.id, '/compte?tab=commandes');
  return new;
end;
$$;
drop trigger if exists orders_activity on public.orders;
create trigger orders_activity after update of status on public.orders
for each row execute function public.on_order_activity();

create or replace function public.on_loan_activity() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'INSERT' and new.borrower_id is not null then
    perform public.notify_activity(new.lender_id, 'loan_request', 'loans', 'Demande de prêt', 'Un membre souhaite emprunter ton matériel.', new.borrower_id, 'loan', new.id, '/compte?tab=prets');
  elsif tg_op = 'UPDATE' and new.borrower_id is not null and new.status = 'en_retard' then
    perform public.notify_activity(new.borrower_id, 'loan_due', 'loans', 'Prêt en retard', 'Un prêt arrive à échéance.', new.lender_id, 'loan', new.id, '/compte?tab=prets');
  end if;
  return new;
end;
$$;
drop trigger if exists loans_activity on public.materiel_loans;
create trigger loans_activity after insert or update of status on public.materiel_loans
for each row execute function public.on_loan_activity();

create or replace function public.on_badge_activity() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare v_name text;
begin
  select name into v_name from public.badges where id = new.badge_id;
  perform public.notify_activity(new.user_id, 'badge_earned', 'system', coalesce(v_name, 'Nouveau trophée'), 'Un trophée vient d''être débloqué.', null, 'badge', new.badge_id, '/compte?tab=vitrine');
  return new;
end;
$$;
drop trigger if exists user_badges_activity on public.user_badges;
create trigger user_badges_activity after insert on public.user_badges
for each row execute function public.on_badge_activity();

create or replace function public.on_challenge_activity() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare v_title text;
begin
  if new.completed and not coalesce(old.completed, false) then
    select title into v_title from public.challenges where id = new.challenge_id;
    perform public.notify_activity(new.user_id, 'challenge_completed', 'system', 'Défi terminé', coalesce(v_title, 'Un défi est terminé.'), null, 'challenge', new.challenge_id, '/compte?tab=communaute');
  end if;
  return new;
end;
$$;
drop trigger if exists user_challenges_activity on public.user_challenges;
create trigger user_challenges_activity after update on public.user_challenges
for each row execute function public.on_challenge_activity();

create or replace function public.on_repost_activity() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare v_author uuid;
begin
  if new.reposted_from_id is null then return new; end if;
  select author_id into v_author from public.community_posts where id = new.reposted_from_id;
  perform public.notify_activity(v_author, 'post_repost', 'social', 'Publication republiée', 'Ta publication a été republiée.', new.author_id, 'community_post', new.id, '/communaute/post/' || new.id::text);
  return new;
end;
$$;
drop trigger if exists community_posts_repost_activity on public.community_posts;
create trigger community_posts_repost_activity after insert on public.community_posts
for each row execute function public.on_repost_activity();
