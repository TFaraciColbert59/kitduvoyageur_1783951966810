-- Carnet v2 : un participant du carnet écrit les étapes de son parcours (2026-11-10).
--
-- Les étapes d'un carnet vivent dans `groupe_etapes` (carnets.groupe_id). Les
-- politiques existantes n'autorisent l'écriture qu'aux membres du groupe
-- (`groupe_membres`) : un contributeur du carnet qui n'est pas membre du groupe
-- ne pouvait pas ajouter une étape depuis le mode modification. On ajoute des
-- politiques ADDITIVES (les anciennes restent) : écriture permise si la personne
-- est participant du carnet rattaché à ce groupe (`is_carnet_participant`, la
-- fonction du lot A, durcie par 20261109120000).
-- Lecture inchangée (`public_read_groupe_etapes`).
-- Rollback : supabase/migrations_down/20261110100100_carnet_participants_write_etapes.down.sql

-- Garde-fou (relecture du 2026-11-10) : `carnets.groupe_id` est modifiable par
-- l'auteur du carnet et les identifiants de groupe sont lisibles publiquement.
-- Sans ce contrôle, n'importe qui faisait pointer son propre carnet vers le
-- groupe d'autrui et réécrivait ses étapes. Le carnet ne donne donc droit aux
-- étapes d'un groupe que si son AUTEUR appartient réellement à ce groupe :
-- créateur du crew, membre actif du crew, ou membre historique (groupe_membres).
create or replace function public.carnet_author_in_group(p_carnet uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.carnets c
    where c.id = p_carnet
      and c.groupe_id is not null
      and (
        exists (select 1 from public.crews cr
                where cr.id = c.groupe_id and cr.created_by = c.author_id)
        or exists (select 1 from public.crew_members cm
                   where cm.crew_id = c.groupe_id and cm.user_id = c.author_id
                     and cm.status = 'active')
        or exists (select 1 from public.groupe_membres gm
                   where gm.groupe_id = c.groupe_id and gm.user_id = c.author_id)
      )
  );
$$;

revoke all on function public.carnet_author_in_group(uuid) from public;
grant execute on function public.carnet_author_in_group(uuid) to authenticated;

drop policy if exists carnet_participants_insert_etapes on public.groupe_etapes;
create policy carnet_participants_insert_etapes on public.groupe_etapes
  for insert to authenticated
  with check (
    exists (
      select 1 from public.carnets c
      where c.groupe_id = groupe_etapes.groupe_id
        and public.is_carnet_participant(c.id)
        and public.carnet_author_in_group(c.id)
    )
  );

drop policy if exists carnet_participants_update_etapes on public.groupe_etapes;
create policy carnet_participants_update_etapes on public.groupe_etapes
  for update to authenticated
  using (
    exists (
      select 1 from public.carnets c
      where c.groupe_id = groupe_etapes.groupe_id
        and public.is_carnet_participant(c.id)
        and public.carnet_author_in_group(c.id)
    )
  )
  with check (
    exists (
      select 1 from public.carnets c
      where c.groupe_id = groupe_etapes.groupe_id
        and public.is_carnet_participant(c.id)
        and public.carnet_author_in_group(c.id)
    )
  );

drop policy if exists carnet_participants_delete_etapes on public.groupe_etapes;
create policy carnet_participants_delete_etapes on public.groupe_etapes
  for delete to authenticated
  using (
    exists (
      select 1 from public.carnets c
      where c.groupe_id = groupe_etapes.groupe_id
        and public.is_carnet_participant(c.id)
        and public.carnet_author_in_group(c.id)
    )
  );
