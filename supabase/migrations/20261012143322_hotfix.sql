-- Hotfix appliqué historiquement en direct sur le projet (supabase_migrations).
-- Reconstruit depuis l'historique distant le 13/10/2026 — version 20261012143322.
-- Conservé tel quel : source de vérité pour la rejouabilité.
alter function public.legacy_loyalty_level_for(integer) set search_path = '';
