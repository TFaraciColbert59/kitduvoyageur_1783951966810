-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: alignement — search_path vide sur legacy_loyalty_level_for
-- Reprise du hotfix appliqué en direct sur le projet déployé
-- (version distante 20261012143322, « legacy_loyalty_search_path ») afin que
-- le dépôt reste rejouable à l'identique. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

alter function public.legacy_loyalty_level_for(integer) set search_path = '';
