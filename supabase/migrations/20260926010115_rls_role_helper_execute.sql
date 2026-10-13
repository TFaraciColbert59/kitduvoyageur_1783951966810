-- Hotfix appliqué historiquement en direct sur le projet (supabase_migrations).
-- Reconstruit depuis l'historique distant le 13/10/2026 — version 20260926010115.
-- Conservé tel quel : source de vérité pour la rejouabilité.
BEGIN;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_moderateur() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_role() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_moderateur() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_role() TO authenticated, service_role;

COMMIT;
