-- Phase 1 — Incrément 4 : réconciliation des soldes historiques.
--   • purge des projections démo sans provenance (snapshot avant suppression) ;
--   • réconciliation économique des comptes démo (provenance ledger) ;
--   • les comptes NON-démo ne sont jamais touchés.
-- Transaction annulée (ROLLBACK).
BEGIN;
SET LOCAL search_path = public;
SELECT plan(17);

-- Fixtures : démo + non-démo, mêmes désordres (projection sans événement,
-- compte économique sans ledger).
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('aaaa0006-0000-4000-8000-0000000000d1','authenticated','authenticated','p1i4demo@test.local','x','{}','{}',now(),now()),
  ('aaaa0006-0000-4000-8000-0000000000a1','authenticated','authenticated','p1i4norm@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email, is_demo)
VALUES
  ('aaaa0006-0000-4000-8000-0000000000d1','Démo I4','p1i4demo@test.local', true),
  ('aaaa0006-0000-4000-8000-0000000000a1','Normal I4','p1i4norm@test.local', false)
ON CONFLICT (id) DO UPDATE SET is_demo = EXCLUDED.is_demo;

INSERT INTO public.user_progression (user_id, lifetime_points)
VALUES
  ('aaaa0006-0000-4000-8000-0000000000d1', 777),
  ('aaaa0006-0000-4000-8000-0000000000a1', 777)
ON CONFLICT (user_id) DO UPDATE SET lifetime_points = 777;

INSERT INTO public.user_season_progress (user_id, season_id, season_points)
VALUES
  ('aaaa0006-0000-4000-8000-0000000000d1', (SELECT id FROM public.progression_seasons WHERE status='active' LIMIT 1), 777),
  ('aaaa0006-0000-4000-8000-0000000000a1', (SELECT id FROM public.progression_seasons WHERE status='active' LIMIT 1), 777)
ON CONFLICT (user_id, season_id) DO UPDATE SET season_points = 777;

INSERT INTO public.reward_accounts
  (user_id, available_points, lifetime_points, eligible_points, earned_this_period, redeemed_points)
VALUES
  ('aaaa0006-0000-4000-8000-0000000000d1', 500, 500, 321, 100, 50),
  ('aaaa0006-0000-4000-8000-0000000000a1', 500, 500, 321, 100, 50)
ON CONFLICT (user_id) DO UPDATE SET
  available_points = 500, lifetime_points = 500, eligible_points = 321,
  earned_this_period = 100, redeemed_points = 50;

-- 1-2. État initial des projections.
SELECT is((SELECT count(*)::int FROM public.user_progression
   WHERE user_id='aaaa0006-0000-4000-8000-0000000000d1'), 1,
  '1. démo : projection présente avant purge');
SELECT is((SELECT count(*)::int FROM public.user_progression
   WHERE user_id='aaaa0006-0000-4000-8000-0000000000a1'), 1,
  '2. non-démo : projection présente avant purge');

-- 3-6. Purge des projections démo sans provenance.
SELECT is((public.phase1_purge_orphan_demo_projections())->>'purged', '1',
  '3. purge : 1 projection démo purgée');
SELECT ok(
  (SELECT count(*)::int FROM public.user_progression
     WHERE user_id='aaaa0006-0000-4000-8000-0000000000d1') = 0
  AND (SELECT count(*)::int FROM public.user_season_progress
     WHERE user_id='aaaa0006-0000-4000-8000-0000000000d1') = 0,
  '4. démo : user_progression ET user_season_progress supprimées');
SELECT is((SELECT count(*)::int FROM public.progression_legacy_snapshot
   WHERE user_id='aaaa0006-0000-4000-8000-0000000000d1'
     AND reason='demo_projection_sans_provenance_incr4'), 1,
  '5. démo : snapshot de la projection conservé');
SELECT is((SELECT count(*)::int FROM public.user_progression
   WHERE user_id='aaaa0006-0000-4000-8000-0000000000a1'), 1,
  '6. non-démo : projection JAMAIS touchée');

-- 7-12. Réconciliation économique du compte démo.
SELECT is((public.phase1_reconcile_demo_economics())->>'reconciled', '1',
  '7. réconciliation : 1 compte démo réconcilié');
SELECT is((SELECT available_points FROM public.reward_accounts
   WHERE user_id='aaaa0006-0000-4000-8000-0000000000d1'), 500,
  '8. démo : available_points affiché préservé (500)');
SELECT is((SELECT COALESCE(SUM(points), 0)::int FROM public.reward_transactions
   WHERE user_id='aaaa0006-0000-4000-8000-0000000000d1' AND affects_balance IS NOT FALSE), 500,
  '9. démo : Σ ledger = 500 (provenance restaurée)');
SELECT ok(
  (SELECT lifetime_points = 500 AND eligible_points = 321
          AND earned_this_period = 100 AND redeemed_points = 50
   FROM public.reward_accounts WHERE user_id='aaaa0006-0000-4000-8000-0000000000d1'),
  '10. démo : valeurs d''affichage restaurées à l''identique');
SELECT is((SELECT count(*)::int FROM public.reward_transactions
   WHERE user_id='aaaa0006-0000-4000-8000-0000000000d1'
     AND idempotency_key LIKE 'opening:reward_account:%:incr4'), 1,
  '11. démo : une seule transaction de provenance');
SELECT is((SELECT count(*)::int FROM public.progression_legacy_snapshot
   WHERE user_id='aaaa0006-0000-4000-8000-0000000000d1'
     AND reason='demo_compte_sans_provenance_incr4'), 1,
  '12. démo : snapshot du compte conservé');

-- 13-14. Le compte non-démo n'est jamais touché.
SELECT ok(
  (SELECT available_points = 500 AND lifetime_points = 500
   FROM public.reward_accounts WHERE user_id='aaaa0006-0000-4000-8000-0000000000a1'),
  '13. non-démo : compte économique intact');
SELECT is((SELECT count(*)::int FROM public.reward_transactions
   WHERE user_id='aaaa0006-0000-4000-8000-0000000000a1'
     AND idempotency_key LIKE 'opening:reward_account:%:incr4'), 0,
  '14. non-démo : aucune transaction de provenance');

-- 15-17. Idempotence : deuxième exécution sans effet ni doublon.
SELECT is((public.phase1_purge_orphan_demo_projections())->>'purged', '0',
  '15. double exécution : purge → 0');
SELECT is((public.phase1_reconcile_demo_economics())->>'reconciled', '0',
  '16. double exécution : reconcile → 0');
SELECT is((SELECT count(*)::int FROM public.reward_transactions
   WHERE user_id='aaaa0006-0000-4000-8000-0000000000d1'
     AND idempotency_key LIKE 'opening:reward_account:%:incr4'), 1,
  '17. double exécution : aucun doublon de transaction');

SELECT * FROM finish();
ROLLBACK;
