-- ============================================================================
-- ADMIN OS P0-03 — Audit unique : étend action_logs, gèle les legacies.
-- DOWN :
--   (colonnes conservées — jamais de DROP destructif en P0) ;
--   GRANT INSERT ON public.admin_audit_log TO authenticated ;
--   GRANT INSERT ON public.admin_audit_logs TO authenticated ;
-- Effets :
-- 1. action_logs += risk_tier, correlation_id, command_id, approval_id,
--    reason, result, error_code (idempotent, défauts sûrs).
-- 2. admin_audit_log + admin_audit_logs : écriture révoquée (lecture
--    historique conservée pour audit.read), double chemin d'écriture fermé.
-- ============================================================================

ALTER TABLE public.action_logs
  ADD COLUMN IF NOT EXISTS risk_tier smallint NOT NULL DEFAULT 1
    CHECK (risk_tier BETWEEN 0 AND 4);
ALTER TABLE public.action_logs
  ADD COLUMN IF NOT EXISTS correlation_id text;
ALTER TABLE public.action_logs
  ADD COLUMN IF NOT EXISTS command_id uuid;
ALTER TABLE public.action_logs
  ADD COLUMN IF NOT EXISTS approval_id uuid;
ALTER TABLE public.action_logs
  ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE public.action_logs
  ADD COLUMN IF NOT EXISTS result text NOT NULL DEFAULT 'succeeded'
    CHECK (result IN ('succeeded', 'failed', 'partial', 'unknown', 'cancelled'));
ALTER TABLE public.action_logs
  ADD COLUMN IF NOT EXISTS error_code text;

CREATE INDEX IF NOT EXISTS idx_action_logs_correlation
  ON public.action_logs(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_action_logs_command
  ON public.action_logs(command_id) WHERE command_id IS NOT NULL;

-- Gel legacies : lecture historique seule.
REVOKE ALL ON TABLE public.admin_audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.admin_audit_log TO authenticated;
REVOKE ALL ON TABLE public.admin_audit_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.admin_audit_logs TO authenticated;
