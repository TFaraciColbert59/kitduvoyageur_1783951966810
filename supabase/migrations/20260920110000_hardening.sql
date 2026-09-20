-- ============================================================================
-- Stabilisation P1/P3 — correctifs de la revue indépendante :
--  • refus temporaires (plafonds) non persistés définitivement ;
--  • borne de p_limit sur l'outbox + index partiels + purge/rejeu admin ;
--  • REVOKE des fonctions utilitaires et legacy exploitables ;
--  • search_path figé sur deux triggers du reward engine.
-- ============================================================================

-- ── 1. Attribution : ne jamais graver un refus de plafond (glissant) ─────────
CREATE OR REPLACE FUNCTION public.award_progression_gain(
  p_user_id UUID,
  p_action_type TEXT,
  p_source_type TEXT,
  p_source_id TEXT,
  p_effective_at TIMESTAMPTZ,
  p_points_total INTEGER,
  p_weights JSONB,
  p_explanation TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key TEXT := p_source_type || ':' || p_source_id;
  v_rules RECORD; v_decision RECORD; v_tx_id UUID; v_season TEXT; v_season_status TEXT;
  v_outcome TEXT := 'awarded'; v_reason TEXT;
  v_w_explorer NUMERIC; v_w_preparer NUMERIC; v_w_partager NUMERIC; v_w_entraider NUMERIC;
  v_p_explorer INT; v_p_preparer INT; v_p_partager INT; v_p_entraider INT; v_rest INT;
  v_alloc JSONB; v_grace INTERVAL; v_daily INT; v_weekly INT; v_season_cap INT; v_count INT;
  v_frac JSONB; v_f RECORD;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Identité non concordante';
  END IF;

  SELECT * INTO v_rules FROM public.progression_rules WHERE active;
  v_grace := (COALESCE((v_rules.payload->>'grace_days')::int, 14) || ' days')::interval;

  IF v_rules.payload->'actions'->p_action_type IS NULL THEN
    v_outcome := 'refused'; v_reason := 'action_non_autorisee';
  ELSIF p_points_total IS NULL OR p_points_total <= 0 THEN
    v_outcome := 'refused'; v_reason := 'gain_non_positif';
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

  IF v_outcome <> 'refused' THEN
    SELECT s.id, s.status INTO v_season, v_season_status FROM public.progression_seasons s
      WHERE p_effective_at >= s.starts_at AND p_effective_at <= s.ends_at
      ORDER BY s.starts_at DESC LIMIT 1;
    IF v_season IS NOT NULL AND v_season_status = 'completed'
       AND now() > (SELECT s.ends_at + v_grace FROM public.progression_seasons s WHERE s.id = v_season) THEN
      IF COALESCE(v_rules.payload->>'late_policy', 'refuse') = 'refuse' THEN
        v_outcome := 'refused'; v_reason := 'hors_delai';
      ELSE
        v_outcome := 'awarded_lifetime_only'; v_season := NULL;
      END IF;
    ELSIF v_season IS NULL THEN
      v_outcome := 'awarded_lifetime_only';
    END IF;
  END IF;

  IF v_outcome <> 'refused' THEN
    v_daily := (v_rules.payload->'actions'->p_action_type->'caps'->>'daily')::int;
    v_weekly := (v_rules.payload->'actions'->p_action_type->'caps'->>'weekly')::int;
    v_season_cap := (v_rules.payload->'actions'->p_action_type->'caps'->>'season')::int;
    IF v_daily IS NOT NULL THEN
      SELECT COUNT(*) INTO v_count FROM public.progression_decisions d
        WHERE d.user_id = p_user_id AND d.action_type = p_action_type AND d.outcome IN ('awarded','awarded_lifetime_only')
          AND d.effective_at > now() - interval '1 day';
      IF v_count >= v_daily THEN v_outcome := 'refused'; v_reason := 'plafond_quotidien'; END IF;
    END IF;
    IF v_outcome <> 'refused' AND v_weekly IS NOT NULL THEN
      SELECT COUNT(*) INTO v_count FROM public.progression_decisions d
        WHERE d.user_id = p_user_id AND d.action_type = p_action_type AND d.outcome IN ('awarded','awarded_lifetime_only')
          AND d.effective_at > now() - interval '7 days';
      IF v_count >= v_weekly THEN v_outcome := 'refused'; v_reason := 'plafond_hebdomadaire'; END IF;
    END IF;
    IF v_outcome <> 'refused' AND v_season_cap IS NOT NULL AND v_season IS NOT NULL THEN
      SELECT COUNT(*) INTO v_count FROM public.progression_decisions d
        WHERE d.user_id = p_user_id AND d.action_type = p_action_type AND d.outcome IN ('awarded','awarded_lifetime_only')
          AND d.effective_at >= (SELECT s.starts_at FROM public.progression_seasons s WHERE s.id = v_season)
          AND d.effective_at <= (SELECT s.ends_at FROM public.progression_seasons s WHERE s.id = v_season);
      IF v_count >= v_season_cap THEN v_outcome := 'refused'; v_reason := 'plafond_saison'; END IF;
    END IF;
  END IF;

  -- Refus temporaires (plafonds glissants) : jamais persistés, réévaluables au
  -- prochain appel. Les refus définitifs (action, poids, gain, hors-délai) sont
  -- conservés pour rendre le rejeu explicable.
  IF v_outcome = 'refused' AND v_reason IN ('plafond_quotidien', 'plafond_hebdomadaire', 'plafond_saison') THEN
    RETURN jsonb_build_object('success', false, 'outcome', 'refused', 'reason', v_reason,
      'temporary', true, 'idempotencyKey', v_key);
  END IF;

  INSERT INTO public.progression_decisions
    (idempotency_key, user_id, action_type, source_type, source_id, outcome, reason, rules_version, effective_at)
  VALUES
    (v_key, p_user_id, p_action_type, p_source_type, p_source_id, v_outcome, v_reason, COALESCE(v_rules.version,'v1'), p_effective_at)
  ON CONFLICT (idempotency_key) DO NOTHING;

  IF NOT FOUND THEN
    SELECT * INTO v_decision FROM public.progression_decisions WHERE idempotency_key = v_key;
    RETURN jsonb_build_object('success', v_decision.outcome IN ('awarded','awarded_lifetime_only'),
      'outcome', v_decision.outcome, 'reason', v_decision.reason, 'idempotencyKey', v_key,
      'idempotent', true, 'rewardTransactionId', v_decision.reward_transaction_id);
  END IF;

  IF v_outcome = 'refused' THEN
    RETURN jsonb_build_object('success', false, 'outcome', 'refused', 'reason', v_reason, 'idempotencyKey', v_key);
  END IF;

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
  FOR v_f IN SELECT value->>'k' AS k FROM jsonb_array_elements(v_frac) ORDER BY (value->>'r')::numeric DESC, value->>'k' LOOP
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

  UPDATE public.progression_decisions
  SET reward_transaction_id = v_tx_id, outcome = v_outcome
  WHERE idempotency_key = v_key;

  RETURN jsonb_build_object('success', true, 'outcome', v_outcome, 'idempotencyKey', v_key,
    'points', p_points_total, 'allocations', v_alloc, 'rewardTransactionId', v_tx_id, 'seasonId', v_season);
END;
$$;

REVOKE ALL ON FUNCTION public.award_progression_gain(uuid,text,text,text,timestamptz,integer,jsonb,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_progression_gain(uuid,text,text,text,timestamptz,integer,jsonb,text,jsonb) TO service_role;

-- ── 2. Outbox : borne de lot, index partiels, purge et rejeu admin ───────────
CREATE INDEX IF NOT EXISTS progression_outbox_pending_idx
  ON public.progression_outbox (status, available_at)
  WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS progression_outbox_processed_idx
  ON public.progression_outbox (processed_at)
  WHERE status = 'processed';

CREATE OR REPLACE FUNCTION public.purge_progression_outbox(p_keep_days INTEGER DEFAULT 90)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_deleted INTEGER;
BEGIN
  DELETE FROM public.progression_outbox
  WHERE status = 'processed'
    AND processed_at < now() - (GREATEST(1, COALESCE(p_keep_days, 90)) || ' days')::interval;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END; $$;

CREATE OR REPLACE FUNCTION public.replay_dead_progression_outbox(p_max INTEGER DEFAULT 100)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_replayed INTEGER;
BEGIN
  WITH target AS (
    SELECT id FROM public.progression_outbox
    WHERE status = 'dead'
    ORDER BY created_at
    LIMIT GREATEST(1, LEAST(COALESCE(p_max, 100), 1000))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.progression_outbox o
  SET status = 'pending', attempts = 0, available_at = now(), last_error = NULL, locked_at = NULL
  FROM target t WHERE o.id = t.id;
  GET DIAGNOSTICS v_replayed = ROW_COUNT;
  RETURN v_replayed;
END; $$;

REVOKE ALL ON FUNCTION public.purge_progression_outbox(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.replay_dead_progression_outbox(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_progression_outbox(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.replay_dead_progression_outbox(integer) TO service_role;

-- ── 3. REVOKE des fonctions utilitaires et legacy exploitables ───────────────
REVOKE ALL ON FUNCTION public.enqueue_progression_outbox() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.progression_level_for(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.progression_allocations_valid(integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_loyalty_points(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
-- NOTE séquencement : le REVOKE de `claim_reward_points` est volontairement
-- différé dans `20260922000000_claim_revoke_after_app_deploy.sql`. L'ancienne
-- route `/api/rewards/claim` (app déployée) l'appelle avec une session
-- utilisateur ; la révocation doit suivre le déploiement de la nouvelle route
-- (service role) pour ne pas interrompre les récompenses pendant la fenêtre.

-- ── 4. search_path figé sur les triggers du reward engine ────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user_reward_account()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.reward_accounts (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_reward_account_on_contribution()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pending' THEN
      INSERT INTO public.reward_accounts (user_id, pending_points)
      VALUES (NEW.user_id, NEW.final_points)
      ON CONFLICT (user_id) DO UPDATE SET
        pending_points = public.reward_accounts.pending_points + NEW.final_points,
        updated_at = now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
      UPDATE public.reward_accounts
      SET pending_points = GREATEST(0, pending_points - OLD.final_points),
          updated_at = now()
      WHERE user_id = NEW.user_id;
    ELSIF OLD.status = 'pending' AND NEW.status = 'rejected' THEN
      UPDATE public.reward_accounts
      SET pending_points = GREATEST(0, pending_points - OLD.final_points),
          invalid_points = invalid_points + OLD.final_points,
          updated_at = now()
      WHERE user_id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── 5. Classement : alias scopé (anti-corrélation) et masquage sous seuil ────
CREATE OR REPLACE FUNCTION public.leaderboard_alias(
  p_user_id UUID, p_scope_type TEXT, p_scope_id TEXT, p_season_id TEXT
) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT 'Voyageur ' || substr(
    md5(p_user_id::text || ':' || p_scope_type || ':' || COALESCE(p_scope_id, '') || ':' || COALESCE(p_season_id, '')),
    1, 6);
$$;
REVOKE ALL ON FUNCTION public.leaderboard_alias(uuid, text, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_leaderboard_for_user(
  p_user_id UUID,
  p_season_id TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points INTEGER;
  v_level INTEGER;
  v_title TEXT;
  v_country TEXT;
  v_region TEXT;
  v_city TEXT;
BEGIN
  IF p_user_id IS NULL OR p_season_id IS NULL THEN
    RETURN;
  END IF;

  SELECT GREATEST(0, season_points) INTO v_points
  FROM public.user_season_progress
  WHERE user_id = p_user_id AND season_id = p_season_id;

  IF NOT FOUND THEN
    DELETE FROM public.progression_leaderboard_agg
    WHERE user_id = p_user_id AND season_id = p_season_id;
    RETURN;
  END IF;

  v_points := COALESCE(v_points, 0);

  SELECT up.level, up.level_title INTO v_level, v_title
  FROM public.user_progression up
  WHERE up.user_id = p_user_id;

  IF v_level IS NULL THEN
    SELECT lv.level, lv.level_title INTO v_level, v_title
    FROM public.progression_level_for(0) lv;
  END IF;

  SELECT ut.country_code, ut.region_code, ut.city_code
    INTO v_country, v_region, v_city
  FROM public.user_territory ut
  WHERE ut.user_id = p_user_id;

  DELETE FROM public.progression_leaderboard_agg
  WHERE user_id = p_user_id
    AND season_id = p_season_id
    AND scope_type IN ('world', 'country', 'region', 'city');

  INSERT INTO public.progression_leaderboard_agg
    (season_id, scope_type, scope_id, user_id, alias, level, level_title, season_points, updated_at)
  VALUES
    (p_season_id, 'world', '', p_user_id,
     public.leaderboard_alias(p_user_id, 'world', '', p_season_id), v_level, v_title, v_points, now());

  IF v_country IS NOT NULL AND v_country <> '' THEN
    INSERT INTO public.progression_leaderboard_agg
      (season_id, scope_type, scope_id, user_id, alias, level, level_title, season_points, updated_at)
    VALUES
      (p_season_id, 'country', v_country, p_user_id,
       public.leaderboard_alias(p_user_id, 'country', v_country, p_season_id), v_level, v_title, v_points, now());
  END IF;

  IF v_region IS NOT NULL AND v_region <> '' THEN
    INSERT INTO public.progression_leaderboard_agg
      (season_id, scope_type, scope_id, user_id, alias, level, level_title, season_points, updated_at)
    VALUES
      (p_season_id, 'region', v_region, p_user_id,
       public.leaderboard_alias(p_user_id, 'region', v_region, p_season_id), v_level, v_title, v_points, now());
  END IF;

  IF v_city IS NOT NULL AND v_city <> '' THEN
    INSERT INTO public.progression_leaderboard_agg
      (season_id, scope_type, scope_id, user_id, alias, level, level_title, season_points, updated_at)
    VALUES
      (p_season_id, 'city', v_city, p_user_id,
       public.leaderboard_alias(p_user_id, 'city', v_city, p_season_id), v_level, v_title, v_points, now());
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_leaderboard_for_user(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_leaderboard_for_user(uuid, text) TO service_role;

-- Masquage k-anonyme : aucune ligne (ni rang) tant que le groupe est sous le seuil.
CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_user_id UUID,
  p_filter TEXT,
  p_limit INTEGER DEFAULT 50,
  p_cursor_points INTEGER DEFAULT NULL,
  p_cursor_user UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season TEXT;
  v_min INTEGER := 5;
  v_limit INTEGER;
  v_country TEXT;
  v_region TEXT;
  v_city TEXT;
  v_scope_id TEXT;
  v_total INTEGER := 0;
  v_rank INTEGER;
  v_refreshed TIMESTAMPTZ;
  v_rows JSONB := '[]'::jsonb;
  v_local_enabled BOOLEAN := false;
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
  v_access_count INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'user_required');
  END IF;
  IF p_filter IS NULL OR p_filter NOT IN ('world', 'country', 'region', 'city', 'local') THEN
    RETURN jsonb_build_object('error', 'invalid_filter');
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));

  SELECT id INTO v_season
  FROM public.progression_seasons
  WHERE status = 'active'
  ORDER BY starts_at DESC
  LIMIT 1;

  SELECT COALESCE((payload->>'min_participants')::int, 5) INTO v_min
  FROM public.progression_rules
  WHERE active = true
  LIMIT 1;
  IF v_min IS NULL OR v_min < 1 THEN
    v_min := 5;
  END IF;

  IF p_filter = 'local' THEN
    SELECT COALESCE(enabled, false) INTO v_local_enabled
    FROM public.feature_flags
    WHERE id = 'local_leaderboard_active';
    v_local_enabled := COALESCE(v_local_enabled, false);

    IF NOT v_local_enabled THEN
      RETURN jsonb_build_object(
        'rows', '[]'::jsonb, 'total_participants', 0, 'community_forming', true,
        'min_participants', v_min, 'refreshed_at', NULL, 'rank', NULL,
        'local_unavailable', true, 'reason', 'flag_off');
    END IF;

    SELECT count(*) INTO v_access_count
    FROM public.leaderboard_access_log
    WHERE user_id = p_user_id AND created_at > now() - interval '1 hour';

    IF v_access_count >= 30 THEN
      RETURN jsonb_build_object('error', 'rate_limited');
    END IF;

    SELECT lat, lng INTO v_lat, v_lng
    FROM public.user_territory_private
    WHERE user_id = p_user_id;

    IF v_lat IS NULL OR v_lng IS NULL THEN
      RETURN jsonb_build_object(
        'rows', '[]'::jsonb, 'total_participants', 0, 'community_forming', true,
        'min_participants', v_min, 'refreshed_at', NULL, 'rank', NULL,
        'local_unavailable', true, 'reason', 'no_private_attachment');
    END IF;

    IF v_season IS NULL THEN
      RETURN jsonb_build_object(
        'rows', '[]'::jsonb, 'total_participants', 0, 'community_forming', true,
        'min_participants', v_min, 'refreshed_at', NULL, 'rank', NULL,
        'season_unavailable', true);
    END IF;

    INSERT INTO public.leaderboard_access_log (user_id) VALUES (p_user_id);

    WITH candidates AS (
      SELECT
        p.user_id,
        public.leaderboard_alias(p.user_id, 'local', '', v_season) AS alias,
        COALESCE(up.level, 1) AS level,
        COALESCE(up.level_title, '') AS level_title,
        GREATEST(0, usp.season_points) AS season_points,
        usp.updated_at AS refreshed_at
      FROM public.user_territory_private p
      JOIN public.user_season_progress usp
        ON usp.user_id = p.user_id AND usp.season_id = v_season
      LEFT JOIN public.user_progression up ON up.user_id = p.user_id
      WHERE p.consent_at IS NOT NULL
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
          ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography,
          1000
        )
    ),
    ranked AS (
      SELECT c.*, rank() OVER (ORDER BY c.season_points DESC, c.user_id ASC) AS rank
      FROM candidates c
    ),
    page AS (
      SELECT r.*
      FROM ranked r
      WHERE p_cursor_points IS NULL
         OR p_cursor_user IS NULL
         OR r.season_points < p_cursor_points
         OR (r.season_points = p_cursor_points AND r.user_id > p_cursor_user)
      ORDER BY r.season_points DESC, r.user_id ASC
      LIMIT v_limit
    )
    SELECT
      COALESCE(
        (SELECT jsonb_agg(
            jsonb_build_object(
              'alias', page.alias,
              'level', page.level,
              'level_title', NULLIF(page.level_title, ''),
              'season_points', page.season_points,
              'rank', page.rank,
              'is_current_user', page.user_id = p_user_id
            ) ORDER BY page.season_points DESC, page.user_id ASC
          )
         FROM page),
        '[]'::jsonb
      ),
      (SELECT count(*)::int FROM ranked),
      (SELECT rank::int FROM ranked WHERE user_id = p_user_id),
      (SELECT max(refreshed_at) FROM ranked)
    INTO v_rows, v_total, v_rank, v_refreshed;

    IF COALESCE(v_total, 0) < v_min THEN
      v_rows := '[]'::jsonb;
      v_rank := NULL;
    END IF;

    RETURN jsonb_build_object(
      'rows', v_rows,
      'total_participants', COALESCE(v_total, 0),
      'community_forming', COALESCE(v_total, 0) < v_min,
      'min_participants', v_min,
      'refreshed_at', v_refreshed,
      'rank', v_rank
    );
  END IF;

  SELECT ut.country_code, ut.region_code, ut.city_code
    INTO v_country, v_region, v_city
  FROM public.user_territory ut
  WHERE ut.user_id = p_user_id;

  v_scope_id := CASE p_filter
    WHEN 'world'   THEN ''
    WHEN 'country' THEN COALESCE(v_country, '')
    WHEN 'region'  THEN COALESCE(v_region, '')
    WHEN 'city'    THEN COALESCE(v_city, '')
  END;

  IF v_season IS NULL THEN
    RETURN jsonb_build_object(
      'rows', '[]'::jsonb, 'total_participants', 0, 'community_forming', true,
      'min_participants', v_min, 'refreshed_at', NULL, 'rank', NULL,
      'season_unavailable', true);
  END IF;

  IF p_filter <> 'world' AND (v_scope_id IS NULL OR v_scope_id = '') THEN
    RETURN jsonb_build_object(
      'rows', '[]'::jsonb, 'total_participants', 0, 'community_forming', true,
      'min_participants', v_min, 'refreshed_at', NULL, 'rank', NULL,
      'territory_missing', true);
  END IF;

  WITH ranked AS (
    SELECT
      a.user_id, a.alias, a.level, a.level_title, a.season_points, a.updated_at,
      rank() OVER (ORDER BY a.season_points DESC, a.user_id ASC) AS rank
    FROM public.progression_leaderboard_agg a
    WHERE a.season_id = v_season
      AND a.scope_type = p_filter
      AND a.scope_id = v_scope_id
  ),
  page AS (
    SELECT r.*
    FROM ranked r
    WHERE p_cursor_points IS NULL
       OR p_cursor_user IS NULL
       OR r.season_points < p_cursor_points
       OR (r.season_points = p_cursor_points AND r.user_id > p_cursor_user)
    ORDER BY r.season_points DESC, r.user_id ASC
    LIMIT v_limit
  )
  SELECT
    COALESCE(
      (SELECT jsonb_agg(
          jsonb_build_object(
            'alias', page.alias,
            'level', page.level,
            'level_title', page.level_title,
            'season_points', page.season_points,
            'rank', page.rank,
            'is_current_user', page.user_id = p_user_id
          ) ORDER BY page.season_points DESC, page.user_id ASC
        )
       FROM page),
      '[]'::jsonb
    ),
    (SELECT count(*)::int FROM ranked),
    (SELECT rank::int FROM ranked WHERE user_id = p_user_id),
    (SELECT max(updated_at) FROM ranked)
  INTO v_rows, v_total, v_rank, v_refreshed;

  IF COALESCE(v_total, 0) < v_min THEN
    v_rows := '[]'::jsonb;
    v_rank := NULL;
  END IF;

  RETURN jsonb_build_object(
    'rows', v_rows,
    'total_participants', COALESCE(v_total, 0),
    'community_forming', COALESCE(v_total, 0) < v_min,
    'min_participants', v_min,
    'refreshed_at', v_refreshed,
    'rank', v_rank
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard(uuid, text, integer, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(uuid, text, integer, integer, uuid) TO service_role;

-- ── 6. Territoire déclaré : format et longueurs bornés ───────────────────────
ALTER TABLE public.user_territory DROP CONSTRAINT IF EXISTS chk_user_territory_codes;
ALTER TABLE public.user_territory ADD CONSTRAINT chk_user_territory_codes CHECK (
  (city_name IS NULL OR length(city_name) <= 120)
  AND (city_code IS NULL OR length(city_code) <= 12)
  AND (region_code IS NULL OR length(region_code) <= 12)
  AND (country_code IS NULL OR (length(country_code) = 2 AND country_code ~ '^[A-Z]{2}$'))
);
