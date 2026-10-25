-- ============================================================
-- TRIBU — M7 : groupe eclair (sortie ephemere)
-- ============================================================
-- Un groupe eclair reste un `travel_groups` (TRIBU-R5) : simple
-- indicateur + date de dissolution automatique, nettoyee par le cron
-- `/api/cron/cleanup-ephemeral-groups` (TRIBU-R6).
-- ============================================================

ALTER TABLE public.travel_groups
  ADD COLUMN IF NOT EXISTS is_ephemeral BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_dissolve_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_travel_groups_ephemeral_dissolve
  ON public.travel_groups(auto_dissolve_at)
  WHERE is_ephemeral;
