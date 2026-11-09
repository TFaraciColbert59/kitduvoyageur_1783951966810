-- Sécurité carnet (2026-11-09) : fermer deux élévations de privilège.
--
-- 1. `carnet_collab_manage` (FOR ALL, user_id = auth.uid()) laissait tout
--    utilisateur connecté s'inscrire lui-même dans `carnet_collaborators` de
--    n'importe quel carnet, avec le rôle `owner`. Or `is_carnet_participant`
--    (lot A carnet v2) fait confiance à cette table : n'importe qui pouvait
--    donc devenir participant, et écrire moments, nuits, verdicts, position.
--    Désormais seul l'auteur du carnet inscrit, modifie ou retire un
--    collaborateur ; chacun peut se retirer lui-même.
-- 2. `auth_manage_carnet_moments` (FOR ALL, auteur_id = auth.uid()) laissait
--    ajouter un moment dans le carnet d'autrui en se déclarant auteur.
--    L'écriture passe uniquement par `carnet_moments_participant_manage`
--    (lot D). La lecture passe par une seule règle canonique,
--    `can_view_carnet` (public, abonnés, participants, hors blocage).
--
-- Aucune donnée n'est supprimée. Requête d'audit à lancer après application
-- (lignes `owner` qui ne sont pas l'auteur du carnet, signe d'auto-inscription) :
--   select cc.* from public.carnet_collaborators cc
--   join public.carnets c on c.id = cc.carnet_id
--   where cc.role = 'owner' and cc.user_id <> c.author_id;
-- Rollback : supabase/migrations_down/20261109120000_carnet_security_collaborators_moments.down.sql

-- 1. carnet_collaborators ---------------------------------------------------
drop policy if exists "carnet_collab_manage" on public.carnet_collaborators;

drop policy if exists carnet_collab_insert_by_author on public.carnet_collaborators;
create policy carnet_collab_insert_by_author on public.carnet_collaborators
  for insert to authenticated
  with check (
    exists (
      select 1 from public.carnets c
      where c.id = carnet_collaborators.carnet_id
        and c.author_id = (select auth.uid())
    )
  );

drop policy if exists carnet_collab_update_by_author on public.carnet_collaborators;
create policy carnet_collab_update_by_author on public.carnet_collaborators
  for update to authenticated
  using (
    exists (
      select 1 from public.carnets c
      where c.id = carnet_collaborators.carnet_id
        and c.author_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.carnets c
      where c.id = carnet_collaborators.carnet_id
        and c.author_id = (select auth.uid())
    )
  );

drop policy if exists carnet_collab_delete_by_author_or_self on public.carnet_collaborators;
create policy carnet_collab_delete_by_author_or_self on public.carnet_collaborators
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.carnets c
      where c.id = carnet_collaborators.carnet_id
        and c.author_id = (select auth.uid())
    )
  );

-- 2. carnet_moments ---------------------------------------------------------
drop policy if exists "auth_manage_carnet_moments" on public.carnet_moments;
drop policy if exists "public_read_carnet_moments" on public.carnet_moments;
drop policy if exists "seed_public_read_carnet_moments" on public.carnet_moments;
drop policy if exists "carnet_moments_read_scoped" on public.carnet_moments;

drop policy if exists carnet_moments_select_viewable on public.carnet_moments;
create policy carnet_moments_select_viewable on public.carnet_moments
  for select
  using (public.can_view_carnet(carnet_id));

-- 3. is_carnet_participant : la branche « participant d'une sortie liée »
--    ne compte que les sorties tenues par l'auteur du carnet ou par un
--    collaborateur owner/contributor. Sans cela, n'importe qui créait une
--    sortie à lui pointant vers le carnet visé, s'y inscrivait participant
--    (hike_participants_owner_write) et devenait participant du carnet
--    (relecture indépendante du 2026-11-09, exploit reproduit en base).
create or replace function public.is_carnet_participant(p_carnet uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select auth.uid()) is not null and (
    exists (
      select 1 from public.carnets c
      where c.id = p_carnet and c.author_id = (select auth.uid())
    )
    or exists (
      select 1 from public.carnet_collaborators cc
      where cc.carnet_id = p_carnet
        and cc.user_id = (select auth.uid())
        and cc.role in ('owner', 'contributor')
    )
    or exists (
      select 1 from public.hike_sessions hs
      join public.carnets c on c.id = hs.carnet_id
      join public.hike_session_participants hp on hp.session_id = hs.id
      where hs.carnet_id = p_carnet
        and hp.user_id = (select auth.uid())
        and (
          hs.user_id = c.author_id
          or exists (
            select 1 from public.carnet_collaborators cc2
            where cc2.carnet_id = p_carnet
              and cc2.user_id = hs.user_id
              and cc2.role in ('owner', 'contributor')
          )
        )
    )
  );
$$;

revoke all on function public.is_carnet_participant(uuid) from public;
grant execute on function public.is_carnet_participant(uuid) to authenticated, anon;

-- 4. hike_sessions : on ne rattache une sortie (et ses positions) qu'à un
--    carnet dont on est participant.
drop policy if exists hike_sessions_insert_owner on public.hike_sessions;
create policy hike_sessions_insert_owner on public.hike_sessions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (carnet_id is null or public.is_carnet_participant(carnet_id))
  );

drop policy if exists hike_sessions_update_owner on public.hike_sessions;
create policy hike_sessions_update_owner on public.hike_sessions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (carnet_id is null or public.is_carnet_participant(carnet_id))
  );
