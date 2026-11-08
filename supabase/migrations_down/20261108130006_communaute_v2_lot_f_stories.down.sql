-- Rollback du lot F Communauté v2 (20261108130006) : colonnes de story.
-- Règle 06 § 3.5 : refus si une colonne supprimée contient des données.

do $$
begin
  if exists (
    select 1 from public.post_stories
     where trim_start_ms is not null
        or trim_end_ms is not null
        or linked_carnet_id is not null
        or linked_carnet_day is not null
        or alt_text is not null
  ) then
    raise exception 'Rollback lot F refusé : les colonnes de story (trim, carnet, alt) contiennent des données.';
  end if;
end
$$;

drop index if exists public.idx_post_stories_linked_carnet;

alter table public.post_stories
  drop column if exists alt_text,
  drop column if exists linked_carnet_day,
  drop column if exists linked_carnet_id,
  drop column if exists trim_end_ms,
  drop column if exists trim_start_ms;
