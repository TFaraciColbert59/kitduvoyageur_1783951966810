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
