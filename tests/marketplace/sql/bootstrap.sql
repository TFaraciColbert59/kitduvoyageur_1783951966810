alter table auth.users add column email_confirmed_at timestamptz,add column is_anonymous boolean default false;
create table public.marketplace_test_roles(user_id uuid primary key,is_staff boolean not null);
create function public.is_admin() returns boolean language sql security definer set search_path='' as $$ select exists(select 1 from public.marketplace_test_roles where user_id=auth.uid() and is_staff) $$;
create function public.is_moderateur() returns boolean language sql security definer set search_path='' as $$ select false $$;
