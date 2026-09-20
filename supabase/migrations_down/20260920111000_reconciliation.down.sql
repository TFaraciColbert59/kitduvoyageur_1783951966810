-- Rollback 20260920111000 — retire l'archive de l'ancienne projection.
DROP TABLE IF EXISTS public.progression_legacy_snapshot;
