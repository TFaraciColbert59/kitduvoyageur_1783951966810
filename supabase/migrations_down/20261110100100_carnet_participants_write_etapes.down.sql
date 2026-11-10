-- Rollback de 20261110100100_carnet_participants_write_etapes.
drop policy if exists carnet_participants_insert_etapes on public.groupe_etapes;
drop policy if exists carnet_participants_update_etapes on public.groupe_etapes;
drop policy if exists carnet_participants_delete_etapes on public.groupe_etapes;
