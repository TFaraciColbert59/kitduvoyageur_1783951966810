BEGIN;
SELECT plan(32);
SELECT is((SELECT rolcanlogin FROM pg_roles WHERE rolname='lkdv_progression_job'), false, 'job role cannot log in');
SELECT is((SELECT rolbypassrls FROM pg_roles WHERE rolname='lkdv_progression_job'), false, 'job role cannot bypass RLS');
SELECT ok(NOT has_schema_privilege('authenticated','progression_ops','USAGE'), 'private ops schema');
SELECT ok(NOT has_function_privilege('anon','progression_ops.run_job(text)','EXECUTE'), 'anon cannot invoke job');
SELECT ok(NOT has_function_privilege('authenticated','progression_ops.run_job(text)','EXECUTE'), 'client cannot invoke job');
SELECT ok(has_function_privilege('service_role','progression_ops.run_job(text)','EXECUTE'), 'server may recover a job');
SELECT is((SELECT count(*)::int FROM cron.job WHERE jobname IN ('lkdv-progression-outbox-v1','lkdv-progression-leaderboard-v1')), 2, 'two real schedules');
SELECT throws_ok($$SELECT progression_ops.run_job('award')$$, 'P0001', 'job non autorisé', 'no arbitrary award job');
SELECT is((progression_ops.run_job('outbox')->>'failed')::int, 0, 'bounded outbox actually succeeds');
SELECT is((progression_ops.run_job('outbox')->>'failed')::int, 0, 'outbox replay actually succeeds');
SELECT ok((SELECT count(*) >= 2 FROM progression_ops.job_runs WHERE job='outbox' AND status='succeeded' AND finished_at IS NOT NULL), 'attempts recorded');
-- A genuine failing aggregate write exercises the consumer subtransaction.
DELETE FROM public.leaderboard_refresh_queue;
INSERT INTO auth.users(id,email,aud,role,raw_user_meta_data)
VALUES ('cccccccc-0000-4000-8000-000000000001','ops-poison@test.invalid','authenticated','authenticated','{}'),
       ('cccccccc-0000-4000-8000-000000000002','ops-healthy@test.invalid','authenticated','authenticated','{}');
INSERT INTO public.user_progression(user_id,lifetime_points)
VALUES ('cccccccc-0000-4000-8000-000000000001',40),('cccccccc-0000-4000-8000-000000000002',40)
ON CONFLICT(user_id) DO UPDATE SET lifetime_points=40;
INSERT INTO public.user_season_progress(user_id,season_id,season_points)
SELECT u.id,s.id,40 FROM auth.users u CROSS JOIN public.progression_seasons s
WHERE u.id IN ('cccccccc-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000002') AND s.status='active';
CREATE FUNCTION pg_temp.reject_poison_aggregate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.user_id='cccccccc-0000-4000-8000-000000000001'::uuid THEN
  RAISE EXCEPTION 'synthetic_refresh_fault';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ops_test_poison BEFORE INSERT ON public.progression_leaderboard_agg
FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_poison_aggregate();
CREATE TEMP TABLE ops_first_result AS SELECT progression_ops.run_job('leaderboard') AS result;
SELECT is((SELECT (result->>'failed')::int FROM ops_first_result),1,'real aggregate failure is reported');
SELECT is((SELECT (result->>'processed')::int FROM ops_first_result),1,'healthy row proceeds despite poison row');
SELECT is((SELECT attempts FROM public.leaderboard_refresh_queue WHERE user_id='cccccccc-0000-4000-8000-000000000001'),1,'attempt survives exception rollback');
SELECT is((SELECT status FROM public.leaderboard_refresh_queue WHERE user_id='cccccccc-0000-4000-8000-000000000001'),'failed','first poison attempt is retryable');
SELECT is((SELECT last_error FROM public.leaderboard_refresh_queue WHERE user_id='cccccccc-0000-4000-8000-000000000001'),'synthetic_refresh_fault','failure reason retained');
SELECT ok((SELECT available_at>=now()+interval '2 minutes' FROM public.leaderboard_refresh_queue WHERE user_id='cccccccc-0000-4000-8000-000000000001'),'backoff protects next batch');
SELECT is((public.refresh_leaderboard_batch(100)->>'failed')::int,0,'immediate retry skips backoff row');
SELECT is((SELECT attempts FROM public.leaderboard_refresh_queue WHERE user_id='cccccccc-0000-4000-8000-000000000001'),1,'backoff does not consume an attempt');
SELECT is((SELECT status FROM progression_ops.job_runs WHERE job='leaderboard' ORDER BY id DESC LIMIT 1),'degraded','wrapper logs partial failure as degraded');
DO $$BEGIN
 FOR i IN 2..5 LOOP
  UPDATE public.leaderboard_refresh_queue SET available_at=now() WHERE user_id='cccccccc-0000-4000-8000-000000000001';
  PERFORM public.refresh_leaderboard_batch(1);
 END LOOP;
END $$;
SELECT is((SELECT attempts FROM public.leaderboard_refresh_queue WHERE user_id='cccccccc-0000-4000-8000-000000000001'),5,'five actual failures are retained');
SELECT is((SELECT status FROM public.leaderboard_refresh_queue WHERE user_id='cccccccc-0000-4000-8000-000000000001'),'dead','poison stops after fifth attempt');
UPDATE public.leaderboard_refresh_queue SET available_at=now() WHERE user_id='cccccccc-0000-4000-8000-000000000001';
SELECT is((public.refresh_leaderboard_batch(100)->>'failed')::int,0,'dead row is not retried automatically');
SELECT is((SELECT attempts FROM public.leaderboard_refresh_queue WHERE user_id='cccccccc-0000-4000-8000-000000000001'),5,'dead attempt count remains bounded');
DROP TRIGGER ops_test_poison ON public.progression_leaderboard_agg;
-- New source/projection change is the explicit recovery transition.
UPDATE public.user_season_progress SET season_points=season_points+1 WHERE user_id='cccccccc-0000-4000-8000-000000000001';
SELECT is((SELECT status FROM public.leaderboard_refresh_queue WHERE user_id='cccccccc-0000-4000-8000-000000000001'),'pending','new projection change requeues dead row');
SELECT is((SELECT attempts FROM public.leaderboard_refresh_queue WHERE user_id='cccccccc-0000-4000-8000-000000000001'),0,'explicit recovery resets attempts');
SELECT ok((SELECT last_error IS NULL AND available_at<=now() FROM public.leaderboard_refresh_queue WHERE user_id='cccccccc-0000-4000-8000-000000000001'),'explicit recovery clears error and backoff');
SELECT is((progression_ops.run_job('leaderboard')->>'processed')::int,1,'recovered projection is processed');
SELECT is((SELECT status FROM public.leaderboard_refresh_queue WHERE user_id='cccccccc-0000-4000-8000-000000000001'),'processed','recovery final status');
SELECT is((SELECT status FROM progression_ops.job_runs WHERE job='leaderboard' ORDER BY id DESC LIMIT 1),'succeeded','wrapper reports successful recovery');
SELECT is((SELECT count(*)::int FROM public.progression_events WHERE user_id IN ('cccccccc-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000002')),0,'projection refresh does not emit XP events');
SELECT is((SELECT count(*)::int FROM public.reward_transactions WHERE user_id IN ('cccccccc-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000002')),0,'projection refresh does not issue economic transactions');
SELECT * FROM finish();
ROLLBACK;
