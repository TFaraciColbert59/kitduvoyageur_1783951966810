-- Allow carnet owners/members to choose whether their carnet budget is public.
alter table public.carnets
  add column if not exists budget_public boolean not null default false;
