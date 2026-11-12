-- Carnet v2 — protéger les lignes brutes des sorties.
--
-- La policy historique `hike_sessions_select_owner_or_public_carnet` rendait
-- toutes les sorties d'un carnet public lisibles, y compris celles dont
-- `hike_sessions.visibility = 'private'`. Comme `hike_sessions` contient les
-- coordonnées GPS exactes, les notes et la météo, un simple SELECT PostgREST
-- contournait le masquage applicatif.
--
-- La policy `hike_sessions_select_shared_carnet` (20261112090000) élargissait
-- le même problème aux sorties `collective_anonymized` d'un carnet `friends` :
-- l'abonné recevait la ligne brute, alors que la fiche ne lui montre qu'une
-- trace début/fin masquée.
--
-- On réserve donc la lecture directe de la table au propriétaire et aux
-- participants inscrits. Le partage masqué reste assuré par la fiche carnet :
-- elle lit les sorties avec le client serveur après avoir vérifié l'accès au
-- carnet, puis applique `tracePrivacy` avant de rendre la trace. Aucun rôle
-- anonyme, abonné ou simple lecteur de carnet ne peut lire les lignes brutes.

drop policy if exists hike_sessions_select_owner_or_public_carnet on public.hike_sessions;
drop policy if exists hike_sessions_select_shared_carnet on public.hike_sessions;

drop policy if exists hike_sessions_select_owner_or_participant on public.hike_sessions;
create policy hike_sessions_select_owner_or_participant on public.hike_sessions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.hike_session_participants p
      where p.session_id = hike_sessions.id
        and p.user_id = (select auth.uid())
    )
  );

comment on policy hike_sessions_select_owner_or_participant on public.hike_sessions is
  'Lecture brute réservée au propriétaire et aux participants inscrits. Le partage public/amis passe par la fiche carnet, qui projette les masques avant lecture.';
