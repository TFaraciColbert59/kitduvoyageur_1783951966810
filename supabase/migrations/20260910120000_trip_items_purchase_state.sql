-- V7 — Statut d'achat des objets de voyage (menu Équipement mobile) :
-- needed (à ajouter) → added (ajouté au sac) → in_cart (au panier) → shipping (en livraison).
-- Corrige aussi le drift trip_items.source (utilisé par addTripItem, jamais migré).

ALTER TABLE public.trip_items
  ADD COLUMN IF NOT EXISTS source text;

ALTER TABLE public.trip_items
  ADD COLUMN IF NOT EXISTS purchase_state text;

UPDATE public.trip_items
  SET purchase_state = 'needed'
  WHERE purchase_state IS NULL;

ALTER TABLE public.trip_items
  ALTER COLUMN purchase_state SET DEFAULT 'needed';

ALTER TABLE public.trip_items
  ALTER COLUMN purchase_state SET NOT NULL;

ALTER TABLE public.trip_items
  DROP CONSTRAINT IF EXISTS trip_items_purchase_state_check;

ALTER TABLE public.trip_items
  ADD CONSTRAINT trip_items_purchase_state_check
  CHECK (purchase_state IN ('needed', 'added', 'in_cart', 'shipping'));
