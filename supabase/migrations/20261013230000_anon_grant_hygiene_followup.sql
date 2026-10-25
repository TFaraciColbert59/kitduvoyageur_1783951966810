-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: A-214 (bis) — hygiène des grants, version durable
-- Chantier communauté (audit 2026-10-12) — P1 frontières d'accès
-- ═══════════════════════════════════════════════════════════════════════════
--
-- L'audit a montré que toute nouvelle fonction de trigger créée après le
-- premier durcissement retrouvait EXECUTE pour anon (privilèges par défaut).
-- Ce correctif :
--   1) re-révoque EXECUTE (PUBLIC/anon/authenticated) sur toutes les
--      fonctions de trigger applicatives existantes ;
--   2) durcit les privilèges PAR DÉFAUT du schéma public : toute future
--      fonction devra être explicitement autorisée (moindre privilège).
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
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.signature);
  END LOOP;
END $$;

-- Durcissement par défaut : les prochaines fonctions du schéma public ne
-- seront plus exécutables par PUBLIC sans GRANT explicite.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

COMMENT ON SCHEMA public IS
  'Schéma applicatif LKDV — EXECUTE par défaut retiré (A-214) : chaque fonction expose ses grants explicitement.';
