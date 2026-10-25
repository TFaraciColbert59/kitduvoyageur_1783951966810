-- ==============================================================================
-- ROLLBACK — CHANTIER UNIFICATION — PHASE 7 : BUS D'ÉVÉNEMENTS UNIQUE
-- Migration down: 20260907010000_create_lkv_events_bus.down.sql
-- ==============================================================================

DROP FUNCTION IF EXISTS public.purge_expired_lkv_events();
DROP TABLE IF EXISTS public.lkv_events CASCADE;
