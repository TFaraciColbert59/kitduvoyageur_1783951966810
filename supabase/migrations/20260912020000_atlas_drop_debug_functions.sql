-- CHANTIER ATLAS — Phase 1 — Cleanup : suppression des fonctions d'observabilité temporaires.
--
-- Les preuves brutes (RLS + EXPLAIN ANALYZE + distribution) ont été capturées dans
-- docs/atlas/phase1-proof-20260912.txt avant ce cleanup.
-- Les objets de production de la Phase 1 (trails_in_viewport, matviews,
-- refresh_atlas_density) ne sont PAS concernés.

DROP FUNCTION IF EXISTS public.atlas_debug_explain(text, boolean);
DROP FUNCTION IF EXISTS public.atlas_debug_policies();
DROP FUNCTION IF EXISTS public.atlas_debug_rls_status();
DROP FUNCTION IF EXISTS public.atlas_set_country_geometry(text, jsonb);
