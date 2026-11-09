-- M14 — rollback.
drop function if exists admin.agent_stop_all(text);
drop function if exists admin.agent_stop(uuid, text);
drop function if exists admin.agent_propose(uuid, text, jsonb, text);
drop function if exists admin.agent_jobs_finish(uuid, text, jsonb, text);
drop function if exists admin.agent_jobs_enqueue(uuid, text, jsonb, text, timestamptz);
drop function if exists admin.agent_jobs_claim(uuid, integer);
drop function if exists admin.agents_overview();
drop function if exists admin.agent_authorize(text, uuid);
drop function if exists admin.agent_rate_consume(uuid, integer);
drop policy if exists agent_rate_read_staff on admin.agent_rate;
drop table if exists admin.agent_rate;
drop policy if exists agent_jobs_read_staff on admin.agent_jobs;
drop table if exists admin.agent_jobs;
delete from admin.agents where auth_user_id is null;
alter table admin.agents drop constraint if exists agents_name_unique;
