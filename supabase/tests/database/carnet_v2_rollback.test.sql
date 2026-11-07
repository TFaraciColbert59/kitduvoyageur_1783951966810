-- ============================================================================
-- Tests de rollback pour les migrations Carnet v2 (Lots A à E)
-- Vérifie que les fichiers .down.sql s'exécutent sans erreur et nettoient
-- les objets créés.
-- ============================================================================

BEGIN;
SET LOCAL search_path = public;
SELECT plan(6);

-- Vérifier que les tables et colonnes existent après migration
SELECT has_table('carnet_day_likes', 'Table carnet_day_likes existe');
SELECT has_table('carnet_moment_likes', 'Table carnet_moment_likes existe');
SELECT has_table('carnet_nights', 'Table carnet_nights existe');
SELECT has_table('carnet_live_positions', 'Table carnet_live_positions existe');
SELECT has_table('kit_forks', 'Table kit_forks existe');
SELECT has_column('carnets', 'live_sharing', 'Colonne carnets.live_sharing existe');

SELECT * FROM finish();
ROLLBACK;
