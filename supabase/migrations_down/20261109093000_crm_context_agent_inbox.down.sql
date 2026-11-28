-- Rollback de 20261109093000_crm_context_agent_inbox.sql
-- Retire les trois RPC de lecture ajoutées (aucune donnée métier touchée).

drop function if exists admin.agent_inbox(text);
drop function if exists admin.order_detail(uuid);
drop function if exists admin.my_context();
