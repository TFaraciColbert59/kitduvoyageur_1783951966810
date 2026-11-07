-- Migration Lot C : engagement par moment (likes, commentaires, saves) pour Carnet v2

-- 1. Helper d'accès au moment basé sur le carnet parent
create or replace function public.can_view_carnet_moment(p_moment uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.carnet_moments m
    where m.id = p_moment
      and public.can_view_carnet(m.carnet_id)
  );
$$;

revoke all on function public.can_view_carnet_moment(uuid) from public;
grant execute on function public.can_view_carnet_moment(uuid) to authenticated, anon;

-- 2. Likes par moment
create table if not exists public.carnet_moment_likes (
  moment_id uuid not null references public.carnet_moments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (moment_id, user_id)
);

create index if not exists carnet_moment_likes_moment_idx
  on public.carnet_moment_likes (moment_id);

create index if not exists carnet_moment_likes_user_idx
  on public.carnet_moment_likes (user_id);

alter table public.carnet_moment_likes enable row level security;

drop policy if exists carnet_moment_likes_select on public.carnet_moment_likes;
create policy carnet_moment_likes_select on public.carnet_moment_likes
  for select using (public.can_view_carnet_moment(moment_id));

drop policy if exists carnet_moment_likes_insert on public.carnet_moment_likes;
create policy carnet_moment_likes_insert on public.carnet_moment_likes
  for insert with check (
    user_id = (select auth.uid())
    and public.can_view_carnet_moment(moment_id)
  );

drop policy if exists carnet_moment_likes_delete on public.carnet_moment_likes;
create policy carnet_moment_likes_delete on public.carnet_moment_likes
  for delete using (user_id = (select auth.uid()));

-- 3. Commentaires par moment
create table if not exists public.carnet_moment_comments (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references public.carnet_moments(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  parent_id uuid references public.carnet_moment_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists carnet_moment_comments_moment_idx
  on public.carnet_moment_comments (moment_id, created_at);

create index if not exists carnet_moment_comments_author_idx
  on public.carnet_moment_comments (author_id);

create index if not exists carnet_moment_comments_parent_idx
  on public.carnet_moment_comments (parent_id);

alter table public.carnet_moment_comments enable row level security;

drop policy if exists carnet_moment_comments_select on public.carnet_moment_comments;
create policy carnet_moment_comments_select on public.carnet_moment_comments
  for select using (public.can_view_carnet_moment(moment_id));

drop policy if exists carnet_moment_comments_insert on public.carnet_moment_comments;
create policy carnet_moment_comments_insert on public.carnet_moment_comments
  for insert with check (
    author_id = (select auth.uid())
    and public.can_view_carnet_moment(moment_id)
  );

drop policy if exists carnet_moment_comments_update on public.carnet_moment_comments;
create policy carnet_moment_comments_update on public.carnet_moment_comments
  for update using (
    author_id = (select auth.uid())
    or exists (
      select 1 from public.carnet_moments m
      join public.carnets c on c.id = m.carnet_id
      where m.id = moment_id and c.author_id = (select auth.uid())
    )
  )
  with check (
    author_id = (select auth.uid())
    or exists (
      select 1 from public.carnet_moments m
      join public.carnets c on c.id = m.carnet_id
      where m.id = moment_id and c.author_id = (select auth.uid())
    )
  );

drop policy if exists carnet_moment_comments_delete on public.carnet_moment_comments;
create policy carnet_moment_comments_delete on public.carnet_moment_comments
  for delete using (
    author_id = (select auth.uid())
    or exists (
      select 1 from public.carnet_moments m
      join public.carnets c on c.id = m.carnet_id
      where m.id = moment_id and c.author_id = (select auth.uid())
    )
  );

-- 4. Enregistrements (saves) de moment
create table if not exists public.carnet_moment_saves (
  moment_id uuid not null references public.carnet_moments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (moment_id, user_id)
);

create index if not exists carnet_moment_saves_user_idx
  on public.carnet_moment_saves (user_id);

alter table public.carnet_moment_saves enable row level security;

drop policy if exists carnet_moment_saves_select on public.carnet_moment_saves;
create policy carnet_moment_saves_select on public.carnet_moment_saves
  for select using (user_id = (select auth.uid()));

drop policy if exists carnet_moment_saves_insert on public.carnet_moment_saves;
create policy carnet_moment_saves_insert on public.carnet_moment_saves
  for insert with check (
    user_id = (select auth.uid())
    and public.can_view_carnet_moment(moment_id)
  );

drop policy if exists carnet_moment_saves_delete on public.carnet_moment_saves;
create policy carnet_moment_saves_delete on public.carnet_moment_saves
  for delete using (user_id = (select auth.uid()));
