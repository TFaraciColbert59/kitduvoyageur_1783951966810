-- =====================================================================
-- LKDV — OPÉRATION ZÉRO DÉFAUT
-- Migration Phase 1 : Sécurité Base de Données (Projet: icxyvwzfjbflcbqukpfz)
-- Date: 17 septembre 2026
-- RÈGLE : Aucune migration appliquée sans validation humaine préalable.
-- =====================================================================

-- =====================================================================
-- LOT 0 : VUES SECURITY DEFINER (Constat C-07)
-- =====================================================================
-- Note pour public_profiles et terrain_reports_public :
-- Ces vues sont conçues comme des filtres de sécurité stricts (masquage de
-- reporter_id, email, phone, coordonnées privées).
-- La table de base terrain_reports ne contient aucune politique publique de lecture.
-- La vue terrain_reports_public filtre les statuts ('confirmed', 'active') et
-- les dates d'expiration, et est maintenue sécurisée par conception.


-- =====================================================================
-- LOT 1 : FONCTIONS FINANCIÈRES & COMMERCIALES (Constat C-08 - Priorité MAX)
-- Révoquer EXECUTE de anon pour empêcher la manipulation de stock,
-- d'enchères et de récompenses sans authentification.
-- =====================================================================
DO $$ BEGIN IF to_regprocedure('public.increment_stock(uuid, integer, text, text, uuid, text)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.increment_stock(uuid, integer, text, text, uuid, text) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.decrement_stock_on_order(uuid, integer, text, uuid)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.decrement_stock_on_order(uuid, integer, text, uuid) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.place_bid(uuid, uuid, integer, boolean)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.place_bid(uuid, uuid, integer, boolean) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.set_auto_bid(uuid, uuid, integer)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.set_auto_bid(uuid, uuid, integer) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.can_user_bid(uuid)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.can_user_bid(uuid) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.can_user_sell_auction(uuid)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.can_user_sell_auction(uuid) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.request_withdrawal(numeric, text, text, jsonb)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text, jsonb) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.process_withdrawal(uuid, boolean, text, text)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.process_withdrawal(uuid, boolean, text, text) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.finalize_reward_period(text, numeric)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.finalize_reward_period(text, numeric) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.claim_reward_points(uuid, text, uuid, text, jsonb)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.claim_reward_points(uuid, text, uuid, text, jsonb) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.redeem_reward(uuid, uuid)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.redeem_reward(uuid, uuid) FROM anon'; END IF; END $$;


-- =====================================================================
-- LOT 2 : FONCTIONS D'ADMINISTRATION & TÂCHES LOURDES (Constat C-08 - Risque DoS)
-- Empêcher le déclenchement non authentifié de purges, digests et suppressions.
-- =====================================================================
DO $$ BEGIN IF to_regprocedure('public.delete_places_batch(uuid[])') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.delete_places_batch(uuid[]) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.send_digests()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.send_digests() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.send_materiel_reminders()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.send_materiel_reminders() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.cleanup_expired_trash_kits()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.cleanup_expired_trash_kits() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.purge_expired_lkv_events()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.purge_expired_lkv_events() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.purge_rejected_club_requests()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.purge_rejected_club_requests() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.process_order_points()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.process_order_points() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.process_pending_contribution(uuid, boolean, text)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.process_pending_contribution(uuid, boolean, text) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.refresh_kit_conservation()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.refresh_kit_conservation() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.notify(uuid, text, text, text, uuid, text, uuid, text)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.notify(uuid, text, text, text, uuid, text, uuid, text) FROM anon'; END IF; END $$;


-- =====================================================================
-- LOT 3 : FONCTIONS TRIGGERS (Constat C-08 - Ne doivent pas être des RPC)
-- Les triggers s'exécutent dans le contexte de la table, jamais en direct via API.
-- =====================================================================
DO $$ BEGIN IF to_regprocedure('public.trg_on_carnet_comment()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.trg_on_carnet_comment() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.trg_on_carnet_like()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.trg_on_carnet_like() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.trg_on_community_post_comment()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.trg_on_community_post_comment() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.trg_on_community_post_like()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.trg_on_community_post_like() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.trg_on_group_expense_added()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.trg_on_group_expense_added() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.trg_on_group_member_join()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.trg_on_group_member_join() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.trg_on_group_message()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.trg_on_group_message() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.trg_on_group_task_assigned()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.trg_on_group_task_assigned() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.handle_field_proven_count()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.handle_field_proven_count() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.handle_kit_lineage()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.handle_kit_lineage() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.handle_new_user()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.handle_new_user_reward_account()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.handle_new_user_reward_account() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.handle_trip_owner_collaborator()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.handle_trip_owner_collaborator() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.enforce_group_role_change()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.enforce_group_role_change() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.enforce_reference_member_active()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.enforce_reference_member_active() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.freeze_trip_owner()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.freeze_trip_owner() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.guard_user_profile_privileged_columns()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.guard_user_profile_privileged_columns() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.update_reward_account_on_contribution()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.update_reward_account_on_contribution() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.update_reward_account_on_transaction()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.update_reward_account_on_transaction() FROM anon'; END IF; END $$;


-- =====================================================================
-- LOT 4 : DONNÉES UTILISATEUR & LOGIQUE PRIVÉE (Constat C-08)
-- Protéger les badges, signatures, quotas et caches IA.
-- =====================================================================
DO $$ BEGIN IF to_regprocedure('public.get_admin_role()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_admin_role() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.is_admin()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.is_moderateur()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.is_moderateur() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.get_user_badges_progress(uuid)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_user_badges_progress(uuid) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.get_user_signature(uuid)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_user_signature(uuid) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.refresh_user_field_signature()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.refresh_user_field_signature() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.update_loyalty_points(uuid, integer, text, text)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.update_loyalty_points(uuid, integer, text, text) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.sync_loyalty_points()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.sync_loyalty_points() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.sync_community_post_comments_count()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.sync_community_post_comments_count() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.check_and_increment_ai_quota(uuid, text, text, integer)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.check_and_increment_ai_quota(uuid, text, text, integer) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.get_ai_cache(text)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_ai_cache(text) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.set_ai_cache(text, text, jsonb, text, text, integer)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.set_ai_cache(text, text, jsonb, text, text, integer) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.record_hike_gear_usage(uuid[])') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.record_hike_gear_usage(uuid[]) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.log_materiel_history(uuid, text, text, uuid, text, jsonb)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.log_materiel_history(uuid, text, text, uuid, text, jsonb) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.log_group_activity()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.log_group_activity() FROM anon'; END IF; END $$;


-- =====================================================================
-- LOT 5 : LOGIQUE VOYAGES & GROUPES (Constat C-08)
-- =====================================================================
DO $$ BEGIN IF to_regprocedure('public.can_edit_trip(uuid)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.can_edit_trip(uuid) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.can_read_trip(uuid)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.can_read_trip(uuid) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.is_group_member(uuid, uuid)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.is_group_organizer(uuid, uuid)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.is_group_organizer(uuid, uuid) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.lkv_can(uuid, text, uuid, text)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.lkv_can(uuid, text, uuid, text) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.lkv_ensure_auto_crew()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.lkv_ensure_auto_crew() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.lkv_seed_trip_checklist_template()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.lkv_seed_trip_checklist_template() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.seed_group_owner_membership()') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.seed_group_owner_membership() FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.get_kit_journal(uuid)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_kit_journal(uuid) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.get_comparable_sales(uuid, integer)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_comparable_sales(uuid, integer) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.get_occasion_listing_for_product(uuid)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_occasion_listing_for_product(uuid) FROM anon'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.toggle_community_post_like(uuid)') IS NOT NULL THEN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.toggle_community_post_like(uuid) FROM anon'; END IF; END $$;


-- =====================================================================
-- LOT 6 : SÉCURISATION DU SEARCH_PATH (Constat search_path mutable - 61 fonctions)
-- Fixe le chemin de résolution pour empêcher le détournement de schéma.
-- =====================================================================
DO $$ BEGIN IF to_regprocedure('public.handle_new_user()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.handle_new_user() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.can_user_bid(uuid)') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.can_user_bid(uuid) SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.can_user_sell_auction(uuid)') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.can_user_sell_auction(uuid) SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.place_bid(uuid, uuid, integer, boolean)') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.place_bid(uuid, uuid, integer, boolean) SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.set_auto_bid(uuid, uuid, integer)') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.set_auto_bid(uuid, uuid, integer) SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.get_comparable_sales(uuid, integer)') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.get_comparable_sales(uuid, integer) SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.get_occasion_listing_for_product(uuid)') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.get_occasion_listing_for_product(uuid) SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.increment_stock(uuid, integer, text, text, uuid, text)') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.increment_stock(uuid, integer, text, text, uuid, text) SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.update_order_updated_at()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.update_order_updated_at() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.update_group_updated_at()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.update_group_updated_at() SET search_path = public, extensions'; END IF; END $$;
-- Réparation additive : selon l'historique, la fonction existe en 0-arg (prod)
-- ou en 5-arg (baseline). On sécurise chaque signature présente sans échouer.
DO $$
BEGIN
  IF to_regprocedure('public.get_routes_for_map()') IS NOT NULL THEN
    ALTER FUNCTION public.get_routes_for_map() SET search_path = public, extensions;
  END IF;
  IF to_regprocedure('public.get_routes_for_map(double precision,double precision,double precision,double precision,double precision)') IS NOT NULL THEN
    ALTER FUNCTION public.get_routes_for_map(double precision,double precision,double precision,double precision,double precision) SET search_path = public, extensions;
  END IF;
END $$;
DO $$ BEGIN IF to_regprocedure('public.sync_loyalty_points()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.sync_loyalty_points() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.redeem_reward(uuid, uuid)') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.redeem_reward(uuid, uuid) SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.get_user_badges_progress(uuid)') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.get_user_badges_progress(uuid) SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.process_order_points()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.process_order_points() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.get_hiking_routes_geojson()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.get_hiking_routes_geojson() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.get_trail_pois_geojson()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.get_trail_pois_geojson() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.sync_carnet_likes_count()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.sync_carnet_likes_count() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.sync_carnet_comments_count()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.sync_carnet_comments_count() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.sync_carnet_views_count()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.sync_carnet_views_count() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.sync_carnet_favorites_count()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.sync_carnet_favorites_count() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.purge_rejected_club_requests()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.purge_rejected_club_requests() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.toggle_community_post_like(uuid)') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.toggle_community_post_like(uuid) SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.get_admin_role()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.get_admin_role() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.update_moderation_updated_at()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.update_moderation_updated_at() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.update_loyalty_points(uuid, integer, text, text)') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.update_loyalty_points(uuid, integer, text, text) SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.set_updated_at()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.set_updated_at() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.unaccent_lower(text)') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.unaccent_lower(text) SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.handle_new_user_reward_account()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.handle_new_user_reward_account() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.update_reward_account_on_transaction()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.update_reward_account_on_transaction() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.update_reward_account_on_contribution()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.update_reward_account_on_contribution() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.claim_reward_points(uuid, text, uuid, text, jsonb)') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.claim_reward_points(uuid, text, uuid, text, jsonb) SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.process_pending_contribution(uuid, boolean, text)') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.process_pending_contribution(uuid, boolean, text) SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.request_withdrawal(numeric, text, text, jsonb)') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.request_withdrawal(numeric, text, text, jsonb) SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.finalize_reward_period(text, numeric)') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.finalize_reward_period(text, numeric) SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.process_withdrawal(uuid, boolean, text, text)') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.process_withdrawal(uuid, boolean, text, text) SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.notify(uuid, text, text, text, uuid, text, uuid, text)') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.notify(uuid, text, text, text, uuid, text, uuid, text) SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.trg_on_community_post_like()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.trg_on_community_post_like() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.trg_on_community_post_comment()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.trg_on_community_post_comment() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.trg_on_carnet_like()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.trg_on_carnet_like() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.trg_on_carnet_comment()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.trg_on_carnet_comment() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.trg_on_group_message()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.trg_on_group_message() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.trg_on_group_member_join()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.trg_on_group_member_join() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.trg_on_group_task_assigned()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.trg_on_group_task_assigned() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.trg_on_group_expense_added()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.trg_on_group_expense_added() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.send_digests()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.send_digests() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.sync_community_post_comments_count()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.sync_community_post_comments_count() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.cleanup_expired_trash_kits()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.cleanup_expired_trash_kits() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.record_hike_gear_usage(uuid[])') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.record_hike_gear_usage(uuid[]) SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.materiel_kits_search_vector_update()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.materiel_kits_search_vector_update() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.product_ownership_search_vector_update()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.product_ownership_search_vector_update() SET search_path = public, extensions'; END IF; END $$;
-- Réparations additives : ces signatures peuvent être absentes d'une base fraîche
-- (objets créés avec d'autres signatures selon l'historique). On sécurise celles
-- qui existent, sans échouer sur les autres.
DO $$
BEGIN
  IF to_regprocedure('public.get_trail_pois_bbox(double precision, double precision, double precision, double precision)') IS NOT NULL THEN
    ALTER FUNCTION public.get_trail_pois_bbox(double precision, double precision, double precision, double precision) SET search_path = public, extensions;
  END IF;
  IF to_regprocedure('public.generate_trip_slug(text)') IS NOT NULL THEN
    ALTER FUNCTION public.generate_trip_slug(text) SET search_path = public, extensions;
  END IF;
  IF to_regprocedure('public.recalculate_place_rating(uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.recalculate_place_rating(uuid) SET search_path = public, extensions;
  END IF;
END $$;
DO $$ BEGIN IF to_regprocedure('public.sync_place_geom()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.sync_place_geom() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.purge_expired_lkv_events()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.purge_expired_lkv_events() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.prevent_message_immutable_fields_update()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.prevent_message_immutable_fields_update() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.enforce_member_role_hierarchy()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.enforce_member_role_hierarchy() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.lkv_slugify(text)') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.lkv_slugify(text) SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.lkv_ensure_auto_crew()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.lkv_ensure_auto_crew() SET search_path = public, extensions'; END IF; END $$;
DO $$ BEGIN IF to_regprocedure('public.lkv_seed_trip_checklist_template()') IS NOT NULL THEN EXECUTE 'ALTER FUNCTION public.lkv_seed_trip_checklist_template() SET search_path = public, extensions'; END IF; END $$;


-- =====================================================================
-- LOT 7 : RLS SUR SPATIAL_REF_SYS (Constat rls_disabled_in_public)
-- =====================================================================
DO $$
BEGIN
  ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS spatial_ref_sys_read_all ON public.spatial_ref_sys;
  CREATE POLICY spatial_ref_sys_read_all ON public.spatial_ref_sys FOR SELECT TO public USING (true);
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'public.spatial_ref_sys est la propriété de supabase_admin (PostGIS extension) — RLS ignoré';
END $$;


-- =====================================================================
-- REQUÊTE DE CONTRÔLE APRÈS APPLICATION
-- =====================================================================
-- Compte des fonctions Security Definer encore exécutables par anon :
-- SELECT count(*) AS fonctions_anon_restantes
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
--   AND p.prosecdef = true
--   AND has_function_privilege('anon', p.oid, 'EXECUTE')
--   AND p.proname NOT IN ('current_feature_flags', 'is_group_public', 'group_public_card_stats', 'get_hiking_routes_geojson', 'get_trail_pois_geojson', 'st_estimatedextent');
-- Résultat attendu : 0
