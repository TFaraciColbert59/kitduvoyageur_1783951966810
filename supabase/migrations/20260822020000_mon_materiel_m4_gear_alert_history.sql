-- ============================================================================
-- LKDV — Mon Matériel v3 : M4 — historique des alertes résolues
-- Table gear_alert_history : traçabilité des alertes (maintenance, péremption,
-- prêt, usure, conflit) résolues par l'utilisateur. RLS isolées par auth.uid().
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.gear_alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  gear_item_id UUID REFERENCES public.gear_items(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL,        -- 'maintenance' | 'expiry' | 'loan' | 'wear' | 'departure_conflict'
  label TEXT,
  resolved_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.gear_alert_history ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.gear_alert_history ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE public.gear_alert_history ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.gear_alert_history ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.gear_alert_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_gear_alert_history" ON public.gear_alert_history;
CREATE POLICY "users_manage_own_gear_alert_history" ON public.gear_alert_history
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_gear_alert_history_user
  ON public.gear_alert_history(user_id, resolved_at DESC);

CREATE INDEX IF NOT EXISTS idx_gear_alert_history_gear
  ON public.gear_alert_history(gear_item_id);