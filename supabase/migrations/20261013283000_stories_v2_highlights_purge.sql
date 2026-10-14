-- ═══════════════════════════════════════════════════════════════════════════
-- STORIES V2 — Phase 06 : albums À la une + index de purge (archives préservées)
-- Appliquée en production via MCP le 2026-10-13 (idempotent, rejouable).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Highlights : regroupements pérennes choisis par l'auteur, qui référencent
-- des stories ; la visibilité des stories référencées reste contrôlée par
-- can_view_story au moment de la lecture (aucun élargissement d'audience).
-- Purge : l'index partiel (expires_at, archived_at IS NULL) sert la tâche
-- serveur /api/cron/purge-stories — une story archivée survit à l'expiration.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.story_highlights (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  cover_story_id uuid references public.post_stories(id) on delete set null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists story_highlights_owner_idx on public.story_highlights (owner_id, position);
alter table public.story_highlights enable row level security;
drop policy if exists story_highlights_read_authenticated on public.story_highlights;
create policy story_highlights_read_authenticated on public.story_highlights for select to authenticated using (true);
drop policy if exists story_highlights_write_owner on public.story_highlights;
create policy story_highlights_write_owner on public.story_highlights
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and not public.is_anonymous_session());
revoke all on public.story_highlights from anon;
grant select, insert, update, delete on public.story_highlights to authenticated;

create table if not exists public.story_highlight_items (
  highlight_id uuid not null references public.story_highlights(id) on delete cascade,
  story_id uuid not null references public.post_stories(id) on delete cascade,
  position int not null default 0,
  added_at timestamptz not null default now(),
  primary key (highlight_id, story_id)
);
create index if not exists story_highlight_items_story_idx on public.story_highlight_items (story_id);
alter table public.story_highlight_items enable row level security;
drop policy if exists story_highlight_items_read_authenticated on public.story_highlight_items;
create policy story_highlight_items_read_authenticated on public.story_highlight_items for select to authenticated using (true);
drop policy if exists story_highlight_items_write_owner on public.story_highlight_items;
create policy story_highlight_items_write_owner on public.story_highlight_items
  for all to authenticated
  using (exists (select 1 from public.story_highlights h where h.id = highlight_id and h.owner_id = auth.uid()))
  with check (exists (select 1 from public.story_highlights h where h.id = highlight_id and h.owner_id = auth.uid()) and not public.is_anonymous_session());
revoke all on public.story_highlight_items from anon;
grant select, insert, update, delete on public.story_highlight_items to authenticated;

create index if not exists post_stories_purge_idx on public.post_stories (expires_at) where archived_at is null;

comment on table public.story_highlights is 'Stories V2 — albums À la une : regroupements pérennes choisis par l''auteur (référencent des stories ; la visibilité des stories reste contrôlée par can_view_story).';
