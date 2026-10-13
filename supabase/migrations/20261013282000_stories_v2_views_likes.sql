-- ═══════════════════════════════════════════════════════════════════════════
-- STORIES V2 — Phase 04/05 : vues uniques et likes (RLS complète)
-- Appliquée en production via MCP le 2026-10-13 (idempotent, rejouable).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Vues : une ligne par (story, viewer), première/dernière vue horodatées ;
-- écriture par le viewer autorisé (can_view_story), lecture par le viewer
-- lui-même (rail lu/non lu) et par l'auteur de la story (liste privée).
-- Likes : une ligne par (story, user), idempotent par clé primaire ;
-- jamais de compteur public par défaut.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.story_views (
  story_id uuid not null references public.post_stories(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);
alter table public.story_views enable row level security;
drop policy if exists story_views_insert_own on public.story_views;
create policy story_views_insert_own on public.story_views
  for insert to authenticated
  with check (viewer_id = auth.uid() and not public.is_anonymous_session() and public.can_view_story(story_id, auth.uid()));
drop policy if exists story_views_update_own on public.story_views;
create policy story_views_update_own on public.story_views
  for update to authenticated
  using (viewer_id = auth.uid())
  with check (viewer_id = auth.uid());
drop policy if exists story_views_read_own_or_author on public.story_views;
create policy story_views_read_own_or_author on public.story_views
  for select to authenticated
  using (
    viewer_id = auth.uid()
    or exists (select 1 from public.post_stories s where s.id = story_id and s.author_id = auth.uid())
  );
revoke all on public.story_views from anon;
grant select, insert, update on public.story_views to authenticated;

create table if not exists public.story_likes (
  story_id uuid not null references public.post_stories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);
alter table public.story_likes enable row level security;
drop policy if exists story_likes_insert_own on public.story_likes;
create policy story_likes_insert_own on public.story_likes
  for insert to authenticated
  with check (user_id = auth.uid() and not public.is_anonymous_session() and public.can_view_story(story_id, auth.uid()));
drop policy if exists story_likes_delete_own on public.story_likes;
create policy story_likes_delete_own on public.story_likes
  for delete to authenticated
  using (user_id = auth.uid());
drop policy if exists story_likes_read_own_or_author on public.story_likes;
create policy story_likes_read_own_or_author on public.story_likes
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.post_stories s where s.id = story_id and s.author_id = auth.uid())
  );
revoke all on public.story_likes from anon;
grant select, insert, delete on public.story_likes to authenticated;

create index if not exists story_views_viewer_idx on public.story_views (viewer_id);
create index if not exists story_likes_user_idx on public.story_likes (user_id);
