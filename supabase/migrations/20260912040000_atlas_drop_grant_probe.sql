-- CHANTIER ATLAS — Phase 6 — Cleanup de la sonde de privilèges.
-- La preuve brute has_function_privilege a été capturée dans
-- docs/atlas/atlas-function-grants-20260912.txt avant ce cleanup.

DROP FUNCTION IF EXISTS public.atlas_debug_function_privileges();
