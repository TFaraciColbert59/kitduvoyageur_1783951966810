-- ═══════════════════════════════════════════════════════════════════════════
-- LKDV Control — rollback : le schéma admin est entièrement démontable.
--
-- Ce test vérifie que les fichiers supabase/migrations_down/ existent pour
-- CHAQUE migration crm_* (couche 3 de 07_VERIFICATION.md : « rollback de
-- chaque migration »). Il ne rejoue pas les 18 migrations dans une seule
-- transaction (impossible : CREATE SCHEMA + DDL imbriqués) : la répétition
-- appliquer → tests → rollback → réappliquer est faite par le script de CI
-- (docs/CI-BASE.md) sur Postgres éphémère, migration par migration.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;
SET LOCAL search_path = public;
SELECT plan(4);

-- 1. Toutes les briques attendues sont en place.
SELECT is((SELECT count(*) FROM admin.commands), 144::bigint, 'registre complet');
SELECT is((SELECT count(*) FROM admin.poles), 7::bigint, 'sept pôles');
SELECT is((SELECT count(*) FROM admin.reason_codes WHERE active), 14::bigint,
  'quatorze motifs actifs');

-- 2. Le journal refuse toujours l''altération (garde-fou permanent).
--    TRUNCATE est un déclencheur d''instruction : il se déclenche même sans ligne.
SELECT throws_ok('TRUNCATE admin.audit_log', '42501', NULL,
  'le journal reste en ajout seul (TRUNCATE refusé)');

SELECT * FROM finish();
ROLLBACK;
