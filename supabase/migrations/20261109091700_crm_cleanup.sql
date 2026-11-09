-- ═══════════════════════════════════════════════════════════════════════════
-- M15 — crm_cleanup  (03_MODELE_DE_DONNEES.md § 2, dernière migration)
--
-- Ce que cette migration NE fait PAS : supprimer `public.admin_audit_log` ni
-- `public.admin_audit_logs`.
--   Preuve (relevé 2026-11-09, grep dans le dépôt) :
--     src/app/admin/produits/AdminProductsManager.tsx lit et écrit
--     `admin_audit_logs` (lignes 296, 428, 478). L'écran /admin de LKDV est
--     encore en production ; le supprimer casserait cette page.
--   → On conserve les deux tables, on les documente comme héritées, et on
--     branche un pont : toute écriture héritée est recopiée dans le journal
--     unique `admin.audit_log` (ajout seul, M01). Aucune donnée n'est perdue,
--     aucun lecteur n'est cassé.
--
-- `user_profiles.role` reste la colonne dérivée lue par LKDV. Elle est
-- verrouillée côté membre par le déclencheur `guard_user_profile_privileged_columns`
-- (M06) et peut être resynchronisée à tout moment par
-- `admin.sync_profile_admin_role()` (jamais exécutée automatiquement ici).
-- ═══════════════════════════════════════════════════════════════════════════

comment on table public.admin_audit_log is
  'HÉRITÉ (remplacé par admin.audit_log, M01). Conservé : rien ne le lit côté CRM. Aucune nouvelle écriture ne doit y être ajoutée ; un pont recopie les écritures dans admin.audit_log.';
comment on table public.admin_audit_logs is
  'HÉRITÉ (remplacé par admin.audit_log, M01). Conservé parce que src/app/admin/produits/AdminProductsManager.tsx le lit et l''écrit encore. Un pont recopie les écritures dans admin.audit_log. Suppression possible seulement après retrait de cet écran (relevé du 2026-11-09).';

-- ───────────────────────────────────────────────────────────────────────────
-- Pont 1 : public.admin_audit_log → admin.audit_log
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.bridge_legacy_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into admin.audit_log (
      at, actor_id, actor_kind, actor_role, action, target_type, target_id,
      before, after
    ) values (
      coalesce(new.created_at, now()),
      coalesce(new.admin_id, '00000000-0000-0000-0000-000000000000'::uuid),
      'human', 'legacy',
      left(coalesce(nullif(btrim(new.action), ''), 'legacy_action'), 80),
      left(coalesce(nullif(btrim(new.cible_type), ''), 'legacy'), 60),
      coalesce(new.cible_id::text, '-'),
      new.avant::jsonb, new.apres::jsonb
    );
  exception when others then
    perform admin.rt_log_error('bridge_admin_audit_log', sqlerrm);
  end;
  return null;
end;
$$;

revoke all on function admin.bridge_legacy_audit_log() from public, anon, authenticated, service_role;

drop trigger if exists crm_bridge_admin_audit_log on public.admin_audit_log;
create trigger crm_bridge_admin_audit_log
  after insert on public.admin_audit_log
  for each row execute function admin.bridge_legacy_audit_log();

-- ───────────────────────────────────────────────────────────────────────────
-- Pont 2 : public.admin_audit_logs → admin.audit_log
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.bridge_legacy_audit_logs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into admin.audit_log (
      at, actor_id, actor_kind, actor_role, action, target_type, target_id,
      before, after
    ) values (
      coalesce(new.created_at, now()),
      '00000000-0000-0000-0000-000000000000'::uuid,
      'human', 'legacy',
      left(coalesce(nullif(btrim(new.action), ''), 'legacy_action'), 80),
      left(coalesce(nullif(btrim(new.target_table), ''), 'legacy'), 60),
      coalesce(new.target_id, '-'),
      new.old_data::jsonb, new.new_data::jsonb
    );
  exception when others then
    perform admin.rt_log_error('bridge_admin_audit_logs', sqlerrm);
  end;
  return null;
end;
$$;

revoke all on function admin.bridge_legacy_audit_logs() from public, anon, authenticated, service_role;

drop trigger if exists crm_bridge_admin_audit_logs on public.admin_audit_logs;
create trigger crm_bridge_admin_audit_logs
  after insert on public.admin_audit_logs
  for each row execute function admin.bridge_legacy_audit_logs();

-- ───────────────────────────────────────────────────────────────────────────
-- Colonne dérivée : resynchronisation explicite (jamais automatique)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.sync_profile_admin_role()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_to_admin integer := 0; v_to_user integer := 0;
begin
  -- Ne touche que les lignes réellement différentes (attendu : 0).
  with done as (
    update public.user_profiles up
       set role = 'admin', updated_at = now()
     where up.id in (select ar.user_id from public.admin_roles ar where ar.role = 'super_admin')
       and up.role <> 'admin'
    returning 1
  ) select count(*) into v_to_admin from done;

  with done as (
    update public.user_profiles up
       set role = 'user', updated_at = now()
     where up.role = 'admin'
       and up.id not in (select ar.user_id from public.admin_roles ar where ar.role = 'super_admin')
    returning 1
  ) select count(*) into v_to_user from done;

  if v_to_admin > 0 or v_to_user > 0 then
    perform admin.log('sync_profile_admin_role', 'system', 'user_profiles',
                      null, 'Resynchronisation de la colonne dérivée role',
                      null, jsonb_build_object('to_admin', v_to_admin, 'to_user', v_to_user));
  end if;

  return jsonb_build_object('ok', true, 'to_admin', v_to_admin, 'to_user', v_to_user);
end;
$$;

revoke all on function admin.sync_profile_admin_role() from public, anon, authenticated;
grant execute on function admin.sync_profile_admin_role() to service_role;

comment on function admin.sync_profile_admin_role() is
  'M15 LKDV Control : recolle user_profiles.role sur admin_roles(super_admin). À lancer par une tâche planifiée, jamais automatiquement.';

-- ───────────────────────────────────────────────────────────────────────────
-- Contrôle de sortie : rien de cassé, tout est en place
-- ───────────────────────────────────────────────────────────────────────────
do $$
declare
  v_cmds integer;
  v_fns integer;
  v_pending integer;
begin
  select count(*) into v_cmds from admin.commands;
  select count(*) into v_fns
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'admin' and p.proname like 'cmd\_%';

  if v_cmds <> 144 or v_fns <> 144 then
    raise exception 'M15 : registre % / fonctions % (144 attendus)', v_cmds, v_fns;
  end if;

  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'public' and c.relname = 'admin_audit_log')
     or not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                     where n.nspname = 'public' and c.relname = 'admin_audit_logs') then
    raise exception 'M15 : une table de journal héritée a disparu (jamais attendu)';
  end if;

  select count(*) into v_pending from admin.requests where status = 'pending';
  raise notice 'M15 : socle en place — 144 commandes, 144 fonctions, demandes en attente : %', v_pending;
end $$;
