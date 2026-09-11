-- ==============================================================================
-- A6 — Runs moteurs : autorise le statut 'skipped' (observabilité honnête)
-- Un moteur sans source déterministe (weather/regulations/documents) n'est ni
-- un succès ni un échec : il est journalisé comme ignoré.
-- ==============================================================================

ALTER TABLE public.adventure_engine_runs
  DROP CONSTRAINT IF EXISTS adventure_engine_runs_status_check;

ALTER TABLE public.adventure_engine_runs
  ADD CONSTRAINT adventure_engine_runs_status_check
  CHECK (status IN ('running', 'succeeded', 'skipped', 'failed'));

COMMENT ON COLUMN public.adventure_engine_runs.status IS
  'Statut du run moteur : running | succeeded | skipped (source absente) | failed.';
