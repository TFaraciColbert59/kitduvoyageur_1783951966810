-- ============================================================================
-- Rôle applicatif : pouvoir exécuter les aides de rôle appelées par les policies
-- ============================================================================
-- Incident : en production, l'ACL de public.is_admin() ne laissait EXECUTE
-- qu'à service_role. La policy `user_profiles_select_admin` est pourtant
-- évaluée pour chaque lecture authentifiée et levait alors :
--   permission denied for function is_admin
--
-- Les trois fonctions restent inchangées :
--   - SECURITY DEFINER ;
--   - search_path verrouillé sur public ;
--   - lecture limitée au rôle de l'appelant (auth.uid()).
-- Seule leur capacité à être évaluée depuis une policy RLS est restaurée.
-- `anon` reste explicitement privé d'EXECUTE.
-- ============================================================================

BEGIN;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_moderateur() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_role() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_moderateur() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_role() TO authenticated, service_role;

COMMIT;
