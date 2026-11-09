-- M15 — rollback (ne supprime aucune donnée métier).
drop trigger if exists crm_bridge_admin_audit_logs on public.admin_audit_logs;
drop trigger if exists crm_bridge_admin_audit_log on public.admin_audit_log;
drop function if exists admin.bridge_legacy_audit_logs();
drop function if exists admin.bridge_legacy_audit_log();
drop function if exists admin.sync_profile_admin_role();
comment on table public.admin_audit_log is null;
comment on table public.admin_audit_logs is null;
