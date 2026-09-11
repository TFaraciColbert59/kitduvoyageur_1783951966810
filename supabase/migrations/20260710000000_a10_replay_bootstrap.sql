-- ============================================================================
-- A10 — Bootstrap de replay base vide (goto 2026-09-11).
-- Objectif : rendre le replay complet des 150+ migrations déterministe en
-- matérialisant d'abord les objets présents en PRODUCTION (drift) mais absents
-- du dépôt (types enum, tables-only prod, contraintes PK/UNIQUE).
-- IF NOT EXISTS / garde duplicate_object rendent ce fichier inoffensif.
-- Contenu généré à partir du dump schema-only de production (lecture seule).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── 1. Types enum (production) ──
DO $$ BEGIN
CREATE TYPE public."admin_role" AS ENUM (
    'super_admin',
    'admin',
    'moderateur'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE TYPE public."audit_action" AS ENUM (
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
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE TYPE public."geo_country_geometry_source" AS ENUM (
    'natural_earth',
    'geonames',
    'osm',
    'manual'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE TYPE public."geo_feature_class" AS ENUM (
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
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE TYPE public."geo_feature_code" AS ENUM (
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
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE TYPE public."group_expense_status" AS ENUM (
    'pending',
    'settled'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE TYPE public."group_member_role" AS ENUM (
    'organizer',
    'co_organizer',
    'member',
    'observer'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE TYPE public."group_member_status" AS ENUM (
    'pending',
    'active',
    'left',
    'removed',
    'rejected'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE TYPE public."group_poll_status" AS ENUM (
    'open',
    'closed'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE TYPE public."group_task_status" AS ENUM (
    'todo',
    'in_progress',
    'done'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE TYPE public."group_visibility" AS ENUM (
    'public',
    'private',
    'invite_only'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE TYPE public."listing_type" AS ENUM (
    'neuf',
    'kit',
    'occasion',
    'enchere',
    'location'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE TYPE public."moderation_status" AS ENUM (
    'en_attente',
    'approuve',
    'rejete',
    'signale'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE TYPE public."occasion_etat" AS ENUM (
    'comme_neuf',
    'bon_etat',
    'etat_correct'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE TYPE public."occasion_statut" AS ENUM (
    'en_attente_moderation',
    'active',
    'vendue',
    'retiree',
    'litige'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE TYPE public."shop_transaction_type" AS ENUM (
    'achat',
    'location',
    'occasion',
    'enchere'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE TYPE public."stock_statut_type" AS ENUM (
    'en_stock',
    'rupture',
    'reappro'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE TYPE public."sync_status" AS ENUM (
    'success',
    'failed',
    'pending'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE TYPE public."trip_activity_type" AS ENUM (
    'hiking',
    'trekking',
    'bivouac',
    'roadtrip',
    'cultural',
    'bushcraft',
    'mixed'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE TYPE public."trip_budget_currency" AS ENUM (
    'EUR',
    'USD',
    'GBP',
    'CHF',
    'CAD',
    'JPY'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE TYPE public."trip_collaborator_role" AS ENUM (
    'owner',
    'editor',
    'viewer'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE TYPE public."trip_difficulty" AS ENUM (
    'easy',
    'moderate',
    'hard',
    'expert'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE TYPE public."trip_document_category" AS ENUM (
    'passport',
    'insurance',
    'booking',
    'ticket',
    'medical',
    'other'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE TYPE public."trip_item_status" AS ENUM (
    'packed',
    'needed',
    'optional',
    'missing'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE TYPE public."trip_status" AS ENUM (
    'draft',
    'planned',
    'active',
    'completed',
    'cancelled'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE TYPE public."trip_step_transport" AS ENUM (
    'foot',
    'car',
    'bus',
    'train',
    'plane',
    'boat',
    'bike',
    'other'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE TYPE public."trip_visibility" AS ENUM (
    'private',
    'unlisted',
    'public'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. Tables de production (sans FK) ──
-- CREATE TABLE IF NOT EXISTS => no-op pour les tables déjà créées par le dépôt.

CREATE TABLE IF NOT EXISTS public."ai_jobs" (
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

CREATE TABLE IF NOT EXISTS public."activities" (
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

CREATE TABLE IF NOT EXISTS public."admin_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "action" public."audit_action" NOT NULL,
    "cible_type" "text" NOT NULL,
    "cible_id" "text" NOT NULL,
    "avant" "jsonb",
    "apres" "jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."admin_audit_logs" (
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

CREATE TABLE IF NOT EXISTS public."admin_regions_geo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "country_id" "uuid",
    "admin_code" "text",
    "name" "text" NOT NULL,
    "level" integer,
    "geometry" public."geometry"(Polygon,4326),
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

CREATE TABLE IF NOT EXISTS public."admin_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" public."admin_role" DEFAULT 'moderateur'::public."admin_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid"
);

CREATE TABLE IF NOT EXISTS public."affiliate_clicks" (
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

CREATE TABLE IF NOT EXISTS public."affiliate_conversions" (
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

CREATE TABLE IF NOT EXISTS public."affiliate_links" (
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

CREATE TABLE IF NOT EXISTS public."affiliate_offers" (
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

CREATE TABLE IF NOT EXISTS public."affiliate_partners" (
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

CREATE TABLE IF NOT EXISTS public."affiliate_programs" (
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

CREATE TABLE IF NOT EXISTS public."ai_response_cache" (
    "cache_key" "text" NOT NULL,
    "feature" "text" DEFAULT 'general'::"text" NOT NULL,
    "response" "jsonb" NOT NULL,
    "model" "text",
    "provider" "text",
    "hit_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS public."ai_usage_daily" (
    "user_id" "uuid" NOT NULL,
    "day" "date" DEFAULT CURRENT_DATE NOT NULL,
    "requests_heavy" integer DEFAULT 0 NOT NULL,
    "requests_fast" integer DEFAULT 0 NOT NULL,
    "requests_by_feature" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);

CREATE TABLE IF NOT EXISTS public."alerts" (
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

CREATE TABLE IF NOT EXISTS public."ama_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid",
    "author_id" "uuid",
    "content" "text" NOT NULL,
    "votes_count" integer DEFAULT 0,
    "is_answered" boolean DEFAULT false,
    "answer" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."ama_sessions" (
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

CREATE TABLE IF NOT EXISTS public."ama_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question_id" "uuid",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."ambassadors" (
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

CREATE TABLE IF NOT EXISTS public."auction_auto_bids" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "bidder_id" "uuid" NOT NULL,
    "plafond_cents" integer NOT NULL,
    "actif" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."auction_bids" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "bidder_id" "uuid" NOT NULL,
    "montant_cents" integer NOT NULL,
    "is_auto_bid" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."badges" (
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

CREATE TABLE IF NOT EXISTS public."carnet_collaborators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "carnet_id" "uuid",
    "user_id" "uuid",
    "role" "text" DEFAULT 'contributor'::"text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "carnet_collaborators_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'contributor'::"text", 'viewer'::"text"])))
);

CREATE TABLE IF NOT EXISTS public."carnet_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "carnet_id" "uuid",
    "author_id" "uuid",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."carnet_favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "carnet_id" "uuid",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."carnet_gear_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "carnet_id" "uuid",
    "product_id" "uuid",
    "note" "text"
);

CREATE TABLE IF NOT EXISTS public."carnet_kit_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "carnet_id" "uuid",
    "nom" "text" NOT NULL,
    "detail" "text",
    "poids_g" integer DEFAULT 0,
    "couleur_tag" "text",
    "sort_order" integer DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public."carnet_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "carnet_id" "uuid",
    "user_id" "uuid",
    "reaction" "text" DEFAULT 'useful'::"text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."carnet_media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "carnet_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "type" "text" DEFAULT 'photo'::"text",
    "caption" "text",
    "position" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS public."carnet_moments" (
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

CREATE TABLE IF NOT EXISTS public."carnet_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "carnet_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "ip_address" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS public."carnets" (
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

CREATE TABLE IF NOT EXISTS public."cart_loyalty_discounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_id" "text" NOT NULL,
    "discount_type" "text" DEFAULT 'free'::"text",
    "discount_value" numeric(10,2) DEFAULT 0,
    "applied_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."challenges" (
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

CREATE TABLE IF NOT EXISTS public."checkout_intents" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid",
    "payload" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '02:00:00'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "checkout_intents_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'used'::"text", 'expired'::"text"])))
);

CREATE TABLE IF NOT EXISTS public."club_challenge_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "challenge_id" "uuid",
    "user_id" "uuid",
    "proof_text" "text" DEFAULT ''::"text",
    "proof_image" "text" DEFAULT ''::"text",
    "score" integer DEFAULT 0,
    "validated" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."club_challenges" (
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

CREATE TABLE IF NOT EXISTS public."club_event_participants" (
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."club_events" (
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

CREATE TABLE IF NOT EXISTS public."club_join_requests" (
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

CREATE TABLE IF NOT EXISTS public."club_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid",
    "user_id" "uuid",
    "role" "text" DEFAULT 'member'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "joined_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "club_members_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'moderator'::"text", 'member'::"text"]))),
    CONSTRAINT "club_members_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'banned'::"text", 'pending'::"text"])))
);

CREATE TABLE IF NOT EXISTS public."club_recommended_kits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid",
    "kit_id" "uuid",
    "recommended_by" "uuid",
    "note" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."club_reports" (
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

CREATE TABLE IF NOT EXISTS public."club_topic_likes" (
    "topic_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."club_topic_replies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "topic_id" "uuid",
    "author_id" "uuid",
    "content" "text" NOT NULL,
    "is_approved" boolean DEFAULT true,
    "likes_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "parent_id" "uuid"
);

CREATE TABLE IF NOT EXISTS public."club_topics" (
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

CREATE TABLE IF NOT EXISTS public."clubs" (
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

CREATE TABLE IF NOT EXISTS public."comment_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "reporter_id" "uuid",
    "reason" "text" DEFAULT 'Propos inappropriés'::"text",
    "table_name" "text" DEFAULT 'post_comments'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "comment_reports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewed'::"text", 'dismissed'::"text"])))
);

CREATE TABLE IF NOT EXISTS public."community_posts" (
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

CREATE TABLE IF NOT EXISTS public."configurator_sessions" (
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

CREATE TABLE IF NOT EXISTS public."conversation_members" (
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

CREATE TABLE IF NOT EXISTS public."conversations" (
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

CREATE TABLE IF NOT EXISTS public."countries_content" (
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

CREATE TABLE IF NOT EXISTS public."countries_geo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "iso_a2" "text" NOT NULL,
    "name" "text" NOT NULL,
    "continent" "text",
    "geometry" public."geometry"(Geometry,4326),
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
    "geometry_source" public."geo_country_geometry_source" DEFAULT 'manual'::public."geo_country_geometry_source" NOT NULL,
    "is_sovereign" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "timezone" "text",
    "subregion" "text",
    "sources" "text"
);

CREATE TABLE IF NOT EXISTS public."country_content_blocks" (
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

CREATE TABLE IF NOT EXISTS public."country_practical_guides" (
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

CREATE TABLE IF NOT EXISTS public."country_sync_log" (
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

CREATE TABLE IF NOT EXISTS public."crew_members" (
    "crew_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "crew_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'organizer'::"text", 'member'::"text", 'guest'::"text"]))),
    CONSTRAINT "crew_members_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'pending'::"text", 'left'::"text", 'removed'::"text"])))
);

CREATE TABLE IF NOT EXISTS public."crews" (
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

CREATE TABLE IF NOT EXISTS public."custom_kit_items" (
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

CREATE TABLE IF NOT EXISTS public."custom_kits" (
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

CREATE TABLE IF NOT EXISTS public."depart_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kit_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "is_emergency_contact" boolean DEFAULT false NOT NULL,
    "contact" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."destination_steps" (
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

CREATE TABLE IF NOT EXISTS public."event_expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid",
    "label" "text" NOT NULL,
    "amount" numeric DEFAULT 0,
    "paid" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS public."event_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS public."events" (
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

CREATE TABLE IF NOT EXISTS public."expedition_reports" (
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

CREATE TABLE IF NOT EXISTS public."expert_bookings" (
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

CREATE TABLE IF NOT EXISTS public."experts" (
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

CREATE TABLE IF NOT EXISTS public."user_profiles" (
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

CREATE TABLE IF NOT EXISTS public."hiking_routes" (
    "id" bigint NOT NULL,
    "osm_relation_id" bigint,
    "name" "text",
    "ref" "text",
    "network" "text",
    "distance_km" numeric,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "geom" public."geometry"(MultiLineString,4326),
    "region" "text"
);

CREATE TABLE IF NOT EXISTS public."trail_metadata" (
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

CREATE TABLE IF NOT EXISTS public."trail_scores" (
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

CREATE TABLE IF NOT EXISTS public."feature_flags" (
    "id" "text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "scope" "text" DEFAULT 'global'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid"
);

CREATE TABLE IF NOT EXISTS public."gear_alert_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "gear_item_id" "uuid",
    "alert_type" "text" NOT NULL,
    "label" "text",
    "resolved_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS public."gear_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gear_item_id" "uuid",
    "event_type" "text",
    "event_date" timestamp with time zone DEFAULT "now"(),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS public."gear_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gear_item_id" "uuid",
    "url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS public."gear_items" (
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

CREATE TABLE IF NOT EXISTS public."group_album" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid",
    "uploaded_by" "uuid",
    "image_url" "text" NOT NULL,
    "caption" "text",
    "location" "text",
    "taken_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS public."group_expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid",
    "paid_by" "uuid",
    "title" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "category" "text" DEFAULT 'Divers'::"text",
    "split_between" "uuid"[] DEFAULT '{}'::"uuid"[],
    "receipt_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" public."group_expense_status" DEFAULT 'pending'::public."group_expense_status"
);

CREATE TABLE IF NOT EXISTS public."group_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid",
    "invited_by" "uuid",
    "email" "text",
    "token" "text" DEFAULT ("gen_random_uuid"())::"text",
    "used_at" timestamp with time zone,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS public."group_kit_items" (
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

CREATE TABLE IF NOT EXISTS public."group_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid",
    "user_id" "uuid",
    "weight_capacity" integer DEFAULT 15000,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "role" public."group_member_role" DEFAULT 'member'::public."group_member_role",
    "status" public."group_member_status" DEFAULT 'active'::public."group_member_status",
    "invited_by" "uuid"
);

CREATE TABLE IF NOT EXISTS public."group_messages" (
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

CREATE TABLE IF NOT EXISTS public."group_poll_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "poll_id" "uuid",
    "user_id" "uuid",
    "option_index" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS public."group_polls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid",
    "created_by" "uuid",
    "question" "text" NOT NULL,
    "options" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "ends_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" public."group_poll_status" DEFAULT 'open'::public."group_poll_status"
);

CREATE TABLE IF NOT EXISTS public."group_reports" (
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

CREATE TABLE IF NOT EXISTS public."group_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid",
    "assigned_to" "uuid",
    "created_by" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "due_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" public."group_task_status" DEFAULT 'todo'::public."group_task_status"
);

CREATE TABLE IF NOT EXISTS public."groupe_activites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "groupe_id" "uuid",
    "membre_id" "uuid",
    "type" "text",
    "description" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS public."groupe_depense_parts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "depense_id" "uuid",
    "membre_id" "uuid",
    "montant_cents" integer DEFAULT 0,
    "regle" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public."groupe_depenses" (
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

CREATE TABLE IF NOT EXISTS public."groupe_equipement" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "groupe_id" "uuid",
    "nom" "text" NOT NULL,
    "categorie" "text",
    "apporte_par" "uuid",
    "poids_g" integer DEFAULT 0,
    "statut" "text" DEFAULT 'confirme'::"text",
    "note" "text"
);

CREATE TABLE IF NOT EXISTS public."groupe_etapes" (
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

CREATE TABLE IF NOT EXISTS public."groupe_hebergements" (
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

CREATE TABLE IF NOT EXISTS public."groupe_membres" (
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

CREATE TABLE IF NOT EXISTS public."groupe_messages" (
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

CREATE TABLE IF NOT EXISTS public."groupe_taches" (
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

CREATE TABLE IF NOT EXISTS public."groupe_vote_choix" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vote_id" "uuid",
    "option_id" "uuid",
    "membre_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS public."groupe_vote_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vote_id" "uuid",
    "libelle" "text" NOT NULL,
    "detail" "text",
    "ordre" integer DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public."groupe_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "groupe_id" "uuid",
    "question" "text" NOT NULL,
    "contexte" "text",
    "lance_par" "uuid",
    "statut" "text" DEFAULT 'actif'::"text",
    "date_cloture" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS public."groupes" (
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

CREATE TABLE IF NOT EXISTS public."guides" (
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

CREATE TABLE IF NOT EXISTS public."hike_sessions" (
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

CREATE TABLE IF NOT EXISTS public."hub_telemetry" (
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

CREATE TABLE IF NOT EXISTS public."inventory_exports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "exported_at" timestamp with time zone DEFAULT "now"(),
    "type" "text" DEFAULT 'csv'::"text" NOT NULL,
    CONSTRAINT "inventory_exports_type_check" CHECK (("type" = ANY (ARRAY['csv'::"text", 'pdf'::"text"])))
);

CREATE TABLE IF NOT EXISTS public."kit_export_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kit_id" "uuid",
    "user_id" "uuid",
    "exported_at" timestamp with time zone DEFAULT "now"(),
    "format" "text" DEFAULT 'pdf'::"text" NOT NULL,
    CONSTRAINT "kit_export_logs_format_check" CHECK (("format" = ANY (ARRAY['pdf'::"text", 'ics'::"text", 'csv'::"text"])))
);

CREATE TABLE IF NOT EXISTS public."kit_field_reports" (
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

CREATE TABLE IF NOT EXISTS public."materiel_kit_items" (
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

CREATE TABLE IF NOT EXISTS public."materiel_kits" (
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

CREATE TABLE IF NOT EXISTS public."kit_items" (
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

CREATE TABLE IF NOT EXISTS public."kit_reports" (
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

CREATE TABLE IF NOT EXISTS public."kits" (
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

CREATE TABLE IF NOT EXISTS public."listings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "produit_id" "text",
    "listing_type" "text" NOT NULL,
    "prix_cents" integer DEFAULT 0 NOT NULL,
    "statut" "text" DEFAULT 'actif'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "listings_listing_type_check" CHECK (("listing_type" = ANY (ARRAY['neuf'::"text", 'occasion'::"text", 'kit'::"text", 'enchere'::"text", 'location'::"text"])))
);

CREATE TABLE IF NOT EXISTS public."lkv_events" (
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

CREATE TABLE IF NOT EXISTS public."loans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gear_item_id" "uuid",
    "loaned_to" "text",
    "loaned_at" timestamp with time zone,
    "returned_at" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS public."loyalty_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "points" integer DEFAULT 0,
    "type" "text" DEFAULT 'earned'::"text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "source_id" "text"
);

CREATE TABLE IF NOT EXISTS public."loyalty_redemptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "reward_id" "uuid",
    "points_spent" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "status" "text" DEFAULT 'completed'::"text"
);

CREATE TABLE IF NOT EXISTS public."loyalty_rewards" (
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

CREATE TABLE IF NOT EXISTS public."map_refuges" (
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

CREATE TABLE IF NOT EXISTS public."map_summits" (
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

CREATE TABLE IF NOT EXISTS public."map_water_points" (
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

CREATE TABLE IF NOT EXISTS public."materiel_history" (
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

CREATE TABLE IF NOT EXISTS public."materiel_kit_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kit_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "materiel_kit_history_action_check" CHECK (("action" = ANY (ARRAY['created'::"text", 'updated'::"text", 'deleted'::"text", 'restored'::"text", 'forked'::"text", 'optimized'::"text", 'compared'::"text"])))
);

CREATE TABLE IF NOT EXISTS public."materiel_loans" (
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

CREATE TABLE IF NOT EXISTS public."message_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_name" "text",
    "file_type" "text",
    "file_size" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "message_attachments_file_size_check" CHECK (("file_size" > 0))
);

CREATE TABLE IF NOT EXISTS public."message_mentions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "mentioned_user_id" "uuid" NOT NULL,
    "mention_position" integer,
    "is_read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "message_mentions_mention_position_check" CHECK (("mention_position" >= 0))
);

CREATE TABLE IF NOT EXISTS public."message_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reaction_type" "text" DEFAULT 'emoji'::"text",
    "reaction_value" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "message_reactions_reaction_type_check" CHECK (("reaction_type" = ANY (ARRAY['emoji'::"text", 'text'::"text"])))
);

CREATE TABLE IF NOT EXISTS public."messages" (
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

CREATE TABLE IF NOT EXISTS public."moderation_queue" (
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

CREATE TABLE IF NOT EXISTS public."notification_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "notification_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "provider_response" "jsonb",
    "attempted_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS public."notification_preferences" (
    "user_id" "uuid" NOT NULL,
    "notification_type" "text" NOT NULL,
    "in_app_enabled" boolean DEFAULT true NOT NULL,
    "email_enabled" boolean DEFAULT true NOT NULL,
    "push_enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS public."notifications" (
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

CREATE TABLE IF NOT EXISTS public."occasion_items" (
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

CREATE TABLE IF NOT EXISTS public."occasion_offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "occasion_item_id" "uuid" NOT NULL,
    "buyer_id" "uuid" NOT NULL,
    "offered_price" numeric NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "occasion_offers_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text", 'withdrawn'::"text"])))
);

CREATE TABLE IF NOT EXISTS public."order_items" (
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

CREATE TABLE IF NOT EXISTS public."orders" (
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

CREATE TABLE IF NOT EXISTS public."outdoor_points" (
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

CREATE TABLE IF NOT EXISTS public."overpass_sync_log" (
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

CREATE TABLE IF NOT EXISTS public."pending_contributions" (
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

CREATE TABLE IF NOT EXISTS public."place_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "place_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "caption" "text",
    "has_exif_stripped" boolean DEFAULT true NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."place_reports" (
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

CREATE TABLE IF NOT EXISTS public."place_reviews" (
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

CREATE TABLE IF NOT EXISTS public."places" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "country_code" "text" NOT NULL,
    "region" "text",
    "city" "text",
    "latitude" numeric(10,7) NOT NULL,
    "longitude" numeric(10,7) NOT NULL,
    "geom" public."geography"(Point,4326),
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

CREATE TABLE IF NOT EXISTS public."places_geo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_region_id" "uuid",
    "name" "text" NOT NULL,
    "feature_code" "text",
    "geometry" public."geometry"(Point,4326),
    "elevation" integer,
    "population" integer,
    "timezone" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "geoname_id" bigint,
    "country_iso_a2" "text",
    "feature_class" public."geo_feature_class",
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

CREATE TABLE IF NOT EXISTS public."post_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid",
    "author_id" "uuid",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "parent_id" "uuid"
);

CREATE TABLE IF NOT EXISTS public."post_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."product_alternatives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "original_product_id" "text" NOT NULL,
    "substitute_product_id" "text" NOT NULL,
    "priority" integer DEFAULT 1,
    "reason" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS public."product_compatibilities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id_1" "text" NOT NULL,
    "product_id_2" "text" NOT NULL,
    "relation_type" "text" DEFAULT 'compatible_with'::"text" NOT NULL,
    "notes" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS public."product_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "storage_path" "text" DEFAULT ''::"text" NOT NULL,
    "url" "text" DEFAULT ''::"text" NOT NULL,
    "alt" "text" DEFAULT ''::"text",
    "is_primary" boolean DEFAULT false,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS public."product_ownership" (
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

CREATE TABLE IF NOT EXISTS public."product_reviews" (
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

CREATE TABLE IF NOT EXISTS public."products" (
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

CREATE TABLE IF NOT EXISTS public."promo_codes" (
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

CREATE TABLE IF NOT EXISTS public."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subscription" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS public."qa_answers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question_id" "uuid",
    "author_id" "uuid",
    "content" "text" NOT NULL,
    "votes_count" integer DEFAULT 0,
    "is_accepted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."qa_questions" (
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

CREATE TABLE IF NOT EXISTS public."qa_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "target_type" "text",
    "target_id" "uuid",
    "vote" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "qa_votes_target_type_check" CHECK (("target_type" = ANY (ARRAY['question'::"text", 'answer'::"text"]))),
    CONSTRAINT "qa_votes_vote_check" CHECK (("vote" = ANY (ARRAY[1, '-1'::integer])))
);

CREATE TABLE IF NOT EXISTS public."rental_items" (
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

CREATE TABLE IF NOT EXISTS public."review_helpful_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL
);

CREATE TABLE IF NOT EXISTS public."reviews" (
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

CREATE TABLE IF NOT EXISTS public."reward_accounts" (
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

CREATE TABLE IF NOT EXISTS public."reward_config" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid"
);

CREATE TABLE IF NOT EXISTS public."reward_periods" (
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

CREATE TABLE IF NOT EXISTS public."reward_transactions" (
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

CREATE TABLE IF NOT EXISTS public."reward_withdrawals" (
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

CREATE TABLE IF NOT EXISTS public."saved_adventures" (
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

CREATE TABLE IF NOT EXISTS public."saved_trails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "trail_id" "text" NOT NULL,
    "trail_name" "text",
    "trail_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."share_tokens" (
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

CREATE TABLE IF NOT EXISTS public."shop_products" (
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
    "transaction_type" public."shop_transaction_type" DEFAULT 'achat'::public."shop_transaction_type" NOT NULL,
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

CREATE TABLE IF NOT EXISTS public."sos_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "latitude" numeric,
    "longitude" numeric,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS public."stock_movements" (
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

CREATE TABLE IF NOT EXISTS public."trail_pois" (
    "id" bigint NOT NULL,
    "osm_id" bigint,
    "category" "text",
    "name" "text",
    "description" "text",
    "tags" "jsonb",
    "geom" public."geometry"(Point,4326)
);

CREATE TABLE IF NOT EXISTS public."trail_segments" (
    "id" bigint NOT NULL,
    "osm_id" bigint NOT NULL,
    "name" "text",
    "highway" "text",
    "sac_scale" "text",
    "surface" "text",
    "tags" "jsonb",
    "geom" public."geometry"(LineString,4326) NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."trails_raw_v1" (
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

CREATE TABLE IF NOT EXISTS public."travel_groups" (
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
    "visibility" public."group_visibility" DEFAULT 'public'::public."group_visibility",
    "country_iso" "text",
    "min_trust_score" integer DEFAULT 50,
    "mixite" "text" DEFAULT 'all'::"text",
    "conversation_id" "uuid"
);

CREATE TABLE IF NOT EXISTS public."trip_checklist_items" (
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

CREATE TABLE IF NOT EXISTS public."trip_collaborators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" public."trip_collaborator_role" DEFAULT 'viewer'::public."trip_collaborator_role" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."trip_participants" (
    "trip_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "status" "text" DEFAULT 'confirmed'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trip_participants_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'organizer'::"text", 'member'::"text", 'guest'::"text"]))),
    CONSTRAINT "trip_participants_status_check" CHECK (("status" = ANY (ARRAY['invited'::"text", 'confirmed'::"text", 'declined'::"text", 'removed'::"text"])))
);

CREATE TABLE IF NOT EXISTS public."trip_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "category" public."trip_document_category" DEFAULT 'other'::public."trip_document_category" NOT NULL,
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

CREATE TABLE IF NOT EXISTS public."trip_expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "payer_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "currency" public."trip_budget_currency" DEFAULT 'EUR'::public."trip_budget_currency" NOT NULL,
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

CREATE TABLE IF NOT EXISTS public."trip_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "item_name" "text" NOT NULL,
    "category" "text",
    "quantity" integer DEFAULT 1 NOT NULL,
    "weight_grams" numeric(8,2),
    "is_packed" boolean DEFAULT false NOT NULL,
    "status" public."trip_item_status" DEFAULT 'needed'::public."trip_item_status" NOT NULL,
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

CREATE TABLE IF NOT EXISTS public."trip_notes" (
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

CREATE TABLE IF NOT EXISTS public."trip_pois" (
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

CREATE TABLE IF NOT EXISTS public."trip_safety_checkpoints" (
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

CREATE TABLE IF NOT EXISTS public."trip_steps" (
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
    "transport_mode" public."trip_step_transport",
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

CREATE TABLE IF NOT EXISTS public."trips" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "destination_country_code" "text",
    "destination_name" "text",
    "start_date" "date",
    "end_date" "date",
    "status" public."trip_status" DEFAULT 'draft'::public."trip_status" NOT NULL,
    "visibility" public."trip_visibility" DEFAULT 'private'::public."trip_visibility" NOT NULL,
    "difficulty" public."trip_difficulty" DEFAULT 'moderate'::public."trip_difficulty" NOT NULL,
    "primary_activity" public."trip_activity_type" DEFAULT 'hiking'::public."trip_activity_type" NOT NULL,
    "estimated_budget" numeric(10,2),
    "budget_currency" public."trip_budget_currency" DEFAULT 'EUR'::public."trip_budget_currency" NOT NULL,
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

CREATE TABLE IF NOT EXISTS public."user_addresses" (
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

CREATE TABLE IF NOT EXISTS public."user_badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "badge_id" "uuid",
    "earned_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."user_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "blocker_id" "uuid",
    "blocked_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS public."user_challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "challenge_id" "uuid",
    "progress" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."user_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" DEFAULT 'autre'::"text" NOT NULL,
    "destination" "text" DEFAULT ''::"text",
    "expiry" "date",
    "file_name" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."user_follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "follower_id" "uuid",
    "following_id" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."user_orientation" (
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

CREATE TABLE IF NOT EXISTS public."user_payment_methods" (
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

-- ── 3. Contraintes PK/UNIQUE de production (gardées) ──
DO $$ BEGIN ALTER TABLE public.activities ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.admin_audit_log ADD CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.admin_audit_logs ADD CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.admin_regions_geo ADD CONSTRAINT "admin_regions_geo_geoname_id_key" UNIQUE ("geoname_id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.admin_regions_geo ADD CONSTRAINT "admin_regions_geo_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.admin_roles ADD CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.affiliate_clicks ADD CONSTRAINT "affiliate_clicks_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.affiliate_conversions ADD CONSTRAINT "affiliate_conversions_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.affiliate_links ADD CONSTRAINT "affiliate_links_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.affiliate_links ADD CONSTRAINT "affiliate_links_slug_key" UNIQUE ("slug"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.affiliate_offers ADD CONSTRAINT "affiliate_offers_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.affiliate_partners ADD CONSTRAINT "affiliate_partners_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.affiliate_partners ADD CONSTRAINT "affiliate_partners_slug_key" UNIQUE ("slug"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.affiliate_programs ADD CONSTRAINT "affiliate_programs_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ai_jobs ADD CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ai_response_cache ADD CONSTRAINT "ai_response_cache_pkey" PRIMARY KEY ("cache_key"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ai_usage_daily ADD CONSTRAINT "ai_usage_daily_pkey" PRIMARY KEY ("user_id", "day"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.alerts ADD CONSTRAINT "alerts_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ama_questions ADD CONSTRAINT "ama_questions_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ama_sessions ADD CONSTRAINT "ama_sessions_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ama_votes ADD CONSTRAINT "ama_votes_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ambassadors ADD CONSTRAINT "ambassadors_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.auction_auto_bids ADD CONSTRAINT "auction_auto_bids_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.auction_bids ADD CONSTRAINT "auction_bids_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.badges ADD CONSTRAINT "badges_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.carnet_collaborators ADD CONSTRAINT "carnet_collaborators_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.carnet_comments ADD CONSTRAINT "carnet_comments_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.carnet_favorites ADD CONSTRAINT "carnet_favorites_carnet_id_user_id_key" UNIQUE ("carnet_id", "user_id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.carnet_favorites ADD CONSTRAINT "carnet_favorites_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.carnet_gear_links ADD CONSTRAINT "carnet_gear_links_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.carnet_kit_items ADD CONSTRAINT "carnet_kit_items_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.carnet_likes ADD CONSTRAINT "carnet_likes_carnet_id_user_id_key" UNIQUE ("carnet_id", "user_id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.carnet_likes ADD CONSTRAINT "carnet_likes_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.carnet_media ADD CONSTRAINT "carnet_media_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.carnet_moments ADD CONSTRAINT "carnet_moments_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.carnet_views ADD CONSTRAINT "carnet_views_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.carnets ADD CONSTRAINT "carnets_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.cart_loyalty_discounts ADD CONSTRAINT "cart_loyalty_discounts_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.cart_loyalty_discounts ADD CONSTRAINT "cart_loyalty_discounts_user_id_product_id_key" UNIQUE ("user_id", "product_id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.challenges ADD CONSTRAINT "challenges_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.checkout_intents ADD CONSTRAINT "checkout_intents_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.club_challenge_entries ADD CONSTRAINT "club_challenge_entries_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.club_challenges ADD CONSTRAINT "club_challenges_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.club_event_participants ADD CONSTRAINT "club_event_participants_pkey" PRIMARY KEY ("event_id", "user_id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.club_events ADD CONSTRAINT "club_events_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.club_join_requests ADD CONSTRAINT "club_join_requests_club_user_key" UNIQUE ("club_id", "user_id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.club_join_requests ADD CONSTRAINT "club_join_requests_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.club_members ADD CONSTRAINT "club_members_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.club_recommended_kits ADD CONSTRAINT "club_recommended_kits_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.club_reports ADD CONSTRAINT "club_reports_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.club_topic_likes ADD CONSTRAINT "club_topic_likes_pkey" PRIMARY KEY ("topic_id", "user_id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.club_topic_replies ADD CONSTRAINT "club_topic_replies_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.club_topics ADD CONSTRAINT "club_topics_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.clubs ADD CONSTRAINT "clubs_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.clubs ADD CONSTRAINT "clubs_slug_key" UNIQUE ("slug"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.comment_reports ADD CONSTRAINT "comment_reports_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.community_posts ADD CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.configurator_sessions ADD CONSTRAINT "configurator_sessions_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.conversation_members ADD CONSTRAINT "conversation_members_conversation_id_user_id_key" UNIQUE ("conversation_id", "user_id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.conversation_members ADD CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.conversations ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_content ADD CONSTRAINT "countries_content_country_iso_a2_key" UNIQUE ("country_iso_a2"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_content ADD CONSTRAINT "countries_content_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_content ADD CONSTRAINT "countries_content_slug_key" UNIQUE ("slug"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_geo ADD CONSTRAINT "countries_geo_geoname_id_key" UNIQUE ("geoname_id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_geo ADD CONSTRAINT "countries_geo_iso_a2_key" UNIQUE ("iso_a2"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_geo ADD CONSTRAINT "countries_geo_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.country_content_blocks ADD CONSTRAINT "country_content_blocks_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.country_practical_guides ADD CONSTRAINT "country_practical_guides_country_code_section_key" UNIQUE ("country_code", "section"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.country_practical_guides ADD CONSTRAINT "country_practical_guides_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.country_sync_log ADD CONSTRAINT "country_sync_log_code_iso_key" UNIQUE ("code_iso"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.country_sync_log ADD CONSTRAINT "country_sync_log_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.crew_members ADD CONSTRAINT "crew_members_pkey" PRIMARY KEY ("crew_id", "user_id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.crews ADD CONSTRAINT "crews_invite_code_key" UNIQUE ("invite_code"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.crews ADD CONSTRAINT "crews_legacy_group_id_key" UNIQUE ("legacy_group_id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.crews ADD CONSTRAINT "crews_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.crews ADD CONSTRAINT "crews_slug_key" UNIQUE ("slug"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.custom_kit_items ADD CONSTRAINT "custom_kit_items_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.custom_kits ADD CONSTRAINT "custom_kits_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.depart_participants ADD CONSTRAINT "depart_participants_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.destination_steps ADD CONSTRAINT "destination_steps_natural_key_key" UNIQUE ("natural_key"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.destination_steps ADD CONSTRAINT "destination_steps_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.event_expenses ADD CONSTRAINT "event_expenses_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.event_participants ADD CONSTRAINT "event_participants_event_id_user_id_key" UNIQUE ("event_id", "user_id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.event_participants ADD CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.events ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.expedition_reports ADD CONSTRAINT "expedition_reports_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.expert_bookings ADD CONSTRAINT "expert_bookings_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.experts ADD CONSTRAINT "experts_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.feature_flags ADD CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_alert_history ADD CONSTRAINT "gear_alert_history_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_history ADD CONSTRAINT "gear_history_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_images ADD CONSTRAINT "gear_images_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_items ADD CONSTRAINT "gear_items_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.group_album ADD CONSTRAINT "group_album_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.group_expenses ADD CONSTRAINT "group_expenses_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.group_invitations ADD CONSTRAINT "group_invitations_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.group_invitations ADD CONSTRAINT "group_invitations_token_key" UNIQUE ("token"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.group_kit_items ADD CONSTRAINT "group_kit_items_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.group_members ADD CONSTRAINT "group_members_group_id_user_id_key" UNIQUE ("group_id", "user_id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.group_members ADD CONSTRAINT "group_members_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.group_messages ADD CONSTRAINT "group_messages_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.group_poll_votes ADD CONSTRAINT "group_poll_votes_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.group_poll_votes ADD CONSTRAINT "group_poll_votes_poll_id_user_id_key" UNIQUE ("poll_id", "user_id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.group_polls ADD CONSTRAINT "group_polls_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.group_reports ADD CONSTRAINT "group_reports_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.group_tasks ADD CONSTRAINT "group_tasks_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_activites ADD CONSTRAINT "groupe_activites_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_depense_parts ADD CONSTRAINT "groupe_depense_parts_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_depenses ADD CONSTRAINT "groupe_depenses_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_equipement ADD CONSTRAINT "groupe_equipement_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_etapes ADD CONSTRAINT "groupe_etapes_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_hebergements ADD CONSTRAINT "groupe_hebergements_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_membres ADD CONSTRAINT "groupe_membres_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_messages ADD CONSTRAINT "groupe_messages_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_taches ADD CONSTRAINT "groupe_taches_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_vote_choix ADD CONSTRAINT "groupe_vote_choix_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_vote_choix ADD CONSTRAINT "groupe_vote_choix_vote_id_membre_id_key" UNIQUE ("vote_id", "membre_id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_vote_options ADD CONSTRAINT "groupe_vote_options_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_votes ADD CONSTRAINT "groupe_votes_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupes ADD CONSTRAINT "groupes_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.guides ADD CONSTRAINT "guides_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.guides ADD CONSTRAINT "guides_slug_key" UNIQUE ("slug"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.hike_sessions ADD CONSTRAINT "hike_sessions_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.hiking_routes ADD CONSTRAINT "hiking_routes_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.hub_telemetry ADD CONSTRAINT "hub_telemetry_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.inventory_exports ADD CONSTRAINT "inventory_exports_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.kit_export_logs ADD CONSTRAINT "kit_export_logs_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.kit_field_reports ADD CONSTRAINT "kit_field_reports_hike_session_id_item_key_key" UNIQUE ("hike_session_id", "item_key"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.kit_field_reports ADD CONSTRAINT "kit_field_reports_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.kit_items ADD CONSTRAINT "kit_items_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.kit_reports ADD CONSTRAINT "kit_reports_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.kits ADD CONSTRAINT "kits_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.kits ADD CONSTRAINT "kits_slug_key" UNIQUE ("slug"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.listings ADD CONSTRAINT "listings_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.lkv_events ADD CONSTRAINT "lkv_events_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.loans ADD CONSTRAINT "loans_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.loyalty_history ADD CONSTRAINT "loyalty_history_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.loyalty_redemptions ADD CONSTRAINT "loyalty_redemptions_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.loyalty_rewards ADD CONSTRAINT "loyalty_rewards_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.map_refuges ADD CONSTRAINT "map_refuges_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.map_summits ADD CONSTRAINT "map_summits_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.map_water_points ADD CONSTRAINT "map_water_points_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.materiel_history ADD CONSTRAINT "materiel_history_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.materiel_kit_history ADD CONSTRAINT "materiel_kit_history_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.materiel_kit_items ADD CONSTRAINT "materiel_kit_items_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.materiel_kits ADD CONSTRAINT "materiel_kits_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.materiel_loans ADD CONSTRAINT "materiel_loans_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.message_attachments ADD CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.message_mentions ADD CONSTRAINT "message_mentions_message_id_mentioned_user_id_key" UNIQUE ("message_id", "mentioned_user_id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.message_mentions ADD CONSTRAINT "message_mentions_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.message_reactions ADD CONSTRAINT "message_reactions_message_id_user_id_reaction_value_key" UNIQUE ("message_id", "user_id", "reaction_value"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.message_reactions ADD CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.messages ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.moderation_queue ADD CONSTRAINT "moderation_queue_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.notification_deliveries ADD CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.notification_preferences ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id", "notification_type"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.notifications ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.occasion_items ADD CONSTRAINT "occasion_items_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.occasion_offers ADD CONSTRAINT "occasion_offers_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.order_items ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.orders ADD CONSTRAINT "orders_order_number_key" UNIQUE ("order_number"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.orders ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.outdoor_points ADD CONSTRAINT "outdoor_points_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.overpass_sync_log ADD CONSTRAINT "overpass_sync_log_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.pending_contributions ADD CONSTRAINT "pending_contributions_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.place_photos ADD CONSTRAINT "place_photos_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.place_reports ADD CONSTRAINT "place_reports_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.place_reviews ADD CONSTRAINT "place_reviews_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.places_geo ADD CONSTRAINT "places_geo_geoname_id_key" UNIQUE ("geoname_id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.places_geo ADD CONSTRAINT "places_geo_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.places ADD CONSTRAINT "places_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.places ADD CONSTRAINT "places_slug_key" UNIQUE ("slug"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.post_comments ADD CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.post_likes ADD CONSTRAINT "post_likes_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.product_alternatives ADD CONSTRAINT "product_alternatives_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.product_compatibilities ADD CONSTRAINT "product_compatibilities_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.product_images ADD CONSTRAINT "product_images_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.product_ownership ADD CONSTRAINT "product_ownership_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.product_reviews ADD CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.products ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.products ADD CONSTRAINT "products_slug_key" UNIQUE ("slug"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.promo_codes ADD CONSTRAINT "promo_codes_code_key" UNIQUE ("code"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.promo_codes ADD CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.push_subscriptions ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.qa_answers ADD CONSTRAINT "qa_answers_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.qa_questions ADD CONSTRAINT "qa_questions_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.qa_votes ADD CONSTRAINT "qa_votes_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.rental_items ADD CONSTRAINT "rental_items_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.review_helpful_votes ADD CONSTRAINT "review_helpful_votes_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.review_helpful_votes ADD CONSTRAINT "review_helpful_votes_review_id_user_id_key" UNIQUE ("review_id", "user_id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reviews ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reward_accounts ADD CONSTRAINT "reward_accounts_pkey" PRIMARY KEY ("user_id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reward_config ADD CONSTRAINT "reward_config_pkey" PRIMARY KEY ("key"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reward_periods ADD CONSTRAINT "reward_periods_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reward_transactions ADD CONSTRAINT "reward_transactions_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reward_withdrawals ADD CONSTRAINT "reward_withdrawals_idempotency_key_key" UNIQUE ("idempotency_key"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reward_withdrawals ADD CONSTRAINT "reward_withdrawals_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.saved_adventures ADD CONSTRAINT "saved_adventures_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.saved_trails ADD CONSTRAINT "saved_trails_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.share_tokens ADD CONSTRAINT "share_tokens_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.share_tokens ADD CONSTRAINT "share_tokens_token_key" UNIQUE ("token"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD CONSTRAINT "shop_products_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD CONSTRAINT "shop_products_slug_key" UNIQUE ("slug"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.sos_alerts ADD CONSTRAINT "sos_alerts_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.stock_movements ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trail_metadata ADD CONSTRAINT "trail_metadata_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trail_pois ADD CONSTRAINT "trail_pois_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trail_scores ADD CONSTRAINT "trail_scores_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trail_segments ADD CONSTRAINT "trail_segments_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trails_raw_v1 ADD CONSTRAINT "trails_raw_v1_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.travel_groups ADD CONSTRAINT "travel_groups_conversation_id_key" UNIQUE ("conversation_id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.travel_groups ADD CONSTRAINT "travel_groups_invite_code_key" UNIQUE ("invite_code"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.travel_groups ADD CONSTRAINT "travel_groups_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trip_checklist_items ADD CONSTRAINT "trip_checklist_items_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trip_collaborators ADD CONSTRAINT "trip_collaborators_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trip_collaborators ADD CONSTRAINT "trip_collaborators_trip_id_user_id_key" UNIQUE ("trip_id", "user_id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trip_documents ADD CONSTRAINT "trip_documents_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trip_expenses ADD CONSTRAINT "trip_expenses_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trip_items ADD CONSTRAINT "trip_items_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trip_notes ADD CONSTRAINT "trip_notes_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trip_participants ADD CONSTRAINT "trip_participants_pkey" PRIMARY KEY ("trip_id", "user_id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trip_pois ADD CONSTRAINT "trip_pois_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trip_safety_checkpoints ADD CONSTRAINT "trip_safety_checkpoints_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trip_steps ADD CONSTRAINT "trip_steps_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trip_steps ADD CONSTRAINT "trip_steps_trip_id_day_number_order_index_key" UNIQUE ("trip_id", "day_number", "order_index"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trips ADD CONSTRAINT "trips_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trips ADD CONSTRAINT "trips_share_token_key" UNIQUE ("share_token"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trips ADD CONSTRAINT "trips_slug_key" UNIQUE ("slug"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_badges ADD CONSTRAINT "unique_user_badge" UNIQUE ("user_id", "badge_id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.country_content_blocks ADD CONSTRAINT "uq_country_content_blocks" UNIQUE ("country_code", "block_type"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.place_reviews ADD CONSTRAINT "uq_place_reviews_place_author" UNIQUE ("place_id", "author_id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_addresses ADD CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_badges ADD CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_blocks ADD CONSTRAINT "user_blocks_blocker_id_blocked_id_key" UNIQUE ("blocker_id", "blocked_id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_blocks ADD CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_challenges ADD CONSTRAINT "user_challenges_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_documents ADD CONSTRAINT "user_documents_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_follows ADD CONSTRAINT "user_follows_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_orientation ADD CONSTRAINT "user_orientation_pkey" PRIMARY KEY ("user_id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_payment_methods ADD CONSTRAINT "user_payment_methods_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_profiles ADD CONSTRAINT "user_profiles_email_key" UNIQUE ("email"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_profiles ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id"); EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;

