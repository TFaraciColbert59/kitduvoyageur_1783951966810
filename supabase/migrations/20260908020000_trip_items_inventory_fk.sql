-- Migration 20260908020000_trip_items_inventory_fk.sql
-- Chantier Z : Sécurisation relationnelle FK inventory_item_id -> product_ownership(id)

-- 1. Nettoyage préventif des références orphelines éventuelles avant pose de la contrainte
UPDATE public.trip_items
SET inventory_item_id = NULL
WHERE inventory_item_id IS NOT NULL
  AND inventory_item_id NOT IN (SELECT id FROM public.product_ownership);

-- 2. Ajout de la contrainte de clé étrangère avec ON DELETE SET NULL
ALTER TABLE public.trip_items
  ADD CONSTRAINT fk_trip_items_inventory_item
  FOREIGN KEY (inventory_item_id)
  REFERENCES public.product_ownership(id)
  ON DELETE SET NULL;

-- 3. Index de performance pour les requêtes de rapprochement et cascades
CREATE INDEX IF NOT EXISTS idx_trip_items_inventory_item_id
  ON public.trip_items(inventory_item_id)
  WHERE inventory_item_id IS NOT NULL;
