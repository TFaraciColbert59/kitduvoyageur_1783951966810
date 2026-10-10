-- Phase 1 — Incrément 2 : isolation des données de démonstration (is_demo,
-- classements) + rejeu canonique de l'outbox. Transaction annulée (ROLLBACK).
BEGIN;
SET LOCAL search_path = public;
SELECT plan(13);

-- Fixtures : démo (flag), utilisateur normal (comportement inchangé),
-- utilisateur de rejeu (mini-outbox).
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('aaaa0004-0000-4000-8000-0000000000d1','authenticated','authenticated','p1demo@test.local','x','{}','{}',now(),now()),
  ('aaaa0004-0000-4000-8000-0000000000a1','authenticated','authenticated','p1norm@test.local','x','{}','{}',now(),now()),
  ('aaaa0004-0000-4000-8000-0000000000b1','authenticated','authenticated','p1replay@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email, is_demo)
VALUES
  ('aaaa0004-0000-4000-8000-0000000000d1','Démo P1','p1demo@test.local', true),
  ('aaaa0004-0000-4000-8000-0000000000a1','Normal P1','p1norm@test.local', false),
  ('aaaa0004-0000-4000-8000-0000000000b1','Replay P1','p1replay@test.local', false)
ON CONFLICT (id) DO UPDATE SET is_demo = EXCLUDED.is_demo;

CREATE TEMP TABLE p1_season AS
SELECT id FROM public.progression_seasons WHERE status = 'active' LIMIT 1;

-- 1. Colonne is_demo : existe, NOT NULL, défaut false.
SELECT ok(
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='user_profiles'
            AND column_name='is_demo' AND is_nullable='NO' AND column_default='false'),
  '1. user_profiles.is_demo existe (NOT NULL DEFAULT false)');

-- 2. Défaut false (utilisateur sans flag explicite).
SELECT is((SELECT is_demo FROM public.user_profiles WHERE id='aaaa0004-0000-4000-8000-0000000000a1'),
  false, '2. is_demo par défaut = false');

-- 3-4. Démo exclu des classements (artefact préexistant purgé).
INSERT INTO public.user_season_progress (user_id, season_id, season_points)
VALUES ('aaaa0004-0000-4000-8000-0000000000d1', (SELECT id FROM p1_season), 100)
ON CONFLICT (user_id, season_id) DO NOTHING;

INSERT INTO public.progression_leaderboard_agg
  (season_id, scope_type, scope_id, user_id, alias, level, level_title, season_points)
VALUES
  ((SELECT id FROM p1_season), 'world', '', 'aaaa0004-0000-4000-8000-0000000000d1', 'alias-demo', 1, 'Explorateur', 100)
ON CONFLICT (season_id, scope_type, scope_id, user_id) DO NOTHING;

SELECT is((SELECT count(*)::int FROM public.progression_leaderboard_agg
   WHERE user_id='aaaa0004-0000-4000-8000-0000000000d1'), 1,
  '3. pré-remplissage : 1 ligne agg pour le démo');

SELECT public.refresh_leaderboard_for_user('aaaa0004-0000-4000-8000-0000000000d1', (SELECT id FROM p1_season));

SELECT is((SELECT count(*)::int FROM public.progression_leaderboard_agg
   WHERE user_id='aaaa0004-0000-4000-8000-0000000000d1'), 0,
  '4. refresh démo : toutes ses lignes agg supprimées');

-- 5-6. Utilisateur normal : comportement inchangé (1 ligne world).
INSERT INTO public.user_season_progress (user_id, season_id, season_points)
VALUES ('aaaa0004-0000-4000-8000-0000000000a1', (SELECT id FROM p1_season), 50)
ON CONFLICT (user_id, season_id) DO NOTHING;

SELECT public.refresh_leaderboard_for_user('aaaa0004-0000-4000-8000-0000000000a1', (SELECT id FROM p1_season));

SELECT is((SELECT count(*)::int FROM public.progression_leaderboard_agg
   WHERE user_id='aaaa0004-0000-4000-8000-0000000000a1'), 1,
  '5. refresh utilisateur normal : 1 ligne agg (world)');
SELECT is((SELECT season_points FROM public.progression_leaderboard_agg
   WHERE user_id='aaaa0004-0000-4000-8000-0000000000a1' AND scope_type='world'), 50,
  '6. ligne world alimentée par user_season_progress (50)');

-- 7-10. Mini-rejeu canonique : tx seed-like en outbox `processed` sans événement.
INSERT INTO public.reward_transactions
  (id, user_id, points, transaction_type, metadata, counts_for_progression, affects_balance, season_id, idempotency_key)
VALUES
  ('aaaa0005-0000-4000-8000-000000000001', 'aaaa0004-0000-4000-8000-0000000000b1', 100, 'PROGRESSION_AWARD',
   '{"seeded_by":"test"}'::jsonb, true, false, (SELECT id FROM p1_season), 'phase1-demo-test:replay-1');

UPDATE public.progression_outbox
SET status='processed', processed_at=now()
WHERE reward_transaction_id='aaaa0005-0000-4000-8000-000000000001';

SELECT is((SELECT status FROM public.progression_outbox
   WHERE reward_transaction_id='aaaa0005-0000-4000-8000-000000000001'), 'processed',
  '7. état « prod » simulé : outbox processed sans événement');
SELECT is((SELECT count(*)::int FROM public.progression_events
   WHERE user_id='aaaa0004-0000-4000-8000-0000000000b1'), 0,
  '8. aucun événement avant rejeu (projection vide)');

-- Même bloc logique que la migration : reset outbox -> process.
UPDATE public.progression_outbox
SET status='pending', attempts=0, available_at=now(), processed_at=NULL, last_error=NULL, locked_at=NULL
WHERE reward_transaction_id='aaaa0005-0000-4000-8000-000000000001';

SELECT public.process_progression_outbox(200);

SELECT is((SELECT count(*)::int FROM public.progression_events
   WHERE user_id='aaaa0004-0000-4000-8000-0000000000b1'
     AND reward_transaction_id='aaaa0005-0000-4000-8000-000000000001'), 1,
  '9. rejeu canonique : 1 événement adossé à la tx');
SELECT is((SELECT lifetime_points FROM public.user_progression
   WHERE user_id='aaaa0004-0000-4000-8000-0000000000b1'), 100,
  '10. projection reconstruite : lifetime_points = 100');

-- 11-13. Garde de double application : rejouer la séquence (même bloc logique
-- que la migration) ne double ni l'événement ni le crédit (le consumer saute
-- les lignes déjà adossées à un événement).
UPDATE public.progression_outbox
SET status='pending', attempts=0, available_at=now(), processed_at=NULL, last_error=NULL, locked_at=NULL
WHERE reward_transaction_id='aaaa0005-0000-4000-8000-000000000001';

SELECT public.process_progression_outbox(200);

SELECT is((SELECT count(*)::int FROM public.progression_events
   WHERE user_id='aaaa0004-0000-4000-8000-0000000000b1'
     AND reward_transaction_id='aaaa0005-0000-4000-8000-000000000001'), 1,
  '11. double application : toujours 1 événement (pas de doublon)');
SELECT is((SELECT lifetime_points FROM public.user_progression
   WHERE user_id='aaaa0004-0000-4000-8000-0000000000b1'), 100,
  '12. double application : lifetime inchangé (100, pas de double crédit)');
SELECT is((SELECT status FROM public.progression_outbox
   WHERE reward_transaction_id='aaaa0005-0000-4000-8000-000000000001'), 'processed',
  '13. double application : outbox consommée (processed)');

SELECT * FROM finish();
ROLLBACK;
