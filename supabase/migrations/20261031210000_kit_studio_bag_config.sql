-- Migration: 20261031210000_kit_studio_bag_config.sql
-- Description: Configuration 3D d'un kit et slots d'articles (Lot L1).
-- Caractère STRICTEMENT ADDITIF : aucune colonne existante n'est modifiée ou supprimée.
-- Un kit sans configuration reste 100 % valide et est rendu en mode Liste.

-- 1. Extension de la table materiel_kits
alter table public.materiel_kits
  add column if not exists bag_model text,
  add column if not exists bag_model_id text,
  add column if not exists custom_parts jsonb not null default '{}'::jsonb,
  add column if not exists bag_parts jsonb not null default '{}'::jsonb,
  add column if not exists studio_revision integer not null default 1;

-- Commentaires sémantiques et de documentation
comment on column public.materiel_kits.bag_model is
  'Identifiant du modèle de sac 3D (ex. trekker-55). NULL = mode Liste.';
comment on column public.materiel_kits.bag_model_id is
  'Alias canonique de bag_model (bags.index.json). NULL = mode Liste.';
comment on column public.materiel_kits.custom_parts is
  'Personnalisation par pièce : { "<partId>": { "material": "...", "color": "..." } }.';
comment on column public.materiel_kits.bag_parts is
  'Alias canonique de custom_parts.';
comment on column public.materiel_kits.studio_revision is
  'Révision strictement monotone. Arbitre les écritures concurrentes et optimistes.';

-- 2. Extension de la table materiel_kit_items
alter table public.materiel_kit_items
  add column if not exists slot_id text,
  add column if not exists slot_order integer;

comment on column public.materiel_kit_items.slot_id is
  'Identifiant du slot dans le manifeste du sac. NULL = non rangé (état légitime).';
comment on column public.materiel_kit_items.slot_order is
  'Ordre de rangement ordinal au sein du slot physique.';

-- 3. Synchronisation automatique des alias bag_model <-> bag_model_id et custom_parts <-> bag_parts
create or replace function public.trg_sync_materiel_kits_aliases()
returns trigger language plpgsql as $$
begin
  if new.bag_model is not null and new.bag_model_id is null then
    new.bag_model_id := new.bag_model;
  elsif new.bag_model_id is not null and new.bag_model is null then
    new.bag_model := new.bag_model_id;
  end if;

  if new.custom_parts <> '{}'::jsonb and new.bag_parts = '{}'::jsonb then
    new.bag_parts := new.custom_parts;
  elsif new.bag_parts <> '{}'::jsonb and new.custom_parts = '{}'::jsonb then
    new.custom_parts := new.bag_parts;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_materiel_kits_aliases_sync on public.materiel_kits;
create trigger trg_materiel_kits_aliases_sync
  before insert or update on public.materiel_kits
  for each row execute function public.trg_sync_materiel_kits_aliases();
