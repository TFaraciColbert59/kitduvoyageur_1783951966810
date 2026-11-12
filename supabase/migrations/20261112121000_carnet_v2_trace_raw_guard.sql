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
--
-- La lecture par participant impose de casser le cycle entre les policies de
-- `hike_sessions` et `hike_session_participants` : l'ancienne policy
-- `hike_participants_owner_write` était `FOR ALL` et se déclenchait donc aussi
-- au SELECT. Les écritures du propriétaire sont désormais séparées par
-- commande, sans policy SELECT implicite.

drop policy if exists hike_sessions_select_owner_or_public_carnet on public.hike_sessions;
drop policy if exists hike_sessions_select_shared_carnet on public.hike_sessions;

-- Casser le cycle RLS avant d'introduire la lecture par participant.
--
-- `hike_participants_owner_write` est une policy `FOR ALL` : elle s'applique
-- aussi au SELECT et interroge `hike_sessions`. La nouvelle policy de
-- `hike_sessions` interroge `hike_session_participants` : PostgreSQL détecte
-- alors une récursion infinie de policies (`42P17`) et refuse les lectures.
--
-- On sépare donc les écritures du propriétaire en INSERT/UPDATE/DELETE. La
-- lecture des participants reste assurée par `hike_participants_select`, qui
-- passe par `can_view_hike_session` (SECURITY DEFINER), sans récursion.
drop policy if exists hike_participants_owner_write on public.hike_session_participants;
drop policy if exists hike_participants_owner_insert on public.hike_session_participants;
drop policy if exists hike_participants_owner_update on public.hike_session_participants;
drop policy if exists hike_participants_owner_delete on public.hike_session_participants;

create policy hike_participants_owner_insert on public.hike_session_participants
  for insert to authenticated
  with check (
    exists (
      select 1 from public.hike_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
  );

create policy hike_participants_owner_update on public.hike_session_participants
  for update to authenticated
  using (
    exists (
      select 1 from public.hike_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.hike_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
  );

create policy hike_participants_owner_delete on public.hike_session_participants
  for delete to authenticated
  using (
    exists (
      select 1 from public.hike_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
  );

comment on policy hike_participants_owner_insert on public.hike_session_participants is
  'Le propriétaire de la sortie inscrit un participant. Aucune lecture implicite : SELECT reste porté par hike_participants_select.';
comment on policy hike_participants_owner_update on public.hike_session_participants is
  'Le propriétaire de la sortie modifie un participant. Aucune lecture implicite : SELECT reste porté par hike_participants_select.';
comment on policy hike_participants_owner_delete on public.hike_session_participants is
  'Le propriétaire de la sortie retire un participant. Aucune lecture implicite : SELECT reste porté par hike_participants_select.';

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
