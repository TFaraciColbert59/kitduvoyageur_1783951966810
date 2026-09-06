-- Migration 20260905140000_trip_contextual_kit.sql
-- Chantier 6 : IA & Kit contextuel (Boutique LKDV, équipement, marge pleine)

-- 1. Enrichissement de la table trip_items
ALTER TABLE public.trip_items
  ADD COLUMN IF NOT EXISTS shop_product_id UUID REFERENCES public.shop_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'recommended' CHECK (priority IN ('vital', 'recommended', 'optional')),
  ADD COLUMN IF NOT EXISTS is_vital BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_worn BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_consumable BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Index de performance pour les filtres de préparation et de kit
CREATE INDEX IF NOT EXISTS idx_trip_items_packed ON public.trip_items(trip_id, is_packed);
CREATE INDEX IF NOT EXISTS idx_trip_items_priority ON public.trip_items(trip_id, priority);
CREATE INDEX IF NOT EXISTS idx_trip_items_shop_product ON public.trip_items(shop_product_id);
