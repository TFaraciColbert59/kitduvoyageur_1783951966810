-- M13a — rollback du moteur et des enveloppes D1 à D6.
do $$
declare r record;
begin
  for r in select c.command from admin.commands c where c.domain in ('D1','D2','D3','D4','D5','D6') loop
    execute format('drop function if exists admin.cmd_%I(jsonb)', r.command);
  end loop;
end $$;

drop function if exists admin.audit_page(timestamptz, integer, jsonb);
drop function if exists admin.undo(bigint);
drop function if exists admin.approve_request(uuid, text);
drop function if exists admin.run_command_as(uuid, text, jsonb);
drop function if exists admin.run_command(text, jsonb);
drop function if exists admin._run_command(text, jsonb, uuid, uuid, uuid);
drop function if exists admin._apply(text, jsonb, uuid);
drop function if exists admin.command_is_external(text);
drop function if exists admin._actor_check(text, uuid);
