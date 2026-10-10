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
--   4. couverture comportementale de `create_shop_order` (revues rounds 1-2) :
--      produit fixture minimal (id, slug unique, name, price_eur, stock,
--      available) conforme au schéma réel ; virement créé 'pending' sans
--      crédit, points crédités à la confirmation admin (triggers
--      `process_order_points` + `process_pending_order_points` dans
--      l'environnement certifié baseline + migrations post-baseline).
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
SELECT plan(49);

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
SELECT is((public.legacy_loyalty_spend('aaaa0001-0000-4000-8000-000000000002', 1000, 'Achat test', 'test:spend:1'))->>'level',
  (SELECT loyalty_level FROM public.user_profiles WHERE id = 'aaaa0001-0000-4000-8000-000000000002'),
  '17b. rejeu idempotent : level = loyalty_level courant (Explorateur à 234)');
SELECT is((public.legacy_loyalty_earn('aaaa0001-0000-4000-8000-000000000002', 4000, 'Gain test', 'test:earn:1'))->>'balance',
  '4234', '18. crédit + solde exact');
SELECT is((SELECT loyalty_level FROM public.user_profiles WHERE id = 'aaaa0001-0000-4000-8000-000000000002'),
  'Guide de Montagne', '18b. niveau recalculé par earn (4234 ⇒ Guide de Montagne)');

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
     ('legacy_loyalty_spend','legacy_loyalty_earn','legacy_loyalty_cart_refund','legacy_loyalty_redeem','create_shop_order','legacy_loyalty_backfill_openings','legacy_loyalty_level_for')),
  '24. RPC serveur non exécutables par authenticated');
SELECT ok(to_regprocedure('public.create_shop_order(uuid,text,jsonb,jsonb,text)') IS NOT NULL,
  '24a. create_shop_order existe (signature exacte)');
SELECT ok(NOT has_function_privilege('authenticated','public.create_shop_order(uuid,text,jsonb,jsonb,text)','EXECUTE'),
  '24b. create_shop_order non exécutable par authenticated');

-- 25-35. create_shop_order : couverture comportementale (spec §6.4-12) + virement.
INSERT INTO public.shop_products (id, slug, name, price_eur, available, stock)
VALUES ('aaaa0003-0000-4000-8000-000000000001', 'phase1-smoke-produit', 'Produit Phase 1 Smoke', 25.00, true, 5)
ON CONFLICT (id) DO NOTHING;

SELECT is((public.create_shop_order('aaaa0001-0000-4000-8000-000000000002', 'virement', '{}'::jsonb,
  '[{"slug":"phase1-slug-inexistant","quantity":1}]'::jsonb, 'standard'))->>'error',
  'unknown_product', '25. slug inconnu refusé');

SELECT is((public.create_shop_order('aaaa0001-0000-4000-8000-000000000002', 'virement', '{}'::jsonb,
  '[{"slug":"phase1-smoke-produit","quantity":1}]'::jsonb, 'pigeon'))->>'error',
  'invalid_shipping', '26. livraison inconnue refusée');

CREATE TEMP TABLE p1_order_res AS
SELECT public.create_shop_order('aaaa0001-0000-4000-8000-000000000002', 'virement',
  '{"city":"Grenoble"}'::jsonb, '[{"slug":"phase1-smoke-produit","quantity":2}]'::jsonb, 'standard') AS res;

SELECT is((SELECT (res->>'success')::boolean FROM p1_order_res), true, '27. commande virement : success');
SELECT is((SELECT status FROM public.orders WHERE id = ((SELECT res->>'orderId' FROM p1_order_res))::uuid),
  'pending', '28. commande virement créée pending');
SELECT is((SELECT count(*)::int FROM public.loyalty_history
   WHERE source_id = 'order_' || (SELECT res->>'orderId' FROM p1_order_res)), 0,
  '29. aucun point crédité à la création (virement)');
SELECT is((SELECT count(*)::int FROM public.stock_movements
   WHERE reference_id = (SELECT res->>'orderId' FROM p1_order_res) AND reference_type = 'order'), 1,
  '30. un mouvement de stock tracé');
SELECT is((SELECT stock FROM public.shop_products WHERE id = 'aaaa0003-0000-4000-8000-000000000001'), 3,
  '31. stock décrémenté de 2 (5 → 3)');

UPDATE public.orders SET status = 'confirmed'
WHERE id = ((SELECT res->>'orderId' FROM p1_order_res))::uuid;

SELECT is((SELECT count(*)::int FROM public.loyalty_history
   WHERE source_id = 'order_' || (SELECT res->>'orderId' FROM p1_order_res)), 1,
  '32. confirmation admin : exactement une ligne purchase order_<id>');
SELECT is((SELECT points FROM public.loyalty_history
   WHERE source_id = 'order_' || (SELECT res->>'orderId' FROM p1_order_res)), 559,
  '33. points = floor(total × 10) = 559 (55,90 €)');
SELECT is((SELECT loyalty_points FROM public.user_profiles WHERE id = 'aaaa0001-0000-4000-8000-000000000002'),
  (SELECT COALESCE(SUM(points), 0)::int FROM public.loyalty_history WHERE user_id = 'aaaa0001-0000-4000-8000-000000000002'),
  '34. loyalty_points synchronisé après confirmation');

SELECT is((public.create_shop_order('aaaa0001-0000-4000-8000-000000000002', 'virement', '{}'::jsonb,
  '[{"slug":"phase1-smoke-produit","quantity":0}]'::jsonb, 'standard'))->>'error',
  'invalid_items', '35. quantité invalide refusée');

-- 36-45. Idempotence source_id scopée par utilisateur (revue finale).
-- A et B utilisent la MÊME source 'cart_free_apply:shared-x' (id produit
-- catalogue partagé) : sans scoping user_id, le 2e utilisateur était sauté.
SELECT is((public.legacy_loyalty_earn('aaaa0001-0000-4000-8000-000000000001', 300, 'Seed A', 'seed:A:cross'))->>'success',
  'true', '36. A crédité (seed 300)');
SELECT is((public.legacy_loyalty_spend('aaaa0001-0000-4000-8000-000000000001', 100, 'Panier A', 'cart_free_apply:shared-x'))->>'success',
  'true', '37. A applique shared-x (100)');
SELECT is((public.legacy_loyalty_cart_refund('aaaa0001-0000-4000-8000-000000000001', 'shared-x'))->>'success',
  'true', '38. A rembourse shared-x (ligne remove A)');

CREATE TEMP TABLE p1_x AS
  SELECT (SELECT loyalty_points FROM public.user_profiles WHERE id = 'aaaa0001-0000-4000-8000-000000000002') AS b_before;
CREATE TEMP TABLE p1_xspend AS
  SELECT public.legacy_loyalty_spend('aaaa0001-0000-4000-8000-000000000002', 100, 'Panier B', 'cart_free_apply:shared-x') AS res;

SELECT is((SELECT res->>'success' FROM p1_xspend), 'true',
  '39. B débité sur la même source que A (pas de saut inter-utilisateur)');
SELECT ok((SELECT res->>'idempotent' FROM p1_xspend) IS NULL,
  '40. B : pas de court-circuit idempotent (débit réel)');
SELECT is((SELECT loyalty_points FROM public.user_profiles WHERE id = 'aaaa0001-0000-4000-8000-000000000002'),
  (SELECT b_before - 100 FROM p1_x), '41. solde de B réellement débité (-100)');

CREATE TEMP TABLE p1_xrefund AS
  SELECT public.legacy_loyalty_cart_refund('aaaa0001-0000-4000-8000-000000000002', 'shared-x') AS res;

SELECT is((SELECT res->>'success' FROM p1_xrefund), 'true',
  '42. B remboursé indépendamment (pas de saut via la ligne remove de A)');
SELECT is((SELECT loyalty_points FROM public.user_profiles WHERE id = 'aaaa0001-0000-4000-8000-000000000002'),
  (SELECT b_before FROM p1_x), '43. solde de B restauré après remboursement');

SELECT is((public.legacy_loyalty_cart_refund('aaaa0001-0000-4000-8000-000000000001', 'shared-x'))->>'idempotent',
  'true', '44. rejeu A : idempotent pour A uniquement');
SELECT is((SELECT loyalty_points FROM public.user_profiles WHERE id = 'aaaa0001-0000-4000-8000-000000000001'),
  300, '45. rejeu A : aucun débit supplémentaire (solde 300)');

SELECT * FROM finish();
ROLLBACK;
