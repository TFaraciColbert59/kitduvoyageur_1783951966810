-- V7 — Stock de l'inventaire personnel (affiché si > 1, consommables uniquement).
-- Colonne additive, défaut 1 : aucune donnée perdue, aucun stock négatif possible.

ALTER TABLE public.product_ownership
  ADD COLUMN IF NOT EXISTS quantity integer;

UPDATE public.product_ownership
  SET quantity = 1
  WHERE quantity IS NULL;

ALTER TABLE public.product_ownership
  ALTER COLUMN quantity SET DEFAULT 1;

ALTER TABLE public.product_ownership
  ALTER COLUMN quantity SET NOT NULL;

ALTER TABLE public.product_ownership
  DROP CONSTRAINT IF EXISTS product_ownership_quantity_check;

ALTER TABLE public.product_ownership
  ADD CONSTRAINT product_ownership_quantity_check
  CHECK (quantity >= 1);
