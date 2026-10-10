-- ============================================================================
-- DOWN — 20261010170000_phase1_reconcile_i4
--   • DROP des 2 fonctions de réconciliation I4 ;
--   • suppression des transactions de provenance
--     (idempotency_key LIKE 'opening:reward_account:%:incr4').
--
-- NOTA — le down NE re-crée PAS les 8 projections démo purgées : les snapshots
-- (`progression_legacy_snapshot`, reasons `demo_projection_sans_provenance_incr4`
-- et `demo_compte_sans_provenance_incr4`) sont CONSERVÉS pour une restauration
-- manuelle ou un rejeu ultérieur. Les soldes legacy et `user_profiles` ne sont
-- pas touchés (aucune donnée affichée n'est modifiée par ce down : la
-- suppression des tx de provenance ne déclenche aucun trigger de compte —
-- les triggers `update_reward_account_on_transaction` sont INSERT only).
-- ============================================================================

DROP FUNCTION IF EXISTS public.phase1_reconcile_demo_economics();
DROP FUNCTION IF EXISTS public.phase1_purge_orphan_demo_projections();

DELETE FROM public.reward_transactions
WHERE idempotency_key LIKE 'opening:reward_account:%:incr4';
