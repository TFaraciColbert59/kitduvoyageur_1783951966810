-- ═══════════════════════════════════════════════════════════════════════════
-- M13c — commandes des domaines D13 à D19, commandes transverses restantes,
--         et contrôle final « 144 commandes présentes, aucune orpheline ».
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare r record;
begin
  for r in select c.command from admin.commands c
            where c.domain in ('D13','D14','D15','D16','D17','D18','D19') order by c.sort
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

-- ───────────────────────────────────────────────────────────────────────────
-- Commandes transverses (T-03, T-10)
-- ───────────────────────────────────────────────────────────────────────────
-- T-03 : élévation temporaire d'un membre de pôle hors de son périmètre.
create or replace function admin.elevate(p_command text, p_reason text, p_minutes integer default 60)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_id uuid;
  v_minutes integer := greatest(5, least(coalesce(p_minutes, 60), 480));
begin
  if v_me is null or not admin.is_team_member(v_me) then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;
  if coalesce((select auth.jwt()) ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'CRM : double authentification requise.' using errcode = '42501', hint = 'mfa_required';
  end if;
  if nullif(btrim(p_reason), '') is null or length(btrim(p_reason)) < 5 then
    raise exception 'CRM : un motif est requis pour une élévation.' using errcode = '22023', hint = 'reason_required';
  end if;
  if not exists (select 1 from admin.commands c where c.command = p_command) then
    raise exception 'CRM : commande inconnue (%).', p_command using errcode = '0A000', hint = 'unknown_command';
  end if;

  insert into admin.elevations (user_id, command, reason, granted_by, expires_at)
  values (v_me, p_command, btrim(p_reason), v_me, now() + make_interval(mins => v_minutes))
  returning id into v_id;

  perform admin.log('elevate', 'elevation', v_id::text, null, btrim(p_reason), null,
                    jsonb_build_object('command', p_command, 'minutes', v_minutes));

  return jsonb_build_object('ok', true, 'id', v_id, 'expiresInMinutes', v_minutes,
                            'message', 'Élévation accordée. Elle est journalisée et expire automatiquement.');
end;
$$;

-- T-10 : réglages (PRIA responsable ou super admin).
create or replace function admin.settings_edit(p_key text, p_value jsonb, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_role text;
  v_old jsonb;
  v_pole text;
begin
  if v_me is null or not admin.is_team_member(v_me) then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;
  if coalesce((select auth.jwt()) ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'CRM : double authentification requise.' using errcode = '42501', hint = 'mfa_required';
  end if;
  v_role := admin.my_role();
  v_pole := (select c.pole_code from admin.commands c where c.command = 'ai_quota_raise');
  if v_role <> 'super_admin' and not admin.is_responsable(v_pole) then
    raise exception 'CRM : réglages réservés au responsable Produit et IA ou au super admin.' using errcode = '42501', hint = 'role_too_low';
  end if;
  if nullif(btrim(p_key), '') is null or p_value is null then
    raise exception 'CRM : clé et valeur requises.' using errcode = '22023', hint = 'invalid_params';
  end if;

  select s.value into v_old from admin.app_settings s where s.key = p_key;
  if v_old is null then
    raise exception 'CRM : réglage inconnu (%).', p_key using errcode = 'P0002', hint = 'not_found';
  end if;

  update admin.app_settings
     set value = p_value, updated_at = now(), updated_by = v_me
   where key = p_key;

  perform admin.log('settings_edit', 'setting', p_key, null, p_reason, v_old, p_value);

  return jsonb_build_object('ok', true, 'key', p_key, 'before', v_old, 'after', p_value);
end;
$$;

revoke all on function admin.elevate(text, text, integer) from public, anon;
revoke all on function admin.settings_edit(text, jsonb, text) from public, anon;
grant execute on function admin.elevate(text, text, integer) to authenticated;
grant execute on function admin.settings_edit(text, jsonb, text) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- Contrôle final : 144 commandes, 144 fonctions, aucun écart
-- ───────────────────────────────────────────────────────────────────────────
do $$
declare
  v_registry integer;
  v_functions integer;
  v_missing text;
begin
  select count(*) into v_registry from admin.commands;

  select count(*) into v_functions
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'admin' and p.proname like 'cmd\_%' and pg_get_function_identity_arguments(p.oid) = 'p jsonb';

  if v_registry <> 144 then
    raise exception 'M13 : % lignes dans admin.commands, 144 attendues', v_registry;
  end if;
  if v_functions <> 144 then
    raise exception 'M13 : % fonctions admin.cmd_*(jsonb), 144 attendues', v_functions;
  end if;

  select string_agg(c.command, ', ') into v_missing
    from admin.commands c
   where not exists (
     select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'admin' and p.proname = 'cmd_' || c.command
   );
  if v_missing is not null then
    raise exception 'M13 : commandes sans fonction : %', v_missing;
  end if;
end $$;

comment on function admin.elevate(text, text, integer) is
  'LKDV Control T-03 : élévation temporaire (1 h par défaut, 8 h maximum), motivée et journalisée.';
comment on function admin.settings_edit(text, jsonb, text) is
  'LKDV Control T-10 : modification d''un réglage existant de admin.app_settings. Responsable PRIA ou super admin.';
