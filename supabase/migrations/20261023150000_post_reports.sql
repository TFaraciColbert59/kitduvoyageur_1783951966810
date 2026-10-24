-- Signalements de publications : table dédiée et traçable.
-- Le code client utilise un fallback `comment_reports` tant que cette
-- migration n'est pas appliquée sur un environnement donné.
create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  reporter_id uuid references public.user_profiles(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'pending' check (status in ('pending','reviewed','dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create index if not exists post_reports_post_idx on public.post_reports (post_id);
create index if not exists post_reports_status_idx on public.post_reports (status, created_at desc);

alter table public.post_reports enable row level security;

drop policy if exists post_reports_insert_own on public.post_reports;
create policy post_reports_insert_own on public.post_reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists post_reports_select_own_or_moderator on public.post_reports;
create policy post_reports_select_own_or_moderator on public.post_reports
  for select to authenticated
  using (reporter_id = auth.uid() or public.is_moderateur() or public.is_admin());

drop policy if exists post_reports_moderator_update on public.post_reports;
create policy post_reports_moderator_update on public.post_reports
  for update to authenticated
  using (public.is_moderateur() or public.is_admin())
  with check (public.is_moderateur() or public.is_admin());
