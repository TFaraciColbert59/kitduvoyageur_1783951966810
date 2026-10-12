-- Conseiller Supabase (12 octobre) : `function_search_path_mutable` sur
-- `legacy_loyalty_level_for`. La fonction ne lit aucune table (un CASE sur un
-- entier) : un search_path vide ne change rien à son résultat.
-- Appliquée en production le 12 octobre (version 20261012143322).
alter function public.legacy_loyalty_level_for(integer) set search_path = '';
