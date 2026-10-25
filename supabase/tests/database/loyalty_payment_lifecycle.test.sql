-- T38 — cycle de paiement de la fidélité :
--   encaissement réel uniquement (jamais `confirmed` seul), idempotence par
--   événement (webhook répété), remboursements partiels exacts, virement non
--   encaissé sans crédit, remboursement avant paiement sans effet, aucune
--   écriture de progression.
BEGIN;
SELECT plan(13);

INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data) VALUES
  ('38383838-0000-4000-8000-000000000001','t38-pay@test.invalid','authenticated','authenticated','{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.orders (id, user_id, order_number, status, payment_method, total_eur)
VALUES
  ('38383838-0000-4000-8000-0000000000a1','38383838-0000-4000-8000-000000000001','T38-1','confirmed','card',123.45),
  ('38383838-0000-4000-8000-0000000000a2','38383838-0000-4000-8000-000000000001','T38-2','confirmed','virement',159.00),
  ('38383838-0000-4000-8000-0000000000a3','38383838-0000-4000-8000-000000000001','T38-3','pending','card',50.00);

-- 1. Encaissement : 12 345 centimes de marchandises → 1 234 crédits.
SELECT is(
  (public.record_order_encashment_event('evt-pay-1', '38383838-0000-4000-8000-0000000000a1', 'payment', 12345))->>'creditsDelta',
  '1234', '10 crédits par euro de marchandises payé');
SELECT is(
  (SELECT payment_state FROM public.orders WHERE id = '38383838-0000-4000-8000-0000000000a1'),
  'paid', 'commande marquée payée sur encaissement réel');
SELECT is(
  (SELECT COALESCE(SUM(points), 0)::int FROM public.loyalty_history
    WHERE user_id = '38383838-0000-4000-8000-000000000001' AND action = 'order_encashment'),
  1234, 'crédits écrits au journal de fidélité');

-- 2. Webhook répété : idempotent, aucun second crédit.
SELECT is(
  (public.record_order_encashment_event('evt-pay-1', '38383838-0000-4000-8000-0000000000a1', 'payment', 12345))->>'idempotent',
  'true', 'même événement rejoué → idempotent');
SELECT is(
  (SELECT count(*)::int FROM public.loyalty_history
    WHERE user_id = '38383838-0000-4000-8000-000000000001' AND action = 'order_encashment'),
  1, 'un seul crédit malgré le rejeu');

-- 3. Remboursement partiel : débit de la part remboursée, état exact.
SELECT is(
  (public.record_order_encashment_event('evt-ref-1', '38383838-0000-4000-8000-0000000000a1', 'refund', 2500))->>'ok',
  'true', 'remboursement partiel accepté');
SELECT is(
  (SELECT payment_state FROM public.orders WHERE id = '38383838-0000-4000-8000-0000000000a1'),
  'partially_refunded', 'état partiellement remboursé');
SELECT is(
  (SELECT COALESCE(SUM(points), 0)::int FROM public.loyalty_history
    WHERE user_id = '38383838-0000-4000-8000-000000000001'),
  984, '250 crédits retirés (1 234 − 250)');

-- 4. Remboursement avant paiement : sans effet.
SELECT is(
  (public.record_order_encashment_event('evt-ref-early', '38383838-0000-4000-8000-0000000000a3', 'refund', 1000))->>'reason',
  'paiement_non_encaisse', 'remboursement avant encaissement refusé');

-- 5. Virement confirmé : AUCUN crédit tant qu'aucun événement d'encaissement n'existe.
SELECT is(
  (SELECT count(*)::int FROM public.loyalty_history
    WHERE user_id = '38383838-0000-4000-8000-000000000001' AND action IN ('order_encashment','order_refund')
      AND source_id LIKE '%0000000000a2%'),
  0, 'virement confirmé non encaissé → aucun nouveau crédit');

-- 6. Remboursement excédant le payé : débit borné (jamais négatif).
SELECT public.record_order_encashment_event('evt-ref-2', '38383838-0000-4000-8000-0000000000a1', 'refund', 999999);
SELECT ok(
  (SELECT COALESCE(SUM(points), 0) >= 0 FROM public.loyalty_history
    WHERE user_id = '38383838-0000-4000-8000-000000000001'),
  'le journal de fidélité ne devient jamais négatif');
SELECT is(
  (SELECT payment_state FROM public.orders WHERE id = '38383838-0000-4000-8000-0000000000a1'),
  'refunded', 'remboursement total reflété');

-- 7. Aucune écriture de progression (XP) par l'encaissement.
SELECT is(
  (SELECT count(*)::int FROM public.reward_transactions
    WHERE user_id = '38383838-0000-4000-8000-000000000001' AND transaction_type = 'PROGRESSION_AWARD'),
  0, 'aucun XP émis par l’encaissement');

SELECT * FROM finish();
ROLLBACK;
