-- ═══════════════════════════════════════════════════════════════════════════
-- M05 — crm_moderation_states  (EX-LKDV-01 ; 03_MODELE_DE_DONNEES.md § 2)
-- État de modération porté par la ligne, verrou d'écriture et lecture bornée.
--
-- Problème réel relevé le 2026-11-09 : `community_posts` a une policy
-- permissive « Auth update community_posts » (auteur) — sans verrou, un auteur
-- pourrait remettre `moderation_state` à 'visible' après une décision.
--
-- Ce que fait cette migration, sur les 10 tables de contenu :
--   1. colonnes moderation_state / moderated_by / moderated_at / moderation_reason ;
--   2. déclencheur de verrou : seules les commandes du plan de contrôle
--      (set_config('lkdv.admin_cmd','on',true) posé dans la transaction) ET un
--      membre de l'équipe peuvent modifier ces colonnes ;
--   3. policy RESTRICTIVE de lecture : visible OU auteur OU équipe.
--
-- Aucune donnée existante n'est modifiée : la colonne est ajoutée avec sa
-- valeur par défaut (Postgres 11+ : pas de réécriture, pas d'UPDATE).
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- Prédicat d'équipe sans argument (utilisable dans une policy visant anon :
-- un anonyme obtient false et ne peut sonder l'appartenance de personne).
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.is_team()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select admin.is_team_member((select auth.uid()));
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Verrou des colonnes de modération
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.guard_moderation_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb := to_jsonb(old);
begin
  if (v_new ->> 'moderation_state') is not distinct from (v_old ->> 'moderation_state')
     and (v_new ->> 'moderated_by')   is not distinct from (v_old ->> 'moderated_by')
     and (v_new ->> 'moderated_at')   is not distinct from (v_old ->> 'moderated_at')
     and (v_new ->> 'moderation_reason') is not distinct from (v_old ->> 'moderation_reason')
  then
    return new;
  end if;

  -- Seule une commande admin, dans sa transaction, peut écrire ces colonnes.
  -- Trois chemins légitimes : membre d'équipe connecté, agent (auth.uid() nul,
  -- service_role), tâche planifiée. Une écriture PostgREST directe (rôle
  -- authenticated/anon, drapeau absent, current_user = authenticated/anon)
  -- est toujours refusée.
  if coalesce(current_setting('lkdv.admin_cmd', true), 'off') <> 'on'
     or (not admin.is_team_member((select auth.uid()))
         and (select auth.uid()) is not null)
  then
    raise exception 'Modération : cette colonne ne peut être modifiée que par une commande de l''équipe.'
      using errcode = '42501', hint = 'not_allowed';
  end if;

  return new;
end;
$$;

revoke all on function admin.is_team() from public, anon, authenticated;
-- Accordé à public : la policy est évaluée pour les visiteurs anonymes. La
-- fonction n'accepte aucun argument, elle ne révèle donc rien d'autre que
-- « l'appelant est-il de l'équipe ? » (toujours false sans session).
grant execute on function admin.is_team() to public, service_role;
revoke all on function admin.guard_moderation_columns() from public, anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- Colonnes, verrou et lecture pour les 10 tables de contenu
-- ───────────────────────────────────────────────────────────────────────────
do $$
declare
  t record;
  tables constant text[] := array[
    'community_posts','post_comments','carnet_comments','carnet_day_comments',
    'carnet_moment_comments','place_reviews','product_reviews','post_stories',
    'club_topics','club_topic_replies'
  ];
begin
  for i in 1 .. array_length(tables, 1) loop
    execute format('alter table public.%I add column if not exists moderation_state text not null default ''visible''', tables[i]);
    execute format('alter table public.%I add column if not exists moderated_by uuid', tables[i]);
    execute format('alter table public.%I add column if not exists moderated_at timestamptz', tables[i]);
    execute format('alter table public.%I add column if not exists moderation_reason text', tables[i]);

    execute format('alter table public.%I alter column moderation_state set default ''visible''', tables[i]);
    execute format('alter table public.%I alter column moderation_state set not null', tables[i]);

    execute format('alter table public.%I drop constraint if exists %I', tables[i], tables[i] || '_moderation_state_check');
    execute format('alter table public.%I add constraint %I check (moderation_state in (''visible'',''hidden'',''removed''))',
                   tables[i], tables[i] || '_moderation_state_check');

    execute format('comment on column public.%I.moderation_state is %L', tables[i],
      'M05 LKDV Control : visible = publié, hidden = masqué (réversible), removed = retiré (contenu conservé pour la preuve).');

    execute format('drop trigger if exists %I on public.%I', tables[i] || '_moderation_lock', tables[i]);
    execute format('create trigger %I before update on public.%I for each row execute function admin.guard_moderation_columns()',
                   tables[i] || '_moderation_lock', tables[i]);

    execute format('drop policy if exists moderation_read_guard on public.%I', tables[i]);
    execute format(
      'create policy moderation_read_guard on public.%I as restrictive for select to public '
      'using (moderation_state = ''visible'' or author_id = (select auth.uid()) or admin.is_team())',
      tables[i]);
  end loop;
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- Compteur de contenus masqués (lecture équipe, pour la file et le technique)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.moderation_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v jsonb := '{}'::jsonb; t text; n bigint;
begin
  if not admin.is_team_member((select auth.uid())) then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;

  foreach t in array array['community_posts','post_comments','carnet_comments','carnet_day_comments',
                           'carnet_moment_comments','place_reviews','product_reviews','post_stories',
                           'club_topics','club_topic_replies']
  loop
    execute format('select count(*) from public.%I where moderation_state <> ''visible''', t) into n;
    v := v || jsonb_build_object(t, n);
  end loop;

  return v;
end;
$$;

revoke all on function admin.moderation_counts() from public, anon;
grant execute on function admin.moderation_counts() to authenticated, service_role;

comment on function admin.guard_moderation_columns() is
  'M05 LKDV Control : verrou des colonnes de modération. Exige set_config(''lkdv.admin_cmd'',''on'',true) dans la transaction ET un membre d''équipe.';
