-- M07 — rollback.
-- Les colonnes de prise en charge SOS NE SONT PAS SUPPRIMÉES (DROP COLUMN
-- interdit sur une table LKDV). Elles restent nulles sans effet.
drop function if exists admin.poles_summary();
drop function if exists admin.requests_overdue();
drop function if exists admin.sos_close(uuid, text);
drop function if exists admin.sos_ack(uuid);
drop function if exists admin.sos_overdue(integer);
drop function if exists admin.sos_board();
drop function if exists admin.inbox_item(text, text);
drop function if exists admin.moderation_inbox();
drop function if exists admin.inbox();
drop function if exists admin._inbox_json(boolean, text);
drop function if exists admin._inbox_rows();

drop policy if exists agent_proposals_read_staff on admin.agent_proposals;
drop table if exists admin.agent_proposals;
drop policy if exists sla_targets_read_staff on admin.sla_targets;
drop table if exists admin.sla_targets;
