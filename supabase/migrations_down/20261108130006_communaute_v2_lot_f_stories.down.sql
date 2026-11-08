-- Rollback du lot F Communauté v2 (20261108130006) : colonnes de story.
-- Règle 06 § 3.5 : refus si une colonne supprimée contient des données.

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
    ('post_stories', 'trim_start_ms', 'trim_start_ms is not null'),
    ('post_stories', 'trim_end_ms', 'trim_end_ms is not null'),
    ('post_stories', 'linked_carnet_id', 'linked_carnet_id is not null'),
    ('post_stories', 'linked_carnet_day', 'linked_carnet_day is not null'),
    ('post_stories', 'alt_text', 'alt_text is not null')
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

drop index if exists public.idx_post_stories_linked_carnet;

alter table public.post_stories
  drop column if exists alt_text,
  drop column if exists linked_carnet_day,
  drop column if exists linked_carnet_id,
  drop column if exists trim_end_ms,
  drop column if exists trim_start_ms;
