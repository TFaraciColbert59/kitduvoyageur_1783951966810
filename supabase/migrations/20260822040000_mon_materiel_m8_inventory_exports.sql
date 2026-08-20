-- ============================================================================
-- LKDV — Mon Matériel v3 : M8 — traçabilité des exports d'inventaire
-- Table inventory_exports : journal des exports CSV/PDF de l'inventaire.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  exported_at TIMESTAMPTZ DEFAULT now(),
  type TEXT NOT NULL DEFAULT 'csv' CHECK (type IN ('csv', 'pdf'))
);

ALTER TABLE public.inventory_exports ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.inventory_exports ADD COLUMN IF NOT EXISTS exported_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.inventory_exports ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'csv' CHECK (type IN ('csv', 'pdf'));

ALTER TABLE public.inventory_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_inventory_exports" ON public.inventory_exports;
CREATE POLICY "users_manage_own_inventory_exports" ON public.inventory_exports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_read_own_inventory_exports" ON public.inventory_exports;
CREATE POLICY "users_read_own_inventory_exports" ON public.inventory_exports
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_inventory_exports_user
  ON public.inventory_exports(user_id, exported_at DESC);