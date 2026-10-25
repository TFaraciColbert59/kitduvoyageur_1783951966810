-- ============================================================================
-- 20260921100000_legacy_hardening.sql
--
-- Durcissement du legs — audit des 85 fonctions SECURITY DEFINER encore
-- exécutables par anon/authenticated (baseline prod). Additive et idempotente :
-- chaque REVOKE/ALTER est gardé par to_regprocedure/to_regclass, rejouable sans
-- erreur sur une base héritée comme sur une base neuve.
--
-- Classement de l'audit (appels .rpc() relevés dans src/ au 2026-09-20) :
--   (a) appelée par du code client ou une route à session utilisateur :
--       EXECUTE conservé pour authenticated, retiré à anon + garde interne ;
--   (b) appelée uniquement avec le service_role, par un cron, ou jamais :
--       EXECUTE retiré à anon et authenticated, conservé pour service_role ;
--   (c) fonction trigger / interne : EXECUTE retiré (hygiène) ;
--   (d) lecture utilitaire sûre (garde interne ou policy RLS) : laissée en
--       l'état (aucune modification) — voir le rapport d'audit.
--
-- Aucune donnée n'est écrite par cette migration ; les FK du volet B se
-- contentent de refuser l'ajout si des orphelins existent (échec explicite).
-- ============================================================================

-- ============================================================================
-- VOLET A — gardes internes des fonctions conservées pour authenticated
-- ============================================================================

-- 1. request_withdrawal : fuite de clé d'idempotence inter-utilisateurs.
--    La recherche retournait la demande d'un AUTRE utilisateur portant la même
--    clé (unique globale), divulguant son identifiant de retrait. La recherche
--    est désormais cantonnée au demandeur ; le reste du corps est inchangé.
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_amount numeric,
  p_payment_provider text,
  p_idempotency_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, extensions
AS $fn$
DECLARE
  v_user_id UUID;
  v_cashout_active BOOLEAN;
  v_available_cash NUMERIC(12,2);
  v_created_at TIMESTAMPTZ;
  v_min_age_days INTEGER;
  v_min_threshold NUMERIC(12,2);
  v_min_trust_score INTEGER;
  v_trust_score INTEGER;
  v_account_status TEXT;
  v_withdrawal_id UUID;
  v_existing_id UUID;
BEGIN
  -- Authenticated user required
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  -- 1. Check idempotency (cantonnée au demandeur : jamais la clé d'autrui)
  SELECT id INTO v_existing_id
  FROM public.reward_withdrawals
  WHERE idempotency_key = p_idempotency_key
    AND user_id = v_user_id;
  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  -- 2. Check Kill Switch
  SELECT (value->>'cashout_active')::boolean INTO v_cashout_active FROM public.reward_config WHERE key = 'kill_switches';
  IF NOT COALESCE(v_cashout_active, true) THEN
    RAISE EXCEPTION 'Les retraits sont temporairement désactivés par un administrateur';
  END IF;

  -- 3. Get User Account & Trust
  SELECT available_cash, status INTO v_available_cash, v_account_status FROM public.reward_accounts WHERE user_id = v_user_id;
  SELECT created_at, trust_score INTO v_created_at, v_trust_score FROM public.user_profiles WHERE id = v_user_id;

  IF v_account_status IN ('suspended', 'limited') THEN
    RAISE EXCEPTION 'Votre compte n''est pas autorisé à effectuer des retraits';
  END IF;

  -- 4. Check age constraint
  SELECT value::integer INTO v_min_age_days FROM public.reward_config WHERE key = 'cashout_min_age_days';
  IF v_created_at > (now() - (COALESCE(v_min_age_days, 30) || ' days')::interval) THEN
    RAISE EXCEPTION 'Votre compte est trop récent pour effectuer un retrait';
  END IF;

  -- 5. Check trust score constraint
  SELECT value::integer INTO v_min_trust_score FROM public.reward_config WHERE key = 'cashout_min_trust_score';
  IF COALESCE(v_trust_score, 50) < COALESCE(v_min_trust_score, 40) THEN
    RAISE EXCEPTION 'Votre score de confiance est insuffisant pour effectuer un retrait';
  END IF;

  -- 6. Check min threshold
  SELECT value::numeric(12,2) INTO v_min_threshold FROM public.reward_config WHERE key = 'cashout_min_threshold';
  IF p_amount < COALESCE(v_min_threshold, 20.00) THEN
    RAISE EXCEPTION 'Le montant minimum de retrait est de % €', COALESCE(v_min_threshold, 20.00);
  END IF;

  -- 7. Check balance
  IF p_amount > v_available_cash THEN
    RAISE EXCEPTION 'Solde de récompenses disponibles insuffisant';
  END IF;

  -- 8. Deduct available cash and move to pending cash (atomic lock)
  UPDATE public.reward_accounts
  SET available_cash = available_cash - p_amount,
      pending_cash = pending_cash + p_amount,
      updated_at = now()
  WHERE user_id = v_user_id;

  -- 9. Insert withdrawal request
  INSERT INTO public.reward_withdrawals (
    user_id,
    amount,
    points_redeemed,
    currency,
    status,
    payment_provider,
    idempotency_key,
    metadata,
    risk_score
  ) VALUES (
    v_user_id,
    p_amount,
    0,
    'EUR',
    'pending',
    p_payment_provider,
    p_idempotency_key,
    p_metadata,
    CASE WHEN COALESCE(v_trust_score, 50) < 50 THEN 40 ELSE 0 END
  )
  RETURNING id INTO v_withdrawal_id;

  RETURN v_withdrawal_id;
END;
$fn$;

-- 2. get_user_badges_progress : lecture des badges d'autrui possible avec un
--    p_user_id arbitraire. Garde : seul le titulaire du JWT peut se lire.
CREATE OR REPLACE FUNCTION public.get_user_badges_progress(p_user_id uuid)
 RETURNS SETOF badge_progress_result
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, extensions
AS $fn$
DECLARE
    v_posts_count INTEGER := 0;
    v_reviews_count INTEGER := 0;
    v_questions_count INTEGER := 0;
    v_kits_count INTEGER := 0;
    v_auctions_count INTEGER := 0;
    b RECORD;
    res badge_progress_result;
    v_current_val INTEGER;
    v_unlocked_at TIMESTAMP WITH TIME ZONE;
BEGIN
    IF p_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Accès interdit aux badges d''un autre utilisateur';
    END IF;

    -- Count real data from existing tables (if they exist)
    SELECT COUNT(*) INTO v_posts_count FROM public.community_posts WHERE author_id = p_user_id;
    SELECT COUNT(*) INTO v_reviews_count FROM public.product_reviews WHERE user_id = p_user_id;
    SELECT COUNT(*) INTO v_questions_count FROM public.qa_answers WHERE author_id = p_user_id;
    SELECT COUNT(*) INTO v_kits_count FROM public.kits WHERE user_id = p_user_id;
    SELECT COUNT(*) INTO v_auctions_count FROM public.auction_bids WHERE user_id = p_user_id AND is_winning = true;
    
    FOR b IN SELECT * FROM public.badges WHERE active = true ORDER BY requirement_value ASC
    LOOP
        res.id := b.id;
        res.name := b.name;
        res.slug := b.slug;
        res.description := b.description;
        res.icon := b.icon;
        res.category := b.category;
        res.rarity := b.rarity;
        res.points_reward := b.points_reward;
        res.requirement_type := b.requirement_type;
        res.requirement_value := b.requirement_value;
        
        -- Calcul de la valeur actuelle selon le type
        IF b.requirement_type = 'post_created' THEN
            v_current_val := v_posts_count;
        ELSIF b.requirement_type = 'review_written' THEN
            v_current_val := v_reviews_count;
        ELSIF b.requirement_type = 'question_answered' THEN
            v_current_val := v_questions_count;
        ELSIF b.requirement_type = 'kit_configured' THEN
            v_current_val := v_kits_count;
        ELSIF b.requirement_type = 'auction_won' THEN
            v_current_val := v_auctions_count;
        ELSE
            -- Type générique non implémenté = 0 (attente de fonctionnalités futures)
            v_current_val := 0;
        END IF;

        -- Vérifier si l'utilisateur a déjà débloqué
        SELECT earned_at INTO v_unlocked_at FROM public.user_badges WHERE user_id = p_user_id AND badge_id = b.id LIMIT 1;

        res.earned_at := v_unlocked_at;
        
        IF v_unlocked_at IS NOT NULL THEN
            res.is_unlocked := true;
            res.current_value := b.requirement_value;
            res.percentage := 100;
        ELSE
            res.is_unlocked := false;
            res.current_value := LEAST(v_current_val, b.requirement_value);
            
            IF b.requirement_value > 0 THEN
                res.percentage := LEAST(100, ROUND((res.current_value::numeric / b.requirement_value::numeric) * 100));
            ELSE
                res.percentage := 0;
            END IF;
        END IF;

        RETURN NEXT res;
    END LOOP;
END;
$fn$;

-- 3. cleanup_expired_trash_kits : purge globale déclenchable sans identité.
--    Garde : toute session authentifiée peut déclencher la purge (comportement
--    voulu — nettoyage opportuniste), jamais un appel anonyme.
CREATE OR REPLACE FUNCTION public.cleanup_expired_trash_kits()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, extensions
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  DELETE FROM public.custom_kits
  WHERE status = 'trash'
    AND deleted_at IS NOT NULL
    AND deleted_at < (now() - INTERVAL '10 days');
END;
$fn$;

-- 4. record_hike_gear_usage : la mise à jour est déjà cantonnée à auth.uid() ;
--    garde explicite ajoutée pour refuser un appel anonyme avant toute écriture.
CREATE OR REPLACE FUNCTION public.record_hike_gear_usage(p_gear_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, extensions
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  IF p_gear_ids IS NOT NULL AND array_length(p_gear_ids, 1) > 0 THEN
    UPDATE public.gear_items
    SET 
      usage_count = COALESCE(usage_count, 0) + 1,
      last_used_date = CURRENT_DATE,
      sorties_count = COALESCE(sorties_count, 0) + 1
    WHERE id = ANY(p_gear_ids)
      AND user_id = auth.uid();
  END IF;
END;
$fn$;

-- ============================================================================
-- VOLET A (suite) — REVOKEs ciblés
-- ============================================================================

-- (a) Conserver EXECUTE à authenticated uniquement.
--     anon est retiré ; PUBLIC est retiré pour que la seule voie soit un JWT.
DO $$
DECLARE
  v_sig text;
  v_sigs text[] := ARRAY[
    'public.attach_adventure_plan_to_trip(uuid,uuid,uuid)',
    'public.cleanup_expired_trash_kits()',
    'public.finalize_reward_period(text,numeric)',
    'public.get_or_create_direct_conversation(uuid)',
    'public.get_user_badges_progress(uuid)',
    'public.join_event(uuid)',
    'public.leave_event(uuid)',
    'public.process_pending_contribution(uuid,boolean,text)',
    'public.process_withdrawal(uuid,boolean,text,text)',
    'public.record_hike_gear_usage(uuid[])',
    'public.request_withdrawal(numeric,text,text,jsonb)',
    'public.select_adventure_plan_route(uuid,bigint,uuid)',
    'public.toggle_community_post_like(uuid)'
  ];
BEGIN
  FOREACH v_sig IN ARRAY v_sigs LOOP
    IF to_regprocedure(v_sig) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', v_sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', v_sig);
    END IF;
  END LOOP;
END $$;

-- (b) Réservées au service_role / cron / jamais appelées par l'app.
DO $$
DECLARE
  v_sig text;
  v_sigs text[] := ARRAY[
    'public.can_user_bid(uuid)',
    'public.can_user_sell_auction(uuid)',
    'public.check_and_increment_ai_quota(uuid,text,text,integer)',
    'public.decrement_stock_on_order(uuid,integer,text,uuid)',
    'public.delete_places_batch(uuid[])',
    'public.get_ai_cache(text)',
    'public.get_comparable_sales(uuid,integer)',
    'public.get_hiking_routes_geojson()',
    'public.get_occasion_listing_for_product(uuid)',
    'public.get_trail_pois_geojson()',
    'public.increment_stock(uuid,integer,text,text,uuid,text)',
    'public.log_materiel_history(uuid,text,text,uuid,text,jsonb)',
    'public.place_bid(uuid,uuid,integer,boolean)',
    'public.purge_expired_lkv_events()',
    'public.purge_rejected_club_requests()',
    'public.redeem_reward(uuid,uuid)',
    'public.refresh_kit_conservation()',
    'public.refresh_user_field_signature()',
    'public.send_digests()',
    'public.send_materiel_reminders()',
    'public.set_ai_cache(text,text,jsonb,text,text,integer)',
    'public.set_auto_bid(uuid,uuid,integer)'
  ];
BEGIN
  FOREACH v_sig IN ARRAY v_sigs LOOP
    IF to_regprocedure(v_sig) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_sig);
    END IF;
  END LOOP;
END $$;

-- (c) Fonctions trigger / internes : jamais des RPC, retirées à tout le monde
--     sauf au propriétaire (et à service_role, sans usage direct).
DO $$
DECLARE
  v_sig text;
  v_sigs text[] := ARRAY[
    'public.coverage_log_dataset_event()',
    'public.enforce_group_role_change()',
    'public.enforce_reference_member_active()',
    'public.freeze_trip_owner()',
    'public.guard_user_profile_privileged_columns()',
    'public.handle_field_proven_count()',
    'public.handle_kit_lineage()',
    'public.handle_new_user()',
    'public.handle_new_user_reward_account()',
    'public.handle_trip_owner_collaborator()',
    'public.lkv_ensure_auto_crew()',
    'public.lkv_seed_trip_checklist_template()',
    'public.log_group_activity()',
    'public.notify(uuid,text,text,text,uuid,text,uuid,text)',
    'public.process_order_points()',
    'public.seed_group_owner_membership()',
    'public.sync_community_post_comments_count()',
    'public.sync_loyalty_points()',
    'public.trg_on_carnet_comment()',
    'public.trg_on_carnet_like()',
    'public.trg_on_community_post_comment()',
    'public.trg_on_community_post_like()',
    'public.trg_on_group_expense_added()',
    'public.trg_on_group_member_join()',
    'public.trg_on_group_message()',
    'public.trg_on_group_task_assigned()',
    'public.update_reward_account_on_contribution()',
    'public.update_reward_account_on_transaction()'
  ];
BEGIN
  FOREACH v_sig IN ARRAY v_sigs LOOP
    IF to_regprocedure(v_sig) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_sig);
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- VOLET B — intégrité RGPD : FK ON DELETE CASCADE vers auth.users(id)
-- Les dix tables de progression/classement/territoire n'avaient aucune FK :
-- la suppression de compte laissait des orphelins. Préflight : toute ligne
-- orpheline fait échouer la migration avec un message explicite (jamais de
-- suppression silencieuse).
-- ============================================================================
DO $$
DECLARE
  v_table text;
  v_orphans bigint;
  v_tables text[] := ARRAY[
    'user_season_progress',
    'progression_outbox',
    'progression_decisions',
    'progression_legacy_snapshot',
    'progression_leaderboard_agg',
    'leaderboard_refresh_queue',
    'leaderboard_access_log',
    'territory_change_log',
    'user_territory',
    'user_territory_private'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass('public.' || v_table) IS NULL THEN
      CONTINUE; -- table absente d'une base partielle : rien à faire
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM public.%I t
       WHERE t.user_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.user_id)',
      v_table
    ) INTO v_orphans;

    IF v_orphans > 0 THEN
      RAISE EXCEPTION
        'legacy_hardening: % ligne(s) orpheline(s) dans public.%, FK CASCADE refusée — purge requise avant migration',
        v_orphans, v_table;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      v_table, v_table || '_user_id_fkey'
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE',
      v_table, v_table || '_user_id_fkey'
    );
  END LOOP;
END $$;

-- ============================================================================
-- VOLET C — privilèges par défaut
-- anon/authenticated n'ont plus CREATE sur public (aucune migration applicative
-- ne s'exécute avec ces rôles), ni TRUNCATE/REFERENCES/TRIGGER sur les tables
-- (PostgREST n'utilise que SELECT/INSERT/UPDATE/DELETE). Le privilège CREATE
-- était porté par PUBLIC (@grant =UC) : il est retiré de PUBLIC, sinon
-- anon/authenticated l'hériteraient malgré le REVOKE nominatif. CREATE est
-- regranté explicitement aux rôles de migration (postgres/supabase_admin) pour
-- que la chaîne DDL reste jouable même si public n'est pas leur schéma.
-- Les privilèges par défaut du rôle postgres sont alignés pour les tables futures.
-- ============================================================================
REVOKE CREATE ON SCHEMA public FROM anon, authenticated;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

DO $$
BEGIN
  IF to_regrole('postgres') IS NOT NULL THEN
    EXECUTE 'GRANT CREATE ON SCHEMA public TO postgres';
  END IF;
  IF to_regrole('supabase_admin') IS NOT NULL THEN
    EXECUTE 'GRANT CREATE ON SCHEMA public TO supabase_admin';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regrole('postgres') IS NOT NULL THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
             REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated';
  END IF;
END $$;
