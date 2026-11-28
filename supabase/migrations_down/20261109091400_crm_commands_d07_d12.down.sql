-- M13b — rollback des enveloppes D7 à D12.
do $$
declare r record;
begin
  for r in select c.command from admin.commands c where c.domain in ('D7','D8','D9','D10','D11','D12') loop
    execute format('drop function if exists admin.cmd_%I(jsonb)', r.command);
  end loop;
end $$;
