-- ============================================================================
-- P1 — Reconstruction depuis le ledger et compensation de fraude canonique.
-- Le rebuild rejoue les décisions enregistrées ; il ne recrédite rien.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rebuild_progression_from_ledger(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row RECORD; v_active TEXT; v_total INT := 0;
  v_e INT := 0; v_p INT := 0; v_pa INT := 0; v_en INT := 0;
  v_lv RECORD;
  v_pe INT; v_pp INT; v_ppa INT; v_pen INT;
BEGIN
  SELECT id INTO v_active FROM public.progression_seasons WHERE status = 'active' LIMIT 1;
  DELETE FROM public.user_season_progress WHERE user_id = p_user_id;
  DELETE FROM public.user_progression WHERE user_id = p_user_id;

  FOR v_row IN
    SELECT * FROM public.reward_transactions
    WHERE user_id = p_user_id AND counts_for_progression = true
    ORDER BY created_at, id
  LOOP
    v_pe := COALESCE((SELECT (e->>'points')::int FROM jsonb_array_elements(v_row.skill_allocations) e WHERE e->>'skill' = 'explorer'), 0);
    v_pp := COALESCE((SELECT (e->>'points')::int FROM jsonb_array_elements(v_row.skill_allocations) e WHERE e->>'skill' = 'preparer'), 0);
    v_ppa := COALESCE((SELECT (e->>'points')::int FROM jsonb_array_elements(v_row.skill_allocations) e WHERE e->>'skill' = 'partager'), 0);
    v_pen := COALESCE((SELECT (e->>'points')::int FROM jsonb_array_elements(v_row.skill_allocations) e WHERE e->>'skill' = 'entraider'), 0);
    v_e := v_e + v_pe; v_p := v_p + v_pp; v_pa := v_pa + v_ppa; v_en := v_en + v_pen;
    v_total := v_total + v_row.points;

    IF v_row.season_id IS NOT NULL THEN
      INSERT INTO public.user_season_progress
        (user_id, season_id, season_points, skill_explorer_points, skill_preparer_points, skill_partager_points, skill_entraider_points, updated_at)
      VALUES
        (p_user_id, v_row.season_id, GREATEST(0, v_row.points), GREATEST(0, v_pe), GREATEST(0, v_pp), GREATEST(0, v_ppa), GREATEST(0, v_pen), now())
      ON CONFLICT (user_id, season_id) DO UPDATE SET
        season_points = GREATEST(0, public.user_season_progress.season_points + v_row.points),
        skill_explorer_points = GREATEST(0, public.user_season_progress.skill_explorer_points + v_pe),
        skill_preparer_points = GREATEST(0, public.user_season_progress.skill_preparer_points + v_pp),
        skill_partager_points = GREATEST(0, public.user_season_progress.skill_partager_points + v_ppa),
        skill_entraider_points = GREATEST(0, public.user_season_progress.skill_entraider_points + v_pen),
        updated_at = now();
    END IF;
  END LOOP;

  v_total := GREATEST(0, v_total);
  SELECT * INTO v_lv FROM public.progression_level_for(v_total);

  INSERT INTO public.user_progression
    (user_id, lifetime_points, season_points, level, level_title,
     skill_explorer_points, skill_preparer_points, skill_partager_points, skill_entraider_points, current_season_id)
  VALUES
    (p_user_id, v_total,
     COALESCE((SELECT season_points FROM public.user_season_progress WHERE user_id = p_user_id AND season_id = v_active), 0),
     v_lv.level, v_lv.level_title,
     GREATEST(0, v_e), GREATEST(0, v_p), GREATEST(0, v_pa), GREATEST(0, v_en), v_active);

  RETURN jsonb_build_object('success', true, 'lifetimePoints', v_total, 'replayed', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_progression_fraud_canonical(p_original_transaction_id UUID, p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_orig RECORD; v_key TEXT; v_alloc JSONB; v_existing UUID;
BEGIN
  SELECT * INTO v_orig FROM public.reward_transactions
    WHERE id = p_original_transaction_id AND counts_for_progression = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'original_introuvable');
  END IF;
  IF v_orig.skill_allocations IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'allocations_absentes');
  END IF;

  v_key := 'fraud_reversal:' || p_original_transaction_id;
  SELECT id INTO v_existing FROM public.reward_transactions WHERE idempotency_key = v_key;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'rewardTransactionId', v_existing);
  END IF;

  SELECT jsonb_agg(jsonb_build_object('skill', e->>'skill', 'weight', e->>'weight', 'points', -((e->>'points')::int)))
  INTO v_alloc FROM jsonb_array_elements(v_orig.skill_allocations) e;

  INSERT INTO public.reward_transactions
    (user_id, points, transaction_type, reference_id, reference_type, metadata,
     idempotency_key, effective_at, season_id, rules_version, skill_allocations, counts_for_progression, affects_balance)
  VALUES
    (v_orig.user_id, -v_orig.points, 'FRAUD_REVERSAL', v_orig.id, 'progression_correction',
     jsonb_build_object('reason', p_reason, 'original_transaction_id', v_orig.id),
     v_key, now(), v_orig.season_id, v_orig.rules_version, v_alloc, true, false)
  RETURNING id INTO v_existing;

  RETURN jsonb_build_object('success', true, 'rewardTransactionId', v_existing);
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_progression_from_ledger(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reverse_progression_fraud_canonical(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_progression_from_ledger(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reverse_progression_fraud_canonical(uuid,text) TO service_role;
