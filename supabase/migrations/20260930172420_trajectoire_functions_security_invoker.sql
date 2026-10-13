-- Hotfix appliqué historiquement en direct sur le projet (supabase_migrations).
-- Reconstruit depuis l'historique distant le 13/10/2026 — version 20260930172420.
-- Conservé tel quel : source de vérité pour la rejouabilité.
ALTER FUNCTION public.get_latest_trajectoire(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_latest_trajectory_plan(uuid) SECURITY INVOKER;
ALTER FUNCTION public.count_trajectoire_at_scale(uuid) SECURITY INVOKER;
