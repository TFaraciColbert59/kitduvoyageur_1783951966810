-- ============================================================================
-- LKDV — Mon Matériel v3 : consolidation gear_items + commandes → réception
-- Remplacée les deux ébauches 20260819125556 / 20260819125615 (jamais mergées).
-- Idempotente : ADD COLUMN IF NOT EXISTS / DROP POLICY IF EXISTS / CREATE OR REPLACE.
-- Aucune suppression de données. RLS conservées (isolation par auth.uid()).
-- ============================================================================

-- ── 1. Colonnes gear_items lues/vérifiées par l'interface UserEquipmentItem ──
ALTER TABLE public.gear_items
  ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS wear_percentage INTEGER,
  ADD COLUMN IF NOT EXISTS size_label TEXT,
  ADD COLUMN IF NOT EXISTS materials TEXT,
  ADD COLUMN IF NOT EXISTS sole_type TEXT,
  ADD COLUMN IF NOT EXISTS waterproof_rating TEXT,
  ADD COLUMN IF NOT EXISTS ref_code TEXT,
  ADD COLUMN IF NOT EXISTS loan_status TEXT,
  ADD COLUMN IF NOT EXISTS loan_to_name TEXT,
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.shop_products(id),
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manuel'
    CHECK (source IN ('achat','kit','manuel','occasion')),
  ADD COLUMN IF NOT EXISTS origin_order_id uuid REFERENCES public.orders(id),
  ADD COLUMN IF NOT EXISTS origin_kit_id uuid REFERENCES public.kits(id),
  ADD COLUMN IF NOT EXISTS is_listed_for_sale boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS acquired_at date DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS transferred_to_user_id uuid REFERENCES auth.users(id);

-- ── 2. Étendre le CHECK de `source` au mode « catalogue » (flux Ajouter à l'équipement)
ALTER TABLE public.gear_items DROP CONSTRAINT IF EXISTS gear_items_source_check;
ALTER TABLE public.gear_items DROP CONSTRAINT IF EXISTS gear_items_source_check1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.gear_items'::regclass
      AND pg_get_constraintdef(oid) LIKE '%source%'
  ) THEN
    ALTER TABLE public.gear_items ADD CONSTRAINT gear_items_source_check
      CHECK (source IN ('achat','kit','manuel','occasion','catalogue'));
  END IF;
END $$;

-- ── 3. `received_at` sur order_items (flux En commande → réception) ─────────
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS received_at timestamptz;

-- ── 4. Politique d'insertion historique (écriture best-effort, données personnelles) ──
ALTER TABLE public.gear_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'gear_history'
      AND policyname = 'auth_insert_own_gear_history'
  ) THEN
    CREATE POLICY "auth_insert_own_gear_history" ON public.gear_history
      FOR INSERT TO authenticated
      WITH CHECK (
        gear_item_id IN (SELECT id FROM public.gear_items WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- ── 5. Index d'aide au cockpit (listes prêts / réception) ────────────────────
CREATE INDEX IF NOT EXISTS idx_gear_items_product_id ON public.gear_items(product_id);
CREATE INDEX IF NOT EXISTS idx_gear_items_loan_status ON public.gear_items(loan_status);
CREATE INDEX IF NOT EXISTS idx_order_items_received_at ON public.order_items(order_id) WHERE received_at IS NULL;