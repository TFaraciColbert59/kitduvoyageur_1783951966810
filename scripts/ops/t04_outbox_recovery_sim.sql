-- ============================================================================
-- T04 — Simulation locale : panne du consommateur d'outbox, détection,
-- escalade en `dead`, reprise sans double événement.
--
-- ⚠ LOCAL UNIQUEMENT (base Docker 127.0.0.1:54322 ou conteneur lkdv-test-db).
-- Ne jamais exécuter contre la production liée : ce script renomme
-- temporairement une fonction et écrit des lignes préfixées `t04sim:`.
--
-- Usage :
--   Get-Content scripts/ops/t04_outbox_recovery_sim.sql -Raw |
--     docker exec -i supabase_db_ai-finalization psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f -
--
-- Attendu : run_failed.failed = 1 ; statut `failed` avec last_error non nul ;
-- puis `dead` après escalade ; reprise -> processed = 1, exactement 1 événement,
-- projection = 40 ; rejeu -> processed = 0, toujours 1 événement.
-- ============================================================================

-- 0. Utilisateur de simulation (créé par le trigger auth -> user_profiles).
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.user_profiles WHERE email = 't04-sim@lkdv.test' LIMIT 1;
  IF v_id IS NULL THEN
    v_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    VALUES (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't04-sim@lkdv.test', crypt('x', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb);
  END IF;
END
$$;

-- 1. Nettoyage d'une éventuelle exécution précédente (même clé).
DELETE FROM public.progression_events
 WHERE reward_transaction_id IN (SELECT id FROM public.reward_transactions WHERE idempotency_key = 't04sim:1');
DELETE FROM public.progression_outbox
 WHERE reward_transaction_id IN (SELECT id FROM public.reward_transactions WHERE idempotency_key = 't04sim:1');
DELETE FROM public.reward_transactions WHERE idempotency_key = 't04sim:1';
DELETE FROM public.user_season_progress
 WHERE user_id IN (SELECT id FROM public.user_profiles WHERE email = 't04-sim@lkdv.test');
DELETE FROM public.user_progression
 WHERE user_id IN (SELECT id FROM public.user_profiles WHERE email = 't04-sim@lkdv.test');

-- 2. Ligne saine : transaction de progression (40 XP Explorer) + outbox pending.
WITH u AS (SELECT id FROM public.user_profiles WHERE email = 't04-sim@lkdv.test' LIMIT 1),
tx AS (
  INSERT INTO public.reward_transactions
    (user_id, points, transaction_type, reference_type, metadata, idempotency_key, effective_at, rules_version, skill_allocations, counts_for_progression, affects_balance)
  SELECT u.id, 40, 'PROGRESSION_AWARD', 't04_sim',
         jsonb_build_object('action_type', 'hike_session_processed', 'explanation', 'T04 simulation'),
         't04sim:1', now(), 'v1',
         '[{"skill":"explorer","weight":1,"points":40},{"skill":"preparer","weight":0,"points":0},{"skill":"partager","weight":0,"points":0},{"skill":"entraider","weight":0,"points":0}]'::jsonb,
         true, false
  FROM u RETURNING id, user_id
)
INSERT INTO public.progression_outbox (reward_transaction_id, user_id, status, payload_snapshot)
SELECT id, user_id, 'pending', '{}'::jsonb FROM tx;

SELECT 'etape_1_seed' AS etape, count(*) AS outbox_pending
  FROM public.progression_outbox o
  JOIN public.reward_transactions t ON t.id = o.reward_transaction_id
 WHERE t.idempotency_key = 't04sim:1' AND o.status = 'pending';

-- 3. PANNE SIMULÉE : la dépendance du consommateur disparaît (renommage).
ALTER FUNCTION public.progression_level_for(p_points integer) RENAME TO progression_level_for_t04;
SELECT 'etape_2_panne' AS etape, public.process_progression_outbox(50) AS run_failed;

SELECT 'etape_3_etat' AS etape, o.status, o.attempts, (o.last_error IS NOT NULL) AS has_error
  FROM public.progression_outbox o
  JOIN public.reward_transactions t ON t.id = o.reward_transaction_id
 WHERE t.idempotency_key = 't04sim:1';

-- 4. Escalade : après 5 échecs cumulés, la ligne devient `dead` (état dégradé).
-- La reprise respecte le backoff : on force `available_at` pour simuler le
-- moment où le prochain essai est dû (comportement réel d'un cron ultérieur).
UPDATE public.progression_outbox SET attempts = 4, available_at = now()
 WHERE reward_transaction_id IN (SELECT id FROM public.reward_transactions WHERE idempotency_key = 't04sim:1');
SELECT 'etape_4_escalade' AS etape, public.process_progression_outbox(50) AS run_dead;

SELECT 'etape_5_etat' AS etape, o.status, o.attempts
  FROM public.progression_outbox o
  JOIN public.reward_transactions t ON t.id = o.reward_transaction_id
 WHERE t.idempotency_key = 't04sim:1';

-- 5. REPRISE : dépendance restaurée + requeue ops explicite (jamais automatique sur dead).
ALTER FUNCTION public.progression_level_for_t04(p_points integer) RENAME TO progression_level_for;
UPDATE public.progression_outbox SET status = 'failed', attempts = 0, available_at = now()
 WHERE reward_transaction_id IN (SELECT id FROM public.reward_transactions WHERE idempotency_key = 't04sim:1');
SELECT 'etape_6_reprise' AS etape, public.process_progression_outbox(50) AS run_recovered;

SELECT 'etape_7_verif' AS etape,
       (SELECT count(*) FROM public.progression_events e
          JOIN public.reward_transactions t ON t.id = e.reward_transaction_id
         WHERE t.idempotency_key = 't04sim:1') AS evenements,
       (SELECT up.lifetime_points FROM public.user_progression up
          JOIN public.user_profiles p ON p.id = up.user_id
         WHERE p.email = 't04-sim@lkdv.test') AS projection_lifetime;

-- 6. REJEU : aucun double traitement, aucun second événement.
SELECT 'etape_8_rejeu' AS etape, public.process_progression_outbox(50) AS run_replay;

SELECT 'etape_9_verif_finale' AS etape,
       (SELECT count(*) FROM public.progression_events e
          JOIN public.reward_transactions t ON t.id = e.reward_transaction_id
         WHERE t.idempotency_key = 't04sim:1') AS evenements;
