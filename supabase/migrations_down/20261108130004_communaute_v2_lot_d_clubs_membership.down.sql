-- Rollback du lot D Communauté v2 (20261108130004) :
-- RPC d'adhésion aux clubs + colonnes de club.
-- Règle 06 § 3.5 : refus si une colonne supprimée contient des données.
--
-- Note `clubs.rules` : la colonne a été créée par ce chantier (vérifié absent
-- en production et dans la baseline du 11 sept. avant application). Le .down ne
-- la retire donc que si elle est vide. Si un autre chantier l'a créée entre
-- temps, adapter ce fichier avant de l'exécuter (ne jamais supprimer une
-- colonne préexistante).

-- ── RPC ────────────────────────────────────────────────────────────────────
drop function if exists public.review_join_request(uuid, boolean);
drop function if exists public.cancel_join_request(uuid);
drop function if exists public.leave_club(uuid);
drop function if exists public.join_club(uuid, jsonb);

drop index if exists public.idx_club_join_requests_club_status;

-- ── Contrôles de données ───────────────────────────────────────────────────
-- Contrôles de données AVANT suppression. Le bloc est rejouable : chaque
-- colonne n'est contrôlée que si elle existe encore (un second passage ne
-- casse rien), et le rollback s'arrête si une seule contient des données.
do $$
declare
  v_check record;
  v_count bigint;
begin
  for v_check in
    select * from (values
    ('clubs', 'rules', 'rules is not null and btrim(rules) <> '''''),
    ('clubs', 'join_questions', 'join_questions is distinct from ''[]''::jsonb'),
    ('clubs', 'activities', 'cardinality(coalesce(activities, ''{}''::text[])) > 0'),
    ('clubs', 'location_label', 'location_label is not null'),
    ('club_join_requests', 'answers', 'answers is distinct from ''[]''::jsonb')
    ) as t(table_name, column_name, condition)
  loop
    if exists (
      select 1 from information_schema.columns ic
       where ic.table_schema = 'public'
         and ic.table_name = v_check.table_name
         and ic.column_name = v_check.column_name
    ) then
      execute format('select count(*) from public.%I where %s', v_check.table_name, v_check.condition)
        into v_count;
      if v_count > 0 then
        raise exception 'Rollback refusé : public.%.% contient % valeur(s). Ne rien supprimer après le premier usage réel (06 § 3.5).',
          v_check.table_name, v_check.column_name, v_count;
      end if;
    end if;
  end loop;
end $$;

-- ── Colonnes ───────────────────────────────────────────────────────────────
alter table public.club_join_requests drop column if exists answers;

alter table public.clubs
  drop column if exists location_label,
  drop column if exists activities,
  drop column if exists join_questions,
  drop column if exists rules;

-- ── Helpers internes (posés ici, réutilisés par le lot E) ──────────────────
drop function if exists public.lkdv_recount_club_members(uuid);
drop function if exists public.lkdv_require_actor();
drop function if exists public.lkdv_raise(text, text, text);
