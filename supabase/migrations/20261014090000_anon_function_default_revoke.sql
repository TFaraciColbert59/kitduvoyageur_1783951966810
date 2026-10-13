-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: A-214 (ter) — le privilège par défaut d'anon est retiré pour les
-- fonctions du schéma public (la cause profonde des régressions répétées)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- diagnostic : `pg_default_acl` portait un GRANT EXECUTE explicite à anon et
-- authenticated pour toute nouvelle fonction de public — révoquer depuis
-- PUBLIC ne suffisait donc pas (group_repetitive_notifications a retrouvé
-- EXECUTE anon malgré le durcissement 20261013230000).
--
-- correctif :
--   1) révocation immédiate d'EXECUTE anon sur toutes les fonctions de
--      trigger applicatives (rattrapage) ;
--   2) révocation du privilège PAR DÉFAUT d'anon pour les futures fonctions ;
--      authenticated/service_role le conservent (policies) — anon devra être
--      autorisé explicitement, ce qui est désormais un choix visible en revue.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS signature
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prorettype = 'trigger'::regtype
       AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.signature);
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
