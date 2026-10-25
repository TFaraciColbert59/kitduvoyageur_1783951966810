-- T11/T48 — Réconciliation doctrinale : un refus TEMPORAIRE (plafonds) gravé
-- dans la décision est réévaluable — quand le fait est représenté après la
-- fenêtre, la même clé est promue vers un gain (sans doublon ni réécriture
-- d'historique). Les refus définitifs et les succès restent idempotents.

CREATE OR REPLACE FUNCTION public.award_progression_gain(
  p_user_id UUID,
  p_action_type TEXT,
  p_source_type TEXT,
  p_source_id TEXT,
  p_effective_at TIMESTAMPTZ,
  p_points_total INTEGER,
  p_weights JSONB,
  p_explanation TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_claims JSONB DEFAULT '[]'::jsonb
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key TEXT := p_source_type || ':' || p_source_id;
  v_rules RECORD; v_decision RECORD; v_tx_id UUID; v_season TEXT; v_season_status TEXT;
  v_outcome TEXT := 'awarded'; v_reason TEXT;
  v_w_explorer NUMERIC; v_w_preparer NUMERIC; v_w_partager NUMERIC; v_w_entraider NUMERIC;
  v_p_explorer INT; v_p_preparer INT; v_p_partager INT; v_p_entraider INT; v_rest INT;
  v_alloc JSONB; v_grace INTERVAL; v_daily INT; v_weekly INT; v_season_cap INT; v_count INT;
  v_frac JSONB; v_f RECORD;
  v_group TEXT; v_group_actions TEXT[]; v_day_start TIMESTAMPTZ; v_week_start TIMESTAMPTZ;
  v_season_start TIMESTAMPTZ; v_season_end TIMESTAMPTZ;
  v_claim JSONB; v_claims JSONB := COALESCE(p_claims, '[]'::jsonb);
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Identité non concordante';
  END IF;

  -- T08.1 — verrou transactionnel par utilisateur (plafonds + claims).
  PERFORM pg_advisory_xact_lock(hashtextextended('progression:' || p_user_id::text, 0));

  SELECT * INTO v_rules FROM public.progression_rules WHERE active;
  v_grace := (COALESCE((v_rules.payload->>'grace_days')::int, 14) || ' days')::interval;

  -- Éligibilité
  IF jsonb_typeof(v_claims) <> 'array' THEN
    v_outcome := 'refused'; v_reason := 'claims_invalides';
  ELSIF v_rules.payload->'actions'->p_action_type IS NULL THEN
    v_outcome := 'refused'; v_reason := 'action_non_autorisee';
  ELSIF p_points_total IS NULL OR p_points_total <= 0 THEN
    v_outcome := 'refused'; v_reason := 'gain_non_positif';
  ELSIF p_effective_at > now() + interval '5 minutes' THEN
    v_outcome := 'refused'; v_reason := 'date_future';
  ELSE
    v_w_explorer := COALESCE((p_weights->>'explorer')::numeric, -1);
    v_w_preparer := COALESCE((p_weights->>'preparer')::numeric, -1);
    v_w_partager := COALESCE((p_weights->>'partager')::numeric, -1);
    v_w_entraider := COALESCE((p_weights->>'entraider')::numeric, -1);
    IF v_w_explorer < 0 OR v_w_preparer < 0 OR v_w_partager < 0 OR v_w_entraider < 0
       OR ABS((v_w_explorer + v_w_preparer + v_w_partager + v_w_entraider) - 1) > 0.0001 THEN
      v_outcome := 'refused'; v_reason := 'poids_invalides';
    END IF;
  END IF;

  -- Saison : fenêtre [début, fin) de la date métier, grâce, politique de retard.
  IF v_outcome <> 'refused' THEN
    SELECT s.id, s.status, s.starts_at, s.ends_at
      INTO v_season, v_season_status, v_season_start, v_season_end
      FROM public.progression_seasons s
      WHERE p_effective_at >= s.starts_at AND p_effective_at < s.ends_at
      ORDER BY s.starts_at DESC LIMIT 1;
    IF v_season IS NOT NULL AND v_season_status = 'completed'
       AND now() > (v_season_end + v_grace) THEN
      IF COALESCE(v_rules.payload->>'late_policy', 'refuse') = 'refuse' THEN
        v_outcome := 'refused'; v_reason := 'hors_delai';
      ELSE
        v_outcome := 'awarded_lifetime_only'; v_season := NULL;
      END IF;
    ELSIF v_season IS NULL THEN
      v_outcome := 'awarded_lifetime_only';
    END IF;
  END IF;

  -- Claims : toute réservation existante refuse AVANT les plafonds.
  IF v_outcome <> 'refused' THEN
    FOR v_claim IN SELECT value FROM jsonb_array_elements(v_claims) LOOP
      IF COALESCE(v_claim->>'group', '') = '' OR COALESCE(v_claim->>'key', '') = '' THEN
        v_outcome := 'refused'; v_reason := 'claims_invalides'; EXIT;
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.progression_claims c
        WHERE c.user_id = p_user_id
          AND c.claim_group = v_claim->>'group'
          AND c.evidence_key = v_claim->>'key'
      ) THEN
        v_outcome := 'refused'; v_reason := 'fait_deja_reclame'; EXIT;
      END IF;
    END LOOP;
  END IF;

  -- Plafonds : comptés par date métier, par cap_group publié.
  IF v_outcome <> 'refused' THEN
    v_daily := (v_rules.payload->'actions'->p_action_type->'caps'->>'daily')::int;
    v_weekly := (v_rules.payload->'actions'->p_action_type->'caps'->>'weekly')::int;
    v_season_cap := (v_rules.payload->'actions'->p_action_type->'caps'->>'season')::int;

    v_group := p_action_type;
    v_group_actions := ARRAY[p_action_type];
    SELECT g->>'id', ARRAY(SELECT jsonb_array_elements_text(g->'members'))
      INTO v_group, v_group_actions
      FROM jsonb_array_elements(COALESCE(v_rules.payload->'cap_groups', '[]'::jsonb)) g
      WHERE g->'members' ? p_action_type
      LIMIT 1;
    -- If the SELECT INTO found no group row, all targets became NULL :
    -- retomber explicitement sur l'action seule (barème sans cap_groups).
    IF v_group_actions IS NULL THEN
      v_group := p_action_type;
      v_group_actions := ARRAY[p_action_type];
    END IF;

    v_day_start := date_trunc('day', p_effective_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
    v_week_start := date_trunc('week', p_effective_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

    IF v_daily IS NOT NULL THEN
      SELECT COUNT(*) INTO v_count FROM public.progression_decisions d
        WHERE d.user_id = p_user_id AND d.action_type = ANY(v_group_actions)
          AND d.outcome IN ('awarded','awarded_lifetime_only')
          AND d.effective_at >= v_day_start AND d.effective_at < v_day_start + interval '1 day';
      IF v_count >= v_daily THEN v_outcome := 'refused'; v_reason := 'plafond_quotidien'; END IF;
    END IF;
    IF v_outcome <> 'refused' AND v_weekly IS NOT NULL THEN
      SELECT COUNT(*) INTO v_count FROM public.progression_decisions d
        WHERE d.user_id = p_user_id AND d.action_type = ANY(v_group_actions)
          AND d.outcome IN ('awarded','awarded_lifetime_only')
          AND d.effective_at >= v_week_start AND d.effective_at < v_week_start + interval '7 days';
      IF v_count >= v_weekly THEN v_outcome := 'refused'; v_reason := 'plafond_hebdomadaire'; END IF;
    END IF;
    IF v_outcome <> 'refused' AND v_season_cap IS NOT NULL AND v_season IS NOT NULL THEN
      SELECT COUNT(*) INTO v_count FROM public.progression_decisions d
        WHERE d.user_id = p_user_id AND d.action_type = ANY(v_group_actions)
          AND d.outcome IN ('awarded','awarded_lifetime_only')
          AND d.effective_at >= v_season_start AND d.effective_at < v_season_end;
      IF v_count >= v_season_cap THEN v_outcome := 'refused'; v_reason := 'plafond_saison'; END IF;
    END IF;
  END IF;

  -- Décision : le premier appel décide, les rejeux lisent la décision existante
  -- (avant tout calcul de plafond : un rejeu retrouve son succès passé).
  INSERT INTO public.progression_decisions
    (idempotency_key, user_id, action_type, source_type, source_id, outcome, reason, rules_version, effective_at)
  VALUES
    (v_key, p_user_id, p_action_type, p_source_type, p_source_id, v_outcome, v_reason, COALESCE(v_rules.version,'v1'), p_effective_at)
  ON CONFLICT (idempotency_key) DO NOTHING;

  IF NOT FOUND THEN
    SELECT * INTO v_decision FROM public.progression_decisions WHERE idempotency_key = v_key;
    -- Réévaluation doctrinale (T11/T48) : un refus TEMPORAIRE (plafonds) gravé
    -- pour explicabilité peut être rejugé quand le fait est représenté après la
    -- fenêtre ; un succès ou un refus définitif restent idempotents.
    IF v_decision.outcome = 'refused'
       AND v_decision.reason IN ('plafond_quotidien','plafond_hebdomadaire','plafond_saison')
       AND v_outcome IN ('awarded','awarded_lifetime_only') THEN
      -- Le fait est enfin créditable : on poursuit vers le chemin de gain ;
      -- la décision gravée sera mise à jour (outcome + transaction) en fin de
      -- fonction, même clé d'idempotence unique, sans doublon.
      NULL;
    ELSE
      RETURN jsonb_build_object('success', v_decision.outcome IN ('awarded','awarded_lifetime_only'),
        'outcome', v_decision.outcome, 'reason', v_decision.reason, 'idempotencyKey', v_key,
        'idempotent', true, 'rewardTransactionId', v_decision.reward_transaction_id);
    END IF;
  END IF;

  IF v_outcome = 'refused' THEN
    RETURN jsonb_build_object('success', false, 'outcome', 'refused', 'reason', v_reason, 'idempotencyKey', v_key);
  END IF;

  -- Ventilation déterministe (plus fort reste, ordre fixe explorer/preparer/partager/entraider)
  v_p_explorer := FLOOR(p_points_total * v_w_explorer);
  v_p_preparer := FLOOR(p_points_total * v_w_preparer);
  v_p_partager := FLOOR(p_points_total * v_w_partager);
  v_p_entraider := FLOOR(p_points_total * v_w_entraider);
  v_rest := p_points_total - (v_p_explorer + v_p_preparer + v_p_partager + v_p_entraider);
  v_frac := jsonb_build_array(
    jsonb_build_object('k','explorer','r',(p_points_total * v_w_explorer) - v_p_explorer),
    jsonb_build_object('k','preparer','r',(p_points_total * v_w_preparer) - v_p_preparer),
    jsonb_build_object('k','partager','r',(p_points_total * v_w_partager) - v_p_partager),
    jsonb_build_object('k','entraider','r',(p_points_total * v_w_entraider) - v_p_entraider));
  -- Priorité fixe sur égalité de reste : Explorer, Préparer, Partager, Entraider
  -- (aligné sur la méthode TS `validateAndDistributeSkillPoints`).
  FOR v_f IN SELECT value->>'k' AS k FROM jsonb_array_elements(v_frac)
    ORDER BY (value->>'r')::numeric DESC,
             CASE value->>'k' WHEN 'explorer' THEN 1 WHEN 'preparer' THEN 2 WHEN 'partager' THEN 3 ELSE 4 END LOOP
    EXIT WHEN v_rest <= 0;
    IF v_f.k = 'explorer' THEN v_p_explorer := v_p_explorer + 1;
    ELSIF v_f.k = 'preparer' THEN v_p_preparer := v_p_preparer + 1;
    ELSIF v_f.k = 'partager' THEN v_p_partager := v_p_partager + 1;
    ELSE v_p_entraider := v_p_entraider + 1; END IF;
    v_rest := v_rest - 1;
  END LOOP;
  v_alloc := jsonb_build_array(
    jsonb_build_object('skill','explorer','weight',v_w_explorer,'points',v_p_explorer),
    jsonb_build_object('skill','preparer','weight',v_w_preparer,'points',v_p_preparer),
    jsonb_build_object('skill','partager','weight',v_w_partager,'points',v_p_partager),
    jsonb_build_object('skill','entraider','weight',v_w_entraider,'points',v_p_entraider));

  INSERT INTO public.reward_transactions
    (user_id, points, transaction_type, reference_type, metadata, idempotency_key, effective_at, season_id,
     rules_version, skill_allocations, counts_for_progression, affects_balance)
  VALUES
    (p_user_id, p_points_total, 'PROGRESSION_AWARD', p_source_type,
     COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('action_type', p_action_type, 'explanation', p_explanation, 'source_id', p_source_id),
     v_key, p_effective_at, v_season, COALESCE(v_rules.version,'v1'), v_alloc, true, false)
  RETURNING id INTO v_tx_id;

  -- Réservations de faits : écrites avec le gain ; l'échec annule l'ensemble.
  IF jsonb_array_length(v_claims) > 0 THEN
    FOR v_claim IN SELECT value FROM jsonb_array_elements(v_claims) LOOP
      INSERT INTO public.progression_claims (user_id, claim_group, evidence_key, reward_transaction_id)
      VALUES (p_user_id, v_claim->>'group', v_claim->>'key', v_tx_id);
    END LOOP;
  END IF;

  UPDATE public.progression_decisions
  SET reward_transaction_id = v_tx_id, outcome = v_outcome
  WHERE idempotency_key = v_key;

  RETURN jsonb_build_object('success', true, 'outcome', v_outcome, 'idempotencyKey', v_key,
    'points', p_points_total, 'allocations', v_alloc, 'rewardTransactionId', v_tx_id, 'seasonId', v_season);
END;
$$;

REVOKE ALL ON FUNCTION public.award_progression_gain(uuid,text,text,text,timestamptz,integer,jsonb,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_progression_gain(uuid,text,text,text,timestamptz,integer,jsonb,text,jsonb,jsonb) TO service_role;
