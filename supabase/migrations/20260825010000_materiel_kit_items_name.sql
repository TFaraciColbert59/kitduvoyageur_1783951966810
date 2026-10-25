-- Ajoute la colonne `name` à materiel_kit_items pour les articles personnalisés
-- (sans product_ownership_id). Décision D3.2.
alter table public.materiel_kit_items add column if not exists name text;
