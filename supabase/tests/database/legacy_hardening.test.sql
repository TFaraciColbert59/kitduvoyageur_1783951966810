-- ============================================================================
-- 20260921100000_legacy_hardening — durcissement hérité.
--
-- Vérifie : revokes ciblés des 85 fonctions auditée (catégories a/b/c),
-- fonctions service_role inaccessibles à authenticated, gardes des fonctions
-- conservées, FK ON DELETE CASCADE vers auth.users, privilèges de schéma/tables.
-- Les signatures absentes d'une base partielle sont ignorées (to_regprocedure).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
SELECT plan(20);

-- ── 1-2. Catégorie (b) : service_role uniquement ─────────────────────────────
SELECT ok(COALESCE((
  SELECT bool_and(
    NOT has_function_privilege('anon', sig, 'EXECUTE')
    AND NOT has_function_privilege('authenticated', sig, 'EXECUTE')
  )
  FROM unnest(ARRAY[
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
  ]) AS sig
  WHERE to_regprocedure(sig) IS NOT NULL
), true), '1. catégorie (b) : ni anon ni authenticated ne peuvent exécuter');

SELECT ok(COALESCE((
  SELECT bool_and(has_function_privilege('service_role', sig, 'EXECUTE'))
  FROM unnest(ARRAY[
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
  ]) AS sig
  WHERE to_regprocedure(sig) IS NOT NULL
), true), '2. catégorie (b) : service_role conserve EXECUTE');

-- ── 3. Catégorie (c) : triggers/internes, exécutables par personne ───────────
SELECT ok(COALESCE((
  SELECT bool_and(
    NOT has_function_privilege('anon', sig, 'EXECUTE')
    AND NOT has_function_privilege('authenticated', sig, 'EXECUTE')
  )
  FROM unnest(ARRAY[
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
  ]) AS sig
  WHERE to_regprocedure(sig) IS NOT NULL
), true), '3. catégorie (c) : triggers/internes retirés à anon et authenticated');

-- ── 4-6. Catégorie (a) : authenticated uniquement ────────────────────────────
SELECT ok(COALESCE((
  SELECT bool_and(NOT has_function_privilege('anon', sig, 'EXECUTE'))
  FROM unnest(ARRAY[
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
  ]) AS sig
  WHERE to_regprocedure(sig) IS NOT NULL
), true), '4. catégorie (a) : anon ne peut plus exécuter');

SELECT ok(COALESCE((
  SELECT bool_and(has_function_privilege('authenticated', sig, 'EXECUTE'))
  FROM unnest(ARRAY[
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
  ]) AS sig
  WHERE to_regprocedure(sig) IS NOT NULL
), true), '5. catégorie (a) : authenticated conserve EXECUTE');

SELECT ok(
  has_function_privilege('service_role', 'public.request_withdrawal(numeric,text,text,jsonb)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.get_ai_cache(text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.get_ai_cache(text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.set_ai_cache(text,text,jsonb,text,text,integer)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.check_and_increment_ai_quota(uuid,text,text,integer)', 'EXECUTE'),
  '6. service_role : caches/quota IA non exécutables par authenticated'
);

-- ── 7. FK ON DELETE CASCADE vers auth.users ──────────────────────────────────
SELECT ok(COALESCE((
  SELECT bool_and(EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = to_regclass('public.' || t)
      AND c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
      AND c.convalidated
      AND c.confdeltype = 'c'
  ))
  FROM unnest(ARRAY[
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
  ]) AS t
  WHERE to_regclass('public.' || t) IS NOT NULL
), true), '7. FK user_id → auth.users(id) ON DELETE CASCADE sur les 10 tables');

-- ── 8-9. Privilèges de schéma et de tables ───────────────────────────────────
SELECT ok(
  NOT has_schema_privilege('anon', 'public', 'CREATE')
  AND NOT has_schema_privilege('authenticated', 'public', 'CREATE'),
  '8. anon et authenticated sans CREATE sur le schéma public'
);

SELECT ok((
  SELECT bool_and(
    NOT has_table_privilege(r.role_name, c.oid, p.priv)
  )
  FROM (VALUES ('anon'), ('authenticated')) AS r(role_name)
  CROSS JOIN (VALUES ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) AS p(priv)
  CROSS JOIN pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
), '9. TRUNCATE/REFERENCES/TRIGGER retirés à anon et authenticated');

-- ── 10-15. request_withdrawal : idempotence impossible entre utilisateurs ────
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('dddddddd-0000-4000-8000-000000000001','authenticated','authenticated','wh-u1@test.local','x','{}','{}',now(),now()),
  ('dddddddd-0000-4000-8000-000000000002','authenticated','authenticated','wh-u2@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;

UPDATE public.user_profiles
SET created_at = now() - interval '60 days', trust_score = 60
WHERE id IN ('dddddddd-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000002');

INSERT INTO public.reward_accounts (user_id, available_cash, pending_cash)
VALUES
  ('dddddddd-0000-4000-8000-000000000001', 100, 0),
  ('dddddddd-0000-4000-8000-000000000002', 100, 0)
ON CONFLICT (user_id) DO UPDATE SET available_cash = 100, pending_cash = 0;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'dddddddd-0000-4000-8000-000000000001';
CREATE TEMP TABLE wh_a AS
SELECT public.request_withdrawal(20, 'bank_transfer', 'lk-shared-key', '{}'::jsonb) AS id_a;

SELECT ok((SELECT id_a FROM wh_a) IS NOT NULL, '10. retrait A créé');

SET LOCAL "request.jwt.claim.sub" = 'dddddddd-0000-4000-8000-000000000002';
SELECT throws_ok(
  $$ SELECT public.request_withdrawal(20, 'bank_transfer', 'lk-shared-key', '{}'::jsonb) $$,
  '23505', NULL,
  '11. B avec la clé d''A : aucune fuite, collision d''unicité refusée'
);

SET LOCAL "request.jwt.claim.sub" = 'dddddddd-0000-4000-8000-000000000001';
SELECT is(
  (SELECT public.request_withdrawal(20, 'bank_transfer', 'lk-shared-key', '{}'::jsonb)),
  (SELECT id_a FROM wh_a),
  '12. relance A : idempotente, même identifiant restitué'
);

RESET ROLE;
SELECT is(
  (SELECT available_cash FROM public.reward_accounts WHERE user_id = 'dddddddd-0000-4000-8000-000000000001'),
  80.00::numeric,
  '13. relance A : aucun débit supplémentaire (80 restants)'
);
SELECT is(
  (SELECT count(*)::int FROM public.reward_withdrawals
   WHERE idempotency_key = 'lk-shared-key' AND user_id = 'dddddddd-0000-4000-8000-000000000002'),
  0,
  '14. B n''a obtenu aucune ligne de retrait'
);
SELECT is(
  (SELECT count(*)::int FROM public.reward_withdrawals
   WHERE idempotency_key = 'lk-shared-key' AND user_id = 'dddddddd-0000-4000-8000-000000000001'),
  1,
  '15. A conserve exactement sa demande'
);

-- ── 16-17. get_user_badges_progress : lecture cantonnée au titulaire ─────────
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'dddddddd-0000-4000-8000-000000000001';
SELECT throws_ok(
  $$ SELECT * FROM public.get_user_badges_progress('dddddddd-0000-4000-8000-000000000002') $$,
  'P0001', 'Accès interdit aux badges d''un autre utilisateur',
  '16. badges d''autrui refusés'
);
-- Le corps de la fonction dépend de colonnes absentes d'une base partielle
-- (kits.user_id) : on vérifie ici que la garde ne bloque PAS le titulaire,
-- sans exiger que le corps aboutisse.
DO $$
BEGIN
  BEGIN
    PERFORM 1 FROM public.get_user_badges_progress('dddddddd-0000-4000-8000-000000000001');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Accès interdit aux badges d''un autre utilisateur' THEN
      RAISE EXCEPTION 'garde trop large : le titulaire est bloqué';
    END IF;
  END;
END $$;
SELECT pass('17. badges du titulaire : la garde ne bloque pas le titulaire');

-- ── 18. cleanup_expired_trash_kits : refus sans identité ─────────────────────
SET LOCAL "request.jwt.claim.sub" = '';
SELECT throws_ok(
  $$ SELECT public.cleanup_expired_trash_kits() $$,
  'P0001', 'Authentification requise',
  '18. purge corbeille refusée sans auth.uid()'
);
RESET ROLE;

-- ── 19-20. Contrôles explicites des fonctions les plus sensibles ─────────────
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.place_bid(uuid,uuid,integer,boolean)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.increment_stock(uuid,integer,text,text,uuid,text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.delete_places_batch(uuid[])', 'EXECUTE'),
  '19. place_bid/increment_stock/delete_places_batch inaccessibles à authenticated'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.request_withdrawal(numeric,text,text,jsonb)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.request_withdrawal(numeric,text,text,jsonb)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.get_user_badges_progress(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.get_user_badges_progress(uuid)', 'EXECUTE'),
  '20. request_withdrawal/badges : authenticated oui, anon non'
);

SELECT * FROM finish();
ROLLBACK;
