-- ============================================================================
-- PHASE 1 — Incrément 5 : normalisation des niveaux de fidélité.
--   • les labels historiques non canoniques ('Ambassadeur', 'Explorateur
--     Elite', 'Découvreur', 'Novice'…) subsistent sur des comptes réels ;
--   • le niveau est DÉRIVÉ du solde par `legacy_loyalty_level_for` (barème
--     legacy 0/500/1500/3500/7500, miroir de la page fidélité et de
--     `getLoyaltyDiscount`) ;
--   • fonction idempotente (2e appel ⇒ 0), service_role uniquement, appelée
--     une fois en fin de migration.
-- Additive. Down : DROP FUNCTION seulement (le label est dérivé — re-corrompre
-- des niveaux serait absurde : voir migrations_down/…180000…down.sql).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.phase1_normalize_loyalty_levels()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.user_profiles
     SET loyalty_level = public.legacy_loyalty_level_for(GREATEST(0, COALESCE(loyalty_points, 0))),
         updated_at = now()
   WHERE loyalty_level IS DISTINCT FROM public.legacy_loyalty_level_for(GREATEST(0, COALESCE(loyalty_points, 0)));

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

REVOKE ALL ON FUNCTION public.phase1_normalize_loyalty_levels() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase1_normalize_loyalty_levels() TO service_role;

-- Appel unique : aligne tous les profils sur le barème canonique.
SELECT public.phase1_normalize_loyalty_levels();
