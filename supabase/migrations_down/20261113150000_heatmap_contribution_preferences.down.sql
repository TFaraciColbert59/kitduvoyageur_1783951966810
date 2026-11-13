begin;

drop trigger if exists heatmap_contribution_preferences_updated_at
  on public.heatmap_contribution_preferences;
drop table if exists public.heatmap_contribution_preferences;

commit;
