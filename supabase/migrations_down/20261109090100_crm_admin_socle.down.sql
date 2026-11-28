-- M01 — rollback complet du socle (M02 doit être déroulée avant).
drop trigger if exists audit_log_no_truncate on admin.audit_log;
drop trigger if exists audit_log_no_delete on admin.audit_log;
drop trigger if exists audit_log_no_update on admin.audit_log;

drop function if exists admin.member_notice(text, text, boolean);
drop function if exists admin.log(text, text, text, text, text, jsonb, jsonb, uuid, uuid, boolean, bigint, boolean, text);
drop function if exists admin.audit_log_immutable();
drop table if exists admin.reason_codes;
drop table if exists admin.audit_log;
drop function if exists admin.assert_staff(public.admin_role);
drop function if exists admin.is_super_admin();
drop function if exists admin.is_staff();
drop function if exists admin.my_role();
drop function if exists admin.role_rank(public.admin_role);

-- M01 est la dernière remontée (ordre inverse) : tout le plan de contrôle est
-- déjà défait par M02…M15. On retire les derniers objets et le schéma.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'admin' and p.proname in ('log', 'is_service_context')
  loop
    execute 'drop function if exists ' || r.sig || ' cascade';
  end loop;
end $$;
drop schema if exists admin cascade;
