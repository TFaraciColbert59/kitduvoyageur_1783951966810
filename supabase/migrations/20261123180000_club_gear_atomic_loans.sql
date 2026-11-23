-- ============================================================================
-- Atomic RPCs for Club Gear Loans & Stock Reservation (Phase 4)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.club_gear_request_loan(
  p_club_id uuid,
  p_gear_item_id uuid,
  p_quantity integer DEFAULT 1,
  p_event_id uuid DEFAULT NULL,
  p_needed_from date DEFAULT NULL,
  p_needed_until date DEFAULT NULL,
  p_note text DEFAULT NULL
) RETURNS public.club_gear_loans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_item public.club_gear_items%ROWTYPE;
  v_loan public.club_gear_loans%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;

  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'invalid_quantity' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.club_members m
    WHERE m.club_id = p_club_id AND m.user_id = v_actor AND m.status = 'active'
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_item
  FROM public.club_gear_items
  WHERE id = p_gear_item_id AND club_id = p_club_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_item.available OR v_item.quantity_available < p_quantity THEN
    RAISE EXCEPTION 'insufficient_stock' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.club_gear_loans (
    gear_item_id,
    club_id,
    borrower_id,
    status,
    quantity,
    event_id,
    needed_from,
    needed_until,
    note
  ) VALUES (
    p_gear_item_id,
    p_club_id,
    v_actor,
    'requested',
    p_quantity,
    p_event_id,
    p_needed_from,
    p_needed_until,
    p_note
  )
  RETURNING * INTO v_loan;

  RETURN v_loan;
END;
$$;

CREATE OR REPLACE FUNCTION public.club_gear_transition_loan(
  p_club_id uuid,
  p_loan_id uuid,
  p_next_status text,
  p_checkout_condition text DEFAULT NULL,
  p_return_condition text DEFAULT NULL,
  p_condition_note text DEFAULT NULL
) RETURNS public.club_gear_loans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_loan public.club_gear_loans%ROWTYPE;
  v_item public.club_gear_items%ROWTYPE;
  v_is_borrower boolean;
  v_is_owner boolean;
  v_is_manager boolean;
  v_was_holding boolean;
  v_will_hold boolean;
  v_next_avail integer;
  v_updated public.club_gear_loans%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_loan
  FROM public.club_gear_loans
  WHERE id = p_loan_id AND club_id = p_club_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_item
  FROM public.club_gear_items
  WHERE id = v_loan.gear_item_id AND club_id = p_club_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  v_is_borrower := (v_loan.borrower_id = v_actor);
  v_is_owner := (v_item.ownership_scope <> 'club' AND v_item.owner_id = v_actor);
  v_is_manager := public.club_has_capability(p_club_id, v_actor, 'gear.approve_club_loans'::public.club_capability);

  IF p_next_status = 'cancelled' THEN
    IF NOT (v_is_borrower OR v_is_owner OR v_is_manager) THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
  ELSIF v_item.ownership_scope = 'club' THEN
    IF NOT v_is_manager THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NOT (v_is_owner OR v_is_manager) THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Allowed state transitions
  IF NOT (
    (v_loan.status = 'requested' AND p_next_status IN ('approved', 'declined', 'cancelled'))
    OR (v_loan.status = 'approved' AND p_next_status IN ('checked_out', 'cancelled', 'declined'))
    OR (v_loan.status IN ('checked_out', 'overdue') AND p_next_status IN ('returned', 'overdue', 'issue'))
    OR (v_loan.status = 'issue' AND p_next_status = 'returned')
  ) THEN
    RAISE EXCEPTION 'invalid_transition' USING ERRCODE = '22023';
  END IF;

  v_was_holding := v_loan.status IN ('approved', 'checked_out', 'overdue', 'issue');
  v_will_hold := p_next_status IN ('approved', 'checked_out', 'overdue', 'issue');
  v_next_avail := v_item.quantity_available;

  IF NOT v_was_holding AND v_will_hold THEN
    IF v_item.quantity_available < v_loan.quantity THEN
      RAISE EXCEPTION 'insufficient_stock' USING ERRCODE = 'P0001';
    END IF;
    v_next_avail := v_item.quantity_available - v_loan.quantity;
  ELSIF v_was_holding AND NOT v_will_hold THEN
    v_next_avail := LEAST(v_item.quantity_total, v_item.quantity_available + v_loan.quantity);
  END IF;

  UPDATE public.club_gear_items
  SET quantity_available = v_next_avail,
      available = (v_next_avail > 0),
      condition_status = COALESCE(
        CASE WHEN p_next_status = 'returned' THEN p_return_condition ELSE NULL END,
        condition_status
      )
  WHERE id = v_item.id;

  UPDATE public.club_gear_loans
  SET status = p_next_status,
      handled_by = v_actor,
      checkout_condition = COALESCE(p_checkout_condition, checkout_condition),
      return_condition = COALESCE(p_return_condition, return_condition),
      condition_note = COALESCE(p_condition_note, condition_note),
      checked_out_at = CASE WHEN p_next_status = 'checked_out' THEN now() ELSE checked_out_at END,
      returned_at = CASE WHEN p_next_status = 'returned' THEN now() ELSE returned_at END
  WHERE id = v_loan.id
  RETURNING * INTO v_updated;

  RETURN v_updated;
END;
$$;
