


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."admin_role" AS ENUM (
    'super_admin',
    'admin',
    'moderateur'
);


ALTER TYPE "public"."admin_role" OWNER TO "postgres";


CREATE TYPE "public"."audit_action" AS ENUM (
    'CREATE',
    'UPDATE',
    'DELETE',
    'APPROVE',
    'REJECT',
    'REFUND',
    'ROLE_CHANGE',
    'SUSPEND',
    'REACTIVATE'
);


ALTER TYPE "public"."audit_action" OWNER TO "postgres";


CREATE TYPE "public"."badge_progress_result" AS (
	"id" "uuid",
	"name" "text",
	"slug" "text",
	"description" "text",
	"icon" "text",
	"category" "text",
	"rarity" "text",
	"points_reward" integer,
	"requirement_type" "text",
	"requirement_value" integer,
	"current_value" integer,
	"percentage" integer,
	"is_unlocked" boolean,
	"earned_at" timestamp with time zone
);


ALTER TYPE "public"."badge_progress_result" OWNER TO "postgres";


CREATE TYPE "public"."geo_country_geometry_source" AS ENUM (
    'natural_earth',
    'geonames',
    'osm',
    'manual'
);


ALTER TYPE "public"."geo_country_geometry_source" OWNER TO "postgres";


CREATE TYPE "public"."geo_feature_class" AS ENUM (
    'A',
    'H',
    'L',
    'P',
    'R',
    'S',
    'T',
    'U',
    'V'
);


ALTER TYPE "public"."geo_feature_class" OWNER TO "postgres";


CREATE TYPE "public"."geo_feature_code" AS ENUM (
    'PCLI',
    'PCL',
    'PCLD',
    'PCLF',
    'PCLIX',
    'PCLS',
    'TERR',
    'PCLX',
    'ADM1',
    'ADM2',
    'ADM3',
    'ADM4',
    'ADMD',
    'PRK',
    'H',
    'PPL',
    'PPLA',
    'PPLA2',
    'PPLA3',
    'PPLA4',
    'PPLC',
    'PPLCH',
    'PPLF',
    'PPLG',
    'PPLH',
    'PPLL',
    'PPLQ',
    'PPLR',
    'PPLS',
    'PPLW',
    'PPLX',
    'STLMT',
    'PSCL'
);


ALTER TYPE "public"."geo_feature_code" OWNER TO "postgres";


CREATE TYPE "public"."group_expense_status" AS ENUM (
    'pending',
    'settled'
);


ALTER TYPE "public"."group_expense_status" OWNER TO "postgres";


CREATE TYPE "public"."group_member_role" AS ENUM (
    'organizer',
    'co_organizer',
    'member',
    'observer'
);


ALTER TYPE "public"."group_member_role" OWNER TO "postgres";


CREATE TYPE "public"."group_member_status" AS ENUM (
    'pending',
    'active',
    'left',
    'removed',
    'rejected'
);


ALTER TYPE "public"."group_member_status" OWNER TO "postgres";


CREATE TYPE "public"."group_poll_status" AS ENUM (
    'open',
    'closed'
);


ALTER TYPE "public"."group_poll_status" OWNER TO "postgres";


CREATE TYPE "public"."group_task_status" AS ENUM (
    'todo',
    'in_progress',
    'done'
);


ALTER TYPE "public"."group_task_status" OWNER TO "postgres";


CREATE TYPE "public"."group_visibility" AS ENUM (
    'public',
    'private',
    'invite_only'
);


ALTER TYPE "public"."group_visibility" OWNER TO "postgres";


CREATE TYPE "public"."listing_type" AS ENUM (
    'neuf',
    'kit',
    'occasion',
    'enchere',
    'location'
);


ALTER TYPE "public"."listing_type" OWNER TO "postgres";


CREATE TYPE "public"."moderation_status" AS ENUM (
    'en_attente',
    'approuve',
    'rejete',
    'signale'
);


ALTER TYPE "public"."moderation_status" OWNER TO "postgres";


CREATE TYPE "public"."occasion_etat" AS ENUM (
    'comme_neuf',
    'bon_etat',
    'etat_correct'
);


ALTER TYPE "public"."occasion_etat" OWNER TO "postgres";


CREATE TYPE "public"."occasion_statut" AS ENUM (
    'en_attente_moderation',
    'active',
    'vendue',
    'retiree',
    'litige'
);


ALTER TYPE "public"."occasion_statut" OWNER TO "postgres";


CREATE TYPE "public"."shop_transaction_type" AS ENUM (
    'achat',
    'location',
    'occasion',
    'enchere'
);


ALTER TYPE "public"."shop_transaction_type" OWNER TO "postgres";


CREATE TYPE "public"."stock_statut_type" AS ENUM (
    'en_stock',
    'rupture',
    'reappro'
);


ALTER TYPE "public"."stock_statut_type" OWNER TO "postgres";


CREATE TYPE "public"."sync_status" AS ENUM (
    'success',
    'failed',
    'pending'
);


ALTER TYPE "public"."sync_status" OWNER TO "postgres";


CREATE TYPE "public"."trip_activity_type" AS ENUM (
    'hiking',
    'trekking',
    'bivouac',
    'roadtrip',
    'cultural',
    'bushcraft',
    'mixed'
);


ALTER TYPE "public"."trip_activity_type" OWNER TO "postgres";


CREATE TYPE "public"."trip_budget_currency" AS ENUM (
    'EUR',
    'USD',
    'GBP',
    'CHF',
    'CAD',
    'JPY'
);


ALTER TYPE "public"."trip_budget_currency" OWNER TO "postgres";


CREATE TYPE "public"."trip_collaborator_role" AS ENUM (
    'owner',
    'editor',
    'viewer'
);


ALTER TYPE "public"."trip_collaborator_role" OWNER TO "postgres";


CREATE TYPE "public"."trip_difficulty" AS ENUM (
    'easy',
    'moderate',
    'hard',
    'expert'
);


ALTER TYPE "public"."trip_difficulty" OWNER TO "postgres";


CREATE TYPE "public"."trip_document_category" AS ENUM (
    'passport',
    'insurance',
    'booking',
    'ticket',
    'medical',
    'other'
);


ALTER TYPE "public"."trip_document_category" OWNER TO "postgres";


CREATE TYPE "public"."trip_item_status" AS ENUM (
    'packed',
    'needed',
    'optional',
    'missing'
);


ALTER TYPE "public"."trip_item_status" OWNER TO "postgres";


CREATE TYPE "public"."trip_status" AS ENUM (
    'draft',
    'planned',
    'active',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."trip_status" OWNER TO "postgres";


CREATE TYPE "public"."trip_step_transport" AS ENUM (
    'foot',
    'car',
    'bus',
    'train',
    'plane',
    'boat',
    'bike',
    'other'
);


ALTER TYPE "public"."trip_step_transport" OWNER TO "postgres";


CREATE TYPE "public"."trip_visibility" AS ENUM (
    'private',
    'unlisted',
    'public'
);


ALTER TYPE "public"."trip_visibility" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_edit_trip"("p_trip_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_owner_id UUID;
  v_role public.trip_collaborator_role;
BEGIN
  IF p_trip_id IS NULL OR v_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT user_id INTO v_owner_id
  FROM public.trips
  WHERE id = p_trip_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_owner_id = v_user_id THEN
    RETURN true;
  END IF;

  SELECT role INTO v_role
  FROM public.trip_collaborators
  WHERE trip_id = p_trip_id AND user_id = v_user_id;

  IF FOUND AND v_role IN ('owner', 'editor') THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;


ALTER FUNCTION "public"."can_edit_trip"("p_trip_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_read_trip"("p_trip_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_visibility public.trip_visibility;
  v_owner_id UUID;
  v_is_collab BOOLEAN;
BEGIN
  IF p_trip_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT visibility, user_id INTO v_visibility, v_owner_id
  FROM public.trips
  WHERE id = p_trip_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Visible publiquement ou non répertorié
  IF v_visibility IN ('public', 'unlisted') THEN
    RETURN true;
  END IF;

  -- Utilisateur anonyme sur voyage privé
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Propriétaire direct
  IF v_owner_id = v_user_id THEN
    RETURN true;
  END IF;

  -- Collaborateur invité
  SELECT EXISTS (
    SELECT 1 FROM public.trip_collaborators
    WHERE trip_id = p_trip_id AND user_id = v_user_id
  ) INTO v_is_collab;

  RETURN v_is_collab;
END;
$$;


ALTER FUNCTION "public"."can_read_trip"("p_trip_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_user_bid"("user_uuid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = user_uuid AND trust_score >= 40
  );
$$;


ALTER FUNCTION "public"."can_user_bid"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_user_sell_auction"("user_uuid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = user_uuid AND trust_score >= 60
  );
$$;


ALTER FUNCTION "public"."can_user_sell_auction"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_and_increment_ai_quota"("p_user_id" "uuid", "p_tier" "text", "p_feature" "text" DEFAULT NULL::"text", "p_feature_limit" integer DEFAULT 0) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_row public.ai_usage_daily%ROWTYPE;
BEGIN
  IF p_tier NOT IN ('heavy', 'fast') THEN
    RETURN false;
  END IF;

  INSERT INTO public.ai_usage_daily (user_id, day, requests_heavy, requests_fast, requests_by_feature)
  VALUES (
    p_user_id,
    CURRENT_DATE,
    CASE WHEN p_tier = 'heavy' THEN 1 ELSE 0 END,
    CASE WHEN p_tier = 'fast' THEN 1 ELSE 0 END,
    CASE WHEN p_feature IS NOT NULL THEN jsonb_build_object(p_feature, 1) ELSE '{}'::jsonb END
  )
  ON CONFLICT (user_id, day) DO UPDATE SET
    requests_heavy = public.ai_usage_daily.requests_heavy
      + (CASE WHEN p_tier = 'heavy' THEN 1 ELSE 0 END),
    requests_fast = public.ai_usage_daily.requests_fast
      + (CASE WHEN p_tier = 'fast' THEN 1 ELSE 0 END),
    requests_by_feature = CASE WHEN p_feature IS NOT NULL
      THEN jsonb_set(
        COALESCE(public.ai_usage_daily.requests_by_feature, '{}'::jsonb),
        ARRAY[p_feature],
        COALESCE((public.ai_usage_daily.requests_by_feature ->> p_feature)::int, 0) + 1
      )
      ELSE COALESCE(public.ai_usage_daily.requests_by_feature, '{}'::jsonb)
    END
  WHERE (
    CASE WHEN p_tier = 'heavy'
      THEN public.ai_usage_daily.requests_heavy < 20
      ELSE public.ai_usage_daily.requests_fast < 100
    END
    AND (
      p_feature IS NULL
      OR p_feature_limit <= 0
      OR COALESCE((public.ai_usage_daily.requests_by_feature ->> p_feature)::int, 0) < p_feature_limit
    )
  )
  RETURNING * INTO v_row;

  RETURN v_row.user_id IS NOT NULL;
END;
$$;


ALTER FUNCTION "public"."check_and_increment_ai_quota"("p_user_id" "uuid", "p_tier" "text", "p_feature" "text", "p_feature_limit" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ai_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "feature" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "result" "jsonb",
    "attempts" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    CONSTRAINT "ai_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'done'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."ai_jobs" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_pending_ai_jobs"("p_limit" integer DEFAULT 10) RETURNS SETOF "public"."ai_jobs"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  UPDATE public.ai_jobs
  SET status = 'processing'
  WHERE id IN (
    SELECT id FROM public.ai_jobs
    WHERE status = 'pending'
      AND attempts < 5
    ORDER BY created_at
    LIMIT greatest(p_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;


ALTER FUNCTION "public"."claim_pending_ai_jobs"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_reward_points"("p_user_id" "uuid", "p_action_type" "text", "p_target_id" "uuid", "p_target_type" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_rewards_active BOOLEAN;
  v_account_status TEXT;
  v_trust_score INTEGER;
  v_target_author_id UUID;
  v_base_points INTEGER;
  v_daily_limit INTEGER;
  v_weekly_limit INTEGER;
  v_daily_count INTEGER;
  v_weekly_count INTEGER;
  v_points_earned_today INTEGER;
  v_user_level INTEGER;
  v_level_cap INTEGER;
  v_quality_score NUMERIC(3,2) := 1.00;
  v_content TEXT;
  v_spam_words JSONB;
  v_final_points INTEGER;
  v_status TEXT := 'pending';
  v_contribution_id UUID;
  v_transaction_type TEXT;
BEGIN
  -- 1. Check Kill Switch
  SELECT (value->>'rewards_active')::boolean INTO v_rewards_active FROM public.reward_config WHERE key = 'kill_switches';
  IF NOT COALESCE(v_rewards_active, true) THEN
    RAISE EXCEPTION 'Les récompenses sont temporairement désactivées';
  END IF;

  -- 2. Check Account Status & Profile Trust
  SELECT status INTO v_account_status FROM public.reward_accounts WHERE user_id = p_user_id;
  SELECT trust_score INTO v_trust_score FROM public.user_profiles WHERE id = p_user_id;
  
  IF v_account_status = 'suspended' THEN
    RAISE EXCEPTION 'Ce compte est suspendu de toute récompense';
  END IF;

  -- 3. Check Self-Action
  IF p_action_type = 'like' THEN
    IF p_target_type = 'post' THEN
      SELECT author_id INTO v_target_author_id FROM public.community_posts WHERE id = p_target_id;
    ELSIF p_target_type = 'carnet' THEN
      SELECT author_id INTO v_target_author_id FROM public.carnets WHERE id = p_target_id;
    ELSIF p_target_type = 'comment' THEN
      SELECT author_id INTO v_target_author_id FROM public.post_comments WHERE id = p_target_id;
    ELSIF p_target_type = 'club_topic' THEN
      SELECT author_id INTO v_target_author_id FROM public.club_topics WHERE id = p_target_id;
    END IF;

    IF v_target_author_id = p_user_id THEN
      RAISE EXCEPTION 'Auto-like non éligible aux récompenses';
    END IF;
  ELSIF p_action_type = 'comment' THEN
    IF p_target_type = 'post' THEN
      SELECT author_id INTO v_target_author_id FROM public.community_posts WHERE id = p_target_id;
    ELSIF p_target_type = 'carnet' THEN
      SELECT author_id INTO v_target_author_id FROM public.carnets WHERE id = p_target_id;
    END IF;

    IF v_target_author_id = p_user_id THEN
      RAISE EXCEPTION 'Commentaires sur vos propres contenus non éligibles aux récompenses';
    END IF;
  END IF;

  -- 4. Get Base Points
  SELECT (value->>p_action_type)::integer INTO v_base_points FROM public.reward_config WHERE key = 'action_base_points';
  IF v_base_points IS NULL OR v_base_points = 0 THEN
    RETURN NULL;
  END IF;

  -- 5. Check Action Limits
  SELECT (value->>(p_action_type || '_daily'))::integer, (value->>(p_action_type || '_weekly'))::integer
  INTO v_daily_limit, v_weekly_limit
  FROM public.reward_config WHERE key = 'action_limits';

  IF v_daily_limit IS NOT NULL THEN
    SELECT COUNT(*)::integer INTO v_daily_count FROM public.pending_contributions
    WHERE user_id = p_user_id AND action_type = p_action_type AND status <> 'rejected' AND created_at > now() - INTERVAL '1 day';

    IF v_daily_count >= v_daily_limit THEN
      RAISE EXCEPTION 'Limite quotidienne de gains pour cette action atteinte';
    END IF;
  END IF;

  IF v_weekly_limit IS NOT NULL THEN
    SELECT COUNT(*)::integer INTO v_weekly_count FROM public.pending_contributions
    WHERE user_id = p_user_id AND action_type = p_action_type AND status <> 'rejected' AND created_at > now() - INTERVAL '7 days';

    IF v_weekly_count >= v_weekly_limit THEN
      RAISE EXCEPTION 'Limite hebdomadaire de gains pour cette action atteinte';
    END IF;
  END IF;

  -- 6. Check Trust Level daily cap
  SELECT COALESCE(level, 1) INTO v_user_level FROM public.user_profiles WHERE id = p_user_id;
  SELECT (value->>(v_user_level::text))::integer INTO v_level_cap FROM public.reward_config WHERE key = 'trust_level_caps';

  IF v_level_cap IS NOT NULL AND v_level_cap <> -1 THEN
    SELECT COALESCE(SUM(final_points), 0)::integer INTO v_points_earned_today FROM public.pending_contributions
    WHERE user_id = p_user_id AND status <> 'rejected' AND created_at > now() - INTERVAL '1 day';

    IF (v_points_earned_today + v_base_points) > v_level_cap THEN
      RAISE EXCEPTION 'Limite quotidienne d''émission de points atteinte pour votre niveau';
    END IF;
  END IF;

  -- 7. Quality Scoring
  IF p_action_type IN ('comment', 'post') THEN
    v_content := p_metadata->>'content';
    IF v_content IS NOT NULL THEN
      IF length(trim(v_content)) < 10 THEN
        v_quality_score := v_quality_score * 0.50;
      END IF;

      -- Check spam words
      SELECT value INTO v_spam_words FROM public.reward_config WHERE key = 'spam_words';
      IF v_spam_words IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(v_spam_words) AS sw
          WHERE lower(v_content) LIKE '%' || lower(sw) || '%'
        ) THEN
          v_quality_score := v_quality_score * 0.20;
        END IF;
      END IF;
    END IF;
  END IF;

  v_final_points := ROUND(v_base_points * v_quality_score);
  IF v_final_points <= 0 THEN
    RAISE EXCEPTION 'Qualité ou pertinence insuffisante pour obtenir des points';
  END IF;

  -- 8. Auto-approve conditions
  IF v_account_status = 'limited' THEN
    v_status := 'pending';
  ELSIF COALESCE(v_trust_score, 50) >= 60 OR p_action_type IN ('like', 'group_message') THEN
    v_status := 'approved';
  ELSE
    v_status := 'pending';
  END IF;

  -- 9. Insert pending contribution
  INSERT INTO public.pending_contributions (
    user_id,
    action_type,
    target_id,
    target_type,
    base_points,
    quality_score,
    trust_score,
    final_points,
    status,
    metadata,
    validated_at
  ) VALUES (
    p_user_id,
    p_action_type,
    p_target_id,
    p_target_type,
    v_base_points,
    v_quality_score,
    COALESCE(v_trust_score, 50),
    v_final_points,
    v_status,
    p_metadata,
    CASE WHEN v_status = 'approved' THEN now() ELSE NULL END
  )
  RETURNING id INTO v_contribution_id;

  -- 10. If approved, immediately insert ledger transaction
  IF v_status = 'approved' THEN
    v_transaction_type := CASE 
      WHEN p_action_type = 'like' THEN 'LIKE_REWARD'::text
      WHEN p_action_type = 'comment' THEN 'COMMENT_REWARD'::text
      WHEN p_action_type = 'post' THEN 'POST_REWARD'::text
      WHEN p_action_type = 'carnet' THEN 'JOURNAL_REWARD'::text
      WHEN p_action_type = 'group_message' THEN 'GROUP_REWARD'::text
      WHEN p_action_type = 'referral' THEN 'REFERRAL_REWARD'::text
      ELSE 'ADMIN_ADJUSTMENT'::text
    END;

    INSERT INTO public.reward_transactions (
      user_id,
      points,
      transaction_type,
      reference_id,
      reference_type,
      metadata
    ) VALUES (
      p_user_id,
      v_final_points,
      v_transaction_type,
      v_contribution_id,
      p_target_type,
      jsonb_build_object('auto_approved', true)
    );
  END IF;

  RETURN v_contribution_id;
END;
$$;


ALTER FUNCTION "public"."claim_reward_points"("p_user_id" "uuid", "p_action_type" "text", "p_target_id" "uuid", "p_target_type" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_trash_kits"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM public.custom_kits
  WHERE status = 'trash'
    AND deleted_at IS NOT NULL
    AND deleted_at < (now() - INTERVAL '10 days');
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_trash_kits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_feature_flags"() RETURNS TABLE("id" "text", "enabled" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT id, enabled FROM public.feature_flags ORDER BY id;
$$;


ALTER FUNCTION "public"."current_feature_flags"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_stock_on_order"("p_product_id" "uuid", "p_quantity" integer, "p_order_id" "text", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_current_stock INTEGER;
  v_product_name TEXT;
  v_product_slug TEXT;
BEGIN
  SELECT stock, name, slug
    INTO v_current_stock, v_product_name, v_product_slug
    FROM public.shop_products
   WHERE id = p_product_id;

  IF v_current_stock IS NULL THEN
    RETURN;
  END IF;

  -- Update stock (floor at 0)
  UPDATE public.shop_products
     SET stock = GREATEST(0, stock - p_quantity),
         updated_at = CURRENT_TIMESTAMP
   WHERE id = p_product_id;

  -- Record movement
  INSERT INTO public.stock_movements (
    product_id, product_slug, product_name,
    movement_type, quantity_change,
    quantity_before, quantity_after,
    reference_type, reference_id, user_id, notes
  ) VALUES (
    p_product_id, v_product_slug, v_product_name,
    'sale', -p_quantity,
    v_current_stock, GREATEST(0, v_current_stock - p_quantity),
    'order', p_order_id, p_user_id,
    'Vente via commande'
  );
END;
$$;


ALTER FUNCTION "public"."decrement_stock_on_order"("p_product_id" "uuid", "p_quantity" integer, "p_order_id" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_places_batch"("p_ids" "uuid"[]) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_deleted bigint;
begin
  delete from public.places_geo where id = any(p_ids);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;


ALTER FUNCTION "public"."delete_places_batch"("p_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_member_role_hierarchy"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_caller_id UUID := auth.uid();
BEGIN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id THEN
        RAISE EXCEPTION 'Impossible de modifier le membre ou la conversation d une ligne existante';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role THEN
        IF (NEW.role = 'owner' OR OLD.role = 'owner') AND NOT public.is_conv_owner(OLD.conversation_id, v_caller_id) THEN
            RAISE EXCEPTION 'Seul le propriétaire de la conversation peut gérer le rôle owner';
        END IF;

        IF NEW.role = 'admin' AND NOT public.is_conv_admin(OLD.conversation_id, v_caller_id) THEN
            RAISE EXCEPTION 'Seul un administrateur peut promouvoir un membre en admin';
        END IF;

        IF NOT public.is_conv_admin(OLD.conversation_id, v_caller_id) THEN
            RAISE EXCEPTION 'Les membres ne peuvent pas modifier les rôles de la conversation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_member_role_hierarchy"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_reward_period"("p_period_id" "text", "p_eligible_revenue" numeric) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_period RECORD;
  v_pool_pct NUMERIC(12,2);
  v_monthly_cap NUMERIC(12,2);
  v_security_reserve NUMERIC(12,2);
  v_pool_size NUMERIC(12,2);
  v_total_points INTEGER;
  v_point_weight NUMERIC(20,8);
  v_user RECORD;
  v_user_payout NUMERIC(12,2);
  v_distributed_sum NUMERIC(12,2) := 0.00;
  v_remaining_residual NUMERIC(12,2) := 0.00;
BEGIN
  -- Verify admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès interdit';
  END IF;

  SELECT * INTO v_period FROM public.reward_periods WHERE id = p_period_id;
  IF v_period IS NULL THEN
    RAISE EXCEPTION 'Période introuvable';
  END IF;

  IF v_period.status <> 'OPEN' THEN
    RAISE EXCEPTION 'Cette période ne peut pas être finalisée (statut actuel: %)', v_period.status;
  END IF;

  -- Update to CALCULATING
  UPDATE public.reward_periods
  SET status = 'CALCULATING',
      eligible_revenue = p_eligible_revenue,
      updated_at = now()
  WHERE id = p_period_id;

  -- 1. Read Pool Config
  SELECT value::numeric(12,2) INTO v_pool_pct FROM public.reward_config WHERE key = 'pool_percentage';
  SELECT value::numeric(12,2) INTO v_monthly_cap FROM public.reward_config WHERE key = 'monthly_pool_cap';
  SELECT value::numeric(12,2) INTO v_security_reserve FROM public.reward_config WHERE key = 'security_reserve';

  -- Calculate Pool size
  v_pool_size := LEAST(v_monthly_cap, p_eligible_revenue * v_pool_pct) - v_security_reserve;
  IF v_pool_size < 0 THEN
    v_pool_size := 0.00;
  END IF;

  -- 2. Sum eligible points across all active reward accounts
  SELECT COALESCE(SUM(eligible_points), 0) INTO v_total_points FROM public.reward_accounts WHERE status <> 'suspended';

  IF v_total_points > 0 THEN
    v_point_weight := v_pool_size / v_total_points;
  ELSE
    v_point_weight := 0.00000000;
  END IF;

  -- Update period details
  UPDATE public.reward_periods
  SET status = 'DISTRIBUTING',
      reward_pool = v_pool_size,
      total_valid_points = v_total_points,
      point_weight = v_point_weight,
      updated_at = now()
  WHERE id = p_period_id;

  -- 3. Distribute cash to users and reset period points
  FOR v_user IN 
    SELECT user_id, eligible_points FROM public.reward_accounts WHERE eligible_points > 0 AND status <> 'suspended'
  LOOP
    v_user_payout := ROUND(v_user.eligible_points * v_point_weight, 2);
    v_distributed_sum := v_distributed_sum + v_user_payout;

    -- Credit user account available cash
    UPDATE public.reward_accounts
    SET available_cash = available_cash + v_user_payout,
        eligible_points = 0,
        earned_this_period = 0,
        updated_at = now()
    WHERE user_id = v_user.user_id;

    -- Write Redemption points transaction
    INSERT INTO public.reward_transactions (
      user_id,
      points,
      transaction_type,
      reference_id,
      reference_type,
      metadata
    ) VALUES (
      v_user.user_id,
      -v_user.eligible_points,
      'REDEMPTION',
      NULL,
      'period_conversion',
      jsonb_build_object('period_id', p_period_id, 'payout_eur', v_user_payout)
    );
  END LOOP;

  -- Calculate rounding residues
  v_remaining_residual := v_pool_size - v_distributed_sum;

  -- Close the period
  UPDATE public.reward_periods
  SET status = 'CLOSED',
      distributed_amount = v_distributed_sum,
      remaining_amount = v_remaining_residual,
      updated_at = now()
  WHERE id = p_period_id;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."finalize_reward_period"("p_period_id" "text", "p_eligible_revenue" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."freeze_trip_owner"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'trips.user_id est immuable (transfert de propriété interdit via RLS)';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."freeze_trip_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_trip_slug"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  base_slug text;
  random_suffix text;
BEGIN
  IF NEW.slug IS NULL OR trim(NEW.slug) = '' THEN
    base_slug := lower(regexp_replace(coalesce(NEW.title, 'voyage'), '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    IF base_slug = '' THEN
      base_slug := 'voyage';
    END IF;
    IF length(base_slug) > 100 THEN
      base_slug := substring(base_slug from 1 for 100);
      base_slug := trim(both '-' from base_slug);
    END IF;
    random_suffix := lower(substring(md5(random()::text) from 1 for 6));
    NEW.slug := base_slug || '-' || random_suffix;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_trip_slug"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
SELECT ar.role::TEXT FROM public.admin_roles ar WHERE ar.user_id = auth.uid() LIMIT 1
$$;


ALTER FUNCTION "public"."get_admin_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_ai_cache"("p_cache_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_response jsonb;
BEGIN
  SELECT response INTO v_response
  FROM public.ai_response_cache
  WHERE cache_key = p_cache_key
    AND expires_at > now();

  IF v_response IS NOT NULL THEN
    UPDATE public.ai_response_cache
    SET hit_count = hit_count + 1
    WHERE cache_key = p_cache_key;
  END IF;

  RETURN v_response;
END;
$$;


ALTER FUNCTION "public"."get_ai_cache"("p_cache_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_comparable_sales"("p_produit_id" "uuid", "p_limit" integer DEFAULT 5) RETURNS TABLE("montant_cents" integer, "closed_at" timestamp with time zone, "nombre_encherisseurs" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT
    enchere_actuelle_cents AS montant_cents,
    date_fin_enchere AS closed_at,
    nombre_encherisseurs
  FROM public.listings
  WHERE
    produit_id::text = p_produit_id::text
    AND listing_type::text = 'enchere'
    AND statut = 'cloture'
    AND enchere_actuelle_cents > 0
  ORDER BY date_fin_enchere DESC
  LIMIT p_limit;
$$;


ALTER FUNCTION "public"."get_comparable_sales"("p_produit_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_hiking_routes_geojson"() RETURNS TABLE("id" bigint, "name" "text", "distance_km" numeric, "network" "text", "geojson" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    hr.id,
    hr.name,
    hr.distance_km,
    hr.network,
    ST_AsGeoJSON(hr.geom)::jsonb as geojson
  FROM public.hiking_routes hr
  WHERE hr.geom IS NOT NULL;
END;
$$;


ALTER FUNCTION "public"."get_hiking_routes_geojson"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_kit_journal"("p_kit_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_kit  public.materiel_kits%ROWTYPE;
  v_out  jsonb;
BEGIN
  SELECT * INTO v_kit FROM public.materiel_kits WHERE id = p_kit_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'kit_id',    v_kit.id,
    'birth',     jsonb_build_object(
                   'origin',      v_kit.origin,
                   'created_at',  v_kit.created_at,
                   'generation',  v_kit.generation
                 ),
    'lineage',   jsonb_build_object(
                   'fork_count',     (SELECT count(*) FROM public.materiel_kits
                                      WHERE lineage_root_id = v_kit.lineage_root_id
                                        AND id <> v_kit.id),
                   'max_generation', (SELECT max(generation) FROM public.materiel_kits
                                      WHERE lineage_root_id = v_kit.lineage_root_id)
                 ),
    'field',     jsonb_build_object(
                   'session_count',
                     (SELECT count(*) FROM public.hike_sessions WHERE kit_id = v_kit.id),
                   'total_km',
                     round(COALESCE((SELECT sum(distance_km) FROM public.hike_sessions
                                     WHERE kit_id = v_kit.id), 0)::numeric, 1),
                   'total_elevation_gain_m',
                     (SELECT COALESCE(sum(elevation_gain_m), 0) FROM public.hike_sessions
                      WHERE kit_id = v_kit.id),
                   'seasons', (SELECT jsonb_object_agg(s, c) FROM (
                                  SELECT CASE
                                           WHEN EXTRACT(MONTH FROM started_at) IN (12,1,2) THEN 'hiver'
                                           WHEN EXTRACT(MONTH FROM started_at) IN (3,4,5) THEN 'printemps'
                                           WHEN EXTRACT(MONTH FROM started_at) IN (6,7,8) THEN 'ete'
                                           ELSE 'automne'
                                         END AS s,
                                         count(*) AS c
                                  FROM public.hike_sessions
                                  WHERE kit_id = v_kit.id
                                  GROUP BY s) seasons),
                   'regions', (SELECT jsonb_agg(row) FROM (
                                  SELECT r.region, count(*) AS sessions
                                  FROM public.hike_sessions s
                                  JOIN public.hiking_routes r ON r.id = s.route_id
                                  WHERE s.kit_id = v_kit.id AND r.region IS NOT NULL
                                  GROUP BY r.region
                                  ORDER BY count(*) DESC) row)
                 ),
    'ecosystem', jsonb_build_object(
                   'public_carnet_count',
                     (SELECT count(*) FROM public.carnets
                      WHERE author_id = v_kit.user_id AND visibility = 'public'),
                   'public_carnet_moment_count',
                     (SELECT count(*) FROM public.carnet_moments cm
                      JOIN public.carnets c ON c.id = cm.carnet_id
                      WHERE c.author_id = v_kit.user_id AND c.visibility = 'public')
                 )
  ) INTO v_out;

  RETURN v_out;
END;
$$;


ALTER FUNCTION "public"."get_kit_journal"("p_kit_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_nearby_named_pois"("p_lat" double precision, "p_lon" double precision, "p_radius_m" integer DEFAULT 15000) RETURNS TABLE("id" bigint, "name" "text", "category" "text", "distance_m" numeric, "bearing_deg" numeric, "elevation_m" "text")
    LANGUAGE "sql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    tp.id,
    tp.name,
    tp.category,
    ST_Distance(tp.geom::geography, p.pt::geography) AS distance_m,
    degrees(ST_Azimuth(p.pt, tp.geom)) AS bearing_deg,
    tp.tags->>'ele' AS elevation_m
  FROM public.trail_pois tp,
       LATERAL (SELECT ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326) AS pt) p
  WHERE tp.name IS NOT NULL
    AND tp.category IN ('peak', 'viewpoint', 'waterfall', 'shelter', 'refuge')
    AND ST_DWithin(tp.geom::geography, p.pt::geography, p_radius_m)
  ORDER BY ST_Distance(tp.geom::geography, p.pt::geography)
  LIMIT 20;
$$;


ALTER FUNCTION "public"."get_nearby_named_pois"("p_lat" double precision, "p_lon" double precision, "p_radius_m" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_occasion_listing_for_product"("p_produit_id" "uuid") RETURNS TABLE("listing_slug" "text", "listing_prix_cents" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT
    'occasion-' || l.id::TEXT AS listing_slug,
    l.prix_cents AS listing_prix_cents
  FROM public.listings l
  WHERE l.produit_id::text = p_produit_id::text
    AND l.listing_type::text = 'occasion'
    AND l.statut = 'actif'
  ORDER BY l.prix_cents ASC
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_occasion_listing_for_product"("p_produit_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_direct_conversation"("p_target_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_pair_key TEXT;
    v_conv_id UUID;
    v_lock_key BIGINT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentification requise pour démarrer une conversation';
    END IF;

    IF v_caller_id = p_target_user_id THEN
        RAISE EXCEPTION 'Impossible de créer une conversation directe avec vous-même';
    END IF;

    v_pair_key := LEAST(v_caller_id::text, p_target_user_id::text) || ':' || GREATEST(v_caller_id::text, p_target_user_id::text);
    v_lock_key := hashtext(v_pair_key);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    SELECT id INTO v_conv_id
    FROM public.conversations
    WHERE type = 'direct' AND direct_pair_key = v_pair_key
    LIMIT 1;

    IF v_conv_id IS NOT NULL THEN
        RETURN v_conv_id;
    END IF;

    INSERT INTO public.conversations (type, created_by, direct_pair_key)
    VALUES ('direct', v_caller_id, v_pair_key)
    RETURNING id INTO v_conv_id;

    INSERT INTO public.conversation_members (conversation_id, user_id, role)
    VALUES 
        (v_conv_id, v_caller_id, 'owner'),
        (v_conv_id, p_target_user_id, 'member');

    RETURN v_conv_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_direct_conversation"("p_target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_route_deviation"("p_route_id" bigint, "p_lat" double precision, "p_lon" double precision) RETURNS TABLE("distance_m" numeric, "closest_lat" double precision, "closest_lon" double precision, "bearing_deg" numeric)
    LANGUAGE "sql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    ST_Distance(h.geom::geography, p.pt::geography) AS distance_m,
    ST_Y(ST_ClosestPoint(h.geom, p.pt)) AS closest_lat,
    ST_X(ST_ClosestPoint(h.geom, p.pt)) AS closest_lon,
    degrees(ST_Azimuth(p.pt, ST_ClosestPoint(h.geom, p.pt))) AS bearing_deg
  FROM public.hiking_routes h,
       LATERAL (SELECT ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326) AS pt) p
  WHERE h.id = p_route_id;
$$;


ALTER FUNCTION "public"."get_route_deviation"("p_route_id" bigint, "p_lat" double precision, "p_lon" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_route_geojson"("p_route_id" bigint) RETURNS "jsonb"
    LANGUAGE "sql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT ST_AsGeoJSON(geom)::jsonb
  FROM public.hiking_routes
  WHERE id = p_route_id;
$$;


ALTER FUNCTION "public"."get_route_geojson"("p_route_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_route_offline_bbox"("p_route_id" bigint, "p_margin_m" double precision DEFAULT 500) RETURNS TABLE("min_lat" double precision, "min_lng" double precision, "max_lat" double precision, "max_lng" double precision)
    LANGUAGE "sql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    ST_YMin(e) AS min_lat,
    ST_XMin(e) AS min_lng,
    ST_YMax(e) AS max_lat,
    ST_XMax(e) AS max_lng
  FROM (
    SELECT ST_Envelope(ST_Buffer(geom::geography, p_margin_m)::geometry) AS e
    FROM public.hiking_routes
    WHERE id = p_route_id
  ) b;
$$;


ALTER FUNCTION "public"."get_route_offline_bbox"("p_route_id" bigint, "p_margin_m" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_route_pois"("p_route_id" bigint, "p_radius_m" double precision DEFAULT 2000) RETURNS TABLE("id" bigint, "name" "text", "category" "text", "distance_m" double precision, "elevation_m" "text")
    LANGUAGE "sql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    tp.id,
    tp.name,
    tp.category,
    ST_Distance(tp.geom::geography, r.geom::geography) AS distance_m,
    tp.tags->>'ele' AS elevation_m
  FROM public.trail_pois tp
  JOIN public.hiking_routes r ON r.id = p_route_id
  WHERE tp.name IS NOT NULL
    AND ST_DWithin(tp.geom::geography, r.geom::geography, p_radius_m)
  ORDER BY distance_m
  LIMIT 50;
$$;


ALTER FUNCTION "public"."get_route_pois"("p_route_id" bigint, "p_radius_m" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_routes_for_map"("min_lng" double precision, "min_lat" double precision, "max_lng" double precision, "max_lat" double precision, "simplify_tolerance" double precision DEFAULT 0.0005) RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(
      jsonb_build_object(
        'type', 'Feature',
        'geometry', st_asgeojson(st_simplify(geom, simplify_tolerance))::jsonb,
        'properties', jsonb_build_object('id', id, 'name', name, 'ref', ref, 'network', network)
      )
    ), '[]'::jsonb)
  )
  from public.hiking_routes
  where geom && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326);
$$;


ALTER FUNCTION "public"."get_routes_for_map"("min_lng" double precision, "min_lat" double precision, "max_lng" double precision, "max_lat" double precision, "simplify_tolerance" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_trail_pois_bbox"("min_lng" double precision, "min_lat" double precision, "max_lng" double precision, "max_lat" double precision, "p_limit" integer DEFAULT 100) RETURNS TABLE("id" bigint, "name" "text", "category" "text", "description" "text", "tags" "jsonb", "lat" double precision, "lng" double precision)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT 
    tp.id,
    tp.name,
    tp.category,
    tp.description,
    tp.tags,
    ST_Y(tp.geom) as lat,
    ST_X(tp.geom) as lng
  FROM public.trail_pois tp
  WHERE tp.geom && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  LIMIT p_limit;
$$;


ALTER FUNCTION "public"."get_trail_pois_bbox"("min_lng" double precision, "min_lat" double precision, "max_lng" double precision, "max_lat" double precision, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_trail_pois_geojson"() RETURNS TABLE("id" "uuid", "name" "text", "type" "text", "geojson" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Assumant que trail_pois a ces colonnes. Si elles n'existent pas on gérera l'erreur.
  -- Dans le doute, on le garde simple.
  RETURN QUERY
  SELECT 
    tp.id,
    tp.name,
    tp.type,
    ST_AsGeoJSON(tp.geom)::jsonb as geojson
  FROM public.trail_pois tp
  WHERE tp.geom IS NOT NULL;
END;
$$;


ALTER FUNCTION "public"."get_trail_pois_geojson"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_badges_progress"("p_user_id" "uuid") RETURNS SETOF "public"."badge_progress_result"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_user_badges_progress"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_hiking_stats"("p_user_id" "uuid") RETURNS TABLE("total_sessions" integer, "total_distance_km" numeric, "avg_distance_km" numeric, "avg_pace_min_per_km" numeric, "avg_elevation_gain_m" numeric, "favorite_difficulty" "text", "most_active_weekday" "text")
    LANGUAGE "sql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    COUNT(*)::integer,
    COALESCE(SUM(hs.distance_km), 0),
    COALESCE(AVG(hs.distance_km), 0),
    COALESCE(AVG(hs.duration_seconds / 60.0 / NULLIF(hs.distance_km, 0)), 0),
    COALESCE(AVG(hs.elevation_gain_m), 0),
    MODE() WITHIN GROUP (ORDER BY hr.network),
    MODE() WITHIN GROUP (ORDER BY to_char(hs.started_at, 'Day'))
  FROM public.hike_sessions hs
  LEFT JOIN public.hiking_routes hr ON hr.id = hs.route_id
  WHERE hs.user_id = p_user_id;
$$;


ALTER FUNCTION "public"."get_user_hiking_stats"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_signature"("p_target" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_self      boolean := (auth.uid() IS NOT NULL AND auth.uid() = p_target);
  v_visib     text;
  v_row       jsonb;
BEGIN
  -- Cible inconnue → objet vide (aucun indice d'existence).
  SELECT p.signature_visibility INTO v_visib
  FROM public.user_profiles p WHERE p.id = p_target;
  IF v_visib IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  -- Consentement (ADR-010, C.2) : défaut 'private'.
  --   private     → soi-même uniquement
  --   communaute  → soi-même + membres connectés (autrui authentifié)
  --   public      → n'importe qui
  IF v_visib = 'private' AND NOT v_self THEN
    RETURN '{}'::jsonb;
  END IF;
  IF v_visib = 'communaute' AND NOT v_self AND auth.uid() IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT to_jsonb(s)
  FROM (SELECT * FROM public.user_field_signature WHERE user_id = p_target) s
  INTO v_row;

  -- Plancher : la matview n'expose pas les sous-seuils (voir hasFieldSignature
  -- côté applicatif), mais on ne renvoie jamais une ligne faite uniquement de 0.
  RETURN coalesce(v_row, '{}'::jsonb);
END;
$$;


ALTER FUNCTION "public"."get_user_signature"("p_target" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_field_proven_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_old_kit uuid := NULL;
  v_new_kit uuid := NULL;
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') THEN
    IF TG_OP = 'UPDATE' THEN
      v_old_kit := OLD.kit_id;
    END IF;
    v_new_kit := NEW.kit_id;
  ELSE
    v_old_kit := OLD.kit_id;
  END IF;

  IF v_old_kit IS NOT NULL AND OLD.distance_km >= 1 THEN
    UPDATE public.materiel_kits
    SET field_proven_count = GREATEST(0, field_proven_count - 1)
    WHERE id = v_old_kit;
  END IF;

  IF v_new_kit IS NOT NULL AND NEW.distance_km >= 1 THEN
    UPDATE public.materiel_kits
    SET field_proven_count = field_proven_count + 1
    WHERE id = v_new_kit;
  END IF;

  RETURN NULL; -- AFTER trigger
END;
$$;


ALTER FUNCTION "public"."handle_field_proven_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_kit_lineage"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_parent public.materiel_kits%ROWTYPE;
BEGIN
  IF NEW.forked_from IS NULL THEN
    IF TG_OP = 'UPDATE' AND OLD.forked_from IS NOT NULL THEN
      -- Suppression de parent (ON DELETE SET NULL) : on conserve la lignée
      -- historique, on ne ré-encrre pas. ancestors garde l'uuid disparu.
      NEW.lineage_root_id := OLD.lineage_root_id;
      NEW.generation      := OLD.generation;
      NEW.ancestors       := OLD.ancestors;
    ELSE
      -- Racine : la lignée commence ici.
      NEW.lineage_root_id := NEW.id;
      NEW.generation      := 0;
      NEW.ancestors       := '{}'::uuid[];
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.forked_from = NEW.id THEN
    RAISE EXCEPTION 'Un kit ne peut pas être son propre parent (forked_from = id)';
  END IF;

  SELECT * INTO v_parent FROM public.materiel_kits WHERE id = NEW.forked_from;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kit parent introuvable (forked_from = %)', NEW.forked_from;
  END IF;

  NEW.lineage_root_id := v_parent.lineage_root_id;
  NEW.generation      := v_parent.generation + 1;
  NEW.ancestors       := v_parent.ancestors || v_parent.id;

  IF NEW.generation > 50 THEN
    RAISE EXCEPTION 'Profondeur de lignée maximale (50) dépassée';
  END IF;

  IF NEW.id = ANY(NEW.ancestors) OR NEW.forked_from = ANY(NEW.ancestors) THEN
    RAISE EXCEPTION 'Cycle de lignée détecté';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_kit_lineage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    email,
    full_name,
    avatar_url,
    trust_score,
    loyalty_points,
    loyalty_level,
    bio,
    location,
    xp,
    level
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    50,
    0,
    'Explorateur',
    '',
    '',
    0,
    1
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = CASE WHEN public.user_profiles.full_name = '' THEN EXCLUDED.full_name ELSE public.user_profiles.full_name END,
    updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_reward_account"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.reward_accounts (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_reward_account"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_trip_owner_collaborator"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.trip_collaborators (trip_id, user_id, role, joined_at)
  VALUES (NEW.id, NEW.user_id, 'owner', now())
  ON CONFLICT (trip_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_trip_owner_collaborator"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_stock"("p_product_id" "uuid", "p_quantity" integer, "p_reference_type" "text", "p_reference_id" "text", "p_user_id" "uuid", "p_notes" "text" DEFAULT 'Réapprovisionnement'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_current_stock INTEGER;
  v_product_name TEXT;
  v_product_slug TEXT;
BEGIN
  SELECT stock, name, slug
    INTO v_current_stock, v_product_name, v_product_slug
    FROM public.shop_products
   WHERE id = p_product_id;

  IF v_current_stock IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.shop_products
     SET stock = stock + p_quantity,
         updated_at = CURRENT_TIMESTAMP
   WHERE id = p_product_id;

  INSERT INTO public.stock_movements (
    product_id, product_slug, product_name,
    movement_type, quantity_change,
    quantity_before, quantity_after,
    reference_type, reference_id, user_id, notes
  ) VALUES (
    p_product_id, v_product_slug, v_product_name,
    p_reference_type, p_quantity,
    v_current_stock, v_current_stock + p_quantity,
    p_reference_type, p_reference_id, p_user_id,
    p_notes
  );
END;
$$;


ALTER FUNCTION "public"."increment_stock"("p_product_id" "uuid", "p_quantity" integer, "p_reference_type" "text", "p_reference_id" "text", "p_user_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_conv_admin"("target_conversation_id" "uuid", "target_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id = target_conversation_id
      AND cm.user_id = target_user_id
      AND cm.role IN ('admin','owner')
  );
$$;


ALTER FUNCTION "public"."is_conv_admin"("target_conversation_id" "uuid", "target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_conv_owner"("target_conversation_id" "uuid", "target_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id = target_conversation_id
      AND cm.user_id = target_user_id
      AND cm.role = 'owner'
  );
$$;


ALTER FUNCTION "public"."is_conv_owner"("target_conversation_id" "uuid", "target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_conversation_member"("target_conversation_id" "uuid", "target_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id = target_conversation_id
      AND cm.user_id = target_user_id
  );
$$;


ALTER FUNCTION "public"."is_conversation_member"("target_conversation_id" "uuid", "target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_group_member"("p_group_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id
      AND user_id = p_user_id
      AND status = 'active'
  )
$$;


ALTER FUNCTION "public"."is_group_member"("p_group_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_group_organizer"("p_group_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id
      AND user_id = p_user_id
      AND status = 'active'
      AND role IN ('organizer', 'co_organizer')
  )
$$;


ALTER FUNCTION "public"."is_group_organizer"("p_group_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_group_public"("p_group_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.travel_groups 
    WHERE id = p_group_id AND visibility = 'public'::group_visibility
  );
$$;


ALTER FUNCTION "public"."is_group_public"("p_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_moderateur"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
SELECT EXISTS (
    SELECT 1 FROM public.admin_roles ar
    WHERE ar.user_id = auth.uid()
)
$$;


ALTER FUNCTION "public"."is_moderateur"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lkv_can"("p_user_id" "uuid", "p_resource" "text", "p_resource_id" "uuid", "p_action" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_role TEXT;
  v_status TEXT;
  v_visibility TEXT;
  v_owner_id UUID;
  v_crew_id UUID;
BEGIN
  -- A. Accès anonyme (p_user_id NULL)
  IF p_user_id IS NULL THEN
    IF p_action <> 'select' THEN
      RETURN FALSE;
    END IF;

    IF p_resource = 'crews' THEN
      SELECT visibility INTO v_visibility FROM public.crews WHERE id = p_resource_id;
      RETURN v_visibility = 'public';
    ELSIF p_resource = 'trips' THEN
      SELECT visibility INTO v_visibility FROM public.trips WHERE id = p_resource_id;
      RETURN v_visibility = 'public';
    ELSE
      RETURN FALSE;
    END IF;
  END IF;

  -- B. Ressource : CREWS
  IF p_resource = 'crews' THEN
    -- Récupération métadonnées équipage
    SELECT created_by, visibility INTO v_owner_id, v_visibility
    FROM public.crews WHERE id = p_resource_id;

    IF NOT FOUND THEN
      -- Si insertion d'un nouvel équipage
      IF p_action = 'insert' THEN
        RETURN TRUE;
      END IF;
      RETURN FALSE;
    END IF;

    -- Créateur / Propriétaire direct
    IF v_owner_id = p_user_id THEN
      RETURN TRUE;
    END IF;

    -- Rôle dans l'équipage
    SELECT role, status INTO v_role, v_status
    FROM public.crew_members
    WHERE crew_id = p_resource_id AND user_id = p_user_id;

    -- Statuts inactifs
    IF v_status IN ('left', 'removed') THEN
      RETURN (p_action = 'select' AND v_visibility = 'public');
    END IF;

    -- Droits par action
    IF p_action = 'select' THEN
      RETURN (v_status = 'active' OR v_visibility IN ('public', 'link'));
    ELSIF p_action = 'update' THEN
      RETURN (v_status = 'active' AND v_role IN ('owner', 'organizer'));
    ELSIF p_action = 'delete' THEN
      RETURN (v_status = 'active' AND v_role = 'owner');
    ELSE
      RETURN FALSE;
    END IF;

  -- C. Ressource : CREW_MEMBERS
  ELSIF p_resource = 'crew_members' THEN
    SELECT role, status INTO v_role, v_status
    FROM public.crew_members
    WHERE crew_id = p_resource_id AND user_id = p_user_id;

    IF p_action = 'select' THEN
      RETURN (v_status = 'active');
    ELSIF p_action = 'insert' THEN
      RETURN (v_status = 'active' AND v_role IN ('owner', 'organizer'));
    ELSIF p_action = 'update' THEN
      RETURN (v_status = 'active' AND v_role = 'owner');
    ELSIF p_action = 'delete' THEN
      -- Le propriétaire/organisateur peut retirer, ou l'utilisateur peut se retirer lui-même
      RETURN (v_status = 'active' AND (v_role IN ('owner', 'organizer') OR p_user_id IS NOT NULL));
    ELSE
      RETURN FALSE;
    END IF;

  -- D. Ressource : TRIPS
  ELSIF p_resource = 'trips' THEN
    SELECT user_id, crew_id, visibility INTO v_owner_id, v_crew_id, v_visibility
    FROM public.trips WHERE id = p_resource_id;

    IF NOT FOUND THEN
      IF p_action = 'insert' THEN
        RETURN TRUE;
      END IF;
      RETURN FALSE;
    END IF;

    -- Propriétaire du voyage
    IF v_owner_id = p_user_id THEN
      RETURN TRUE;
    END IF;

    -- Participation directe au voyage
    SELECT role, status INTO v_role, v_status
    FROM public.trip_participants
    WHERE trip_id = p_resource_id AND user_id = p_user_id;

    IF v_status = 'confirmed' THEN
      IF p_action = 'select' THEN
        RETURN TRUE;
      ELSIF p_action = 'update' THEN
        RETURN v_role IN ('owner', 'organizer');
      ELSIF p_action = 'delete' THEN
        RETURN v_role = 'owner';
      END IF;
    END IF;

    -- Appartenance à l'équipage hôte
    IF v_crew_id IS NOT NULL THEN
      SELECT role, status INTO v_role, v_status
      FROM public.crew_members
      WHERE crew_id = v_crew_id AND user_id = p_user_id;

      IF v_status = 'active' THEN
        IF p_action = 'select' AND v_visibility <> 'private' THEN
          RETURN TRUE;
        ELSIF p_action = 'update' AND v_role IN ('owner', 'organizer') THEN
          RETURN TRUE;
        END IF;
      END IF;
    END IF;

    -- Règle de visibilité publique
    IF p_action = 'select' AND v_visibility = 'public' THEN
      RETURN TRUE;
    END IF;

    RETURN FALSE;

  -- E. Ressource : TRIP_PARTICIPANTS
  ELSIF p_resource = 'trip_participants' THEN
    SELECT user_id, crew_id INTO v_owner_id, v_crew_id
    FROM public.trips WHERE id = p_resource_id;

    IF v_owner_id = p_user_id THEN
      RETURN TRUE;
    END IF;

    SELECT role, status INTO v_role, v_status
    FROM public.trip_participants
    WHERE trip_id = p_resource_id AND user_id = p_user_id;

    IF p_action = 'select' THEN
      RETURN (v_status = 'confirmed');
    ELSIF p_action = 'insert' THEN
      RETURN (v_status = 'confirmed' AND v_role IN ('owner', 'organizer'));
    ELSIF p_action = 'update' THEN
      RETURN (v_status = 'confirmed' AND v_role IN ('owner', 'organizer'));
    ELSIF p_action = 'delete' THEN
      RETURN (v_status = 'confirmed' AND (v_role IN ('owner', 'organizer') OR p_user_id IS NOT NULL));
    ELSE
      RETURN FALSE;
    END IF;

  END IF;

  RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."lkv_can"("p_user_id" "uuid", "p_resource" "text", "p_resource_id" "uuid", "p_action" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lkv_ensure_auto_crew"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_crew_id UUID;
BEGIN
  -- Ne pas écraser un équipage déjà lié (choix explicite de l'utilisateur)
  IF NEW.crew_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.crews (
    name,
    slug,
    theme,
    visibility,
    max_members,
    created_by,
    auto_created
  )
  VALUES (
    CASE WHEN NEW.title IS NULL OR char_length(NEW.title) < 2
         THEN 'Mon équipage'
         ELSE NEW.title || ' — Équipage' END,
    public.lkv_slugify(COALESCE(NEW.title, 'equipage')) || '-' || substring(NEW.id::text, 1, 6),
    'Aventure',
    'private',
    12,
    NEW.user_id,
    true
  )
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO v_crew_id;

  IF v_crew_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Propriétaire = premier membre owner actif
  INSERT INTO public.crew_members (crew_id, user_id, role, status)
  VALUES (v_crew_id, NEW.user_id, 'owner', 'active')
  ON CONFLICT (crew_id, user_id) DO NOTHING;

  NEW.crew_id := v_crew_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."lkv_ensure_auto_crew"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lkv_seed_trip_checklist_template"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.trip_checklist_items (trip_id, label, due_offset_days, position) VALUES
    (NEW.id, 'Vérifier papiers d''identité / passeport', 30, 0),
    (NEW.id, 'Souscrire l''assurance voyage', 30, 1),
    (NEW.id, 'Réserver refuges / hébergements', 30, 2),
    (NEW.id, 'Tester et vérifier le matériel', 14, 3),
    (NEW.id, 'Préparer la trousse de secours', 7, 4),
    (NEW.id, 'Recharger batteries / powerbank', 7, 5),
    (NEW.id, 'Vérifier météo et itinéraire', 3, 6),
    (NEW.id, 'Charger eau et alimentation', 1, 7),
    (NEW.id, 'Départ — dernières vérifications', 1, 8);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."lkv_seed_trip_checklist_template"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lkv_slugify"("v_text" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $_$
DECLARE
  clean_text text;
BEGIN
  clean_text := lower(unaccent(trim(v_text)));
  clean_text := regexp_replace(clean_text, '[^a-z0-9]+', '-', 'g');
  clean_text := regexp_replace(clean_text, '^-+|-+$', '', 'g');
  IF char_length(clean_text) < 3 THEN
    clean_text := clean_text || '-crew';
  END IF;
  RETURN substring(clean_text, 1, 80);
END;
$_$;


ALTER FUNCTION "public"."lkv_slugify"("v_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_materiel_history"("p_user_id" "uuid", "p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_entity_name" "text" DEFAULT NULL::"text", "p_payload" "jsonb" DEFAULT NULL::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO public.materiel_history (user_id, action_type, entity_type, entity_id, entity_name, payload)
  VALUES (p_user_id, p_action, p_entity_type, p_entity_id, p_entity_name, p_payload);
END;
$$;


ALTER FUNCTION "public"."log_materiel_history"("p_user_id" "uuid", "p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_entity_name" "text", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."materiel_kits_search_vector_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.search_vector :=
    setweight(to_tsvector('french', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector('french', array_to_string(coalesce(new.tags, '{}'), ' ')), 'C');
  return new;
end;
$$;


ALTER FUNCTION "public"."materiel_kits_search_vector_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_actor_id" "uuid" DEFAULT NULL::"uuid", "p_related_type" "text" DEFAULT NULL::"text", "p_related_id" "uuid" DEFAULT NULL::"uuid", "p_link" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_in_app BOOLEAN := true;
  v_email BOOLEAN := true;
  v_push BOOLEAN := true;
  v_existing_id UUID;
  v_notif_id UUID;
  v_channels JSONB;
BEGIN
  -- 1. Check Preferences (Default is true if not configured)
  SELECT in_app_enabled, email_enabled, push_enabled
  INTO v_in_app, v_email, v_push
  FROM public.notification_preferences
  WHERE user_id = p_user_id AND notification_type = p_type;

  IF NOT FOUND THEN
    v_in_app := true;
    v_email := true;
    v_push := true;
  END IF;

  -- 2. Prevent unit-level email spams for low-priority notifications
  -- (They will be summarized and sent in bulk via the daily digest instead)
  IF p_type IN ('post_liked', 'carnet_liked', 'new_follower', 'points_earned') THEN
    v_email := false;
  END IF;

  -- 3. SOS Alert Bypass (Always send everywhere)
  IF p_type = 'sos_alert' THEN
    v_in_app := true;
    v_email := true;
    v_push := true;
  END IF;

  -- 4. Group messages clustering (Check unread within 15 minutes)
  IF p_type = 'group_message' THEN
    SELECT id INTO v_existing_id
    FROM public.notifications
    WHERE user_id = p_user_id
      AND type = 'group_message'
      AND related_id = p_related_id
      AND read = false
      AND created_at > (now() - INTERVAL '15 minutes')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      -- Group messages together: update existing message and bump timestamp
      UPDATE public.notifications
      SET message = p_message,
          actor_id = p_actor_id,
          created_at = now(),
          updated_at = now()
      WHERE id = v_existing_id;

      -- Queue new email/push alerts if active
      IF v_email THEN
        INSERT INTO public.notification_deliveries (notification_id, channel, status)
        VALUES (v_existing_id, 'email', 'pending');
      END IF;

      IF v_push THEN
        INSERT INTO public.notification_deliveries (notification_id, channel, status)
        VALUES (v_existing_id, 'push', 'pending');
      END IF;

      RETURN v_existing_id;
    END IF;
  END IF;

  -- 5. Build channels JSON array
  v_channels := '[]'::jsonb;
  IF v_in_app THEN v_channels := v_channels || '"in_app"'::jsonb; END IF;
  IF v_email THEN v_channels := v_channels || '"email"'::jsonb; END IF;
  IF v_push THEN v_channels := v_channels || '"push"'::jsonb; END IF;

  -- 6. Insert notification
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    read,
    actor_id,
    related_type,
    related_id,
    link,
    channels_sent,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    false,
    p_actor_id,
    p_related_type,
    p_related_id,
    p_link,
    v_channels,
    now(),
    now()
  )
  RETURNING id INTO v_notif_id;

  -- 7. Enqueue delivery jobs if enabled
  IF v_email THEN
    INSERT INTO public.notification_deliveries (notification_id, channel, status)
    VALUES (v_notif_id, 'email', 'pending');
  END IF;

  IF v_push THEN
    INSERT INTO public.notification_deliveries (notification_id, channel, status)
    VALUES (v_notif_id, 'push', 'pending');
  END IF;

  RETURN v_notif_id;
END;
$$;


ALTER FUNCTION "public"."notify"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_actor_id" "uuid", "p_related_type" "text", "p_related_id" "uuid", "p_link" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."place_bid"("p_listing_id" "uuid", "p_bidder_id" "uuid", "p_montant_cents" integer, "p_is_auto_bid" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_listing RECORD;
  v_trust_score INTEGER;
  v_min_next INTEGER;
  v_bid_id UUID;
BEGIN
  -- Fetch listing
  SELECT enchere_actuelle_cents, increment_min_cents, date_fin_enchere, statut, vendeur_id
  INTO v_listing
  FROM public.listings
  WHERE id = p_listing_id AND listing_type = 'enchere'::public.listing_type;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'listing_not_found');
  END IF;

  -- Check auction is still active
  IF v_listing.statut != 'actif' OR v_listing.date_fin_enchere < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'auction_closed');
  END IF;

  -- Seller cannot bid on own listing
  IF v_listing.vendeur_id = p_bidder_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_bid_own_listing');
  END IF;

  -- Check Trust Score
  SELECT trust_score INTO v_trust_score
  FROM public.user_profiles
  WHERE id = p_bidder_id;

  IF v_trust_score IS NULL OR v_trust_score < 40 THEN
    RETURN jsonb_build_object('success', false, 'error', 'trust_score_insufficient', 'required', 40, 'current', COALESCE(v_trust_score, 0));
  END IF;

  -- Check minimum increment
  v_min_next := v_listing.enchere_actuelle_cents + v_listing.increment_min_cents;
  IF p_montant_cents < v_min_next THEN
    RETURN jsonb_build_object('success', false, 'error', 'below_minimum', 'minimum_cents', v_min_next);
  END IF;

  -- Insert bid
  INSERT INTO public.auction_bids (listing_id, bidder_id, montant_cents, is_auto_bid)
  VALUES (p_listing_id, p_bidder_id, p_montant_cents, p_is_auto_bid)
  RETURNING id INTO v_bid_id;

  -- Update listing current bid and bidder count
  UPDATE public.listings
  SET
    enchere_actuelle_cents = p_montant_cents,
    nombre_encherisseurs = nombre_encherisseurs + 1,
    updated_at = NOW()
  WHERE id = p_listing_id;

  RETURN jsonb_build_object('success', true, 'bid_id', v_bid_id, 'montant_cents', p_montant_cents);
END;
$$;


ALTER FUNCTION "public"."place_bid"("p_listing_id" "uuid", "p_bidder_id" "uuid", "p_montant_cents" integer, "p_is_auto_bid" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_message_immutable_fields_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id THEN
        RAISE EXCEPTION 'Impossible de déplacer un message vers une autre conversation';
    END IF;
    IF NEW.sender_id IS DISTINCT FROM OLD.sender_id THEN
        RAISE EXCEPTION 'Impossible de modifier l expéditeur d un message';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_message_immutable_fields_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_order_points"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_points INTEGER;
BEGIN
    v_points := (NEW.total_eur * 10)::integer;
    NEW.loyalty_points_earned := v_points;

    IF TG_OP = 'INSERT' THEN
        IF NEW.status IN ('confirmed', 'preparing', 'shipped', 'delivered') THEN
            INSERT INTO public.loyalty_history (user_id, action, points, type, source_id)
            VALUES (NEW.user_id, 'Achat boutique : Commande ' || NEW.order_number, v_points, 'purchase', 'order_' || NEW.id);
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Si la commande passe de annulée à confirmée
        IF OLD.status IN ('cancelled', 'refunded') AND NEW.status IN ('confirmed', 'preparing', 'shipped', 'delivered') THEN
            INSERT INTO public.loyalty_history (user_id, action, points, type, source_id)
            VALUES (NEW.user_id, 'Achat boutique : Commande ' || NEW.order_number, v_points, 'purchase', 'order_' || NEW.id);
        
        -- Si la commande passe de confirmée à annulée
        ELSIF OLD.status IN ('confirmed', 'preparing', 'shipped', 'delivered') AND NEW.status IN ('cancelled', 'refunded') THEN
            INSERT INTO public.loyalty_history (user_id, action, points, type, source_id)
            VALUES (NEW.user_id, 'Annulation commande ' || NEW.order_number, -v_points, 'purchase_cancel', 'order_cancel_' || NEW.id);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."process_order_points"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_pending_contribution"("p_contribution_id" "uuid", "p_approve" boolean, "p_reason" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_contrib RECORD;
  v_transaction_type TEXT;
BEGIN
  -- Verify requester is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès interdit: Administrateurs uniquement';
  END IF;

  SELECT * INTO v_contrib FROM public.pending_contributions WHERE id = p_contribution_id;
  IF v_contrib IS NULL THEN
    RAISE EXCEPTION 'Contribution introuvable';
  END IF;

  IF v_contrib.status <> 'pending' THEN
    RAISE EXCEPTION 'Cette contribution a déjà été traitée';
  END IF;

  IF p_approve THEN
    -- Update contribution status
    UPDATE public.pending_contributions
    SET status = 'approved',
        validated_at = now()
    WHERE id = p_contribution_id;

    -- Insert reward transaction
    v_transaction_type := CASE 
      WHEN v_contrib.action_type = 'like' THEN 'LIKE_REWARD'::text
      WHEN v_contrib.action_type = 'comment' THEN 'COMMENT_REWARD'::text
      WHEN v_contrib.action_type = 'post' THEN 'POST_REWARD'::text
      WHEN v_contrib.action_type = 'carnet' THEN 'JOURNAL_REWARD'::text
      WHEN v_contrib.action_type = 'group_message' THEN 'GROUP_REWARD'::text
      WHEN v_contrib.action_type = 'referral' THEN 'REFERRAL_REWARD'::text
      ELSE 'ADMIN_ADJUSTMENT'::text
    END;

    INSERT INTO public.reward_transactions (
      user_id,
      points,
      transaction_type,
      reference_id,
      reference_type,
      metadata
    ) VALUES (
      v_contrib.user_id,
      v_contrib.final_points,
      v_transaction_type,
      p_contribution_id,
      v_contrib.target_type,
      jsonb_build_object('approved_by_admin', auth.uid(), 'reason', p_reason)
    );
  ELSE
    -- Update contribution status
    UPDATE public.pending_contributions
    SET status = 'rejected',
        rejection_reason = p_reason,
        validated_at = now()
    WHERE id = p_contribution_id;
  END IF;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."process_pending_contribution"("p_contribution_id" "uuid", "p_approve" boolean, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_withdrawal"("p_withdrawal_id" "uuid", "p_approve" boolean, "p_reference" "text" DEFAULT NULL::"text", "p_reason" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_withdrawal RECORD;
BEGIN
  -- Admin only
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès interdit';
  END IF;

  SELECT * INTO v_withdrawal FROM public.reward_withdrawals WHERE id = p_withdrawal_id;
  IF v_withdrawal IS NULL THEN
    RAISE EXCEPTION 'Retrait introuvable';
  END IF;

  IF v_withdrawal.status <> 'pending' AND v_withdrawal.status <> 'under_review' THEN
    RAISE EXCEPTION 'Ce retrait a déjà été traité (statut: %)', v_withdrawal.status;
  END IF;

  IF p_approve THEN
    -- Approve and deduct from pending cash
    UPDATE public.reward_withdrawals
    SET status = 'paid',
        payment_reference = p_reference,
        reviewed_at = now(),
        processed_at = now()
    WHERE id = p_withdrawal_id;

    UPDATE public.reward_accounts
    SET pending_cash = GREATEST(0, pending_cash - v_withdrawal.amount),
        updated_at = now()
    WHERE user_id = v_withdrawal.user_id;

    -- Add to audit logs
    INSERT INTO public.admin_audit_logs (
      admin_email,
      action,
      target_table,
      target_id,
      target_name,
      new_data
    ) VALUES (
      'admin',
      'APPROVE_WITHDRAWAL',
      'reward_withdrawals',
      p_withdrawal_id::text,
      'Withdrawal approved for user ' || v_withdrawal.user_id::text,
      jsonb_build_object('amount', v_withdrawal.amount, 'reference', p_reference)
    );
  ELSE
    -- Reject and move pending cash back to available cash
    UPDATE public.reward_withdrawals
    SET status = 'rejected',
        rejection_reason = p_reason,
        reviewed_at = now(),
        processed_at = now()
    WHERE id = p_withdrawal_id;

    UPDATE public.reward_accounts
    SET pending_cash = GREATEST(0, pending_cash - v_withdrawal.amount),
        available_cash = available_cash + v_withdrawal.amount,
        updated_at = now()
    WHERE user_id = v_withdrawal.user_id;

    -- Add to audit logs
    INSERT INTO public.admin_audit_logs (
      admin_email,
      action,
      target_table,
      target_id,
      target_name,
      new_data
    ) VALUES (
      'admin',
      'REJECT_WITHDRAWAL',
      'reward_withdrawals',
      p_withdrawal_id::text,
      'Withdrawal rejected for user ' || v_withdrawal.user_id::text,
      jsonb_build_object('amount', v_withdrawal.amount, 'reason', p_reason)
    );
  END IF;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."process_withdrawal"("p_withdrawal_id" "uuid", "p_approve" boolean, "p_reference" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."product_ownership_search_vector_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.search_vector :=
    setweight(to_tsvector('french', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(new.brand, '')), 'B') ||
    setweight(to_tsvector('french', array_to_string(coalesce(new.tags, '{}'), ' ')), 'C');
  return new;
end;
$$;


ALTER FUNCTION "public"."product_ownership_search_vector_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purge_expired_lkv_events"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM public.lkv_events
  WHERE created_at < now() - INTERVAL '13 months';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."purge_expired_lkv_events"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purge_rejected_club_requests"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  DELETE FROM public.club_join_requests
  WHERE status = 'rejected'
  AND updated_at < now() - interval '30 days';
END;
$$;


ALTER FUNCTION "public"."purge_rejected_club_requests"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_place_rating"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  target_place_id UUID;
  v_count INT;
  v_weighted_sum NUMERIC;
  v_weighted_count NUMERIC;
  v_bayesian NUMERIC(3, 2);
  C CONSTANT NUMERIC := 3.0;
  m CONSTANT NUMERIC := 3.5;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_place_id := OLD.place_id;
  ELSE
    target_place_id := NEW.place_id;
  END IF;

  SELECT 
    COUNT(*),
    COALESCE(SUM(rating * (CASE WHEN has_field_proof THEN 2.0 ELSE 1.0 END)), 0),
    COALESCE(SUM(CASE WHEN has_field_proof THEN 2.0 ELSE 1.0 END), 0)
  INTO v_count, v_weighted_sum, v_weighted_count
  FROM public.place_reviews
  WHERE place_id = target_place_id;

  IF v_count = 0 THEN
    v_bayesian := 0.0;
  ELSE
    v_bayesian := ROUND(((C * m + v_weighted_sum) / (C + v_weighted_count))::numeric, 2);
  END IF;

  UPDATE public.places
  SET 
    reviews_count = v_count,
    bayesian_rating = v_bayesian,
    updated_at = now()
  WHERE id = target_place_id;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."recalculate_place_rating"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_hike_gear_usage"("p_gear_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
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
$$;


ALTER FUNCTION "public"."record_hike_gear_usage"("p_gear_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redeem_reward"("p_user_id" "uuid", "p_reward_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_reward RECORD;
    v_balance INTEGER;
BEGIN
    -- Obtenir la récompense avec un verrou pour éviter les concurrences si on gère des stocks
    SELECT * INTO v_reward FROM public.loyalty_rewards WHERE id = p_reward_id FOR UPDATE;
    
    IF NOT FOUND OR v_reward.available = false THEN
        RAISE EXCEPTION 'Récompense indisponible';
    END IF;

    -- Calculer le solde
    SELECT COALESCE(SUM(points), 0) INTO v_balance FROM public.loyalty_history WHERE user_id = p_user_id;

    IF v_balance < v_reward.points_cost THEN
        RAISE EXCEPTION 'Solde insuffisant';
    END IF;

    -- Créer la transaction historique (débit)
    INSERT INTO public.loyalty_history (user_id, action, points, type, source_id)
    VALUES (p_user_id, 'Récompense échangée : ' || v_reward.title, -v_reward.points_cost, 'reward_redemption', 'reward_' || p_reward_id);

    -- Créer l'échange
    INSERT INTO public.loyalty_redemptions (user_id, reward_id, points_spent, status)
    VALUES (p_user_id, p_reward_id, v_reward.points_cost, 'completed');

    RETURN jsonb_build_object('success', true, 'new_balance', v_balance - v_reward.points_cost);
END;
$$;


ALTER FUNCTION "public"."redeem_reward"("p_user_id" "uuid", "p_reward_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_kit_conservation"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.kit_item_survival;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.kit_item_survival_by_kit;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.kit_trust_scores;
END;
$$;


ALTER FUNCTION "public"."refresh_kit_conservation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_user_field_signature"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_field_signature;
$$;


ALTER FUNCTION "public"."refresh_user_field_signature"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_withdrawal"("p_amount" numeric, "p_payment_provider" "text", "p_idempotency_key" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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

  -- 1. Check idempotency
  SELECT id INTO v_existing_id FROM public.reward_withdrawals WHERE idempotency_key = p_idempotency_key;
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
$$;


ALTER FUNCTION "public"."request_withdrawal"("p_amount" numeric, "p_payment_provider" "text", "p_idempotency_key" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_digests"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user RECORD;
  v_count INT;
  v_msg TEXT;
  v_notif_ids UUID[];
  v_digest_count INT := 0;
BEGIN
  -- Find users who have notifications that should be summarized
  FOR v_user IN 
    SELECT DISTINCT user_id 
    FROM public.notifications 
    WHERE read = false 
      AND type IN ('post_liked', 'carnet_liked', 'new_follower', 'points_earned')
      -- Has not been sent via email yet
      AND NOT (channels_sent @> '["email"]'::jsonb)
  LOOP
    -- Count unread interactions
    SELECT COUNT(*), array_agg(id)
    INTO v_count, v_notif_ids
    FROM public.notifications
    WHERE user_id = v_user.user_id
      AND read = false
      AND type IN ('post_liked', 'carnet_liked', 'new_follower', 'points_earned')
      AND NOT (channels_sent @> '["email"]'::jsonb);

    IF v_count > 0 THEN
      v_msg := v_count || ' nouvelles interactions et activités sur vos carnets et publications.';
      
      -- Create a single digest notification (notifying the user by email)
      PERFORM public.notify(
        v_user.user_id,
        'digest',
        'Résumé de votre activité LKDV',
        v_msg,
        NULL,
        'digest',
        NULL,
        '/alertes'
      );

      -- Mark original notifications as email-sent
      UPDATE public.notifications
      SET channels_sent = COALESCE(channels_sent, '[]'::jsonb) || '"email"'::jsonb
      WHERE id = ANY(v_notif_ids);

      v_digest_count := v_digest_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_digest_count;
END;
$$;


ALTER FUNCTION "public"."send_digests"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_materiel_reminders"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_count integer := 0;
BEGIN
  -- Rappel péremption J-30
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT g.user_id, 'gear_expiry', 'Péremption dans 30 jours', g.name, '/mon-materiel/alertes'
  FROM public.gear_items g
  WHERE g.expiry_date IS NOT NULL
    AND g.expiry_date BETWEEN (now() + INTERVAL '29 days') AND (now() + INTERVAL '31 days')
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = g.user_id AND n.type = 'gear_expiry' AND n.related_id = g.id::text
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."send_materiel_reminders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_ai_cache"("p_cache_key" "text", "p_feature" "text", "p_response" "jsonb", "p_model" "text", "p_provider" "text", "p_ttl_seconds" integer) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  INSERT INTO public.ai_response_cache
    (cache_key, feature, response, model, provider, hit_count, created_at, expires_at)
  VALUES (
    p_cache_key, p_feature, p_response, p_model, p_provider, 0, now(),
    now() + make_interval(secs => greatest(p_ttl_seconds, 60))
  )
  ON CONFLICT (cache_key) DO UPDATE SET
    feature    = excluded.feature,
    response   = excluded.response,
    model      = excluded.model,
    provider   = excluded.provider,
    created_at = now(),
    expires_at = now() + make_interval(secs => greatest(p_ttl_seconds, 60));
$$;


ALTER FUNCTION "public"."set_ai_cache"("p_cache_key" "text", "p_feature" "text", "p_response" "jsonb", "p_model" "text", "p_provider" "text", "p_ttl_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_auto_bid"("p_listing_id" "uuid", "p_bidder_id" "uuid", "p_plafond_cents" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_listing RECORD;
  v_trust_score INTEGER;
BEGIN
  SELECT enchere_actuelle_cents, increment_min_cents, date_fin_enchere, statut, vendeur_id
  INTO v_listing
  FROM public.listings
  WHERE id = p_listing_id AND listing_type = 'enchere'::public.listing_type;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'listing_not_found');
  END IF;

  IF v_listing.statut != 'actif' OR v_listing.date_fin_enchere < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'auction_closed');
  END IF;

  IF v_listing.vendeur_id = p_bidder_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_bid_own_listing');
  END IF;

  SELECT trust_score INTO v_trust_score FROM public.user_profiles WHERE id = p_bidder_id;
  IF v_trust_score IS NULL OR v_trust_score < 40 THEN
    RETURN jsonb_build_object('success', false, 'error', 'trust_score_insufficient', 'required', 40, 'current', COALESCE(v_trust_score, 0));
  END IF;

  IF p_plafond_cents <= v_listing.enchere_actuelle_cents THEN
    RETURN jsonb_build_object('success', false, 'error', 'plafond_too_low');
  END IF;

  INSERT INTO public.auction_auto_bids (listing_id, bidder_id, plafond_cents, actif)
  VALUES (p_listing_id, p_bidder_id, p_plafond_cents, TRUE)
  ON CONFLICT (listing_id, bidder_id) DO UPDATE
    SET plafond_cents = EXCLUDED.plafond_cents, actif = TRUE, updated_at = NOW()
  WHERE public.auction_auto_bids.actif = TRUE;

  RETURN jsonb_build_object('success', true, 'plafond_cents', p_plafond_cents);
END;
$$;


ALTER FUNCTION "public"."set_auto_bid"("p_listing_id" "uuid", "p_bidder_id" "uuid", "p_plafond_cents" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_carnet_comments_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.carnets
    SET comments_count = comments_count + 1
    WHERE id = NEW.carnet_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.carnets
    SET comments_count = GREATEST(0, comments_count - 1)
    WHERE id = OLD.carnet_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."sync_carnet_comments_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_carnet_favorites_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.carnets
    SET favorites_count = favorites_count + 1
    WHERE id = NEW.carnet_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.carnets
    SET favorites_count = GREATEST(0, favorites_count - 1)
    WHERE id = OLD.carnet_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."sync_carnet_favorites_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_carnet_likes_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.carnets
    SET likes_count = likes_count + 1
    WHERE id = NEW.carnet_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.carnets
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = OLD.carnet_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."sync_carnet_likes_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_carnet_views_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.carnets
  SET views_count = views_count + 1
  WHERE id = NEW.carnet_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_carnet_views_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_community_post_comments_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts
    SET comments_count = comments_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts
    SET comments_count = GREATEST(0, comments_count - 1)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."sync_community_post_comments_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_loyalty_points"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE public.user_profiles
    SET loyalty_points = (
        SELECT COALESCE(SUM(points), 0) 
        FROM public.loyalty_history 
        WHERE user_id = NEW.user_id
    )
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_loyalty_points"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_place_geom"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_place_geom"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_community_post_like"("p_post_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_exists boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.post_likes 
    WHERE post_id = p_post_id AND user_id = v_user_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.post_likes WHERE post_id = p_post_id AND user_id = v_user_id;
    UPDATE public.community_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = p_post_id;
  ELSE
    INSERT INTO public.post_likes (post_id, user_id) VALUES (p_post_id, v_user_id);
    UPDATE public.community_posts SET likes_count = likes_count + 1 WHERE id = p_post_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."toggle_community_post_like"("p_post_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_on_carnet_comment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_author_id UUID;
  v_title TEXT;
  v_actor_name TEXT;
BEGIN
  -- Get carnet info
  SELECT author_id, title INTO v_author_id, v_title
  FROM public.carnets WHERE id = NEW.carnet_id;

  -- Get actor name
  SELECT full_name INTO v_actor_name
  FROM public.user_profiles WHERE id = NEW.author_id;

  -- Do not notify self-comments
  IF v_author_id IS NOT NULL AND v_author_id <> NEW.author_id THEN
    PERFORM public.notify(
      v_author_id,
      'carnet_commented',
      'Nouveau commentaire !',
      COALESCE(v_actor_name, 'Un membre') || ' a commenté votre carnet de route "' || COALESCE(v_title, '') || '"',
      NEW.author_id,
      'carnet',
      NEW.carnet_id,
      '/carnets/' || NEW.carnet_id
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_on_carnet_comment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_on_carnet_like"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_author_id UUID;
  v_title TEXT;
  v_actor_name TEXT;
BEGIN
  -- Get carnet info
  SELECT author_id, title INTO v_author_id, v_title
  FROM public.carnets WHERE id = NEW.carnet_id;

  -- Get actor name
  SELECT full_name INTO v_actor_name
  FROM public.user_profiles WHERE id = NEW.user_id;

  -- Do not notify self-likes
  IF v_author_id IS NOT NULL AND v_author_id <> NEW.user_id THEN
    PERFORM public.notify(
      v_author_id,
      'carnet_liked',
      'Nouveau like !',
      COALESCE(v_actor_name, 'Un membre') || ' a aimé votre carnet de route "' || COALESCE(v_title, '') || '"',
      NEW.user_id,
      'carnet',
      NEW.carnet_id,
      '/carnets/' || NEW.carnet_id
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_on_carnet_like"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_on_community_post_comment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_author_id UUID;
  v_title TEXT;
  v_actor_name TEXT;
BEGIN
  -- Get post info
  SELECT author_id, SUBSTRING(content FROM 1 FOR 30) INTO v_author_id, v_title
  FROM public.community_posts WHERE id = NEW.post_id;

  -- Get actor name
  SELECT full_name INTO v_actor_name
  FROM public.user_profiles WHERE id = NEW.author_id;

  -- Do not notify self-comments
  IF v_author_id IS NOT NULL AND v_author_id <> NEW.author_id THEN
    PERFORM public.notify(
      v_author_id,
      'post_commented',
      'Nouveau commentaire !',
      COALESCE(v_actor_name, 'Un membre') || ' a commenté votre publication "' || COALESCE(v_title, '') || '..."',
      NEW.author_id,
      'post',
      NEW.post_id,
      '/communaute'
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_on_community_post_comment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_on_community_post_like"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_author_id UUID;
  v_title TEXT;
  v_actor_name TEXT;
BEGIN
  -- Get post info
  SELECT author_id, SUBSTRING(content FROM 1 FOR 30) INTO v_author_id, v_title
  FROM public.community_posts WHERE id = NEW.post_id;

  -- Get actor name
  SELECT full_name INTO v_actor_name
  FROM public.user_profiles WHERE id = NEW.user_id;

  -- Do not notify self-likes
  IF v_author_id IS NOT NULL AND v_author_id <> NEW.user_id THEN
    PERFORM public.notify(
      v_author_id,
      'post_liked',
      'Nouveau like !',
      COALESCE(v_actor_name, 'Un membre') || ' a aimé votre publication "' || COALESCE(v_title, '') || '..."',
      NEW.user_id,
      'post',
      NEW.post_id,
      '/communaute'
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_on_community_post_like"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_on_group_expense_added"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_group_name TEXT;
  v_payer_name TEXT;
  v_user_id UUID;
BEGIN
  -- Get group name
  SELECT name INTO v_group_name FROM public.travel_groups WHERE id = NEW.group_id;

  -- Get payer name
  SELECT full_name INTO v_payer_name FROM public.user_profiles WHERE id = NEW.paid_by;

  -- Loop through the split_between array of UUIDs
  IF NEW.split_between IS NOT NULL THEN
    FOREACH v_user_id IN ARRAY NEW.split_between LOOP
      -- Notify if the user is in the split and not the payer
      IF v_user_id <> NEW.paid_by THEN
        PERFORM public.notify(
          v_user_id,
          'group_expense_added',
          v_group_name,
          COALESCE(v_payer_name, 'Un membre') || ' a ajouté une dépense : "' || NEW.title || '" (' || NEW.amount || ' €)',
          NEW.paid_by,
          'group',
          NEW.group_id,
          '/groupes/' || NEW.group_id
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_on_group_expense_added"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_on_group_member_join"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_owner_id UUID;
  v_group_name TEXT;
  v_actor_name TEXT;
BEGIN
  -- Get group details
  SELECT owner_id, name INTO v_owner_id, v_group_name
  FROM public.travel_groups WHERE id = NEW.group_id;

  -- Get actor name
  SELECT full_name INTO v_actor_name
  FROM public.user_profiles WHERE id = NEW.user_id;

  -- Notify the group owner (organizer) if a member joins, and it's not the owner themselves
  IF v_owner_id IS NOT NULL AND v_owner_id <> NEW.user_id AND NEW.status::text = 'active' THEN
    PERFORM public.notify(
      v_owner_id,
      'group_invite', -- using group_invite type
      v_group_name,
      COALESCE(v_actor_name, 'Un voyageur') || ' a rejoint votre groupe',
      NEW.user_id,
      'group',
      NEW.group_id,
      '/groupes/' || NEW.group_id
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_on_group_member_join"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_on_group_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_member RECORD;
  v_actor_name TEXT;
  v_group_name TEXT;
BEGIN
  -- Get actor name
  SELECT full_name INTO v_actor_name
  FROM public.user_profiles WHERE id = NEW.user_id;

  -- Get group name
  SELECT name INTO v_group_name
  FROM public.travel_groups WHERE id = NEW.group_id;

  -- Notify all members of the group except the message sender
  FOR v_member IN 
    SELECT user_id FROM public.group_members 
    WHERE group_id = NEW.group_id AND user_id <> NEW.user_id AND status::text = 'active'
  LOOP
    PERFORM public.notify(
      v_member.user_id,
      'group_message',
      v_group_name,
      COALESCE(v_actor_name, 'Un membre') || ' : ' || SUBSTRING(NEW.content FROM 1 FOR 40),
      NEW.user_id,
      'group',
      NEW.group_id,
      '/groupes/' || NEW.group_id
    );
  END LOOP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_on_group_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_on_group_task_assigned"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_group_name TEXT;
  v_creator_name TEXT;
BEGIN
  -- Get group name
  SELECT name INTO v_group_name FROM public.travel_groups WHERE id = NEW.group_id;
  
  -- Get creator name
  SELECT full_name INTO v_creator_name FROM public.user_profiles WHERE id = NEW.created_by;

  -- Send notification if assigned_to is set and different from the creator
  IF NEW.assigned_to IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.assigned_to IS NULL OR OLD.assigned_to <> NEW.assigned_to) THEN
    PERFORM public.notify(
      NEW.assigned_to,
      'group_task_assigned',
      v_group_name,
      COALESCE(v_creator_name, 'L''organisateur') || ' vous a assigné la tâche : "' || NEW.title || '"',
      NEW.created_by,
      'group',
      NEW.group_id,
      '/groupes/' || NEW.group_id
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_on_group_task_assigned"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unaccent_lower"("text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    AS $_$
  SELECT lower(translate(
    $1,
    'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÝýÿ',
    'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOOooooooUUUUuuuuYyy'
  ));
$_$;


ALTER FUNCTION "public"."unaccent_lower"("text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_group_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_group_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_loyalty_points"("p_user_id" "uuid", "p_points" integer, "p_action" "text", "p_type" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.user_profiles
  SET loyalty_points = GREATEST(0, loyalty_points + p_points),
      loyalty_level = CASE
        WHEN GREATEST(0, loyalty_points + p_points) >= 7500 THEN 'Légende du Voyage'
        WHEN GREATEST(0, loyalty_points + p_points) >= 3500 THEN 'Guide de Montagne'
        WHEN GREATEST(0, loyalty_points + p_points) >= 1500 THEN 'Randonneur Expert'
        WHEN GREATEST(0, loyalty_points + p_points) >= 500 THEN 'Aventurier'
        ELSE 'Explorateur'
      END,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_user_id;

  INSERT INTO public.loyalty_history (user_id, action, points, type)
  VALUES (p_user_id, p_action, p_points, p_type);
END;
$$;


ALTER FUNCTION "public"."update_loyalty_points"("p_user_id" "uuid", "p_points" integer, "p_action" "text", "p_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_moderation_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_moderation_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_order_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_order_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_reward_account_on_contribution"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."update_reward_account_on_contribution"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_reward_account_on_transaction"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.reward_accounts (
    user_id,
    available_points,
    lifetime_points,
    eligible_points,
    earned_this_period,
    redeemed_points
  ) VALUES (
    NEW.user_id,
    GREATEST(0, NEW.points),
    GREATEST(0, NEW.points),
    GREATEST(0, NEW.points),
    GREATEST(0, NEW.points),
    CASE WHEN NEW.transaction_type = 'REDEMPTION' THEN ABS(NEW.points) ELSE 0 END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    available_points = GREATEST(0, public.reward_accounts.available_points + NEW.points),
    lifetime_points = public.reward_accounts.lifetime_points + CASE WHEN NEW.points > 0 THEN NEW.points ELSE 0 END,
    eligible_points = GREATEST(0, public.reward_accounts.eligible_points + NEW.points),
    earned_this_period = GREATEST(0, public.reward_accounts.earned_this_period + CASE WHEN NEW.transaction_type <> 'REDEMPTION' THEN NEW.points ELSE 0 END),
    redeemed_points = public.reward_accounts.redeemed_points + CASE WHEN NEW.transaction_type = 'REDEMPTION' THEN ABS(NEW.points) ELSE 0 END,
    updated_at = now();

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_reward_account_on_transaction"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "hiking_route_id" bigint,
    "title" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "distance_km" numeric,
    "duration_seconds" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "action" "public"."audit_action" NOT NULL,
    "cible_type" "text" NOT NULL,
    "cible_id" "text" NOT NULL,
    "avant" "jsonb",
    "apres" "jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."admin_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_email" "text" DEFAULT 'admin'::"text" NOT NULL,
    "action" "text" NOT NULL,
    "target_table" "text" DEFAULT 'shop_products'::"text" NOT NULL,
    "target_id" "text" NOT NULL,
    "target_name" "text" DEFAULT ''::"text",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_regions_geo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "country_id" "uuid",
    "admin_code" "text",
    "name" "text" NOT NULL,
    "level" integer,
    "geometry" "public"."geometry"(Polygon,4326),
    "population" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "geoname_id" bigint,
    "country_iso_a2" "text",
    "admin_code_full" "text",
    "name_ascii" "text",
    "name_en" "text",
    "admin_parent_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "admin1_code_full" "text"
);


ALTER TABLE "public"."admin_regions_geo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."admin_role" DEFAULT 'moderateur'::"public"."admin_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid"
);


ALTER TABLE "public"."admin_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."affiliate_clicks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "session_id" "uuid",
    "partner_id" "uuid",
    "program_id" "uuid",
    "offer_id" "uuid",
    "page" "text",
    "placement" "text",
    "destination" "text",
    "category" "text",
    "device" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "link_id" "uuid",
    "trip_id" "uuid",
    "session_hash" "text",
    "referrer" "text"
);


ALTER TABLE "public"."affiliate_clicks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."affiliate_conversions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "partner_id" "uuid",
    "offer_id" "uuid",
    "click_id" "uuid",
    "external_reference" "text",
    "commission" numeric,
    "currency" "text",
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "external_sub_id" "text",
    "amount_cents" integer DEFAULT 0,
    "payload" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."affiliate_conversions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."affiliate_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "partner_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "country_code" "text",
    "title" "text" NOT NULL,
    "destination_name" "text",
    "target_url" "text" NOT NULL,
    "tracking_params" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "affiliate_links_category_check" CHECK (("category" = ANY (ARRAY['flight'::"text", 'hotel'::"text", 'activity'::"text", 'insurance'::"text", 'esim'::"text", 'transport'::"text", 'gear'::"text"])))
);


ALTER TABLE "public"."affiliate_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."affiliate_offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "program_id" "uuid",
    "destination" "text",
    "country" "text",
    "city" "text",
    "category" "text",
    "title" "text" NOT NULL,
    "description" "text",
    "image" "text",
    "price" numeric,
    "currency" "text",
    "rating" numeric,
    "affiliate_url" "text" NOT NULL,
    "priority" integer DEFAULT 0,
    "availability" boolean DEFAULT true,
    "valid_from" timestamp with time zone,
    "valid_to" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."affiliate_offers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."affiliate_partners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "category" "text",
    "network" "text",
    "logo" "text",
    "site" "text",
    "country" "text",
    "is_active" boolean DEFAULT true,
    "priority" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "commission_rate_desc" "text",
    "website_url" "text"
);


ALTER TABLE "public"."affiliate_partners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."affiliate_programs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "partner_id" "uuid",
    "program_identifier" "text" NOT NULL,
    "network" "text",
    "commission_type" "text",
    "commission_value" numeric,
    "cookie_duration" integer,
    "status" "text",
    "api_available" boolean DEFAULT false,
    "tracking_template" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."affiliate_programs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_response_cache" (
    "cache_key" "text" NOT NULL,
    "feature" "text" DEFAULT 'general'::"text" NOT NULL,
    "response" "jsonb" NOT NULL,
    "model" "text",
    "provider" "text",
    "hit_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."ai_response_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_usage_daily" (
    "user_id" "uuid" NOT NULL,
    "day" "date" DEFAULT CURRENT_DATE NOT NULL,
    "requests_heavy" integer DEFAULT 0 NOT NULL,
    "requests_fast" integer DEFAULT 0 NOT NULL,
    "requests_by_feature" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."ai_usage_daily" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_ownership_id" "uuid",
    "type" "text" NOT NULL,
    "severity" "text" DEFAULT 'warning'::"text" NOT NULL,
    "message" "text" NOT NULL,
    "is_resolved" boolean DEFAULT false NOT NULL,
    "resolved_at" timestamp with time zone,
    "due_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "alerts_severity_check" CHECK (("severity" = ANY (ARRAY['info'::"text", 'warning'::"text", 'critical'::"text"]))),
    CONSTRAINT "alerts_type_check" CHECK (("type" = ANY (ARRAY['entretien'::"text", 'peremption'::"text", 'pret'::"text", 'etat'::"text", 'conflit'::"text", 'meteo'::"text", 'reglementation'::"text"])))
);


ALTER TABLE "public"."alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ama_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid",
    "author_id" "uuid",
    "content" "text" NOT NULL,
    "votes_count" integer DEFAULT 0,
    "is_answered" boolean DEFAULT false,
    "answer" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."ama_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ama_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "expert_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "scheduled_at" timestamp with time zone,
    "duration_minutes" integer DEFAULT 60,
    "status" "text" DEFAULT 'upcoming'::"text",
    "participants_count" integer DEFAULT 0,
    "questions_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ama_sessions_status_check" CHECK (("status" = ANY (ARRAY['upcoming'::"text", 'live'::"text", 'ended'::"text"])))
);


ALTER TABLE "public"."ama_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ama_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question_id" "uuid",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."ama_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ambassadors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "handle" "text",
    "tier" "text" DEFAULT 'Explorer'::"text",
    "followers" "text",
    "commission_pct" numeric DEFAULT 8,
    "earnings" numeric DEFAULT 0,
    "clicks" integer DEFAULT 0,
    "conversions" integer DEFAULT 0,
    "promo_code" "text",
    "avatar" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ambassadors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auction_auto_bids" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "bidder_id" "uuid" NOT NULL,
    "plafond_cents" integer NOT NULL,
    "actif" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."auction_auto_bids" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auction_bids" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "bidder_id" "uuid" NOT NULL,
    "montant_cents" integer NOT NULL,
    "is_auto_bid" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."auction_bids" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "icon" "text" DEFAULT '🏅'::"text",
    "rarity" "text" DEFAULT 'Commun'::"text",
    "holders_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "slug" "text",
    "category" "text",
    "points_reward" integer DEFAULT 0,
    "requirement_type" "text",
    "requirement_value" integer DEFAULT 1,
    "active" boolean DEFAULT true
);


ALTER TABLE "public"."badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carnet_collaborators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "carnet_id" "uuid",
    "user_id" "uuid",
    "role" "text" DEFAULT 'contributor'::"text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "carnet_collaborators_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'contributor'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."carnet_collaborators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carnet_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "carnet_id" "uuid",
    "author_id" "uuid",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."carnet_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carnet_favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "carnet_id" "uuid",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."carnet_favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carnet_gear_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "carnet_id" "uuid",
    "product_id" "uuid",
    "note" "text"
);


ALTER TABLE "public"."carnet_gear_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carnet_kit_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "carnet_id" "uuid",
    "nom" "text" NOT NULL,
    "detail" "text",
    "poids_g" integer DEFAULT 0,
    "couleur_tag" "text",
    "sort_order" integer DEFAULT 1
);


ALTER TABLE "public"."carnet_kit_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carnet_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "carnet_id" "uuid",
    "user_id" "uuid",
    "reaction" "text" DEFAULT 'useful'::"text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."carnet_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carnet_media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "carnet_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "type" "text" DEFAULT 'photo'::"text",
    "caption" "text",
    "position" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."carnet_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carnet_moments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "carnet_id" "uuid",
    "jour_numero" integer,
    "heure" "text",
    "citation" "text" NOT NULL,
    "auteur_nom" "text",
    "auteur_id" "uuid",
    "lieu" "text",
    "image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "moment_timestamp" timestamp with time zone,
    "source" "text" DEFAULT 'manuel'::"text",
    "hike_session_id" "uuid",
    "identified_species" "jsonb",
    CONSTRAINT "carnet_moments_source_check" CHECK (("source" = ANY (ARRAY['manuel'::"text", 'auto'::"text"])))
);


ALTER TABLE "public"."carnet_moments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."carnet_moments"."identified_species" IS 'Array of {name, common_name, confidence, description} from AI species identification';



CREATE TABLE IF NOT EXISTS "public"."carnet_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "carnet_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "ip_address" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."carnet_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carnets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid",
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "destination" "text" DEFAULT ''::"text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "cover_image" "text" DEFAULT ''::"text",
    "cover_image_alt" "text" DEFAULT ''::"text",
    "start_date" "date",
    "end_date" "date",
    "weather" "text" DEFAULT ''::"text",
    "route_rating" numeric(3,1) DEFAULT 0,
    "visibility" "text" DEFAULT 'public'::"text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "likes_count" integer DEFAULT 0,
    "comments_count" integer DEFAULT 0,
    "views_count" integer DEFAULT 0,
    "verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "map_points" "jsonb" DEFAULT '[]'::"jsonb",
    "is_collaborative" boolean DEFAULT false,
    "favorites_count" integer DEFAULT 0,
    "groupe_id" "uuid",
    "distance_km" numeric DEFAULT 27.4,
    "denivele_m" integer DEFAULT 1620,
    "nb_nuits" integer DEFAULT 2,
    "nb_voyageurs" integer DEFAULT 6,
    "lieu_depart" "text" DEFAULT 'Saint-Pierre-de-Chartreuse'::"text",
    "lieu_arrivee" "text" DEFAULT 'Col de la Charmette'::"text",
    "country_iso" "text",
    "trip_id" "uuid"
);


ALTER TABLE "public"."carnets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cart_loyalty_discounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_id" "text" NOT NULL,
    "discount_type" "text" DEFAULT 'free'::"text",
    "discount_value" numeric(10,2) DEFAULT 0,
    "applied_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."cart_loyalty_discounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "xp" integer DEFAULT 100,
    "category" "text" DEFAULT 'Général'::"text",
    "difficulty" "text" DEFAULT 'Facile'::"text",
    "total" integer DEFAULT 1,
    "deadline" "text" DEFAULT ''::"text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."challenges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checkout_intents" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid",
    "payload" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '02:00:00'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "checkout_intents_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'used'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."checkout_intents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_challenge_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "challenge_id" "uuid",
    "user_id" "uuid",
    "proof_text" "text" DEFAULT ''::"text",
    "proof_image" "text" DEFAULT ''::"text",
    "score" integer DEFAULT 0,
    "validated" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."club_challenge_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "xp_reward" integer DEFAULT 0,
    "active" boolean DEFAULT true,
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."club_challenges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_event_participants" (
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."club_event_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid",
    "organizer_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "event_date" timestamp with time zone,
    "location" "text" DEFAULT ''::"text",
    "max_participants" integer DEFAULT 0,
    "participants_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."club_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_join_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid",
    "user_id" "uuid",
    "message" "text" DEFAULT ''::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "reviewed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "club_join_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."club_join_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid",
    "user_id" "uuid",
    "role" "text" DEFAULT 'member'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "joined_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "club_members_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'moderator'::"text", 'member'::"text"]))),
    CONSTRAINT "club_members_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'banned'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."club_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_recommended_kits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid",
    "kit_id" "uuid",
    "recommended_by" "uuid",
    "note" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."club_recommended_kits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid",
    "reporter_id" "uuid",
    "target_type" "text" DEFAULT 'topic'::"text",
    "target_id" "uuid",
    "reason" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "club_reports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewed'::"text", 'dismissed'::"text"]))),
    CONSTRAINT "club_reports_target_type_check" CHECK (("target_type" = ANY (ARRAY['topic'::"text", 'reply'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."club_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_topic_likes" (
    "topic_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."club_topic_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_topic_replies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "topic_id" "uuid",
    "author_id" "uuid",
    "content" "text" NOT NULL,
    "is_approved" boolean DEFAULT true,
    "likes_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "parent_id" "uuid"
);


ALTER TABLE "public"."club_topic_replies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_topics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid",
    "author_id" "uuid",
    "title" "text" NOT NULL,
    "content" "text" DEFAULT ''::"text",
    "is_pinned" boolean DEFAULT false,
    "is_announcement" boolean DEFAULT false,
    "is_approved" boolean DEFAULT true,
    "likes_count" integer DEFAULT 0,
    "replies_count" integer DEFAULT 0,
    "reports_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."club_topics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clubs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" DEFAULT 'activite'::"text",
    "emoji" "text" DEFAULT '🏕️'::"text",
    "description" "text" DEFAULT ''::"text",
    "cover_color" "text" DEFAULT 'from-emerald-600 to-teal-700'::"text",
    "cover_image" "text" DEFAULT ''::"text",
    "category" "text" DEFAULT ''::"text",
    "privacy" "text" DEFAULT 'open'::"text",
    "members_count" integer DEFAULT 0,
    "active_this_month" integer DEFAULT 0,
    "is_verified" boolean DEFAULT false,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "country_iso" "text"
);


ALTER TABLE "public"."clubs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comment_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "reporter_id" "uuid",
    "reason" "text" DEFAULT 'Propos inappropriés'::"text",
    "table_name" "text" DEFAULT 'post_comments'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "comment_reports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewed'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."comment_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid",
    "content" "text" NOT NULL,
    "image_url" "text" DEFAULT ''::"text",
    "image_alt" "text" DEFAULT ''::"text",
    "post_type" "text" DEFAULT 'post'::"text",
    "likes_count" integer DEFAULT 0,
    "comments_count" integer DEFAULT 0,
    "shares_count" integer DEFAULT 0,
    "is_trending" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "title" "text" DEFAULT ''::"text",
    CONSTRAINT "community_posts_post_type_check" CHECK (("post_type" = ANY (ARRAY['post'::"text", 'tip'::"text", 'question'::"text", 'share'::"text"])))
);


ALTER TABLE "public"."community_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configurator_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "destination" "text" DEFAULT ''::"text" NOT NULL,
    "country" "text" DEFAULT ''::"text" NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "season" "text" DEFAULT ''::"text" NOT NULL,
    "activity" "text" DEFAULT ''::"text" NOT NULL,
    "level" "text" DEFAULT ''::"text" NOT NULL,
    "max_weight_g" integer DEFAULT 10000 NOT NULL,
    "budget_eur" numeric DEFAULT 500 NOT NULL,
    "body_weight_kg" numeric,
    "climate" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."configurator_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "role" "text" DEFAULT 'member'::"text",
    "is_muted" boolean DEFAULT false,
    "is_archived" boolean DEFAULT false,
    "last_read_at" timestamp with time zone DEFAULT "now"(),
    "unread_count" integer DEFAULT 0,
    "left_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "conversation_members_role_check" CHECK (("role" = ANY (ARRAY['member'::"text", 'admin'::"text", 'owner'::"text"]))),
    CONSTRAINT "conversation_members_unread_count_check" CHECK (("unread_count" >= 0))
);


ALTER TABLE "public"."conversation_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "avatar" "text",
    "members_count" integer DEFAULT 2,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "title" "text",
    "avatar_url" "text",
    "direct_pair_key" "text",
    "last_message_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "conversations_type_check" CHECK (("type" = ANY (ARRAY['direct'::"text", 'group'::"text"])))
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."countries_content" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "country_iso_a2" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "pratique_voyage" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "climat" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "budget" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "sante_securite" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "transport" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "culture" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "outdoor" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "connectivite" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "editorial" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_researched_at" timestamp with time zone,
    "data_source" "text" DEFAULT 'agent_scrape'::"text" NOT NULL,
    "staleness_days" integer DEFAULT 90 NOT NULL,
    "research_wave" integer,
    "research_batch_file" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "countries_content_data_source_check" CHECK (("data_source" = ANY (ARRAY['manual'::"text", 'api'::"text", 'agent_scrape'::"text"]))),
    CONSTRAINT "countries_content_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."countries_content" OWNER TO "postgres";


COMMENT ON TABLE "public"."countries_content" IS 'Contenu éditorial/pratique par pays (visa, climat, budget, santé, transport, culture, outdoor, connectivité). Complète countries_geo (données géo brutes). Alimenté par vagues via agent de recherche + Excel de validation.';



CREATE OR REPLACE VIEW "public"."countries_content_needs_review" WITH ("security_invoker"='true') AS
 SELECT "id",
    "country_iso_a2",
    "slug",
    "status",
    "pratique_voyage",
    "climat",
    "budget",
    "sante_securite",
    "transport",
    "culture",
    "outdoor",
    "connectivite",
    "editorial",
    "last_researched_at",
    "data_source",
    "staleness_days",
    "research_wave",
    "research_batch_file",
    "created_at",
    "updated_at"
   FROM "public"."countries_content"
  WHERE (("last_researched_at" IS NULL) OR ("last_researched_at" < ("now"() - (("staleness_days" || ' days'::"text"))::interval)));


ALTER VIEW "public"."countries_content_needs_review" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."countries_geo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "iso_a2" "text" NOT NULL,
    "name" "text" NOT NULL,
    "continent" "text",
    "geometry" "public"."geometry"(Geometry,4326),
    "population" integer,
    "capital" "text",
    "currency" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "geoname_id" bigint,
    "iso_a3" "text",
    "iso_numeric" "text",
    "fips_code" "text",
    "tld" "text",
    "phone_code" "text",
    "currency_code" "text",
    "currency_name" "text",
    "postal_code_format" "text",
    "postal_code_regex" "text",
    "languages" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "neighbours" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "area_km2" double precision,
    "name_ascii" "text",
    "name_en" "text",
    "name_short" "text",
    "geometry_source" "public"."geo_country_geometry_source" DEFAULT 'manual'::"public"."geo_country_geometry_source" NOT NULL,
    "is_sovereign" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "timezone" "text",
    "subregion" "text",
    "sources" "text"
);


ALTER TABLE "public"."countries_geo" OWNER TO "postgres";


COMMENT ON COLUMN "public"."countries_geo"."timezone" IS 'UTC offset(s), e.g. UTC+1 (source: reference CSV import)';



COMMENT ON COLUMN "public"."countries_geo"."subregion" IS 'Geographic subregion, e.g. Europe du Sud-Est (Balkans)';



COMMENT ON COLUMN "public"."countries_geo"."sources" IS 'Reference URLs used to compile this row, semicolon-separated';



CREATE TABLE IF NOT EXISTS "public"."country_content_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "country_code" "text" NOT NULL,
    "block_type" "text" NOT NULL,
    "tier" smallint NOT NULL,
    "content_md" "text" NOT NULL,
    "content_json" "jsonb",
    "sources" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "model_used" "text" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stale_after" timestamp with time zone NOT NULL,
    "degraded" boolean DEFAULT false NOT NULL,
    "needs_human_review" boolean DEFAULT false NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    CONSTRAINT "country_content_blocks_block_type_check" CHECK (("block_type" = ANY (ARRAY['formalites'::"text", 'securite_alertes'::"text", 'transport'::"text", 'budget'::"text", 'sante'::"text", 'etiquette'::"text", 'vue_ensemble'::"text", 'meilleure_periode_activite'::"text", 'itineraires_suggeres'::"text", 'spots_incontournables'::"text", 'niveau_difficulte'::"text", 'faq'::"text", 'recommandations_kit'::"text"]))),
    CONSTRAINT "country_content_blocks_tier_check" CHECK ((("tier" >= 1) AND ("tier" <= 4)))
);


ALTER TABLE "public"."country_content_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."country_practical_guides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "country_code" "text" NOT NULL,
    "section" "text" NOT NULL,
    "content_md" "text" NOT NULL,
    "sources" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "model_used" "text" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stale_after" timestamp with time zone NOT NULL,
    "degraded" boolean DEFAULT false NOT NULL,
    CONSTRAINT "country_practical_guides_section_check" CHECK (("section" = ANY (ARRAY['formalites'::"text", 'transport'::"text", 'budget'::"text", 'sante'::"text", 'securite'::"text", 'meilleure_saison'::"text"])))
);


ALTER TABLE "public"."country_practical_guides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."country_sync_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code_iso" "text" NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cache_valid_until" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'ok'::"text" NOT NULL,
    "schema_version" "text" DEFAULT 'v2'::"text" NOT NULL,
    "generated_by" "text" DEFAULT 'gemini/gemini-2.5-flash'::"text" NOT NULL,
    "nationalite" "text" DEFAULT 'France'::"text" NOT NULL,
    "error_message" "text",
    "payload_size_bytes" integer,
    "country_id" "text",
    CONSTRAINT "country_sync_log_status_check" CHECK (("status" = ANY (ARRAY['ok'::"text", 'error'::"text", 'pending'::"text", 'stale'::"text"])))
);


ALTER TABLE "public"."country_sync_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crew_members" (
    "crew_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "crew_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'organizer'::"text", 'member'::"text", 'guest'::"text"]))),
    CONSTRAINT "crew_members_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'pending'::"text", 'left'::"text", 'removed'::"text"])))
);


ALTER TABLE "public"."crew_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "theme" "text" DEFAULT 'Aventure'::"text",
    "cover_url" "text",
    "visibility" "text" DEFAULT 'private'::"text" NOT NULL,
    "invite_code" "text",
    "max_members" integer DEFAULT 12 NOT NULL,
    "level" integer DEFAULT 1 NOT NULL,
    "xp" integer DEFAULT 0 NOT NULL,
    "created_by" "uuid" NOT NULL,
    "legacy_group_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auto_created" boolean DEFAULT false NOT NULL,
    CONSTRAINT "crews_level_check" CHECK (("level" >= 1)),
    CONSTRAINT "crews_max_members_check" CHECK ((("max_members" >= 2) AND ("max_members" <= 200))),
    CONSTRAINT "crews_name_check" CHECK ((("char_length"("name") >= 2) AND ("char_length"("name") <= 80))),
    CONSTRAINT "crews_slug_check" CHECK (("slug" ~ '^[a-z0-9-]{3,80}$'::"text")),
    CONSTRAINT "crews_visibility_check" CHECK (("visibility" = ANY (ARRAY['private'::"text", 'link'::"text", 'public'::"text"]))),
    CONSTRAINT "crews_xp_check" CHECK (("xp" >= 0))
);


ALTER TABLE "public"."crews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_kit_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kit_id" "uuid" NOT NULL,
    "gear_item_id" "uuid",
    "item_name" "text",
    "category" "text" DEFAULT 'Autre'::"text",
    "weight_g" integer DEFAULT 0,
    "quantity" integer DEFAULT 1,
    "is_essential" boolean DEFAULT false,
    "is_checked" boolean DEFAULT false,
    "custom_notes" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."custom_kit_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_kits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "for_destination" "text" DEFAULT ''::"text",
    "season" "text" DEFAULT ''::"text",
    "activity" "text" DEFAULT 'randonnee'::"text",
    "total_weight_g" integer DEFAULT 0,
    "source" "text" DEFAULT 'manuel'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "deleted_at" timestamp with time zone,
    "is_favorite" boolean DEFAULT false,
    "last_used_at" timestamp with time zone,
    "trail_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "search" "tsvector"
);


ALTER TABLE "public"."custom_kits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."depart_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kit_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "is_emergency_contact" boolean DEFAULT false NOT NULL,
    "contact" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."depart_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."destination_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "natural_key" "text" NOT NULL,
    "country_code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "location_name" "text" NOT NULL,
    "latitude" numeric(10,7) NOT NULL,
    "longitude" numeric(10,7) NOT NULL,
    "description" "text",
    "distance_km" numeric(6,2),
    "elevation_gain_m" integer,
    "elevation_loss_m" integer,
    "difficulty" "text" DEFAULT 'moderate'::"text" NOT NULL,
    "activity_type" "text" DEFAULT 'trekking'::"text" NOT NULL,
    "order_hint" integer DEFAULT 0 NOT NULL,
    "is_demanding" boolean DEFAULT false NOT NULL,
    "source" "text" DEFAULT 'import'::"text" NOT NULL,
    "provenance" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "destination_steps_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['easy'::"text", 'moderate'::"text", 'hard'::"text", 'expert'::"text"])))
);


ALTER TABLE "public"."destination_steps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid",
    "label" "text" NOT NULL,
    "amount" numeric DEFAULT 0,
    "paid" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "type" "text" DEFAULT 'rando'::"text",
    "emoji" "text" DEFAULT '🥾'::"text",
    "organizer_id" "uuid",
    "event_date" "date" NOT NULL,
    "duration" "text",
    "location" "text",
    "country" "text" DEFAULT 'France'::"text",
    "max_participants" integer DEFAULT 10,
    "current_participants" integer DEFAULT 0,
    "description" "text",
    "cover_image" "text",
    "cover_alt" "text",
    "shared_kitty" numeric DEFAULT 0,
    "kitty_goal" numeric DEFAULT 0,
    "min_trust_to_organize" integer DEFAULT 0,
    "status" "text" DEFAULT 'upcoming'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "events_status_check" CHECK (("status" = ANY (ARRAY['upcoming'::"text", 'full'::"text", 'past'::"text"])))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expedition_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "destination" "text" NOT NULL,
    "country" "text",
    "start_date" "text",
    "end_date" "text",
    "duration" "text",
    "type" "text",
    "score" numeric DEFAULT 0,
    "notes" "text",
    "budget_estimated" numeric DEFAULT 0,
    "budget_real" numeric DEFAULT 0,
    "image" "text",
    "alt" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."expedition_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expert_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "expert_id" "uuid",
    "user_id" "uuid",
    "booking_date" "text",
    "duration_minutes" integer DEFAULT 60,
    "topic" "text",
    "message" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."expert_bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."experts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "title" "text",
    "specialties" "text"[] DEFAULT '{}'::"text"[],
    "destinations" "text"[] DEFAULT '{}'::"text"[],
    "rating" numeric DEFAULT 0,
    "reviews_count" integer DEFAULT 0,
    "consultations_count" integer DEFAULT 0,
    "price_per_hour" numeric DEFAULT 0,
    "availability" "text" DEFAULT 'disponible'::"text",
    "certifications" "text"[] DEFAULT '{}'::"text"[],
    "bio" "text",
    "avatar" "text",
    "languages" "text"[] DEFAULT '{}'::"text"[],
    "response_time" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."experts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text" DEFAULT ''::"text" NOT NULL,
    "avatar_url" "text" DEFAULT ''::"text",
    "trust_score" integer DEFAULT 50,
    "loyalty_points" integer DEFAULT 0,
    "loyalty_level" "text" DEFAULT 'Explorateur'::"text",
    "bio" "text" DEFAULT ''::"text",
    "location" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "xp" integer DEFAULT 0,
    "level" integer DEFAULT 1,
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "phone" "text" DEFAULT ''::"text",
    "website" "text" DEFAULT ''::"text",
    "notification_prefs" "jsonb" DEFAULT '{"sms": false, "push": false, "email": true}'::"jsonb",
    "two_fa_enabled" boolean DEFAULT false,
    "is_suspended_groups" boolean DEFAULT false,
    "age_confirmed_at" timestamp with time zone,
    "suspended_from_groups_at" timestamp with time zone,
    "signature_visibility" "text" DEFAULT 'private'::"text" NOT NULL,
    CONSTRAINT "user_profiles_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'admin'::"text", 'moderator'::"text"]))),
    CONSTRAINT "user_profiles_signature_visibility_check" CHECK (("signature_visibility" = ANY (ARRAY['private'::"text", 'communaute'::"text", 'public'::"text"])))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."explore_kits_public" WITH ("security_invoker"='true') AS
 SELECT "k"."id",
    "k"."name",
    "k"."description",
    "k"."for_destination",
    "k"."season",
    "k"."activity",
    "k"."total_weight_g",
    "k"."source",
    "k"."trail_id",
    "k"."updated_at",
    COALESCE(NULLIF("p"."full_name", ''::"text"), 'Anonyme'::"text") AS "author_name",
    "p"."avatar_url" AS "author_avatar",
    ( SELECT COALESCE("json_agg"("json_build_object"('name', "ki"."item_name", 'weight_g', "ki"."weight_g", 'category', "ki"."category") ORDER BY "ki"."created_at") FILTER (WHERE ("ki"."item_name" IS NOT NULL)), '[]'::json) AS "coalesce"
           FROM "public"."custom_kit_items" "ki"
          WHERE ("ki"."kit_id" = "k"."id")) AS "items_preview"
   FROM ("public"."custom_kits" "k"
     LEFT JOIN "public"."user_profiles" "p" ON (("p"."id" = "k"."user_id")))
  WHERE (("k"."status" = 'active'::"text") AND ("k"."source" = 'configurator'::"text"));


ALTER VIEW "public"."explore_kits_public" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hiking_routes" (
    "id" bigint NOT NULL,
    "osm_relation_id" bigint,
    "name" "text",
    "ref" "text",
    "network" "text",
    "distance_km" numeric,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "geom" "public"."geometry"(MultiLineString,4326),
    "region" "text"
);


ALTER TABLE "public"."hiking_routes" OWNER TO "postgres";


COMMENT ON TABLE "public"."hiking_routes" IS 'Named official hiking itineraries (GR/GRP/PR and international routes). Populated from OSM relations: type=route AND route=hiking. distance_km is auto-calculated from geometry using ST_Length.';



COMMENT ON COLUMN "public"."hiking_routes"."network" IS 'OSM network tag: iwn=international, nwn=national (GR), rwn=regional (GRP), lwn=local (PR).';



COMMENT ON COLUMN "public"."hiking_routes"."distance_km" IS 'Route length in km, calculated automatically during import via ST_Length(geom::geography) / 1000.';



CREATE TABLE IF NOT EXISTS "public"."trail_metadata" (
    "id" bigint NOT NULL,
    "trail_id" bigint,
    "difficulty" "text",
    "duration_hours" numeric,
    "elevation_gain" integer,
    "terrain_type" "text",
    "family_friendly" boolean,
    "season" "text",
    "ai_description" "text",
    "elevation_loss" integer,
    "max_elevation" integer,
    "min_elevation" integer,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."trail_metadata" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trail_scores" (
    "id" bigint NOT NULL,
    "trail_id" bigint,
    "adventure_score" integer,
    "nature_score" integer,
    "panorama_score" integer,
    "accessibility_score" integer,
    "challenge_score" integer,
    "services_score" integer,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."trail_scores" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."explore_trails" WITH ("security_invoker"='true') AS
 SELECT ("r"."id")::"text" AS "id",
    "r"."name",
    ("public"."st_asgeojson"("r"."geom"))::"jsonb" AS "geometry",
    "r"."distance_km",
    "m"."duration_hours",
    "m"."difficulty",
    "m"."elevation_gain",
    "s"."adventure_score",
    "s"."nature_score",
    "s"."panorama_score",
    "s"."accessibility_score",
    "s"."challenge_score",
    "s"."services_score",
    "public"."st_ymin"(("public"."st_envelope"("r"."geom"))::"public"."box3d") AS "bbox_min_lat",
    "public"."st_xmin"(("public"."st_envelope"("r"."geom"))::"public"."box3d") AS "bbox_min_lng",
    "public"."st_ymax"(("public"."st_envelope"("r"."geom"))::"public"."box3d") AS "bbox_max_lat",
    "public"."st_xmax"(("public"."st_envelope"("r"."geom"))::"public"."box3d") AS "bbox_max_lng",
    "public"."st_y"("public"."st_startpoint"("public"."st_geometryn"("r"."geom", 1))) AS "start_lat",
    "public"."st_x"("public"."st_startpoint"("public"."st_geometryn"("r"."geom", 1))) AS "start_lng",
    "r"."ref",
    "r"."network",
    "m"."terrain_type",
    "m"."family_friendly",
    "m"."season",
    "m"."ai_description"
   FROM (("public"."hiking_routes" "r"
     LEFT JOIN "public"."trail_metadata" "m" ON (("m"."trail_id" = "r"."id")))
     LEFT JOIN "public"."trail_scores" "s" ON (("s"."trail_id" = "r"."id")))
  WHERE ("r"."geom" IS NOT NULL);


ALTER VIEW "public"."explore_trails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feature_flags" (
    "id" "text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "scope" "text" DEFAULT 'global'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid"
);

ALTER TABLE ONLY "public"."feature_flags" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."feature_flags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gear_alert_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "gear_item_id" "uuid",
    "alert_type" "text" NOT NULL,
    "label" "text",
    "resolved_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."gear_alert_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gear_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gear_item_id" "uuid",
    "event_type" "text",
    "event_date" timestamp with time zone DEFAULT "now"(),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."gear_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gear_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gear_item_id" "uuid",
    "url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."gear_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gear_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "brand" "text" DEFAULT ''::"text" NOT NULL,
    "model" "text" DEFAULT ''::"text" NOT NULL,
    "category" "text" DEFAULT 'autre'::"text" NOT NULL,
    "condition" "text" DEFAULT 'bon'::"text" NOT NULL,
    "purchase_date" "date",
    "purchase_price" numeric DEFAULT 0 NOT NULL,
    "weight_g" integer DEFAULT 0 NOT NULL,
    "expiry_date" "date",
    "last_maintenance_date" "date",
    "next_maintenance_date" "date",
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "serial_number" "text",
    "usage_count" integer DEFAULT 0 NOT NULL,
    "image" "text" DEFAULT ''::"text" NOT NULL,
    "alt" "text" DEFAULT ''::"text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "source_report_id" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "product_id" "uuid",
    "source" "text" DEFAULT 'manuel'::"text",
    "origin_order_id" "uuid",
    "origin_kit_id" "uuid",
    "is_listed_for_sale" boolean DEFAULT false,
    "acquired_at" "date" DEFAULT CURRENT_DATE,
    "transferred_to_user_id" "uuid",
    "quantity" integer DEFAULT 1,
    "is_favorite" boolean DEFAULT false,
    "loan_status" "text",
    "loan_to_name" "text",
    "compartment" "text",
    "wear_percentage" integer,
    "size_label" "text",
    "materials" "text",
    "sole_type" "text",
    "waterproof_rating" "text",
    "ref_code" "text",
    "loan_due_date" timestamp with time zone,
    "last_used_at" timestamp with time zone,
    "sorties_count" integer DEFAULT 0
);


ALTER TABLE "public"."gear_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_album" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid",
    "uploaded_by" "uuid",
    "image_url" "text" NOT NULL,
    "caption" "text",
    "location" "text",
    "taken_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."group_album" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid",
    "paid_by" "uuid",
    "title" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "category" "text" DEFAULT 'Divers'::"text",
    "split_between" "uuid"[] DEFAULT '{}'::"uuid"[],
    "receipt_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "public"."group_expense_status" DEFAULT 'pending'::"public"."group_expense_status"
);


ALTER TABLE "public"."group_expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid",
    "invited_by" "uuid",
    "email" "text",
    "token" "text" DEFAULT ("gen_random_uuid"())::"text",
    "used_at" timestamp with time zone,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."group_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_kit_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid",
    "assigned_to" "uuid",
    "name" "text" NOT NULL,
    "weight_grams" integer DEFAULT 0,
    "category" "text" DEFAULT 'Divers'::"text",
    "quantity" integer DEFAULT 1,
    "is_shared" boolean DEFAULT true,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "start_date" "date",
    "end_date" "date"
);


ALTER TABLE "public"."group_kit_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid",
    "user_id" "uuid",
    "weight_capacity" integer DEFAULT 15000,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "role" "public"."group_member_role" DEFAULT 'member'::"public"."group_member_role",
    "status" "public"."group_member_status" DEFAULT 'active'::"public"."group_member_status",
    "invited_by" "uuid"
);


ALTER TABLE "public"."group_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid",
    "user_id" "uuid",
    "content" "text" NOT NULL,
    "reply_to" "uuid",
    "reactions" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "media_url" "text",
    "location" "jsonb"
);


ALTER TABLE "public"."group_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_poll_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "poll_id" "uuid",
    "user_id" "uuid",
    "option_index" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."group_poll_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_polls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid",
    "created_by" "uuid",
    "question" "text" NOT NULL,
    "options" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "ends_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "public"."group_poll_status" DEFAULT 'open'::"public"."group_poll_status"
);


ALTER TABLE "public"."group_polls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid",
    "reported_user_id" "uuid",
    "group_id" "uuid",
    "category" "text" NOT NULL,
    "reason" "text",
    "severity" "text" DEFAULT 'normal'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."group_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid",
    "assigned_to" "uuid",
    "created_by" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "due_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "public"."group_task_status" DEFAULT 'todo'::"public"."group_task_status"
);


ALTER TABLE "public"."group_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groupe_activites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "groupe_id" "uuid",
    "membre_id" "uuid",
    "type" "text",
    "description" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."groupe_activites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groupe_depense_parts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "depense_id" "uuid",
    "membre_id" "uuid",
    "montant_cents" integer DEFAULT 0,
    "regle" boolean DEFAULT false
);


ALTER TABLE "public"."groupe_depense_parts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groupe_depenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "groupe_id" "uuid",
    "titre" "text" NOT NULL,
    "montant_cents" integer NOT NULL,
    "payeur_id" "uuid",
    "statut" "text" DEFAULT 'verse'::"text",
    "date_depense" "date" DEFAULT CURRENT_DATE,
    "nb_parts" integer DEFAULT 1,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."groupe_depenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groupe_equipement" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "groupe_id" "uuid",
    "nom" "text" NOT NULL,
    "categorie" "text",
    "apporte_par" "uuid",
    "poids_g" integer DEFAULT 0,
    "statut" "text" DEFAULT 'confirme'::"text",
    "note" "text"
);


ALTER TABLE "public"."groupe_equipement" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groupe_etapes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "groupe_id" "uuid",
    "ordre" integer DEFAULT 1,
    "lieu_depart" "text",
    "lieu_arrivee" "text",
    "distance_km" numeric,
    "denivele_m" integer,
    "duree_texte" "text",
    "meteo" "text",
    "temperature_c" integer,
    "jour_numero" integer,
    "date_etape" "date",
    "recit" "text",
    "gpx_url" "text",
    "difficulte" "text",
    "points_geojson" "jsonb"
);


ALTER TABLE "public"."groupe_etapes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groupe_hebergements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "groupe_id" "uuid",
    "apres_jour_numero" integer,
    "nom" "text" NOT NULL,
    "altitude_m" integer,
    "type_hebergement" "text",
    "hote" "text",
    "prix_cents" integer,
    "prix_note" "text",
    "note" "text"
);


ALTER TABLE "public"."groupe_hebergements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groupe_membres" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "groupe_id" "uuid",
    "user_id" "uuid",
    "invited_email" "text",
    "nom_affichage" "text" NOT NULL,
    "role" "text" DEFAULT 'membre'::"text",
    "role_note" "text",
    "statut_preparation" "text" DEFAULT 'pret'::"text",
    "pourcentage_pret" integer DEFAULT 100,
    "note_statut" "text",
    "confirme" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."groupe_membres" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groupe_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "groupe_id" "uuid",
    "auteur_id" "uuid",
    "contenu" "text" NOT NULL,
    "lieu_nom" "text",
    "gpx_url" "text",
    "likes_count" integer DEFAULT 0,
    "comments_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."groupe_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groupe_taches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "groupe_id" "uuid",
    "titre" "text" NOT NULL,
    "categorie" "text" DEFAULT 'general'::"text",
    "assigne_a" "uuid",
    "statut" "text" DEFAULT 'a_faire'::"text",
    "echeance" "date",
    "note" "text",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."groupe_taches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groupe_vote_choix" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vote_id" "uuid",
    "option_id" "uuid",
    "membre_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."groupe_vote_choix" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groupe_vote_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vote_id" "uuid",
    "libelle" "text" NOT NULL,
    "detail" "text",
    "ordre" integer DEFAULT 1
);


ALTER TABLE "public"."groupe_vote_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groupe_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "groupe_id" "uuid",
    "question" "text" NOT NULL,
    "contexte" "text",
    "lance_par" "uuid",
    "statut" "text" DEFAULT 'actif'::"text",
    "date_cloture" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."groupe_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groupes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "carnet_id" "uuid",
    "created_by" "uuid",
    "nom" "text" NOT NULL,
    "sous_titre" "text",
    "destination" "text",
    "massif" "text",
    "description" "text",
    "date_debut" "date",
    "date_fin" "date",
    "lieu_rdv" "text",
    "statut" "text" DEFAULT 'preparation'::"text",
    "etape_courante" "text" DEFAULT 'itineraire'::"text",
    "progression_pct" integer DEFAULT 60,
    "difficulte" "text" DEFAULT 'Moyen'::"text",
    "budget_prevu_cents" integer DEFAULT 18000,
    "confidentialite" "text" DEFAULT 'public'::"text",
    "distance_km" numeric DEFAULT 27.4,
    "denivele_m" integer DEFAULT 1620,
    "nb_nuits" integer DEFAULT 2,
    "places_max" integer DEFAULT 6,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."groupes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "category" "text" DEFAULT 'Destination'::"text" NOT NULL,
    "destination" "text" DEFAULT ''::"text" NOT NULL,
    "read_time" integer DEFAULT 5 NOT NULL,
    "difficulty" "text" DEFAULT 'Débutant'::"text" NOT NULL,
    "image" "text" DEFAULT ''::"text" NOT NULL,
    "alt" "text" DEFAULT ''::"text" NOT NULL,
    "excerpt" "text" DEFAULT ''::"text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "featured" boolean DEFAULT false NOT NULL,
    "author_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."guides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hike_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "route_id" bigint,
    "carnet_id" "uuid",
    "started_at" timestamp with time zone NOT NULL,
    "ended_at" timestamp with time zone NOT NULL,
    "distance_km" numeric NOT NULL,
    "duration_seconds" integer NOT NULL,
    "elevation_gain_m" numeric,
    "positions_geojson" "jsonb",
    "poi_events" "jsonb" DEFAULT '[]'::"jsonb",
    "narratives" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "kit_id" "uuid"
);


ALTER TABLE "public"."hike_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hub_telemetry" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "event_name" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ts" timestamp with time zone DEFAULT "now"() NOT NULL,
    "app_version" "text" DEFAULT '0.0.0'::"text" NOT NULL,
    CONSTRAINT "event_name_format" CHECK (("event_name" ~ '^[a-z][a-z0-9_]{2,40}$'::"text")),
    CONSTRAINT "payload_size" CHECK (("octet_length"(("payload")::"text") < 8192))
);

ALTER TABLE ONLY "public"."hub_telemetry" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."hub_telemetry" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."hub_dashboard_kpis" AS
 SELECT (( SELECT ("count"(DISTINCT "hub_telemetry"."user_id") FILTER (WHERE (("hub_telemetry"."event_name" = 'hub_page_view'::"text") AND ("hub_telemetry"."ts" > ("now"() - '7 days'::interval)))))::double precision AS "count"
           FROM "public"."hub_telemetry") / (NULLIF(( SELECT "count"(*) AS "count"
           FROM "auth"."users"
          WHERE ("users"."last_sign_in_at" > ("now"() - '7 days'::interval))), 0))::double precision) AS "dau_hub_pct_7d",
    (( SELECT ("count"(DISTINCT "hub_telemetry"."session_id") FILTER (WHERE (("hub_telemetry"."event_name" = 'hub_nature_changed'::"text") AND ("hub_telemetry"."ts" > ("now"() - '7 days'::interval)))))::double precision AS "count"
           FROM "public"."hub_telemetry") / (NULLIF(( SELECT "count"(DISTINCT "hub_telemetry"."session_id") AS "count"
           FROM "public"."hub_telemetry"
          WHERE (("hub_telemetry"."event_name" = 'hub_page_view'::"text") AND ("hub_telemetry"."ts" > ("now"() - '7 days'::interval)))), 0))::double precision) AS "switcher_usage_pct_7d",
    ( SELECT "percentile_cont"((0.5)::double precision) WITHIN GROUP (ORDER BY ((EXTRACT(epoch FROM ("t2"."ts" - "t1"."ts")))::double precision)) AS "percentile_cont"
           FROM ("public"."hub_telemetry" "t1"
             JOIN "public"."hub_telemetry" "t2" ON ((("t2"."session_id" = "t1"."session_id") AND ("t2"."event_name" = 'hub_section_visited'::"text") AND ("t2"."ts" > "t1"."ts") AND ("t2"."ts" < ("t1"."ts" + '00:10:00'::interval)))))
          WHERE (("t1"."event_name" = 'hub_page_view'::"text") AND ("t1"."ts" > ("now"() - '7 days'::interval)))) AS "median_time_to_section_seconds_7d",
    ( SELECT (("count"(DISTINCT "hub_telemetry"."session_id") FILTER (WHERE ("hub_telemetry"."event_name" = 'hub_section_visited'::"text")))::double precision / (NULLIF("count"(DISTINCT "hub_telemetry"."session_id") FILTER (WHERE ("hub_telemetry"."event_name" = 'hub_page_view'::"text")), 0))::double precision)
           FROM "public"."hub_telemetry"
          WHERE ("hub_telemetry"."ts" > ("now"() - '7 days'::interval))) AS "section_visit_ratio_7d";


ALTER VIEW "public"."hub_dashboard_kpis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_exports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "exported_at" timestamp with time zone DEFAULT "now"(),
    "type" "text" DEFAULT 'csv'::"text" NOT NULL,
    CONSTRAINT "inventory_exports_type_check" CHECK (("type" = ANY (ARRAY['csv'::"text", 'pdf'::"text"])))
);


ALTER TABLE "public"."inventory_exports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kit_export_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kit_id" "uuid",
    "user_id" "uuid",
    "exported_at" timestamp with time zone DEFAULT "now"(),
    "format" "text" DEFAULT 'pdf'::"text" NOT NULL,
    CONSTRAINT "kit_export_logs_format_check" CHECK (("format" = ANY (ARRAY['pdf'::"text", 'ics'::"text", 'csv'::"text"])))
);


ALTER TABLE "public"."kit_export_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kit_field_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kit_id" "uuid" NOT NULL,
    "hike_session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_key" "text" NOT NULL,
    "product_id" "uuid",
    "verdict" "text" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "kit_field_reports_note_check" CHECK (("char_length"("note") <= 500)),
    CONSTRAINT "kit_field_reports_note_chk" CHECK (("char_length"("note") <= 500)),
    CONSTRAINT "kit_field_reports_verdict_check" CHECK (("verdict" = ANY (ARRAY['essentiel'::"text", 'utile'::"text", 'jamais_servi'::"text", 'defaillant'::"text", 'manquait'::"text"]))),
    CONSTRAINT "kit_field_reports_verdict_chk" CHECK (("verdict" = ANY (ARRAY['essentiel'::"text", 'utile'::"text", 'jamais_servi'::"text", 'defaillant'::"text", 'manquait'::"text"])))
);


ALTER TABLE "public"."kit_field_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."materiel_kit_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kit_id" "uuid" NOT NULL,
    "product_ownership_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "category" "text",
    "weight_g" integer DEFAULT 0,
    "is_checked" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text",
    "product_id" "uuid",
    "item_key" "text" GENERATED ALWAYS AS (COALESCE(("product_id")::"text", "regexp_replace"("lower"(COALESCE("name", ''::"text")), '[^a-z0-9]+'::"text", '-'::"text", 'g'::"text"))) STORED,
    CONSTRAINT "materiel_kit_items_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."materiel_kit_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."materiel_kits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "season" "text",
    "total_weight_g" integer DEFAULT 0,
    "is_public" boolean DEFAULT false NOT NULL,
    "is_favorite" boolean DEFAULT false NOT NULL,
    "is_trashed" boolean DEFAULT false NOT NULL,
    "cover_image_url" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "search_vector" "tsvector",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "consumables" "jsonb" DEFAULT '{}'::"jsonb",
    "forked_from" "uuid",
    "lineage_root_id" "uuid",
    "generation" smallint DEFAULT 0 NOT NULL,
    "ancestors" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "origin" "text" DEFAULT 'manuel'::"text" NOT NULL,
    "is_souche" boolean DEFAULT false NOT NULL,
    "field_proven_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "materiel_kits_origin_chk" CHECK (("origin" = ANY (ARRAY['configurateur'::"text", 'manuel'::"text", 'fork'::"text", 'import_gpx'::"text", 'souche_editoriale'::"text"]))),
    CONSTRAINT "materiel_kits_season_check" CHECK (("season" = ANY (ARRAY['printemps'::"text", 'ete'::"text", 'automne'::"text", 'hiver'::"text", 'toute_saison'::"text"])))
);


ALTER TABLE "public"."materiel_kits" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."kit_item_survival" AS
 SELECT "item_key",
    ("min"(("product_id")::"text"))::"uuid" AS "product_id",
    "count"(*) FILTER (WHERE "kept") AS "kept_count",
    "count"(*) FILTER (WHERE (NOT "kept")) AS "dropped_count",
    "count"(*) AS "total_pairs"
   FROM ( SELECT "pi"."item_key",
            "pi"."product_id",
            ("ci"."kit_id" IS NOT NULL) AS "kept"
           FROM ((( SELECT "parent"."id" AS "parent_id",
                    "child"."id" AS "child_id"
                   FROM ("public"."materiel_kits" "parent"
                     JOIN "public"."materiel_kits" "child" ON (("child"."forked_from" = "parent"."id")))
                  WHERE ("child"."user_id" IS DISTINCT FROM "parent"."user_id")) "edges"
             JOIN "public"."materiel_kit_items" "pi" ON (("pi"."kit_id" = "edges"."parent_id")))
             LEFT JOIN "public"."materiel_kit_items" "ci" ON ((("ci"."kit_id" = "edges"."child_id") AND ("ci"."item_key" = "pi"."item_key"))))) "pairs"
  GROUP BY "item_key"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."kit_item_survival" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."kit_item_survival_by_kit" AS
 SELECT "parent_id" AS "kit_id",
    "item_key",
    ("min"(("product_id")::"text"))::"uuid" AS "product_id",
    "count"(*) FILTER (WHERE "kept") AS "kept_count",
    "count"(*) FILTER (WHERE (NOT "kept")) AS "dropped_count",
    "count"(*) AS "total_pairs"
   FROM ( SELECT "edges"."parent_id",
            "pi"."item_key",
            "pi"."product_id",
            ("ci"."kit_id" IS NOT NULL) AS "kept"
           FROM ((( SELECT "parent"."id" AS "parent_id",
                    "child"."id" AS "child_id"
                   FROM ("public"."materiel_kits" "parent"
                     JOIN "public"."materiel_kits" "child" ON (("child"."forked_from" = "parent"."id")))
                  WHERE ("child"."user_id" IS DISTINCT FROM "parent"."user_id")) "edges"
             JOIN "public"."materiel_kit_items" "pi" ON (("pi"."kit_id" = "edges"."parent_id")))
             LEFT JOIN "public"."materiel_kit_items" "ci" ON ((("ci"."kit_id" = "edges"."child_id") AND ("ci"."item_key" = "pi"."item_key"))))) "pairs"
  GROUP BY "parent_id", "item_key"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."kit_item_survival_by_kit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kit_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kit_id" "uuid" NOT NULL,
    "nom" "text" NOT NULL,
    "categorie" "text" DEFAULT ''::"text",
    "poids_g" integer DEFAULT 0,
    "prix_cents" integer DEFAULT 0,
    "quantite" integer DEFAULT 1,
    "essentiel" boolean DEFAULT false,
    "slug" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "image" "text" DEFAULT ''::"text",
    "alt" "text" DEFAULT ''::"text",
    "sort_order" integer DEFAULT 0
);


ALTER TABLE "public"."kit_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kit_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "session_id" "uuid",
    "generated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "destination" "text" DEFAULT ''::"text" NOT NULL,
    "country" "text" DEFAULT ''::"text" NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "season" "text" DEFAULT ''::"text" NOT NULL,
    "activity" "text" DEFAULT ''::"text" NOT NULL,
    "level" "text" DEFAULT ''::"text" NOT NULL,
    "climate" "text" DEFAULT ''::"text" NOT NULL,
    "body_weight_kg" numeric,
    "budget_eur" numeric DEFAULT 0 NOT NULL,
    "selected_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "alternatives" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "consumables" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "bring_yourself" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "weight_breakdown" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "total_weight_g" integer DEFAULT 0 NOT NULL,
    "total_price_eur" numeric DEFAULT 0 NOT NULL,
    "carbon_kg_estimate" numeric,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "converted_to_inventory" boolean DEFAULT false NOT NULL,
    "converted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "kit_id" "uuid"
);


ALTER TABLE "public"."kit_reports" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."kit_trust_scores" AS
 SELECT "k"."id" AS "kit_id",
    "k"."lineage_root_id",
    "k"."origin",
    COALESCE("ls"."fork_users_unique", (0)::bigint) AS "fork_users_unique",
    COALESCE("ls"."lineage_depth", 0) AS "lineage_depth",
    COALESCE("ls"."propagation_score", (0)::numeric) AS "propagation_score",
    COALESCE("es"."sessions_count", (0)::bigint) AS "sessions_count",
    COALESCE("es"."total_km", (0)::numeric) AS "total_km",
    COALESCE("es"."season_count", (0)::bigint) AS "season_count",
    COALESCE("es"."region_count", (0)::bigint) AS "region_count",
    COALESCE("es"."essential_count", (0)::bigint) AS "essential_count",
    COALESCE("es"."never_used_count", (0)::bigint) AS "never_used_count",
    COALESCE("es"."essential_ratio", (0)::numeric) AS "essential_ratio",
    COALESCE("es"."endurance_score", (0)::numeric) AS "endurance_score",
    (COALESCE("es"."sessions_count", (0)::bigint) >= 5) AS "has_min_sessions"
   FROM (("public"."materiel_kits" "k"
     LEFT JOIN LATERAL ( SELECT "count"(DISTINCT "d"."user_id") AS "fork_users_unique",
            COALESCE((("max"("d"."generation") - "k"."generation"))::integer, 0) AS "lineage_depth",
            COALESCE(( SELECT "sum"("t"."max_decay") AS "sum"
                   FROM ( SELECT "d2"."user_id",
                            "max"((1.0 / "pow"(((EXTRACT(epoch FROM ("now"() - "d2"."created_at")) / 3600.0) + 2.0), 1.5))) AS "max_decay"
                           FROM ("public"."materiel_kits" "d2"
                             JOIN "public"."hike_sessions" "s2" ON (("s2"."kit_id" = "d2"."id")))
                          WHERE (("d2"."ancestors" @> ARRAY["k"."id"]) AND ("d2"."id" <> "k"."id") AND ("d2"."user_id" IS DISTINCT FROM "k"."user_id"))
                          GROUP BY "d2"."user_id") "t"), (0)::numeric) AS "propagation_score"
           FROM "public"."materiel_kits" "d"
          WHERE (("d"."ancestors" @> ARRAY["k"."id"]) AND ("d"."id" <> "k"."id") AND ("d"."user_id" IS DISTINCT FROM "k"."user_id") AND (EXISTS ( SELECT 1
                   FROM "public"."hike_sessions" "s"
                  WHERE ("s"."kit_id" = "d"."id"))))) "ls" ON (true))
     LEFT JOIN LATERAL ( SELECT "count"(DISTINCT "s"."id") AS "sessions_count",
            COALESCE("sum"("s"."distance_km"), (0)::numeric) AS "total_km",
            "count"(DISTINCT
                CASE EXTRACT(month FROM "s"."started_at")
                    WHEN 12 THEN 'hiver'::"text"
                    WHEN 1 THEN 'hiver'::"text"
                    WHEN 2 THEN 'hiver'::"text"
                    WHEN 3 THEN 'printemps'::"text"
                    WHEN 4 THEN 'printemps'::"text"
                    WHEN 5 THEN 'printemps'::"text"
                    WHEN 6 THEN 'ete'::"text"
                    WHEN 7 THEN 'ete'::"text"
                    WHEN 8 THEN 'ete'::"text"
                    ELSE 'automne'::"text"
                END) AS "season_count",
            "count"(DISTINCT "r"."region") AS "region_count",
            "count"(*) FILTER (WHERE ("fr"."verdict" = 'essentiel'::"text")) AS "essential_count",
            "count"(*) FILTER (WHERE ("fr"."verdict" = 'jamais_servi'::"text")) AS "never_used_count",
                CASE
                    WHEN ("count"(*) FILTER (WHERE ("fr"."verdict" = 'jamais_servi'::"text")) > 0) THEN "round"((("count"(*) FILTER (WHERE ("fr"."verdict" = 'essentiel'::"text")))::numeric / ("count"(*) FILTER (WHERE ("fr"."verdict" = 'jamais_servi'::"text")))::numeric), 2)
                    ELSE (0)::numeric
                END AS "essential_ratio",
            "round"((("sqrt"(("count"(DISTINCT "s"."id"))::numeric) * (1.0 + (0.25 * ("count"(DISTINCT
                CASE EXTRACT(month FROM "s"."started_at")
                    WHEN 12 THEN 'hiver'::"text"
                    WHEN 1 THEN 'hiver'::"text"
                    WHEN 2 THEN 'hiver'::"text"
                    WHEN 3 THEN 'printemps'::"text"
                    WHEN 4 THEN 'printemps'::"text"
                    WHEN 5 THEN 'printemps'::"text"
                    WHEN 6 THEN 'ete'::"text"
                    WHEN 7 THEN 'ete'::"text"
                    WHEN 8 THEN 'ete'::"text"
                    ELSE 'automne'::"text"
                END))::numeric))) * (1.0 + (0.25 * ("count"(DISTINCT "r"."region"))::numeric))), 3) AS "endurance_score"
           FROM (("public"."hike_sessions" "s"
             LEFT JOIN "public"."hiking_routes" "r" ON (("r"."id" = "s"."route_id")))
             LEFT JOIN "public"."kit_field_reports" "fr" ON ((("fr"."kit_id" = "s"."kit_id") AND ("fr"."hike_session_id" = "s"."id"))))
          GROUP BY "s"."kit_id") "es" ON (true))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."kit_trust_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "nom" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "destination" "text" DEFAULT ''::"text",
    "saison" "text" DEFAULT ''::"text",
    "poids_total_g" integer DEFAULT 0,
    "prix_cents" integer DEFAULT 0,
    "nb_articles" integer DEFAULT 0,
    "difficulte" "text" DEFAULT 'Débutant'::"text",
    "activite" "text" DEFAULT ''::"text",
    "image" "text" DEFAULT ''::"text",
    "alt" "text" DEFAULT ''::"text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "featured" boolean DEFAULT false,
    "conseils" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."kits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."listings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "produit_id" "text",
    "listing_type" "text" NOT NULL,
    "prix_cents" integer DEFAULT 0 NOT NULL,
    "statut" "text" DEFAULT 'actif'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "listings_listing_type_check" CHECK (("listing_type" = ANY (ARRAY['neuf'::"text", 'occasion'::"text", 'kit'::"text", 'enchere'::"text", 'location'::"text"])))
);


ALTER TABLE "public"."listings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lkv_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "actor_id" "uuid",
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "visibility" "text" DEFAULT 'private'::"text" NOT NULL,
    "crew_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lkv_events_visibility_check" CHECK (("visibility" = ANY (ARRAY['private'::"text", 'crew'::"text", 'public'::"text"])))
);


ALTER TABLE "public"."lkv_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gear_item_id" "uuid",
    "loaned_to" "text",
    "loaned_at" timestamp with time zone,
    "returned_at" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."loans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "points" integer DEFAULT 0,
    "type" "text" DEFAULT 'earned'::"text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "source_id" "text"
);


ALTER TABLE "public"."loyalty_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_redemptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "reward_id" "uuid",
    "points_spent" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "status" "text" DEFAULT 'completed'::"text"
);


ALTER TABLE "public"."loyalty_redemptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_rewards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "points_cost" integer DEFAULT 100,
    "category" "text" DEFAULT 'Réduction'::"text",
    "value" "text" DEFAULT ''::"text",
    "available" boolean DEFAULT true,
    "image" "text" DEFAULT ''::"text",
    "alt" "text" DEFAULT ''::"text",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."loyalty_rewards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."map_refuges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "lat" numeric(10,7) NOT NULL,
    "lng" numeric(10,7) NOT NULL,
    "altitude_m" integer,
    "capacity" integer,
    "is_staffed" boolean DEFAULT false,
    "open_months" "text"[],
    "phone" "text",
    "website" "text",
    "price_per_night" numeric(8,2),
    "has_meals" boolean DEFAULT false,
    "has_blankets" boolean DEFAULT false,
    "region" "text",
    "country" "text" DEFAULT 'France'::"text",
    "tags" "text"[] DEFAULT ARRAY[]::"text"[],
    "is_verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."map_refuges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."map_summits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "lat" numeric(10,7) NOT NULL,
    "lng" numeric(10,7) NOT NULL,
    "altitude_m" integer NOT NULL,
    "prominence_m" integer,
    "difficulty" "text" DEFAULT 'moderate'::"text",
    "best_season" "text"[],
    "region" "text",
    "country" "text" DEFAULT 'France'::"text",
    "massif" "text",
    "tags" "text"[] DEFAULT ARRAY[]::"text"[],
    "is_verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "map_summits_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['easy'::"text", 'moderate'::"text", 'hard'::"text", 'expert'::"text", 'technical'::"text"])))
);


ALTER TABLE "public"."map_summits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."map_water_points" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "description" "text",
    "lat" numeric(10,7) NOT NULL,
    "lng" numeric(10,7) NOT NULL,
    "altitude_m" integer,
    "water_type" "text" DEFAULT 'spring'::"text",
    "is_potable" boolean DEFAULT true,
    "is_seasonal" boolean DEFAULT false,
    "season_start" "text",
    "season_end" "text",
    "flow_rate" "text",
    "region" "text",
    "country" "text" DEFAULT 'France'::"text",
    "is_verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "map_water_points_water_type_check" CHECK (("water_type" = ANY (ARRAY['spring'::"text", 'stream'::"text", 'lake'::"text", 'fountain'::"text", 'river'::"text", 'well'::"text"])))
);


ALTER TABLE "public"."map_water_points" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."materiel_history" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "entity_name" "text",
    "payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "materiel_history_action_type_check" CHECK (("action_type" = ANY (ARRAY['added'::"text", 'updated'::"text", 'deleted'::"text", 'restored'::"text", 'loan_created'::"text", 'loan_returned'::"text", 'order_received'::"text", 'kit_created'::"text", 'kit_updated'::"text", 'kit_deleted'::"text", 'kit_restored'::"text"]))),
    CONSTRAINT "materiel_history_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['gear_item'::"text", 'kit'::"text", 'order'::"text"])))
);


ALTER TABLE "public"."materiel_history" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."materiel_history_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."materiel_history_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."materiel_history_id_seq" OWNED BY "public"."materiel_history"."id";



CREATE TABLE IF NOT EXISTS "public"."materiel_kit_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kit_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "materiel_kit_history_action_check" CHECK (("action" = ANY (ARRAY['created'::"text", 'updated'::"text", 'deleted'::"text", 'restored'::"text", 'forked'::"text", 'optimized'::"text", 'compared'::"text"])))
);


ALTER TABLE "public"."materiel_kit_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."materiel_loans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_ownership_id" "uuid" NOT NULL,
    "lender_id" "uuid" NOT NULL,
    "borrower_id" "uuid",
    "borrower_contact" "text",
    "status" "text" DEFAULT 'en_cours'::"text" NOT NULL,
    "loaned_at" "date" DEFAULT CURRENT_DATE NOT NULL,
    "due_date" "date",
    "returned_at" "date",
    "contract_pdf_url" "text",
    "lender_rating" numeric(2,1),
    "borrower_rating" numeric(2,1),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "materiel_loans_status_check" CHECK (("status" = ANY (ARRAY['en_cours'::"text", 'rendu'::"text", 'en_retard'::"text", 'litige'::"text"])))
);


ALTER TABLE "public"."materiel_loans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_name" "text",
    "file_type" "text",
    "file_size" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "message_attachments_file_size_check" CHECK (("file_size" > 0))
);


ALTER TABLE "public"."message_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_mentions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "mentioned_user_id" "uuid" NOT NULL,
    "mention_position" integer,
    "is_read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "message_mentions_mention_position_check" CHECK (("mention_position" >= 0))
);


ALTER TABLE "public"."message_mentions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reaction_type" "text" DEFAULT 'emoji'::"text",
    "reaction_value" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "message_reactions_reaction_type_check" CHECK (("reaction_type" = ANY (ARRAY['emoji'::"text", 'text'::"text"])))
);


ALTER TABLE "public"."message_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "type" "text" DEFAULT 'text'::"text",
    "gps_lat" double precision,
    "gps_lng" double precision,
    "gps_label" "text",
    "gps_expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "message_type" "text" DEFAULT 'text'::"text",
    "reply_to_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "deleted_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "messages_type_check" CHECK (("type" = ANY (ARRAY['text'::"text", 'gps'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."moderation_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid",
    "type" "text" DEFAULT 'occasion_listing'::"text" NOT NULL,
    "statut" "text" DEFAULT 'en_attente'::"text" NOT NULL,
    "soumis_par" "uuid",
    "soumis_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "traite_par" "uuid",
    "traite_at" timestamp with time zone,
    "notes" "text",
    "ai_coherence_score" integer,
    "ai_flags" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."moderation_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "notification_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "provider_response" "jsonb",
    "attempted_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_deliveries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "user_id" "uuid" NOT NULL,
    "notification_type" "text" NOT NULL,
    "in_app_enabled" boolean DEFAULT true NOT NULL,
    "email_enabled" boolean DEFAULT true NOT NULL,
    "push_enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text",
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "actor_id" "uuid",
    "related_type" "text",
    "related_id" "uuid",
    "link" "text",
    "read_at" timestamp with time zone,
    "channels_sent" "jsonb" DEFAULT '[]'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."occasion_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "seller_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "price" numeric(10,2) DEFAULT 0,
    "original_price" numeric(10,2) DEFAULT 0,
    "condition" "text" DEFAULT 'bon'::"text",
    "location" "text" DEFAULT ''::"text",
    "image" "text" DEFAULT ''::"text",
    "alt" "text" DEFAULT ''::"text",
    "negotiable" boolean DEFAULT false,
    "shipping" boolean DEFAULT false,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "gear_item_id" "uuid",
    "buyer_id" "uuid",
    "sold_at" timestamp with time zone,
    "payout_released_at" timestamp with time zone
);


ALTER TABLE "public"."occasion_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."occasion_offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "occasion_item_id" "uuid" NOT NULL,
    "buyer_id" "uuid" NOT NULL,
    "offered_price" numeric NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "occasion_offers_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text", 'withdrawn'::"text"])))
);


ALTER TABLE "public"."occasion_offers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "product_slug" "text" DEFAULT ''::"text" NOT NULL,
    "product_name" "text" DEFAULT ''::"text" NOT NULL,
    "product_brand" "text" DEFAULT ''::"text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price_eur" numeric DEFAULT 0 NOT NULL,
    "total_price_eur" numeric DEFAULT 0 NOT NULL,
    "transaction_type" "text" DEFAULT 'achat'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "received_at" timestamp with time zone
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "order_number" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payment_method" "text" DEFAULT 'card'::"text" NOT NULL,
    "shipping_address" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "subtotal_eur" numeric DEFAULT 0 NOT NULL,
    "shipping_eur" numeric DEFAULT 0 NOT NULL,
    "total_eur" numeric DEFAULT 0 NOT NULL,
    "loyalty_points_earned" integer DEFAULT 0 NOT NULL,
    "notes" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "stripe_session_id" "text"
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."outdoor_points" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "osm_id" bigint,
    "category" "text" NOT NULL,
    "name" "text",
    "description" "text",
    "lat" numeric(10,7) NOT NULL,
    "lng" numeric(10,7) NOT NULL,
    "altitude" integer,
    "country" "text",
    "region" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "source" "text" DEFAULT 'manual'::"text",
    "synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "outdoor_points_category_check" CHECK (("category" = ANY (ARRAY['refuge'::"text", 'water'::"text", 'summit'::"text", 'camping'::"text", 'waterfall'::"text", 'viewpoint'::"text", 'cave'::"text", 'forest'::"text", 'col'::"text", 'lake'::"text", 'spring'::"text"])))
);


ALTER TABLE "public"."outdoor_points" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."overpass_sync_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sync_type" "text" NOT NULL,
    "bbox" "text",
    "country" "text",
    "region" "text",
    "records_fetched" integer DEFAULT 0,
    "records_inserted" integer DEFAULT 0,
    "status" "text" DEFAULT 'pending'::"text",
    "error_message" "text",
    "started_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "completed_at" timestamp with time zone,
    CONSTRAINT "overpass_sync_log_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'running'::"text", 'success'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."overpass_sync_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pending_contributions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "target_id" "uuid",
    "target_type" "text" NOT NULL,
    "base_points" integer NOT NULL,
    "quality_score" numeric(3,2) DEFAULT 1.00,
    "trust_score" integer DEFAULT 50,
    "final_points" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "rejection_reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "validated_at" timestamp with time zone,
    CONSTRAINT "pending_contributions_action_type_check" CHECK (("action_type" = ANY (ARRAY['like'::"text", 'comment'::"text", 'post'::"text", 'carnet'::"text", 'group_message'::"text", 'guide_contribution'::"text", 'referral'::"text", 'checklist'::"text", 'info_correction'::"text"]))),
    CONSTRAINT "pending_contributions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'reversed'::"text"])))
);


ALTER TABLE "public"."pending_contributions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."place_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "place_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "caption" "text",
    "has_exif_stripped" boolean DEFAULT true NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."place_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."place_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "place_id" "uuid" NOT NULL,
    "reporter_id" "uuid",
    "reason" "text" NOT NULL,
    "details" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "place_reports_reason_check" CHECK (("reason" = ANY (ARRAY['overcrowding'::"text", 'environmental_damage'::"text", 'safety_hazard'::"text", 'inaccurate_info'::"text", 'private_property'::"text", 'other'::"text"]))),
    CONSTRAINT "place_reports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewed'::"text", 'resolved'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."place_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."place_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "place_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "comment" "text" NOT NULL,
    "has_field_proof" boolean DEFAULT false NOT NULL,
    "visit_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "trip_id" "uuid",
    CONSTRAINT "place_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."place_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."places" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "country_code" "text" NOT NULL,
    "region" "text",
    "city" "text",
    "latitude" numeric(10,7) NOT NULL,
    "longitude" numeric(10,7) NOT NULL,
    "geom" "public"."geography"(Point,4326),
    "altitude_m" integer,
    "description" "text",
    "sensitivity" "text" DEFAULT 'standard'::"text" NOT NULL,
    "source" "text" DEFAULT 'curated'::"text" NOT NULL,
    "osm_id" "text",
    "author_id" "uuid",
    "is_verified" boolean DEFAULT false NOT NULL,
    "practical_info" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "bayesian_rating" numeric(3,2) DEFAULT 0.0 NOT NULL,
    "reviews_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "places_category_check" CHECK (("category" = ANY (ARRAY['refuge'::"text", 'bivouac'::"text", 'water_source'::"text", 'viewpoint'::"text", 'pass'::"text", 'campground'::"text", 'poi'::"text", 'summit'::"text", 'lake'::"text", 'cave'::"text", 'historical'::"text"]))),
    CONSTRAINT "places_sensitivity_check" CHECK (("sensitivity" = ANY (ARRAY['standard'::"text", 'sensitive'::"text", 'protected'::"text"]))),
    CONSTRAINT "places_source_check" CHECK (("source" = ANY (ARRAY['curated'::"text", 'community'::"text", 'osm'::"text"])))
);


ALTER TABLE "public"."places" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."places_geo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_region_id" "uuid",
    "name" "text" NOT NULL,
    "feature_code" "text",
    "geometry" "public"."geometry"(Point,4326),
    "elevation" integer,
    "population" integer,
    "timezone" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "geoname_id" bigint,
    "country_iso_a2" "text",
    "feature_class" "public"."geo_feature_class",
    "latitude" double precision,
    "longitude" double precision,
    "name_ascii" "text",
    "population_rank" integer,
    "is_capital" boolean DEFAULT false NOT NULL,
    "is_major_city" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "admin1_code" "text",
    "admin2_code" "text",
    "admin3_code" "text",
    "admin4_code" "text"
);


ALTER TABLE "public"."places_geo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid",
    "author_id" "uuid",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "parent_id" "uuid"
);


ALTER TABLE "public"."post_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."post_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_alternatives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "original_product_id" "text" NOT NULL,
    "substitute_product_id" "text" NOT NULL,
    "priority" integer DEFAULT 1,
    "reason" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_alternatives" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_compatibilities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id_1" "text" NOT NULL,
    "product_id_2" "text" NOT NULL,
    "relation_type" "text" DEFAULT 'compatible_with'::"text" NOT NULL,
    "notes" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_compatibilities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "storage_path" "text" DEFAULT ''::"text" NOT NULL,
    "url" "text" DEFAULT ''::"text" NOT NULL,
    "alt" "text" DEFAULT ''::"text",
    "is_primary" boolean DEFAULT false,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_ownership" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "brand" "text",
    "category" "text",
    "weight_g" integer,
    "price_cents" integer,
    "purchase_date" "date",
    "condition" "text",
    "photo_url" "text",
    "barcode" "text",
    "is_lent" boolean DEFAULT false NOT NULL,
    "maintenance_due_at" "date",
    "expiry_date" "date",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "search_vector" "tsvector",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "product_ownership_condition_check" CHECK (("condition" = ANY (ARRAY['neuf'::"text", 'bon'::"text", 'use'::"text", 'a_remplacer'::"text", 'pour_pieces'::"text"]))),
    CONSTRAINT "product_ownership_quantity_check" CHECK (("quantity" >= 1))
);


ALTER TABLE "public"."product_ownership" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid",
    "author_id" "uuid",
    "rating" integer DEFAULT 5,
    "title" "text" DEFAULT ''::"text",
    "content" "text" DEFAULT ''::"text",
    "verified_purchase" boolean DEFAULT false,
    "helpful_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."product_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "brand" "text",
    "category" "text",
    "price_eur" numeric DEFAULT 0,
    "weight_g" numeric DEFAULT 0,
    "description" "text",
    "image" "text",
    "image_alt" "text",
    "stock" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promo_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "discount_pct" numeric,
    "max_uses" integer,
    "uses" integer DEFAULT 0,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "ambassador_id" "uuid",
    "revenue" numeric(10,2) DEFAULT 0,
    "status" "text" DEFAULT 'active'::"text"
);


ALTER TABLE "public"."promo_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subscription" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."qa_answers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question_id" "uuid",
    "author_id" "uuid",
    "content" "text" NOT NULL,
    "votes_count" integer DEFAULT 0,
    "is_accepted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."qa_answers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."qa_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid",
    "title" "text" NOT NULL,
    "content" "text" DEFAULT ''::"text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "category" "text" DEFAULT 'Général'::"text",
    "votes_count" integer DEFAULT 0,
    "answers_count" integer DEFAULT 0,
    "views_count" integer DEFAULT 0,
    "is_solved" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."qa_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."qa_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "target_type" "text",
    "target_id" "uuid",
    "vote" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "qa_votes_target_type_check" CHECK (("target_type" = ANY (ARRAY['question'::"text", 'answer'::"text"]))),
    CONSTRAINT "qa_votes_vote_check" CHECK (("vote" = ANY (ARRAY[1, '-1'::integer])))
);


ALTER TABLE "public"."qa_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rental_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "price_per_day" numeric(10,2) DEFAULT 0,
    "price_per_week" numeric(10,2) DEFAULT 0,
    "deposit" numeric(10,2) DEFAULT 0,
    "condition" "text" DEFAULT 'excellent'::"text",
    "location" "text" DEFAULT ''::"text",
    "image" "text" DEFAULT ''::"text",
    "alt" "text" DEFAULT ''::"text",
    "available" boolean DEFAULT true,
    "available_from" "date",
    "available_to" "date",
    "rating" numeric(3,1) DEFAULT 0,
    "reviews_count" integer DEFAULT 0,
    "status" "text" DEFAULT 'available'::"text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."rental_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_helpful_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."review_helpful_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "target_name" "text" NOT NULL,
    "rating" integer NOT NULL,
    "title" "text",
    "comment" "text",
    "verified" boolean DEFAULT false,
    "helpful_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "reviews_type_check" CHECK (("type" = ANY (ARRAY['produit'::"text", 'kit'::"text", 'location'::"text", 'occasion'::"text"])))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reward_accounts" (
    "user_id" "uuid" NOT NULL,
    "available_points" integer DEFAULT 0,
    "pending_points" integer DEFAULT 0,
    "invalid_points" integer DEFAULT 0,
    "lifetime_points" integer DEFAULT 0,
    "eligible_points" integer DEFAULT 0,
    "earned_this_period" integer DEFAULT 0,
    "redeemed_points" integer DEFAULT 0,
    "available_cash" numeric(12,2) DEFAULT 0.00,
    "pending_cash" numeric(12,2) DEFAULT 0.00,
    "status" "text" DEFAULT 'active'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reward_accounts_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'suspended'::"text", 'limited'::"text", 'suspect'::"text"])))
);


ALTER TABLE "public"."reward_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reward_config" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid"
);


ALTER TABLE "public"."reward_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reward_periods" (
    "id" "text" NOT NULL,
    "start_date" timestamp with time zone NOT NULL,
    "end_date" timestamp with time zone NOT NULL,
    "eligible_revenue" numeric(12,2) DEFAULT 0.00,
    "reward_pool" numeric(12,2) DEFAULT 0.00,
    "total_valid_points" integer DEFAULT 0,
    "point_weight" numeric(20,8) DEFAULT 0.00000000,
    "distributed_amount" numeric(12,2) DEFAULT 0.00,
    "remaining_amount" numeric(12,2) DEFAULT 0.00,
    "status" "text" DEFAULT 'OPEN'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reward_periods_status_check" CHECK (("status" = ANY (ARRAY['OPEN'::"text", 'CALCULATING'::"text", 'FINALIZED'::"text", 'DISTRIBUTING'::"text", 'CLOSED'::"text"])))
);


ALTER TABLE "public"."reward_periods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reward_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "points" integer NOT NULL,
    "transaction_type" "text" NOT NULL,
    "reference_id" "uuid",
    "reference_type" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reward_transactions_transaction_type_check" CHECK (("transaction_type" = ANY (ARRAY['LIKE_REWARD'::"text", 'COMMENT_REWARD'::"text", 'POST_REWARD'::"text", 'JOURNAL_REWARD'::"text", 'GROUP_REWARD'::"text", 'QUALITY_BONUS'::"text", 'FRAUD_REVERSAL'::"text", 'ADMIN_ADJUSTMENT'::"text", 'REDEMPTION'::"text", 'EXPIRATION'::"text", 'REFERRAL_REWARD'::"text"])))
);


ALTER TABLE "public"."reward_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reward_withdrawals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "points_redeemed" integer NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text",
    "reward_period" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "payment_provider" "text" DEFAULT 'bank_transfer'::"text" NOT NULL,
    "payment_reference" "text",
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "reviewed_at" timestamp with time zone,
    "processed_at" timestamp with time zone,
    "rejection_reason" "text",
    "risk_score" integer DEFAULT 0,
    "idempotency_key" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "reward_withdrawals_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "reward_withdrawals_points_redeemed_check" CHECK (("points_redeemed" >= 0)),
    CONSTRAINT "reward_withdrawals_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'under_review'::"text", 'approved'::"text", 'processing'::"text", 'paid'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."reward_withdrawals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_adventures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "adventure_data" "jsonb" NOT NULL,
    "map_context" "jsonb",
    "trail_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[],
    "refuge_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[],
    "summit_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[],
    "duration_days" integer,
    "difficulty" "text",
    "region" "text",
    "is_public" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."saved_adventures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_trails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "trail_id" "text" NOT NULL,
    "trail_name" "text",
    "trail_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."saved_trails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."share_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "kit_id" "uuid" NOT NULL,
    "owner_id" "uuid",
    "permission" "text" DEFAULT 'read'::"text" NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_accessed_at" timestamp with time zone,
    CONSTRAINT "share_tokens_permission_check" CHECK (("permission" = ANY (ARRAY['read'::"text", 'fork'::"text", 'edit'::"text"])))
);


ALTER TABLE "public"."share_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "brand" "text" DEFAULT ''::"text" NOT NULL,
    "category" "text" DEFAULT ''::"text" NOT NULL,
    "weight_g" integer DEFAULT 0 NOT NULL,
    "price_eur" numeric(10,2) DEFAULT 0 NOT NULL,
    "image" "text" DEFAULT ''::"text" NOT NULL,
    "image_alt" "text" DEFAULT ''::"text" NOT NULL,
    "rating" numeric(3,1) DEFAULT 0 NOT NULL,
    "review_count" integer DEFAULT 0 NOT NULL,
    "available" boolean DEFAULT true NOT NULL,
    "price_per_day" numeric(10,2),
    "original_price" numeric(10,2),
    "condition" "text",
    "starting_bid" numeric(10,2),
    "ends_at" timestamp with time zone,
    "savings" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "product_id" "text",
    "model" "text" DEFAULT ''::"text",
    "category_main" "text" DEFAULT ''::"text",
    "category_sub" "text" DEFAULT ''::"text",
    "weight_grams" integer DEFAULT 0,
    "dimensions" "text" DEFAULT ''::"text",
    "materials" "text" DEFAULT ''::"text",
    "warranty" "text" DEFAULT ''::"text",
    "description_why" "text" DEFAULT ''::"text",
    "advantages_array" "jsonb" DEFAULT '[]'::"jsonb",
    "disadvantages_array" "jsonb" DEFAULT '[]'::"jsonb",
    "alt_premium_id" "text",
    "alt_budget_id" "text",
    "available_europe" boolean DEFAULT true,
    "available_usa" boolean DEFAULT true,
    "score_quality" numeric(4,1) DEFAULT 0,
    "score_price" numeric(4,1) DEFAULT 0,
    "score_durability" numeric(4,1) DEFAULT 0,
    "source_review" "text" DEFAULT ''::"text",
    "score_kdv" integer DEFAULT 0,
    "essentiality" "text" DEFAULT 'Recommandé'::"text",
    "versatility_10" numeric(4,1) DEFAULT 0,
    "cabin_compatible" boolean DEFAULT false,
    "repairability_10" numeric(4,1) DEFAULT 0,
    "travel_types_array" "jsonb" DEFAULT '[]'::"jsonb",
    "climates_array" "jsonb" DEFAULT '[]'::"jsonb",
    "justification_ai" "text" DEFAULT ''::"text",
    "import_date" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "stock" integer DEFAULT 0,
    "transaction_type" "public"."shop_transaction_type" DEFAULT 'achat'::"public"."shop_transaction_type" NOT NULL,
    "cost_price_eur" numeric DEFAULT 0,
    "min_stock" integer DEFAULT 2,
    "supplier" "text" DEFAULT 'BigBuy'::"text",
    "ean" "text" DEFAULT ''::"text",
    "tags" "jsonb" DEFAULT '[]'::"jsonb",
    "variants" "jsonb" DEFAULT '[]'::"jsonb",
    "meta_title" "text" DEFAULT ''::"text",
    "meta_description" "text" DEFAULT ''::"text",
    "vat_rate" numeric DEFAULT 20
);


ALTER TABLE "public"."shop_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sos_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "latitude" numeric,
    "longitude" numeric,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sos_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid",
    "product_slug" "text" DEFAULT ''::"text" NOT NULL,
    "product_name" "text" DEFAULT ''::"text" NOT NULL,
    "movement_type" "text" NOT NULL,
    "quantity_change" integer NOT NULL,
    "quantity_before" integer DEFAULT 0 NOT NULL,
    "quantity_after" integer DEFAULT 0 NOT NULL,
    "reference_type" "text",
    "reference_id" "text",
    "user_id" "uuid",
    "notes" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."stock_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trail_pois" (
    "id" bigint NOT NULL,
    "osm_id" bigint,
    "category" "text",
    "name" "text",
    "description" "text",
    "tags" "jsonb",
    "geom" "public"."geometry"(Point,4326)
);


ALTER TABLE "public"."trail_pois" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trail_segments" (
    "id" bigint NOT NULL,
    "osm_id" bigint NOT NULL,
    "name" "text",
    "highway" "text",
    "sac_scale" "text",
    "surface" "text",
    "tags" "jsonb",
    "geom" "public"."geometry"(LineString,4326) NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."trail_segments" OWNER TO "postgres";


COMMENT ON TABLE "public"."trail_segments" IS 'Dense OSM hiking path network for map background layer. Populated via osm2pgsql flex import from france-latest.osm.pbf. Filter applied: highway IN (path,footway,track,bridleway) excluding sidewalks and residential areas.';



COMMENT ON COLUMN "public"."trail_segments"."tags" IS 'Full OSM tags as JSONB — allows post-import filtering without re-importing.';



CREATE SEQUENCE IF NOT EXISTS "public"."trail_segments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."trail_segments_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."trail_segments_id_seq" OWNED BY "public"."trail_segments"."id";



CREATE TABLE IF NOT EXISTS "public"."trails_raw_v1" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "description" "text",
    "difficulty" "text",
    "distance_km" numeric(8,2),
    "elevation_gain_m" integer,
    "region" "text",
    "country" "text" DEFAULT 'France'::"text",
    "tags" "text"[] DEFAULT ARRAY[]::"text"[],
    "geojson" "jsonb",
    "source" "text" DEFAULT 'trails_raw_v1_placeholder'::"text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "is_placeholder" boolean DEFAULT true
);


ALTER TABLE "public"."trails_raw_v1" OWNER TO "postgres";


COMMENT ON TABLE "public"."trails_raw_v1" IS 'Schema stub — original trails table was dropped in migration 20260717090000. Re-import raw OSM data here if needed before processing into trail_segments.';



CREATE TABLE IF NOT EXISTS "public"."travel_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "destination" "text",
    "theme" "text" DEFAULT 'Aventure'::"text",
    "cover_url" "text",
    "invite_code" "text" DEFAULT "upper"("substring"(("gen_random_uuid"())::"text", 1, 8)),
    "max_members" integer DEFAULT 20,
    "departure_date" "date",
    "return_date" "date",
    "budget_target" numeric(10,2) DEFAULT 0,
    "owner_id" "uuid",
    "group_level" integer DEFAULT 1,
    "group_xp" integer DEFAULT 0,
    "optimization_score" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "visibility" "public"."group_visibility" DEFAULT 'public'::"public"."group_visibility",
    "country_iso" "text",
    "min_trust_score" integer DEFAULT 50,
    "mixite" "text" DEFAULT 'all'::"text",
    "conversation_id" "uuid"
);


ALTER TABLE "public"."travel_groups" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."travel_groups_legacy" WITH ("security_invoker"='true') AS
 SELECT "id",
    "name",
    "description",
    NULL::"text" AS "destination",
    "theme",
    "cover_url",
    "visibility",
    "invite_code",
    "max_members",
    NULL::"date" AS "departure_date",
    NULL::"date" AS "return_date",
    (0)::numeric AS "budget_target",
    "created_by" AS "owner_id",
    "level" AS "group_level",
    "xp" AS "group_xp",
    0 AS "optimization_score",
    "created_at",
    "updated_at"
   FROM "public"."crews" "c";


ALTER VIEW "public"."travel_groups_legacy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_checklist_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "due_offset_days" integer DEFAULT 30 NOT NULL,
    "done" boolean DEFAULT false NOT NULL,
    "done_at" timestamp with time zone,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trip_checklist_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_collaborators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."trip_collaborator_role" DEFAULT 'viewer'::"public"."trip_collaborator_role" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trip_collaborators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_participants" (
    "trip_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "status" "text" DEFAULT 'confirmed'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trip_participants_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'organizer'::"text", 'member'::"text", 'guest'::"text"]))),
    CONSTRAINT "trip_participants_status_check" CHECK (("status" = ANY (ARRAY['invited'::"text", 'confirmed'::"text", 'declined'::"text", 'removed'::"text"])))
);


ALTER TABLE "public"."trip_participants" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."trip_collaborators_legacy" WITH ("security_invoker"='true') AS
 SELECT "trip_id",
    "user_id",
        CASE
            WHEN ("role" = 'owner'::"text") THEN 'owner'::"text"
            WHEN ("role" = 'organizer'::"text") THEN 'editor'::"text"
            ELSE 'viewer'::"text"
        END AS "role",
    NULL::"uuid" AS "invited_by",
    "joined_at",
    "joined_at" AS "created_at",
    "joined_at" AS "updated_at"
   FROM "public"."trip_participants" "tp";


ALTER VIEW "public"."trip_collaborators_legacy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "category" "public"."trip_document_category" DEFAULT 'other'::"public"."trip_document_category" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_name" "text",
    "file_size_bytes" bigint,
    "mime_type" "text",
    "expires_at" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trip_documents_file_size_bytes_check" CHECK ((("file_size_bytes" IS NULL) OR ("file_size_bytes" >= 0)))
);


ALTER TABLE "public"."trip_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "payer_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "currency" "public"."trip_budget_currency" DEFAULT 'EUR'::"public"."trip_budget_currency" NOT NULL,
    "category" "text",
    "expense_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "split_type" "text" DEFAULT 'equal'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_planned" boolean DEFAULT false NOT NULL,
    CONSTRAINT "trip_expenses_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "trip_expenses_split_type_check" CHECK (("split_type" = ANY (ARRAY['equal'::"text", 'custom'::"text", 'individual'::"text"])))
);


ALTER TABLE "public"."trip_expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "item_name" "text" NOT NULL,
    "category" "text",
    "quantity" integer DEFAULT 1 NOT NULL,
    "weight_grams" numeric(8,2),
    "is_packed" boolean DEFAULT false NOT NULL,
    "status" "public"."trip_item_status" DEFAULT 'needed'::"public"."trip_item_status" NOT NULL,
    "packed_by" "uuid",
    "inventory_item_id" "uuid",
    "affiliate_link_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" DEFAULT 'user'::"text",
    "shop_product_id" "uuid",
    "priority" "text" DEFAULT 'recommended'::"text",
    "is_vital" boolean DEFAULT false,
    "is_worn" boolean DEFAULT false,
    "is_consumable" boolean DEFAULT false,
    "notes" "text",
    "purchase_state" "text" DEFAULT 'needed'::"text" NOT NULL,
    "day_number" integer,
    CONSTRAINT "trip_items_day_number_check" CHECK ((("day_number" IS NULL) OR ("day_number" >= 1))),
    CONSTRAINT "trip_items_priority_check" CHECK (("priority" = ANY (ARRAY['vital'::"text", 'recommended'::"text", 'optional'::"text"]))),
    CONSTRAINT "trip_items_purchase_state_check" CHECK (("purchase_state" = ANY (ARRAY['needed'::"text", 'added'::"text", 'in_cart'::"text", 'shipping'::"text"]))),
    CONSTRAINT "trip_items_quantity_check" CHECK (("quantity" >= 1)),
    CONSTRAINT "trip_items_weight_grams_check" CHECK ((("weight_grams" IS NULL) OR ("weight_grams" >= (0)::numeric)))
);


ALTER TABLE "public"."trip_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."trip_items"."day_number" IS 'Jour du voyage pour lequel ce matériel est requis (roadbook) — NULL si voyage entier.';



CREATE TABLE IF NOT EXISTS "public"."trip_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "title" "text",
    "content" "text" NOT NULL,
    "day_number" integer,
    "is_pinned" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trip_notes_day_number_check" CHECK ((("day_number" IS NULL) OR ("day_number" >= 1)))
);


ALTER TABLE "public"."trip_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_pois" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "step_id" "uuid",
    "name" "text" NOT NULL,
    "category" "text",
    "latitude" numeric(10,7),
    "longitude" numeric(10,7),
    "notes" "text",
    "visited" boolean DEFAULT false NOT NULL,
    "osm_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trip_pois" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_safety_checkpoints" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "scheduled_at" timestamp with time zone NOT NULL,
    "checked_at" timestamp with time zone,
    "contact_phone" "text",
    "contact_name" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trip_safety_checkpoints_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'checked'::"text", 'missed'::"text", 'alert_sent'::"text"])))
);


ALTER TABLE "public"."trip_safety_checkpoints" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "day_number" integer NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "location_name" "text",
    "latitude" numeric(10,7),
    "longitude" numeric(10,7),
    "accommodation_name" "text",
    "transport_mode" "public"."trip_step_transport",
    "distance_km" numeric(6,2),
    "elevation_gain_m" integer,
    "elevation_loss_m" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "start_time" time without time zone,
    CONSTRAINT "trip_steps_day_number_check" CHECK (("day_number" >= 1)),
    CONSTRAINT "trip_steps_distance_km_check" CHECK ((("distance_km" IS NULL) OR ("distance_km" >= (0)::numeric))),
    CONSTRAINT "trip_steps_elevation_gain_m_check" CHECK ((("elevation_gain_m" IS NULL) OR ("elevation_gain_m" >= 0))),
    CONSTRAINT "trip_steps_elevation_loss_m_check" CHECK ((("elevation_loss_m" IS NULL) OR ("elevation_loss_m" >= 0))),
    CONSTRAINT "trip_steps_order_index_check" CHECK (("order_index" >= 0))
);


ALTER TABLE "public"."trip_steps" OWNER TO "postgres";


COMMENT ON COLUMN "public"."trip_steps"."start_time" IS 'Heure locale de passage/arrivée de l''étape (roadbook) — NULL si non planifiée.';



CREATE TABLE IF NOT EXISTS "public"."trips" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "destination_country_code" "text",
    "destination_name" "text",
    "start_date" "date",
    "end_date" "date",
    "status" "public"."trip_status" DEFAULT 'draft'::"public"."trip_status" NOT NULL,
    "visibility" "public"."trip_visibility" DEFAULT 'private'::"public"."trip_visibility" NOT NULL,
    "difficulty" "public"."trip_difficulty" DEFAULT 'moderate'::"public"."trip_difficulty" NOT NULL,
    "primary_activity" "public"."trip_activity_type" DEFAULT 'hiking'::"public"."trip_activity_type" NOT NULL,
    "estimated_budget" numeric(10,2),
    "budget_currency" "public"."trip_budget_currency" DEFAULT 'EUR'::"public"."trip_budget_currency" NOT NULL,
    "cover_image_url" "text",
    "user_id" "uuid" NOT NULL,
    "group_id" "uuid",
    "share_token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(16), 'hex'::"text"),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "crew_id" "uuid",
    "kit_id" "uuid",
    CONSTRAINT "chk_trips_budget" CHECK ((("estimated_budget" IS NULL) OR ("estimated_budget" >= (0)::numeric))),
    CONSTRAINT "chk_trips_dates" CHECK ((("end_date" IS NULL) OR ("start_date" IS NULL) OR ("end_date" >= "start_date"))),
    CONSTRAINT "chk_trips_slug" CHECK ((("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::"text") AND (("length"("slug") >= 3) AND ("length"("slug") <= 120))))
);


ALTER TABLE "public"."trips" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_addresses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "label" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "street" "text" NOT NULL,
    "city" "text" NOT NULL,
    "is_default" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_addresses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "badge_id" "uuid",
    "earned_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."user_badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "blocker_id" "uuid",
    "blocked_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "challenge_id" "uuid",
    "progress" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."user_challenges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" DEFAULT 'autre'::"text" NOT NULL,
    "destination" "text" DEFAULT ''::"text",
    "expiry" "date",
    "file_name" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."user_documents" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."user_field_signature" AS
 SELECT "hs"."user_id",
    "count"(*) AS "total_outings",
    "round"("sum"(COALESCE("hs"."distance_km", (0)::numeric)), 1) AS "total_km",
    "round"("sum"(COALESCE("hs"."elevation_gain_m", (0)::numeric)), 0) AS "total_dplus_m",
    "round"("max"(COALESCE("hs"."elevation_gain_m", (0)::numeric)), 0) AS "max_altitude_gain_m",
    "count"(DISTINCT "to_char"("hs"."started_at", 'YYYY-MM'::"text")) AS "distinct_months",
    "count"(DISTINCT "r"."region") AS "distinct_regions",
    "max"(GREATEST((1)::numeric, "ceil"((EXTRACT(epoch FROM ("hs"."ended_at" - "hs"."started_at")) / (86400)::numeric)))) AS "max_autonomy_days",
    COALESCE("round"((("count"(*) FILTER (WHERE ("hs"."route_id" IS NULL)))::numeric / (NULLIF("count"(*), 0))::numeric), 3), (0)::numeric) AS "off_trail_share"
   FROM ("public"."hike_sessions" "hs"
     LEFT JOIN "public"."hiking_routes" "r" ON (("r"."id" = "hs"."route_id")))
  GROUP BY "hs"."user_id"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."user_field_signature" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "follower_id" "uuid",
    "following_id" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."user_follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_orientation" (
    "user_id" "uuid" NOT NULL,
    "terrain" "text",
    "autonomy" "text",
    "priority" "text",
    "experience" "text",
    "source" "text" DEFAULT 'declared'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_orientation_autonomy_check" CHECK (("autonomy" = ANY (ARRAY['journee'::"text", 'bivouac_1_2'::"text", 'itinerance_longue'::"text"]))),
    CONSTRAINT "user_orientation_experience_check" CHECK (("experience" = ANY (ARRAY['debut'::"text", 'regulier'::"text", 'aguerri'::"text"]))),
    CONSTRAINT "user_orientation_priority_check" CHECK (("priority" = ANY (ARRAY['legerete'::"text", 'confort'::"text", 'budget'::"text", 'securite'::"text"]))),
    CONSTRAINT "user_orientation_source_check" CHECK (("source" = ANY (ARRAY['declared'::"text", 'inferred'::"text"]))),
    CONSTRAINT "user_orientation_terrain_check" CHECK (("terrain" = ANY (ARRAY['sentier'::"text", 'montagne'::"text", 'hors_sentier'::"text", 'itinerance'::"text", 'urbain_transit'::"text"])))
);


ALTER TABLE "public"."user_orientation" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_payment_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "brand" "text" NOT NULL,
    "last4" "text" NOT NULL,
    "holder_name" "text" NOT NULL,
    "expiry" "text" NOT NULL,
    "is_default" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_payment_methods" OWNER TO "postgres";


ALTER TABLE ONLY "public"."materiel_history" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."materiel_history_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."trail_segments" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."trail_segments_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_audit_logs"
    ADD CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_regions_geo"
    ADD CONSTRAINT "admin_regions_geo_geoname_id_key" UNIQUE ("geoname_id");



ALTER TABLE ONLY "public"."admin_regions_geo"
    ADD CONSTRAINT "admin_regions_geo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_roles"
    ADD CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."affiliate_clicks"
    ADD CONSTRAINT "affiliate_clicks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."affiliate_conversions"
    ADD CONSTRAINT "affiliate_conversions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."affiliate_links"
    ADD CONSTRAINT "affiliate_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."affiliate_links"
    ADD CONSTRAINT "affiliate_links_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."affiliate_offers"
    ADD CONSTRAINT "affiliate_offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."affiliate_partners"
    ADD CONSTRAINT "affiliate_partners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."affiliate_partners"
    ADD CONSTRAINT "affiliate_partners_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."affiliate_programs"
    ADD CONSTRAINT "affiliate_programs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_jobs"
    ADD CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_response_cache"
    ADD CONSTRAINT "ai_response_cache_pkey" PRIMARY KEY ("cache_key");



ALTER TABLE ONLY "public"."ai_usage_daily"
    ADD CONSTRAINT "ai_usage_daily_pkey" PRIMARY KEY ("user_id", "day");



ALTER TABLE ONLY "public"."alerts"
    ADD CONSTRAINT "alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ama_questions"
    ADD CONSTRAINT "ama_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ama_sessions"
    ADD CONSTRAINT "ama_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ama_votes"
    ADD CONSTRAINT "ama_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ambassadors"
    ADD CONSTRAINT "ambassadors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auction_auto_bids"
    ADD CONSTRAINT "auction_auto_bids_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auction_bids"
    ADD CONSTRAINT "auction_bids_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."badges"
    ADD CONSTRAINT "badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carnet_collaborators"
    ADD CONSTRAINT "carnet_collaborators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carnet_comments"
    ADD CONSTRAINT "carnet_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carnet_favorites"
    ADD CONSTRAINT "carnet_favorites_carnet_id_user_id_key" UNIQUE ("carnet_id", "user_id");



ALTER TABLE ONLY "public"."carnet_favorites"
    ADD CONSTRAINT "carnet_favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carnet_gear_links"
    ADD CONSTRAINT "carnet_gear_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carnet_kit_items"
    ADD CONSTRAINT "carnet_kit_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carnet_likes"
    ADD CONSTRAINT "carnet_likes_carnet_id_user_id_key" UNIQUE ("carnet_id", "user_id");



ALTER TABLE ONLY "public"."carnet_likes"
    ADD CONSTRAINT "carnet_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carnet_media"
    ADD CONSTRAINT "carnet_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carnet_moments"
    ADD CONSTRAINT "carnet_moments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carnet_views"
    ADD CONSTRAINT "carnet_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carnets"
    ADD CONSTRAINT "carnets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cart_loyalty_discounts"
    ADD CONSTRAINT "cart_loyalty_discounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cart_loyalty_discounts"
    ADD CONSTRAINT "cart_loyalty_discounts_user_id_product_id_key" UNIQUE ("user_id", "product_id");



ALTER TABLE ONLY "public"."challenges"
    ADD CONSTRAINT "challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checkout_intents"
    ADD CONSTRAINT "checkout_intents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_challenge_entries"
    ADD CONSTRAINT "club_challenge_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_challenges"
    ADD CONSTRAINT "club_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_event_participants"
    ADD CONSTRAINT "club_event_participants_pkey" PRIMARY KEY ("event_id", "user_id");



ALTER TABLE ONLY "public"."club_events"
    ADD CONSTRAINT "club_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_join_requests"
    ADD CONSTRAINT "club_join_requests_club_user_key" UNIQUE ("club_id", "user_id");



ALTER TABLE ONLY "public"."club_join_requests"
    ADD CONSTRAINT "club_join_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_recommended_kits"
    ADD CONSTRAINT "club_recommended_kits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_reports"
    ADD CONSTRAINT "club_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_topic_likes"
    ADD CONSTRAINT "club_topic_likes_pkey" PRIMARY KEY ("topic_id", "user_id");



ALTER TABLE ONLY "public"."club_topic_replies"
    ADD CONSTRAINT "club_topic_replies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_topics"
    ADD CONSTRAINT "club_topics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."comment_reports"
    ADD CONSTRAINT "comment_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_posts"
    ADD CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configurator_sessions"
    ADD CONSTRAINT "configurator_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_members"
    ADD CONSTRAINT "conversation_members_conversation_id_user_id_key" UNIQUE ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."conversation_members"
    ADD CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."countries_content"
    ADD CONSTRAINT "countries_content_country_iso_a2_key" UNIQUE ("country_iso_a2");



ALTER TABLE ONLY "public"."countries_content"
    ADD CONSTRAINT "countries_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."countries_content"
    ADD CONSTRAINT "countries_content_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."countries_geo"
    ADD CONSTRAINT "countries_geo_geoname_id_key" UNIQUE ("geoname_id");



ALTER TABLE ONLY "public"."countries_geo"
    ADD CONSTRAINT "countries_geo_iso_a2_key" UNIQUE ("iso_a2");



ALTER TABLE ONLY "public"."countries_geo"
    ADD CONSTRAINT "countries_geo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."country_content_blocks"
    ADD CONSTRAINT "country_content_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."country_practical_guides"
    ADD CONSTRAINT "country_practical_guides_country_code_section_key" UNIQUE ("country_code", "section");



ALTER TABLE ONLY "public"."country_practical_guides"
    ADD CONSTRAINT "country_practical_guides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."country_sync_log"
    ADD CONSTRAINT "country_sync_log_code_iso_key" UNIQUE ("code_iso");



ALTER TABLE ONLY "public"."country_sync_log"
    ADD CONSTRAINT "country_sync_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crew_members"
    ADD CONSTRAINT "crew_members_pkey" PRIMARY KEY ("crew_id", "user_id");



ALTER TABLE ONLY "public"."crews"
    ADD CONSTRAINT "crews_invite_code_key" UNIQUE ("invite_code");



ALTER TABLE ONLY "public"."crews"
    ADD CONSTRAINT "crews_legacy_group_id_key" UNIQUE ("legacy_group_id");



ALTER TABLE ONLY "public"."crews"
    ADD CONSTRAINT "crews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crews"
    ADD CONSTRAINT "crews_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."custom_kit_items"
    ADD CONSTRAINT "custom_kit_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_kits"
    ADD CONSTRAINT "custom_kits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."depart_participants"
    ADD CONSTRAINT "depart_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."destination_steps"
    ADD CONSTRAINT "destination_steps_natural_key_key" UNIQUE ("natural_key");



ALTER TABLE ONLY "public"."destination_steps"
    ADD CONSTRAINT "destination_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_expenses"
    ADD CONSTRAINT "event_expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_participants"
    ADD CONSTRAINT "event_participants_event_id_user_id_key" UNIQUE ("event_id", "user_id");



ALTER TABLE ONLY "public"."event_participants"
    ADD CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expedition_reports"
    ADD CONSTRAINT "expedition_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expert_bookings"
    ADD CONSTRAINT "expert_bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."experts"
    ADD CONSTRAINT "experts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gear_alert_history"
    ADD CONSTRAINT "gear_alert_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gear_history"
    ADD CONSTRAINT "gear_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gear_images"
    ADD CONSTRAINT "gear_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gear_items"
    ADD CONSTRAINT "gear_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_album"
    ADD CONSTRAINT "group_album_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_expenses"
    ADD CONSTRAINT "group_expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_invitations"
    ADD CONSTRAINT "group_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_invitations"
    ADD CONSTRAINT "group_invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."group_kit_items"
    ADD CONSTRAINT "group_kit_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_group_id_user_id_key" UNIQUE ("group_id", "user_id");



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_messages"
    ADD CONSTRAINT "group_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_poll_votes"
    ADD CONSTRAINT "group_poll_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_poll_votes"
    ADD CONSTRAINT "group_poll_votes_poll_id_user_id_key" UNIQUE ("poll_id", "user_id");



ALTER TABLE ONLY "public"."group_polls"
    ADD CONSTRAINT "group_polls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_reports"
    ADD CONSTRAINT "group_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_tasks"
    ADD CONSTRAINT "group_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groupe_activites"
    ADD CONSTRAINT "groupe_activites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groupe_depense_parts"
    ADD CONSTRAINT "groupe_depense_parts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groupe_depenses"
    ADD CONSTRAINT "groupe_depenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groupe_equipement"
    ADD CONSTRAINT "groupe_equipement_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groupe_etapes"
    ADD CONSTRAINT "groupe_etapes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groupe_hebergements"
    ADD CONSTRAINT "groupe_hebergements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groupe_membres"
    ADD CONSTRAINT "groupe_membres_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groupe_messages"
    ADD CONSTRAINT "groupe_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groupe_taches"
    ADD CONSTRAINT "groupe_taches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groupe_vote_choix"
    ADD CONSTRAINT "groupe_vote_choix_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groupe_vote_choix"
    ADD CONSTRAINT "groupe_vote_choix_vote_id_membre_id_key" UNIQUE ("vote_id", "membre_id");



ALTER TABLE ONLY "public"."groupe_vote_options"
    ADD CONSTRAINT "groupe_vote_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groupe_votes"
    ADD CONSTRAINT "groupe_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groupes"
    ADD CONSTRAINT "groupes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guides"
    ADD CONSTRAINT "guides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guides"
    ADD CONSTRAINT "guides_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."hike_sessions"
    ADD CONSTRAINT "hike_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hiking_routes"
    ADD CONSTRAINT "hiking_routes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hub_telemetry"
    ADD CONSTRAINT "hub_telemetry_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_exports"
    ADD CONSTRAINT "inventory_exports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kit_export_logs"
    ADD CONSTRAINT "kit_export_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kit_field_reports"
    ADD CONSTRAINT "kit_field_reports_hike_session_id_item_key_key" UNIQUE ("hike_session_id", "item_key");



ALTER TABLE ONLY "public"."kit_field_reports"
    ADD CONSTRAINT "kit_field_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kit_items"
    ADD CONSTRAINT "kit_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kit_reports"
    ADD CONSTRAINT "kit_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kits"
    ADD CONSTRAINT "kits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kits"
    ADD CONSTRAINT "kits_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lkv_events"
    ADD CONSTRAINT "lkv_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loans"
    ADD CONSTRAINT "loans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_history"
    ADD CONSTRAINT "loyalty_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_redemptions"
    ADD CONSTRAINT "loyalty_redemptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_rewards"
    ADD CONSTRAINT "loyalty_rewards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."map_refuges"
    ADD CONSTRAINT "map_refuges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."map_summits"
    ADD CONSTRAINT "map_summits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."map_water_points"
    ADD CONSTRAINT "map_water_points_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."materiel_history"
    ADD CONSTRAINT "materiel_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."materiel_kit_history"
    ADD CONSTRAINT "materiel_kit_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."materiel_kit_items"
    ADD CONSTRAINT "materiel_kit_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."materiel_kits"
    ADD CONSTRAINT "materiel_kits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."materiel_loans"
    ADD CONSTRAINT "materiel_loans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_attachments"
    ADD CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_mentions"
    ADD CONSTRAINT "message_mentions_message_id_mentioned_user_id_key" UNIQUE ("message_id", "mentioned_user_id");



ALTER TABLE ONLY "public"."message_mentions"
    ADD CONSTRAINT "message_mentions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_reactions"
    ADD CONSTRAINT "message_reactions_message_id_user_id_reaction_value_key" UNIQUE ("message_id", "user_id", "reaction_value");



ALTER TABLE ONLY "public"."message_reactions"
    ADD CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."moderation_queue"
    ADD CONSTRAINT "moderation_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_deliveries"
    ADD CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id", "notification_type");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."occasion_items"
    ADD CONSTRAINT "occasion_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."occasion_offers"
    ADD CONSTRAINT "occasion_offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outdoor_points"
    ADD CONSTRAINT "outdoor_points_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."overpass_sync_log"
    ADD CONSTRAINT "overpass_sync_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_contributions"
    ADD CONSTRAINT "pending_contributions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."place_photos"
    ADD CONSTRAINT "place_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."place_reports"
    ADD CONSTRAINT "place_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."place_reviews"
    ADD CONSTRAINT "place_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."places_geo"
    ADD CONSTRAINT "places_geo_geoname_id_key" UNIQUE ("geoname_id");



ALTER TABLE ONLY "public"."places_geo"
    ADD CONSTRAINT "places_geo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."places"
    ADD CONSTRAINT "places_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."places"
    ADD CONSTRAINT "places_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_alternatives"
    ADD CONSTRAINT "product_alternatives_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_compatibilities"
    ADD CONSTRAINT "product_compatibilities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_images"
    ADD CONSTRAINT "product_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_ownership"
    ADD CONSTRAINT "product_ownership_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."promo_codes"
    ADD CONSTRAINT "promo_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."promo_codes"
    ADD CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."qa_answers"
    ADD CONSTRAINT "qa_answers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."qa_questions"
    ADD CONSTRAINT "qa_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."qa_votes"
    ADD CONSTRAINT "qa_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rental_items"
    ADD CONSTRAINT "rental_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_helpful_votes"
    ADD CONSTRAINT "review_helpful_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_helpful_votes"
    ADD CONSTRAINT "review_helpful_votes_review_id_user_id_key" UNIQUE ("review_id", "user_id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reward_accounts"
    ADD CONSTRAINT "reward_accounts_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."reward_config"
    ADD CONSTRAINT "reward_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."reward_periods"
    ADD CONSTRAINT "reward_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reward_transactions"
    ADD CONSTRAINT "reward_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reward_withdrawals"
    ADD CONSTRAINT "reward_withdrawals_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."reward_withdrawals"
    ADD CONSTRAINT "reward_withdrawals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_adventures"
    ADD CONSTRAINT "saved_adventures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_trails"
    ADD CONSTRAINT "saved_trails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."share_tokens"
    ADD CONSTRAINT "share_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."share_tokens"
    ADD CONSTRAINT "share_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."shop_products"
    ADD CONSTRAINT "shop_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_products"
    ADD CONSTRAINT "shop_products_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."sos_alerts"
    ADD CONSTRAINT "sos_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trail_metadata"
    ADD CONSTRAINT "trail_metadata_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trail_pois"
    ADD CONSTRAINT "trail_pois_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trail_scores"
    ADD CONSTRAINT "trail_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trail_segments"
    ADD CONSTRAINT "trail_segments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trails_raw_v1"
    ADD CONSTRAINT "trails_raw_v1_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."travel_groups"
    ADD CONSTRAINT "travel_groups_conversation_id_key" UNIQUE ("conversation_id");



ALTER TABLE ONLY "public"."travel_groups"
    ADD CONSTRAINT "travel_groups_invite_code_key" UNIQUE ("invite_code");



ALTER TABLE ONLY "public"."travel_groups"
    ADD CONSTRAINT "travel_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_checklist_items"
    ADD CONSTRAINT "trip_checklist_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_collaborators"
    ADD CONSTRAINT "trip_collaborators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_collaborators"
    ADD CONSTRAINT "trip_collaborators_trip_id_user_id_key" UNIQUE ("trip_id", "user_id");



ALTER TABLE ONLY "public"."trip_documents"
    ADD CONSTRAINT "trip_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_expenses"
    ADD CONSTRAINT "trip_expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_items"
    ADD CONSTRAINT "trip_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_notes"
    ADD CONSTRAINT "trip_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_participants"
    ADD CONSTRAINT "trip_participants_pkey" PRIMARY KEY ("trip_id", "user_id");



ALTER TABLE ONLY "public"."trip_pois"
    ADD CONSTRAINT "trip_pois_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_safety_checkpoints"
    ADD CONSTRAINT "trip_safety_checkpoints_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_steps"
    ADD CONSTRAINT "trip_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_steps"
    ADD CONSTRAINT "trip_steps_trip_id_day_number_order_index_key" UNIQUE ("trip_id", "day_number", "order_index");



ALTER TABLE ONLY "public"."trips"
    ADD CONSTRAINT "trips_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trips"
    ADD CONSTRAINT "trips_share_token_key" UNIQUE ("share_token");



ALTER TABLE ONLY "public"."trips"
    ADD CONSTRAINT "trips_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "unique_user_badge" UNIQUE ("user_id", "badge_id");



ALTER TABLE ONLY "public"."country_content_blocks"
    ADD CONSTRAINT "uq_country_content_blocks" UNIQUE ("country_code", "block_type");



ALTER TABLE ONLY "public"."place_reviews"
    ADD CONSTRAINT "uq_place_reviews_place_author" UNIQUE ("place_id", "author_id");



ALTER TABLE ONLY "public"."user_addresses"
    ADD CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocker_id_blocked_id_key" UNIQUE ("blocker_id", "blocked_id");



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_challenges"
    ADD CONSTRAINT "user_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_documents"
    ADD CONSTRAINT "user_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_orientation"
    ADD CONSTRAINT "user_orientation_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_payment_methods"
    ADD CONSTRAINT "user_payment_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_admin_audit_log_admin_id" ON "public"."admin_audit_log" USING "btree" ("admin_id");



CREATE INDEX "idx_admin_audit_log_created_at" ON "public"."admin_audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_admin_regions_geo_admin1_code_full" ON "public"."admin_regions_geo" USING "btree" ("admin1_code_full");



CREATE INDEX "idx_admin_regions_geo_admin_code" ON "public"."admin_regions_geo" USING "btree" ("admin_code");



CREATE INDEX "idx_admin_regions_geo_admin_code_full" ON "public"."admin_regions_geo" USING "btree" ("admin_code_full");



CREATE INDEX "idx_admin_regions_geo_country_iso" ON "public"."admin_regions_geo" USING "btree" ("country_iso_a2");



CREATE INDEX "idx_admin_regions_geo_geom" ON "public"."admin_regions_geo" USING "gist" ("geometry");



CREATE INDEX "idx_admin_regions_geo_geoname_id" ON "public"."admin_regions_geo" USING "btree" ("geoname_id");



CREATE INDEX "idx_admin_regions_geo_name" ON "public"."admin_regions_geo" USING "gin" ("to_tsvector"('"simple"'::"regconfig", "name"));



CREATE INDEX "idx_admin_regions_geo_name_trgm" ON "public"."admin_regions_geo" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE UNIQUE INDEX "idx_admin_roles_unique_user" ON "public"."admin_roles" USING "btree" ("user_id");



CREATE INDEX "idx_admin_roles_user_id" ON "public"."admin_roles" USING "btree" ("user_id");



CREATE INDEX "idx_affiliate_clicks_created" ON "public"."affiliate_clicks" USING "btree" ("created_at");



CREATE INDEX "idx_affiliate_clicks_link" ON "public"."affiliate_clicks" USING "btree" ("link_id");



CREATE INDEX "idx_affiliate_clicks_offer" ON "public"."affiliate_clicks" USING "btree" ("offer_id");



CREATE INDEX "idx_affiliate_clicks_page" ON "public"."affiliate_clicks" USING "btree" ("page");



CREATE INDEX "idx_affiliate_clicks_partner" ON "public"."affiliate_clicks" USING "btree" ("partner_id");



CREATE INDEX "idx_affiliate_clicks_user" ON "public"."affiliate_clicks" USING "btree" ("user_id");



CREATE INDEX "idx_affiliate_conversions_offer" ON "public"."affiliate_conversions" USING "btree" ("offer_id");



CREATE INDEX "idx_affiliate_conversions_partner" ON "public"."affiliate_conversions" USING "btree" ("partner_id");



CREATE INDEX "idx_affiliate_conversions_status" ON "public"."affiliate_conversions" USING "btree" ("status");



CREATE INDEX "idx_affiliate_conversions_sub_id" ON "public"."affiliate_conversions" USING "btree" ("external_sub_id");



CREATE INDEX "idx_affiliate_links_category" ON "public"."affiliate_links" USING "btree" ("category");



CREATE INDEX "idx_affiliate_links_country" ON "public"."affiliate_links" USING "btree" ("country_code");



CREATE INDEX "idx_affiliate_links_partner" ON "public"."affiliate_links" USING "btree" ("partner_id");



CREATE INDEX "idx_affiliate_offers_category" ON "public"."affiliate_offers" USING "btree" ("category");



CREATE INDEX "idx_affiliate_offers_country" ON "public"."affiliate_offers" USING "btree" ("country");



CREATE INDEX "idx_affiliate_offers_priority" ON "public"."affiliate_offers" USING "btree" ("priority");



CREATE INDEX "idx_affiliate_offers_program" ON "public"."affiliate_offers" USING "btree" ("program_id");



CREATE INDEX "idx_affiliate_partners_active" ON "public"."affiliate_partners" USING "btree" ("is_active");



CREATE INDEX "idx_affiliate_partners_slug" ON "public"."affiliate_partners" USING "btree" ("slug");



CREATE INDEX "idx_affiliate_programs_partner" ON "public"."affiliate_programs" USING "btree" ("partner_id");



CREATE INDEX "idx_affiliate_programs_status" ON "public"."affiliate_programs" USING "btree" ("status");



CREATE INDEX "idx_ai_jobs_status_created" ON "public"."ai_jobs" USING "btree" ("status", "created_at");



CREATE INDEX "idx_ai_response_cache_expires_at" ON "public"."ai_response_cache" USING "btree" ("expires_at");



CREATE INDEX "idx_alerts_unresolved" ON "public"."alerts" USING "btree" ("user_id", "is_resolved") WHERE ("is_resolved" = false);



CREATE INDEX "idx_alerts_user_id" ON "public"."alerts" USING "btree" ("user_id");



CREATE INDEX "idx_alt_original" ON "public"."product_alternatives" USING "btree" ("original_product_id");



CREATE INDEX "idx_ama_questions_author" ON "public"."ama_questions" USING "btree" ("author_id");



CREATE INDEX "idx_ama_questions_session" ON "public"."ama_questions" USING "btree" ("session_id");



CREATE INDEX "idx_ama_sessions_expert" ON "public"."ama_sessions" USING "btree" ("expert_id");



CREATE UNIQUE INDEX "idx_ama_votes_unique" ON "public"."ama_votes" USING "btree" ("question_id", "user_id");



CREATE UNIQUE INDEX "idx_ambassadors_promo_code" ON "public"."ambassadors" USING "btree" ("promo_code");



CREATE INDEX "idx_auction_auto_bids_bidder_id" ON "public"."auction_auto_bids" USING "btree" ("bidder_id");



CREATE INDEX "idx_auction_auto_bids_listing_id" ON "public"."auction_auto_bids" USING "btree" ("listing_id");



CREATE UNIQUE INDEX "idx_auction_auto_bids_unique_active" ON "public"."auction_auto_bids" USING "btree" ("listing_id", "bidder_id") WHERE ("actif" = true);



CREATE INDEX "idx_auction_bids_bidder_id" ON "public"."auction_bids" USING "btree" ("bidder_id");



CREATE INDEX "idx_auction_bids_created_at" ON "public"."auction_bids" USING "btree" ("listing_id", "created_at" DESC);



CREATE INDEX "idx_auction_bids_listing_id" ON "public"."auction_bids" USING "btree" ("listing_id");



CREATE INDEX "idx_audit_logs_created" ON "public"."admin_audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_logs_target" ON "public"."admin_audit_logs" USING "btree" ("target_table", "target_id");



CREATE UNIQUE INDEX "idx_carnet_collab_unique" ON "public"."carnet_collaborators" USING "btree" ("carnet_id", "user_id");



CREATE INDEX "idx_carnet_comments_carnet" ON "public"."carnet_comments" USING "btree" ("carnet_id");



CREATE INDEX "idx_carnet_comments_carnet_id" ON "public"."carnet_comments" USING "btree" ("carnet_id");



CREATE INDEX "idx_carnet_favorites_carnet_id" ON "public"."carnet_favorites" USING "btree" ("carnet_id");



CREATE UNIQUE INDEX "idx_carnet_favorites_unique" ON "public"."carnet_favorites" USING "btree" ("carnet_id", "user_id");



CREATE INDEX "idx_carnet_kit_items_carnet" ON "public"."carnet_kit_items" USING "btree" ("carnet_id");



CREATE INDEX "idx_carnet_likes_carnet_id" ON "public"."carnet_likes" USING "btree" ("carnet_id");



CREATE UNIQUE INDEX "idx_carnet_likes_unique" ON "public"."carnet_likes" USING "btree" ("carnet_id", "user_id");



CREATE INDEX "idx_carnet_moments_carnet" ON "public"."carnet_moments" USING "btree" ("carnet_id");



CREATE INDEX "idx_carnet_moments_hike_session_id" ON "public"."carnet_moments" USING "btree" ("hike_session_id");



CREATE INDEX "idx_carnet_moments_identified_species" ON "public"."carnet_moments" USING "gin" ("identified_species");



CREATE INDEX "idx_carnet_moments_moment_timestamp" ON "public"."carnet_moments" USING "btree" ("moment_timestamp");



CREATE INDEX "idx_carnet_views_carnet_id" ON "public"."carnet_views" USING "btree" ("carnet_id");



CREATE INDEX "idx_carnets_author" ON "public"."carnets" USING "btree" ("author_id");



CREATE INDEX "idx_carnets_author_id" ON "public"."carnets" USING "btree" ("author_id");



CREATE INDEX "idx_carnets_country_iso" ON "public"."carnets" USING "btree" ("country_iso");



CREATE INDEX "idx_carnets_created" ON "public"."carnets" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_carnets_groupe" ON "public"."carnets" USING "btree" ("groupe_id");



CREATE INDEX "idx_carnets_trip_id" ON "public"."carnets" USING "btree" ("trip_id");



CREATE INDEX "idx_carnets_visibility" ON "public"."carnets" USING "btree" ("visibility");



CREATE INDEX "idx_ccb_country_code" ON "public"."country_content_blocks" USING "btree" ("country_code");



CREATE INDEX "idx_ccb_needs_review" ON "public"."country_content_blocks" USING "btree" ("needs_human_review") WHERE ("needs_human_review" = true);



CREATE INDEX "idx_ccb_stale_after" ON "public"."country_content_blocks" USING "btree" ("stale_after");



CREATE INDEX "idx_checkout_intents_status" ON "public"."checkout_intents" USING "btree" ("status");



CREATE INDEX "idx_checkout_intents_user" ON "public"."checkout_intents" USING "btree" ("user_id");



CREATE INDEX "idx_club_members_club" ON "public"."club_members" USING "btree" ("club_id");



CREATE INDEX "idx_club_members_club_id" ON "public"."club_members" USING "btree" ("club_id");



CREATE UNIQUE INDEX "idx_club_members_unique" ON "public"."club_members" USING "btree" ("club_id", "user_id");



CREATE INDEX "idx_club_members_user" ON "public"."club_members" USING "btree" ("user_id");



CREATE INDEX "idx_club_members_user_id" ON "public"."club_members" USING "btree" ("user_id");



CREATE INDEX "idx_club_topic_replies_parent" ON "public"."club_topic_replies" USING "btree" ("parent_id");



CREATE INDEX "idx_club_topics_club" ON "public"."club_topics" USING "btree" ("club_id");



CREATE INDEX "idx_clubs_country_iso" ON "public"."clubs" USING "btree" ("country_iso");



CREATE INDEX "idx_clubs_type" ON "public"."clubs" USING "btree" ("type");



CREATE INDEX "idx_comment_reports_comment" ON "public"."comment_reports" USING "btree" ("comment_id");



CREATE INDEX "idx_comment_reports_status" ON "public"."comment_reports" USING "btree" ("status");



CREATE INDEX "idx_community_posts_author" ON "public"."community_posts" USING "btree" ("author_id");



CREATE INDEX "idx_community_posts_author_id" ON "public"."community_posts" USING "btree" ("author_id");



CREATE INDEX "idx_community_posts_created" ON "public"."community_posts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_community_posts_created_at" ON "public"."community_posts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_community_posts_post_type" ON "public"."community_posts" USING "btree" ("post_type");



CREATE INDEX "idx_compat_product_1" ON "public"."product_compatibilities" USING "btree" ("product_id_1");



CREATE INDEX "idx_compat_product_2" ON "public"."product_compatibilities" USING "btree" ("product_id_2");



CREATE INDEX "idx_configurator_sessions_user_id" ON "public"."configurator_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_conversation_members_conv" ON "public"."conversation_members" USING "btree" ("conversation_id", "user_id");



CREATE INDEX "idx_conversation_members_user" ON "public"."conversation_members" USING "btree" ("user_id", "conversation_id");



CREATE INDEX "idx_conversation_members_user_id" ON "public"."conversation_members" USING "btree" ("user_id");



CREATE INDEX "idx_conversations_last_message_at" ON "public"."conversations" USING "btree" ("last_message_at" DESC);



CREATE INDEX "idx_conversations_type" ON "public"."conversations" USING "btree" ("type");



CREATE INDEX "idx_countries_content_last_researched" ON "public"."countries_content" USING "btree" ("last_researched_at");



CREATE INDEX "idx_countries_content_status" ON "public"."countries_content" USING "btree" ("status");



CREATE INDEX "idx_countries_content_wave" ON "public"."countries_content" USING "btree" ("research_wave");



CREATE INDEX "idx_countries_geo_continent" ON "public"."countries_geo" USING "btree" ("continent");



CREATE INDEX "idx_countries_geo_geom" ON "public"."countries_geo" USING "gist" ("geometry");



CREATE INDEX "idx_countries_geo_geoname_id" ON "public"."countries_geo" USING "btree" ("geoname_id");



CREATE INDEX "idx_countries_geo_iso_a3" ON "public"."countries_geo" USING "btree" ("iso_a3");



CREATE INDEX "idx_countries_geo_name" ON "public"."countries_geo" USING "gin" ("to_tsvector"('"simple"'::"regconfig", "name"));



CREATE INDEX "idx_countries_geo_name_trgm" ON "public"."countries_geo" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_countries_geo_name_trgm_ascii" ON "public"."countries_geo" USING "gin" ("name_ascii" "public"."gin_trgm_ops");



CREATE INDEX "idx_country_practical_guides_country_code" ON "public"."country_practical_guides" USING "btree" ("country_code");



CREATE INDEX "idx_country_practical_guides_stale" ON "public"."country_practical_guides" USING "btree" ("stale_after");



CREATE INDEX "idx_country_sync_log_code" ON "public"."country_sync_log" USING "btree" ("code_iso");



CREATE INDEX "idx_country_sync_log_country_id" ON "public"."country_sync_log" USING "btree" ("country_id");



CREATE INDEX "idx_country_sync_log_valid_until" ON "public"."country_sync_log" USING "btree" ("cache_valid_until");



CREATE INDEX "idx_crew_members_crew_role" ON "public"."crew_members" USING "btree" ("crew_id", "role", "status");



CREATE INDEX "idx_crew_members_user_id" ON "public"."crew_members" USING "btree" ("user_id");



CREATE INDEX "idx_crews_auto_created" ON "public"."crews" USING "btree" ("auto_created");



CREATE INDEX "idx_crews_created_by" ON "public"."crews" USING "btree" ("created_by");



CREATE INDEX "idx_crews_invite_code" ON "public"."crews" USING "btree" ("invite_code");



CREATE INDEX "idx_crews_slug" ON "public"."crews" USING "btree" ("slug");



CREATE INDEX "idx_custom_kit_items_gear_id" ON "public"."custom_kit_items" USING "btree" ("gear_item_id");



CREATE INDEX "idx_custom_kit_items_kit_id" ON "public"."custom_kit_items" USING "btree" ("kit_id");



CREATE INDEX "idx_custom_kits_deleted_at" ON "public"."custom_kits" USING "btree" ("deleted_at");



CREATE INDEX "idx_custom_kits_search" ON "public"."custom_kits" USING "gin" ("to_tsvector"('"french"'::"regconfig", ((((COALESCE("name", ''::"text") || ' '::"text") || COALESCE("for_destination", ''::"text")) || ' '::"text") || COALESCE("activity", ''::"text"))));



CREATE INDEX "idx_custom_kits_user_status" ON "public"."custom_kits" USING "btree" ("user_id", "status");



CREATE INDEX "idx_depart_participants_kit_id" ON "public"."depart_participants" USING "btree" ("kit_id");



CREATE INDEX "idx_depart_participants_user_id" ON "public"."depart_participants" USING "btree" ("user_id");



CREATE INDEX "idx_destination_steps_country" ON "public"."destination_steps" USING "btree" ("country_code");



CREATE INDEX "idx_destination_steps_order" ON "public"."destination_steps" USING "btree" ("country_code", "order_hint");



CREATE INDEX "idx_event_participants_event_id" ON "public"."event_participants" USING "btree" ("event_id");



CREATE INDEX "idx_event_participants_user_id" ON "public"."event_participants" USING "btree" ("user_id");



CREATE INDEX "idx_events_date" ON "public"."events" USING "btree" ("event_date");



CREATE INDEX "idx_events_status" ON "public"."events" USING "btree" ("status");



CREATE INDEX "idx_expedition_reports_user_id" ON "public"."expedition_reports" USING "btree" ("user_id");



CREATE INDEX "idx_experts_availability" ON "public"."experts" USING "btree" ("availability");



CREATE INDEX "idx_gear_alert_history_gear" ON "public"."gear_alert_history" USING "btree" ("gear_item_id");



CREATE INDEX "idx_gear_alert_history_user" ON "public"."gear_alert_history" USING "btree" ("user_id", "resolved_at" DESC);



CREATE INDEX "idx_gear_items_is_listed_for_sale" ON "public"."gear_items" USING "btree" ("is_listed_for_sale") WHERE ("is_listed_for_sale" = true);



CREATE INDEX "idx_gear_items_last_used_at" ON "public"."gear_items" USING "btree" ("last_used_at") WHERE ("last_used_at" IS NOT NULL);



CREATE INDEX "idx_gear_items_loan_due_date" ON "public"."gear_items" USING "btree" ("loan_due_date") WHERE ("loan_due_date" IS NOT NULL);



CREATE INDEX "idx_gear_items_loan_status" ON "public"."gear_items" USING "btree" ("loan_status");



CREATE INDEX "idx_gear_items_next_maintenance" ON "public"."gear_items" USING "btree" ("next_maintenance_date") WHERE ("next_maintenance_date" IS NOT NULL);



CREATE INDEX "idx_gear_items_product_id" ON "public"."gear_items" USING "btree" ("product_id");



CREATE INDEX "idx_gear_items_purchase_price" ON "public"."gear_items" USING "btree" ("purchase_price");



CREATE INDEX "idx_gear_items_user_id" ON "public"."gear_items" USING "btree" ("user_id");



CREATE INDEX "idx_group_album_group" ON "public"."group_album" USING "btree" ("group_id");



CREATE INDEX "idx_group_expenses_group" ON "public"."group_expenses" USING "btree" ("group_id");



CREATE INDEX "idx_group_kit_items_dates" ON "public"."group_kit_items" USING "btree" ("start_date", "end_date") WHERE (("start_date" IS NOT NULL) OR ("end_date" IS NOT NULL));



CREATE INDEX "idx_group_kit_items_group" ON "public"."group_kit_items" USING "btree" ("group_id");



CREATE INDEX "idx_group_members_group" ON "public"."group_members" USING "btree" ("group_id");



CREATE INDEX "idx_group_members_user" ON "public"."group_members" USING "btree" ("user_id");



CREATE INDEX "idx_group_messages_created" ON "public"."group_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_group_messages_group" ON "public"."group_messages" USING "btree" ("group_id");



CREATE INDEX "idx_group_polls_group" ON "public"."group_polls" USING "btree" ("group_id");



CREATE INDEX "idx_group_tasks_group" ON "public"."group_tasks" USING "btree" ("group_id");



CREATE INDEX "idx_guides_author_id" ON "public"."guides" USING "btree" ("author_id");



CREATE INDEX "idx_guides_category" ON "public"."guides" USING "btree" ("category");



CREATE INDEX "idx_guides_featured" ON "public"."guides" USING "btree" ("featured");



CREATE INDEX "idx_guides_slug" ON "public"."guides" USING "btree" ("slug");



CREATE INDEX "idx_hike_sessions_carnet_id" ON "public"."hike_sessions" USING "btree" ("carnet_id");



CREATE INDEX "idx_hike_sessions_kit" ON "public"."hike_sessions" USING "btree" ("kit_id", "started_at" DESC);



CREATE INDEX "idx_hike_sessions_route_id" ON "public"."hike_sessions" USING "btree" ("route_id");



CREATE INDEX "idx_hike_sessions_user_id" ON "public"."hike_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_hiking_routes_geom" ON "public"."hiking_routes" USING "gist" ("geom");



CREATE INDEX "idx_hiking_routes_network" ON "public"."hiking_routes" USING "btree" ("network") WHERE ("network" IS NOT NULL);



CREATE UNIQUE INDEX "idx_hiking_routes_osm_relation_id" ON "public"."hiking_routes" USING "btree" ("osm_relation_id");



CREATE INDEX "idx_hiking_routes_ref" ON "public"."hiking_routes" USING "btree" ("ref") WHERE ("ref" IS NOT NULL);



CREATE INDEX "idx_hiking_routes_region" ON "public"."hiking_routes" USING "btree" ("region");



CREATE INDEX "idx_hub_telemetry_event_ts" ON "public"."hub_telemetry" USING "btree" ("event_name", "ts" DESC);



CREATE INDEX "idx_hub_telemetry_session_ts" ON "public"."hub_telemetry" USING "btree" ("session_id", "ts" DESC);



CREATE INDEX "idx_hub_telemetry_user_ts" ON "public"."hub_telemetry" USING "btree" ("user_id", "ts" DESC);



CREATE INDEX "idx_inventory_exports_user" ON "public"."inventory_exports" USING "btree" ("user_id", "exported_at" DESC);



CREATE INDEX "idx_kit_export_logs_user" ON "public"."kit_export_logs" USING "btree" ("user_id", "exported_at" DESC);



CREATE INDEX "idx_kit_field_reports_kit" ON "public"."kit_field_reports" USING "btree" ("kit_id");



CREATE INDEX "idx_kit_field_reports_session" ON "public"."kit_field_reports" USING "btree" ("hike_session_id");



CREATE INDEX "idx_kit_items_item_key" ON "public"."materiel_kit_items" USING "btree" ("item_key");



CREATE INDEX "idx_kit_items_kit_id" ON "public"."kit_items" USING "btree" ("kit_id");



CREATE INDEX "idx_kit_reports_session_id" ON "public"."kit_reports" USING "btree" ("session_id");



CREATE INDEX "idx_kit_reports_user_id" ON "public"."kit_reports" USING "btree" ("user_id");



CREATE INDEX "idx_kits_ancestors" ON "public"."materiel_kits" USING "gin" ("ancestors");



CREATE INDEX "idx_kits_featured" ON "public"."kits" USING "btree" ("featured");



CREATE INDEX "idx_kits_forked_from" ON "public"."materiel_kits" USING "btree" ("forked_from");



CREATE INDEX "idx_kits_lineage_root" ON "public"."materiel_kits" USING "btree" ("lineage_root_id");



CREATE INDEX "idx_kits_slug" ON "public"."kits" USING "btree" ("slug");



CREATE INDEX "idx_lkv_events_actor" ON "public"."lkv_events" USING "btree" ("actor_id");



CREATE INDEX "idx_lkv_events_created_at" ON "public"."lkv_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_lkv_events_crew" ON "public"."lkv_events" USING "btree" ("crew_id");



CREATE INDEX "idx_lkv_events_entity" ON "public"."lkv_events" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_lkv_events_type" ON "public"."lkv_events" USING "btree" ("event_type");



CREATE INDEX "idx_lkv_events_visibility" ON "public"."lkv_events" USING "btree" ("visibility");



CREATE INDEX "idx_loyalty_history_user_id" ON "public"."loyalty_history" USING "btree" ("user_id");



CREATE INDEX "idx_loyalty_redemptions_user_id" ON "public"."loyalty_redemptions" USING "btree" ("user_id");



CREATE INDEX "idx_map_refuges_lat_lng" ON "public"."map_refuges" USING "btree" ("lat", "lng");



CREATE INDEX "idx_map_refuges_region" ON "public"."map_refuges" USING "btree" ("region");



CREATE INDEX "idx_map_summits_altitude" ON "public"."map_summits" USING "btree" ("altitude_m" DESC);



CREATE INDEX "idx_map_summits_lat_lng" ON "public"."map_summits" USING "btree" ("lat", "lng");



CREATE INDEX "idx_map_summits_region" ON "public"."map_summits" USING "btree" ("region");



CREATE INDEX "idx_map_water_points_lat_lng" ON "public"."map_water_points" USING "btree" ("lat", "lng");



CREATE INDEX "idx_map_water_points_region" ON "public"."map_water_points" USING "btree" ("region");



CREATE INDEX "idx_materiel_history_user" ON "public"."materiel_history" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_materiel_kit_history_kit_id" ON "public"."materiel_kit_history" USING "btree" ("kit_id");



CREATE INDEX "idx_materiel_kit_history_user_id" ON "public"."materiel_kit_history" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_materiel_kit_items_kit_id" ON "public"."materiel_kit_items" USING "btree" ("kit_id");



CREATE INDEX "idx_materiel_kit_items_user_id" ON "public"."materiel_kit_items" USING "btree" ("user_id");



CREATE INDEX "idx_materiel_kits_public" ON "public"."materiel_kits" USING "btree" ("is_public") WHERE ("is_public" = true);



CREATE INDEX "idx_materiel_kits_search" ON "public"."materiel_kits" USING "gin" ("search_vector");



CREATE INDEX "idx_materiel_kits_user_id" ON "public"."materiel_kits" USING "btree" ("user_id");



CREATE INDEX "idx_materiel_loans_borrower_id" ON "public"."materiel_loans" USING "btree" ("borrower_id");



CREATE INDEX "idx_materiel_loans_lender_id" ON "public"."materiel_loans" USING "btree" ("lender_id");



CREATE INDEX "idx_message_attachments_msg" ON "public"."message_attachments" USING "btree" ("message_id");



CREATE INDEX "idx_message_reactions_msg" ON "public"."message_reactions" USING "btree" ("message_id");



CREATE INDEX "idx_messages_conv_created" ON "public"."messages" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "idx_messages_conversation_id" ON "public"."messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_messages_sender" ON "public"."messages" USING "btree" ("sender_id");



CREATE INDEX "idx_moderation_queue_listing" ON "public"."moderation_queue" USING "btree" ("listing_id");



CREATE INDEX "idx_moderation_queue_statut" ON "public"."moderation_queue" USING "btree" ("statut");



CREATE INDEX "idx_notifications_read" ON "public"."notifications" USING "btree" ("read");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_occasion_items_seller_id" ON "public"."occasion_items" USING "btree" ("seller_id");



CREATE INDEX "idx_order_items_order_id" ON "public"."order_items" USING "btree" ("order_id");



CREATE INDEX "idx_order_items_product_id" ON "public"."order_items" USING "btree" ("product_id");



CREATE INDEX "idx_order_items_received_at" ON "public"."order_items" USING "btree" ("order_id") WHERE ("received_at" IS NULL);



CREATE INDEX "idx_orders_order_number" ON "public"."orders" USING "btree" ("order_number");



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "idx_orders_user_id" ON "public"."orders" USING "btree" ("user_id");



CREATE INDEX "idx_outdoor_points_category" ON "public"."outdoor_points" USING "btree" ("category");



CREATE INDEX "idx_outdoor_points_country" ON "public"."outdoor_points" USING "btree" ("country");



CREATE INDEX "idx_outdoor_points_lat_lng" ON "public"."outdoor_points" USING "btree" ("lat", "lng");



CREATE INDEX "idx_outdoor_points_osm_id" ON "public"."outdoor_points" USING "btree" ("osm_id");



CREATE UNIQUE INDEX "idx_outdoor_points_osm_id_unique" ON "public"."outdoor_points" USING "btree" ("osm_id") WHERE ("osm_id" IS NOT NULL);



CREATE INDEX "idx_place_photos_place" ON "public"."place_photos" USING "btree" ("place_id");



CREATE INDEX "idx_place_reports_place" ON "public"."place_reports" USING "btree" ("place_id");



CREATE INDEX "idx_place_reports_status" ON "public"."place_reports" USING "btree" ("status");



CREATE INDEX "idx_place_reviews_author" ON "public"."place_reviews" USING "btree" ("author_id");



CREATE INDEX "idx_place_reviews_place" ON "public"."place_reviews" USING "btree" ("place_id");



CREATE INDEX "idx_place_reviews_trip_id" ON "public"."place_reviews" USING "btree" ("trip_id");



CREATE INDEX "idx_places_bayesian" ON "public"."places" USING "btree" ("bayesian_rating" DESC, "reviews_count" DESC);



CREATE INDEX "idx_places_category" ON "public"."places" USING "btree" ("category");



CREATE INDEX "idx_places_country" ON "public"."places" USING "btree" ("country_code");



CREATE INDEX "idx_places_geo_admin1_code" ON "public"."places_geo" USING "btree" ("country_iso_a2", "admin1_code");



CREATE INDEX "idx_places_geo_admin2_code" ON "public"."places_geo" USING "btree" ("country_iso_a2", "admin2_code");



CREATE INDEX "idx_places_geo_admin_region_id" ON "public"."places_geo" USING "btree" ("admin_region_id");



CREATE INDEX "idx_places_geo_capital" ON "public"."places_geo" USING "btree" ("is_capital") WHERE ("is_capital" = true);



CREATE INDEX "idx_places_geo_country_iso" ON "public"."places_geo" USING "btree" ("country_iso_a2");



CREATE INDEX "idx_places_geo_country_population" ON "public"."places_geo" USING "btree" ("country_iso_a2", "population" DESC);



CREATE INDEX "idx_places_geo_feature_code" ON "public"."places_geo" USING "btree" ("feature_code");



CREATE INDEX "idx_places_geo_geom" ON "public"."places_geo" USING "gist" ("geometry");



CREATE INDEX "idx_places_geo_geoname_id" ON "public"."places_geo" USING "btree" ("geoname_id");



CREATE INDEX "idx_places_geo_name" ON "public"."places_geo" USING "gin" ("to_tsvector"('"simple"'::"regconfig", "name"));



CREATE INDEX "idx_places_geo_name_trgm" ON "public"."places_geo" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_places_geom" ON "public"."places" USING "gist" ("geom");



CREATE INDEX "idx_post_comments_author" ON "public"."post_comments" USING "btree" ("author_id");



CREATE INDEX "idx_post_comments_parent" ON "public"."post_comments" USING "btree" ("parent_id");



CREATE INDEX "idx_post_comments_post" ON "public"."post_comments" USING "btree" ("post_id");



CREATE INDEX "idx_post_comments_post_id" ON "public"."post_comments" USING "btree" ("post_id");



CREATE INDEX "idx_post_likes_post" ON "public"."post_likes" USING "btree" ("post_id");



CREATE UNIQUE INDEX "idx_post_likes_unique" ON "public"."post_likes" USING "btree" ("post_id", "user_id");



CREATE INDEX "idx_post_likes_user" ON "public"."post_likes" USING "btree" ("user_id");



CREATE INDEX "idx_product_images_product" ON "public"."product_images" USING "btree" ("product_id");



CREATE INDEX "idx_product_ownership_search" ON "public"."product_ownership" USING "gin" ("search_vector");



CREATE INDEX "idx_product_ownership_user_id" ON "public"."product_ownership" USING "btree" ("user_id");



CREATE INDEX "idx_qa_questions_created" ON "public"."qa_questions" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "idx_qa_votes_unique" ON "public"."qa_votes" USING "btree" ("user_id", "target_type", "target_id");



CREATE INDEX "idx_rental_items_available" ON "public"."rental_items" USING "btree" ("available");



CREATE INDEX "idx_reviews_type" ON "public"."reviews" USING "btree" ("type");



CREATE INDEX "idx_reviews_user_id" ON "public"."reviews" USING "btree" ("user_id");



CREATE INDEX "idx_saved_adventures_user_id" ON "public"."saved_adventures" USING "btree" ("user_id");



CREATE INDEX "idx_saved_trails_user_id" ON "public"."saved_trails" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_saved_trails_user_trail" ON "public"."saved_trails" USING "btree" ("user_id", "trail_id");



CREATE INDEX "idx_share_tokens_kit" ON "public"."share_tokens" USING "btree" ("kit_id");



CREATE INDEX "idx_share_tokens_kit_id" ON "public"."share_tokens" USING "btree" ("kit_id");



CREATE INDEX "idx_share_tokens_token" ON "public"."share_tokens" USING "btree" ("token");



CREATE INDEX "idx_shop_products_category" ON "public"."shop_products" USING "btree" ("category");



CREATE INDEX "idx_shop_products_category_main" ON "public"."shop_products" USING "btree" ("category_main");



CREATE INDEX "idx_shop_products_essentiality" ON "public"."shop_products" USING "btree" ("essentiality");



CREATE INDEX "idx_shop_products_price_eur" ON "public"."shop_products" USING "btree" ("price_eur");



CREATE UNIQUE INDEX "idx_shop_products_product_id" ON "public"."shop_products" USING "btree" ("product_id") WHERE ("product_id" IS NOT NULL);



CREATE INDEX "idx_shop_products_score_kdv" ON "public"."shop_products" USING "btree" ("score_kdv" DESC);



CREATE INDEX "idx_shop_products_transaction_type" ON "public"."shop_products" USING "btree" ("transaction_type");



CREATE INDEX "idx_shop_products_weight_g" ON "public"."shop_products" USING "btree" ("weight_g");



CREATE INDEX "idx_sos_alerts_user_id" ON "public"."sos_alerts" USING "btree" ("user_id");



CREATE INDEX "idx_stock_movements_created_at" ON "public"."stock_movements" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_stock_movements_product_id" ON "public"."stock_movements" USING "btree" ("product_id");



CREATE INDEX "idx_stock_movements_reference" ON "public"."stock_movements" USING "btree" ("reference_type", "reference_id");



CREATE INDEX "idx_trail_segments_geom" ON "public"."trail_segments" USING "gist" ("geom");



CREATE INDEX "idx_trail_segments_highway" ON "public"."trail_segments" USING "btree" ("highway");



CREATE UNIQUE INDEX "idx_trail_segments_osm_id" ON "public"."trail_segments" USING "btree" ("osm_id");



CREATE INDEX "idx_trail_segments_sac_scale" ON "public"."trail_segments" USING "btree" ("sac_scale") WHERE ("sac_scale" IS NOT NULL);



CREATE INDEX "idx_travel_groups_country_iso" ON "public"."travel_groups" USING "btree" ("country_iso");



CREATE INDEX "idx_travel_groups_invite_code" ON "public"."travel_groups" USING "btree" ("invite_code");



CREATE INDEX "idx_travel_groups_owner" ON "public"."travel_groups" USING "btree" ("owner_id");



CREATE INDEX "idx_travel_groups_visibility" ON "public"."travel_groups" USING "btree" ("visibility");



CREATE INDEX "idx_trip_checklist_trip" ON "public"."trip_checklist_items" USING "btree" ("trip_id", "due_offset_days", "position");



CREATE INDEX "idx_trip_collab_trip_id" ON "public"."trip_collaborators" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_collab_user_id" ON "public"."trip_collaborators" USING "btree" ("user_id");



CREATE INDEX "idx_trip_docs_trip_id" ON "public"."trip_documents" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_docs_user_id" ON "public"."trip_documents" USING "btree" ("user_id");



CREATE INDEX "idx_trip_expenses_payer" ON "public"."trip_expenses" USING "btree" ("payer_id");



CREATE INDEX "idx_trip_expenses_planned" ON "public"."trip_expenses" USING "btree" ("trip_id", "is_planned", "expense_date");



CREATE INDEX "idx_trip_expenses_trip_id" ON "public"."trip_expenses" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_items_category" ON "public"."trip_items" USING "btree" ("trip_id", "category");



CREATE INDEX "idx_trip_items_day" ON "public"."trip_items" USING "btree" ("trip_id", "day_number") WHERE ("day_number" IS NOT NULL);



CREATE INDEX "idx_trip_items_inventory_item_id" ON "public"."trip_items" USING "btree" ("inventory_item_id") WHERE ("inventory_item_id" IS NOT NULL);



CREATE INDEX "idx_trip_items_packed" ON "public"."trip_items" USING "btree" ("trip_id", "is_packed");



CREATE INDEX "idx_trip_items_priority" ON "public"."trip_items" USING "btree" ("trip_id", "priority");



CREATE INDEX "idx_trip_items_shop_product" ON "public"."trip_items" USING "btree" ("shop_product_id");



CREATE INDEX "idx_trip_items_trip_id" ON "public"."trip_items" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_notes_author" ON "public"."trip_notes" USING "btree" ("author_id");



CREATE INDEX "idx_trip_notes_trip_id" ON "public"."trip_notes" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_participants_trip_role" ON "public"."trip_participants" USING "btree" ("trip_id", "role", "status");



CREATE INDEX "idx_trip_participants_user_id" ON "public"."trip_participants" USING "btree" ("user_id");



CREATE INDEX "idx_trip_pois_step_id" ON "public"."trip_pois" USING "btree" ("step_id");



CREATE INDEX "idx_trip_pois_trip_id" ON "public"."trip_pois" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_safety_scheduled" ON "public"."trip_safety_checkpoints" USING "btree" ("trip_id", "scheduled_at");



CREATE INDEX "idx_trip_safety_trip_id" ON "public"."trip_safety_checkpoints" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_steps_day_order" ON "public"."trip_steps" USING "btree" ("trip_id", "day_number", "order_index");



CREATE INDEX "idx_trip_steps_trip_id" ON "public"."trip_steps" USING "btree" ("trip_id");



CREATE INDEX "idx_trips_crew_id" ON "public"."trips" USING "btree" ("crew_id");



CREATE INDEX "idx_trips_destination_country" ON "public"."trips" USING "btree" ("destination_country_code");



CREATE INDEX "idx_trips_group_id" ON "public"."trips" USING "btree" ("group_id");



CREATE INDEX "idx_trips_kit_id" ON "public"."trips" USING "btree" ("kit_id");



CREATE INDEX "idx_trips_share_token" ON "public"."trips" USING "btree" ("share_token");



CREATE INDEX "idx_trips_slug" ON "public"."trips" USING "btree" ("slug");



CREATE INDEX "idx_trips_status" ON "public"."trips" USING "btree" ("status");



CREATE INDEX "idx_trips_user_id" ON "public"."trips" USING "btree" ("user_id");



CREATE INDEX "idx_trips_user_start_date" ON "public"."trips" USING "btree" ("user_id", "start_date" DESC);



CREATE INDEX "idx_trips_user_status" ON "public"."trips" USING "btree" ("user_id", "status");



CREATE INDEX "idx_trips_visibility" ON "public"."trips" USING "btree" ("visibility");



CREATE UNIQUE INDEX "idx_unique_direct_pair_key" ON "public"."conversations" USING "btree" ("direct_pair_key") WHERE (("type" = 'direct'::"text") AND ("direct_pair_key" IS NOT NULL));



CREATE UNIQUE INDEX "idx_user_badges_unique" ON "public"."user_badges" USING "btree" ("user_id", "badge_id");



CREATE INDEX "idx_user_badges_user_id" ON "public"."user_badges" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_user_challenges_unique" ON "public"."user_challenges" USING "btree" ("user_id", "challenge_id");



CREATE INDEX "idx_user_challenges_user_id" ON "public"."user_challenges" USING "btree" ("user_id");



CREATE INDEX "idx_user_documents_user_id" ON "public"."user_documents" USING "btree" ("user_id");



CREATE INDEX "idx_user_follows_follower" ON "public"."user_follows" USING "btree" ("follower_id");



CREATE INDEX "idx_user_follows_following" ON "public"."user_follows" USING "btree" ("following_id");



CREATE UNIQUE INDEX "idx_user_follows_unique" ON "public"."user_follows" USING "btree" ("follower_id", "following_id");



CREATE INDEX "idx_user_profiles_email" ON "public"."user_profiles" USING "btree" ("email");



CREATE UNIQUE INDEX "kit_item_survival_by_kit_key" ON "public"."kit_item_survival_by_kit" USING "btree" ("kit_id", "item_key");



CREATE UNIQUE INDEX "kit_item_survival_item_key_key" ON "public"."kit_item_survival" USING "btree" ("item_key");



CREATE UNIQUE INDEX "kit_trust_scores_kit_id_key" ON "public"."kit_trust_scores" USING "btree" ("kit_id");



CREATE INDEX "metadata_trail_id_idx" ON "public"."trail_metadata" USING "btree" ("trail_id");



CREATE UNIQUE INDEX "orders_stripe_session_id_key" ON "public"."orders" USING "btree" ("stripe_session_id");



CREATE INDEX "scores_trail_id_idx" ON "public"."trail_scores" USING "btree" ("trail_id");



CREATE INDEX "trail_pois_geom_idx" ON "public"."trail_pois" USING "gist" ("geom");



CREATE INDEX "user_blocks_blocked_idx" ON "public"."user_blocks" USING "btree" ("blocked_id");



CREATE INDEX "user_blocks_blocker_idx" ON "public"."user_blocks" USING "btree" ("blocker_id");



CREATE INDEX "user_field_signature_user_id_idx" ON "public"."user_field_signature" USING "btree" ("user_id");



CREATE INDEX "user_orientation_user_id_idx" ON "public"."user_orientation" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "moderation_updated_at_trigger" BEFORE UPDATE ON "public"."moderation_queue" FOR EACH ROW EXECUTE FUNCTION "public"."update_moderation_updated_at"();



CREATE OR REPLACE TRIGGER "on_pending_contribution_changed" AFTER INSERT OR UPDATE ON "public"."pending_contributions" FOR EACH ROW EXECUTE FUNCTION "public"."update_reward_account_on_contribution"();



CREATE OR REPLACE TRIGGER "on_reward_transaction_inserted" AFTER INSERT ON "public"."reward_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_reward_account_on_transaction"();



CREATE OR REPLACE TRIGGER "on_user_profile_created_reward_account" AFTER INSERT ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user_reward_account"();



CREATE OR REPLACE TRIGGER "trg_admin_regions_geo_updated_at" BEFORE UPDATE ON "public"."admin_regions_geo" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_alerts_updated_at" BEFORE UPDATE ON "public"."alerts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_carnet_comment_notify" AFTER INSERT ON "public"."carnet_comments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_on_carnet_comment"();



CREATE OR REPLACE TRIGGER "trg_carnet_comments_sync_count" AFTER INSERT OR DELETE ON "public"."carnet_comments" FOR EACH ROW EXECUTE FUNCTION "public"."sync_carnet_comments_count"();



CREATE OR REPLACE TRIGGER "trg_carnet_favorites_sync_count" AFTER INSERT OR DELETE ON "public"."carnet_favorites" FOR EACH ROW EXECUTE FUNCTION "public"."sync_carnet_favorites_count"();



CREATE OR REPLACE TRIGGER "trg_carnet_like_notify" AFTER INSERT ON "public"."carnet_likes" FOR EACH ROW EXECUTE FUNCTION "public"."trg_on_carnet_like"();



CREATE OR REPLACE TRIGGER "trg_carnet_likes_sync_count" AFTER INSERT OR DELETE ON "public"."carnet_likes" FOR EACH ROW EXECUTE FUNCTION "public"."sync_carnet_likes_count"();



CREATE OR REPLACE TRIGGER "trg_carnet_views_sync_count" AFTER INSERT ON "public"."carnet_views" FOR EACH ROW EXECUTE FUNCTION "public"."sync_carnet_views_count"();



CREATE OR REPLACE TRIGGER "trg_community_post_comment_notify" AFTER INSERT ON "public"."post_comments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_on_community_post_comment"();



CREATE OR REPLACE TRIGGER "trg_community_post_comments_sync_count" AFTER INSERT OR DELETE ON "public"."post_comments" FOR EACH ROW EXECUTE FUNCTION "public"."sync_community_post_comments_count"();



CREATE OR REPLACE TRIGGER "trg_community_post_like_notify" AFTER INSERT ON "public"."post_likes" FOR EACH ROW EXECUTE FUNCTION "public"."trg_on_community_post_like"();



CREATE OR REPLACE TRIGGER "trg_countries_content_updated_at" BEFORE UPDATE ON "public"."countries_content" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_countries_geo_updated_at" BEFORE UPDATE ON "public"."countries_geo" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_enforce_member_role_hierarchy" BEFORE UPDATE ON "public"."conversation_members" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_member_role_hierarchy"();



CREATE OR REPLACE TRIGGER "trg_group_expense_added_notify" AFTER INSERT ON "public"."group_expenses" FOR EACH ROW EXECUTE FUNCTION "public"."trg_on_group_expense_added"();



CREATE OR REPLACE TRIGGER "trg_group_member_join_notify" AFTER INSERT OR UPDATE OF "status" ON "public"."group_members" FOR EACH ROW EXECUTE FUNCTION "public"."trg_on_group_member_join"();



CREATE OR REPLACE TRIGGER "trg_group_message_notify" AFTER INSERT ON "public"."group_messages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_on_group_message"();



CREATE OR REPLACE TRIGGER "trg_group_task_assigned_notify" AFTER INSERT OR UPDATE OF "assigned_to" ON "public"."group_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."trg_on_group_task_assigned"();



CREATE OR REPLACE TRIGGER "trg_hike_sessions_field_proven_count" AFTER INSERT OR DELETE OR UPDATE OF "kit_id", "distance_km" ON "public"."hike_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_field_proven_count"();



CREATE OR REPLACE TRIGGER "trg_materiel_kit_items_updated_at" BEFORE UPDATE ON "public"."materiel_kit_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_materiel_kits_lineage" BEFORE INSERT OR UPDATE OF "forked_from" ON "public"."materiel_kits" FOR EACH ROW EXECUTE FUNCTION "public"."handle_kit_lineage"();



CREATE OR REPLACE TRIGGER "trg_materiel_kits_search_vector" BEFORE INSERT OR UPDATE ON "public"."materiel_kits" FOR EACH ROW EXECUTE FUNCTION "public"."materiel_kits_search_vector_update"();



CREATE OR REPLACE TRIGGER "trg_materiel_kits_updated_at" BEFORE UPDATE ON "public"."materiel_kits" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_materiel_loans_updated_at" BEFORE UPDATE ON "public"."materiel_loans" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_order_updated_at"();



CREATE OR REPLACE TRIGGER "trg_places_geo_updated_at" BEFORE UPDATE ON "public"."places_geo" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_prevent_message_immutable_fields" BEFORE UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_message_immutable_fields_update"();



CREATE OR REPLACE TRIGGER "trg_product_ownership_search" BEFORE INSERT OR UPDATE ON "public"."product_ownership" FOR EACH ROW EXECUTE FUNCTION "public"."product_ownership_search_vector_update"();



CREATE OR REPLACE TRIGGER "trg_product_ownership_updated_at" BEFORE UPDATE ON "public"."product_ownership" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_recalculate_place_rating" AFTER INSERT OR DELETE OR UPDATE ON "public"."place_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."recalculate_place_rating"();



CREATE OR REPLACE TRIGGER "trg_sync_place_geom" BEFORE INSERT OR UPDATE OF "latitude", "longitude" ON "public"."places" FOR EACH ROW EXECUTE FUNCTION "public"."sync_place_geom"();



CREATE OR REPLACE TRIGGER "trg_trip_checklist_seed" AFTER INSERT ON "public"."trips" FOR EACH ROW EXECUTE FUNCTION "public"."lkv_seed_trip_checklist_template"();



CREATE OR REPLACE TRIGGER "trg_trip_collab_updated_at" BEFORE UPDATE ON "public"."trip_collaborators" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_trip_docs_updated_at" BEFORE UPDATE ON "public"."trip_documents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_trip_expenses_updated_at" BEFORE UPDATE ON "public"."trip_expenses" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_trip_items_updated_at" BEFORE UPDATE ON "public"."trip_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_trip_notes_updated_at" BEFORE UPDATE ON "public"."trip_notes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_trip_pois_updated_at" BEFORE UPDATE ON "public"."trip_pois" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_trip_safety_updated_at" BEFORE UPDATE ON "public"."trip_safety_checkpoints" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_trip_steps_updated_at" BEFORE UPDATE ON "public"."trip_steps" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_trips_ensure_auto_crew" BEFORE INSERT ON "public"."trips" FOR EACH ROW EXECUTE FUNCTION "public"."lkv_ensure_auto_crew"();



CREATE OR REPLACE TRIGGER "trg_trips_generate_slug" BEFORE INSERT ON "public"."trips" FOR EACH ROW EXECUTE FUNCTION "public"."generate_trip_slug"();



CREATE OR REPLACE TRIGGER "trg_trips_insert_owner" AFTER INSERT ON "public"."trips" FOR EACH ROW EXECUTE FUNCTION "public"."handle_trip_owner_collaborator"();



CREATE OR REPLACE TRIGGER "trg_trips_updated_at" BEFORE UPDATE ON "public"."trips" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_process_order_points" BEFORE INSERT OR UPDATE OF "status", "total_eur" ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."process_order_points"();



CREATE OR REPLACE TRIGGER "trigger_sync_loyalty_points" AFTER INSERT OR DELETE OR UPDATE ON "public"."loyalty_history" FOR EACH ROW EXECUTE FUNCTION "public"."sync_loyalty_points"();



CREATE OR REPLACE TRIGGER "trips_freeze_owner_trigger" BEFORE UPDATE ON "public"."trips" FOR EACH ROW EXECUTE FUNCTION "public"."freeze_trip_owner"();



CREATE OR REPLACE TRIGGER "update_travel_groups_updated_at" BEFORE UPDATE ON "public"."travel_groups" FOR EACH ROW EXECUTE FUNCTION "public"."update_group_updated_at"();



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_regions_geo"
    ADD CONSTRAINT "admin_regions_geo_admin_parent_id_fkey" FOREIGN KEY ("admin_parent_id") REFERENCES "public"."admin_regions_geo"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_regions_geo"
    ADD CONSTRAINT "admin_regions_geo_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."countries_geo"("id");



ALTER TABLE ONLY "public"."admin_roles"
    ADD CONSTRAINT "admin_roles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_roles"
    ADD CONSTRAINT "admin_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."affiliate_clicks"
    ADD CONSTRAINT "affiliate_clicks_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "public"."affiliate_links"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."affiliate_clicks"
    ADD CONSTRAINT "affiliate_clicks_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."affiliate_offers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."affiliate_clicks"
    ADD CONSTRAINT "affiliate_clicks_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."affiliate_partners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."affiliate_clicks"
    ADD CONSTRAINT "affiliate_clicks_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."affiliate_programs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."affiliate_clicks"
    ADD CONSTRAINT "affiliate_clicks_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."affiliate_conversions"
    ADD CONSTRAINT "affiliate_conversions_click_id_fkey" FOREIGN KEY ("click_id") REFERENCES "public"."affiliate_clicks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."affiliate_conversions"
    ADD CONSTRAINT "affiliate_conversions_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."affiliate_offers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."affiliate_conversions"
    ADD CONSTRAINT "affiliate_conversions_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."affiliate_partners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."affiliate_links"
    ADD CONSTRAINT "affiliate_links_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "public"."countries_geo"("iso_a2") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."affiliate_links"
    ADD CONSTRAINT "affiliate_links_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."affiliate_partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."affiliate_offers"
    ADD CONSTRAINT "affiliate_offers_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."affiliate_programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."affiliate_programs"
    ADD CONSTRAINT "affiliate_programs_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."affiliate_partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_jobs"
    ADD CONSTRAINT "ai_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_usage_daily"
    ADD CONSTRAINT "ai_usage_daily_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alerts"
    ADD CONSTRAINT "alerts_product_ownership_id_fkey" FOREIGN KEY ("product_ownership_id") REFERENCES "public"."product_ownership"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alerts"
    ADD CONSTRAINT "alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ama_questions"
    ADD CONSTRAINT "ama_questions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ama_questions"
    ADD CONSTRAINT "ama_questions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."ama_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ama_sessions"
    ADD CONSTRAINT "ama_sessions_expert_id_fkey" FOREIGN KEY ("expert_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ama_votes"
    ADD CONSTRAINT "ama_votes_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."ama_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ama_votes"
    ADD CONSTRAINT "ama_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ambassadors"
    ADD CONSTRAINT "ambassadors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auction_auto_bids"
    ADD CONSTRAINT "auction_auto_bids_bidder_id_fkey" FOREIGN KEY ("bidder_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auction_bids"
    ADD CONSTRAINT "auction_bids_bidder_id_fkey" FOREIGN KEY ("bidder_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carnet_collaborators"
    ADD CONSTRAINT "carnet_collaborators_carnet_id_fkey" FOREIGN KEY ("carnet_id") REFERENCES "public"."carnets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carnet_collaborators"
    ADD CONSTRAINT "carnet_collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carnet_comments"
    ADD CONSTRAINT "carnet_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carnet_comments"
    ADD CONSTRAINT "carnet_comments_carnet_id_fkey" FOREIGN KEY ("carnet_id") REFERENCES "public"."carnets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carnet_favorites"
    ADD CONSTRAINT "carnet_favorites_carnet_id_fkey" FOREIGN KEY ("carnet_id") REFERENCES "public"."carnets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carnet_favorites"
    ADD CONSTRAINT "carnet_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carnet_gear_links"
    ADD CONSTRAINT "carnet_gear_links_carnet_id_fkey" FOREIGN KEY ("carnet_id") REFERENCES "public"."carnets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carnet_kit_items"
    ADD CONSTRAINT "carnet_kit_items_carnet_id_fkey" FOREIGN KEY ("carnet_id") REFERENCES "public"."carnets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carnet_likes"
    ADD CONSTRAINT "carnet_likes_carnet_id_fkey" FOREIGN KEY ("carnet_id") REFERENCES "public"."carnets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carnet_likes"
    ADD CONSTRAINT "carnet_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carnet_media"
    ADD CONSTRAINT "carnet_media_carnet_id_fkey" FOREIGN KEY ("carnet_id") REFERENCES "public"."carnets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carnet_moments"
    ADD CONSTRAINT "carnet_moments_carnet_id_fkey" FOREIGN KEY ("carnet_id") REFERENCES "public"."carnets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carnet_moments"
    ADD CONSTRAINT "carnet_moments_hike_session_id_fkey" FOREIGN KEY ("hike_session_id") REFERENCES "public"."hike_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."carnet_views"
    ADD CONSTRAINT "carnet_views_carnet_id_fkey" FOREIGN KEY ("carnet_id") REFERENCES "public"."carnets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carnet_views"
    ADD CONSTRAINT "carnet_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."carnets"
    ADD CONSTRAINT "carnets_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carnets"
    ADD CONSTRAINT "carnets_groupe_id_fkey" FOREIGN KEY ("groupe_id") REFERENCES "public"."groupes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."carnets"
    ADD CONSTRAINT "carnets_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cart_loyalty_discounts"
    ADD CONSTRAINT "cart_loyalty_discounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checkout_intents"
    ADD CONSTRAINT "checkout_intents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."club_challenge_entries"
    ADD CONSTRAINT "club_challenge_entries_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."club_challenges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_challenge_entries"
    ADD CONSTRAINT "club_challenge_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_challenges"
    ADD CONSTRAINT "club_challenges_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_event_participants"
    ADD CONSTRAINT "club_event_participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."club_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_event_participants"
    ADD CONSTRAINT "club_event_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_events"
    ADD CONSTRAINT "club_events_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_events"
    ADD CONSTRAINT "club_events_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_join_requests"
    ADD CONSTRAINT "club_join_requests_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_join_requests"
    ADD CONSTRAINT "club_join_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."club_join_requests"
    ADD CONSTRAINT "club_join_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_recommended_kits"
    ADD CONSTRAINT "club_recommended_kits_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_recommended_kits"
    ADD CONSTRAINT "club_recommended_kits_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "public"."kits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_recommended_kits"
    ADD CONSTRAINT "club_recommended_kits_recommended_by_fkey" FOREIGN KEY ("recommended_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."club_reports"
    ADD CONSTRAINT "club_reports_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_reports"
    ADD CONSTRAINT "club_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_topic_likes"
    ADD CONSTRAINT "club_topic_likes_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."club_topics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_topic_likes"
    ADD CONSTRAINT "club_topic_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_topic_replies"
    ADD CONSTRAINT "club_topic_replies_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_topic_replies"
    ADD CONSTRAINT "club_topic_replies_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."club_topic_replies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_topic_replies"
    ADD CONSTRAINT "club_topic_replies_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."club_topics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_topics"
    ADD CONSTRAINT "club_topics_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_topics"
    ADD CONSTRAINT "club_topics_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comment_reports"
    ADD CONSTRAINT "comment_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."community_posts"
    ADD CONSTRAINT "community_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."configurator_sessions"
    ADD CONSTRAINT "configurator_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_members"
    ADD CONSTRAINT "conversation_members_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_members"
    ADD CONSTRAINT "conversation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."countries_content"
    ADD CONSTRAINT "countries_content_country_iso_a2_fkey" FOREIGN KEY ("country_iso_a2") REFERENCES "public"."countries_geo"("iso_a2") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."country_content_blocks"
    ADD CONSTRAINT "country_content_blocks_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "public"."countries_geo"("iso_a2") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."country_content_blocks"
    ADD CONSTRAINT "country_content_blocks_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."country_practical_guides"
    ADD CONSTRAINT "country_practical_guides_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "public"."countries_geo"("iso_a2") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crew_members"
    ADD CONSTRAINT "crew_members_crew_id_fkey" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crew_members"
    ADD CONSTRAINT "crew_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crews"
    ADD CONSTRAINT "crews_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_kit_items"
    ADD CONSTRAINT "custom_kit_items_gear_item_id_fkey" FOREIGN KEY ("gear_item_id") REFERENCES "public"."gear_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."custom_kit_items"
    ADD CONSTRAINT "custom_kit_items_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "public"."custom_kits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_kits"
    ADD CONSTRAINT "custom_kits_trail_id_fkey" FOREIGN KEY ("trail_id") REFERENCES "public"."hiking_routes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."custom_kits"
    ADD CONSTRAINT "custom_kits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."depart_participants"
    ADD CONSTRAINT "depart_participants_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "public"."materiel_kits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."depart_participants"
    ADD CONSTRAINT "depart_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."destination_steps"
    ADD CONSTRAINT "destination_steps_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "public"."countries_geo"("iso_a2") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_expenses"
    ADD CONSTRAINT "event_expenses_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_participants"
    ADD CONSTRAINT "event_participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_participants"
    ADD CONSTRAINT "event_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expedition_reports"
    ADD CONSTRAINT "expedition_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expert_bookings"
    ADD CONSTRAINT "expert_bookings_expert_id_fkey" FOREIGN KEY ("expert_id") REFERENCES "public"."experts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expert_bookings"
    ADD CONSTRAINT "expert_bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_items"
    ADD CONSTRAINT "fk_trip_items_affiliate_link" FOREIGN KEY ("affiliate_link_id") REFERENCES "public"."affiliate_links"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_items"
    ADD CONSTRAINT "fk_trip_items_inventory_item" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."product_ownership"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gear_alert_history"
    ADD CONSTRAINT "gear_alert_history_gear_item_id_fkey" FOREIGN KEY ("gear_item_id") REFERENCES "public"."gear_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gear_alert_history"
    ADD CONSTRAINT "gear_alert_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gear_history"
    ADD CONSTRAINT "gear_history_gear_item_id_fkey" FOREIGN KEY ("gear_item_id") REFERENCES "public"."gear_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gear_images"
    ADD CONSTRAINT "gear_images_gear_item_id_fkey" FOREIGN KEY ("gear_item_id") REFERENCES "public"."gear_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gear_items"
    ADD CONSTRAINT "gear_items_origin_kit_id_fkey" FOREIGN KEY ("origin_kit_id") REFERENCES "public"."kits"("id");



ALTER TABLE ONLY "public"."gear_items"
    ADD CONSTRAINT "gear_items_origin_order_id_fkey" FOREIGN KEY ("origin_order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."gear_items"
    ADD CONSTRAINT "gear_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."shop_products"("id");



ALTER TABLE ONLY "public"."gear_items"
    ADD CONSTRAINT "gear_items_source_report_id_fkey" FOREIGN KEY ("source_report_id") REFERENCES "public"."kit_reports"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gear_items"
    ADD CONSTRAINT "gear_items_transferred_to_user_id_fkey" FOREIGN KEY ("transferred_to_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."gear_items"
    ADD CONSTRAINT "gear_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_album"
    ADD CONSTRAINT "group_album_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."travel_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_album"
    ADD CONSTRAINT "group_album_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_expenses"
    ADD CONSTRAINT "group_expenses_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."travel_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_expenses"
    ADD CONSTRAINT "group_expenses_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_invitations"
    ADD CONSTRAINT "group_invitations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."travel_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_invitations"
    ADD CONSTRAINT "group_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_kit_items"
    ADD CONSTRAINT "group_kit_items_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."group_kit_items"
    ADD CONSTRAINT "group_kit_items_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."travel_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."travel_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_messages"
    ADD CONSTRAINT "group_messages_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."travel_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_messages"
    ADD CONSTRAINT "group_messages_reply_to_fkey" FOREIGN KEY ("reply_to") REFERENCES "public"."group_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."group_messages"
    ADD CONSTRAINT "group_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_poll_votes"
    ADD CONSTRAINT "group_poll_votes_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."group_polls"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_poll_votes"
    ADD CONSTRAINT "group_poll_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_polls"
    ADD CONSTRAINT "group_polls_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_polls"
    ADD CONSTRAINT "group_polls_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."travel_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_reports"
    ADD CONSTRAINT "group_reports_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."travel_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."group_reports"
    ADD CONSTRAINT "group_reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_reports"
    ADD CONSTRAINT "group_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_tasks"
    ADD CONSTRAINT "group_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."group_tasks"
    ADD CONSTRAINT "group_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_tasks"
    ADD CONSTRAINT "group_tasks_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."travel_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groupe_activites"
    ADD CONSTRAINT "groupe_activites_groupe_id_fkey" FOREIGN KEY ("groupe_id") REFERENCES "public"."groupes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groupe_activites"
    ADD CONSTRAINT "groupe_activites_membre_id_fkey" FOREIGN KEY ("membre_id") REFERENCES "public"."groupe_membres"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."groupe_depense_parts"
    ADD CONSTRAINT "groupe_depense_parts_depense_id_fkey" FOREIGN KEY ("depense_id") REFERENCES "public"."groupe_depenses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groupe_depense_parts"
    ADD CONSTRAINT "groupe_depense_parts_membre_id_fkey" FOREIGN KEY ("membre_id") REFERENCES "public"."groupe_membres"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groupe_depenses"
    ADD CONSTRAINT "groupe_depenses_groupe_id_fkey" FOREIGN KEY ("groupe_id") REFERENCES "public"."groupes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groupe_depenses"
    ADD CONSTRAINT "groupe_depenses_payeur_id_fkey" FOREIGN KEY ("payeur_id") REFERENCES "public"."groupe_membres"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."groupe_equipement"
    ADD CONSTRAINT "groupe_equipement_apporte_par_fkey" FOREIGN KEY ("apporte_par") REFERENCES "public"."groupe_membres"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."groupe_equipement"
    ADD CONSTRAINT "groupe_equipement_groupe_id_fkey" FOREIGN KEY ("groupe_id") REFERENCES "public"."groupes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groupe_etapes"
    ADD CONSTRAINT "groupe_etapes_groupe_id_fkey" FOREIGN KEY ("groupe_id") REFERENCES "public"."groupes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groupe_hebergements"
    ADD CONSTRAINT "groupe_hebergements_groupe_id_fkey" FOREIGN KEY ("groupe_id") REFERENCES "public"."groupes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groupe_membres"
    ADD CONSTRAINT "groupe_membres_groupe_id_fkey" FOREIGN KEY ("groupe_id") REFERENCES "public"."groupes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groupe_messages"
    ADD CONSTRAINT "groupe_messages_auteur_id_fkey" FOREIGN KEY ("auteur_id") REFERENCES "public"."groupe_membres"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."groupe_messages"
    ADD CONSTRAINT "groupe_messages_groupe_id_fkey" FOREIGN KEY ("groupe_id") REFERENCES "public"."groupes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groupe_taches"
    ADD CONSTRAINT "groupe_taches_assigne_a_fkey" FOREIGN KEY ("assigne_a") REFERENCES "public"."groupe_membres"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."groupe_taches"
    ADD CONSTRAINT "groupe_taches_groupe_id_fkey" FOREIGN KEY ("groupe_id") REFERENCES "public"."groupes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groupe_vote_choix"
    ADD CONSTRAINT "groupe_vote_choix_membre_id_fkey" FOREIGN KEY ("membre_id") REFERENCES "public"."groupe_membres"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groupe_vote_choix"
    ADD CONSTRAINT "groupe_vote_choix_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "public"."groupe_vote_options"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groupe_vote_choix"
    ADD CONSTRAINT "groupe_vote_choix_vote_id_fkey" FOREIGN KEY ("vote_id") REFERENCES "public"."groupe_votes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groupe_vote_options"
    ADD CONSTRAINT "groupe_vote_options_vote_id_fkey" FOREIGN KEY ("vote_id") REFERENCES "public"."groupe_votes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groupe_votes"
    ADD CONSTRAINT "groupe_votes_groupe_id_fkey" FOREIGN KEY ("groupe_id") REFERENCES "public"."groupes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groupe_votes"
    ADD CONSTRAINT "groupe_votes_lance_par_fkey" FOREIGN KEY ("lance_par") REFERENCES "public"."groupe_membres"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."guides"
    ADD CONSTRAINT "guides_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."hike_sessions"
    ADD CONSTRAINT "hike_sessions_carnet_id_fkey" FOREIGN KEY ("carnet_id") REFERENCES "public"."carnets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."hike_sessions"
    ADD CONSTRAINT "hike_sessions_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "public"."materiel_kits"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."hike_sessions"
    ADD CONSTRAINT "hike_sessions_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "public"."hiking_routes"("id");



ALTER TABLE ONLY "public"."hike_sessions"
    ADD CONSTRAINT "hike_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hub_telemetry"
    ADD CONSTRAINT "hub_telemetry_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_exports"
    ADD CONSTRAINT "inventory_exports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kit_export_logs"
    ADD CONSTRAINT "kit_export_logs_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "public"."custom_kits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kit_export_logs"
    ADD CONSTRAINT "kit_export_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kit_field_reports"
    ADD CONSTRAINT "kit_field_reports_hike_session_id_fkey" FOREIGN KEY ("hike_session_id") REFERENCES "public"."hike_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kit_field_reports"
    ADD CONSTRAINT "kit_field_reports_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "public"."materiel_kits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kit_field_reports"
    ADD CONSTRAINT "kit_field_reports_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."shop_products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kit_field_reports"
    ADD CONSTRAINT "kit_field_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kit_items"
    ADD CONSTRAINT "kit_items_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "public"."kits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kit_reports"
    ADD CONSTRAINT "kit_reports_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "public"."materiel_kits"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kit_reports"
    ADD CONSTRAINT "kit_reports_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."configurator_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kit_reports"
    ADD CONSTRAINT "kit_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lkv_events"
    ADD CONSTRAINT "lkv_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lkv_events"
    ADD CONSTRAINT "lkv_events_crew_id_fkey" FOREIGN KEY ("crew_id") REFERENCES "public"."travel_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loans"
    ADD CONSTRAINT "loans_gear_item_id_fkey" FOREIGN KEY ("gear_item_id") REFERENCES "public"."gear_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_history"
    ADD CONSTRAINT "loyalty_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_redemptions"
    ADD CONSTRAINT "loyalty_redemptions_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "public"."loyalty_rewards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_redemptions"
    ADD CONSTRAINT "loyalty_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."materiel_history"
    ADD CONSTRAINT "materiel_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."materiel_kit_history"
    ADD CONSTRAINT "materiel_kit_history_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "public"."materiel_kits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."materiel_kit_history"
    ADD CONSTRAINT "materiel_kit_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."materiel_kit_items"
    ADD CONSTRAINT "materiel_kit_items_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "public"."materiel_kits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."materiel_kit_items"
    ADD CONSTRAINT "materiel_kit_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."shop_products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."materiel_kit_items"
    ADD CONSTRAINT "materiel_kit_items_product_ownership_id_fkey" FOREIGN KEY ("product_ownership_id") REFERENCES "public"."product_ownership"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."materiel_kit_items"
    ADD CONSTRAINT "materiel_kit_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."materiel_kits"
    ADD CONSTRAINT "materiel_kits_forked_from_fkey" FOREIGN KEY ("forked_from") REFERENCES "public"."materiel_kits"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."materiel_kits"
    ADD CONSTRAINT "materiel_kits_lineage_root_id_fkey" FOREIGN KEY ("lineage_root_id") REFERENCES "public"."materiel_kits"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."materiel_kits"
    ADD CONSTRAINT "materiel_kits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."materiel_loans"
    ADD CONSTRAINT "materiel_loans_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."materiel_loans"
    ADD CONSTRAINT "materiel_loans_lender_id_fkey" FOREIGN KEY ("lender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."materiel_loans"
    ADD CONSTRAINT "materiel_loans_product_ownership_id_fkey" FOREIGN KEY ("product_ownership_id") REFERENCES "public"."product_ownership"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_attachments"
    ADD CONSTRAINT "message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_mentions"
    ADD CONSTRAINT "message_mentions_mentioned_user_id_fkey" FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_mentions"
    ADD CONSTRAINT "message_mentions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_reactions"
    ADD CONSTRAINT "message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_reactions"
    ADD CONSTRAINT "message_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."moderation_queue"
    ADD CONSTRAINT "moderation_queue_soumis_par_fkey" FOREIGN KEY ("soumis_par") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."moderation_queue"
    ADD CONSTRAINT "moderation_queue_traite_par_fkey" FOREIGN KEY ("traite_par") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification_deliveries"
    ADD CONSTRAINT "notification_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."occasion_items"
    ADD CONSTRAINT "occasion_items_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."occasion_items"
    ADD CONSTRAINT "occasion_items_gear_item_id_fkey" FOREIGN KEY ("gear_item_id") REFERENCES "public"."gear_items"("id");



ALTER TABLE ONLY "public"."occasion_items"
    ADD CONSTRAINT "occasion_items_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."occasion_offers"
    ADD CONSTRAINT "occasion_offers_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."occasion_offers"
    ADD CONSTRAINT "occasion_offers_occasion_item_id_fkey" FOREIGN KEY ("occasion_item_id") REFERENCES "public"."occasion_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."shop_products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pending_contributions"
    ADD CONSTRAINT "pending_contributions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_photos"
    ADD CONSTRAINT "place_photos_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_photos"
    ADD CONSTRAINT "place_photos_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_reports"
    ADD CONSTRAINT "place_reports_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_reports"
    ADD CONSTRAINT "place_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."place_reviews"
    ADD CONSTRAINT "place_reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_reviews"
    ADD CONSTRAINT "place_reviews_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_reviews"
    ADD CONSTRAINT "place_reviews_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."places"
    ADD CONSTRAINT "places_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."places"
    ADD CONSTRAINT "places_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "public"."countries_geo"("iso_a2") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."places_geo"
    ADD CONSTRAINT "places_geo_admin_region_id_fkey" FOREIGN KEY ("admin_region_id") REFERENCES "public"."admin_regions_geo"("id");



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."post_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_ownership"
    ADD CONSTRAINT "product_ownership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promo_codes"
    ADD CONSTRAINT "promo_codes_ambassador_id_fkey" FOREIGN KEY ("ambassador_id") REFERENCES "public"."ambassadors"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."qa_answers"
    ADD CONSTRAINT "qa_answers_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."qa_answers"
    ADD CONSTRAINT "qa_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."qa_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."qa_questions"
    ADD CONSTRAINT "qa_questions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."qa_votes"
    ADD CONSTRAINT "qa_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rental_items"
    ADD CONSTRAINT "rental_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_helpful_votes"
    ADD CONSTRAINT "review_helpful_votes_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_helpful_votes"
    ADD CONSTRAINT "review_helpful_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reward_accounts"
    ADD CONSTRAINT "reward_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reward_config"
    ADD CONSTRAINT "reward_config_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reward_transactions"
    ADD CONSTRAINT "reward_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reward_withdrawals"
    ADD CONSTRAINT "reward_withdrawals_reward_period_fkey" FOREIGN KEY ("reward_period") REFERENCES "public"."reward_periods"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reward_withdrawals"
    ADD CONSTRAINT "reward_withdrawals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_adventures"
    ADD CONSTRAINT "saved_adventures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_trails"
    ADD CONSTRAINT "saved_trails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."share_tokens"
    ADD CONSTRAINT "share_tokens_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "public"."custom_kits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."share_tokens"
    ADD CONSTRAINT "share_tokens_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sos_alerts"
    ADD CONSTRAINT "sos_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."shop_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trail_metadata"
    ADD CONSTRAINT "trail_metadata_trail_id_fkey" FOREIGN KEY ("trail_id") REFERENCES "public"."hiking_routes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trail_scores"
    ADD CONSTRAINT "trail_scores_trail_id_fkey" FOREIGN KEY ("trail_id") REFERENCES "public"."hiking_routes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."travel_groups"
    ADD CONSTRAINT "travel_groups_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."travel_groups"
    ADD CONSTRAINT "travel_groups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_checklist_items"
    ADD CONSTRAINT "trip_checklist_items_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_collaborators"
    ADD CONSTRAINT "trip_collaborators_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_collaborators"
    ADD CONSTRAINT "trip_collaborators_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_collaborators"
    ADD CONSTRAINT "trip_collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_documents"
    ADD CONSTRAINT "trip_documents_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_documents"
    ADD CONSTRAINT "trip_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_expenses"
    ADD CONSTRAINT "trip_expenses_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_expenses"
    ADD CONSTRAINT "trip_expenses_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_items"
    ADD CONSTRAINT "trip_items_packed_by_fkey" FOREIGN KEY ("packed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_items"
    ADD CONSTRAINT "trip_items_shop_product_id_fkey" FOREIGN KEY ("shop_product_id") REFERENCES "public"."shop_products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_items"
    ADD CONSTRAINT "trip_items_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_notes"
    ADD CONSTRAINT "trip_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_notes"
    ADD CONSTRAINT "trip_notes_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_participants"
    ADD CONSTRAINT "trip_participants_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_participants"
    ADD CONSTRAINT "trip_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_pois"
    ADD CONSTRAINT "trip_pois_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "public"."trip_steps"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_pois"
    ADD CONSTRAINT "trip_pois_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_safety_checkpoints"
    ADD CONSTRAINT "trip_safety_checkpoints_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_steps"
    ADD CONSTRAINT "trip_steps_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trips"
    ADD CONSTRAINT "trips_crew_id_fkey" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trips"
    ADD CONSTRAINT "trips_destination_country_code_fkey" FOREIGN KEY ("destination_country_code") REFERENCES "public"."countries_geo"("iso_a2") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trips"
    ADD CONSTRAINT "trips_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."travel_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trips"
    ADD CONSTRAINT "trips_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "public"."materiel_kits"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trips"
    ADD CONSTRAINT "trips_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_addresses"
    ADD CONSTRAINT "user_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_challenges"
    ADD CONSTRAINT "user_challenges_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_challenges"
    ADD CONSTRAINT "user_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_documents"
    ADD CONSTRAINT "user_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_orientation"
    ADD CONSTRAINT "user_orientation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_payment_methods"
    ADD CONSTRAINT "user_payment_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Acheteur et vendeur voient les offres les concernant" ON "public"."occasion_offers" FOR SELECT USING ((("auth"."uid"() = "buyer_id") OR ("auth"."uid"() = ( SELECT "occasion_items"."seller_id"
   FROM "public"."occasion_items"
  WHERE ("occasion_items"."id" = "occasion_offers"."occasion_item_id")))));



CREATE POLICY "Allow admin write on pending_contributions" ON "public"."pending_contributions" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin write on reward_accounts" ON "public"."reward_accounts" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin write on reward_config" ON "public"."reward_config" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin write on reward_periods" ON "public"."reward_periods" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin write on reward_transactions" ON "public"."reward_transactions" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin write on reward_withdrawals" ON "public"."reward_withdrawals" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow public read on reward_config" ON "public"."reward_config" FOR SELECT USING (true);



CREATE POLICY "Allow public read on reward_periods" ON "public"."reward_periods" FOR SELECT USING (true);



CREATE POLICY "Allow users read own pending_contributions" ON "public"."pending_contributions" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "Allow users read own reward_account" ON "public"."reward_accounts" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "Allow users read own transactions" ON "public"."reward_transactions" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "Allow users read own withdrawals" ON "public"."reward_withdrawals" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "Auth delete carnets" ON "public"."carnets" FOR DELETE USING (("auth"."uid"() = "author_id"));



CREATE POLICY "Auth delete club_topics" ON "public"."club_topics" FOR DELETE USING (("auth"."uid"() = "author_id"));



CREATE POLICY "Auth delete clubs" ON "public"."clubs" FOR DELETE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Auth delete community_posts" ON "public"."community_posts" FOR DELETE USING (("auth"."uid"() = "author_id"));



CREATE POLICY "Auth delete post_comments" ON "public"."post_comments" FOR DELETE USING (("auth"."uid"() = "author_id"));



CREATE POLICY "Auth insert ama_questions" ON "public"."ama_questions" FOR INSERT WITH CHECK (("auth"."uid"() = "author_id"));



CREATE POLICY "Auth insert carnets" ON "public"."carnets" FOR INSERT WITH CHECK (("auth"."uid"() = "author_id"));



CREATE POLICY "Auth insert club_events" ON "public"."club_events" FOR INSERT WITH CHECK (("auth"."uid"() = "organizer_id"));



CREATE POLICY "Auth insert club_topic_replies" ON "public"."club_topic_replies" FOR INSERT WITH CHECK (("auth"."uid"() = "author_id"));



CREATE POLICY "Auth insert club_topics" ON "public"."club_topics" FOR INSERT WITH CHECK (("auth"."uid"() = "author_id"));



CREATE POLICY "Auth insert clubs" ON "public"."clubs" FOR INSERT WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Auth insert community_posts" ON "public"."community_posts" FOR INSERT WITH CHECK (("auth"."uid"() = "author_id"));



CREATE POLICY "Auth insert post_comments" ON "public"."post_comments" FOR INSERT WITH CHECK (("auth"."uid"() = "author_id"));



CREATE POLICY "Auth insert qa_answers" ON "public"."qa_answers" FOR INSERT WITH CHECK (("auth"."uid"() = "author_id"));



CREATE POLICY "Auth insert qa_questions" ON "public"."qa_questions" FOR INSERT WITH CHECK (("auth"."uid"() = "author_id"));



CREATE POLICY "Auth manage club_challenge_entries" ON "public"."club_challenge_entries" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Auth manage club_members" ON "public"."club_members" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Auth manage occasion_items" ON "public"."occasion_items" USING (("auth"."uid"() = "seller_id")) WITH CHECK (("auth"."uid"() = "seller_id"));



CREATE POLICY "Auth manage post_likes" ON "public"."post_likes" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Auth manage qa_votes" ON "public"."qa_votes" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Auth manage rental_items" ON "public"."rental_items" USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Auth manage user_challenges" ON "public"."user_challenges" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Auth manage user_follows" ON "public"."user_follows" USING (("auth"."uid"() = "follower_id")) WITH CHECK (("auth"."uid"() = "follower_id"));



CREATE POLICY "Auth update carnets" ON "public"."carnets" FOR UPDATE USING (("auth"."uid"() = "author_id")) WITH CHECK (("auth"."uid"() = "author_id"));



CREATE POLICY "Auth update club_topics" ON "public"."club_topics" FOR UPDATE USING (("auth"."uid"() = "author_id")) WITH CHECK (("auth"."uid"() = "author_id"));



CREATE POLICY "Auth update clubs" ON "public"."clubs" FOR UPDATE USING (("auth"."uid"() = "created_by")) WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Auth update community_posts" ON "public"."community_posts" FOR UPDATE USING (("auth"."uid"() = "author_id")) WITH CHECK (("auth"."uid"() = "author_id"));



CREATE POLICY "Auth update qa_answers" ON "public"."qa_answers" FOR UPDATE USING (("auth"."uid"() = "author_id")) WITH CHECK (("auth"."uid"() = "author_id"));



CREATE POLICY "Auth update qa_questions" ON "public"."qa_questions" FOR UPDATE USING (("auth"."uid"() = "author_id")) WITH CHECK (("auth"."uid"() = "author_id"));



CREATE POLICY "L auteur du carnet gère ses médias" ON "public"."carnet_media" USING (("auth"."uid"() = ( SELECT "carnets"."author_id"
   FROM "public"."carnets"
  WHERE ("carnets"."id" = "carnet_media"."carnet_id")))) WITH CHECK (("auth"."uid"() = ( SELECT "carnets"."author_id"
   FROM "public"."carnets"
  WHERE ("carnets"."id" = "carnet_media"."carnet_id"))));



CREATE POLICY "L'acheteur crée ses offres" ON "public"."occasion_offers" FOR INSERT WITH CHECK (("auth"."uid"() = "buyer_id"));



CREATE POLICY "Le vendeur répond aux offres" ON "public"."occasion_offers" FOR UPDATE USING (("auth"."uid"() = ( SELECT "occasion_items"."seller_id"
   FROM "public"."occasion_items"
  WHERE ("occasion_items"."id" = "occasion_offers"."occasion_item_id"))));



CREATE POLICY "Public read ama_questions" ON "public"."ama_questions" FOR SELECT USING (true);



CREATE POLICY "Public read ama_sessions" ON "public"."ama_sessions" FOR SELECT USING (true);



CREATE POLICY "Public read carnets" ON "public"."carnets" FOR SELECT USING ((("visibility" = 'public'::"text") OR ("auth"."uid"() = "author_id")));



CREATE POLICY "Public read club_challenge_entries" ON "public"."club_challenge_entries" FOR SELECT USING (true);



CREATE POLICY "Public read club_challenges" ON "public"."club_challenges" FOR SELECT USING (true);



CREATE POLICY "Public read club_events" ON "public"."club_events" FOR SELECT USING (true);



CREATE POLICY "Public read club_members" ON "public"."club_members" FOR SELECT USING (true);



CREATE POLICY "Public read club_recommended_kits" ON "public"."club_recommended_kits" FOR SELECT USING (true);



CREATE POLICY "Public read club_topic_replies" ON "public"."club_topic_replies" FOR SELECT USING (true);



CREATE POLICY "Public read clubs" ON "public"."clubs" FOR SELECT USING ((("privacy" <> 'secret'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."club_members" "cm"
  WHERE (("cm"."club_id" = "clubs"."id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."status" = 'active'::"text"))))));



CREATE POLICY "Public read community_posts" ON "public"."community_posts" FOR SELECT USING (true);



CREATE POLICY "Public read hiking_routes" ON "public"."hiking_routes" FOR SELECT USING (true);



CREATE POLICY "Public read occasion_items" ON "public"."occasion_items" FOR SELECT USING (true);



CREATE POLICY "Public read post_comments" ON "public"."post_comments" FOR SELECT USING (true);



CREATE POLICY "Public read post_likes" ON "public"."post_likes" FOR SELECT USING (true);



CREATE POLICY "Public read qa_answers" ON "public"."qa_answers" FOR SELECT USING (true);



CREATE POLICY "Public read qa_questions" ON "public"."qa_questions" FOR SELECT USING (true);



CREATE POLICY "Public read qa_votes" ON "public"."qa_votes" FOR SELECT USING (true);



CREATE POLICY "Public read rental_items" ON "public"."rental_items" FOR SELECT USING (true);



CREATE POLICY "Public read trail_metadata" ON "public"."trail_metadata" FOR SELECT USING (true);



CREATE POLICY "Public read trail_pois" ON "public"."trail_pois" FOR SELECT USING (true);



CREATE POLICY "Public read trail_scores" ON "public"."trail_scores" FOR SELECT USING (true);



CREATE POLICY "Public read user_badges" ON "public"."user_badges" FOR SELECT USING (true);



CREATE POLICY "Public read user_challenges" ON "public"."user_challenges" FOR SELECT USING (true);



CREATE POLICY "Public read user_follows" ON "public"."user_follows" FOR SELECT USING (true);



CREATE POLICY "Public read user_profiles" ON "public"."user_profiles" FOR SELECT USING (true);



CREATE POLICY "Un utilisateur gère ses propres activités" ON "public"."activities" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Un utilisateur gère ses propres alertes SOS" ON "public"."sos_alerts" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Un utilisateur modifie ses propres notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Un utilisateur supprime ses propres notifications" ON "public"."notifications" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Un utilisateur voit ses propres notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own notifications" ON "public"."notifications" FOR DELETE USING ((("auth"."uid"() = "user_id") OR "public"."is_admin"()));



CREATE POLICY "Users can delete own preferences" ON "public"."notification_preferences" FOR DELETE USING ((("auth"."uid"() = "user_id") OR "public"."is_admin"()));



CREATE POLICY "Users can insert own preferences" ON "public"."notification_preferences" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") OR "public"."is_admin"()));



CREATE POLICY "Users can manage own gear items" ON "public"."gear_items" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can manage own push subscriptions" ON "public"."push_subscriptions" USING ((("auth"."uid"() = "user_id") OR "public"."is_admin"())) WITH CHECK ((("auth"."uid"() = "user_id") OR "public"."is_admin"()));



CREATE POLICY "Users can read own notifications" ON "public"."notifications" FOR SELECT USING ((("auth"."uid"() = "user_id") OR "public"."is_admin"()));



CREATE POLICY "Users can read own preferences" ON "public"."notification_preferences" FOR SELECT USING ((("auth"."uid"() = "user_id") OR "public"."is_admin"()));



CREATE POLICY "Users can update own notifications" ON "public"."notifications" FOR UPDATE USING ((("auth"."uid"() = "user_id") OR "public"."is_admin"()));



CREATE POLICY "Users can update own preferences" ON "public"."notification_preferences" FOR UPDATE USING ((("auth"."uid"() = "user_id") OR "public"."is_admin"()));



CREATE POLICY "Users insert own profile" ON "public"."user_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users manage own custom_kit_items" ON "public"."custom_kit_items" USING (("kit_id" IN ( SELECT "custom_kits"."id"
   FROM "public"."custom_kits"
  WHERE ("custom_kits"."user_id" = "auth"."uid"())))) WITH CHECK (("kit_id" IN ( SELECT "custom_kits"."id"
   FROM "public"."custom_kits"
  WHERE ("custom_kits"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users manage own custom_kits" ON "public"."custom_kits" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users update own profile" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_insert_audit_logs" ON "public"."admin_audit_logs" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_insert_conversation_members" ON "public"."conversation_members" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_conv_admin"("conversation_id", "auth"."uid"()));



CREATE POLICY "admin_insert_stock_movements" ON "public"."stock_movements" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_manage_badges" ON "public"."badges" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_manage_challenges" ON "public"."challenges" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_manage_kits" ON "public"."kits" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_manage_loyalty_rewards" ON "public"."loyalty_rewards" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_manage_product_images" ON "public"."product_images" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_read_audit_logs" ON "public"."admin_audit_logs" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



ALTER TABLE "public"."admin_regions_geo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_select_activities" ON "public"."activities" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "admin_update_conversations" ON "public"."conversations" FOR UPDATE TO "authenticated" USING ("public"."is_conv_admin"("id", "auth"."uid"())) WITH CHECK ("public"."is_conv_admin"("id", "auth"."uid"()));



CREATE POLICY "admin_write_alternatives" ON "public"."product_alternatives" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_write_compatibilities" ON "public"."product_compatibilities" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_write_listings" ON "public"."listings" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_write_products" ON "public"."products" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_write_shop_products" ON "public"."shop_products" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins_insert_audit_log" ON "public"."admin_audit_log" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_moderateur"());



CREATE POLICY "admins_manage_admin_roles" ON "public"."admin_roles" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins_manage_country_sync_log" ON "public"."country_sync_log" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins_read_audit_log" ON "public"."admin_audit_log" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



ALTER TABLE "public"."affiliate_clicks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "affiliate_clicks_all_service" ON "public"."affiliate_clicks" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "affiliate_clicks_insert_all" ON "public"."affiliate_clicks" FOR INSERT WITH CHECK (true);



CREATE POLICY "affiliate_clicks_public_read" ON "public"."affiliate_clicks" USING (true);



CREATE POLICY "affiliate_clicks_select_service" ON "public"."affiliate_clicks" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "affiliate_clicks_service_write" ON "public"."affiliate_clicks" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."affiliate_conversions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "affiliate_conversions_all_service" ON "public"."affiliate_conversions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "affiliate_conversions_public_read" ON "public"."affiliate_conversions" USING (true);



CREATE POLICY "affiliate_conversions_service_write" ON "public"."affiliate_conversions" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."affiliate_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "affiliate_links_all_service" ON "public"."affiliate_links" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "affiliate_links_select_public" ON "public"."affiliate_links" FOR SELECT USING (("is_active" = true));



ALTER TABLE "public"."affiliate_offers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "affiliate_offers_public_read" ON "public"."affiliate_offers" USING (true);



CREATE POLICY "affiliate_offers_service_write" ON "public"."affiliate_offers" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."affiliate_partners" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "affiliate_partners_all_service" ON "public"."affiliate_partners" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "affiliate_partners_public_read" ON "public"."affiliate_partners" USING (true);



CREATE POLICY "affiliate_partners_select_public" ON "public"."affiliate_partners" FOR SELECT USING (true);



CREATE POLICY "affiliate_partners_service_write" ON "public"."affiliate_partners" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."affiliate_programs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "affiliate_programs_public_read" ON "public"."affiliate_programs" USING (true);



CREATE POLICY "affiliate_programs_service_write" ON "public"."affiliate_programs" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."ai_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_jobs_insert_own" ON "public"."ai_jobs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "ai_jobs_select_own" ON "public"."ai_jobs" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."ai_response_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_response_cache_select_false" ON "public"."ai_response_cache" FOR SELECT USING (false);



ALTER TABLE "public"."ai_usage_daily" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_usage_daily_select_own" ON "public"."ai_usage_daily" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "album_member_all" ON "public"."group_album" TO "authenticated" USING ("public"."is_group_member"("group_id", "auth"."uid"())) WITH CHECK ((("uploaded_by" = "auth"."uid"()) AND "public"."is_group_member"("group_id", "auth"."uid"())));



ALTER TABLE "public"."alerts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "alerts_delete_own" ON "public"."alerts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "alerts_insert_own" ON "public"."alerts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "alerts_select_own" ON "public"."alerts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "alerts_update_own" ON "public"."alerts" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."ama_questions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ama_questions_insert" ON "public"."ama_questions" FOR INSERT TO "authenticated" WITH CHECK (("author_id" = "auth"."uid"()));



ALTER TABLE "public"."ama_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ama_sessions_read" ON "public"."ama_sessions" FOR SELECT USING (true);



ALTER TABLE "public"."ama_votes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ama_votes_manage" ON "public"."ama_votes" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."ambassadors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "anon_read_profiles_basic" ON "public"."user_profiles" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."auction_auto_bids" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "auction_auto_bids_owner" ON "public"."auction_auto_bids" TO "authenticated" USING (("bidder_id" = "auth"."uid"())) WITH CHECK (("bidder_id" = "auth"."uid"()));



ALTER TABLE "public"."auction_bids" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "auction_bids_public_read" ON "public"."auction_bids" FOR SELECT USING (true);



CREATE POLICY "auction_bids_user_insert" ON "public"."auction_bids" FOR INSERT TO "authenticated" WITH CHECK (("bidder_id" = "auth"."uid"()));



CREATE POLICY "auth_delete_clubs" ON "public"."clubs" FOR DELETE TO "authenticated" USING ((("auth"."uid"() = "created_by") OR "public"."is_admin"()));



CREATE POLICY "auth_delete_event_participants" ON "public"."event_participants" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "auth_delete_groupe_etapes" ON "public"."groupe_etapes" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."groupe_membres"
  WHERE (("groupe_membres"."groupe_id" = "groupe_etapes"."groupe_id") AND ("groupe_membres"."user_id" = "auth"."uid"())))));



CREATE POLICY "auth_delete_groupe_hebergements" ON "public"."groupe_hebergements" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."groupe_membres"
  WHERE (("groupe_membres"."groupe_id" = "groupe_hebergements"."groupe_id") AND ("groupe_membres"."user_id" = "auth"."uid"())))));



CREATE POLICY "auth_delete_groupe_taches" ON "public"."groupe_taches" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."groupe_membres"
  WHERE (("groupe_membres"."groupe_id" = "groupe_taches"."groupe_id") AND ("groupe_membres"."user_id" = "auth"."uid"())))));



CREATE POLICY "auth_delete_groupes" ON "public"."groupes" FOR DELETE TO "authenticated" USING ((("auth"."uid"() = "created_by") OR "public"."is_admin"()));



CREATE POLICY "auth_delete_own_community_posts" ON "public"."community_posts" FOR DELETE TO "authenticated" USING (("author_id" = "auth"."uid"()));



CREATE POLICY "auth_delete_own_groupe_activites" ON "public"."groupe_activites" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "membre_id"));



CREATE POLICY "auth_delete_own_groupe_depense_parts" ON "public"."groupe_depense_parts" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "membre_id"));



CREATE POLICY "auth_delete_own_groupe_depenses" ON "public"."groupe_depenses" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "payeur_id"));



CREATE POLICY "auth_delete_own_groupe_equipement" ON "public"."groupe_equipement" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "apporte_par"));



CREATE POLICY "auth_delete_own_groupe_messages" ON "public"."groupe_messages" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "auteur_id"));



CREATE POLICY "auth_delete_own_groupe_vote_choix" ON "public"."groupe_vote_choix" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "membre_id"));



CREATE POLICY "auth_delete_own_groupe_votes" ON "public"."groupe_votes" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "lance_par"));



CREATE POLICY "auth_delete_own_post_comments" ON "public"."post_comments" FOR DELETE TO "authenticated" USING (("author_id" = "auth"."uid"()));



CREATE POLICY "auth_insert_ama_questions" ON "public"."ama_questions" FOR INSERT TO "authenticated" WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "auth_insert_ambassadors" ON "public"."ambassadors" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "auth_insert_club_challenges" ON "public"."club_challenges" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."club_members"
  WHERE (("club_members"."club_id" = "club_challenges"."club_id") AND ("club_members"."user_id" = "auth"."uid"())))) OR "public"."is_admin"()));



CREATE POLICY "auth_insert_clubs" ON "public"."clubs" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "auth_insert_community_posts" ON "public"."community_posts" FOR INSERT TO "authenticated" WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "auth_insert_event_participants" ON "public"."event_participants" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "auth_insert_events" ON "public"."events" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "organizer_id"));



CREATE POLICY "auth_insert_expedition_reports" ON "public"."expedition_reports" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "auth_insert_expert_bookings" ON "public"."expert_bookings" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "auth_insert_groupe_activites" ON "public"."groupe_activites" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "membre_id") AND (EXISTS ( SELECT 1
   FROM "public"."groupe_membres"
  WHERE (("groupe_membres"."groupe_id" = "groupe_activites"."groupe_id") AND ("groupe_membres"."user_id" = "auth"."uid"()))))));



CREATE POLICY "auth_insert_groupe_depense_parts" ON "public"."groupe_depense_parts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "membre_id"));



CREATE POLICY "auth_insert_groupe_depenses" ON "public"."groupe_depenses" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "payeur_id") AND (EXISTS ( SELECT 1
   FROM "public"."groupe_membres"
  WHERE (("groupe_membres"."groupe_id" = "groupe_depenses"."groupe_id") AND ("groupe_membres"."user_id" = "auth"."uid"()))))));



CREATE POLICY "auth_insert_groupe_equipement" ON "public"."groupe_equipement" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "apporte_par") AND (EXISTS ( SELECT 1
   FROM "public"."groupe_membres"
  WHERE (("groupe_membres"."groupe_id" = "groupe_equipement"."groupe_id") AND ("groupe_membres"."user_id" = "auth"."uid"()))))));



CREATE POLICY "auth_insert_groupe_etapes" ON "public"."groupe_etapes" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."groupe_membres"
  WHERE (("groupe_membres"."groupe_id" = "groupe_etapes"."groupe_id") AND ("groupe_membres"."user_id" = "auth"."uid"())))));



CREATE POLICY "auth_insert_groupe_hebergements" ON "public"."groupe_hebergements" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."groupe_membres"
  WHERE (("groupe_membres"."groupe_id" = "groupe_hebergements"."groupe_id") AND ("groupe_membres"."user_id" = "auth"."uid"())))));



CREATE POLICY "auth_insert_groupe_messages" ON "public"."groupe_messages" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "auteur_id") AND (EXISTS ( SELECT 1
   FROM "public"."groupe_membres"
  WHERE (("groupe_membres"."groupe_id" = "groupe_messages"."groupe_id") AND ("groupe_membres"."user_id" = "auth"."uid"()))))));



CREATE POLICY "auth_insert_groupe_taches" ON "public"."groupe_taches" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."groupe_membres"
  WHERE (("groupe_membres"."groupe_id" = "groupe_taches"."groupe_id") AND ("groupe_membres"."user_id" = "auth"."uid"())))));



CREATE POLICY "auth_insert_groupe_vote_choix" ON "public"."groupe_vote_choix" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "membre_id"));



CREATE POLICY "auth_insert_groupe_vote_options" ON "public"."groupe_vote_options" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."groupe_votes"
  WHERE (("groupe_votes"."id" = "groupe_vote_options"."vote_id") AND (EXISTS ( SELECT 1
           FROM "public"."groupe_membres"
          WHERE (("groupe_membres"."groupe_id" = "groupe_votes"."groupe_id") AND ("groupe_membres"."user_id" = "auth"."uid"()))))))));



CREATE POLICY "auth_insert_groupe_votes" ON "public"."groupe_votes" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."groupe_membres"
  WHERE (("groupe_membres"."groupe_id" = "groupe_votes"."groupe_id") AND ("groupe_membres"."user_id" = "auth"."uid"())))));



CREATE POLICY "auth_insert_groupes" ON "public"."groupes" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "auth_insert_loyalty_history" ON "public"."loyalty_history" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "auth_insert_loyalty_redemptions" ON "public"."loyalty_redemptions" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "auth_insert_own_gear_history" ON "public"."gear_history" FOR INSERT TO "authenticated" WITH CHECK (("gear_item_id" IN ( SELECT "gear_items"."id"
   FROM "public"."gear_items"
  WHERE ("gear_items"."user_id" = "auth"."uid"()))));



CREATE POLICY "auth_insert_post_comments" ON "public"."post_comments" FOR INSERT TO "authenticated" WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "auth_insert_product_reviews" ON "public"."product_reviews" FOR INSERT TO "authenticated" WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "auth_insert_qa_answers" ON "public"."qa_answers" FOR INSERT TO "authenticated" WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "auth_insert_qa_questions" ON "public"."qa_questions" FOR INSERT TO "authenticated" WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "auth_insert_reviews" ON "public"."reviews" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "auth_join_groupe" ON "public"."groupe_membres" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "auth_leave_groupe" ON "public"."groupe_membres" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "auth_like_community_posts" ON "public"."community_posts" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_manage_ambassadors" ON "public"."ambassadors" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_manage_carnet_kit_items" ON "public"."carnet_kit_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."carnets"
  WHERE (("carnets"."id" = "carnet_kit_items"."carnet_id") AND ("carnets"."author_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."carnets"
  WHERE (("carnets"."id" = "carnet_kit_items"."carnet_id") AND ("carnets"."author_id" = "auth"."uid"())))));



CREATE POLICY "auth_manage_carnet_moments" ON "public"."carnet_moments" TO "authenticated" USING (("auth"."uid"() = "auteur_id")) WITH CHECK (("auth"."uid"() = "auteur_id"));



CREATE POLICY "auth_manage_event_expenses" ON "public"."event_expenses" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_manage_events" ON "public"."events" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_manage_expedition_reports" ON "public"."expedition_reports" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "auth_manage_experts" ON "public"."experts" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_manage_guides" ON "public"."guides" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_manage_kit_items" ON "public"."kit_items" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_manage_own_follows" ON "public"."user_follows" TO "authenticated" USING (("follower_id" = "auth"."uid"())) WITH CHECK (("follower_id" = "auth"."uid"()));



CREATE POLICY "auth_manage_own_occasion_items" ON "public"."occasion_items" TO "authenticated" USING (("seller_id" = "auth"."uid"())) WITH CHECK (("seller_id" = "auth"."uid"()));



CREATE POLICY "auth_manage_own_post_comments" ON "public"."post_comments" TO "authenticated" USING (("author_id" = "auth"."uid"())) WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "auth_manage_own_post_likes" ON "public"."post_likes" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "auth_manage_own_qa_answers" ON "public"."qa_answers" TO "authenticated" USING (("author_id" = "auth"."uid"())) WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "auth_manage_own_qa_questions" ON "public"."qa_questions" TO "authenticated" USING (("author_id" = "auth"."uid"())) WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "auth_manage_own_user_badges" ON "public"."user_badges" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "auth_manage_own_user_challenges" ON "public"."user_challenges" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "auth_manage_promo_codes" ON "public"."promo_codes" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_manage_rentals" ON "public"."rental_items" TO "authenticated" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "auth_read_expert_bookings" ON "public"."expert_bookings" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "auth_read_gear_history" ON "public"."gear_history" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth_read_gear_images" ON "public"."gear_images" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth_read_loans" ON "public"."loans" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth_read_own_loyalty_history" ON "public"."loyalty_history" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "auth_read_own_loyalty_redemptions" ON "public"."loyalty_redemptions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "auth_update_clubs" ON "public"."clubs" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "created_by") OR "public"."is_admin"()));



CREATE POLICY "auth_update_events" ON "public"."events" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "organizer_id") OR "public"."is_admin"()));



CREATE POLICY "auth_update_groupe_etapes" ON "public"."groupe_etapes" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."groupe_membres"
  WHERE (("groupe_membres"."groupe_id" = "groupe_etapes"."groupe_id") AND ("groupe_membres"."user_id" = "auth"."uid"())))));



CREATE POLICY "auth_update_groupe_hebergements" ON "public"."groupe_hebergements" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."groupe_membres"
  WHERE (("groupe_membres"."groupe_id" = "groupe_hebergements"."groupe_id") AND ("groupe_membres"."user_id" = "auth"."uid"())))));



CREATE POLICY "auth_update_groupe_taches" ON "public"."groupe_taches" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."groupe_membres"
  WHERE (("groupe_membres"."groupe_id" = "groupe_taches"."groupe_id") AND ("groupe_membres"."user_id" = "auth"."uid"())))));



CREATE POLICY "auth_update_groupes" ON "public"."groupes" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "created_by") OR "public"."is_admin"()));



CREATE POLICY "auth_update_own_community_posts" ON "public"."community_posts" FOR UPDATE TO "authenticated" USING (("author_id" = "auth"."uid"())) WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "auth_update_own_groupe_depenses" ON "public"."groupe_depenses" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "payeur_id"));



CREATE POLICY "auth_update_own_groupe_equipement" ON "public"."groupe_equipement" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "apporte_par"));



CREATE POLICY "auth_update_own_groupe_votes" ON "public"."groupe_votes" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "lance_par"));



CREATE POLICY "auth_update_own_membership" ON "public"."groupe_membres" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "auth_update_reviews" ON "public"."reviews" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."badges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "carnet_collab_manage" ON "public"."carnet_collaborators" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."carnet_collaborators" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "carnet_collaborators_read_scoped" ON "public"."carnet_collaborators" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."carnets" "c"
  WHERE (("c"."id" = "carnet_collaborators"."carnet_id") AND (("c"."visibility" = 'public'::"text") OR ("c"."author_id" = "auth"."uid"()))))) OR ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."carnet_comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "carnet_comments_manage" ON "public"."carnet_comments" TO "authenticated" USING (("author_id" = "auth"."uid"())) WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "carnet_comments_read_scoped" ON "public"."carnet_comments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."carnets" "c"
  WHERE (("c"."id" = "carnet_comments"."carnet_id") AND (("c"."visibility" = 'public'::"text") OR ("c"."author_id" = "auth"."uid"()))))));



ALTER TABLE "public"."carnet_favorites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "carnet_favorites_manage" ON "public"."carnet_favorites" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "carnet_favorites_read_scoped" ON "public"."carnet_favorites" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."carnets" "c"
  WHERE (("c"."id" = "carnet_favorites"."carnet_id") AND (("c"."visibility" = 'public'::"text") OR ("c"."author_id" = "auth"."uid"()))))) OR ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."carnet_gear_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "carnet_gear_links_read_scoped" ON "public"."carnet_gear_links" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."carnets" "c"
  WHERE (("c"."id" = "carnet_gear_links"."carnet_id") AND (("c"."visibility" = 'public'::"text") OR ("c"."author_id" = "auth"."uid"()))))));



CREATE POLICY "carnet_gear_manage" ON "public"."carnet_gear_links" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."carnet_kit_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "carnet_kit_items_read_scoped" ON "public"."carnet_kit_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."carnets" "c"
  WHERE (("c"."id" = "carnet_kit_items"."carnet_id") AND (("c"."visibility" = 'public'::"text") OR ("c"."author_id" = "auth"."uid"()))))));



ALTER TABLE "public"."carnet_likes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "carnet_likes_manage" ON "public"."carnet_likes" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "carnet_likes_read_scoped" ON "public"."carnet_likes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."carnets" "c"
  WHERE (("c"."id" = "carnet_likes"."carnet_id") AND (("c"."visibility" = 'public'::"text") OR ("c"."author_id" = "auth"."uid"()))))));



ALTER TABLE "public"."carnet_media" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "carnet_media_read_scoped" ON "public"."carnet_media" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."carnets" "c"
  WHERE (("c"."id" = "carnet_media"."carnet_id") AND (("c"."visibility" = 'public'::"text") OR ("c"."author_id" = "auth"."uid"()))))));



ALTER TABLE "public"."carnet_moments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "carnet_moments_read_scoped" ON "public"."carnet_moments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."carnets" "c"
  WHERE (("c"."id" = "carnet_moments"."carnet_id") AND (("c"."visibility" = 'public'::"text") OR ("c"."author_id" = "auth"."uid"()))))));



ALTER TABLE "public"."carnet_views" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."carnets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "carnets_auth_read" ON "public"."carnets" FOR SELECT TO "authenticated" USING ((("visibility" = 'public'::"text") OR ("author_id" = "auth"."uid"())));



CREATE POLICY "carnets_owner_manage" ON "public"."carnets" TO "authenticated" USING (("author_id" = "auth"."uid"())) WITH CHECK (("author_id" = "auth"."uid"()));



ALTER TABLE "public"."cart_loyalty_discounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."checkout_intents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "checkout_intents_service_all" ON "public"."checkout_intents" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."club_challenge_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_challenge_entries_manage" ON "public"."club_challenge_entries" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "club_challenge_entries_read" ON "public"."club_challenge_entries" FOR SELECT USING (true);



ALTER TABLE "public"."club_challenges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_challenges_manage" ON "public"."club_challenges" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "club_challenges_read" ON "public"."club_challenges" FOR SELECT USING (true);



ALTER TABLE "public"."club_event_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."club_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_events_manage" ON "public"."club_events" TO "authenticated" USING (("organizer_id" = "auth"."uid"())) WITH CHECK (("organizer_id" = "auth"."uid"()));



CREATE POLICY "club_events_read" ON "public"."club_events" FOR SELECT USING (true);



ALTER TABLE "public"."club_join_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_join_requests_insert" ON "public"."club_join_requests" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "club_join_requests_moderate" ON "public"."club_join_requests" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."club_members" "cm"
  WHERE (("cm"."club_id" = "club_join_requests"."club_id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."status" = 'active'::"text") AND ("cm"."role" = ANY (ARRAY['admin'::"text", 'moderator'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."club_members" "cm"
  WHERE (("cm"."club_id" = "club_join_requests"."club_id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."status" = 'active'::"text") AND ("cm"."role" = ANY (ARRAY['admin'::"text", 'moderator'::"text"]))))));



CREATE POLICY "club_join_requests_select" ON "public"."club_join_requests" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."club_members" "cm"
  WHERE (("cm"."club_id" = "club_join_requests"."club_id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."status" = 'active'::"text"))))));



CREATE POLICY "club_join_requests_self_update" ON "public"."club_join_requests" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND ("status" = 'pending'::"text")));



CREATE POLICY "club_kits_manage" ON "public"."club_recommended_kits" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "club_kits_read" ON "public"."club_recommended_kits" FOR SELECT USING (true);



ALTER TABLE "public"."club_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_members_admin_insert" ON "public"."club_members" FOR INSERT TO "authenticated" WITH CHECK ((("role" = 'member'::"text") AND ("status" = 'active'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."club_members" "cm"
  WHERE (("cm"."club_id" = "club_members"."club_id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."status" = 'active'::"text") AND ("cm"."role" = ANY (ARRAY['admin'::"text", 'moderator'::"text"])))))));



CREATE POLICY "club_members_admin_moderate" ON "public"."club_members" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."club_members" "cm"
  WHERE (("cm"."club_id" = "club_members"."club_id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."status" = 'active'::"text") AND ("cm"."role" = ANY (ARRAY['admin'::"text", 'moderator'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."club_members" "cm"
  WHERE (("cm"."club_id" = "club_members"."club_id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."status" = 'active'::"text") AND ("cm"."role" = ANY (ARRAY['admin'::"text", 'moderator'::"text"]))))));



CREATE POLICY "club_members_creator_admin" ON "public"."club_members" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ("role" = 'admin'::"text") AND ("status" = 'active'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."clubs" "c"
  WHERE (("c"."id" = "club_members"."club_id") AND ("c"."created_by" = "auth"."uid"()))))));



CREATE POLICY "club_members_read" ON "public"."club_members" FOR SELECT USING (true);



CREATE POLICY "club_members_self_delete" ON "public"."club_members" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "club_members_self_join" ON "public"."club_members" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ("role" = 'member'::"text") AND ("status" = 'active'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."clubs" "c"
  WHERE (("c"."id" = "club_members"."club_id") AND ("c"."privacy" = 'open'::"text"))))));



ALTER TABLE "public"."club_recommended_kits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_replies_manage" ON "public"."club_topic_replies" TO "authenticated" USING (("author_id" = "auth"."uid"())) WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "club_replies_read" ON "public"."club_topic_replies" FOR SELECT USING (("is_approved" = true));



ALTER TABLE "public"."club_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_reports_manage" ON "public"."club_reports" TO "authenticated" USING (("reporter_id" = "auth"."uid"())) WITH CHECK (("reporter_id" = "auth"."uid"()));



ALTER TABLE "public"."club_topic_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."club_topic_replies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."club_topics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_topics_insert" ON "public"."club_topics" FOR INSERT TO "authenticated" WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "club_topics_manage" ON "public"."club_topics" TO "authenticated" USING (("author_id" = "auth"."uid"())) WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "club_topics_read" ON "public"."club_topics" FOR SELECT USING (("is_approved" = true));



ALTER TABLE "public"."clubs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clubs_auth_insert" ON "public"."clubs" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "clubs_auth_manage" ON "public"."clubs" TO "authenticated" USING (("created_by" = "auth"."uid"())) WITH CHECK (("created_by" = "auth"."uid"()));



ALTER TABLE "public"."comment_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comment_reports_insert_own" ON "public"."comment_reports" FOR INSERT TO "authenticated" WITH CHECK (("reporter_id" = "auth"."uid"()));



CREATE POLICY "comment_reports_select" ON "public"."comment_reports" FOR SELECT USING (true);



ALTER TABLE "public"."community_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."configurator_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."countries_content" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "countries_content_public_read" ON "public"."countries_content" FOR SELECT USING (("status" = 'published'::"text"));



ALTER TABLE "public"."countries_geo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."country_content_blocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "country_content_blocks_public_read" ON "public"."country_content_blocks" FOR SELECT TO "authenticated", "anon" USING (((("needs_human_review" = false) OR ("reviewed_at" IS NOT NULL)) AND ("degraded" = false)));



CREATE POLICY "country_content_blocks_service_write" ON "public"."country_content_blocks" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."country_practical_guides" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "country_practical_guides_public_read" ON "public"."country_practical_guides" FOR SELECT USING (true);



CREATE POLICY "country_practical_guides_service_write" ON "public"."country_practical_guides" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."country_sync_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "country_sync_log_public_read" ON "public"."country_sync_log" FOR SELECT USING (true);



CREATE POLICY "country_sync_log_service_write" ON "public"."country_sync_log" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."crew_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "crew_members_delete_policy" ON "public"."crew_members" FOR DELETE USING (("public"."lkv_can"("auth"."uid"(), 'crew_members'::"text", "crew_id", 'delete'::"text") OR ("auth"."uid"() = "user_id")));



CREATE POLICY "crew_members_insert_policy" ON "public"."crew_members" FOR INSERT WITH CHECK ("public"."lkv_can"("auth"."uid"(), 'crew_members'::"text", "crew_id", 'insert'::"text"));



CREATE POLICY "crew_members_select_policy" ON "public"."crew_members" FOR SELECT USING ("public"."lkv_can"("auth"."uid"(), 'crews'::"text", "crew_id", 'select'::"text"));



CREATE POLICY "crew_members_update_policy" ON "public"."crew_members" FOR UPDATE USING ("public"."lkv_can"("auth"."uid"(), 'crew_members'::"text", "crew_id", 'update'::"text"));



ALTER TABLE "public"."crews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "crews_delete_policy" ON "public"."crews" FOR DELETE USING ("public"."lkv_can"("auth"."uid"(), 'crews'::"text", "id", 'delete'::"text"));



CREATE POLICY "crews_insert_policy" ON "public"."crews" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("auth"."uid"() = "created_by")));



CREATE POLICY "crews_select_policy" ON "public"."crews" FOR SELECT USING ("public"."lkv_can"("auth"."uid"(), 'crews'::"text", "id", 'select'::"text"));



CREATE POLICY "crews_update_policy" ON "public"."crews" FOR UPDATE USING ("public"."lkv_can"("auth"."uid"(), 'crews'::"text", "id", 'update'::"text"));



ALTER TABLE "public"."custom_kit_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_kits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."depart_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "depart_participants_delete_own" ON "public"."depart_participants" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "depart_participants_insert_own" ON "public"."depart_participants" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "depart_participants_select_own" ON "public"."depart_participants" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."destination_steps" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "destination_steps_modify_service" ON "public"."destination_steps" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "destination_steps_select_public" ON "public"."destination_steps" FOR SELECT USING (true);



ALTER TABLE "public"."event_expenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_participants_delete" ON "public"."club_event_participants" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "event_participants_insert" ON "public"."club_event_participants" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "event_participants_read" ON "public"."club_event_participants" FOR SELECT USING (true);



ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expedition_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expenses_member_all" ON "public"."group_expenses" TO "authenticated" USING ("public"."is_group_member"("group_id", "auth"."uid"())) WITH CHECK (("public"."is_group_member"("group_id", "auth"."uid"()) AND (("paid_by" IS NULL) OR ("paid_by" = "auth"."uid"()) OR "public"."is_group_member"("group_id", "auth"."uid"()))));



CREATE POLICY "expenses_select_public_or_member" ON "public"."group_expenses" FOR SELECT USING (("public"."is_group_public"("group_id") OR (("auth"."uid"() IS NOT NULL) AND "public"."is_group_member"("group_id", "auth"."uid"()))));



ALTER TABLE "public"."expert_bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."experts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feature_flags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feature_flags_select_all_authenticated" ON "public"."feature_flags" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "field_reports_delete_own" ON "public"."kit_field_reports" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "field_reports_insert_own" ON "public"."kit_field_reports" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "field_reports_select_own" ON "public"."kit_field_reports" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "field_reports_update_own" ON "public"."kit_field_reports" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."gear_alert_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gear_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gear_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gear_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "geo_admin_regions_public_read" ON "public"."admin_regions_geo" FOR SELECT USING (true);



CREATE POLICY "geo_admin_regions_service_write" ON "public"."admin_regions_geo" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "geo_countries_public_read" ON "public"."countries_geo" FOR SELECT USING (true);



CREATE POLICY "geo_countries_service_write" ON "public"."countries_geo" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "geo_places_public_read" ON "public"."places_geo" FOR SELECT USING (true);



CREATE POLICY "geo_places_service_write" ON "public"."places_geo" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."group_album" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_expenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_kit_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_poll_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_polls" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_reports_insert" ON "public"."group_reports" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "reporter_id"));



CREATE POLICY "group_reports_insert_own" ON "public"."group_reports" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "reporter_id"));



CREATE POLICY "group_reports_select" ON "public"."group_reports" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "reporter_id"));



CREATE POLICY "group_reports_select_own" ON "public"."group_reports" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "reporter_id"));



ALTER TABLE "public"."group_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."groupe_activites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."groupe_depense_parts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."groupe_depenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."groupe_equipement" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."groupe_etapes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."groupe_hebergements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."groupe_membres" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."groupe_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."groupe_taches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."groupe_vote_choix" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."groupe_vote_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."groupe_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."groupes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "groups_auth_insert" ON "public"."travel_groups" FOR INSERT TO "authenticated" WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "groups_organizer_update" ON "public"."travel_groups" FOR UPDATE TO "authenticated" USING ((("owner_id" = "auth"."uid"()) OR "public"."is_group_organizer"("id", "auth"."uid"()))) WITH CHECK ((("owner_id" = "auth"."uid"()) OR "public"."is_group_organizer"("id", "auth"."uid"())));



CREATE POLICY "groups_owner_delete" ON "public"."travel_groups" FOR DELETE TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "groups_public_read" ON "public"."travel_groups" FOR SELECT USING ((("visibility" = 'public'::"public"."group_visibility") OR ("owner_id" = "auth"."uid"()) OR "public"."is_group_member"("id", "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."group_members" "gm"
  WHERE (("gm"."group_id" = "gm"."id") AND ("gm"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."guides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hike_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hike_sessions_delete" ON "public"."hike_sessions" FOR DELETE USING (true);



CREATE POLICY "hike_sessions_insert" ON "public"."hike_sessions" FOR INSERT WITH CHECK (true);



CREATE POLICY "hike_sessions_select" ON "public"."hike_sessions" FOR SELECT USING (true);



CREATE POLICY "hike_sessions_update" ON "public"."hike_sessions" FOR UPDATE USING (true);



ALTER TABLE "public"."hiking_routes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hub_telemetry" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hub_telemetry_insert_own" ON "public"."hub_telemetry" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "hub_telemetry_select_admin" ON "public"."hub_telemetry" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



ALTER TABLE "public"."inventory_exports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invitations_organizer_manage" ON "public"."group_invitations" TO "authenticated" USING ((("invited_by" = "auth"."uid"()) OR "public"."is_group_organizer"("group_id", "auth"."uid"()))) WITH CHECK ((("invited_by" = "auth"."uid"()) AND "public"."is_group_organizer"("group_id", "auth"."uid"())));



CREATE POLICY "invitations_public_read_by_token" ON "public"."group_invitations" FOR SELECT USING (true);



ALTER TABLE "public"."kit_export_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kit_field_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kit_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kit_items_member_all" ON "public"."group_kit_items" TO "authenticated" USING ("public"."is_group_member"("group_id", "auth"."uid"())) WITH CHECK ("public"."is_group_member"("group_id", "auth"."uid"()));



CREATE POLICY "kit_items_select_public_or_member" ON "public"."group_kit_items" FOR SELECT USING (("public"."is_group_public"("group_id") OR (("auth"."uid"() IS NOT NULL) AND "public"."is_group_member"("group_id", "auth"."uid"()))));



ALTER TABLE "public"."kit_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."listings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lkv_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lkv_events_all_service" ON "public"."lkv_events" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "lkv_events_insert_authenticated" ON "public"."lkv_events" FOR INSERT TO "authenticated" WITH CHECK (("actor_id" = "auth"."uid"()));



CREATE POLICY "lkv_events_select_actor" ON "public"."lkv_events" FOR SELECT TO "authenticated" USING (("actor_id" = "auth"."uid"()));



CREATE POLICY "lkv_events_select_crew" ON "public"."lkv_events" FOR SELECT TO "authenticated" USING ((("visibility" = 'crew'::"text") AND ("crew_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."group_members" "gm"
  WHERE (("gm"."group_id" = "lkv_events"."crew_id") AND ("gm"."user_id" = "auth"."uid"()))))));



CREATE POLICY "lkv_events_select_public" ON "public"."lkv_events" FOR SELECT USING (("visibility" = 'public'::"text"));



ALTER TABLE "public"."loans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loyalty_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loyalty_redemptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loyalty_rewards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."map_refuges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."map_summits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."map_water_points" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."materiel_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."materiel_kit_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "materiel_kit_history_delete_own" ON "public"."materiel_kit_history" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "materiel_kit_history_insert_own" ON "public"."materiel_kit_history" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "materiel_kit_history_select_own" ON "public"."materiel_kit_history" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."materiel_kit_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "materiel_kit_items_delete_own" ON "public"."materiel_kit_items" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "materiel_kit_items_insert_own" ON "public"."materiel_kit_items" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "materiel_kit_items_select_own" ON "public"."materiel_kit_items" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "materiel_kit_items_update_own" ON "public"."materiel_kit_items" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."materiel_kits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "materiel_kits_delete_own" ON "public"."materiel_kits" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "materiel_kits_insert_own" ON "public"."materiel_kits" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "materiel_kits_select_own_or_public" ON "public"."materiel_kits" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("is_public" = true)));



CREATE POLICY "materiel_kits_update_own" ON "public"."materiel_kits" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."materiel_loans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "materiel_loans_delete_lender" ON "public"."materiel_loans" FOR DELETE USING (("auth"."uid"() = "lender_id"));



CREATE POLICY "materiel_loans_insert_lender" ON "public"."materiel_loans" FOR INSERT WITH CHECK (("auth"."uid"() = "lender_id"));



CREATE POLICY "materiel_loans_select_involved" ON "public"."materiel_loans" FOR SELECT USING ((("auth"."uid"() = "lender_id") OR ("auth"."uid"() = "borrower_id")));



CREATE POLICY "materiel_loans_update_involved" ON "public"."materiel_loans" FOR UPDATE USING ((("auth"."uid"() = "lender_id") OR ("auth"."uid"() = "borrower_id"))) WITH CHECK ((("auth"."uid"() = "lender_id") OR ("auth"."uid"() = "borrower_id")));



CREATE POLICY "members_delete_conversation_members" ON "public"."conversation_members" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_conv_admin"("conversation_id", "auth"."uid"())));



CREATE POLICY "members_delete_own" ON "public"."group_members" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_group_organizer"("group_id", "auth"."uid"())));



CREATE POLICY "members_insert_messages" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = "auth"."uid"()) AND "public"."is_conversation_member"("conversation_id", "auth"."uid"())));



CREATE POLICY "members_join_group" ON "public"."group_members" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ((EXISTS ( SELECT 1
   FROM "public"."travel_groups" "g"
  WHERE (("g"."id" = "group_members"."group_id") AND ("g"."visibility" = 'public'::"public"."group_visibility")))) OR (EXISTS ( SELECT 1
   FROM "public"."travel_groups" "g"
  WHERE (("g"."id" = "group_members"."group_id") AND ("g"."owner_id" = "auth"."uid"())))))));



CREATE POLICY "members_organizer_insert" ON "public"."group_members" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_group_organizer"("group_id", "auth"."uid"()));



CREATE POLICY "members_read_own_group" ON "public"."group_members" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_group_member"("group_id", "auth"."uid"())));



CREATE POLICY "members_select_attachments" ON "public"."message_attachments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."messages" "m"
  WHERE (("m"."id" = "message_attachments"."message_id") AND "public"."is_conversation_member"("m"."conversation_id", "auth"."uid"())))));



CREATE POLICY "members_select_conversation_members" ON "public"."conversation_members" FOR SELECT TO "authenticated" USING ("public"."is_conversation_member"("conversation_id", "auth"."uid"()));



CREATE POLICY "members_select_conversations" ON "public"."conversations" FOR SELECT TO "authenticated" USING ("public"."is_conversation_member"("id", "auth"."uid"()));



CREATE POLICY "members_select_messages" ON "public"."messages" FOR SELECT TO "authenticated" USING ("public"."is_conversation_member"("conversation_id", "auth"."uid"()));



CREATE POLICY "members_select_public_or_member" ON "public"."group_members" FOR SELECT USING (("public"."is_group_public"("group_id") OR (("auth"."uid"() IS NOT NULL) AND ("public"."is_group_member"("group_id", "auth"."uid"()) OR ("user_id" = "auth"."uid"())))));



CREATE POLICY "members_select_reactions" ON "public"."message_reactions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."messages" "m"
  WHERE (("m"."id" = "message_reactions"."message_id") AND "public"."is_conversation_member"("m"."conversation_id", "auth"."uid"())))));



CREATE POLICY "members_update_own" ON "public"."group_members" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_group_organizer"("group_id", "auth"."uid"()))) WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_group_organizer"("group_id", "auth"."uid"())));



CREATE POLICY "members_update_own_preferences" ON "public"."conversation_members" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_conv_admin"("conversation_id", "auth"."uid"()))) WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_conv_admin"("conversation_id", "auth"."uid"())));



ALTER TABLE "public"."message_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_mentions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_member_insert" ON "public"."group_messages" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."is_group_member"("group_id", "auth"."uid"())));



CREATE POLICY "messages_member_read" ON "public"."group_messages" FOR SELECT TO "authenticated" USING ("public"."is_group_member"("group_id", "auth"."uid"()));



CREATE POLICY "messages_own_delete" ON "public"."group_messages" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_group_organizer"("group_id", "auth"."uid"())));



CREATE POLICY "messages_own_update" ON "public"."group_messages" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_group_organizer"("group_id", "auth"."uid"()))) WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_group_organizer"("group_id", "auth"."uid"())));



CREATE POLICY "messages_select_public_or_member" ON "public"."group_messages" FOR SELECT USING (("public"."is_group_public"("group_id") OR (("auth"."uid"() IS NOT NULL) AND "public"."is_group_member"("group_id", "auth"."uid"()))));



ALTER TABLE "public"."moderation_queue" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "moderation_queue_admin_read" ON "public"."moderation_queue" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."trust_score" >= 80)))));



CREATE POLICY "moderation_queue_vendor_insert" ON "public"."moderation_queue" FOR INSERT TO "authenticated" WITH CHECK (("soumis_par" = "auth"."uid"()));



CREATE POLICY "modos_manage_moderation_queue" ON "public"."moderation_queue" TO "authenticated" USING ("public"."is_moderateur"()) WITH CHECK ("public"."is_moderateur"());



ALTER TABLE "public"."notification_deliveries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."occasion_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."occasion_offers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orientation_delete_own" ON "public"."user_orientation" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "orientation_insert_own" ON "public"."user_orientation" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "orientation_select_own" ON "public"."user_orientation" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "orientation_update_own" ON "public"."user_orientation" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."outdoor_points" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."overpass_sync_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "owner_read_carnet_views" ON "public"."carnet_views" FOR SELECT TO "authenticated" USING ((("carnet_id" IN ( SELECT "carnets"."id"
   FROM "public"."carnets"
  WHERE ("carnets"."author_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'admin'::"text"))))));



CREATE POLICY "owners_delete_conversations" ON "public"."conversations" FOR DELETE TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR "public"."is_conv_owner"("id", "auth"."uid"())));



CREATE POLICY "owners_manage_own_rental_items" ON "public"."rental_items" TO "authenticated" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "owners_manage_share_tokens" ON "public"."share_tokens" USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



ALTER TABLE "public"."pending_contributions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."place_photos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "place_photos_all_service" ON "public"."place_photos" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "place_photos_delete_author" ON "public"."place_photos" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "author_id"));



CREATE POLICY "place_photos_insert_authenticated" ON "public"."place_photos" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "author_id"));



CREATE POLICY "place_photos_select_public" ON "public"."place_photos" FOR SELECT USING (true);



ALTER TABLE "public"."place_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "place_reports_all_service" ON "public"."place_reports" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "place_reports_insert_all" ON "public"."place_reports" FOR INSERT TO "authenticated" WITH CHECK ((("reporter_id" IS NULL) OR ("reporter_id" = "auth"."uid"())));



CREATE POLICY "place_reports_select_reporter" ON "public"."place_reports" FOR SELECT TO "authenticated" USING (("reporter_id" = "auth"."uid"()));



ALTER TABLE "public"."place_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "place_reviews_all_service" ON "public"."place_reviews" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "place_reviews_delete_author" ON "public"."place_reviews" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "author_id"));



CREATE POLICY "place_reviews_insert_authenticated" ON "public"."place_reviews" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "author_id"));



CREATE POLICY "place_reviews_select_public" ON "public"."place_reviews" FOR SELECT USING (true);



CREATE POLICY "place_reviews_update_author" ON "public"."place_reviews" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "author_id")) WITH CHECK (("auth"."uid"() = "author_id"));



ALTER TABLE "public"."places" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "places_all_service" ON "public"."places" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."places_geo" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "places_insert_authenticated" ON "public"."places" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "author_id"));



CREATE POLICY "places_select_public" ON "public"."places" FOR SELECT USING (true);



CREATE POLICY "places_update_author" ON "public"."places" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "author_id")) WITH CHECK (("auth"."uid"() = "author_id"));



CREATE POLICY "polls_member_all" ON "public"."group_polls" TO "authenticated" USING (("public"."is_group_member"("group_id", "auth"."uid"()) OR ("created_by" = "auth"."uid"()))) WITH CHECK (("public"."is_group_member"("group_id", "auth"."uid"()) AND (("created_by" = "auth"."uid"()) OR "public"."is_group_organizer"("group_id", "auth"."uid"()))));



CREATE POLICY "polls_select_public_or_member" ON "public"."group_polls" FOR SELECT USING (("public"."is_group_public"("group_id") OR (("auth"."uid"() IS NOT NULL) AND "public"."is_group_member"("group_id", "auth"."uid"()))));



ALTER TABLE "public"."post_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_alternatives" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_compatibilities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_ownership" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_ownership_delete_own" ON "public"."product_ownership" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "product_ownership_insert_own" ON "public"."product_ownership" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "product_ownership_select_own" ON "public"."product_ownership" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "product_ownership_update_own" ON "public"."product_ownership" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."product_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profile_read_own_visibility" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "profile_select_public_subset" ON "public"."user_profiles" FOR SELECT TO "anon" USING (false);



CREATE POLICY "profile_update_own_visibility" ON "public"."user_profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."promo_codes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public_can_read_guides" ON "public"."guides" FOR SELECT USING (true);



CREATE POLICY "public_insert_carnet_views" ON "public"."carnet_views" FOR INSERT WITH CHECK (true);



CREATE POLICY "public_read_alternatives" ON "public"."product_alternatives" FOR SELECT USING (true);



CREATE POLICY "public_read_ama_questions" ON "public"."ama_questions" FOR SELECT USING (true);



CREATE POLICY "public_read_ambassadors" ON "public"."ambassadors" FOR SELECT USING (true);



CREATE POLICY "public_read_badges" ON "public"."badges" FOR SELECT USING (true);



CREATE POLICY "public_read_challenges" ON "public"."challenges" FOR SELECT USING (true);



CREATE POLICY "public_read_club_challenges" ON "public"."club_challenges" FOR SELECT USING (true);



CREATE POLICY "public_read_club_members" ON "public"."club_members" FOR SELECT USING (true);



CREATE POLICY "public_read_community_posts" ON "public"."community_posts" FOR SELECT USING (true);



CREATE POLICY "public_read_compatibilities" ON "public"."product_compatibilities" FOR SELECT USING (true);



CREATE POLICY "public_read_event_expenses" ON "public"."event_expenses" FOR SELECT USING (true);



CREATE POLICY "public_read_event_participants" ON "public"."event_participants" FOR SELECT USING (true);



CREATE POLICY "public_read_events" ON "public"."events" FOR SELECT USING (true);



CREATE POLICY "public_read_expedition_reports" ON "public"."expedition_reports" FOR SELECT USING (true);



CREATE POLICY "public_read_experts" ON "public"."experts" FOR SELECT USING (true);



CREATE POLICY "public_read_groupe_activites" ON "public"."groupe_activites" FOR SELECT USING (true);



CREATE POLICY "public_read_groupe_depense_parts" ON "public"."groupe_depense_parts" FOR SELECT USING (true);



CREATE POLICY "public_read_groupe_depenses" ON "public"."groupe_depenses" FOR SELECT USING (true);



CREATE POLICY "public_read_groupe_equipement" ON "public"."groupe_equipement" FOR SELECT USING (true);



CREATE POLICY "public_read_groupe_etapes" ON "public"."groupe_etapes" FOR SELECT USING (true);



CREATE POLICY "public_read_groupe_hebergements" ON "public"."groupe_hebergements" FOR SELECT USING (true);



CREATE POLICY "public_read_groupe_membres" ON "public"."groupe_membres" FOR SELECT USING (true);



CREATE POLICY "public_read_groupe_messages" ON "public"."groupe_messages" FOR SELECT USING (true);



CREATE POLICY "public_read_groupe_taches" ON "public"."groupe_taches" FOR SELECT USING (true);



CREATE POLICY "public_read_groupe_vote_choix" ON "public"."groupe_vote_choix" FOR SELECT USING (true);



CREATE POLICY "public_read_groupe_vote_options" ON "public"."groupe_vote_options" FOR SELECT USING (true);



CREATE POLICY "public_read_groupe_votes" ON "public"."groupe_votes" FOR SELECT USING (true);



CREATE POLICY "public_read_groupes" ON "public"."groupes" FOR SELECT USING (true);



CREATE POLICY "public_read_guides" ON "public"."guides" FOR SELECT USING (true);



CREATE POLICY "public_read_helpful_votes" ON "public"."review_helpful_votes" FOR SELECT USING (true);



CREATE POLICY "public_read_hiking_routes" ON "public"."hiking_routes" FOR SELECT USING (true);



CREATE POLICY "public_read_kit_items" ON "public"."kit_items" FOR SELECT USING (true);



CREATE POLICY "public_read_kits" ON "public"."kits" FOR SELECT USING (true);



CREATE POLICY "public_read_listings" ON "public"."listings" FOR SELECT USING (true);



CREATE POLICY "public_read_loyalty_rewards" ON "public"."loyalty_rewards" FOR SELECT USING (true);



CREATE POLICY "public_read_map_refuges" ON "public"."map_refuges" FOR SELECT USING (true);



CREATE POLICY "public_read_map_summits" ON "public"."map_summits" FOR SELECT USING (true);



CREATE POLICY "public_read_map_water_points" ON "public"."map_water_points" FOR SELECT USING (true);



CREATE POLICY "public_read_occasion_items" ON "public"."occasion_items" FOR SELECT USING (true);



CREATE POLICY "public_read_outdoor_points" ON "public"."outdoor_points" FOR SELECT USING (true);



CREATE POLICY "public_read_overpass_sync_log" ON "public"."overpass_sync_log" FOR SELECT USING (true);



CREATE POLICY "public_read_post_comments" ON "public"."post_comments" FOR SELECT USING (true);



CREATE POLICY "public_read_post_likes" ON "public"."post_likes" FOR SELECT USING (true);



CREATE POLICY "public_read_product_images" ON "public"."product_images" FOR SELECT USING (true);



CREATE POLICY "public_read_product_reviews" ON "public"."product_reviews" FOR SELECT USING (true);



CREATE POLICY "public_read_products" ON "public"."products" FOR SELECT USING (true);



CREATE POLICY "public_read_promo_codes" ON "public"."promo_codes" FOR SELECT USING (true);



CREATE POLICY "public_read_public_adventures" ON "public"."saved_adventures" FOR SELECT USING (("is_public" = true));



CREATE POLICY "public_read_qa_answers" ON "public"."qa_answers" FOR SELECT USING (true);



CREATE POLICY "public_read_qa_questions" ON "public"."qa_questions" FOR SELECT USING (true);



CREATE POLICY "public_read_rental_items" ON "public"."rental_items" FOR SELECT USING (true);



CREATE POLICY "public_read_reviews" ON "public"."reviews" FOR SELECT USING (true);



CREATE POLICY "public_read_shop_products" ON "public"."shop_products" FOR SELECT USING (true);



CREATE POLICY "public_read_stock_movements" ON "public"."stock_movements" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "public_read_trail_segments" ON "public"."trail_segments" FOR SELECT USING (true);



CREATE POLICY "public_read_trails_raw_v1" ON "public"."trails_raw_v1" FOR SELECT USING (true);



CREATE POLICY "public_read_user_badges" ON "public"."user_badges" FOR SELECT USING (true);



CREATE POLICY "public_read_user_challenges" ON "public"."user_challenges" FOR SELECT USING (true);



CREATE POLICY "public_read_user_follows" ON "public"."user_follows" FOR SELECT USING (true);



CREATE POLICY "public_read_user_profiles" ON "public"."user_profiles" FOR SELECT USING (true);



ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."qa_answers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "qa_answers_insert" ON "public"."qa_answers" FOR INSERT TO "authenticated" WITH CHECK (("author_id" = "auth"."uid"()));



ALTER TABLE "public"."qa_questions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "qa_questions_insert" ON "public"."qa_questions" FOR INSERT TO "authenticated" WITH CHECK (("author_id" = "auth"."uid"()));



ALTER TABLE "public"."qa_votes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "qa_votes_manage" ON "public"."qa_votes" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "readers_read_share_tokens" ON "public"."share_tokens" FOR SELECT USING (true);



ALTER TABLE "public"."rental_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."review_helpful_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reward_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reward_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reward_periods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reward_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reward_withdrawals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saved_adventures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saved_trails" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "seed_public_read_carnet_kit_items" ON "public"."carnet_kit_items" FOR SELECT USING (true);



CREATE POLICY "seed_public_read_carnet_moments" ON "public"."carnet_moments" FOR SELECT USING (true);



CREATE POLICY "sellers_manage_own_occasion_items" ON "public"."occasion_items" TO "authenticated" USING (("seller_id" = "auth"."uid"())) WITH CHECK (("seller_id" = "auth"."uid"()));



CREATE POLICY "senders_delete_messages" ON "public"."messages" FOR DELETE TO "authenticated" USING ((("sender_id" = "auth"."uid"()) AND "public"."is_conversation_member"("conversation_id", "auth"."uid"())));



CREATE POLICY "senders_insert_attachments" ON "public"."message_attachments" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."messages" "m"
  WHERE (("m"."id" = "message_attachments"."message_id") AND ("m"."sender_id" = "auth"."uid"()) AND "public"."is_conversation_member"("m"."conversation_id", "auth"."uid"())))));



CREATE POLICY "senders_update_messages" ON "public"."messages" FOR UPDATE TO "authenticated" USING ((("sender_id" = "auth"."uid"()) AND "public"."is_conversation_member"("conversation_id", "auth"."uid"()))) WITH CHECK ((("sender_id" = "auth"."uid"()) AND "public"."is_conversation_member"("conversation_id", "auth"."uid"())));



CREATE POLICY "service_write_outdoor_points" ON "public"."outdoor_points" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_write_overpass_sync_log" ON "public"."overpass_sync_log" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."share_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "share_tokens_delete_owner" ON "public"."share_tokens" FOR DELETE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "share_tokens_insert_owner" ON "public"."share_tokens" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "share_tokens_select_owner" ON "public"."share_tokens" FOR SELECT USING (("auth"."uid"() = "owner_id"));



ALTER TABLE "public"."shop_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sos_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_movements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tasks_member_all" ON "public"."group_tasks" TO "authenticated" USING ("public"."is_group_member"("group_id", "auth"."uid"())) WITH CHECK ("public"."is_group_member"("group_id", "auth"."uid"()));



CREATE POLICY "tasks_select_public_or_member" ON "public"."group_tasks" FOR SELECT USING (("public"."is_group_public"("group_id") OR (("auth"."uid"() IS NOT NULL) AND "public"."is_group_member"("group_id", "auth"."uid"()))));



CREATE POLICY "topic_likes_delete" ON "public"."club_topic_likes" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "topic_likes_insert" ON "public"."club_topic_likes" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "topic_likes_read" ON "public"."club_topic_likes" FOR SELECT USING (true);



ALTER TABLE "public"."trail_metadata" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trail_pois" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trail_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trail_segments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trails_raw_v1" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."travel_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_checklist_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_checklist_items_delete_policy" ON "public"."trip_checklist_items" FOR DELETE USING ("public"."can_edit_trip"("trip_id"));



CREATE POLICY "trip_checklist_items_insert_policy" ON "public"."trip_checklist_items" FOR INSERT WITH CHECK ("public"."can_edit_trip"("trip_id"));



CREATE POLICY "trip_checklist_items_select_policy" ON "public"."trip_checklist_items" FOR SELECT USING ("public"."can_read_trip"("trip_id"));



CREATE POLICY "trip_checklist_items_update_policy" ON "public"."trip_checklist_items" FOR UPDATE USING ("public"."can_edit_trip"("trip_id")) WITH CHECK ("public"."can_edit_trip"("trip_id"));



CREATE POLICY "trip_collab_delete_policy" ON "public"."trip_collaborators" FOR DELETE USING (((("auth"."uid"() IS NOT NULL) AND ("user_id" = "auth"."uid"())) OR (EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_collaborators"."trip_id") AND ("trips"."user_id" = "auth"."uid"()))))));



CREATE POLICY "trip_collab_insert_policy" ON "public"."trip_collaborators" FOR INSERT WITH CHECK ((("role" = ANY (ARRAY['editor'::"public"."trip_collaborator_role", 'viewer'::"public"."trip_collaborator_role"])) AND ("public"."can_edit_trip"("trip_id") OR (EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_collaborators"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))))));



CREATE POLICY "trip_collab_select_policy" ON "public"."trip_collaborators" FOR SELECT USING ("public"."can_read_trip"("trip_id"));



CREATE POLICY "trip_collab_update_policy" ON "public"."trip_collaborators" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_collaborators"."trip_id") AND ("trips"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_collaborators"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."trip_collaborators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_documents_delete_policy" ON "public"."trip_documents" FOR DELETE USING ("public"."can_edit_trip"("trip_id"));



CREATE POLICY "trip_documents_insert_policy" ON "public"."trip_documents" FOR INSERT WITH CHECK (("public"."can_edit_trip"("trip_id") AND ("user_id" = "auth"."uid"())));



CREATE POLICY "trip_documents_select_policy" ON "public"."trip_documents" FOR SELECT USING ("public"."can_edit_trip"("trip_id"));



CREATE POLICY "trip_documents_update_policy" ON "public"."trip_documents" FOR UPDATE USING ("public"."can_edit_trip"("trip_id")) WITH CHECK ("public"."can_edit_trip"("trip_id"));



ALTER TABLE "public"."trip_expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_expenses_delete_policy" ON "public"."trip_expenses" FOR DELETE USING ("public"."can_edit_trip"("trip_id"));



CREATE POLICY "trip_expenses_insert_policy" ON "public"."trip_expenses" FOR INSERT WITH CHECK ("public"."can_edit_trip"("trip_id"));



CREATE POLICY "trip_expenses_select_policy" ON "public"."trip_expenses" FOR SELECT USING ("public"."can_read_trip"("trip_id"));



CREATE POLICY "trip_expenses_update_policy" ON "public"."trip_expenses" FOR UPDATE USING ("public"."can_edit_trip"("trip_id")) WITH CHECK ("public"."can_edit_trip"("trip_id"));



ALTER TABLE "public"."trip_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_items_delete_policy" ON "public"."trip_items" FOR DELETE USING ("public"."can_edit_trip"("trip_id"));



CREATE POLICY "trip_items_insert_policy" ON "public"."trip_items" FOR INSERT WITH CHECK ("public"."can_edit_trip"("trip_id"));



CREATE POLICY "trip_items_select_policy" ON "public"."trip_items" FOR SELECT USING ("public"."can_read_trip"("trip_id"));



CREATE POLICY "trip_items_update_policy" ON "public"."trip_items" FOR UPDATE USING ("public"."can_edit_trip"("trip_id")) WITH CHECK ("public"."can_edit_trip"("trip_id"));



ALTER TABLE "public"."trip_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_notes_delete_policy" ON "public"."trip_notes" FOR DELETE USING ("public"."can_edit_trip"("trip_id"));



CREATE POLICY "trip_notes_insert_policy" ON "public"."trip_notes" FOR INSERT WITH CHECK ("public"."can_edit_trip"("trip_id"));



CREATE POLICY "trip_notes_select_policy" ON "public"."trip_notes" FOR SELECT USING ("public"."can_read_trip"("trip_id"));



CREATE POLICY "trip_notes_update_policy" ON "public"."trip_notes" FOR UPDATE USING ("public"."can_edit_trip"("trip_id")) WITH CHECK ("public"."can_edit_trip"("trip_id"));



ALTER TABLE "public"."trip_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_participants_delete_policy" ON "public"."trip_participants" FOR DELETE USING (("public"."lkv_can"("auth"."uid"(), 'trip_participants'::"text", "trip_id", 'delete'::"text") OR ("auth"."uid"() = "user_id")));



CREATE POLICY "trip_participants_insert_policy" ON "public"."trip_participants" FOR INSERT WITH CHECK ("public"."lkv_can"("auth"."uid"(), 'trip_participants'::"text", "trip_id", 'insert'::"text"));



CREATE POLICY "trip_participants_select_policy" ON "public"."trip_participants" FOR SELECT USING ("public"."lkv_can"("auth"."uid"(), 'trips'::"text", "trip_id", 'select'::"text"));



CREATE POLICY "trip_participants_update_policy" ON "public"."trip_participants" FOR UPDATE USING ("public"."lkv_can"("auth"."uid"(), 'trip_participants'::"text", "trip_id", 'update'::"text"));



ALTER TABLE "public"."trip_pois" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_pois_delete_policy" ON "public"."trip_pois" FOR DELETE USING ("public"."can_edit_trip"("trip_id"));



CREATE POLICY "trip_pois_insert_policy" ON "public"."trip_pois" FOR INSERT WITH CHECK ("public"."can_edit_trip"("trip_id"));



CREATE POLICY "trip_pois_select_policy" ON "public"."trip_pois" FOR SELECT USING ("public"."can_read_trip"("trip_id"));



CREATE POLICY "trip_pois_update_policy" ON "public"."trip_pois" FOR UPDATE USING ("public"."can_edit_trip"("trip_id")) WITH CHECK ("public"."can_edit_trip"("trip_id"));



ALTER TABLE "public"."trip_safety_checkpoints" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_safety_delete_policy" ON "public"."trip_safety_checkpoints" FOR DELETE USING ("public"."can_edit_trip"("trip_id"));



CREATE POLICY "trip_safety_insert_policy" ON "public"."trip_safety_checkpoints" FOR INSERT WITH CHECK ("public"."can_edit_trip"("trip_id"));



CREATE POLICY "trip_safety_select_policy" ON "public"."trip_safety_checkpoints" FOR SELECT USING ("public"."can_read_trip"("trip_id"));



CREATE POLICY "trip_safety_update_policy" ON "public"."trip_safety_checkpoints" FOR UPDATE USING ("public"."can_edit_trip"("trip_id")) WITH CHECK ("public"."can_edit_trip"("trip_id"));



ALTER TABLE "public"."trip_steps" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_steps_delete_policy" ON "public"."trip_steps" FOR DELETE USING ("public"."can_edit_trip"("trip_id"));



CREATE POLICY "trip_steps_insert_policy" ON "public"."trip_steps" FOR INSERT WITH CHECK ("public"."can_edit_trip"("trip_id"));



CREATE POLICY "trip_steps_select_policy" ON "public"."trip_steps" FOR SELECT USING ("public"."can_read_trip"("trip_id"));



CREATE POLICY "trip_steps_update_policy" ON "public"."trip_steps" FOR UPDATE USING ("public"."can_edit_trip"("trip_id")) WITH CHECK ("public"."can_edit_trip"("trip_id"));



ALTER TABLE "public"."trips" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trips_delete_policy" ON "public"."trips" FOR DELETE USING ((("auth"."uid"() IS NOT NULL) AND ("user_id" = "auth"."uid"())));



CREATE POLICY "trips_insert_policy" ON "public"."trips" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("user_id" = "auth"."uid"())));



CREATE POLICY "trips_select_policy" ON "public"."trips" FOR SELECT USING ((("visibility" = ANY (ARRAY['public'::"public"."trip_visibility", 'unlisted'::"public"."trip_visibility"])) OR (("auth"."uid"() IS NOT NULL) AND ("user_id" = "auth"."uid"())) OR "public"."can_read_trip"("id")));



CREATE POLICY "trips_update_policy" ON "public"."trips" FOR UPDATE USING (((("auth"."uid"() IS NOT NULL) AND ("user_id" = "auth"."uid"())) OR "public"."can_edit_trip"("id"))) WITH CHECK (((("auth"."uid"() IS NOT NULL) AND ("user_id" = "auth"."uid"())) OR "public"."can_edit_trip"("id")));



ALTER TABLE "public"."user_addresses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_blocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_blocks_delete" ON "public"."user_blocks" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "blocker_id"));



CREATE POLICY "user_blocks_delete_own" ON "public"."user_blocks" FOR DELETE TO "authenticated" USING (("blocker_id" = "auth"."uid"()));



CREATE POLICY "user_blocks_insert" ON "public"."user_blocks" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "blocker_id"));



CREATE POLICY "user_blocks_insert_own" ON "public"."user_blocks" FOR INSERT TO "authenticated" WITH CHECK (("blocker_id" = "auth"."uid"()));



CREATE POLICY "user_blocks_select" ON "public"."user_blocks" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "blocker_id") OR ("auth"."uid"() = "blocked_id")));



CREATE POLICY "user_blocks_select_all" ON "public"."user_blocks" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "blocker_id") OR ("auth"."uid"() = "blocked_id")));



CREATE POLICY "user_blocks_select_own" ON "public"."user_blocks" FOR SELECT TO "authenticated" USING ((("blocker_id" = "auth"."uid"()) OR ("blocked_id" = "auth"."uid"())));



ALTER TABLE "public"."user_challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_follows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_orientation" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_payment_methods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_delete_reactions" ON "public"."message_reactions" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users_insert_own_order_items" ON "public"."order_items" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."id" = "order_items"."order_id") AND ("orders"."user_id" = "auth"."uid"())))));



CREATE POLICY "users_insert_reactions" ON "public"."message_reactions" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."messages" "m"
  WHERE (("m"."id" = "message_reactions"."message_id") AND "public"."is_conversation_member"("m"."conversation_id", "auth"."uid"()))))));



CREATE POLICY "users_manage_own_addresses" ON "public"."user_addresses" TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users_manage_own_badges" ON "public"."user_badges" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users_manage_own_bookings" ON "public"."expert_bookings" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users_manage_own_cart_discounts" ON "public"."cart_loyalty_discounts" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users_manage_own_challenges" ON "public"."user_challenges" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users_manage_own_configurator_sessions" ON "public"."configurator_sessions" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users_manage_own_documents" ON "public"."user_documents" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users_manage_own_gear" ON "public"."gear_items" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users_manage_own_gear_alert_history" ON "public"."gear_alert_history" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users_manage_own_gear_items" ON "public"."gear_items" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users_manage_own_guides" ON "public"."guides" TO "authenticated" USING (("author_id" = "auth"."uid"())) WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "users_manage_own_helpful_votes" ON "public"."review_helpful_votes" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users_manage_own_inventory_exports" ON "public"."inventory_exports" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users_manage_own_kit_export_logs" ON "public"."kit_export_logs" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users_manage_own_kit_reports" ON "public"."kit_reports" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users_manage_own_materiel_history" ON "public"."materiel_history" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users_manage_own_memberships" ON "public"."club_members" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users_manage_own_orders" ON "public"."orders" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users_manage_own_participations" ON "public"."event_participants" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users_manage_own_payment_methods" ON "public"."user_payment_methods" TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users_manage_own_profiles" ON "public"."user_profiles" TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "users_manage_own_reports" ON "public"."expedition_reports" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users_manage_own_reviews" ON "public"."reviews" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users_manage_own_saved_adventures" ON "public"."saved_adventures" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users_manage_own_saved_trails" ON "public"."saved_trails" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users_manage_own_sos" ON "public"."sos_alerts" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users_read_own_inventory_exports" ON "public"."inventory_exports" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users_read_own_profile" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "users_update_own_profile" ON "public"."user_profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "users_view_own_order_items" ON "public"."order_items" FOR SELECT TO "authenticated" USING (("order_id" IN ( SELECT "orders"."id"
   FROM "public"."orders"
  WHERE ("orders"."user_id" = "auth"."uid"()))));



CREATE POLICY "votes_delete_own" ON "public"."group_poll_votes" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."group_polls" "p"
  WHERE (("p"."id" = "group_poll_votes"."poll_id") AND "public"."is_group_organizer"("p"."group_id", "auth"."uid"()))))));



CREATE POLICY "votes_member_own" ON "public"."group_poll_votes" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "votes_select_member" ON "public"."group_poll_votes" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."group_polls" "p"
  WHERE (("p"."id" = "group_poll_votes"."poll_id") AND "public"."is_group_member"("p"."group_id", "auth"."uid"()))))));



CREATE POLICY "votes_select_public_or_member" ON "public"."group_poll_votes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."group_polls" "gp"
  WHERE (("gp"."id" = "group_poll_votes"."poll_id") AND ("public"."is_group_public"("gp"."group_id") OR (("auth"."uid"() IS NOT NULL) AND "public"."is_group_member"("gp"."group_id", "auth"."uid"())))))));



CREATE POLICY "votes_update_own" ON "public"."group_poll_votes" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."group_polls" "p"
  WHERE (("p"."id" = "group_poll_votes"."poll_id") AND "public"."is_group_organizer"("p"."group_id", "auth"."uid"())))))) WITH CHECK (("user_id" = "auth"."uid"()));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."can_edit_trip"("p_trip_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_edit_trip"("p_trip_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_edit_trip"("p_trip_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_read_trip"("p_trip_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_read_trip"("p_trip_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_read_trip"("p_trip_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_user_bid"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_user_bid"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_user_bid"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_user_sell_auction"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_user_sell_auction"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_user_sell_auction"("user_uuid" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_and_increment_ai_quota"("p_user_id" "uuid", "p_tier" "text", "p_feature" "text", "p_feature_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_and_increment_ai_quota"("p_user_id" "uuid", "p_tier" "text", "p_feature" "text", "p_feature_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_and_increment_ai_quota"("p_user_id" "uuid", "p_tier" "text", "p_feature" "text", "p_feature_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_and_increment_ai_quota"("p_user_id" "uuid", "p_tier" "text", "p_feature" "text", "p_feature_limit" integer) TO "service_role";



GRANT ALL ON TABLE "public"."ai_jobs" TO "anon";
GRANT ALL ON TABLE "public"."ai_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_jobs" TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_pending_ai_jobs"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_pending_ai_jobs"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."claim_pending_ai_jobs"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_pending_ai_jobs"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_reward_points"("p_user_id" "uuid", "p_action_type" "text", "p_target_id" "uuid", "p_target_type" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_reward_points"("p_user_id" "uuid", "p_action_type" "text", "p_target_id" "uuid", "p_target_type" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_reward_points"("p_user_id" "uuid", "p_action_type" "text", "p_target_id" "uuid", "p_target_type" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_trash_kits"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_trash_kits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_trash_kits"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_feature_flags"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_feature_flags"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_feature_flags"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_feature_flags"() TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_stock_on_order"("p_product_id" "uuid", "p_quantity" integer, "p_order_id" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_stock_on_order"("p_product_id" "uuid", "p_quantity" integer, "p_order_id" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_stock_on_order"("p_product_id" "uuid", "p_quantity" integer, "p_order_id" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_places_batch"("p_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_places_batch"("p_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_places_batch"("p_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_member_role_hierarchy"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_member_role_hierarchy"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_member_role_hierarchy"() TO "service_role";



GRANT ALL ON FUNCTION "public"."finalize_reward_period"("p_period_id" "text", "p_eligible_revenue" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."finalize_reward_period"("p_period_id" "text", "p_eligible_revenue" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."finalize_reward_period"("p_period_id" "text", "p_eligible_revenue" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."freeze_trip_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."freeze_trip_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."freeze_trip_owner"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_trip_slug"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_trip_slug"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_trip_slug"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_admin_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_admin_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_ai_cache"("p_cache_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_ai_cache"("p_cache_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_ai_cache"("p_cache_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_ai_cache"("p_cache_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_comparable_sales"("p_produit_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_comparable_sales"("p_produit_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_comparable_sales"("p_produit_id" "uuid", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_hiking_routes_geojson"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_hiking_routes_geojson"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_hiking_routes_geojson"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_kit_journal"("p_kit_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_kit_journal"("p_kit_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_kit_journal"("p_kit_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_kit_journal"("p_kit_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_nearby_named_pois"("p_lat" double precision, "p_lon" double precision, "p_radius_m" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_nearby_named_pois"("p_lat" double precision, "p_lon" double precision, "p_radius_m" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_nearby_named_pois"("p_lat" double precision, "p_lon" double precision, "p_radius_m" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_occasion_listing_for_product"("p_produit_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_occasion_listing_for_product"("p_produit_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_occasion_listing_for_product"("p_produit_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_or_create_direct_conversation"("p_target_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_or_create_direct_conversation"("p_target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_direct_conversation"("p_target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_route_deviation"("p_route_id" bigint, "p_lat" double precision, "p_lon" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."get_route_deviation"("p_route_id" bigint, "p_lat" double precision, "p_lon" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_route_deviation"("p_route_id" bigint, "p_lat" double precision, "p_lon" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_route_geojson"("p_route_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_route_geojson"("p_route_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_route_geojson"("p_route_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_route_offline_bbox"("p_route_id" bigint, "p_margin_m" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."get_route_offline_bbox"("p_route_id" bigint, "p_margin_m" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_route_offline_bbox"("p_route_id" bigint, "p_margin_m" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_route_pois"("p_route_id" bigint, "p_radius_m" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."get_route_pois"("p_route_id" bigint, "p_radius_m" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_route_pois"("p_route_id" bigint, "p_radius_m" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_routes_for_map"("min_lng" double precision, "min_lat" double precision, "max_lng" double precision, "max_lat" double precision, "simplify_tolerance" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."get_routes_for_map"("min_lng" double precision, "min_lat" double precision, "max_lng" double precision, "max_lat" double precision, "simplify_tolerance" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_routes_for_map"("min_lng" double precision, "min_lat" double precision, "max_lng" double precision, "max_lat" double precision, "simplify_tolerance" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_trail_pois_bbox"("min_lng" double precision, "min_lat" double precision, "max_lng" double precision, "max_lat" double precision, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_trail_pois_bbox"("min_lng" double precision, "min_lat" double precision, "max_lng" double precision, "max_lat" double precision, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_trail_pois_bbox"("min_lng" double precision, "min_lat" double precision, "max_lng" double precision, "max_lat" double precision, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_trail_pois_geojson"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_trail_pois_geojson"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_trail_pois_geojson"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_badges_progress"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_badges_progress"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_badges_progress"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_hiking_stats"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_hiking_stats"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_hiking_stats"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_signature"("p_target" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_signature"("p_target" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_signature"("p_target" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_field_proven_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_field_proven_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_field_proven_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_kit_lineage"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_kit_lineage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_kit_lineage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_reward_account"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_reward_account"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_reward_account"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_trip_owner_collaborator"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_trip_owner_collaborator"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_trip_owner_collaborator"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_stock"("p_product_id" "uuid", "p_quantity" integer, "p_reference_type" "text", "p_reference_id" "text", "p_user_id" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_stock"("p_product_id" "uuid", "p_quantity" integer, "p_reference_type" "text", "p_reference_id" "text", "p_user_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_stock"("p_product_id" "uuid", "p_quantity" integer, "p_reference_type" "text", "p_reference_id" "text", "p_user_id" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_conv_admin"("target_conversation_id" "uuid", "target_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_conv_admin"("target_conversation_id" "uuid", "target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_conv_admin"("target_conversation_id" "uuid", "target_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_conv_owner"("target_conversation_id" "uuid", "target_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_conv_owner"("target_conversation_id" "uuid", "target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_conv_owner"("target_conversation_id" "uuid", "target_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_conversation_member"("target_conversation_id" "uuid", "target_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_conversation_member"("target_conversation_id" "uuid", "target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_conversation_member"("target_conversation_id" "uuid", "target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_group_member"("p_group_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_group_member"("p_group_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_group_member"("p_group_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_group_organizer"("p_group_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_group_organizer"("p_group_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_group_organizer"("p_group_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_group_public"("p_group_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_group_public"("p_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_group_public"("p_group_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_moderateur"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_moderateur"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_moderateur"() TO "service_role";



GRANT ALL ON FUNCTION "public"."lkv_can"("p_user_id" "uuid", "p_resource" "text", "p_resource_id" "uuid", "p_action" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."lkv_can"("p_user_id" "uuid", "p_resource" "text", "p_resource_id" "uuid", "p_action" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lkv_can"("p_user_id" "uuid", "p_resource" "text", "p_resource_id" "uuid", "p_action" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."lkv_ensure_auto_crew"() TO "anon";
GRANT ALL ON FUNCTION "public"."lkv_ensure_auto_crew"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."lkv_ensure_auto_crew"() TO "service_role";



GRANT ALL ON FUNCTION "public"."lkv_seed_trip_checklist_template"() TO "anon";
GRANT ALL ON FUNCTION "public"."lkv_seed_trip_checklist_template"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."lkv_seed_trip_checklist_template"() TO "service_role";



GRANT ALL ON FUNCTION "public"."lkv_slugify"("v_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."lkv_slugify"("v_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lkv_slugify"("v_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_materiel_history"("p_user_id" "uuid", "p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_entity_name" "text", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_materiel_history"("p_user_id" "uuid", "p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_entity_name" "text", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_materiel_history"("p_user_id" "uuid", "p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_entity_name" "text", "p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."materiel_kits_search_vector_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."materiel_kits_search_vector_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."materiel_kits_search_vector_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_actor_id" "uuid", "p_related_type" "text", "p_related_id" "uuid", "p_link" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."notify"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_actor_id" "uuid", "p_related_type" "text", "p_related_id" "uuid", "p_link" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_actor_id" "uuid", "p_related_type" "text", "p_related_id" "uuid", "p_link" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."place_bid"("p_listing_id" "uuid", "p_bidder_id" "uuid", "p_montant_cents" integer, "p_is_auto_bid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."place_bid"("p_listing_id" "uuid", "p_bidder_id" "uuid", "p_montant_cents" integer, "p_is_auto_bid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."place_bid"("p_listing_id" "uuid", "p_bidder_id" "uuid", "p_montant_cents" integer, "p_is_auto_bid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_message_immutable_fields_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_message_immutable_fields_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_message_immutable_fields_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_order_points"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_order_points"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_order_points"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_pending_contribution"("p_contribution_id" "uuid", "p_approve" boolean, "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."process_pending_contribution"("p_contribution_id" "uuid", "p_approve" boolean, "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_pending_contribution"("p_contribution_id" "uuid", "p_approve" boolean, "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_withdrawal"("p_withdrawal_id" "uuid", "p_approve" boolean, "p_reference" "text", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."process_withdrawal"("p_withdrawal_id" "uuid", "p_approve" boolean, "p_reference" "text", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_withdrawal"("p_withdrawal_id" "uuid", "p_approve" boolean, "p_reference" "text", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."product_ownership_search_vector_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."product_ownership_search_vector_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."product_ownership_search_vector_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."purge_expired_lkv_events"() TO "anon";
GRANT ALL ON FUNCTION "public"."purge_expired_lkv_events"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."purge_expired_lkv_events"() TO "service_role";



GRANT ALL ON FUNCTION "public"."purge_rejected_club_requests"() TO "anon";
GRANT ALL ON FUNCTION "public"."purge_rejected_club_requests"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."purge_rejected_club_requests"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_place_rating"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_place_rating"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_place_rating"() TO "service_role";



GRANT ALL ON FUNCTION "public"."record_hike_gear_usage"("p_gear_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."record_hike_gear_usage"("p_gear_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_hike_gear_usage"("p_gear_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."redeem_reward"("p_user_id" "uuid", "p_reward_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."redeem_reward"("p_user_id" "uuid", "p_reward_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."redeem_reward"("p_user_id" "uuid", "p_reward_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."refresh_kit_conservation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_kit_conservation"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_kit_conservation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_kit_conservation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."refresh_user_field_signature"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_user_field_signature"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_user_field_signature"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_user_field_signature"() TO "service_role";



GRANT ALL ON FUNCTION "public"."request_withdrawal"("p_amount" numeric, "p_payment_provider" "text", "p_idempotency_key" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."request_withdrawal"("p_amount" numeric, "p_payment_provider" "text", "p_idempotency_key" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_withdrawal"("p_amount" numeric, "p_payment_provider" "text", "p_idempotency_key" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."send_digests"() TO "anon";
GRANT ALL ON FUNCTION "public"."send_digests"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_digests"() TO "service_role";



GRANT ALL ON FUNCTION "public"."send_materiel_reminders"() TO "anon";
GRANT ALL ON FUNCTION "public"."send_materiel_reminders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_materiel_reminders"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_ai_cache"("p_cache_key" "text", "p_feature" "text", "p_response" "jsonb", "p_model" "text", "p_provider" "text", "p_ttl_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_ai_cache"("p_cache_key" "text", "p_feature" "text", "p_response" "jsonb", "p_model" "text", "p_provider" "text", "p_ttl_seconds" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."set_ai_cache"("p_cache_key" "text", "p_feature" "text", "p_response" "jsonb", "p_model" "text", "p_provider" "text", "p_ttl_seconds" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_ai_cache"("p_cache_key" "text", "p_feature" "text", "p_response" "jsonb", "p_model" "text", "p_provider" "text", "p_ttl_seconds" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_auto_bid"("p_listing_id" "uuid", "p_bidder_id" "uuid", "p_plafond_cents" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."set_auto_bid"("p_listing_id" "uuid", "p_bidder_id" "uuid", "p_plafond_cents" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_auto_bid"("p_listing_id" "uuid", "p_bidder_id" "uuid", "p_plafond_cents" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_carnet_comments_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_carnet_comments_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_carnet_comments_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_carnet_favorites_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_carnet_favorites_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_carnet_favorites_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_carnet_likes_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_carnet_likes_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_carnet_likes_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_carnet_views_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_carnet_views_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_carnet_views_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_community_post_comments_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_community_post_comments_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_community_post_comments_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_loyalty_points"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_loyalty_points"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_loyalty_points"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_place_geom"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_place_geom"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_place_geom"() TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_community_post_like"("p_post_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_community_post_like"("p_post_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_community_post_like"("p_post_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_on_carnet_comment"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_on_carnet_comment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_on_carnet_comment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_on_carnet_like"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_on_carnet_like"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_on_carnet_like"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_on_community_post_comment"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_on_community_post_comment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_on_community_post_comment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_on_community_post_like"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_on_community_post_like"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_on_community_post_like"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_on_group_expense_added"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_on_group_expense_added"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_on_group_expense_added"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_on_group_member_join"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_on_group_member_join"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_on_group_member_join"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_on_group_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_on_group_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_on_group_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_on_group_task_assigned"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_on_group_task_assigned"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_on_group_task_assigned"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_lower"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_lower"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_lower"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_group_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_group_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_group_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_loyalty_points"("p_user_id" "uuid", "p_points" integer, "p_action" "text", "p_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_loyalty_points"("p_user_id" "uuid", "p_points" integer, "p_action" "text", "p_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_loyalty_points"("p_user_id" "uuid", "p_points" integer, "p_action" "text", "p_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_moderation_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_moderation_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_moderation_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_order_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_order_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_order_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_reward_account_on_contribution"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_reward_account_on_contribution"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_reward_account_on_contribution"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_reward_account_on_transaction"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_reward_account_on_transaction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_reward_account_on_transaction"() TO "service_role";



GRANT ALL ON TABLE "public"."activities" TO "anon";
GRANT ALL ON TABLE "public"."activities" TO "authenticated";
GRANT ALL ON TABLE "public"."activities" TO "service_role";



GRANT ALL ON TABLE "public"."admin_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."admin_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."admin_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."admin_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."admin_regions_geo" TO "anon";
GRANT ALL ON TABLE "public"."admin_regions_geo" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_regions_geo" TO "service_role";



GRANT ALL ON TABLE "public"."admin_roles" TO "anon";
GRANT ALL ON TABLE "public"."admin_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_roles" TO "service_role";



GRANT ALL ON TABLE "public"."affiliate_clicks" TO "anon";
GRANT ALL ON TABLE "public"."affiliate_clicks" TO "authenticated";
GRANT ALL ON TABLE "public"."affiliate_clicks" TO "service_role";



GRANT ALL ON TABLE "public"."affiliate_conversions" TO "anon";
GRANT ALL ON TABLE "public"."affiliate_conversions" TO "authenticated";
GRANT ALL ON TABLE "public"."affiliate_conversions" TO "service_role";



GRANT ALL ON TABLE "public"."affiliate_links" TO "anon";
GRANT ALL ON TABLE "public"."affiliate_links" TO "authenticated";
GRANT ALL ON TABLE "public"."affiliate_links" TO "service_role";



GRANT ALL ON TABLE "public"."affiliate_offers" TO "anon";
GRANT ALL ON TABLE "public"."affiliate_offers" TO "authenticated";
GRANT ALL ON TABLE "public"."affiliate_offers" TO "service_role";



GRANT ALL ON TABLE "public"."affiliate_partners" TO "anon";
GRANT ALL ON TABLE "public"."affiliate_partners" TO "authenticated";
GRANT ALL ON TABLE "public"."affiliate_partners" TO "service_role";



GRANT ALL ON TABLE "public"."affiliate_programs" TO "anon";
GRANT ALL ON TABLE "public"."affiliate_programs" TO "authenticated";
GRANT ALL ON TABLE "public"."affiliate_programs" TO "service_role";



GRANT ALL ON TABLE "public"."ai_response_cache" TO "anon";
GRANT ALL ON TABLE "public"."ai_response_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_response_cache" TO "service_role";



GRANT ALL ON TABLE "public"."ai_usage_daily" TO "anon";
GRANT ALL ON TABLE "public"."ai_usage_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_usage_daily" TO "service_role";



GRANT ALL ON TABLE "public"."alerts" TO "anon";
GRANT ALL ON TABLE "public"."alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."alerts" TO "service_role";



GRANT ALL ON TABLE "public"."ama_questions" TO "anon";
GRANT ALL ON TABLE "public"."ama_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."ama_questions" TO "service_role";



GRANT ALL ON TABLE "public"."ama_sessions" TO "anon";
GRANT ALL ON TABLE "public"."ama_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."ama_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."ama_votes" TO "anon";
GRANT ALL ON TABLE "public"."ama_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."ama_votes" TO "service_role";



GRANT ALL ON TABLE "public"."ambassadors" TO "anon";
GRANT ALL ON TABLE "public"."ambassadors" TO "authenticated";
GRANT ALL ON TABLE "public"."ambassadors" TO "service_role";



GRANT ALL ON TABLE "public"."auction_auto_bids" TO "anon";
GRANT ALL ON TABLE "public"."auction_auto_bids" TO "authenticated";
GRANT ALL ON TABLE "public"."auction_auto_bids" TO "service_role";



GRANT ALL ON TABLE "public"."auction_bids" TO "anon";
GRANT ALL ON TABLE "public"."auction_bids" TO "authenticated";
GRANT ALL ON TABLE "public"."auction_bids" TO "service_role";



GRANT ALL ON TABLE "public"."badges" TO "anon";
GRANT ALL ON TABLE "public"."badges" TO "authenticated";
GRANT ALL ON TABLE "public"."badges" TO "service_role";



GRANT ALL ON TABLE "public"."carnet_collaborators" TO "anon";
GRANT ALL ON TABLE "public"."carnet_collaborators" TO "authenticated";
GRANT ALL ON TABLE "public"."carnet_collaborators" TO "service_role";



GRANT ALL ON TABLE "public"."carnet_comments" TO "anon";
GRANT ALL ON TABLE "public"."carnet_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."carnet_comments" TO "service_role";



GRANT ALL ON TABLE "public"."carnet_favorites" TO "anon";
GRANT ALL ON TABLE "public"."carnet_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."carnet_favorites" TO "service_role";



GRANT ALL ON TABLE "public"."carnet_gear_links" TO "anon";
GRANT ALL ON TABLE "public"."carnet_gear_links" TO "authenticated";
GRANT ALL ON TABLE "public"."carnet_gear_links" TO "service_role";



GRANT ALL ON TABLE "public"."carnet_kit_items" TO "anon";
GRANT ALL ON TABLE "public"."carnet_kit_items" TO "authenticated";
GRANT ALL ON TABLE "public"."carnet_kit_items" TO "service_role";



GRANT ALL ON TABLE "public"."carnet_likes" TO "anon";
GRANT ALL ON TABLE "public"."carnet_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."carnet_likes" TO "service_role";



GRANT ALL ON TABLE "public"."carnet_media" TO "anon";
GRANT ALL ON TABLE "public"."carnet_media" TO "authenticated";
GRANT ALL ON TABLE "public"."carnet_media" TO "service_role";



GRANT ALL ON TABLE "public"."carnet_moments" TO "anon";
GRANT ALL ON TABLE "public"."carnet_moments" TO "authenticated";
GRANT ALL ON TABLE "public"."carnet_moments" TO "service_role";



GRANT ALL ON TABLE "public"."carnet_views" TO "anon";
GRANT ALL ON TABLE "public"."carnet_views" TO "authenticated";
GRANT ALL ON TABLE "public"."carnet_views" TO "service_role";



GRANT ALL ON TABLE "public"."carnets" TO "anon";
GRANT ALL ON TABLE "public"."carnets" TO "authenticated";
GRANT ALL ON TABLE "public"."carnets" TO "service_role";



GRANT ALL ON TABLE "public"."cart_loyalty_discounts" TO "anon";
GRANT ALL ON TABLE "public"."cart_loyalty_discounts" TO "authenticated";
GRANT ALL ON TABLE "public"."cart_loyalty_discounts" TO "service_role";



GRANT ALL ON TABLE "public"."challenges" TO "anon";
GRANT ALL ON TABLE "public"."challenges" TO "authenticated";
GRANT ALL ON TABLE "public"."challenges" TO "service_role";



GRANT ALL ON TABLE "public"."checkout_intents" TO "anon";
GRANT ALL ON TABLE "public"."checkout_intents" TO "authenticated";
GRANT ALL ON TABLE "public"."checkout_intents" TO "service_role";



GRANT ALL ON TABLE "public"."club_challenge_entries" TO "anon";
GRANT ALL ON TABLE "public"."club_challenge_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."club_challenge_entries" TO "service_role";



GRANT ALL ON TABLE "public"."club_challenges" TO "anon";
GRANT ALL ON TABLE "public"."club_challenges" TO "authenticated";
GRANT ALL ON TABLE "public"."club_challenges" TO "service_role";



GRANT ALL ON TABLE "public"."club_event_participants" TO "anon";
GRANT ALL ON TABLE "public"."club_event_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."club_event_participants" TO "service_role";



GRANT ALL ON TABLE "public"."club_events" TO "anon";
GRANT ALL ON TABLE "public"."club_events" TO "authenticated";
GRANT ALL ON TABLE "public"."club_events" TO "service_role";



GRANT ALL ON TABLE "public"."club_join_requests" TO "anon";
GRANT ALL ON TABLE "public"."club_join_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."club_join_requests" TO "service_role";



GRANT ALL ON TABLE "public"."club_members" TO "anon";
GRANT ALL ON TABLE "public"."club_members" TO "authenticated";
GRANT ALL ON TABLE "public"."club_members" TO "service_role";



GRANT ALL ON TABLE "public"."club_recommended_kits" TO "anon";
GRANT ALL ON TABLE "public"."club_recommended_kits" TO "authenticated";
GRANT ALL ON TABLE "public"."club_recommended_kits" TO "service_role";



GRANT ALL ON TABLE "public"."club_reports" TO "anon";
GRANT ALL ON TABLE "public"."club_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."club_reports" TO "service_role";



GRANT ALL ON TABLE "public"."club_topic_likes" TO "anon";
GRANT ALL ON TABLE "public"."club_topic_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."club_topic_likes" TO "service_role";



GRANT ALL ON TABLE "public"."club_topic_replies" TO "anon";
GRANT ALL ON TABLE "public"."club_topic_replies" TO "authenticated";
GRANT ALL ON TABLE "public"."club_topic_replies" TO "service_role";



GRANT ALL ON TABLE "public"."club_topics" TO "anon";
GRANT ALL ON TABLE "public"."club_topics" TO "authenticated";
GRANT ALL ON TABLE "public"."club_topics" TO "service_role";



GRANT ALL ON TABLE "public"."clubs" TO "anon";
GRANT ALL ON TABLE "public"."clubs" TO "authenticated";
GRANT ALL ON TABLE "public"."clubs" TO "service_role";



GRANT ALL ON TABLE "public"."comment_reports" TO "anon";
GRANT ALL ON TABLE "public"."comment_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."comment_reports" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."community_posts" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."community_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."community_posts" TO "service_role";



GRANT UPDATE("likes_count") ON TABLE "public"."community_posts" TO "authenticated";



GRANT ALL ON TABLE "public"."configurator_sessions" TO "anon";
GRANT ALL ON TABLE "public"."configurator_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."configurator_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_members" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_members" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."countries_content" TO "anon";
GRANT ALL ON TABLE "public"."countries_content" TO "authenticated";
GRANT ALL ON TABLE "public"."countries_content" TO "service_role";



GRANT ALL ON TABLE "public"."countries_content_needs_review" TO "anon";
GRANT ALL ON TABLE "public"."countries_content_needs_review" TO "authenticated";
GRANT ALL ON TABLE "public"."countries_content_needs_review" TO "service_role";



GRANT ALL ON TABLE "public"."countries_geo" TO "anon";
GRANT ALL ON TABLE "public"."countries_geo" TO "authenticated";
GRANT ALL ON TABLE "public"."countries_geo" TO "service_role";



GRANT ALL ON TABLE "public"."country_content_blocks" TO "anon";
GRANT ALL ON TABLE "public"."country_content_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."country_content_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."country_practical_guides" TO "anon";
GRANT ALL ON TABLE "public"."country_practical_guides" TO "authenticated";
GRANT ALL ON TABLE "public"."country_practical_guides" TO "service_role";



GRANT ALL ON TABLE "public"."country_sync_log" TO "anon";
GRANT ALL ON TABLE "public"."country_sync_log" TO "authenticated";
GRANT ALL ON TABLE "public"."country_sync_log" TO "service_role";



GRANT ALL ON TABLE "public"."crew_members" TO "anon";
GRANT ALL ON TABLE "public"."crew_members" TO "authenticated";
GRANT ALL ON TABLE "public"."crew_members" TO "service_role";



GRANT ALL ON TABLE "public"."crews" TO "anon";
GRANT ALL ON TABLE "public"."crews" TO "authenticated";
GRANT ALL ON TABLE "public"."crews" TO "service_role";



GRANT ALL ON TABLE "public"."custom_kit_items" TO "anon";
GRANT ALL ON TABLE "public"."custom_kit_items" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_kit_items" TO "service_role";



GRANT ALL ON TABLE "public"."custom_kits" TO "anon";
GRANT ALL ON TABLE "public"."custom_kits" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_kits" TO "service_role";



GRANT ALL ON TABLE "public"."depart_participants" TO "anon";
GRANT ALL ON TABLE "public"."depart_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."depart_participants" TO "service_role";



GRANT ALL ON TABLE "public"."destination_steps" TO "anon";
GRANT ALL ON TABLE "public"."destination_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."destination_steps" TO "service_role";



GRANT ALL ON TABLE "public"."event_expenses" TO "anon";
GRANT ALL ON TABLE "public"."event_expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."event_expenses" TO "service_role";



GRANT ALL ON TABLE "public"."event_participants" TO "anon";
GRANT ALL ON TABLE "public"."event_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."event_participants" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."expedition_reports" TO "anon";
GRANT ALL ON TABLE "public"."expedition_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."expedition_reports" TO "service_role";



GRANT ALL ON TABLE "public"."expert_bookings" TO "anon";
GRANT ALL ON TABLE "public"."expert_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."expert_bookings" TO "service_role";



GRANT ALL ON TABLE "public"."experts" TO "anon";
GRANT ALL ON TABLE "public"."experts" TO "authenticated";
GRANT ALL ON TABLE "public"."experts" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."explore_kits_public" TO "anon";
GRANT ALL ON TABLE "public"."explore_kits_public" TO "authenticated";
GRANT ALL ON TABLE "public"."explore_kits_public" TO "service_role";



GRANT ALL ON TABLE "public"."hiking_routes" TO "anon";
GRANT ALL ON TABLE "public"."hiking_routes" TO "authenticated";
GRANT ALL ON TABLE "public"."hiking_routes" TO "service_role";



GRANT ALL ON TABLE "public"."trail_metadata" TO "anon";
GRANT ALL ON TABLE "public"."trail_metadata" TO "authenticated";
GRANT ALL ON TABLE "public"."trail_metadata" TO "service_role";



GRANT ALL ON TABLE "public"."trail_scores" TO "anon";
GRANT ALL ON TABLE "public"."trail_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."trail_scores" TO "service_role";



GRANT ALL ON TABLE "public"."explore_trails" TO "anon";
GRANT ALL ON TABLE "public"."explore_trails" TO "authenticated";
GRANT ALL ON TABLE "public"."explore_trails" TO "service_role";



GRANT ALL ON TABLE "public"."feature_flags" TO "anon";
GRANT ALL ON TABLE "public"."feature_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_flags" TO "service_role";



GRANT ALL ON TABLE "public"."gear_alert_history" TO "anon";
GRANT ALL ON TABLE "public"."gear_alert_history" TO "authenticated";
GRANT ALL ON TABLE "public"."gear_alert_history" TO "service_role";



GRANT ALL ON TABLE "public"."gear_history" TO "anon";
GRANT ALL ON TABLE "public"."gear_history" TO "authenticated";
GRANT ALL ON TABLE "public"."gear_history" TO "service_role";



GRANT ALL ON TABLE "public"."gear_images" TO "anon";
GRANT ALL ON TABLE "public"."gear_images" TO "authenticated";
GRANT ALL ON TABLE "public"."gear_images" TO "service_role";



GRANT ALL ON TABLE "public"."gear_items" TO "anon";
GRANT ALL ON TABLE "public"."gear_items" TO "authenticated";
GRANT ALL ON TABLE "public"."gear_items" TO "service_role";



GRANT ALL ON TABLE "public"."group_album" TO "anon";
GRANT ALL ON TABLE "public"."group_album" TO "authenticated";
GRANT ALL ON TABLE "public"."group_album" TO "service_role";



GRANT ALL ON TABLE "public"."group_expenses" TO "anon";
GRANT ALL ON TABLE "public"."group_expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."group_expenses" TO "service_role";



GRANT ALL ON TABLE "public"."group_invitations" TO "anon";
GRANT ALL ON TABLE "public"."group_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."group_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."group_kit_items" TO "anon";
GRANT ALL ON TABLE "public"."group_kit_items" TO "authenticated";
GRANT ALL ON TABLE "public"."group_kit_items" TO "service_role";



GRANT ALL ON TABLE "public"."group_members" TO "anon";
GRANT ALL ON TABLE "public"."group_members" TO "authenticated";
GRANT ALL ON TABLE "public"."group_members" TO "service_role";



GRANT ALL ON TABLE "public"."group_messages" TO "anon";
GRANT ALL ON TABLE "public"."group_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."group_messages" TO "service_role";



GRANT ALL ON TABLE "public"."group_poll_votes" TO "anon";
GRANT ALL ON TABLE "public"."group_poll_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."group_poll_votes" TO "service_role";



GRANT ALL ON TABLE "public"."group_polls" TO "anon";
GRANT ALL ON TABLE "public"."group_polls" TO "authenticated";
GRANT ALL ON TABLE "public"."group_polls" TO "service_role";



GRANT ALL ON TABLE "public"."group_reports" TO "anon";
GRANT ALL ON TABLE "public"."group_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."group_reports" TO "service_role";



GRANT ALL ON TABLE "public"."group_tasks" TO "anon";
GRANT ALL ON TABLE "public"."group_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."group_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."groupe_activites" TO "anon";
GRANT ALL ON TABLE "public"."groupe_activites" TO "authenticated";
GRANT ALL ON TABLE "public"."groupe_activites" TO "service_role";



GRANT ALL ON TABLE "public"."groupe_depense_parts" TO "anon";
GRANT ALL ON TABLE "public"."groupe_depense_parts" TO "authenticated";
GRANT ALL ON TABLE "public"."groupe_depense_parts" TO "service_role";



GRANT ALL ON TABLE "public"."groupe_depenses" TO "anon";
GRANT ALL ON TABLE "public"."groupe_depenses" TO "authenticated";
GRANT ALL ON TABLE "public"."groupe_depenses" TO "service_role";



GRANT ALL ON TABLE "public"."groupe_equipement" TO "anon";
GRANT ALL ON TABLE "public"."groupe_equipement" TO "authenticated";
GRANT ALL ON TABLE "public"."groupe_equipement" TO "service_role";



GRANT ALL ON TABLE "public"."groupe_etapes" TO "anon";
GRANT ALL ON TABLE "public"."groupe_etapes" TO "authenticated";
GRANT ALL ON TABLE "public"."groupe_etapes" TO "service_role";



GRANT ALL ON TABLE "public"."groupe_hebergements" TO "anon";
GRANT ALL ON TABLE "public"."groupe_hebergements" TO "authenticated";
GRANT ALL ON TABLE "public"."groupe_hebergements" TO "service_role";



GRANT ALL ON TABLE "public"."groupe_membres" TO "anon";
GRANT ALL ON TABLE "public"."groupe_membres" TO "authenticated";
GRANT ALL ON TABLE "public"."groupe_membres" TO "service_role";



GRANT ALL ON TABLE "public"."groupe_messages" TO "anon";
GRANT ALL ON TABLE "public"."groupe_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."groupe_messages" TO "service_role";



GRANT ALL ON TABLE "public"."groupe_taches" TO "anon";
GRANT ALL ON TABLE "public"."groupe_taches" TO "authenticated";
GRANT ALL ON TABLE "public"."groupe_taches" TO "service_role";



GRANT ALL ON TABLE "public"."groupe_vote_choix" TO "anon";
GRANT ALL ON TABLE "public"."groupe_vote_choix" TO "authenticated";
GRANT ALL ON TABLE "public"."groupe_vote_choix" TO "service_role";



GRANT ALL ON TABLE "public"."groupe_vote_options" TO "anon";
GRANT ALL ON TABLE "public"."groupe_vote_options" TO "authenticated";
GRANT ALL ON TABLE "public"."groupe_vote_options" TO "service_role";



GRANT ALL ON TABLE "public"."groupe_votes" TO "anon";
GRANT ALL ON TABLE "public"."groupe_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."groupe_votes" TO "service_role";



GRANT ALL ON TABLE "public"."groupes" TO "anon";
GRANT ALL ON TABLE "public"."groupes" TO "authenticated";
GRANT ALL ON TABLE "public"."groupes" TO "service_role";



GRANT ALL ON TABLE "public"."guides" TO "anon";
GRANT ALL ON TABLE "public"."guides" TO "authenticated";
GRANT ALL ON TABLE "public"."guides" TO "service_role";



GRANT ALL ON TABLE "public"."hike_sessions" TO "anon";
GRANT ALL ON TABLE "public"."hike_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."hike_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."hub_telemetry" TO "anon";
GRANT ALL ON TABLE "public"."hub_telemetry" TO "authenticated";
GRANT ALL ON TABLE "public"."hub_telemetry" TO "service_role";



GRANT ALL ON TABLE "public"."hub_dashboard_kpis" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_exports" TO "anon";
GRANT ALL ON TABLE "public"."inventory_exports" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_exports" TO "service_role";



GRANT ALL ON TABLE "public"."kit_export_logs" TO "anon";
GRANT ALL ON TABLE "public"."kit_export_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."kit_export_logs" TO "service_role";



GRANT ALL ON TABLE "public"."kit_field_reports" TO "anon";
GRANT ALL ON TABLE "public"."kit_field_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."kit_field_reports" TO "service_role";



GRANT ALL ON TABLE "public"."materiel_kit_items" TO "anon";
GRANT ALL ON TABLE "public"."materiel_kit_items" TO "authenticated";
GRANT ALL ON TABLE "public"."materiel_kit_items" TO "service_role";



GRANT ALL ON TABLE "public"."materiel_kits" TO "anon";
GRANT ALL ON TABLE "public"."materiel_kits" TO "authenticated";
GRANT ALL ON TABLE "public"."materiel_kits" TO "service_role";



GRANT ALL ON TABLE "public"."kit_item_survival" TO "anon";
GRANT ALL ON TABLE "public"."kit_item_survival" TO "authenticated";
GRANT ALL ON TABLE "public"."kit_item_survival" TO "service_role";



GRANT ALL ON TABLE "public"."kit_item_survival_by_kit" TO "anon";
GRANT ALL ON TABLE "public"."kit_item_survival_by_kit" TO "authenticated";
GRANT ALL ON TABLE "public"."kit_item_survival_by_kit" TO "service_role";



GRANT ALL ON TABLE "public"."kit_items" TO "anon";
GRANT ALL ON TABLE "public"."kit_items" TO "authenticated";
GRANT ALL ON TABLE "public"."kit_items" TO "service_role";



GRANT ALL ON TABLE "public"."kit_reports" TO "anon";
GRANT ALL ON TABLE "public"."kit_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."kit_reports" TO "service_role";



GRANT ALL ON TABLE "public"."kit_trust_scores" TO "anon";
GRANT ALL ON TABLE "public"."kit_trust_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."kit_trust_scores" TO "service_role";



GRANT ALL ON TABLE "public"."kits" TO "anon";
GRANT ALL ON TABLE "public"."kits" TO "authenticated";
GRANT ALL ON TABLE "public"."kits" TO "service_role";



GRANT ALL ON TABLE "public"."listings" TO "anon";
GRANT ALL ON TABLE "public"."listings" TO "authenticated";
GRANT ALL ON TABLE "public"."listings" TO "service_role";



GRANT ALL ON TABLE "public"."lkv_events" TO "anon";
GRANT ALL ON TABLE "public"."lkv_events" TO "authenticated";
GRANT ALL ON TABLE "public"."lkv_events" TO "service_role";



GRANT ALL ON TABLE "public"."loans" TO "anon";
GRANT ALL ON TABLE "public"."loans" TO "authenticated";
GRANT ALL ON TABLE "public"."loans" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_history" TO "anon";
GRANT ALL ON TABLE "public"."loyalty_history" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_history" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_redemptions" TO "anon";
GRANT ALL ON TABLE "public"."loyalty_redemptions" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_redemptions" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_rewards" TO "anon";
GRANT ALL ON TABLE "public"."loyalty_rewards" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_rewards" TO "service_role";



GRANT ALL ON TABLE "public"."map_refuges" TO "anon";
GRANT ALL ON TABLE "public"."map_refuges" TO "authenticated";
GRANT ALL ON TABLE "public"."map_refuges" TO "service_role";



GRANT ALL ON TABLE "public"."map_summits" TO "anon";
GRANT ALL ON TABLE "public"."map_summits" TO "authenticated";
GRANT ALL ON TABLE "public"."map_summits" TO "service_role";



GRANT ALL ON TABLE "public"."map_water_points" TO "anon";
GRANT ALL ON TABLE "public"."map_water_points" TO "authenticated";
GRANT ALL ON TABLE "public"."map_water_points" TO "service_role";



GRANT ALL ON TABLE "public"."materiel_history" TO "anon";
GRANT ALL ON TABLE "public"."materiel_history" TO "authenticated";
GRANT ALL ON TABLE "public"."materiel_history" TO "service_role";



GRANT ALL ON SEQUENCE "public"."materiel_history_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."materiel_history_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."materiel_history_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."materiel_kit_history" TO "anon";
GRANT ALL ON TABLE "public"."materiel_kit_history" TO "authenticated";
GRANT ALL ON TABLE "public"."materiel_kit_history" TO "service_role";



GRANT ALL ON TABLE "public"."materiel_loans" TO "anon";
GRANT ALL ON TABLE "public"."materiel_loans" TO "authenticated";
GRANT ALL ON TABLE "public"."materiel_loans" TO "service_role";



GRANT ALL ON TABLE "public"."message_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."message_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."message_mentions" TO "authenticated";
GRANT ALL ON TABLE "public"."message_mentions" TO "service_role";



GRANT ALL ON TABLE "public"."message_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."message_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."moderation_queue" TO "anon";
GRANT ALL ON TABLE "public"."moderation_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."moderation_queue" TO "service_role";



GRANT ALL ON TABLE "public"."notification_deliveries" TO "anon";
GRANT ALL ON TABLE "public"."notification_deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."occasion_items" TO "anon";
GRANT ALL ON TABLE "public"."occasion_items" TO "authenticated";
GRANT ALL ON TABLE "public"."occasion_items" TO "service_role";



GRANT ALL ON TABLE "public"."occasion_offers" TO "anon";
GRANT ALL ON TABLE "public"."occasion_offers" TO "authenticated";
GRANT ALL ON TABLE "public"."occasion_offers" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."outdoor_points" TO "anon";
GRANT ALL ON TABLE "public"."outdoor_points" TO "authenticated";
GRANT ALL ON TABLE "public"."outdoor_points" TO "service_role";



GRANT ALL ON TABLE "public"."overpass_sync_log" TO "anon";
GRANT ALL ON TABLE "public"."overpass_sync_log" TO "authenticated";
GRANT ALL ON TABLE "public"."overpass_sync_log" TO "service_role";



GRANT ALL ON TABLE "public"."pending_contributions" TO "anon";
GRANT ALL ON TABLE "public"."pending_contributions" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_contributions" TO "service_role";



GRANT ALL ON TABLE "public"."place_photos" TO "anon";
GRANT ALL ON TABLE "public"."place_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."place_photos" TO "service_role";



GRANT ALL ON TABLE "public"."place_reports" TO "anon";
GRANT ALL ON TABLE "public"."place_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."place_reports" TO "service_role";



GRANT ALL ON TABLE "public"."place_reviews" TO "anon";
GRANT ALL ON TABLE "public"."place_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."place_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."places" TO "anon";
GRANT ALL ON TABLE "public"."places" TO "authenticated";
GRANT ALL ON TABLE "public"."places" TO "service_role";



GRANT ALL ON TABLE "public"."places_geo" TO "anon";
GRANT ALL ON TABLE "public"."places_geo" TO "authenticated";
GRANT ALL ON TABLE "public"."places_geo" TO "service_role";



GRANT ALL ON TABLE "public"."post_comments" TO "anon";
GRANT ALL ON TABLE "public"."post_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."post_comments" TO "service_role";



GRANT ALL ON TABLE "public"."post_likes" TO "anon";
GRANT ALL ON TABLE "public"."post_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."post_likes" TO "service_role";



GRANT ALL ON TABLE "public"."product_alternatives" TO "anon";
GRANT ALL ON TABLE "public"."product_alternatives" TO "authenticated";
GRANT ALL ON TABLE "public"."product_alternatives" TO "service_role";



GRANT ALL ON TABLE "public"."product_compatibilities" TO "anon";
GRANT ALL ON TABLE "public"."product_compatibilities" TO "authenticated";
GRANT ALL ON TABLE "public"."product_compatibilities" TO "service_role";



GRANT ALL ON TABLE "public"."product_images" TO "anon";
GRANT ALL ON TABLE "public"."product_images" TO "authenticated";
GRANT ALL ON TABLE "public"."product_images" TO "service_role";



GRANT ALL ON TABLE "public"."product_ownership" TO "anon";
GRANT ALL ON TABLE "public"."product_ownership" TO "authenticated";
GRANT ALL ON TABLE "public"."product_ownership" TO "service_role";



GRANT ALL ON TABLE "public"."product_reviews" TO "anon";
GRANT ALL ON TABLE "public"."product_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."product_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."promo_codes" TO "anon";
GRANT ALL ON TABLE "public"."promo_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."promo_codes" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."qa_answers" TO "anon";
GRANT ALL ON TABLE "public"."qa_answers" TO "authenticated";
GRANT ALL ON TABLE "public"."qa_answers" TO "service_role";



GRANT ALL ON TABLE "public"."qa_questions" TO "anon";
GRANT ALL ON TABLE "public"."qa_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."qa_questions" TO "service_role";



GRANT ALL ON TABLE "public"."qa_votes" TO "anon";
GRANT ALL ON TABLE "public"."qa_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."qa_votes" TO "service_role";



GRANT ALL ON TABLE "public"."rental_items" TO "anon";
GRANT ALL ON TABLE "public"."rental_items" TO "authenticated";
GRANT ALL ON TABLE "public"."rental_items" TO "service_role";



GRANT ALL ON TABLE "public"."review_helpful_votes" TO "anon";
GRANT ALL ON TABLE "public"."review_helpful_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."review_helpful_votes" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."reward_accounts" TO "anon";
GRANT ALL ON TABLE "public"."reward_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."reward_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."reward_config" TO "anon";
GRANT ALL ON TABLE "public"."reward_config" TO "authenticated";
GRANT ALL ON TABLE "public"."reward_config" TO "service_role";



GRANT ALL ON TABLE "public"."reward_periods" TO "anon";
GRANT ALL ON TABLE "public"."reward_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."reward_periods" TO "service_role";



GRANT ALL ON TABLE "public"."reward_transactions" TO "anon";
GRANT ALL ON TABLE "public"."reward_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."reward_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."reward_withdrawals" TO "anon";
GRANT ALL ON TABLE "public"."reward_withdrawals" TO "authenticated";
GRANT ALL ON TABLE "public"."reward_withdrawals" TO "service_role";



GRANT ALL ON TABLE "public"."saved_adventures" TO "anon";
GRANT ALL ON TABLE "public"."saved_adventures" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_adventures" TO "service_role";



GRANT ALL ON TABLE "public"."saved_trails" TO "anon";
GRANT ALL ON TABLE "public"."saved_trails" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_trails" TO "service_role";



GRANT ALL ON TABLE "public"."share_tokens" TO "anon";
GRANT ALL ON TABLE "public"."share_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."share_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."shop_products" TO "anon";
GRANT ALL ON TABLE "public"."shop_products" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_products" TO "service_role";



GRANT ALL ON TABLE "public"."sos_alerts" TO "anon";
GRANT ALL ON TABLE "public"."sos_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."sos_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."stock_movements" TO "anon";
GRANT ALL ON TABLE "public"."stock_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_movements" TO "service_role";



GRANT ALL ON TABLE "public"."trail_pois" TO "anon";
GRANT ALL ON TABLE "public"."trail_pois" TO "authenticated";
GRANT ALL ON TABLE "public"."trail_pois" TO "service_role";



GRANT ALL ON TABLE "public"."trail_segments" TO "anon";
GRANT ALL ON TABLE "public"."trail_segments" TO "authenticated";
GRANT ALL ON TABLE "public"."trail_segments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."trail_segments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."trail_segments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."trail_segments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."trails_raw_v1" TO "anon";
GRANT ALL ON TABLE "public"."trails_raw_v1" TO "authenticated";
GRANT ALL ON TABLE "public"."trails_raw_v1" TO "service_role";



GRANT ALL ON TABLE "public"."travel_groups" TO "anon";
GRANT ALL ON TABLE "public"."travel_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."travel_groups" TO "service_role";



GRANT ALL ON TABLE "public"."travel_groups_legacy" TO "anon";
GRANT ALL ON TABLE "public"."travel_groups_legacy" TO "authenticated";
GRANT ALL ON TABLE "public"."travel_groups_legacy" TO "service_role";



GRANT ALL ON TABLE "public"."trip_checklist_items" TO "anon";
GRANT ALL ON TABLE "public"."trip_checklist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_checklist_items" TO "service_role";



GRANT ALL ON TABLE "public"."trip_collaborators" TO "anon";
GRANT ALL ON TABLE "public"."trip_collaborators" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_collaborators" TO "service_role";



GRANT ALL ON TABLE "public"."trip_participants" TO "anon";
GRANT ALL ON TABLE "public"."trip_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_participants" TO "service_role";



GRANT ALL ON TABLE "public"."trip_collaborators_legacy" TO "anon";
GRANT ALL ON TABLE "public"."trip_collaborators_legacy" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_collaborators_legacy" TO "service_role";



GRANT ALL ON TABLE "public"."trip_documents" TO "anon";
GRANT ALL ON TABLE "public"."trip_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_documents" TO "service_role";



GRANT ALL ON TABLE "public"."trip_expenses" TO "anon";
GRANT ALL ON TABLE "public"."trip_expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_expenses" TO "service_role";



GRANT ALL ON TABLE "public"."trip_items" TO "anon";
GRANT ALL ON TABLE "public"."trip_items" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_items" TO "service_role";



GRANT ALL ON TABLE "public"."trip_notes" TO "anon";
GRANT ALL ON TABLE "public"."trip_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_notes" TO "service_role";



GRANT ALL ON TABLE "public"."trip_pois" TO "anon";
GRANT ALL ON TABLE "public"."trip_pois" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_pois" TO "service_role";



GRANT ALL ON TABLE "public"."trip_safety_checkpoints" TO "anon";
GRANT ALL ON TABLE "public"."trip_safety_checkpoints" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_safety_checkpoints" TO "service_role";



GRANT ALL ON TABLE "public"."trip_steps" TO "anon";
GRANT ALL ON TABLE "public"."trip_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_steps" TO "service_role";



GRANT ALL ON TABLE "public"."trips" TO "anon";
GRANT ALL ON TABLE "public"."trips" TO "authenticated";
GRANT ALL ON TABLE "public"."trips" TO "service_role";



GRANT ALL ON TABLE "public"."user_addresses" TO "anon";
GRANT ALL ON TABLE "public"."user_addresses" TO "authenticated";
GRANT ALL ON TABLE "public"."user_addresses" TO "service_role";



GRANT ALL ON TABLE "public"."user_badges" TO "anon";
GRANT ALL ON TABLE "public"."user_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."user_badges" TO "service_role";



GRANT ALL ON TABLE "public"."user_blocks" TO "anon";
GRANT ALL ON TABLE "public"."user_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."user_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."user_challenges" TO "anon";
GRANT ALL ON TABLE "public"."user_challenges" TO "authenticated";
GRANT ALL ON TABLE "public"."user_challenges" TO "service_role";



GRANT ALL ON TABLE "public"."user_documents" TO "anon";
GRANT ALL ON TABLE "public"."user_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."user_documents" TO "service_role";



GRANT ALL ON TABLE "public"."user_field_signature" TO "service_role";



GRANT ALL ON TABLE "public"."user_follows" TO "anon";
GRANT ALL ON TABLE "public"."user_follows" TO "authenticated";
GRANT ALL ON TABLE "public"."user_follows" TO "service_role";



GRANT ALL ON TABLE "public"."user_orientation" TO "authenticated";
GRANT ALL ON TABLE "public"."user_orientation" TO "service_role";



GRANT ALL ON TABLE "public"."user_payment_methods" TO "anon";
GRANT ALL ON TABLE "public"."user_payment_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."user_payment_methods" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







