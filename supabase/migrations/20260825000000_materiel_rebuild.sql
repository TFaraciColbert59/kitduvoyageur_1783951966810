-- ============================================================
-- MON MATÉRIEL — Schéma complet (kits, items, inventaire, alertes, prêts, partage)
-- Décision D3.1 : les noms `kits`, `kit_items` et `loans` existent déjà en prod
-- (catalogue presets / prêts existants, schémas incompatibles). Pour ne PAS casser
-- le catalogue et les prêts existants, les tables utilisateur sont renommées :
--   kits       -> materiel_kits
--   kit_items  -> materiel_kit_items
--   loans      -> materiel_loans
-- Les tables `product_ownership`, `alerts`, `share_tokens` n'existaient pas :
-- créées sous leur nom d'origine.
-- ============================================================

-- Fonction générique de mise à jour updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- 1. MATERIEL_KITS (kits utilisateur)
-- ============================================================
create table if not exists public.materiel_kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  season text check (season in ('printemps','ete','automne','hiver','toute_saison')),
  total_weight_g integer default 0,
  is_public boolean not null default false,
  is_favorite boolean not null default false,
  is_trashed boolean not null default false,
  cover_image_url text,
  tags text[] default '{}',
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_materiel_kits_user_id on public.materiel_kits(user_id);
create index if not exists idx_materiel_kits_public on public.materiel_kits(is_public) where is_public = true;
create index if not exists idx_materiel_kits_search on public.materiel_kits using gin(search_vector);

create or replace function public.materiel_kits_search_vector_update()
returns trigger as $$
begin
  new.search_vector :=
    setweight(to_tsvector('french', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector('french', array_to_string(coalesce(new.tags, '{}'), ' ')), 'C');
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_materiel_kits_search_vector on public.materiel_kits;
create trigger trg_materiel_kits_search_vector before insert or update on public.materiel_kits
  for each row execute function public.materiel_kits_search_vector_update();

drop trigger if exists trg_materiel_kits_updated_at on public.materiel_kits;
create trigger trg_materiel_kits_updated_at before update on public.materiel_kits
  for each row execute function public.set_updated_at();

alter table public.materiel_kits enable row level security;

create policy "materiel_kits_select_own_or_public" on public.materiel_kits
  for select using (auth.uid() = user_id or is_public = true);
create policy "materiel_kits_insert_own" on public.materiel_kits
  for insert with check (auth.uid() = user_id);
create policy "materiel_kits_update_own" on public.materiel_kits
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "materiel_kits_delete_own" on public.materiel_kits
  for delete using (auth.uid() = user_id);

-- ============================================================
-- 2. PRODUCT_OWNERSHIP (inventaire personnel) — créée AVANT materiel_kit_items
-- ============================================================
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

create policy "product_ownership_select_own" on public.product_ownership
  for select using (auth.uid() = user_id);
create policy "product_ownership_insert_own" on public.product_ownership
  for insert with check (auth.uid() = user_id);
create policy "product_ownership_update_own" on public.product_ownership
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "product_ownership_delete_own" on public.product_ownership
  for delete using (auth.uid() = user_id);

-- ============================================================
-- 3. MATERIEL_KIT_ITEMS (liaison kit <-> objets d'inventaire)
-- ============================================================
create table if not exists public.materiel_kit_items (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references public.materiel_kits(id) on delete cascade,
  product_ownership_id uuid references public.product_ownership(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  category text,
  weight_g integer default 0,
  is_checked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_materiel_kit_items_kit_id on public.materiel_kit_items(kit_id);
create index if not exists idx_materiel_kit_items_user_id on public.materiel_kit_items(user_id);

drop trigger if exists trg_materiel_kit_items_updated_at on public.materiel_kit_items;
create trigger trg_materiel_kit_items_updated_at before update on public.materiel_kit_items
  for each row execute function public.set_updated_at();

alter table public.materiel_kit_items enable row level security;

create policy "materiel_kit_items_select_own" on public.materiel_kit_items
  for select using (auth.uid() = user_id);
create policy "materiel_kit_items_insert_own" on public.materiel_kit_items
  for insert with check (auth.uid() = user_id);
create policy "materiel_kit_items_update_own" on public.materiel_kit_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "materiel_kit_items_delete_own" on public.materiel_kit_items
  for delete using (auth.uid() = user_id);

-- ============================================================
-- 4. ALERTS
-- ============================================================
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_ownership_id uuid references public.product_ownership(id) on delete cascade,
  type text not null check (type in ('entretien','peremption','pret','etat','conflit','meteo','reglementation')),
  severity text not null check (severity in ('info','warning','critical')) default 'warning',
  message text not null,
  is_resolved boolean not null default false,
  resolved_at timestamptz,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_alerts_user_id on public.alerts(user_id);
create index if not exists idx_alerts_unresolved on public.alerts(user_id, is_resolved) where is_resolved = false;

drop trigger if exists trg_alerts_updated_at on public.alerts;
create trigger trg_alerts_updated_at before update on public.alerts
  for each row execute function public.set_updated_at();

alter table public.alerts enable row level security;

create policy "alerts_select_own" on public.alerts
  for select using (auth.uid() = user_id);
create policy "alerts_insert_own" on public.alerts
  for insert with check (auth.uid() = user_id);
create policy "alerts_update_own" on public.alerts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "alerts_delete_own" on public.alerts
  for delete using (auth.uid() = user_id);

-- ============================================================
-- 5. MATERIEL_LOANS (prêts — accès croisé prêteur/emprunteur)
-- ============================================================
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

create policy "materiel_loans_select_involved" on public.materiel_loans
  for select using (auth.uid() = lender_id or auth.uid() = borrower_id);
create policy "materiel_loans_insert_lender" on public.materiel_loans
  for insert with check (auth.uid() = lender_id);
create policy "materiel_loans_update_involved" on public.materiel_loans
  for update using (auth.uid() = lender_id or auth.uid() = borrower_id)
  with check (auth.uid() = lender_id or auth.uid() = borrower_id);
create policy "materiel_loans_delete_lender" on public.materiel_loans
  for delete using (auth.uid() = lender_id);

-- ============================================================
-- 6. SHARE_TOKENS (partage de kit — lecture publique via token)
-- ============================================================
create table if not exists public.share_tokens (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references public.materiel_kits(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  permission text not null check (permission in ('lecture','fork','co_edition')) default 'lecture',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_share_tokens_token on public.share_tokens(token);
create index if not exists idx_share_tokens_kit_id on public.share_tokens(kit_id);

alter table public.share_tokens enable row level security;

create policy "share_tokens_select_owner" on public.share_tokens
  for select using (auth.uid() = owner_id);
create policy "share_tokens_insert_owner" on public.share_tokens
  for insert with check (auth.uid() = owner_id);
create policy "share_tokens_delete_owner" on public.share_tokens
  for delete using (auth.uid() = owner_id);

-- ============================================================
-- FIN — Vérification obligatoire après application
-- ============================================================
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'
--   AND tablename IN ('materiel_kits','materiel_kit_items','product_ownership',
--                     'alerts','materiel_loans','share_tokens');
-- -> rowsecurity doit être TRUE pour les 6 tables, sans exception.
