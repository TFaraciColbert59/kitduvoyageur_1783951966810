-- ============================================================================
-- PHASE 1 — Incrément 4 : réconciliation des soldes historiques (spec I4).
-- Écarts prod constatés (audit lecture seule, tous démo — 0 écart non-démo) :
--   • 8 `user_progression` de comptes démo sans AUCUN `progression_events`
--     (projections sans provenance, écrites par les anciens seeds) ;
--   • 1 compte économique démo (pinné d5451f35…) : available_points=2480 vs
--     Σ ledger 12, lifetime_points=3120 vs Σ positifs 12 (planchers seedés
--     sans provenance ledger).
-- Principe (identique à l'incr 1) : préserver les valeurs affichées, restaurer
-- la provenance, snapshot AVANT toute écriture, jamais de suppression
-- silencieuse. Les comptes non-démo ne sont JAMAIS touchés.
-- Idempotente : fonctions « compute-first » ; réapplication sûre.
-- 20261010140000/150000/160000 (appliquées) ne sont pas modifiées.
-- ============================================================================

-- 1. PURGE DES PROJECTIONS DÉMO SANS PROVENANCE -------------------------------
CREATE OR REPLACE FUNCTION public.phase1_purge_orphan_demo_projections()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_row RECORD;
  v_purged integer := 0;
BEGIN
  FOR v_row IN
    SELECT up.user_id
    FROM public.user_progression up
    JOIN public.user_profiles p ON p.id = up.user_id AND p.is_demo
    WHERE NOT EXISTS (
      SELECT 1 FROM public.progression_events e WHERE e.user_id = up.user_id
    )
  LOOP
    -- Snapshot AVANT suppression (idempotent : user + reason).
    INSERT INTO public.progression_legacy_snapshot (user_id, snapshot, mapping_version, reason)
    SELECT v_row.user_id,
           jsonb_build_object(
             'user_progression',
             (SELECT to_jsonb(up) FROM public.user_progression up WHERE up.user_id = v_row.user_id),
             'user_season_progress',
             COALESCE((SELECT jsonb_agg(to_jsonb(usp)) FROM public.user_season_progress usp WHERE usp.user_id = v_row.user_id), '[]'::jsonb)
           ),
           'demo-incr4',
           'demo_projection_sans_provenance_incr4'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.progression_legacy_snapshot s
      WHERE s.user_id = v_row.user_id
        AND s.reason = 'demo_projection_sans_provenance_incr4'
    );

    DELETE FROM public.user_season_progress WHERE user_id = v_row.user_id;
    DELETE FROM public.user_progression WHERE user_id = v_row.user_id;
    v_purged := v_purged + 1;
  END LOOP;

  RETURN jsonb_build_object('purged', v_purged);
END; $$;

-- 2. RÉCONCILIATION ÉCONOMIQUE DES COMPTES DÉMO -------------------------------
-- Pour chaque compte démo en écart (available ≠ Σ ledger ou lifetime ≠ Σ >0) :
-- snapshot → transaction de provenance (ADMIN_ADJUSTMENT, clé idempotente) →
-- restauration des valeurs d'affichage d'origine → contrôle bloquant.
CREATE OR REPLACE FUNCTION public.phase1_reconcile_demo_economics()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_acc RECORD;
  v_sum bigint;
  v_positive bigint;
  v_available_after integer;
  v_key text;
  v_reconciled integer := 0;
BEGIN
  FOR v_acc IN
    SELECT ra.*
    FROM public.reward_accounts ra
    JOIN public.user_profiles p ON p.id = ra.user_id AND p.is_demo
  LOOP
    -- Sommes « ledger » au sens de l'audit I4 (affects_balance ≠ false).
    SELECT COALESCE(SUM(t.points), 0),
           COALESCE(SUM(CASE WHEN t.points > 0 THEN t.points ELSE 0 END), 0)
      INTO v_sum, v_positive
    FROM public.reward_transactions t
    WHERE t.user_id = v_acc.user_id
      AND t.affects_balance IS NOT FALSE;

    -- Déjà canonique (les deux côtés) : rien à faire.
    IF COALESCE(v_acc.available_points, 0) = v_sum
       AND COALESCE(v_acc.lifetime_points, 0) = v_positive THEN
      CONTINUE;
    END IF;

    v_key := 'opening:reward_account:' || v_acc.user_id || ':incr4';

    -- Provenance déjà posée par une exécution précédente : idempotent.
    IF EXISTS (SELECT 1 FROM public.reward_transactions t WHERE t.idempotency_key = v_key) THEN
      CONTINUE;
    END IF;

    -- 2.1 Snapshot du compte AVANT écriture (idempotent : user + reason).
    INSERT INTO public.progression_legacy_snapshot (user_id, snapshot, mapping_version, reason)
    SELECT v_acc.user_id,
           jsonb_build_object('reward_account',
             (SELECT to_jsonb(ra) FROM public.reward_accounts ra WHERE ra.user_id = v_acc.user_id)),
           'demo-incr4',
           'demo_compte_sans_provenance_incr4'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.progression_legacy_snapshot s
      WHERE s.user_id = v_acc.user_id
        AND s.reason = 'demo_compte_sans_provenance_incr4'
    );

    -- 2.2 Transaction de provenance : la différence compte → ledger.
    INSERT INTO public.reward_transactions
      (user_id, points, transaction_type, affects_balance, counts_for_progression, idempotency_key, metadata)
    VALUES
      (v_acc.user_id,
       (COALESCE(v_acc.available_points, 0) - v_sum)::integer,
       'ADMIN_ADJUSTMENT', true, false, v_key,
       '{"reason":"reconciliation_incr4","snapshot":true}'::jsonb)
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

    -- 2.3 Le trigger update_reward_account_on_transaction a incrémenté le
    -- compte : on restaure les valeurs d'affichage d'origine du snapshot
    -- (prélevées sur la ligne lue avant écriture).
    UPDATE public.reward_accounts ra
    SET available_points = COALESCE(v_acc.available_points, 0),
        lifetime_points = COALESCE(v_acc.lifetime_points, 0),
        eligible_points = COALESCE(v_acc.eligible_points, 0),
        earned_this_period = COALESCE(v_acc.earned_this_period, 0),
        redeemed_points = COALESCE(v_acc.redeemed_points, 0),
        updated_at = now()
    WHERE ra.user_id = v_acc.user_id;

    -- 2.4 Contrôle bloquant : compte == ledger (côté solde disponible).
    SELECT COALESCE(ra.available_points, 0) INTO v_available_after
    FROM public.reward_accounts ra WHERE ra.user_id = v_acc.user_id;

    SELECT COALESCE(SUM(t.points), 0) INTO v_sum
    FROM public.reward_transactions t
    WHERE t.user_id = v_acc.user_id
      AND t.affects_balance IS NOT FALSE;

    IF v_available_after IS DISTINCT FROM v_sum THEN
      RAISE EXCEPTION 'phase1_reconcile_i4: compte démo % non réconcilié (available % ≠ Σ ledger %)',
        v_acc.user_id, v_available_after, v_sum;
    END IF;

    v_reconciled := v_reconciled + 1;
  END LOOP;

  RETURN jsonb_build_object('reconciled', v_reconciled);
END; $$;

-- 3. PRIVILÈGES : service_role uniquement -------------------------------------
REVOKE ALL ON FUNCTION public.phase1_purge_orphan_demo_projections() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase1_purge_orphan_demo_projections() TO service_role;

REVOKE ALL ON FUNCTION public.phase1_reconcile_demo_economics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase1_reconcile_demo_economics() TO service_role;

-- 4. APPLICATION UNIQUE --------------------------------------------------------
SELECT public.phase1_purge_orphan_demo_projections();
SELECT public.phase1_reconcile_demo_economics();

-- 5. CONTRÔLE BLOQUANT GLOBAL --------------------------------------------------
-- Pour TOUS les users is_demo : available == Σ ledger, et plus aucune
-- user_progression sans événement. Les non-démo ne sont jamais concernés.
DO $$
DECLARE
  v_bad integer;
BEGIN
  SELECT count(*) INTO v_bad
  FROM (
    SELECT ra.user_id
    FROM public.reward_accounts ra
    JOIN public.user_profiles p ON p.id = ra.user_id AND p.is_demo
    WHERE COALESCE(ra.available_points, 0) IS DISTINCT FROM (
      SELECT COALESCE(SUM(t.points), 0)
      FROM public.reward_transactions t
      WHERE t.user_id = ra.user_id
        AND t.affects_balance IS NOT FALSE
    )
  ) x;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'phase1_reconcile_i4: % compte(s) démo non réconcilié(s) (available ≠ Σ ledger)', v_bad;
  END IF;

  SELECT count(*) INTO v_bad
  FROM public.user_progression up
  JOIN public.user_profiles p ON p.id = up.user_id AND p.is_demo
  WHERE NOT EXISTS (
    SELECT 1 FROM public.progression_events e WHERE e.user_id = up.user_id
  );
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'phase1_reconcile_i4: % projection(s) démo sans provenance restante(s)', v_bad;
  END IF;
END $$;
