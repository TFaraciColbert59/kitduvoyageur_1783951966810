-- Migration: Drop 31 verified empty orphan tables (0 rows, 0 refs in src/, pg_proc, pg_views, scripts/)
-- Mode: RESTRICT (zero-regression guarantee)

DROP TABLE IF EXISTS public.admin_audit_log RESTRICT;
DROP TABLE IF EXISTS public.ama_votes RESTRICT;
DROP TABLE IF EXISTS public.carnet_gear_links RESTRICT;
DROP TABLE IF EXISTS public.cart_loyalty_discounts RESTRICT;
DROP TABLE IF EXISTS public.club_challenge_entries RESTRICT;
DROP TABLE IF EXISTS public.community_post_drafts RESTRICT;
DROP TABLE IF EXISTS public.expedition_reports RESTRICT;
DROP TABLE IF EXISTS public.expert_bookings RESTRICT;
DROP TABLE IF EXISTS public.external_connector_accounts RESTRICT;
DROP TABLE IF EXISTS public.group_invitations RESTRICT;
DROP TABLE IF EXISTS public.inventory_exports RESTRICT;
DROP TABLE IF EXISTS public.kit_export_logs RESTRICT;
DROP TABLE IF EXISTS public.kit_placed_badges RESTRICT;
DROP TABLE IF EXISTS public.message_mentions RESTRICT;
DROP TABLE IF EXISTS public.moderation_queue RESTRICT;
DROP TABLE IF EXISTS public.occasion_offers RESTRICT;
DROP TABLE IF EXISTS public.osm_corridor_cache RESTRICT;
DROP TABLE IF EXISTS public.participant_pack_states RESTRICT;
DROP TABLE IF EXISTS public.profile_share_links RESTRICT;
DROP TABLE IF EXISTS public.qa_votes RESTRICT;
DROP TABLE IF EXISTS public.review_helpful_votes RESTRICT;
DROP TABLE IF EXISTS public.route_comments RESTRICT;
DROP TABLE IF EXISTS public.route_proposals RESTRICT;
DROP TABLE IF EXISTS public.route_sections RESTRICT;
DROP TABLE IF EXISTS public.route_stages RESTRICT;
DROP TABLE IF EXISTS public.terrain_events RESTRICT;
DROP TABLE IF EXISTS public.trails_raw_v1 RESTRICT;
DROP TABLE IF EXISTS public.trajectoire_veille RESTRICT;
DROP TABLE IF EXISTS public.user_payment_methods RESTRICT;
DROP TABLE IF EXISTS public.user_sessions RESTRICT;
DROP TABLE IF EXISTS public.watch_devices RESTRICT;
