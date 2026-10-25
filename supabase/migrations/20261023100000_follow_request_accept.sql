-- Acceptation d'une demande d'abonnement par la personne ciblée.
--
-- La policy historique `user_follows` n'autorise que `follower_id = auth.uid()`.
-- Le target d'une demande ne pouvait donc pas créer la relation au nom du
-- demandeur. Cette policy additive l'autorise uniquement pour une demande
-- pending qui le concerne, sans élargir les autres écritures.

drop policy if exists user_follows_insert_from_request on public.user_follows;
create policy user_follows_insert_from_request
on public.user_follows for insert to authenticated
with check (
  follower_id = auth.uid()
  or exists (
    select 1
    from public.follow_requests r
    where r.requester_id = follower_id
      and r.target_id = following_id
      and r.target_id = auth.uid()
      and r.status = 'pending'
  )
);

-- Le target d'une demande pending peut lire l'identité du demandeur, même si
-- son profil est privé. Sans cela, l'écran « Demandes » afficherait un profil
-- anonyme au lieu du nom de la personne qui demande à suivre.
drop policy if exists user_profiles_select_follow_requester on public.user_profiles;
create policy user_profiles_select_follow_requester
on public.user_profiles for select to authenticated
using (
  exists (
    select 1
    from public.follow_requests r
    where r.requester_id = user_profiles.id
      and r.target_id = auth.uid()
  )
);
