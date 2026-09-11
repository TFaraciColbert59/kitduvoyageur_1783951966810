-- ==============================================================================
-- A9 — Hardening (Phase 9)
-- M11 : index de performance justifiés par les requêtes réelles du domaine.
-- Additif et idempotent. Aucune table ou policy modifiée.
--
-- Requêtes servies :
--   • agrégation collective par segment + ordre temporel (Phase 4)     → idx 1
--   • lecture des événements de domaine par acteur (A1/A6)             → idx 2
--   • expiration Terrain Live des rapports publiés (Phase 5)           → idx 3
--   • claim FIFO des sessions à traiter (Phase 2)                      → idx 4
-- ==============================================================================

-- ── 1. Passages collectifs : segment + entrée ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_session_segment_passages_segment_entered
  ON public.session_segment_passages(segment_id, entered_at DESC);

-- ── 2. Événements de domaine : acteur + récence ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_adventure_domain_events_actor
  ON public.adventure_domain_events(actor_id, created_at DESC);

-- ── 3. Expiration des rapports publiés ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_terrain_reports_expires_public
  ON public.terrain_reports(expires_at)
  WHERE status IN ('confirmed', 'active');

-- ── 4. Claim FIFO des sessions en attente ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_hike_sessions_pending_created
  ON public.hike_sessions(created_at)
  WHERE processing_status = 'pending';

COMMENT ON INDEX public.idx_session_segment_passages_segment_entered IS
  'A9 — agrégation collective par segment avec ordre temporel (Phase 4).';
COMMENT ON INDEX public.idx_adventure_domain_events_actor IS
  'A9 — flux d''événements de domaine par acteur (transparence utilisateur).';
COMMENT ON INDEX public.idx_terrain_reports_expires_public IS
  'A9 — balayage d''expiration des rapports Terrain Live publiés.';
COMMENT ON INDEX public.idx_hike_sessions_pending_created IS
  'A9 — file FIFO des sessions à traiter (claim SKIP LOCKED).';
