-- ============================================================================
-- ADMIN OS P0-04 — Command Engine : registre canonique admin_commands.
-- DOWN: DROP TABLE IF EXISTS public.admin_commands; (P0 : table neuve,
-- aucune donnée legacy — DROP sûr, à exécuter hors transaction bloquante.)
-- Idempotent : CREATE TABLE IF NOT EXISTS + IF NOT EXISTS partout.
-- RLS : deny-by-default, FORCE, INSERT acteur-propre, SELECT audit/admin,
-- aucune UPDATE/DELETE applicative (transitions via handlers serveur).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_key text NOT NULL,
  actor_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  environment text NOT NULL DEFAULT 'production'
    CHECK (environment IN ('dev', 'staging', 'production')),
  payload jsonb NOT NULL DEFAULT '{}',
  reason text NOT NULL,
  ticket_id text,
  risk_tier smallint NOT NULL CHECK (risk_tier BETWEEN 0 AND 4),
  idempotency_key text NOT NULL UNIQUE,
  expected_version integer,
  preview jsonb,
  requires_approval boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'drafted'
    CHECK (status IN (
      'drafted', 'validated', 'awaiting_approval', 'approved', 'executing',
      'succeeded', 'partially_succeeded', 'failed', 'unknown',
      'cancelled', 'rolled_back'
    )),
  result jsonb,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_admin_commands_actor_created
  ON public.admin_commands(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_commands_resource
  ON public.admin_commands(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_admin_commands_status
  ON public.admin_commands(status) WHERE status IN ('awaiting_approval', 'approved', 'executing');
CREATE INDEX IF NOT EXISTS idx_admin_commands_correlation
  ON public.admin_commands(correlation_id) WHERE correlation_id IS NOT NULL;

ALTER TABLE public.admin_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_commands FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_commands FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.admin_commands TO authenticated;

DROP POLICY IF EXISTS admin_commands_insert_own ON public.admin_commands;
CREATE POLICY admin_commands_insert_own ON public.admin_commands
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = (select auth.uid())
    AND public.has_permission(command_key)
  );

DROP POLICY IF EXISTS admin_commands_select_admin ON public.admin_commands;
CREATE POLICY admin_commands_select_admin ON public.admin_commands
  FOR SELECT TO authenticated
  USING (public.has_permission('admin.access'));
