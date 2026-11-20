-- ═══════════════════════════════════════════════════════════════════════════
-- M13b — commandes des domaines D7 à D12
-- Enveloppes fines admin.cmd_<nom>(p jsonb) → admin._run_command (M13a).
-- Aucune logique ici : le moteur, les droits et les effets sont en M13a.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare r record;
begin
  for r in select c.command from admin.commands c
            where c.domain in ('D7','D8','D9','D10','D11','D12') order by c.sort
  loop
    execute format($f$
      create or replace function admin.cmd_%I(p jsonb default '{}'::jsonb)
      returns jsonb language sql security definer set search_path = ''
      as $body$ select admin._run_command(%L, coalesce(p, '{}'::jsonb)); $body$;
    $f$, r.command, r.command);
    execute format('revoke all on function admin.cmd_%I(jsonb) from public, anon', r.command);
    execute format('grant execute on function admin.cmd_%I(jsonb) to authenticated', r.command);
  end loop;
end $$;
