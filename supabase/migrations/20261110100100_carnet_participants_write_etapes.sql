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

drop policy if exists carnet_participants_insert_etapes on public.groupe_etapes;
create policy carnet_participants_insert_etapes on public.groupe_etapes
  for insert to authenticated
  with check (
    exists (
      select 1 from public.carnets c
      where c.groupe_id = groupe_etapes.groupe_id
        and public.is_carnet_participant(c.id)
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
    )
  )
  with check (
    exists (
      select 1 from public.carnets c
      where c.groupe_id = groupe_etapes.groupe_id
        and public.is_carnet_participant(c.id)
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
    )
  );
