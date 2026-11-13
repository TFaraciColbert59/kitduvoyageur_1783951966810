-- Lot C02 — préférences granulaires de contribution aux agrégats (K7.06, S6.17).
--
-- Une seule ligne par utilisateur, fail-closed :
--   • aucune ligne = aucune contribution ;
--   • `global_heatmap_opt_out = true` force `global_heatmap = false` (contrainte) ;
--   • les trois finalités restent indépendantes.
--
-- La table n'est jamais lisible par un tiers : la heatmap communautaire est
-- calculée côté serveur avec le client service_role après lecture de ces
-- consentements, puis agrégée avant réponse.

begin;

create table if not exists public.heatmap_contribution_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  global_heatmap_opt_out boolean not null default true,
  global_heatmap boolean not null default false,
  route_recommendations boolean not null default false,
  mobility_aggregates boolean not null default false,
  revision integer not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now(),
  constraint heatmap_contribution_opt_out_consistency
    check (global_heatmap = (not global_heatmap_opt_out))
);

comment on table public.heatmap_contribution_preferences is
  'C02/K7.06/S6.17 — consentement explicite et granulaire aux agrégats de heatmap, recommandations et mobilité. Absence de ligne = refus.';

alter table public.heatmap_contribution_preferences enable row level security;

drop policy if exists heatmap_contribution_preferences_select_own
  on public.heatmap_contribution_preferences;
create policy heatmap_contribution_preferences_select_own
  on public.heatmap_contribution_preferences
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists heatmap_contribution_preferences_insert_own
  on public.heatmap_contribution_preferences;
create policy heatmap_contribution_preferences_insert_own
  on public.heatmap_contribution_preferences
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists heatmap_contribution_preferences_update_own
  on public.heatmap_contribution_preferences;
create policy heatmap_contribution_preferences_update_own
  on public.heatmap_contribution_preferences
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists heatmap_contribution_preferences_delete_own
  on public.heatmap_contribution_preferences;
create policy heatmap_contribution_preferences_delete_own
  on public.heatmap_contribution_preferences
  for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete
  on public.heatmap_contribution_preferences to authenticated;
grant all on public.heatmap_contribution_preferences to service_role;

drop trigger if exists heatmap_contribution_preferences_updated_at
  on public.heatmap_contribution_preferences;
create trigger heatmap_contribution_preferences_updated_at
  before update on public.heatmap_contribution_preferences
  for each row execute function public.set_updated_at();

commit;
