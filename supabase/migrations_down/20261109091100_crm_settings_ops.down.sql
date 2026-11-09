-- M11 — rollback.
drop function if exists admin.stripe_event_ingest(text, text, jsonb);
drop policy if exists stripe_events_read_staff on admin.stripe_events;
drop table if exists admin.stripe_events;

drop function if exists admin.technique_status();
drop function if exists admin.purge_logs(integer);
drop function if exists ops.job_run_finish(bigint, text, jsonb, text);
drop function if exists ops.job_run_start(text, text, jsonb);
drop table if exists ops.job_runs;
do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'ops') then
    drop schema ops;
  end if;
end $$;

drop function if exists public.app_settings_public();
drop policy if exists app_settings_read_staff on admin.app_settings;
drop table if exists admin.app_settings;
