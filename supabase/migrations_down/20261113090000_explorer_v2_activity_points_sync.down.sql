-- Rollback de 20261113090000_explorer_v2_activity_points_sync.
--
-- Les points déjà enregistrés sont conservés ; seule la séquence d'idempotence
-- est retirée. Après ce rollback, un rejeu de lot peut à nouveau créer des
-- doublons : ne l'exécuter qu'après avoir arrêté les clients qui poussent des
-- points, ou en acceptant cette limite.

begin;

drop function if exists public.sync_activity_session(
  uuid, jsonb, integer, integer, integer, boolean, timestamptz, timestamptz
);

drop index if exists public.activity_points_session_client_seq_idx;

alter table public.activity_points
  drop column if exists client_seq;

commit;
