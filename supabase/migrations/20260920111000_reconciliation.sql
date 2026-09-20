-- ============================================================================
-- Réconciliation de l'ancienne projection de démonstration (moteur 20260919).
-- Les valeurs de l'ancien moteur n'étaient adossées à AUCUN fait vérifié :
-- elles sont archivées pour traçabilité puis retirées de la projection active.
-- Les soldes économiques (reward_accounts) ne sont pas touchés.
-- Les utilisateurs avec des gains canoniques réels restent reconstructibles via
-- `rebuild_progression_from_ledger`.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.progression_legacy_snapshot (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  snapshot JSONB NOT NULL,
  mapping_version TEXT NOT NULL DEFAULT 'demo-engine-20260919',
  reason TEXT NOT NULL DEFAULT 'projection_non_adossee',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.progression_legacy_snapshot ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.progression_legacy_snapshot FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.progression_legacy_snapshot TO service_role;

-- 1. Archive des projections héritées (une seule fois par utilisateur).
INSERT INTO public.progression_legacy_snapshot (user_id, snapshot, mapping_version, reason)
SELECT up.user_id, to_jsonb(up), 'demo-engine-20260919', 'projection_non_adossée'
FROM public.user_progression up
WHERE NOT EXISTS (
  SELECT 1 FROM public.progression_legacy_snapshot s WHERE s.user_id = up.user_id
);

-- 2. Purge des journaux sans gain canonique associé.
DELETE FROM public.progression_events WHERE reward_transaction_id IS NULL;

-- 3. Purge des projections d'utilisateurs sans aucun gain canonique.
DELETE FROM public.user_progression up
WHERE NOT EXISTS (
  SELECT 1 FROM public.reward_transactions t
  WHERE t.user_id = up.user_id AND t.counts_for_progression = true
);

DELETE FROM public.user_season_progress sp
WHERE NOT EXISTS (
  SELECT 1 FROM public.reward_transactions t
  WHERE t.user_id = sp.user_id AND t.counts_for_progression = true
);

-- 4. Les comptes réellement pourvus en gains canoniques retrouvent une
--    projection exacte (idempotent).
DO $$
DECLARE v_user UUID;
BEGIN
  FOR v_user IN
    SELECT DISTINCT user_id FROM public.reward_transactions WHERE counts_for_progression = true
  LOOP
    PERFORM public.rebuild_progression_from_ledger(v_user);
  END LOOP;
END;
$$;
