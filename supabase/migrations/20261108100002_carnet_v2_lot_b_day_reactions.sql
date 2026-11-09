-- Migration Lot B : réactions par jour (likes et commentaires) pour Carnet v2

-- 1. Table des mentions j'aime par jour
create table if not exists public.carnet_day_likes (
  carnet_id uuid not null references public.carnets(id) on delete cascade,
  jour_numero int not null check (jour_numero >= 1),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (carnet_id, jour_numero, user_id)
);

create index if not exists carnet_day_likes_carnet_jour_idx
  on public.carnet_day_likes (carnet_id, jour_numero);

create index if not exists carnet_day_likes_user_id_idx
  on public.carnet_day_likes (user_id);

alter table public.carnet_day_likes enable row level security;

drop policy if exists carnet_day_likes_select on public.carnet_day_likes;
create policy carnet_day_likes_select on public.carnet_day_likes
  for select using (public.can_view_carnet(carnet_id));

drop policy if exists carnet_day_likes_insert on public.carnet_day_likes;
create policy carnet_day_likes_insert on public.carnet_day_likes
  for insert with check (
    user_id = (select auth.uid())
    and public.can_view_carnet(carnet_id)
  );

drop policy if exists carnet_day_likes_delete on public.carnet_day_likes;
create policy carnet_day_likes_delete on public.carnet_day_likes
  for delete using (user_id = (select auth.uid()));

-- 2. Table des commentaires par jour
create table if not exists public.carnet_day_comments (
  id uuid primary key default gen_random_uuid(),
  carnet_id uuid not null references public.carnets(id) on delete cascade,
  jour_numero int not null check (jour_numero >= 1),
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  parent_id uuid references public.carnet_day_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists carnet_day_comments_carnet_jour_idx
  on public.carnet_day_comments (carnet_id, jour_numero, created_at);

create index if not exists carnet_day_comments_author_id_idx
  on public.carnet_day_comments (author_id);

create index if not exists carnet_day_comments_parent_id_idx
  on public.carnet_day_comments (parent_id);

alter table public.carnet_day_comments enable row level security;

drop policy if exists carnet_day_comments_select on public.carnet_day_comments;
create policy carnet_day_comments_select on public.carnet_day_comments
  for select using (public.can_view_carnet(carnet_id));

drop policy if exists carnet_day_comments_insert on public.carnet_day_comments;
create policy carnet_day_comments_insert on public.carnet_day_comments
  for insert with check (
    author_id = (select auth.uid())
    and public.can_view_carnet(carnet_id)
  );

drop policy if exists carnet_day_comments_update on public.carnet_day_comments;
create policy carnet_day_comments_update on public.carnet_day_comments
  for update using (
    author_id = (select auth.uid())
    or exists (
      select 1 from public.carnets c
      where c.id = carnet_id and c.author_id = (select auth.uid())
    )
  )
  with check (
    author_id = (select auth.uid())
    or exists (
      select 1 from public.carnets c
      where c.id = carnet_id and c.author_id = (select auth.uid())
    )
  );

drop policy if exists carnet_day_comments_delete on public.carnet_day_comments;
create policy carnet_day_comments_delete on public.carnet_day_comments
  for delete using (
    author_id = (select auth.uid())
    or exists (
      select 1 from public.carnets c
      where c.id = carnet_id and c.author_id = (select auth.uid())
    )
  );
