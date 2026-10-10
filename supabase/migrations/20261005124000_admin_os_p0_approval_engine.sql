-- ============================================================================
-- ADMIN OS P0-05 — Approval Engine : requests + decisions, SoD documentée.
-- DOWN: DROP TABLE IF EXISTS public.admin_approval_decisions;
--       DROP TABLE IF EXISTS public.admin_approval_requests;
--       (P0 : tables neuves — DROP sûr.)
-- RLS deny-by-default + FORCE. INSERT acteur-propre / approbateur-propre,
-- SELECT via admin.access. Aucune UPDATE/DELETE applicative.
-- SoD : CHECK requested_by <> approver impossible en contrainte inter-tables
-- simple — appliquée dans le handler decideApproval (isSelfApproval) + test
-- pgTAP ci-joint à venir en P1 ; règle rappelée en COMMENT.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id uuid NOT NULL REFERENCES public.admin_commands(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'escalated')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_approval_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid NOT NULL REFERENCES public.admin_approval_requests(id) ON DELETE CASCADE,
  approver_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  decision text NOT NULL CHECK (decision IN ('approve', 'reject')),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_approval_decisions_one_per_request UNIQUE (approval_id)
);

COMMENT ON TABLE public.admin_approval_requests IS
  'SoD: approver_id (decisions) doit différer de requested_by (requests) — voir isSelfApproval() dans src/server/admin/approvals.ts';

CREATE INDEX IF NOT EXISTS idx_approval_requests_command
  ON public.admin_approval_requests(command_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status
  ON public.admin_approval_requests(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_approval_decisions_approval
  ON public.admin_approval_decisions(approval_id);

ALTER TABLE public.admin_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_approval_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_approval_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_approval_decisions FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_approval_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.admin_approval_requests TO authenticated;
-- Décisions : écriture via public.decide_approval() SEULEMENT (atomique :
-- SoD + permission + statut en une transaction). Aucun INSERT direct.
REVOKE ALL ON TABLE public.admin_approval_decisions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.admin_approval_decisions TO authenticated;

DROP POLICY IF EXISTS approval_requests_insert_own ON public.admin_approval_requests;
CREATE POLICY approval_requests_insert_own ON public.admin_approval_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = (select auth.uid())
    AND public.has_permission('admin.access')
  );

DROP POLICY IF EXISTS approval_requests_select_admin ON public.admin_approval_requests;
CREATE POLICY approval_requests_select_admin ON public.admin_approval_requests
  FOR SELECT TO authenticated
  USING (public.has_permission('admin.access'));

DROP POLICY IF EXISTS approval_decisions_insert_own ON public.admin_approval_decisions;
-- Pas de policy INSERT : écriture réservée à decide_approval() (SECURITY DEFINER).
DROP POLICY IF EXISTS approval_decisions_select_admin ON public.admin_approval_decisions;
CREATE POLICY approval_decisions_select_admin ON public.admin_approval_decisions
  FOR SELECT TO authenticated
  USING (public.has_permission('admin.access'));
