-- ============================================================================
-- ADMIN OS P0-10 — decide_approval() : vote atomique SoD + permission.
-- DOWN: DROP FUNCTION IF EXISTS public.decide_approval(uuid, text, text);
-- Voie UNIQUE de décision en prod (aucune policy UPDATE/INSERT directe) :
-- pending + SoD (approbateur ≠ initiateur) + has_permission(command_key)
-- + reason ≥ 10 + décision unique (UNIQUE approval_id) + propagation
-- statuts, le tout dans UNE transaction (pas de race à deux approbateurs).
-- ============================================================================

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
  -- L'approbateur doit détenir la permission de la commande elle-même
  -- (ex. commerce.refund.approve) : le second regard est un regard habilité.
  IF NOT public.has_permission(v_command_key) THEN
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
