-- Retour arrière d'exploitation : arrêter les jobs ; garder logs, gains,
-- projections, droits et protections. Aucune descente économique destructive.
DO $$ DECLARE v_id bigint; BEGIN
  FOR v_id IN SELECT jobid FROM cron.job WHERE jobname IN
    ('lkdv-progression-outbox-v1', 'lkdv-progression-leaderboard-v1') LOOP
    PERFORM cron.unschedule(v_id);
  END LOOP;
END $$;
