create table if not exists public.story_comments (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.post_stories(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists story_comments_story_created_idx on public.story_comments (story_id, created_at asc);
alter table public.story_comments enable row level security;
drop policy if exists story_comments_read on public.story_comments;
create policy story_comments_read on public.story_comments for select to authenticated using (true);
drop policy if exists story_comments_insert_own on public.story_comments;
create policy story_comments_insert_own on public.story_comments for insert to authenticated with check (author_id = auth.uid());
drop policy if exists story_comments_delete_own on public.story_comments;
create policy story_comments_delete_own on public.story_comments for delete to authenticated using (author_id = auth.uid());
grant select, insert, delete on public.story_comments to authenticated;
