-- Vérification : exactement un gagnant parmi les deux sources concurrentes,
-- l'autre refusée par plafond quotidien, aucune transaction double.
SELECT
  (SELECT count(*)::int FROM public.progression_decisions
    WHERE user_id='a0808080-0000-4000-8000-000000000001'
      AND source_id IN ('race-a','race-b') AND outcome='awarded') AS winners,
  (SELECT count(*)::int FROM public.progression_decisions
    WHERE user_id='a0808080-0000-4000-8000-000000000001'
      AND source_id IN ('race-a','race-b') AND outcome='refused' AND reason='plafond_quotidien') AS refused_by_quota,
  (SELECT count(*)::int FROM public.reward_transactions
    WHERE user_id='a0808080-0000-4000-8000-000000000001'
      AND idempotency_key IN ('hike_session:race-a','hike_session:race-b')) AS race_transactions;
