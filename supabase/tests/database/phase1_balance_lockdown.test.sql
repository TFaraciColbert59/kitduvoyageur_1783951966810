-- Phase 1 — verrouillage des soldes : garde colonnes, policies fermées,
-- backfill d'ouvertures, RPC legacy serveur, commandes serveur.
--
-- Adaptations lors de l'implémentation (Task 1+2, cf. rapport task-1-2-report.md) :
--   1. RESET des claims JWT après RESET ROLE : les SET LOCAL
--      "request.jwt.claim.role" / "request.jwt.claim.sub" persistent dans la
--      transaction et garderaient le garde-fou actif pour les tests 13+ (faux
--      échec) ;
--   2. bloc GRANT scindé : le grant initial re-donnait INSERT à `authenticated`
--      sur loyalty_history / loyalty_redemptions / orders, annulant par
--      construction le REVOKE que vérifient les tests 8-10. `authenticated` ne
--      reçoit que ce que les tests exigent (SELECT+UPDATE user_profiles pour le
--      contrôle positif 5, SELECT seul sur les journaux/commandes) ; le jeu
--      complet est accordé à `service_role`.
--   3. réconciliation locale du schéma de fixture : le replay local de
--      `user_profiles` n'a pas `is_suspended_groups` ni
--      `suspended_from_groups_at` (colonnes présentes en prod — baseline
--      20260911 et a10_replay_bootstrap — que le garde-fou v2 contrôle). Ajout
--      transactionnel (rollbacké) pour que le garde-fou soit exerçable à
--      l'identique de la prod ; la migration n'est pas modifiée.
BEGIN;
SET LOCAL search_path = public;
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, UPDATE ON public.user_profiles TO authenticated;
GRANT SELECT ON public.loyalty_history, public.loyalty_redemptions, public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.user_profiles, public.orders, public.loyalty_history, public.loyalty_redemptions,
  public.loyalty_rewards, public.shop_products, public.stock_movements
TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS is_suspended_groups boolean DEFAULT false;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS suspended_from_groups_at timestamptz;
SELECT plan(24);

-- Fixtures
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('aaaa0001-0000-4000-8000-000000000001','authenticated','authenticated','p1a@test.local','x','{}','{}',now(),now()),
  ('aaaa0001-0000-4000-8000-000000000002','authenticated','authenticated','p1b@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email)
VALUES
  ('aaaa0001-0000-4000-8000-000000000001','Pers A','p1a@test.local'),
  ('aaaa0001-0000-4000-8000-000000000002','Pers B','p1b@test.local')
ON CONFLICT (id) DO NOTHING;

-- 1-4. Garde colonnes : authenticated ne peut plus modifier les colonnes de solde.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaa0001-0000-4000-8000-000000000001';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT throws_ok(
  $$UPDATE public.user_profiles SET loyalty_points = 999999 WHERE id = 'aaaa0001-0000-4000-8000-000000000001'$$,
  '42501', NULL, '1. loyalty_points verrouillé pour authenticated');
SELECT throws_ok(
  $$UPDATE public.user_profiles SET xp = 999999 WHERE id = 'aaaa0001-0000-4000-8000-000000000001'$$,
  '42501', NULL, '2. xp verrouillé pour authenticated');
SELECT throws_ok(
  $$UPDATE public.user_profiles SET level = 10 WHERE id = 'aaaa0001-0000-4000-8000-000000000001'$$,
  '42501', NULL, '3. level verrouillé pour authenticated');
SELECT throws_ok(
  $$UPDATE public.user_profiles SET loyalty_level = 'Légende du Voyage' WHERE id = 'aaaa0001-0000-4000-8000-000000000001'$$,
  '42501', NULL, '4. loyalty_level verrouillé pour authenticated');
-- 5. Contrôle positif : le profil normal reste modifiable.
SELECT lives_ok(
  $$UPDATE public.user_profiles SET bio = 'bio ok' WHERE id = 'aaaa0001-0000-4000-8000-000000000001'$$,
  '5. bio toujours modifiable par son titulaire');
RESET ROLE;
RESET "request.jwt.claim.role";
RESET "request.jwt.claim.sub";

-- 6-9. Journal legacy fermé au client.
SELECT ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_history' AND policyname='auth_insert_loyalty_history'),
  '6. policy auth_insert_loyalty_history supprimée');
SELECT ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_redemptions' AND policyname='auth_insert_loyalty_redemptions'),
  '7. policy auth_insert_loyalty_redemptions supprimée');
SELECT ok(NOT has_table_privilege('authenticated','public.loyalty_history','INSERT'),
  '8. authenticated sans INSERT loyalty_history');
SELECT ok(NOT has_table_privilege('authenticated','public.loyalty_redemptions','INSERT'),
  '9. authenticated sans INSERT loyalty_redemptions');

-- 10-11. Commandes fermées au client, lecture propre conservée.
SELECT ok(NOT has_table_privilege('authenticated','public.orders','INSERT'),
  '10. authenticated sans INSERT orders');
SELECT ok(EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND policyname='orders_select_own'),
  '11. policy orders_select_own présente');

-- 12-14. Backfill d'ouvertures : réconciliation sans perte, idempotente.
SELECT is(public.legacy_loyalty_backfill_openings(), 0, '12. rien à backfiller (déjà cohérent)');
UPDATE public.user_profiles SET loyalty_points = 1234 WHERE id = 'aaaa0001-0000-4000-8000-000000000002';
SELECT is(public.legacy_loyalty_backfill_openings(), 1, '13. un écart détecté et reporté');
SELECT is((SELECT loyalty_points FROM public.user_profiles WHERE id = 'aaaa0001-0000-4000-8000-000000000002'), 1234,
  '14. solde préservé à l''identique après backfill');

-- 15-18. RPC spend/earn : bornes, idempotence, niveau.
SELECT is((public.legacy_loyalty_spend('aaaa0001-0000-4000-8000-000000000002', 5000, 'Trop cher', 'test:spend:over'))->>'error',
  'insufficient_balance', '15. dépense refusée si solde insuffisant');
SELECT is((public.legacy_loyalty_spend('aaaa0001-0000-4000-8000-000000000002', 1000, 'Achat test', 'test:spend:1'))->>'success',
  'true', '16. dépense nominale OK');
SELECT is((public.legacy_loyalty_spend('aaaa0001-0000-4000-8000-000000000002', 1000, 'Achat test', 'test:spend:1'))->>'idempotent',
  'true', '17. rejeu idempotent (pas de double débit)');
SELECT is((public.legacy_loyalty_earn('aaaa0001-0000-4000-8000-000000000002', 4000, 'Gain test', 'test:earn:1'))->>'balance',
  '4234', '18. crédit + solde exact');

-- 19-21. Panier : remboursement adossé au journal uniquement.
SELECT is((public.legacy_loyalty_cart_refund('aaaa0001-0000-4000-8000-000000000002','item-x'))->>'error',
  'no_apply', '19. remboursement refusé sans débit correspondant');
SELECT is((public.legacy_loyalty_spend('aaaa0001-0000-4000-8000-000000000002', 234, 'Article offert (panier)', 'cart_free_apply:item-x'))->>'success',
  'true', '20. débit panier enregistré');
SELECT is((public.legacy_loyalty_cart_refund('aaaa0001-0000-4000-8000-000000000002','item-x'))->>'balance',
  '4234', '21. remboursement = montant du journal (234)');

-- 22-23. Fidélité : échange unique, solde exact.
INSERT INTO public.loyalty_rewards (id, title, points_cost, available)
VALUES ('aaaa0002-0000-4000-8000-000000000001','Récompense test', 200, true)
ON CONFLICT (id) DO NOTHING;
SELECT is((public.legacy_loyalty_redeem('aaaa0001-0000-4000-8000-000000000002','aaaa0002-0000-4000-8000-000000000001'))->>'success',
  'true', '22. échange nominal');
SELECT is((public.legacy_loyalty_redeem('aaaa0001-0000-4000-8000-000000000002','aaaa0002-0000-4000-8000-000000000001'))->>'error',
  'already_redeemed', '23. double échange refusé');

-- 24. Privilèges RPC : authenticated n'exécute aucune RPC legacy.
SELECT ok(
  (SELECT bool_and(NOT has_function_privilege('authenticated', p.oid, 'EXECUTE'))
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname IN
     ('legacy_loyalty_spend','legacy_loyalty_earn','legacy_loyalty_cart_refund','legacy_loyalty_redeem','create_shop_order','legacy_loyalty_backfill_openings')),
  '24. RPC serveur non exécutables par authenticated');

SELECT * FROM finish();
ROLLBACK;
