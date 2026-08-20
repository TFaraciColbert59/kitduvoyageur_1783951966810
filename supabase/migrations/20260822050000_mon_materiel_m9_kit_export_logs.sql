-- ============================================================================
-- LKDV — Mon Matériel v3 : M9 — historique des exports de kits (PDF/partage)
-- Table kit_export_logs : trace de chaque export/partage d'un kit.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.kit_export_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID REFERENCES public.custom_kits(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  exported_at TIMESTAMPTZ DEFAULT now(),
  format TEXT NOT NULL DEFAULT 'pdf' CHECK (format IN ('pdf', 'ics', 'csv'))
);

ALTER TABLE public.kit_export_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.kit_export_logs ADD COLUMN IF NOT EXISTS exported_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.kit_export_logs ADD COLUMN IF NOT EXISTS format TEXT NOT NULL DEFAULT 'pdf' CHECK (format IN ('pdf', 'ics', 'csv'));

ALTER TABLE public.kit_export_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_kit_export_logs" ON public.kit_export_logs;
CREATE POLICY "users_manage_own_kit_export_logs" ON public.kit_export_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_kit_export_logs_user
  ON public.kit_export_logs(user_id, exported_at DESC);