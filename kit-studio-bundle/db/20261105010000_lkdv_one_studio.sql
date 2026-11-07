-- LKDV ONE · Kit Studio 3D : catalogue (châssis, corps, modules, coloris), pièces possédées,
-- configurations par kit et précommandes. RLS sur toutes les tables.
-- Rollback : supabase/migrations_down/20261105010000_lkdv_one_studio.down.sql

create table if not exists public.one_colorways (
  id text primary key,
  label_fr text not null,
  body_hex text not null check (body_hex ~ '^#[0-9A-Fa-f]{6}$'),
  pocket_hex text not null check (pocket_hex ~ '^#[0-9A-Fa-f]{6}$'),
  trim_hex text not null check (trim_hex ~ '^#[0-9A-Fa-f]{6}$'),
  accent_hex text not null check (accent_hex ~ '^#[0-9A-Fa-f]{6}$'),
  sort smallint not null default 0,
  active boolean not null default true
);

create table if not exists public.one_pieces (
  id text primary key,                         -- 'chassis', 'corps:b28', 'mod:lid'…
  kind text not null check (kind in ('chassis','corps','module')),
  label_fr text not null,
  description_fr text not null default '',
  price_cents integer not null check (price_cents >= 0),
  attach_points smallint not null check (attach_points >= 0), -- capacité (châssis, corps) ou coût (module)
  host text check (host in ('chassis','corps')),               -- module : où il se clipse
  part text,                                                   -- pièce 3D : body, lid, front, sides, hip, harness
  volume_l numeric(5,1),
  weight_g integer,
  material_fr text,
  sort smallint not null default 0,
  active boolean not null default true,
  check ((kind = 'module') = (host is not null))
);

create table if not exists public.one_owned_pieces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  piece_id text not null references public.one_pieces(id),
  colorway_id text not null references public.one_colorways(id),
  state text not null default 'owned' check (state in ('owned','preordered')),
  product_ownership_id uuid references public.product_ownership(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, piece_id, colorway_id)
);
create index if not exists one_owned_pieces_user_idx on public.one_owned_pieces(user_id);

create table if not exists public.one_bag_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kit_id uuid references public.materiel_kits(id) on delete cascade,
  corps_id text not null references public.one_pieces(id),
  modules text[] not null default '{}',
  colors jsonb not null default '{}'::jsonb,     -- { body: '#2D482A', lid: …, harness: … }
  updated_at timestamptz not null default now(),
  unique (user_id, kit_id)
);
create index if not exists one_bag_configs_user_idx on public.one_bag_configs(user_id);

create table if not exists public.one_preorders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
  total_cents integer not null check (total_cents >= 0),
  label_name text check (char_length(label_name) <= 24),
  notify_steps boolean not null default true,
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled','delivered')),
  created_at timestamptz not null default now()
);
create index if not exists one_preorders_user_idx on public.one_preorders(user_id);

alter table public.one_colorways enable row level security;
alter table public.one_pieces enable row level security;
alter table public.one_owned_pieces enable row level security;
alter table public.one_bag_configs enable row level security;
alter table public.one_preorders enable row level security;

drop policy if exists one_colorways_read on public.one_colorways;
create policy one_colorways_read on public.one_colorways for select using (active);
drop policy if exists one_pieces_read on public.one_pieces;
create policy one_pieces_read on public.one_pieces for select using (active);

drop policy if exists one_owned_select on public.one_owned_pieces;
create policy one_owned_select on public.one_owned_pieces for select using (user_id = (select auth.uid()));
-- Les pièces possédées sont écrites côté serveur (précommande, achat) ; pas d'insertion directe.

drop policy if exists one_configs_all on public.one_bag_configs;
create policy one_configs_all on public.one_bag_configs for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists one_preorders_select on public.one_preorders;
create policy one_preorders_select on public.one_preorders for select using (user_id = (select auth.uid()));
drop policy if exists one_preorders_insert on public.one_preorders;
create policy one_preorders_insert on public.one_preorders for insert with check (user_id = (select auth.uid()) and status = 'pending');

-- Précommande atomique : recalcule le total côté serveur à partir du catalogue (jamais du client)
create or replace function public.one_place_preorder(p_items jsonb, p_label text, p_notify boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_total integer;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'empty_order'; end if;
  select coalesce(sum(p.price_cents), 0) into v_total
    from jsonb_to_recordset(p_items) as i(piece_id text, colorway_id text)
    join public.one_pieces p on p.id = i.piece_id and p.active
    join public.one_colorways c on c.id = i.colorway_id and c.active;
  if (select count(*) from jsonb_to_recordset(p_items) as i(piece_id text, colorway_id text)
        join public.one_pieces p on p.id = i.piece_id and p.active
        join public.one_colorways c on c.id = i.colorway_id and c.active) <> jsonb_array_length(p_items)
  then raise exception 'unknown_piece_or_colorway'; end if;
  insert into public.one_preorders(user_id, items, total_cents, label_name, notify_steps)
    values (v_uid, p_items, v_total, nullif(left(trim(p_label), 24), ''), coalesce(p_notify, true))
    returning id into v_id;
  insert into public.one_owned_pieces(user_id, piece_id, colorway_id, state)
    select v_uid, i.piece_id, i.colorway_id, 'preordered'
      from jsonb_to_recordset(p_items) as i(piece_id text, colorway_id text)
    on conflict (user_id, piece_id, colorway_id) do nothing;
  return v_id;
end $$;
revoke all on function public.one_place_preorder(jsonb, text, boolean) from public, anon;
grant execute on function public.one_place_preorder(jsonb, text, boolean) to authenticated;

-- Catalogue de lancement : 1 châssis, 2 corps, 6 modules, 4 coloris (prix indicatifs)
insert into public.one_colorways(id, label_fr, body_hex, pocket_hex, trim_hex, accent_hex, sort) values
  ('foret','Forêt','#2D482A','#3D6038','#1E301C','#9BBDA7',1),
  ('sauge','Sauge','#789972','#96B391','#3D6038','#F0F5EE',2),
  ('pierre','Pierre','#B5ABA0','#D4CCC0','#5B554A','#2D482A',3),
  ('nuit','Nuit','#1F4251','#2A5A6E','#10222B','#A8C8D4',4)
on conflict (id) do update set label_fr = excluded.label_fr, body_hex = excluded.body_hex, pocket_hex = excluded.pocket_hex,
  trim_hex = excluded.trim_hex, accent_hex = excluded.accent_hex, sort = excluded.sort;

insert into public.one_pieces(id, kind, label_fr, description_fr, price_cents, attach_points, host, part, volume_l, material_fr, sort) values
  ('chassis','chassis','Châssis ONE','Bretelles, dos ventilé et ceinture. Il porte tous les corps.',18900,4,null,'harness',null,'Mesh 3D, mousse EVA, montants alu',1),
  ('corps:b28','corps','Corps 28 L','Pour la journée, le vélo et la cabine.',11900,6,null,'body',28,'X-Pac VX21, fond Cordura 500D',2),
  ('corps:b42','corps','Corps 42 L','Pour les treks de plusieurs jours.',14900,8,null,'body',42,'X-Pac VX21, fond Cordura 500D',3),
  ('mod:lid','module','Couvercle','Poche haute de 4 L.',4900,2,'corps','lid',4,'X-Pac VX21',4),
  ('mod:front','module','Poche avant','Poche zippée de 3 L pour la pluie et la carte.',3900,2,'corps','front',3,'X-Pac VX21',5),
  ('mod:sides','module','Poches latérales','Paire de poches à gourde.',3500,2,'corps','sides',2,'Cordura 500D',6),
  ('mod:tool','module','Porte-piolet et bâtons','Boucle basse et élastique haut.',1500,1,'corps','front',null,'Hypalon, élastique',7),
  ('mod:hipp','module','Poches de ceinture','Deux poches zippées sur la ceinture.',2900,2,'chassis','hip',0.8,'X-Pac VX21',8),
  ('mod:flask','module','Porte-gourde de bretelle','Flasque de 500 mL à portée de main.',1900,1,'chassis','harness',0.5,'Mesh extensible',9)
on conflict (id) do update set label_fr = excluded.label_fr, description_fr = excluded.description_fr, price_cents = excluded.price_cents,
  attach_points = excluded.attach_points, host = excluded.host, part = excluded.part, volume_l = excluded.volume_l,
  material_fr = excluded.material_fr, sort = excluded.sort;
