-- ═══════════════════════════════════════════════════════════════════════════
-- M12 — crm_realtime  (EX-RT-01…04 ; 02_ARCHITECTURE.md § 7)
-- Canaux privés admin:*, réservés à l'équipe humaine (agents exclus).
-- Les déclencheurs n'envoient que des identifiants : aucune donnée personnelle
-- ne circule dans le payload (l'interface relit la ligne via une fonction
-- contrôlée). Un déclencheur ne bloque JAMAIS l'écriture d'origine.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- Policy des canaux admin:*
-- ───────────────────────────────────────────────────────────────────────────
drop policy if exists crm_staff_receive_admin_topics on realtime.messages;
create policy crm_staff_receive_admin_topics on realtime.messages
  for select to authenticated
  using (
    realtime.topic() like 'admin:%'
    and admin.is_team_member((select auth.uid()))
    and coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
  );

-- Un agent (compte de service) n'écoute aucun canal humain : il n'est pas
-- membre d'équipe (admin.is_team_member exclut les agents), la policy
-- ci-dessus le refuse donc déjà. Aucune policy permissive supplémentaire ici :
-- une seconde policy « permissive » élargirait les droits au lieu de les
-- restreindre.

-- ───────────────────────────────────────────────────────────────────────────
-- Journal technique des échecs d'émission
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.rt_log_error(p_source text, p_error text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.app_errors (scope, code, message)
  values ('crm-realtime', 'rt_send_failed', left(coalesce(p_source, '?') || ' : ' || coalesce(p_error, '?'), 900));
exception when others then
  null; -- jamais d'échec en cascade
end;
$$;

revoke all on function admin.rt_log_error(text, text) from public, anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- Émission
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.rt_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    text;
  v_topic text;
  v_row   jsonb;
begin
  begin
    v_row := to_jsonb(new);
    v_id := coalesce(v_row ->> 'id', (to_jsonb(old) ->> 'id'));
    v_topic := 'admin:' || tg_table_name;

    perform realtime.send(
      jsonb_build_object(
        'schema', tg_table_schema,
        'table', tg_table_name,
        'op', tg_op,
        'id', v_id
      ),
      'change',
      v_topic,
      true
    );
  exception when others then
    perform admin.rt_log_error(tg_table_schema || '.' || tg_table_name, sqlerrm);
  end;
  return null;
end;
$$;

revoke all on function admin.rt_notify() from public, anon, authenticated, service_role;

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
      execute format('drop trigger if exists crm_rt_%s on %I.%I',
                     sources[i][2], sources[i][1], sources[i][2]);
      execute format('create trigger crm_rt_%s after insert or update on %I.%I for each row execute function admin.rt_notify()',
                     sources[i][2], sources[i][1], sources[i][2]);
    end if;
  end loop;
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- EX-RT-04 : côté LKDV, un contenu masqué disparaît des écrans ouverts
-- ───────────────────────────────────────────────────────────────────────────
-- La table community_posts doit être publiée pour que le client LKDV reçoive
-- les changements d'état de modération. Idempotent.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'community_posts'
  ) then
    alter publication supabase_realtime add table public.community_posts;
  end if;
exception
  when duplicate_object then null;
  when undefined_object then
    -- publication absente sur une base éphémère : sans conséquence ici.
    null;
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- Diagnostic (écran /technique)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.realtime_diag()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not admin.is_staff() then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;

  return jsonb_build_object(
    'policy', exists (select 1 from pg_policies
                       where schemaname = 'realtime' and tablename = 'messages'
                         and policyname = 'crm_staff_receive_admin_topics'),
    'triggers', coalesce((
      select jsonb_agg(jsonb_build_object('schema', n.nspname, 'table', c.relname, 'name', t.tgname)
             order by n.nspname, c.relname)
        from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
       where t.tgname like 'crm_rt_%' and not t.tgisinternal
    ), '[]'::jsonb),
    'published', coalesce((
      select jsonb_agg(tablename order by tablename)
        from pg_publication_tables where pubname = 'supabase_realtime'
    ), '[]'::jsonb),
    'errors24h', (select count(*) from public.app_errors
                   where scope = 'crm-realtime' and at > now() - interval '24 hours')
  );
end;
$$;

revoke all on function admin.realtime_diag() from public, anon;
grant execute on function admin.realtime_diag() to authenticated, service_role;

comment on function admin.rt_notify() is
  'M12 LKDV Control : émet un changement sur admin:<table> (canal privé). Payload = schéma, table, opération, identifiant. Jamais de donnée personnelle, jamais de blocage de l''écriture d''origine.';
