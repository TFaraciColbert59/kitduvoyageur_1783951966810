-- Down Migration: 20261031200000_replace_kit_items_rpc.down.sql
-- Description: Annulation de replace_kit_items et restauration de la contrainte historique d'origine

drop function if exists public.replace_kit_items(uuid, jsonb, boolean);

alter table public.materiel_kit_history
  drop constraint if exists materiel_kit_history_action_check;

alter table public.materiel_kit_history
  add constraint materiel_kit_history_action_check
  check (action in ('created','updated','deleted','restored','forked','optimized','compared'));
