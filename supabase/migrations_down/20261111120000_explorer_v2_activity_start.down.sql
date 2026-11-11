-- Rollback de 20261111120000_explorer_v2_activity_start.
--
-- Retire uniquement les objets ajoutés par la migration. Les séances
-- historiques restent intactes ; seules les valeurs des deux nouvelles
-- colonnes (qui n'existaient pas avant) sont perdues avec elles.

begin;

drop function if exists public.start_activity_session(uuid, text, text, bigint);

drop index if exists public.activity_sessions_user_client_idx;

alter table public.activity_sessions
  drop constraint if exists activity_sessions_variant_id_check;

alter table public.activity_sessions
  drop column if exists client_session_id;

alter table public.activity_sessions
  drop column if exists variant_id;

commit;
