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
REVOKE EXECUTE ON FUNCTION public.increment_stock(uuid, integer, text, text, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrement_stock_on_order(uuid, integer, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.place_bid(uuid, uuid, integer, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_auto_bid(uuid, uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_user_bid(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_user_sell_auction(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_withdrawal(uuid, boolean, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.finalize_reward_period(text, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_reward_points(uuid, text, uuid, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.redeem_reward(uuid, uuid) FROM anon;


-- =====================================================================
-- LOT 2 : FONCTIONS D'ADMINISTRATION & TÂCHES LOURDES (Constat C-08 - Risque DoS)
-- Empêcher le déclenchement non authentifié de purges, digests et suppressions.
-- =====================================================================
REVOKE EXECUTE ON FUNCTION public.delete_places_batch(uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.send_digests() FROM anon;
REVOKE EXECUTE ON FUNCTION public.send_materiel_reminders() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_trash_kits() FROM anon;
REVOKE EXECUTE ON FUNCTION public.purge_expired_lkv_events() FROM anon;
REVOKE EXECUTE ON FUNCTION public.purge_rejected_club_requests() FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_order_points() FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_pending_contribution(uuid, boolean, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.refresh_kit_conservation() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify(uuid, text, text, text, uuid, text, uuid, text) FROM anon;


-- =====================================================================
-- LOT 3 : FONCTIONS TRIGGERS (Constat C-08 - Ne doivent pas être des RPC)
-- Les triggers s'exécutent dans le contexte de la table, jamais en direct via API.
-- =====================================================================
REVOKE EXECUTE ON FUNCTION public.trg_on_carnet_comment() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_on_carnet_like() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_on_community_post_comment() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_on_community_post_like() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_on_group_expense_added() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_on_group_member_join() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_on_group_message() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_on_group_task_assigned() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_field_proven_count() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_kit_lineage() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_reward_account() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_trip_owner_collaborator() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_group_role_change() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_reference_member_active() FROM anon;
REVOKE EXECUTE ON FUNCTION public.freeze_trip_owner() FROM anon;
REVOKE EXECUTE ON FUNCTION public.guard_user_profile_privileged_columns() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_reward_account_on_contribution() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_reward_account_on_transaction() FROM anon;


-- =====================================================================
-- LOT 4 : DONNÉES UTILISATEUR & LOGIQUE PRIVÉE (Constat C-08)
-- Protéger les badges, signatures, quotas et caches IA.
-- =====================================================================
REVOKE EXECUTE ON FUNCTION public.get_admin_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_moderateur() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_badges_progress(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_signature(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.refresh_user_field_signature() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_loyalty_points(uuid, integer, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_loyalty_points() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_community_post_comments_count() FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_ai_quota(uuid, text, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_ai_cache(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_ai_cache(text, text, jsonb, text, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_hike_gear_usage(uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_materiel_history(uuid, text, text, uuid, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_group_activity() FROM anon;


-- =====================================================================
-- LOT 5 : LOGIQUE VOYAGES & GROUPES (Constat C-08)
-- =====================================================================
REVOKE EXECUTE ON FUNCTION public.can_edit_trip(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_read_trip(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_group_organizer(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.lkv_can(uuid, text, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.lkv_ensure_auto_crew() FROM anon;
REVOKE EXECUTE ON FUNCTION public.lkv_seed_trip_checklist_template() FROM anon;
REVOKE EXECUTE ON FUNCTION public.seed_group_owner_membership() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_kit_journal(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_comparable_sales(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_occasion_listing_for_product(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.toggle_community_post_like(uuid) FROM anon;


-- =====================================================================
-- LOT 6 : SÉCURISATION DU SEARCH_PATH (Constat search_path mutable - 61 fonctions)
-- Fixe le chemin de résolution pour empêcher le détournement de schéma.
-- =====================================================================
ALTER FUNCTION public.handle_new_user() SET search_path = public, extensions;
ALTER FUNCTION public.can_user_bid(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.can_user_sell_auction(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.place_bid(uuid, uuid, integer, boolean) SET search_path = public, extensions;
ALTER FUNCTION public.set_auto_bid(uuid, uuid, integer) SET search_path = public, extensions;
ALTER FUNCTION public.get_comparable_sales(uuid, integer) SET search_path = public, extensions;
ALTER FUNCTION public.get_occasion_listing_for_product(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.increment_stock(uuid, integer, text, text, uuid, text) SET search_path = public, extensions;
ALTER FUNCTION public.update_order_updated_at() SET search_path = public, extensions;
ALTER FUNCTION public.update_group_updated_at() SET search_path = public, extensions;
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
ALTER FUNCTION public.sync_loyalty_points() SET search_path = public, extensions;
ALTER FUNCTION public.redeem_reward(uuid, uuid) SET search_path = public, extensions;
ALTER FUNCTION public.get_user_badges_progress(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.process_order_points() SET search_path = public, extensions;
ALTER FUNCTION public.get_hiking_routes_geojson() SET search_path = public, extensions;
ALTER FUNCTION public.get_trail_pois_geojson() SET search_path = public, extensions;
ALTER FUNCTION public.sync_carnet_likes_count() SET search_path = public, extensions;
ALTER FUNCTION public.sync_carnet_comments_count() SET search_path = public, extensions;
ALTER FUNCTION public.sync_carnet_views_count() SET search_path = public, extensions;
ALTER FUNCTION public.sync_carnet_favorites_count() SET search_path = public, extensions;
ALTER FUNCTION public.purge_rejected_club_requests() SET search_path = public, extensions;
ALTER FUNCTION public.toggle_community_post_like(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.get_admin_role() SET search_path = public, extensions;
ALTER FUNCTION public.update_moderation_updated_at() SET search_path = public, extensions;
ALTER FUNCTION public.update_loyalty_points(uuid, integer, text, text) SET search_path = public, extensions;
ALTER FUNCTION public.set_updated_at() SET search_path = public, extensions;
ALTER FUNCTION public.unaccent_lower(text) SET search_path = public, extensions;
ALTER FUNCTION public.handle_new_user_reward_account() SET search_path = public, extensions;
ALTER FUNCTION public.update_reward_account_on_transaction() SET search_path = public, extensions;
ALTER FUNCTION public.update_reward_account_on_contribution() SET search_path = public, extensions;
ALTER FUNCTION public.claim_reward_points(uuid, text, uuid, text, jsonb) SET search_path = public, extensions;
ALTER FUNCTION public.process_pending_contribution(uuid, boolean, text) SET search_path = public, extensions;
ALTER FUNCTION public.request_withdrawal(numeric, text, text, jsonb) SET search_path = public, extensions;
ALTER FUNCTION public.finalize_reward_period(text, numeric) SET search_path = public, extensions;
ALTER FUNCTION public.process_withdrawal(uuid, boolean, text, text) SET search_path = public, extensions;
ALTER FUNCTION public.notify(uuid, text, text, text, uuid, text, uuid, text) SET search_path = public, extensions;
ALTER FUNCTION public.trg_on_community_post_like() SET search_path = public, extensions;
ALTER FUNCTION public.trg_on_community_post_comment() SET search_path = public, extensions;
ALTER FUNCTION public.trg_on_carnet_like() SET search_path = public, extensions;
ALTER FUNCTION public.trg_on_carnet_comment() SET search_path = public, extensions;
ALTER FUNCTION public.trg_on_group_message() SET search_path = public, extensions;
ALTER FUNCTION public.trg_on_group_member_join() SET search_path = public, extensions;
ALTER FUNCTION public.trg_on_group_task_assigned() SET search_path = public, extensions;
ALTER FUNCTION public.trg_on_group_expense_added() SET search_path = public, extensions;
ALTER FUNCTION public.send_digests() SET search_path = public, extensions;
ALTER FUNCTION public.sync_community_post_comments_count() SET search_path = public, extensions;
ALTER FUNCTION public.cleanup_expired_trash_kits() SET search_path = public, extensions;
ALTER FUNCTION public.record_hike_gear_usage(uuid[]) SET search_path = public, extensions;
ALTER FUNCTION public.materiel_kits_search_vector_update() SET search_path = public, extensions;
ALTER FUNCTION public.product_ownership_search_vector_update() SET search_path = public, extensions;
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
ALTER FUNCTION public.sync_place_geom() SET search_path = public, extensions;
ALTER FUNCTION public.purge_expired_lkv_events() SET search_path = public, extensions;
ALTER FUNCTION public.prevent_message_immutable_fields_update() SET search_path = public, extensions;
ALTER FUNCTION public.enforce_member_role_hierarchy() SET search_path = public, extensions;
ALTER FUNCTION public.lkv_slugify(text) SET search_path = public, extensions;
ALTER FUNCTION public.lkv_ensure_auto_crew() SET search_path = public, extensions;
ALTER FUNCTION public.lkv_seed_trip_checklist_template() SET search_path = public, extensions;


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
