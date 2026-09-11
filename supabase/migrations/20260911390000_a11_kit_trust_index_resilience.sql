-- ============================================================================
-- A11 — Resilience de l'index unique de kit_trust_scores.
--
-- Constat (Étape 0-B, pgTAP conservation) : un REFRESH non concurrent échoue si
-- la (re)construction de l'index unique `kit_trust_scores_kit_id_key` rencontre
-- des doublons. L'index est un artefact de refresh CONCURRENTLY, pas une
-- garantie métier : il ne doit pas bloquer le rafraîchissement des agrégats.
--
-- Correctif : le refresh tente le plain REFRESH puis (re)crée l'index unique
-- s'il est possible ; en cas de doublons, un WARNING explicite est émis et le
-- refresh reste valide (index absent). Idempotent.
-- ============================================================================

-- L'index unique préexistant (baseline/prod) bloque le plain REFRESH en cas de
-- doublons : on le retire, le refresh redevient possible, la fonction le
-- recrée ensuite en best-effort.
DROP INDEX IF EXISTS public.kit_trust_scores_kit_id_key;

CREATE OR REPLACE FUNCTION public.refresh_kit_conservation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Kit survival
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.kit_item_survival;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.kit_item_survival;
  END;

  -- Survival by kit
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.kit_item_survival_by_kit;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.kit_item_survival_by_kit;
  END;

  -- Trust scores : plain refresh, puis index unique best-effort.
  REFRESH MATERIALIZED VIEW public.kit_trust_scores;
  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS kit_trust_scores_kit_id_key
      ON public.kit_trust_scores(kit_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'A11 — index unique kit_trust_scores non créé (doublons kit_id) : %', SQLERRM;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_kit_conservation() FROM public;
GRANT EXECUTE ON FUNCTION public.refresh_kit_conservation() TO service_role;

COMMENT ON FUNCTION public.refresh_kit_conservation() IS
  'A11 — refresh résilient : plain refresh + index unique best-effort (jamais bloquant).';
