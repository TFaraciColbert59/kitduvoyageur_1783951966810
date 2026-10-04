-- ============================================================================
-- ADMIN REBUILD P2 — Journal d'audit append-only : action_logs
-- ============================================================================
-- Table canonique unique (remplace admin_audit_log + admin_audit_logs,
-- conservées en lecture seule historique). Écriture serveur uniquement :
-- INSERT own-actor via RLS, aucune policy UPDATE/DELETE (= refusé),
-- lecture réservée à `audit.read`. Trigger auto sur user_roles.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_table text,
  target_id text,
  diff jsonb,
  ip text,
  user_agent text,
  source text NOT NULL DEFAULT 'app',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_logs_actor_created
  ON public.action_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_logs_target
  ON public.action_logs(target_table, target_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_created
  ON public.action_logs(created_at DESC);

-- ----------------------------------------------------------------------------
-- Backfill historique (idempotent : marquage source, dédupliqué par NOT EXISTS)
-- ----------------------------------------------------------------------------
INSERT INTO public.action_logs (actor_id, action, target_table, target_id, diff, source, created_at)
SELECT
  CASE WHEN EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = l.admin_id)
       THEN l.admin_id ELSE NULL END,
  l.action::text,
  l.cible_type,
  l.cible_id,
  jsonb_build_object('avant', l.avant, 'apres', l.apres),
  'legacy:admin_audit_log',
  l.created_at
FROM public.admin_audit_log l
WHERE NOT EXISTS (
  SELECT 1 FROM public.action_logs a
  WHERE a.source = 'legacy:admin_audit_log'
    AND a.created_at = l.created_at
    AND a.action = l.action::text
    AND a.target_id = l.cible_id
);

INSERT INTO public.action_logs (actor_id, action, target_table, target_id, diff, source, created_at)
SELECT
  NULL,
  l.action,
  l.target_table,
  l.target_id,
  jsonb_build_object('old', l.old_data, 'new', l.new_data,
                     'target_name', l.target_name, 'admin_email', l.admin_email),
  'legacy:admin_audit_logs',
  l.created_at
FROM public.admin_audit_logs l
WHERE NOT EXISTS (
  SELECT 1 FROM public.action_logs a
  WHERE a.source = 'legacy:admin_audit_logs'
    AND a.created_at = l.created_at
    AND a.action = l.action
    AND a.target_id = l.target_id
);

-- ----------------------------------------------------------------------------
-- Trigger : tout octroi/retrait de rôle est journalisé automatiquement
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_user_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.action_logs (actor_id, action, target_table, target_id, diff, source)
    VALUES (
      auth.uid(),
      'role.grant',
      'user_roles',
      NEW.user_id::text,
      jsonb_build_object('role_id', NEW.role_id,
                         'granted_by', NEW.granted_by,
                         'expires_at', NEW.expires_at),
      'trigger:user_roles'
    );
    RETURN NEW;
  ELSE
    INSERT INTO public.action_logs (actor_id, action, target_table, target_id, diff, source)
    VALUES (
      auth.uid(),
      'role.revoke',
      'user_roles',
      OLD.user_id::text,
      jsonb_build_object('role_id', OLD.role_id),
      'trigger:user_roles'
    );
    RETURN OLD;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.log_user_role_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_log_user_role_change ON public.user_roles;
CREATE TRIGGER trg_log_user_role_change
  AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_user_role_change();

-- ----------------------------------------------------------------------------
-- RLS append-only : INSERT acteur-propre, SELECT audit.read, rien d'autre
-- ----------------------------------------------------------------------------
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_logs FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.action_logs FROM anon, authenticated;
GRANT INSERT, SELECT ON public.action_logs TO authenticated;

DROP POLICY IF EXISTS action_logs_insert_own ON public.action_logs;
CREATE POLICY action_logs_insert_own ON public.action_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = (select auth.uid()));

DROP POLICY IF EXISTS action_logs_select_audit ON public.action_logs;
CREATE POLICY action_logs_select_audit ON public.action_logs
  FOR SELECT TO authenticated
  USING (public.has_permission('audit.read'));
