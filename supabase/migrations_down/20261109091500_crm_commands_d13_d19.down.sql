-- M13c — rollback des enveloppes D13 à D19 et des transverses.
do $$
declare r record;
begin
  for r in select c.command from admin.commands c where c.domain in ('D13','D14','D15','D16','D17','D18','D19') loop
    execute format('drop function if exists admin.cmd_%I(jsonb)', r.command);
  end loop;
end $$;

drop function if exists admin.settings_edit(text, jsonb, text);
drop function if exists admin.elevate(text, text, integer);
