-- ============================================================================
-- ADMIN OS P5 — JIT elevations : table + enforcement dans decide_approval.
-- DOWN: DROP FUNCTION IF EXISTS public.has_active_elevation(text);
--       DROP TABLE IF EXISTS public.admin_elevations;
--       (puis réappliquer 20261005126000 pour restaurer decide_approval
--       sans élévation — voir corps d'origine dans ce fichier.)
-- Sémantique : élévation temporaire (≤ 8 h) sur UNE permission, motif +
-- ticket obligatoires en Tier4 (break-glass tracé 'break_glass.use').
-- Enforcement réel : decide_approval() accepte approbateur habilité OU
-- élevé actif (has_active_elevation). Expiration : expires_at > now().
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_elevations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  permission_code text NOT NULL,
  reason text NOT NULL,
  ticket_id text,
  granted_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  is_break_glass boolean NOT NULL DEFAULT false,
  CONSTRAINT admin_elevations_max_8h CHECK (expires_at <= granted_at + interval '8 hours'),
  CONSTRAINT admin_elevations_future CHECK (expires_at > granted_at)
);

CREATE INDEX IF NOT EXISTS idx_admin_elevations_user_perm
  ON public.admin_elevations(user_id, permission_code)
  WHERE revoked_at IS NULL;

ALTER TABLE public.admin_elevations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_elevations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_elevations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.admin_elevations TO authenticated;

DROP POLICY IF EXISTS admin_elevations_insert_own ON public.admin_elevations;
CREATE POLICY admin_elevations_insert_own ON public.admin_elevations
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND public.has_permission('access.elevate')
  );
DROP POLICY IF EXISTS admin_elevations_select_admin ON public.admin_elevations;
CREATE POLICY admin_elevations_select_admin ON public.admin_elevations
  FOR SELECT TO authenticated
  USING (public.has_permission('admin.access'));
-- Révocation seule écriture autorisée en UPDATE (pas de prolongation).
DROP POLICY IF EXISTS admin_elevations_revoke_own ON public.admin_elevations;
CREATE POLICY admin_elevations_revoke_own ON public.admin_elevations
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()) AND revoked_at IS NULL)
  WITH CHECK (revoked_at IS NOT NULL);

CREATE OR REPLACE FUNCTION public.has_active_elevation(p_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_elevations e
     WHERE e.user_id = auth.uid()
       AND e.permission_code = p_code
       AND e.revoked_at IS NULL
       AND e.expires_at > now()
  )
$$;
REVOKE ALL ON FUNCTION public.has_active_elevation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_elevation(text) TO authenticated, service_role;

-- decide_approval() v2 : approbateur habilité OU élevé actif.
CREATE OR REPLACE FUNCTION public.decide_approval(
  p_approval_id uuid,
  p_decision text,
  p_reason text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request_id uuid;
  v_command_id uuid;
  v_requested_by uuid;
  v_status text;
  v_command_key text;
  v_decision text;
  v_reason text;
BEGIN
  IF p_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'invalid_decision' USING ERRCODE = '22023';
  END IF;
  v_reason := btrim(coalesce(p_reason, ''));
  IF char_length(v_reason) < 10 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  SELECT r.id, r.command_id, r.requested_by, r.status
    INTO v_request_id, v_command_id, v_requested_by, v_status
    FROM public.admin_approval_requests r
   WHERE r.id = p_approval_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'approval_not_found' USING ERRCODE = '22023';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'approval_not_pending' USING ERRCODE = '22023';
  END IF;
  IF v_requested_by = auth.uid() THEN
    RAISE EXCEPTION 'sod_violation' USING ERRCODE = '42501';
  END IF;

  SELECT c.command_key INTO v_command_key
    FROM public.admin_commands c
   WHERE c.id = v_command_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'command_not_found' USING ERRCODE = '22023';
  END IF;
  IF NOT (
    public.has_permission(v_command_key)
    OR public.has_active_elevation(v_command_key)
  ) THEN
    RAISE EXCEPTION 'approval_forbidden' USING ERRCODE = '42501';
  END IF;

  v_decision := CASE WHEN p_decision = 'approve' THEN 'approved' ELSE 'rejected' END;

  INSERT INTO public.admin_approval_decisions (approval_id, approver_id, decision, reason)
  VALUES (v_request_id, auth.uid(), p_decision, v_reason);

  UPDATE public.admin_approval_requests
     SET status = v_decision
   WHERE id = v_request_id;

  UPDATE public.admin_commands
     SET status = CASE WHEN p_decision = 'approve' THEN 'approved' ELSE 'cancelled' END,
         executed_at = NULL
   WHERE id = v_command_id;

  RETURN v_decision;
END;
$$;
REVOKE ALL ON FUNCTION public.decide_approval(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_approval(uuid, text, text) TO authenticated;
