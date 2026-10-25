-- ============================================================================
-- DOWN — 20261010180000_phase1_normalize_loyalty_levels
--   DROP FUNCTION seulement.
--
-- Le niveau de fidélité est DÉRIVÉ du solde (`legacy_loyalty_level_for`) ; la
-- migration n'a fait qu'aligner les labels historiques sur ce barème. Rejouer
-- le désalignement (restaurer 'Ambassadeur' sur un compte à 800 pts) serait
-- absurde et remettrait l'app en incohérence avec `getLoyaltyDiscount`.
-- Aucun retour arrière de données n'est donc prévu : on retire uniquement la
-- fonction d'alignement.
-- ============================================================================

DROP FUNCTION IF EXISTS public.phase1_normalize_loyalty_levels();
