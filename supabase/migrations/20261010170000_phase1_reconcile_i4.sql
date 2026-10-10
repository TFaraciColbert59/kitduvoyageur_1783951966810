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
-- snapshot → DEUX écritures de provenance idempotentes pour couvrir les DEUX
-- invariants de l'audit I4 (Σ affects_balance = available ET Σ positifs =
-- lifetime) → restauration exacte des valeurs d'affichage d'origine →
-- contrôles bloquants (ledger ET affichage).
--   A. points = lifetime − Σ(positifs)  (clé 'opening:reward_account:<uid>:incr4')
--   B. points = A_écart − A_points, seulement si les deltas diffèrent
--      (clé '...:incr4:adjust')
CREATE OR REPLACE FUNCTION public.phase1_reconcile_demo_economics()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_acc RECORD;
  v_sum bigint;
  v_positive bigint;
  v_delta_available bigint;
  v_delta_lifetime bigint;
  v_key text;
  v_key_adjust text;
  v_av integer; v_lt integer; v_el integer; v_ea integer; v_rd integer;
  v_av2 integer; v_lt2 integer; v_el2 integer; v_ea2 integer; v_rd2 integer;
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
    v_key_adjust := v_key || ':adjust';

    -- Provenance déjà posée par une exécution précédente : idempotent.
    IF EXISTS (SELECT 1 FROM public.reward_transactions t WHERE t.idempotency_key = v_key) THEN
      CONTINUE;
    END IF;

    -- Deltas à couvrir :
    --   Σ(affects_balance) doit égaler available  → delta_available
    --   Σ(points > 0)      doit égaler lifetime   → delta_lifetime
    v_delta_available := COALESCE(v_acc.available_points, 0) - v_sum;
    v_delta_lifetime  := COALESCE(v_acc.lifetime_points, 0) - v_positive;

    -- Valeurs d'affichage pré-écriture (restaurées après l'incrément du trigger).
    v_av := COALESCE(v_acc.available_points, 0);
    v_lt := COALESCE(v_acc.lifetime_points, 0);
    v_el := COALESCE(v_acc.eligible_points, 0);
    v_ea := COALESCE(v_acc.earned_this_period, 0);
    v_rd := COALESCE(v_acc.redeemed_points, 0);

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

    -- 2.2 Écriture A — aligne le cumul à vie (Σ des positifs).
    INSERT INTO public.reward_transactions
      (user_id, points, transaction_type, affects_balance, counts_for_progression, idempotency_key, metadata)
    VALUES
      (v_acc.user_id, v_delta_lifetime::integer, 'ADMIN_ADJUSTMENT', true, false, v_key,
       '{"reason":"reconciliation_incr4","snapshot":true}'::jsonb)
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

    -- 2.3 Écriture B — corrige le solde disponible (Σ affects_balance), quand
    -- les deux deltas divergent (ex. disponible 2480 ≠ à-vie 3120).
    IF v_delta_available <> v_delta_lifetime THEN
      INSERT INTO public.reward_transactions
        (user_id, points, transaction_type, affects_balance, counts_for_progression, idempotency_key, metadata)
      VALUES
        (v_acc.user_id, (v_delta_available - v_delta_lifetime)::integer, 'ADMIN_ADJUSTMENT', true, false, v_key_adjust,
         '{"reason":"reconciliation_incr4","snapshot":true}'::jsonb)
      ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
    END IF;

    -- 2.4 Le trigger update_reward_account_on_transaction a muté le compte :
    -- on restaure EXACTEMENT les valeurs d'affichage pré-écriture.
    UPDATE public.reward_accounts ra
    SET available_points = v_av,
        lifetime_points = v_lt,
        eligible_points = v_el,
        earned_this_period = v_ea,
        redeemed_points = v_rd,
        updated_at = now()
    WHERE ra.user_id = v_acc.user_id;

    -- 2.5 Contrôles bloquants : ledger ET affichage (sinon RAISE).
    SELECT COALESCE(ra.available_points, 0), COALESCE(ra.lifetime_points, 0),
           COALESCE(ra.eligible_points, 0), COALESCE(ra.earned_this_period, 0),
           COALESCE(ra.redeemed_points, 0)
      INTO v_av2, v_lt2, v_el2, v_ea2, v_rd2
    FROM public.reward_accounts ra WHERE ra.user_id = v_acc.user_id;

    SELECT COALESCE(SUM(t.points), 0),
           COALESCE(SUM(CASE WHEN t.points > 0 THEN t.points ELSE 0 END), 0)
      INTO v_sum, v_positive
    FROM public.reward_transactions t
    WHERE t.user_id = v_acc.user_id
      AND t.affects_balance IS NOT FALSE;

    IF v_av2 IS DISTINCT FROM v_sum THEN
      RAISE EXCEPTION 'phase1_reconcile_i4: compte démo % non réconcilié (available % ≠ Σ ledger %)',
        v_acc.user_id, v_av2, v_sum;
    END IF;
    IF v_lt2 IS DISTINCT FROM v_positive THEN
      RAISE EXCEPTION 'phase1_reconcile_i4: compte démo % non réconcilié (lifetime % ≠ Σ positifs %)',
        v_acc.user_id, v_lt2, v_positive;
    END IF;
    IF v_av2 <> v_av OR v_lt2 <> v_lt OR v_el2 <> v_el OR v_ea2 <> v_ea OR v_rd2 <> v_rd THEN
      RAISE EXCEPTION 'phase1_reconcile_i4: compte démo % — valeurs d''affichage non restaurées à l''identique',
        v_acc.user_id;
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
      OR COALESCE(ra.lifetime_points, 0) IS DISTINCT FROM (
        SELECT COALESCE(SUM(CASE WHEN t.points > 0 THEN t.points ELSE 0 END), 0)
        FROM public.reward_transactions t
        WHERE t.user_id = ra.user_id
          AND t.affects_balance IS NOT FALSE
      )
  ) x;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'phase1_reconcile_i4: % compte(s) démo non réconcilié(s) (available ≠ Σ ledger ou lifetime ≠ Σ positifs)', v_bad;
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
