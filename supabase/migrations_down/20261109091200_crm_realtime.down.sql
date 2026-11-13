-- M12 — rollback : les déclencheurs d'abord (ils dépendent des fonctions),
-- puis les fonctions et la policy.
do $$
declare t record;
  sources constant text[][] := array[
    ['public','post_reports'], ['public','comment_reports'], ['public','story_reports'],
    ['public','club_reports'], ['public','group_reports'], ['public','place_reports'],
    ['public','marketplace_reports'], ['public','terrain_reports'],
    ['public','sos_alerts'], ['public','support_tickets'], ['public','support_messages'],
    ['public','alerts'],
    ['admin','requests'], ['admin','audit_log'], ['admin','agent_proposals'], ['admin','strikes']
  ];
begin
  for i in 1 .. array_length(sources, 1) loop
    if to_regclass(sources[i][1] || '.' || sources[i][2]) is not null then
      execute format('drop trigger if exists crm_rt_%s on %I.%I', sources[i][2], sources[i][1], sources[i][2]);
    end if;
  end loop;
end $$;

drop function if exists admin.realtime_diag();
drop function if exists admin.rt_notify();
drop function if exists admin.rt_log_error(text, text);

drop policy if exists crm_staff_receive_admin_topics on realtime.messages;

do $$
begin
  if exists (select 1 from pg_publication_tables
              where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'community_posts') then
    alter publication supabase_realtime drop table public.community_posts;
  end if;
exception when others then null;
end $$;
