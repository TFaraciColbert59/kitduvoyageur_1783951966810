-- Migration: activities, notifications, sos_alerts tables
-- Timestamp: 20260718140000

-- ─── Activities table ─────────────────────────────────────────────────────────
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  hiking_route_id bigint,
  title text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  distance_km numeric,
  duration_seconds int,
  created_at timestamptz default now()
);

alter table public.activities enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'activities' and policyname = 'Un utilisateur gère ses propres activités'
  ) then
    create policy "Un utilisateur gère ses propres activités"
      on public.activities for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- ─── Notifications table ──────────────────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  type text not null,
  title text not null,
  message text,
  read boolean default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'notifications' and policyname = 'Un utilisateur voit ses propres notifications'
  ) then
    create policy "Un utilisateur voit ses propres notifications"
      on public.notifications for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'notifications' and policyname = 'Un utilisateur modifie ses propres notifications'
  ) then
    create policy "Un utilisateur modifie ses propres notifications"
      on public.notifications for update using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'notifications' and policyname = 'Un utilisateur supprime ses propres notifications'
  ) then
    create policy "Un utilisateur supprime ses propres notifications"
      on public.notifications for delete using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'notifications' and policyname = 'Système peut insérer des notifications'
  ) then
    create policy "Système peut insérer des notifications"
      on public.notifications for insert with check (auth.uid() = user_id);
  end if;
end $$;

-- ─── SOS Alerts table ─────────────────────────────────────────────────────────
create table if not exists public.sos_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  latitude numeric,
  longitude numeric,
  status text default 'active',
  created_at timestamptz default now()
);

alter table public.sos_alerts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'sos_alerts' and policyname = 'Un utilisateur gère ses propres alertes SOS'
  ) then
    create policy "Un utilisateur gère ses propres alertes SOS"
      on public.sos_alerts for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
