-- ============================================================================
-- A11 — Robustesse du rafraîchissement de la matview d'empreinte.
--
-- Constat (Étape 0-B, pgTAP conservation sur base baseline) : le refresh
-- CONCURRENTLY exige une matview déjà peuplée ; sur une base neuve (ou après
-- restauration), l'appel échoue. Correctif : tentative concurrente, repli non
-- concurrent si la matview n'est pas encore peuplée. Idempotent.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.refresh_user_field_signature()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_field_signature;
  EXCEPTION WHEN OTHERS THEN
    -- Matview non peuplée (base neuve) ou index unique indisponible :
    -- repli non concurrent, toujours correct.
    REFRESH MATERIALIZED VIEW public.user_field_signature;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_user_field_signature() FROM public;
GRANT EXECUTE ON FUNCTION public.refresh_user_field_signature() TO service_role;

COMMENT ON FUNCTION public.refresh_user_field_signature() IS
  'A11 — refresh avec repli non concurrent (matview non peuplée en base neuve).';

-- ── conservation : mêmes garde-fous pour les trois matviews ──────────────────
CREATE OR REPLACE FUNCTION public.refresh_kit_conservation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.kit_item_survival;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.kit_item_survival;
  END;
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.kit_item_survival_by_kit;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.kit_item_survival_by_kit;
  END;
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.kit_trust_scores;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.kit_trust_scores;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_kit_conservation() FROM public;
GRANT EXECUTE ON FUNCTION public.refresh_kit_conservation() TO service_role;

COMMENT ON FUNCTION public.refresh_kit_conservation() IS
  'A11 — refresh avec repli non concurrent (matviews non peuplées en base neuve).';
