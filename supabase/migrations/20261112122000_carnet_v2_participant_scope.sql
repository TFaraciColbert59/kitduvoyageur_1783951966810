-- Carnet v2 — borner les droits d'un participant de sortie.
--
-- Un participant inscrit à UNE sortie n'est pas éditeur du carnet. La fonction
-- historique `is_carnet_participant` mélangeait les deux : elle servait à la
-- fois à lire le carnet (auteur, collaborateur, participant de sortie) et à
-- écrire les moments, le kit, les nuits et les positions live. Un invité d'une
-- seule sortie pouvait donc modifier tout le carnet et lire les positions
-- exactes des autres.
--
-- La lecture du carnet reste volontairement ouverte au participant de sortie :
-- c'est une personne invitée sur une sortie du carnet, et la fiche la traite
-- comme `visitor` (pas de budget, pas de jours privés, trace masquée selon la
-- politique de partage). Les ÉCRITURES et la lecture des positions exactes
-- d'autrui sont, elles, réservées à l'éditeur (auteur ou collaborateur
-- owner/contributor).
--
-- Cette migration ferme aussi les policies historiques qui rendaient ce
-- contrôle illusoire : auto-promotion dans `carnet_collaborators`, écriture de
-- moments par tout authentifié, et lectures publiques `USING (true)` des
-- moments et du kit.

create or replace function public.is_carnet_editor(p_carnet uuid)
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
  );
$$;

revoke all on function public.is_carnet_editor(uuid) from public;
grant execute on function public.is_carnet_editor(uuid) to authenticated, anon;

comment on function public.is_carnet_editor(uuid) is
  'Éditeur du carnet : auteur ou collaborateur owner/contributor. Ne inclut jamais un simple participant de sortie.';

-- `is_carnet_participant` reste le helper de LECTURE : éditeur ou participant
-- d'une sortie liée. Il ne doit plus servir de contrôle d'écriture.
create or replace function public.is_carnet_participant(p_carnet uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select auth.uid()) is not null and (
    public.is_carnet_editor(p_carnet)
    or exists (
      select 1
      from public.hike_sessions hs
      join public.hike_session_participants hp on hp.session_id = hs.id
      where hs.carnet_id = p_carnet
        and hp.user_id = (select auth.uid())
    )
  );
$$;

revoke all on function public.is_carnet_participant(uuid) from public;
grant execute on function public.is_carnet_participant(uuid) to authenticated, anon;

comment on function public.is_carnet_participant(uuid) is
  'Lecture du carnet : éditeur ou participant inscrit à une sortie liée. Ne confère aucun droit d''écriture ni de lecture des positions exactes d''autrui.';

-- ---------------------------------------------------------------------------
-- 1. Collaborateurs : l'auteur du carnet est le seul à distribuer les rôles.
--
-- `carnet_collab_manage` (historique) autorisait tout utilisateur authentifié
-- à insérer ou modifier SA ligne avec n'importe quel `carnet_id` et n'importe
-- quel rôle. Un tiers devenait donc `contributor`/`owner` de n'importe quel
-- carnet, ce qui rendait `is_carnet_editor` inopérant et ouvrait les positions
-- live exactes. On retire cette policy et les deux lectures publiques
-- historiques, puis on réserve INSERT/UPDATE/DELETE à l'auteur du carnet.
-- `carnet_collaborators_read_scoped` reste l'unique policy de lecture.
-- ---------------------------------------------------------------------------
drop policy if exists carnet_collab_manage on public.carnet_collaborators;
drop policy if exists carnet_collab_read on public.carnet_collaborators;
drop policy if exists "Public read carnet_collaborators" on public.carnet_collaborators;

-- Le baseline de production porte `carnet_collaborators_read_scoped`, mais
-- aucune migration ne la crée. On la (re)crée ici pour qu'une base reconstruite
-- depuis les migrations ne se retrouve pas sans aucune lecture après la
-- suppression des deux policies publiques ci-dessus.
drop policy if exists carnet_collaborators_read_scoped on public.carnet_collaborators;
create policy carnet_collaborators_read_scoped on public.carnet_collaborators
  for select
  using (
    exists (
      select 1 from public.carnets c
      where c.id = carnet_collaborators.carnet_id
        and (
          c.visibility = 'public'
          or c.author_id = (select auth.uid())
        )
    )
    or user_id = (select auth.uid())
  );

drop policy if exists carnet_collaborators_author_insert on public.carnet_collaborators;
create policy carnet_collaborators_author_insert on public.carnet_collaborators
  for insert to authenticated
  with check (
    exists (
      select 1 from public.carnets c
      where c.id = carnet_id and c.author_id = (select auth.uid())
    )
  );

drop policy if exists carnet_collaborators_author_update on public.carnet_collaborators;
create policy carnet_collaborators_author_update on public.carnet_collaborators
  for update to authenticated
  using (
    exists (
      select 1 from public.carnets c
      where c.id = carnet_id and c.author_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.carnets c
      where c.id = carnet_id and c.author_id = (select auth.uid())
    )
  );

drop policy if exists carnet_collaborators_author_delete on public.carnet_collaborators;
create policy carnet_collaborators_author_delete on public.carnet_collaborators
  for delete to authenticated
  using (
    exists (
      select 1 from public.carnets c
      where c.id = carnet_id and c.author_id = (select auth.uid())
    )
  );

comment on policy carnet_collaborators_author_insert on public.carnet_collaborators is
  'Seul l''auteur du carnet invite un collaborateur. Un tiers ne peut pas s''auto-insérer.';
comment on policy carnet_collaborators_author_update on public.carnet_collaborators is
  'Seul l''auteur du carnet change un rôle. Un collaborateur ne peut pas se promouvoir.';
comment on policy carnet_collaborators_author_delete on public.carnet_collaborators is
  'Seul l''auteur du carnet retire un collaborateur.';

-- ---------------------------------------------------------------------------
-- 2. Retirer les policies de lecture historiques `USING (true)`.
--
-- `20260728160000_fix_permissive_rls_policies.sql` a recréé
-- `public_read_carnet_moments` et `public_read_carnet_kit_items`, que
-- `20260911550000_phase8_rls_hardening.sql` n'a pas supprimées (elle ne visait
-- que les variantes `seed_*`). Sur une base reconstruite depuis les migrations,
-- `anon` pouvait donc lire tous les moments et tout le kit, y compris privés.
-- Les policies scopées `carnet_moments_read_scoped` et
-- `carnet_kit_items_read_scoped` restent l'autorité de lecture.
--
-- `auth_manage_carnet_moments` autorisait par ailleurs tout utilisateur
-- authentifié à écrire un moment dont il est l'auteur, sans contrôle du carnet.
-- Elle se cumulait avec `carnet_moments_editor_manage` et vidait ce dernier de
-- son sens. On la retire : seul l'éditeur du carnet écrit un moment.
-- ---------------------------------------------------------------------------
drop policy if exists public_read_carnet_moments on public.carnet_moments;
drop policy if exists public_read_carnet_kit_items on public.carnet_kit_items;
drop policy if exists seed_public_read_carnet_moments on public.carnet_moments;
drop policy if exists seed_public_read_carnet_kit_items on public.carnet_kit_items;
drop policy if exists auth_manage_carnet_moments on public.carnet_moments;

-- Même raison que pour les collaborateurs : `carnet_moments_read_scoped` et
-- `carnet_kit_items_read_scoped` ne vivent que dans le baseline, pas dans la
-- chaîne de migrations. On les (re)crée pour qu'un replay complet garde une
-- lecture scopée des carnets publics et de l'auteur.
drop policy if exists carnet_moments_read_scoped on public.carnet_moments;
create policy carnet_moments_read_scoped on public.carnet_moments
  for select
  using (
    exists (
      select 1 from public.carnets c
      where c.id = carnet_moments.carnet_id
        and (
          c.visibility = 'public'
          or c.author_id = (select auth.uid())
        )
    )
  );

drop policy if exists carnet_kit_items_read_scoped on public.carnet_kit_items;
create policy carnet_kit_items_read_scoped on public.carnet_kit_items
  for select
  using (
    exists (
      select 1 from public.carnets c
      where c.id = carnet_kit_items.carnet_id
        and (
          c.visibility = 'public'
          or c.author_id = (select auth.uid())
        )
    )
  );

-- Écritures du kit : l'éditeur seulement (l'ancienne policy s'appelait
-- `carnet_kit_items_participant_manage` et laissait passer tout participant).
drop policy if exists carnet_kit_items_participant_manage on public.carnet_kit_items;
drop policy if exists carnet_kit_items_editor_manage on public.carnet_kit_items;
create policy carnet_kit_items_editor_manage on public.carnet_kit_items
  for all to authenticated
  using (public.is_carnet_editor(carnet_id))
  with check (public.is_carnet_editor(carnet_id));

-- Écritures des moments : l'éditeur seulement.
drop policy if exists carnet_moments_participant_manage on public.carnet_moments;
drop policy if exists carnet_moments_editor_manage on public.carnet_moments;
create policy carnet_moments_editor_manage on public.carnet_moments
  for all to authenticated
  using (public.is_carnet_editor(carnet_id))
  with check (public.is_carnet_editor(carnet_id));

-- Nuits : lecture selon la visibilité du carnet, écriture réservée à l'éditeur.
drop policy if exists carnet_nights_insert on public.carnet_nights;
create policy carnet_nights_insert on public.carnet_nights
  for insert to authenticated
  with check (public.is_carnet_editor(carnet_id));

drop policy if exists carnet_nights_update on public.carnet_nights;
create policy carnet_nights_update on public.carnet_nights
  for update to authenticated
  using (public.is_carnet_editor(carnet_id))
  with check (public.is_carnet_editor(carnet_id));

drop policy if exists carnet_nights_delete on public.carnet_nights;
create policy carnet_nights_delete on public.carnet_nights
  for delete to authenticated
  using (public.is_carnet_editor(carnet_id));

-- Positions live : l'éditeur lit tout ; un participant ne lit que SA ligne
-- (sa propre position), jamais celle des autres. Il peut toujours publier,
-- mettre à jour ou supprimer sa propre position.
drop policy if exists carnet_live_positions_select on public.carnet_live_positions;
create policy carnet_live_positions_select on public.carnet_live_positions
  for select to authenticated
  using (
    public.is_carnet_editor(carnet_id)
    or (
      user_id = (select auth.uid())
      and public.is_carnet_participant(carnet_id)
    )
  );

drop policy if exists carnet_live_positions_insert on public.carnet_live_positions;
create policy carnet_live_positions_insert on public.carnet_live_positions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_carnet_participant(carnet_id)
  );

drop policy if exists carnet_live_positions_update on public.carnet_live_positions;
create policy carnet_live_positions_update on public.carnet_live_positions
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and public.is_carnet_participant(carnet_id)
  )
  with check (
    user_id = (select auth.uid())
    and public.is_carnet_participant(carnet_id)
  );

drop policy if exists carnet_live_positions_delete on public.carnet_live_positions;
create policy carnet_live_positions_delete on public.carnet_live_positions
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    and public.is_carnet_participant(carnet_id)
  );
