-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: A-214 — hygiène des grants : anon hors des fonctions internes
-- Chantier communauté (audit 2026-10-12) — P1 frontières d'accès
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Constat : 30 fonctions SECURITY DEFINER étaient exécutables par `anon`,
-- dont des fonctions de trigger (jamais appelables directement) et des
-- prédicats internes (is_conv_admin, is_group_member, can_read_trip…) dont
-- l'usage est d'ailleurs TO authenticated dans toutes les policies relevées.
--
-- Correctif :
--   1) toutes les fonctions de trigger : EXECUTE révoqué pour PUBLIC/anon/authenticated
--      (les triggers s'exécutent sous le rôle propriétaire, indifférent) ;
--   2) prédicats internes et lectures personnelles de trajectoire : EXECUTE
--      révoqué pour PUBLIC/anon (authenticated conservé — policies) ;
--   3) les trois fonctions de trajectoire re-confirmées SECURITY INVOKER
--      (l'audit avait relevé le hotfix ; on le rend rejouable et explicite).
-- Conservés pour anon (usages publics réels) : is_group_public, lkv_can,
-- marketplace_list, group_public_card_stats, get_route_cache,
-- current_feature_flags, get_user_signature (consentement géré en interne).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Fonctions de trigger : jamais exécutables directement.
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

-- 2) Prédicats internes et lectures personnelles : anon n'a rien à y faire.
REVOKE ALL ON FUNCTION public.is_conv_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_conv_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_group_organizer(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_read_trip(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_edit_trip(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.count_trajectoire_at_scale(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_latest_trajectoire(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_latest_trajectory_plan(uuid) FROM PUBLIC, anon;

-- 3) Trajectoire : lecture personnelle sous RLS de l'appelant, jamais en DEFINER.
ALTER FUNCTION public.count_trajectoire_at_scale(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_latest_trajectoire(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_latest_trajectory_plan(uuid) SECURITY INVOKER;

COMMENT ON FUNCTION public.get_latest_trajectoire(uuid) IS
  'A-214 : SECURITY INVOKER — la RLS de l''appelant gouverne la lecture des trajectoires.';
