-- Minimal historical schema fixture; not a replacement for full migration replay.
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
create table public.shop_products(id uuid primary key);
create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now();return new;end $$;
create table if not exists public.product_ownership (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  brand text,
  category text,
  weight_g integer,
  price_cents integer,
  purchase_date date,
  condition text check (condition in ('neuf','bon','use','a_remplacer','pour_pieces')),
  photo_url text,
  barcode text,
  is_lent boolean not null default false,
  maintenance_due_at date,
  expiry_date date,
  tags text[] default '{}',
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_product_ownership_user_id on public.product_ownership(user_id);
create index if not exists idx_product_ownership_search on public.product_ownership using gin(search_vector);

create or replace function public.product_ownership_search_vector_update()
returns trigger as $$
begin
  new.search_vector :=
    setweight(to_tsvector('french', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(new.brand, '')), 'B') ||
    setweight(to_tsvector('french', array_to_string(coalesce(new.tags, '{}'), ' ')), 'C');
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_product_ownership_search on public.product_ownership;
create trigger trg_product_ownership_search before insert or update on public.product_ownership
  for each row execute function public.product_ownership_search_vector_update();

drop trigger if exists trg_product_ownership_updated_at on public.product_ownership;
create trigger trg_product_ownership_updated_at before update on public.product_ownership
  for each row execute function public.set_updated_at();

alter table public.product_ownership enable row level security;

DROP POLICY IF EXISTS "product_ownership_select_own" ON public.product_ownership;-- A10 replay idempotence
create policy "product_ownership_select_own" on public.product_ownership
  for select using (auth.uid() = user_id);
DROP POLICY IF EXISTS "product_ownership_insert_own" ON public.product_ownership;-- A10 replay idempotence
create policy "product_ownership_insert_own" on public.product_ownership
  for insert with check (auth.uid() = user_id);
DROP POLICY IF EXISTS "product_ownership_update_own" ON public.product_ownership;-- A10 replay idempotence
create policy "product_ownership_update_own" on public.product_ownership
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
DROP POLICY IF EXISTS "product_ownership_delete_own" ON public.product_ownership;-- A10 replay idempotence
create policy "product_ownership_delete_own" on public.product_ownership
  for delete using (auth.uid() = user_id);

create table if not exists public.materiel_loans (
  id uuid primary key default gen_random_uuid(),
  product_ownership_id uuid not null references public.product_ownership(id) on delete cascade,
  lender_id uuid not null references auth.users(id) on delete cascade,
  borrower_id uuid references auth.users(id) on delete set null,
  borrower_contact text,
  status text not null check (status in ('en_cours','rendu','en_retard','litige')) default 'en_cours',
  loaned_at date not null default current_date,
  due_date date,
  returned_at date,
  contract_pdf_url text,
  lender_rating numeric(2,1),
  borrower_rating numeric(2,1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_materiel_loans_lender_id on public.materiel_loans(lender_id);
create index if not exists idx_materiel_loans_borrower_id on public.materiel_loans(borrower_id);

drop trigger if exists trg_materiel_loans_updated_at on public.materiel_loans;
create trigger trg_materiel_loans_updated_at before update on public.materiel_loans
  for each row execute function public.set_updated_at();

alter table public.materiel_loans enable row level security;

DROP POLICY IF EXISTS "materiel_loans_select_involved" ON public.materiel_loans;-- A10 replay idempotence
create policy "materiel_loans_select_involved" on public.materiel_loans
  for select using (auth.uid() = lender_id or auth.uid() = borrower_id);
DROP POLICY IF EXISTS "materiel_loans_insert_lender" ON public.materiel_loans;-- A10 replay idempotence
create policy "materiel_loans_insert_lender" on public.materiel_loans
  for insert with check (auth.uid() = lender_id);
DROP POLICY IF EXISTS "materiel_loans_update_involved" ON public.materiel_loans;-- A10 replay idempotence
create policy "materiel_loans_update_involved" on public.materiel_loans
  for update using (auth.uid() = lender_id or auth.uid() = borrower_id)
  with check (auth.uid() = lender_id or auth.uid() = borrower_id);
DROP POLICY IF EXISTS "materiel_loans_delete_lender" ON public.materiel_loans;-- A10 replay idempotence
create policy "materiel_loans_delete_lender" on public.materiel_loans
  for delete using (auth.uid() = lender_id);

alter table public.product_ownership add column quantity integer not null default 1;
grant usage on schema public,auth to authenticated,anon;grant select,insert,update,delete on public.product_ownership,public.materiel_loans to authenticated;
