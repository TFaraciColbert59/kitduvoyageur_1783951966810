-- Migration 20260908020000_trip_items_inventory_fk.down.sql
-- Chantier Z : Rollback de la FK trip_items.inventory_item_id

ALTER TABLE public.trip_items
  DROP CONSTRAINT IF EXISTS fk_trip_items_inventory_item;

DROP INDEX IF EXISTS public.idx_trip_items_inventory_item_id;
